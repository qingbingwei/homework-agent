import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execa } from "execa";
import type { Sandbox } from "./sandbox.js";

const truncate = (value: string, max = 4000): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...<truncated ${value.length - max} chars>`;
};

const SHELL_ALLOWLIST = new Set([
  "python3",
  "node",
  "ls",
  "cat",
  "printf",
  "echo",
  "true",
  "false",
  "pwd",
  "head",
  "tail",
]);

export interface ToolRegistry {
  writeFile: ReturnType<typeof buildWriteFileTool>;
  readFile: ReturnType<typeof buildReadFileTool>;
  runShell: ReturnType<typeof buildRunShellTool>;
  runPython: ReturnType<typeof buildRunPythonTool>;
  runNode: ReturnType<typeof buildRunNodeTool>;
}

export const buildCodingTools = (sandbox: Sandbox): ToolRegistry => ({
  writeFile: buildWriteFileTool(sandbox),
  readFile: buildReadFileTool(sandbox),
  runShell: buildRunShellTool(sandbox),
  runPython: buildRunPythonTool(sandbox),
  runNode: buildRunNodeTool(sandbox),
});

const buildWriteFileTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "write_file",
    description: "Write UTF-8 text content to a sandbox-relative path. Overwrites existing file.",
    schema: z.object({
      path: z.string().min(1).describe("Relative path inside the sandbox."),
      content: z.string().describe("Full file content to persist."),
    }),
    func: async ({ path, content }) => {
      const absolute = sandbox.resolveWithin(path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, content, "utf8");
      return JSON.stringify({ ok: true, path, bytes: Buffer.byteLength(content, "utf8") });
    },
  });

const buildReadFileTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "read_file",
    description: "Read a UTF-8 file from the sandbox; returns the full content.",
    schema: z.object({
      path: z.string().min(1).describe("Relative path inside the sandbox."),
    }),
    func: async ({ path }) => {
      const absolute = sandbox.resolveWithin(path);
      const content = await readFile(absolute, "utf8");
      return JSON.stringify({ ok: true, path, content: truncate(content, 8000) });
    },
  });

const buildRunShellTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "run_shell",
    description:
      "Run an allow-listed command (e.g. ls, cat, python3, node) with arguments. No network, 20s timeout.",
    schema: z.object({
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
      stdin: z.string().optional(),
    }),
    func: async ({ command, args, stdin }) => {
      if (!SHELL_ALLOWLIST.has(command)) {
        return JSON.stringify({ ok: false, error: `command not allowed: ${command}` });
      }
      try {
        const result = await execa(command, args, {
          cwd: sandbox.rootDir,
          input: stdin,
          timeout: 20_000,
          reject: false,
          env: sanitizedEnv(),
        });
        return JSON.stringify({
          ok: result.exitCode === 0,
          exitCode: result.exitCode,
          stdout: truncate(result.stdout ?? ""),
          stderr: truncate(result.stderr ?? ""),
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: (err as Error).message });
      }
    },
  });

const buildRunPythonTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "run_python",
    description: "Execute a python3 snippet inside the sandbox (isolated mode). 20s timeout.",
    schema: z.object({
      code: z.string().min(1).describe("Python code sent via stdin to python3 -I -"),
      args: z.array(z.string()).default([]),
    }),
    func: async ({ code, args }) => executeInterpreter(sandbox, "python3", ["-I", "-", ...args], code),
  });

const buildRunNodeTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "run_node",
    description: "Execute a Node.js snippet with --input-type=module piped via stdin. 20s timeout.",
    schema: z.object({
      code: z.string().min(1),
      args: z.array(z.string()).default([]),
    }),
    func: async ({ code, args }) =>
      executeInterpreter(sandbox, "node", ["--input-type=module", ...args], code),
  });

const executeInterpreter = async (
  sandbox: Sandbox,
  command: string,
  args: string[],
  stdin: string,
): Promise<string> => {
  try {
    const result = await execa(command, args, {
      cwd: sandbox.rootDir,
      input: stdin,
      timeout: 20_000,
      reject: false,
      env: sanitizedEnv(),
    });
    return JSON.stringify({
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: truncate(result.stdout ?? ""),
      stderr: truncate(result.stderr ?? ""),
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: (err as Error).message });
  }
};

const sanitizedEnv = (): NodeJS.ProcessEnv => {
  const allowedKeys = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE"];
  const result: NodeJS.ProcessEnv = {};
  for (const key of allowedKeys) {
    const value = process.env[key];
    if (typeof value === "string") result[key] = value;
  }
  return result;
};
