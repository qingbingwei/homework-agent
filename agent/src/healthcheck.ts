import { cleanupStaleSandboxes } from "./agents/codingAgent/sandbox.js";
import { cleanupStaleDocxWriterWorkspaces } from "./agents/planWrite/docxWorkspace.js";

export const runStartupChecks = async (): Promise<void> => {
  await cleanupStaleSandboxes();
  await cleanupStaleDocxWriterWorkspaces();
};
