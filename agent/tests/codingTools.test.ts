import { describe, expect, it } from "vitest";
import { createSandbox } from "../src/agents/codingAgent/sandbox.js";
import { buildCodingTools } from "../src/agents/codingAgent/tools.js";

describe("coding-agent sandbox", () => {
  it("rejects paths that escape the sandbox root", async () => {
    const sandbox = await createSandbox("req", "task");
    try {
      expect(() => sandbox.resolveWithin("../evil")).toThrowError(/escape/);
    } finally {
      await sandbox.dispose();
    }
  });

  it("write -> read round-trips through DynamicStructuredTool", async () => {
    const sandbox = await createSandbox("req", "task-rw");
    const tools = buildCodingTools(sandbox);
    try {
      const write = await tools.writeFile.invoke({ path: "answer.txt", content: "42" });
      expect(JSON.parse(write)).toMatchObject({ ok: true, path: "answer.txt" });
      const read = await tools.readFile.invoke({ path: "answer.txt" });
      expect(JSON.parse(read)).toMatchObject({ ok: true, content: "42" });
    } finally {
      await sandbox.dispose();
    }
  });

  it("edits files with explicit exact-match semantics", async () => {
    const sandbox = await createSandbox("req", "task-edit");
    const tools = buildCodingTools(sandbox);
    try {
      await tools.writeFile.invoke({ path: "answer.txt", content: "alpha beta alpha" });
      const ambiguous = await tools.editFile.invoke({
        path: "answer.txt",
        old_text: "alpha",
        new_text: "gamma",
      });
      expect(JSON.parse(ambiguous)).toMatchObject({ ok: false });

      const edited = await tools.editFile.invoke({
        path: "answer.txt",
        old_text: "alpha",
        new_text: "gamma",
        replace_all: true,
      });
      expect(JSON.parse(edited)).toMatchObject({ ok: true, replacements: 2 });
      const read = await tools.readFile.invoke({ path: "answer.txt" });
      expect(JSON.parse(read)).toMatchObject({ content: "gamma beta gamma" });
    } finally {
      await sandbox.dispose();
    }
  });

  it("reads line windows without using interpreter snippets for file inspection", async () => {
    const sandbox = await createSandbox("req", "task-read-window");
    const tools = buildCodingTools(sandbox);
    try {
      await tools.writeFile.invoke({
        path: "source.py",
        content: ["line 1", "line 2", "line 3", "line 4"].join("\n"),
      });
      const read = await tools.readFile.invoke({ path: "source.py", offset_line: 2, line_limit: 2 });
      const payload = JSON.parse(read);

      expect(payload).toMatchObject({
        ok: true,
        path: "source.py",
        start_line: 2,
        end_line: 3,
        total_lines: 4,
        truncated: true,
      });
      expect(payload.content).toContain("   2: line 2");
      expect(payload.content).toContain("   3: line 3");
    } finally {
      await sandbox.dispose();
    }
  });

  it("runs allow-listed shell commands and blocks the rest", async () => {
    const sandbox = await createSandbox("req", "task-shell");
    const tools = buildCodingTools(sandbox);
    try {
      const ok = await tools.runShell.invoke({ command: "printf", args: ["hello"] });
      const okPayload = JSON.parse(ok);
      expect(okPayload.ok).toBe(true);
      expect(okPayload.stdout).toBe("hello");

      const denied = await tools.runShell.invoke({ command: "rm", args: ["-rf", "/"] });
      expect(JSON.parse(denied)).toMatchObject({ ok: false });
    } finally {
      await sandbox.dispose();
    }
  });

  it("executes python snippets via run_python", async () => {
    const sandbox = await createSandbox("req", "task-py");
    const tools = buildCodingTools(sandbox);
    try {
      const result = await tools.runPython.invoke({ code: "print(2 + 3)" });
      const payload = JSON.parse(result);
      expect(payload.ok).toBe(true);
      expect(payload.stdout.trim()).toBe("5");
    } finally {
      await sandbox.dispose();
    }
  });
});
