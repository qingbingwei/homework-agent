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
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  langsmith: {
    enabled: boolean;
    apiKey: string;
    project: string;
    endpoint: string;
  };
}

const required = (key: string, fallback?: string): string => {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required env: ${key}`);
};

export const loadConfig = (): AppConfig => {
  const tracingFlag = (process.env.LANGSMITH_TRACING ?? "").toLowerCase();
  const tracingEnabled = tracingFlag === "true" || tracingFlag === "1";
  return {
    host: required("AGENT_HOST", "127.0.0.1"),
    port: Number(required("AGENT_PORT", "8000")),
    llmBaseUrl: required("LLM_BASE_URL", "https://api.asxs.top/v1"),
    llmApiKey: required("LLM_API_KEY", ""),
    llmModel: required("LLM_MODEL", "gpt-5.5"),
    langsmith: {
      enabled: tracingEnabled && Boolean(process.env.LANGSMITH_API_KEY),
      apiKey: process.env.LANGSMITH_API_KEY ?? "",
      project: process.env.LANGSMITH_PROJECT ?? "homework-agent",
      endpoint: process.env.LANGSMITH_ENDPOINT ?? "https://api.smith.langchain.com",
    },
  };
};
