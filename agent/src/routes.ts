import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  codingModelProfiles,
  deepseekCodingReasoningEfforts,
  deepseekCodingThinkingTypes,
  normalizeCodingModelProfile,
  normalizeDeepseekReasoningEffort,
  normalizeDeepseekThinkingType,
  type AppConfig,
  type CodingModelProfile,
} from "./config.js";
import { runReportService } from "./reporting/service.js";
import { AgentError } from "./http/errors.js";

interface UploadSlots {
  assignment: { filename: string; data: Buffer } | null;
  template: { filename: string; data: Buffer } | null;
  codingModelProfile: string;
  codingReasoningEffort: string;
  codingThinkingType: string;
  supplementalInstructions: string;
}

const readUploads = async (request: FastifyRequest): Promise<UploadSlots> => {
  const slots: UploadSlots = {
    assignment: null,
    template: null,
    codingModelProfile: "gpt",
    codingReasoningEffort: "",
    codingThinkingType: "",
    supplementalInstructions: "",
  };
  for await (const part of request.parts()) {
    if (part.type !== "file") {
      if (part.fieldname === "coding_model_profile") slots.codingModelProfile = String(part.value ?? "");
      if (part.fieldname === "coding_reasoning_effort") {
        slots.codingReasoningEffort = String(part.value ?? "");
      }
      if (part.fieldname === "coding_thinking_type") slots.codingThinkingType = String(part.value ?? "");
      if (part.fieldname === "supplemental_instructions") {
        slots.supplementalInstructions = String(part.value ?? "").trim();
      }
      continue;
    }
    if (part.fieldname !== "assignment" && part.fieldname !== "template") continue;
    const buffer = await part.toBuffer();
    slots[part.fieldname] = { filename: part.filename ?? "upload", data: buffer };
  }
  return slots;
};

const readCodingModelProfile = (value: string): CodingModelProfile => {
  try {
    return normalizeCodingModelProfile(value);
  } catch (err) {
    throw new AgentError({
      code: "invalid_coding_model_profile",
      message: (err as Error).message,
      stage: "request_handling",
      statusCode: 400,
    });
  }
};

const readCodingReasoningEffort = (profile: CodingModelProfile, value: string) => {
  try {
    return profile === "deepseek" ? normalizeDeepseekReasoningEffort(value) : undefined;
  } catch (err) {
    throw new AgentError({
      code: "invalid_coding_reasoning_effort",
      message: (err as Error).message,
      stage: "request_handling",
      statusCode: 400,
    });
  }
};

const readCodingThinkingType = (profile: CodingModelProfile, value: string) => {
  try {
    return profile === "deepseek" ? normalizeDeepseekThinkingType(value) : undefined;
  } catch (err) {
    throw new AgentError({
      code: "invalid_coding_thinking_type",
      message: (err as Error).message,
      stage: "request_handling",
      statusCode: 400,
    });
  }
};

export const registerRoutes = async (app: FastifyInstance, config: AppConfig) => {
  app.get("/health", async () => ({
    status: "ok",
    plan_model: config.planLlm.model,
    plan_key_configured: Boolean(config.planLlm.apiKey),
    plan_base_url: config.planLlm.baseUrl,
    coding_model_provider: config.codingLlm.provider,
    coding_model: config.codingLlm.model,
    coding_review_model: config.codingLlm.reviewModel,
    coding_base_url: config.codingLlm.baseUrl,
    coding_wire_api: config.codingLlm.wireApi,
    coding_requires_openai_auth: config.codingLlm.requiresOpenAIAuth,
    coding_reasoning_effort: config.codingLlm.reasoningEffort,
    coding_thinking_type: config.codingLlm.thinkingType,
    coding_disable_response_storage: config.codingLlm.disableResponseStorage,
    coding_network_access: config.codingLlm.networkAccess,
    coding_windows_wsl_setup_acknowledged: config.codingLlm.windowsWslSetupAcknowledged,
    coding_model_context_window: config.codingLlm.contextWindow,
    coding_model_auto_compact_token_limit: config.codingLlm.autoCompactTokenLimit,
    code_execution_backend: config.codeExecution.backend,
    code_container_engine: config.codeExecution.container.engine,
    code_container_image: config.codeExecution.container.image,
    code_container_network: config.codeExecution.container.network,
    coding_model_profiles: codingModelProfiles,
    coding_deepseek_reasoning_efforts: deepseekCodingReasoningEfforts,
    coding_deepseek_thinking_types: deepseekCodingThinkingTypes,
    coding_deepseek_model: config.codingDeepseekLlm.model,
    coding_deepseek_reasoning_effort: config.codingDeepseekLlm.reasoningEffort,
    coding_deepseek_thinking_type: config.codingDeepseekLlm.thinkingType,
    coding_deepseek_key_configured: Boolean(config.codingDeepseekLlm.apiKey),
    agent_key_configured: Boolean(config.planLlm.apiKey && config.codingLlm.apiKey),
  }));

  app.post("/generate-report", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new AgentError({
        code: "invalid_content_type",
        message: "expected multipart/form-data",
        stage: "request_handling",
        statusCode: 400,
      });
    }

    const slots = await readUploads(request);
    if (!slots.assignment) {
      throw new AgentError({
        code: "missing_assignment",
        message: "assignment file is required",
        stage: "request_handling",
        statusCode: 400,
      });
    }
    const codingModelProfile = readCodingModelProfile(slots.codingModelProfile);
    const payload = await runReportService(config, {
      assignment: slots.assignment,
      template: slots.template,
      requestId: request.requestId,
      codingModelProfile,
      codingReasoningEffort: readCodingReasoningEffort(codingModelProfile, slots.codingReasoningEffort),
      codingThinkingType: readCodingThinkingType(codingModelProfile, slots.codingThinkingType),
      supplementalInstructions: slots.supplementalInstructions,
    });
    reply.header("Content-Type", "application/json").send(payload);
  });
};
