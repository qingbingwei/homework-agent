import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import type { AppConfig } from "../config.js";
import { LIMITS } from "../constants.js";
import { buildRunnableConfig } from "../llm/tracing.js";
import { rootLogger } from "../logger.js";
import type { ParsedDocument } from "../parsing/index.js";
import { runCodingPlan } from "./codingAgent/executor.js";
import { createCodeRuntime, type CodeRuntime } from "./codingAgent/runtime.js";
import { planAssignment } from "./planWrite/planner.js";
import { writeReport } from "./planWrite/writer.js";
import { nonCodeTaskResult, type TaskPlan, type TaskResult } from "./schema.js";
import type { GraphInput, GraphState } from "./state.js";
import { GraphAnnotation, initialGraphState } from "./state.js";

type GraphNode = "coding_node" | "write_node";

export interface GraphDependencies {
  config: AppConfig;
  planWriteModel: ChatOpenAI;
  codingModel: ChatOpenAI;
  templateDocxBytes: Buffer | null;
  codeRuntime?: CodeRuntime;
}

export const buildGraph = (deps: GraphDependencies) => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode("plan_node", async (state) => {
      const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
        runName: "plan-write/plan",
        tags: ["plan-write", "plan"],
        model: deps.config.planLlm.model,
      });
      const plan = await planAssignment({
        llm: deps.planWriteModel,
        assignment: state.assignment,
        template: state.template,
        supplementalInstructions: state.supplementalInstructions,
        runnableConfig,
      });
      rootLogger.info({ requestId: state.requestId, tasks: plan.tasks.length }, "plan ready");
      return {
        plan,
        results: hasCodeTasks(plan) ? [] : plan.tasks.map(nonCodeTaskResult),
      };
    })
    .addNode("coding_node", async (state) => {
      if (!state.plan) throw new Error("plan missing before coding node");
      const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
        runName: "coding-agent",
        tags: ["coding-agent"],
        model: state.modelLabel,
      });
      const results: TaskResult[] = await runCodingPlan({
        llm: deps.codingModel,
        plan: state.plan,
        requestId: state.requestId,
        supplementalInstructions: state.supplementalInstructions,
        runnableConfig,
        runtime: deps.codeRuntime ?? createCodeRuntime(deps.config.codeExecution),
      });
      return { results };
    })
    .addNode("write_node", async (state) => {
      if (!state.plan) throw new Error("plan missing before write node");
      const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
        runName: "plan-write/write",
        tags: ["plan-write", "write"],
        model: deps.config.planLlm.model,
      });
      const writer = await writeReport({
        llm: deps.planWriteModel,
        assignment: state.assignment,
        template: templateForWriter(state.template, deps.templateDocxBytes),
        plan: state.plan,
        results: state.results,
        requestId: state.requestId,
        supplementalInstructions: state.supplementalInstructions,
        runnableConfig,
      });
      return { writer };
    });

  graph.addEdge(START, "plan_node");
  graph.addConditionalEdges("plan_node", routeAfterPlan);
  graph.addEdge("coding_node", "write_node");
  graph.addEdge("write_node", END);

  return graph.compile();
};

const routeAfterPlan = (state: GraphState): GraphNode => {
  if (!state.plan) throw new Error("plan missing after plan node");
  return hasCodeTasks(state.plan) ? "coding_node" : "write_node";
};

const hasCodeTasks = (plan: TaskPlan): boolean => plan.tasks.some((task) => task.requires_code);

const templateForWriter = (
  template: ParsedDocument | null,
  docxBytes: Buffer | null,
): ParsedDocument | null => {
  if (!template || template.kind !== ".docx") return template;
  if (!docxBytes) throw new Error("docx template bytes missing before write node");
  return { ...template, rawBytes: docxBytes };
};

export const runGraph = async (deps: GraphDependencies, input: GraphInput): Promise<GraphState> => {
  const graph = buildGraph(deps);
  const initial = initialGraphState(input);
  return graph.invoke(initial, {
    // 单个 agent 内部 tool-calling 循环每一步都计入 recursion limit。
    // coding 节点可能有多个 task，每个 task 的 agent 可消耗 5-15 步。
    // 常量集中定义，便于在任务复杂度变化时显式调整。
    recursionLimit: LIMITS.GRAPH_RECURSION_LIMIT,
    configurable: { request_id: input.requestId },
  });
};
