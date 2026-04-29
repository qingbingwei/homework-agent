import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "./config.js";
import { runReportService } from "./reporting/service.js";
import { AgentError } from "./http/errors.js";

interface UploadSlots {
  assignment: { filename: string; data: Buffer } | null;
  template: { filename: string; data: Buffer } | null;
}

const readUploads = async (request: FastifyRequest): Promise<UploadSlots> => {
  const slots: UploadSlots = { assignment: null, template: null };
  for await (const part of request.parts()) {
    if (part.type !== "file") continue;
    if (part.fieldname !== "assignment" && part.fieldname !== "template") continue;
    const buffer = await part.toBuffer();
    slots[part.fieldname] = { filename: part.filename ?? "upload", data: buffer };
  }
  return slots;
};

export const registerRoutes = async (app: FastifyInstance, config: AppConfig) => {
  app.get("/health", async () => ({
    status: "ok",
    model: config.llmModel,
    agent_key_configured: Boolean(config.llmApiKey),
    base_url: config.llmBaseUrl,
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
    if (!slots.template) {
      throw new AgentError({
        code: "missing_template",
        message: "template file is required",
        stage: "request_handling",
        statusCode: 400,
      });
    }

    const payload = await runReportService(config, {
      assignment: slots.assignment,
      template: slots.template,
      requestId: request.requestId,
    });
    reply.header("Content-Type", "application/json").send(payload);
  });
};
