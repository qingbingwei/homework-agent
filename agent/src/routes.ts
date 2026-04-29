import type { FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";

export const registerRoutes = async (app: FastifyInstance, config: AppConfig) => {
  app.get("/health", async () => ({
    status: "ok",
    model: config.llmModel,
    agent_key_configured: Boolean(config.llmApiKey),
    base_url: config.llmBaseUrl,
  }));

  app.post("/generate-report", async () => {
    throw new Error("generate-report not yet wired up; waiting for graph implementation");
  });
};
