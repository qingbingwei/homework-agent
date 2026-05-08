import { execa } from "execa";
import { cleanupStaleSandboxes } from "./agents/codingAgent/sandbox.js";
import { cleanupStaleDocxWriterWorkspaces } from "./agents/planWrite/docxWorkspace.js";
import { LIMITS } from "./constants.js";
import { rootLogger } from "./logger.js";
import { cleanupStaleDocxRenderWorkdirs } from "./templates/index.js";

export const runStartupChecks = async (): Promise<void> => {
  await cleanupStaleSandboxes();
  await cleanupStaleDocxWriterWorkspaces();
  await cleanupStaleDocxRenderWorkdirs();
  await checkPandoc();
};

const checkPandoc = async (): Promise<void> => {
  try {
    await execa("pandoc", ["--version"], { timeout: LIMITS.STARTUP_CHECK_TIMEOUT_MS });
    rootLogger.info({}, "pandoc is available");
  } catch (err) {
    rootLogger.warn({ err }, "pandoc is not available; markdown-to-docx rendering will fail");
  }
};
