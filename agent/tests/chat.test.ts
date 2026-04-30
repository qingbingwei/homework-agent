import { describe, expect, it } from "vitest";
import type { AppConfig, CodingDeepseekLlmConfig, CodingLlmConfig } from "../src/config.js";
import { createChatModel } from "../src/llm/chat.js";

const gptCodingConfig: CodingLlmConfig = {
  provider: "OpenAI",
  baseUrl: "https://example.invalid/v1",
  apiKey: "sk-coding",
  model: "gpt-5.5",
  reviewModel: "gpt-5.5",
  reasoningEffort: "xhigh",
  thinkingType: "enabled",
  disableResponseStorage: true,
  networkAccess: "enabled",
  windowsWslSetupAcknowledged: true,
  contextWindow: 400000,
  autoCompactTokenLimit: 360000,
  wireApi: "responses",
  requiresOpenAIAuth: true,
};

const deepseekCodingConfig: CodingDeepseekLlmConfig = {
  baseUrl: "https://example.invalid/v1",
  apiKey: "sk-deepseek",
  model: "deepseek-v4-pro",
  reasoningEffort: "max",
  thinkingType: "enabled",
};

const baseConfig = (): AppConfig => ({
  host: "127.0.0.1",
  port: 19000,
  planLlm: {
    baseUrl: "https://example.invalid/v1",
    apiKey: "sk-plan",
    model: "deepseek-v4-pro",
    reasoningEffort: "high",
    thinkingType: "enabled",
  },
  codingLlm: gptCodingConfig,
  codingDeepseekLlm: deepseekCodingConfig,
  langsmith: {
    enabled: false,
    apiKey: "",
    project: "test",
    endpoint: "https://example.invalid",
  },
});

describe("createChatModel", () => {
  it("passes coding reasoning effort through without remapping xhigh", () => {
    const model = createChatModel(baseConfig(), "coding");

    expect(model.modelKwargs).toMatchObject({
      reasoning_effort: "xhigh",
      store: false,
      extra_body: {
        thinking: {
          type: "enabled",
        },
      },
    });
  });

  it("uses DeepSeek coding config without OpenAI-only storage params", () => {
    const config = baseConfig();
    const model = createChatModel(config, "coding", { codingLlm: config.codingDeepseekLlm });

    expect(model.model).toBe("deepseek-v4-pro");
    expect(model.modelKwargs).toMatchObject({
      reasoning_effort: "max",
      extra_body: {
        thinking: {
          type: "enabled",
        },
      },
    });
    expect(model.modelKwargs).not.toHaveProperty("store");
  });
});
