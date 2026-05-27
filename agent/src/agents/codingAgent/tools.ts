import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Sandbox } from "./sandbox.js";
import { LIMITS } from "../../constants.js";
import { createHostCodeRuntime, type CodeRuntime } from "./runtime.js";

const truncate = (value: string, max: number = LIMITS.TOOL_STDOUT): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...<truncated ${value.length - max} chars>`;
};

const SHELL_ALLOWLIST = new Set([
  "python3",
  "node",
  "java",
  "javac",
  "gcc",
  "g++",
  "clang",
  "clang++",
  "ls",
  "cat",
  "printf",
  "echo",
  "true",
  "false",
  "pwd",
  "head",
  "tail",
  "grep",
  "wc",
  "sort",
  "uniq",
  "cut",
  "tr",
  "dirname",
  "basename",
]);

interface ReadFilePayloadInput {
  path: string;
  content: string;
  offsetLine: number;
  lineLimit: number;
}

export interface ToolRegistry {
  writeFile: ReturnType<typeof buildWriteFileTool>;
  editFile: ReturnType<typeof buildEditFileTool>;
  readFile: ReturnType<typeof buildReadFileTool>;
  runShell: ReturnType<typeof buildRunShellTool>;
  runPython: ReturnType<typeof buildRunPythonTool>;
  runNode: ReturnType<typeof buildRunNodeTool>;
}

export const buildCodingTools = (
  sandbox: Sandbox,
  runtime: CodeRuntime = createHostCodeRuntime(),
): ToolRegistry => ({
  writeFile: buildWriteFileTool(sandbox),
  editFile: buildEditFileTool(sandbox),
  readFile: buildReadFileTool(sandbox),
  runShell: buildRunShellTool(sandbox, runtime),
  runPython: buildRunPythonTool(sandbox, runtime),
  runNode: buildRunNodeTool(sandbox, runtime),
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
    description:
      "Read UTF-8 file content from the sandbox. Use offset_line and line_limit to inspect source chunks; do not use run_python to print file contents.",
    schema: z.object({
      path: z.string().min(1).describe("Relative path inside the sandbox."),
      offset_line: z.number().int().positive().default(1).describe("1-based first line to read."),
      line_limit: z.number().int().positive().max(LIMITS.FILE_READ_MAX_LINES).default(LIMITS.FILE_READ_LINES)
        .describe("Maximum number of lines to return."),
    }),
    func: async ({ path, offset_line, line_limit }) => {
      const absolute = sandbox.resolveWithin(path);
      const content = await readFile(absolute, "utf8");
      return JSON.stringify(readFilePayload({ path, content, offsetLine: offset_line, lineLimit: line_limit }));
    },
  });

const buildEditFileTool = (sandbox: Sandbox) =>
  new DynamicStructuredTool({
    name: "edit_file",
    description: "Replace exact UTF-8 text in a sandbox-relative file. Fails if the old text is missing or ambiguous.",
    schema: z.object({
      path: z.string().min(1).describe("Relative path inside the sandbox."),
      old_text: z.string().min(1).describe("Exact text to replace."),
      new_text: z.string().describe("Replacement text."),
      replace_all: z.boolean().default(false).describe("Replace every occurrence instead of requiring a unique match."),
    }),
    func: async ({ path, old_text, new_text, replace_all }) => {
      const absolute = sandbox.resolveWithin(path);
      const content = await readFile(absolute, "utf8");
      const occurrences = countOccurrences(content, old_text);
      if (occurrences === 0) return JSON.stringify({ ok: false, path, error: "old_text not found" });
      if (occurrences > 1 && !replace_all) {
        return JSON.stringify({ ok: false, path, error: `old_text matched ${occurrences} times` });
      }
      const updated = replace_all ? content.split(old_text).join(new_text) : content.replace(old_text, new_text);
      await writeFile(absolute, updated, "utf8");
      return JSON.stringify({ ok: true, path, replacements: replace_all ? occurrences : 1 });
    },
  });

const buildRunShellTool = (sandbox: Sandbox, runtime: CodeRuntime) =>
  new DynamicStructuredTool({
    name: "run_shell",
    description:
      "Run an allow-listed command (e.g. ls, cat, python3, node, javac, java, gcc, g++) with arguments. No network, 20s timeout.",
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
        const result = await runtime.execute({ sandbox, command, args, stdin });
        return JSON.stringify({
          ok: result.exitCode === 0,
          exitCode: result.exitCode,
          stdout: truncate(result.stdout),
          stderr: truncate(result.stderr),
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: (err as Error).message });
      }
    },
  });

const buildRunPythonTool = (sandbox: Sandbox, runtime: CodeRuntime) =>
  new DynamicStructuredTool({
    name: "run_python",
    description:
      "Execute a python3 snippet for behavior checks inside the sandbox. Do not use for reading, printing, or editing file contents. 20s timeout.",
    schema: z.object({
      code: z.string().min(1).describe("Python code sent via stdin to python3 -I -"),
      args: z.array(z.string()).default([]),
    }),
    func: async ({ code, args }) => executeInterpreter(sandbox, runtime, "python3", ["-I", "-", ...args], code),
  });

const buildRunNodeTool = (sandbox: Sandbox, runtime: CodeRuntime) =>
  new DynamicStructuredTool({
    name: "run_node",
    description: "Execute a Node.js snippet with --input-type=module piped via stdin. 20s timeout.",
    schema: z.object({
      code: z.string().min(1),
      args: z.array(z.string()).default([]),
    }),
    func: async ({ code, args }) =>
      executeInterpreter(sandbox, runtime, "node", ["--input-type=module", ...args], code),
  });

const executeInterpreter = async (
  sandbox: Sandbox,
  runtime: CodeRuntime,
  command: string,
  args: string[],
  stdin: string,
): Promise<string> => {
  try {
    const result = await runtime.execute({ sandbox, command, args, stdin });
    return JSON.stringify({
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: (err as Error).message });
  }
};

const countOccurrences = (content: string, search: string): number => {
  let count = 0;
  let index = content.indexOf(search);
  while (index !== -1) {
    count += 1;
    index = content.indexOf(search, index + search.length);
  }
  return count;
};

const readFilePayload = (input: ReadFilePayloadInput) => {
  const lines = input.content.split(/\r?\n/);
  if (shouldReturnWholeFile(input.content, input.offsetLine, input.lineLimit, lines.length)) {
    return { ok: true, path: input.path, content: input.content };
  }
  const startLine = Math.min(input.offsetLine, Math.max(lines.length, 1));
  const startIndex = startLine - 1;
  const selected = lines.slice(startIndex, startIndex + input.lineLimit);
  const numbered = selected.map((line, index) => `${String(startLine + index).padStart(4, " ")}: ${line}`).join("\n");
  return {
    ok: true,
    path: input.path,
    content: truncate(numbered, LIMITS.FILE_READ),
    start_line: startLine,
    end_line: startLine + selected.length - 1,
    total_lines: lines.length,
    truncated: startIndex + selected.length < lines.length || numbered.length > LIMITS.FILE_READ,
  };
};

const shouldReturnWholeFile = (
  content: string,
  offsetLine: number,
  lineLimit: number,
  totalLines: number,
): boolean => (
  offsetLine === 1 && totalLines <= lineLimit && content.length <= LIMITS.FILE_READ
);
