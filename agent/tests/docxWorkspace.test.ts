import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDocxWriterWorkspace,
  normalizeVirtualPathOutput,
  rewriteVirtualPaths,
  rootRecursiveScanError,
} from "../src/agents/planWrite/docxWorkspace.js";
import type { ParsedDocument } from "../src/parsing/index.js";
import type { TaskPlan, TaskResult } from "../src/agents/schema.js";

describe("rewriteVirtualPaths", () => {
  it("keeps quoted virtual paths valid inside Python strings", () => {
    const command = "python3 -c \"open('/workspace/unpacked/word/document.xml').read()\"";
    const rewritten = rewriteVirtualPaths("/tmp/writer-root", command);

    expect(rewritten).toBe("python3 -c \"open('/tmp/writer-root/workspace/unpacked/word/document.xml').read()\"");
  });

  it("shell-quotes bare virtual paths", () => {
    const command = "python3 /skills/docx/scripts/office/pack.py /workspace/unpacked /workspace/final.docx";
    const rewritten = rewriteVirtualPaths("/tmp/writer-root", command);

    expect(rewritten).toBe(
      "python3 '/tmp/writer-root/skills'/docx/scripts/office/pack.py " +
      "'/tmp/writer-root/workspace'/unpacked '/tmp/writer-root/workspace'/final.docx",
    );
  });
});

describe("normalizeVirtualPathOutput", () => {
  it("maps real workspace paths back to virtual paths before the model sees output", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "writer-root-"));
    const output = `cwd: ${rootDir}\nXML path: ${rootDir}/workspace/unpacked/word/document.xml`;

    try {
      expect(normalizeVirtualPathOutput(rootDir, output))
        .toBe("cwd: /workspace-root\nXML path: /workspace/unpacked/word/document.xml");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("createDocxWriterWorkspace", () => {
  it("supports virtual /workspace paths inside executed Python files", async () => {
    const workspace = await createDocxWriterWorkspace({
      requestId: "python-virtual-path-test",
      assignment,
      template: null,
      plan,
      results,
      supplementalInstructions: "",
    });
    try {
      await workspace.backend.write(
        "/workspace/check_virtual.py",
        "from pathlib import Path\n" +
        "print(Path('/workspace/context.json').exists())\n" +
        "print(open('/workspace/context.json', 'r').read().lstrip().startswith('{'))\n",
      );
      const result = await workspace.backend.execute!("python3 /workspace/check_virtual.py");

      expect(result.output).toContain("True\nTrue");
      expect(result.exitCode).toBe(0);
    } finally {
      await workspace.dispose();
    }
  });
});

const assignment: ParsedDocument = {
  filename: "assignment.md",
  kind: ".md",
  text: "Write a report.",
  rawBytes: Buffer.from("Write a report."),
};

const plan: TaskPlan = {
  title: "Report",
  summary: "Write a report",
  tasks: [
    {
      id: "task-1",
      title: "Explain",
      description: "Explain the result.",
      requires_code: false,
      acceptance: "Report is clear.",
    },
  ],
};

const results: TaskResult[] = [
  {
    task_id: "task-1",
    status: "completed",
    explanation: "No coding required.",
    code: "",
    stdout: "",
    stderr: "",
    artifacts: [],
  },
];

describe("rootRecursiveScanError", () => {
  it("rejects root-wide recursive Python glob scans explicitly", () => {
    const command = "python3 -c \"import glob; glob.glob('/**/unpacked/word/document.xml', recursive=True)\"";

    expect(rootRecursiveScanError(command)).toContain("Refusing root-wide recursive filesystem scan");
  });

  it("allows workspace-scoped recursive scans", () => {
    const command = "python3 -c \"import glob; glob.glob('/workspace/**/document.xml', recursive=True)\"";

    expect(rootRecursiveScanError(command)).toBeNull();
  });
});
