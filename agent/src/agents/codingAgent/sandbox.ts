import { rmSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { AgentError } from "../../http/errors.js";
import { sanitizeWorkspaceSegment } from "../workspaceUtils.js";

export interface Sandbox {
  requestId: string;
  taskId: string;
  rootDir: string;
  dispose(): Promise<void>;
  resolveWithin(relativePath: string): string;
}

const SANDBOX_ROOT = join(tmpdir(), "homework-agent-coding");

process.once("exit", () => {
  rmSync(SANDBOX_ROOT, { recursive: true, force: true });
});

export const cleanupStaleSandboxes = async (): Promise<void> => {
  await rm(SANDBOX_ROOT, { recursive: true, force: true }).catch(() => undefined);
};

export const createSandbox = async (requestId: string, taskId: string): Promise<Sandbox> => {
  const safeRequest = sanitizeWorkspaceSegment(requestId, "req");
  const safeTask = sanitizeWorkspaceSegment(taskId, "task");
  const rootDir = join(SANDBOX_ROOT, safeRequest, safeTask);
  await mkdir(rootDir, { recursive: true });

  const resolveWithin = (relativePath: string): string => {
    if (isAbsolute(relativePath)) {
      throw new AgentError({
        code: "sandbox_path_escape",
        message: `absolute paths are not allowed: ${relativePath}`,
        stage: "code",
        statusCode: 400,
      });
    }
    const resolved = resolve(rootDir, relativePath);
    const rel = relative(rootDir, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new AgentError({
        code: "sandbox_path_escape",
        message: `path escapes sandbox: ${relativePath}`,
        stage: "code",
        statusCode: 400,
      });
    }
    return resolved;
  };

  return {
    requestId: safeRequest,
    taskId: safeTask,
    rootDir,
    resolveWithin,
    dispose: async () => {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
};
