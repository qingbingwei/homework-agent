import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import type { AppConfig } from "../config.js";
import { buildRunnableConfig } from "../llm/tracing.js";
import { rootLogger } from "../logger.js";
import { nonCodeTaskResult, runCodingPlan } from "./codingAgent/executor.js";
import { planAssignment } from "./planWrite/planner.js";
import { writeReport } from "./planWrite/writer.js";
import type { TaskResult } from "./schema.js";
import type { GraphInput, GraphState } from "./state.js";
import { GraphAnnotation, initialGraphState } from "./state.js";

type GraphNode = "coding_node" | "write_node";

export interface GraphDependencies {
  config: AppConfig;
  planWriteModel: ChatOpenAI;
  codingModel: ChatOpenAI;
}

export const buildGraph = (deps: GraphDependencies) => {
  const graph = new StateGraph(GraphAnnotation)
    .addNode("plan_node", async (state) => {
      const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
        runName: "plan-write/plan",
        tags: ["plan-write", "plan"],
        model: deps.config.planLlm.model,
      });
      const plan = await planAssignment(deps.planWriteModel, state.assignment, state.template, runnableConfig);
      rootLogger.info({ requestId: state.requestId, tasks: plan.tasks.length }, "plan ready");
      return {
        plan,
        results: plan.tasks.some((task) => task.requires_code) ? [] : plan.tasks.map(nonCodeTaskResult),
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
        assignment: state.assignment,
        template: state.template,
        requestId: state.requestId,
        runnableConfig,
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
        template: state.template,
        plan: state.plan,
        results: state.results,
        requestId: state.requestId,
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
  return state.plan.tasks.some((task) => task.requires_code) ? "coding_node" : "write_node";
};

export const runGraph = async (deps: GraphDependencies, input: GraphInput): Promise<GraphState> => {
  const graph = buildGraph(deps);
  const initial = initialGraphState(input);
  return graph.invoke(initial, {
    // 单个 agent 内部 tool-calling 循环每一步都计入 recursion limit。
    // coding 节点可能有多个 task，每个 task 的 agent 可消耗 5-15 步。
    // 200 足以容纳合理的 task 数量和 tool 调用，同时仍提供上限保护。
    recursionLimit: 200,
    configurable: { request_id: input.requestId },
  });
};
