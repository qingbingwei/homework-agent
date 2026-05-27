import { LIMITS } from "../constants.js";

export const sanitizeWorkspaceSegment = (value: string, fallback: string): string => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, LIMITS.SANDBOX_SEGMENT_LENGTH);
  return cleaned.length > 0 ? cleaned : fallback;
};

export const inheritedWorkspaceEnv = (): NodeJS.ProcessEnv => {
  const allowedKeys = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE"];
  const result: NodeJS.ProcessEnv = {};
  for (const key of allowedKeys) {
    const value = process.env[key];
    if (typeof value === "string") result[key] = value;
  }
  return result;
};

export const isolatedWorkspaceEnv = (rootDir: string): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? "",
  HOME: rootDir,
  LANG: process.env.LANG ?? "C.UTF-8",
  LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
  TMPDIR: rootDir,
});
