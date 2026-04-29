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
