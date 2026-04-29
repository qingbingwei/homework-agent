import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AgentError, describeException, type AgentErrorPayload, type ErrorStage } from "./errors.js";
import { rootLogger } from "../logger.js";

const payload = (options: {
  code: string;
  message: string;
  stage: ErrorStage;
  requestId: string;
}): AgentErrorPayload => ({
  code: options.code,
  message: options.message,
  request_id: options.requestId,
  stage: options.stage,
});

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId ?? "";
    if (error instanceof AgentError) {
      rootLogger.warn({ requestId, code: error.code, stage: error.stage }, error.message);
      reply.code(error.statusCode).send(
        payload({ code: error.code, message: error.message, stage: error.stage, requestId }),
      );
      return;
    }
    const err = error as { statusCode?: number; validation?: unknown; message?: string };
    if (err.validation) {
      reply.code(400).send(
        payload({
          code: "invalid_request",
          message: err.message ?? "invalid request",
          stage: "request_handling",
          requestId,
        }),
      );
      return;
    }
    rootLogger.error({ requestId, err: error }, "unhandled request error");
    reply.code(err.statusCode ?? 500).send(
      payload({
        code: "internal_agent_error",
        message: describeException(error),
        stage: "generate_report",
        requestId,
      }),
    );
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send(
      payload({
        code: "not_found",
        message: `route not found: ${request.method} ${request.url}`,
        stage: "request_handling",
        requestId: request.requestId ?? "",
      }),
    );
  });
};
