import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env");
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
} else {
  loadEnv();
}

export interface AppConfig {
  host: string;
  port: number;
  planLlm: PlanLlmConfig;
  codingLlm: CodingLlmConfig;
  codingDeepseekLlm: CodingDeepseekLlmConfig;
  langsmith: {
    enabled: boolean;
    apiKey: string;
    project: string;
    endpoint: string;
  };
}

export interface DeepseekLlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: "high" | "max";
  thinkingType: "enabled" | "disabled";
}

export interface PlanLlmConfig extends DeepseekLlmConfig {}

export interface CodingDeepseekLlmConfig extends DeepseekLlmConfig {
  kind: "deepseek";
}

export type CodingModelProfile = "gpt" | "deepseek";
export type DeepseekReasoningEffort = DeepseekLlmConfig["reasoningEffort"];
export type DeepseekThinkingType = DeepseekLlmConfig["thinkingType"];

export interface CodingLlmConfig {
  kind: "gpt";
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  reviewModel: string;
  reasoningEffort: "low" | "medium" | "high" | "xhigh";
  thinkingType: "enabled" | "disabled";
  disableResponseStorage: boolean;
  networkAccess: "enabled" | "disabled";
  windowsWslSetupAcknowledged: boolean;
  contextWindow: number;
  autoCompactTokenLimit: number;
  wireApi: "chat_completions" | "responses";
  requiresOpenAIAuth: boolean;
}

export type CodingChatLlmConfig = CodingLlmConfig | CodingDeepseekLlmConfig;

export const codingModelProfiles: readonly CodingModelProfile[] = ["gpt", "deepseek"];
export const deepseekCodingReasoningEfforts = ["high", "max"] as const;
export const deepseekCodingThinkingTypes = ["enabled", "disabled"] as const;
const planReasoningEfforts = ["high", "max"] as const;
const gptCodingReasoningEfforts = ["low", "medium", "high", "xhigh"] as const;
const DEFAULT_GPT_CODING_REASONING_EFFORT: CodingLlmConfig["reasoningEffort"] = "xhigh";
const DEFAULT_DEEPSEEK_CODING_REASONING_EFFORT: DeepseekReasoningEffort = "max";
const DEFAULT_DEEPSEEK_CODING_THINKING_TYPE: DeepseekThinkingType = "enabled";

const required = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required env: ${key}`);
};

const booleanFlag = (key: string, fallback: boolean): boolean => {
  const value = process.env[key];
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const numberValue = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const prefixed = (prefix: string, suffix: string): string => `${prefix}_${suffix}`;

const enumValue = <T extends readonly string[]>(key: string, fallback: T[number], values: T): T[number] => {
  const value = required(key, fallback);
  if ((values as readonly string[]).includes(value)) return value as T[number];
  throw new Error(`invalid ${key}: ${value}; expected one of ${values.join(", ")}`);
};

export const normalizeCodingModelProfile = (value: string | undefined): CodingModelProfile => {
  const normalized = (value ?? "gpt").trim().toLowerCase();
  if (normalized === "gpt" || normalized === "deepseek") return normalized;
  throw new Error(`unsupported coding model profile: ${value}`);
};

export const normalizeDeepseekReasoningEffort = (
  value: string | undefined,
): DeepseekReasoningEffort | undefined => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if ((deepseekCodingReasoningEfforts as readonly string[]).includes(normalized)) {
    return normalized as DeepseekReasoningEffort;
  }
  throw new Error(`unsupported deepseek reasoning effort: ${value}; expected high or max`);
};

export const normalizeDeepseekThinkingType = (
  value: string | undefined,
): DeepseekThinkingType | undefined => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if ((deepseekCodingThinkingTypes as readonly string[]).includes(normalized)) {
    return normalized as DeepseekThinkingType;
  }
  throw new Error(`unsupported deepseek thinking type: ${value}; expected enabled or disabled`);
};

export const selectCodingLlmConfig = (
  config: AppConfig,
  profile: CodingModelProfile,
  reasoningEffort?: DeepseekReasoningEffort,
  thinkingType?: DeepseekThinkingType,
): CodingChatLlmConfig => {
  if (profile === "deepseek") {
    return {
      ...config.codingDeepseekLlm,
      reasoningEffort: reasoningEffort ?? config.codingDeepseekLlm.reasoningEffort,
      thinkingType: thinkingType ?? config.codingDeepseekLlm.thinkingType,
    };
  }
  return { ...config.codingLlm, reasoningEffort: DEFAULT_GPT_CODING_REASONING_EFFORT };
};

const loadPlanLlmConfig = (): PlanLlmConfig => ({
  baseUrl: required("PLAN_LLM_BASE_URL", "https://api.deepseek.com/v1"),
  apiKey: required("PLAN_LLM_API_KEY", ""),
  model: required("PLAN_LLM_MODEL", "deepseek-v4-pro"),
  reasoningEffort: enumValue("PLAN_LLM_REASONING_EFFORT", "high", planReasoningEfforts),
  thinkingType: required("PLAN_LLM_THINKING_TYPE", "enabled") as PlanLlmConfig["thinkingType"],
});

const loadCodingLlmConfig = (): CodingLlmConfig => ({
  kind: "gpt",
  provider: required("CODING_LLM_MODEL_PROVIDER", "OpenAI"),
  baseUrl: required("CODING_LLM_BASE_URL", "https://api.asxs.top/v1"),
  apiKey: required("CODING_LLM_API_KEY", ""),
  model: required("CODING_LLM_MODEL", "gpt-5.5"),
  reviewModel: required("CODING_LLM_REVIEW_MODEL", required("CODING_LLM_MODEL", "gpt-5.5")),
  reasoningEffort: enumValue("CODING_LLM_REASONING_EFFORT", DEFAULT_GPT_CODING_REASONING_EFFORT, gptCodingReasoningEfforts),
  thinkingType: required("CODING_LLM_THINKING_TYPE", "enabled") as CodingLlmConfig["thinkingType"],
  disableResponseStorage: booleanFlag("CODING_LLM_DISABLE_RESPONSE_STORAGE", true),
  networkAccess: required("CODING_LLM_NETWORK_ACCESS", "enabled") as CodingLlmConfig["networkAccess"],
  windowsWslSetupAcknowledged: booleanFlag("CODING_LLM_WINDOWS_WSL_SETUP_ACKNOWLEDGED", true),
  contextWindow: numberValue("CODING_LLM_CONTEXT_WINDOW", 400000),
  autoCompactTokenLimit: numberValue("CODING_LLM_AUTO_COMPACT_TOKEN_LIMIT", 360000),
  wireApi: required("CODING_LLM_WIRE_API", "responses") as CodingLlmConfig["wireApi"],
  requiresOpenAIAuth: booleanFlag("CODING_LLM_REQUIRES_OPENAI_AUTH", true),
});

const loadCodingDeepseekLlmConfig = (): CodingDeepseekLlmConfig => ({
  kind: "deepseek",
  baseUrl: required(prefixed("CODING_DEEPSEEK_LLM", "BASE_URL"), "https://api.deepseek.com/v1"),
  apiKey: required(prefixed("CODING_DEEPSEEK_LLM", "API_KEY"), ""),
  model: required(prefixed("CODING_DEEPSEEK_LLM", "MODEL"), "deepseek-v4-pro"),
  reasoningEffort: enumValue(
    prefixed("CODING_DEEPSEEK_LLM", "REASONING_EFFORT"),
    DEFAULT_DEEPSEEK_CODING_REASONING_EFFORT,
    deepseekCodingReasoningEfforts,
  ),
  thinkingType: enumValue(
    prefixed("CODING_DEEPSEEK_LLM", "THINKING_TYPE"),
    DEFAULT_DEEPSEEK_CODING_THINKING_TYPE,
    deepseekCodingThinkingTypes,
  ),
});

export const loadConfig = (): AppConfig => {
  const tracingFlag = (process.env.LANGSMITH_TRACING ?? "").toLowerCase();
  const tracingEnabled = tracingFlag === "true" || tracingFlag === "1";
  return {
    host: required("AGENT_HOST", "127.0.0.1"),
    port: Number(required("AGENT_PORT", "19000")),
    planLlm: loadPlanLlmConfig(),
    codingLlm: loadCodingLlmConfig(),
    codingDeepseekLlm: loadCodingDeepseekLlmConfig(),
    langsmith: {
      enabled: tracingEnabled && Boolean(process.env.LANGSMITH_API_KEY),
      apiKey: process.env.LANGSMITH_API_KEY ?? "",
      project: process.env.LANGSMITH_PROJECT ?? "homework-agent",
      endpoint: process.env.LANGSMITH_ENDPOINT ?? "https://api.smith.langchain.com",
    },
  };
};
