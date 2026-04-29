import { ChatOpenAI } from "@langchain/openai";
import type { AppConfig } from "../config.js";

export interface LLMFactoryOptions {
  temperature?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export const createChatModel = (config: AppConfig, options: LLMFactoryOptions = {}): ChatOpenAI => {
  if (!config.llmApiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }
  return new ChatOpenAI({
    apiKey: config.llmApiKey,
    model: config.llmModel,
    temperature: options.temperature ?? 0.2,
    configuration: { baseURL: config.llmBaseUrl },
    tags: options.tags,
    metadata: options.metadata,
  });
};
