import { END, START, StateGraph } from "@langchain/langgraph";
import type { ChatOpenAI } from "@langchain/openai";
import type { AppConfig } from "../config.js";
import { buildRunnableConfig } from "../llm/tracing.js";
import { rootLogger } from "../logger.js";
import { runCodingAgent } from "./codingAgent/executor.js";
import { planAssignment } from "./planWrite/planner.js";
import { writeReport } from "./planWrite/writer.js";
import type { TaskResult } from "./schema.js";
import type { GraphInput, GraphState } from "./state.js";
import { initialGraphState } from "./state.js";

const graphChannels = {
  requestId: { value: <T,>(_old: T, next: T) => next, default: () => "" },
  modelLabel: { value: <T,>(_old: T, next: T) => next, default: () => "" },
  assignment: { value: <T,>(_old: T, next: T) => next },
  template: { value: <T,>(_old: T, next: T) => next },
  plan: { value: <T,>(_old: T, next: T) => next, default: () => null },
  results: {
    value: (_old: TaskResult[], next: TaskResult[]) => next,
    default: (): TaskResult[] => [],
  },
  writer: { value: <T,>(_old: T, next: T) => next, default: () => null },
  error: { value: <T,>(_old: T, next: T) => next, default: () => null },
};

export interface GraphDependencies {
  config: AppConfig;
  planWriteModel: ChatOpenAI;
  codingModel: ChatOpenAI;
}

export const buildGraph = (deps: GraphDependencies) => {
  const graph = new StateGraph<GraphState>({ channels: graphChannels as never });

  graph.addNode("plan", async (state) => {
    const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
      runName: "plan-write/plan",
      tags: ["plan-write", "plan"],
    });
    const plan = await planAssignment(deps.planWriteModel, state.assignment, state.template, runnableConfig);
    rootLogger.info({ requestId: state.requestId, tasks: plan.tasks.length }, "plan ready");
    return { plan };
  });

  graph.addNode("coding", async (state) => {
    if (!state.plan) throw new Error("plan missing before coding node");
    const results: TaskResult[] = [];
    for (const task of state.plan.tasks) {
      const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
        runName: `coding-agent/${task.id}`,
        tags: ["coding-agent", `task:${task.id}`],
        metadata: { task_title: task.title },
      });
      try {
        const result = await runCodingAgent(
          deps.codingModel,
          task,
          state.assignment,
          state.template,
          state.requestId,
          runnableConfig,
        );
        results.push(result);
      } catch (err) {
        rootLogger.error({ requestId: state.requestId, task: task.id, err }, "coding-agent failed");
        results.push({
          task_id: task.id,
          status: "failed",
          explanation: (err as Error).message,
          code: "",
          language: task.language,
          stdout: "",
          stderr: "",
          artifacts: [],
        });
      }
    }
    return { results };
  });

  graph.addNode("write", async (state) => {
    if (!state.plan) throw new Error("plan missing before write node");
    const runnableConfig = buildRunnableConfig(deps.config, state.requestId, {
      runName: "plan-write/write",
      tags: ["plan-write", "write"],
    });
    const writer = await writeReport(
      deps.planWriteModel,
      state.assignment,
      state.template,
      state.plan,
      state.results,
      runnableConfig,
    );
    return { writer };
  });

  graph.addEdge(START as never, "plan" as never);
  graph.addEdge("plan" as never, "coding" as never);
  graph.addEdge("coding" as never, "write" as never);
  graph.addEdge("write" as never, END as never);

  return graph.compile();
};

export const runGraph = async (deps: GraphDependencies, input: GraphInput): Promise<GraphState> => {
  const graph = buildGraph(deps);
  const initial = initialGraphState(input);
  const final = (await graph.invoke(initial, {
    recursionLimit: 20,
    configurable: { request_id: input.requestId },
  })) as GraphState;
  return final;
};
