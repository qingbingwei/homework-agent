import pino from "pino";

export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "homework-agent" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = pino.Logger;
