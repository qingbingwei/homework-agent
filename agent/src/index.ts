import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { loadConfig } from "./config.js";
import { rootLogger } from "./logger.js";
import { registerRequestId } from "./http/requestId.js";
import { registerErrorHandler } from "./http/errorHandler.js";
import { registerRoutes } from "./routes.js";
import { runStartupChecks } from "./healthcheck.js";

const bootstrap = async () => {
  const config = loadConfig();
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    bodyLimit: 32 * 1024 * 1024,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 32 * 1024 * 1024,
      files: 4,
    },
  });

  registerRequestId(app);
  registerErrorHandler(app);
  await runStartupChecks();
  await registerRoutes(app, config);

  try {
    await app.listen({ host: config.host, port: config.port });
    rootLogger.info({ host: config.host, port: config.port }, "homework-agent listening");
  } catch (err) {
    rootLogger.error({ err }, "failed to start homework-agent");
    process.exit(1);
  }
};

bootstrap();
