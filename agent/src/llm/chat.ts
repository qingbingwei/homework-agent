import { ChatOpenAI } from "@langchain/openai";
import type { AppConfig, CodingChatLlmConfig } from "../config.js";

export type AgentModelRole = "plan" | "coding";

export interface LLMFactoryOptions {
  temperature?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  codingLlm?: CodingChatLlmConfig;
}

const codingModelKwargs = (codingConfig: CodingChatLlmConfig): Record<string, unknown> => {
  const kwargs: Record<string, unknown> = {
    reasoning_effort: codingConfig.reasoningEffort,
    extra_body: {
      thinking: {
        type: codingConfig.thinkingType,
      },
    },
  };
  if ("requiresOpenAIAuth" in codingConfig && codingConfig.requiresOpenAIAuth) {
    kwargs.store = !codingConfig.disableResponseStorage;
  }
  return kwargs;
};

export const createChatModel = (
  config: AppConfig,
  role: AgentModelRole,
  options: LLMFactoryOptions = {},
): ChatOpenAI => {
  const modelConfig = role === "plan" ? config.planLlm : (options.codingLlm ?? config.codingLlm);
  if (!modelConfig.apiKey) {
    throw new Error(`${role.toUpperCase()}_LLM_API_KEY is not configured`);
  }

  const baseConfig = {
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    temperature: options.temperature ?? 0.2,
    configuration: { baseURL: modelConfig.baseUrl },
    tags: options.tags,
    metadata: options.metadata,
  };

  if (role === "plan") {
    return new ChatOpenAI({
      ...baseConfig,
      modelKwargs: {
        reasoning_effort: config.planLlm.reasoningEffort,
        extra_body: {
          thinking: {
            type: config.planLlm.thinkingType,
          },
        },
      },
    });
  }

  const codingConfig = options.codingLlm ?? config.codingLlm;

  return new ChatOpenAI({
    ...baseConfig,
    modelKwargs: codingModelKwargs(codingConfig),
  });
};
