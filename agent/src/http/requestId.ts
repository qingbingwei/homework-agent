import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

const shortId = () => randomUUID().replace(/-/g, "").slice(0, 12);

export const registerRequestId = (app: FastifyInstance) => {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const id = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId = typeof id === "string" && id.length > 0 ? id : shortId();
    request.requestId = requestId;
    reply.header("X-Request-ID", requestId);
  });
};
