import type { RunnableConfig } from "@langchain/core/runnables";
import type { AppConfig } from "../config.js";
import { rootLogger } from "../logger.js";

export interface TracingOptions {
  runName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  model?: string;
}

let tracingReady = false;

const ensureTracingEnv = (config: AppConfig) => {
  if (tracingReady) return;
  if (!config.langsmith.enabled) {
    rootLogger.info({}, "langsmith tracing disabled (missing api key or flag)");
    tracingReady = true;
    return;
  }
  process.env.LANGSMITH_TRACING = "true";
  process.env.LANGCHAIN_TRACING_V2 = "true";
  process.env.LANGSMITH_API_KEY = config.langsmith.apiKey;
  process.env.LANGCHAIN_API_KEY = config.langsmith.apiKey;
  process.env.LANGSMITH_PROJECT = config.langsmith.project;
  process.env.LANGCHAIN_PROJECT = config.langsmith.project;
  process.env.LANGSMITH_ENDPOINT = config.langsmith.endpoint;
  process.env.LANGCHAIN_ENDPOINT = config.langsmith.endpoint;
  rootLogger.info({ project: config.langsmith.project }, "langsmith tracing enabled");
  tracingReady = true;
};

export const buildRunnableConfig = (
  config: AppConfig,
  requestId: string,
  options: TracingOptions = {},
): RunnableConfig => {
  ensureTracingEnv(config);
  return {
    runName: options.runName ?? "homework-agent",
    tags: ["homework-agent", `request:${requestId}`, ...(options.tags ?? [])],
    metadata: {
      request_id: requestId,
      model: options.model ?? config.planLlm.model,
      ...(options.metadata ?? {}),
    },
  };
};
