import type { ChatOpenAI } from "@langchain/openai";
import type { CreateDeepAgentParams } from "deepagents";

export type DeepAgentModel = CreateDeepAgentParams["model"];
export type DeepAgentRuntimeModel = Exclude<NonNullable<DeepAgentModel>, string>;

const REQUIRED_MODEL_METHODS = ["invoke", "bindTools"] as const;

export const asDeepAgentModel = (llm: ChatOpenAI | DeepAgentRuntimeModel): DeepAgentModel => {
  const candidate = llm as unknown as Record<string, unknown>;
  for (const method of REQUIRED_MODEL_METHODS) {
    if (typeof candidate[method] !== "function") {
      throw new Error(`model instance is missing required DeepAgent method: ${method}`);
    }
  }
  return llm;
};
