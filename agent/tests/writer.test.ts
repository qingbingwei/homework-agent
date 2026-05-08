import { describe, expect, it } from "vitest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import JSZip from "jszip";
import { writeReport } from "../src/agents/planWrite/writer.js";
import type { DeepAgentRuntimeModel } from "../src/agents/deepAgent.js";
import type { TaskPlan, TaskResult } from "../src/agents/schema.js";
import type { ParsedDocument } from "../src/parsing/index.js";

describe("writeReport", () => {
  it("downloads the docx path returned by the writer agent", async () => {
    const template = await docxTemplate("Template body");
    const writer = await writeReport(writeRequest({
      template,
      responses: [JSON.stringify({ markdown_preview: "Preview", docx_path: "/workspace/template.docx" })],
    }));

    expect(writer.title).toBe("Fallback Title");
    expect(writer.markdownPreview).toBe("Preview");
    expect(writer.templateStrategy).toBe("deep-agent-docx-template");
    expect(writer.docxBytes.equals(template.rawBytes)).toBe(true);
  });

  it("uses the JSON title when present", async () => {
    const writer = await writeReport(writeRequest({
      template: await docxTemplate("Template body"),
      responses: [JSON.stringify({
        title: "Generated Title",
        markdown_preview: "Body",
        docx_path: "/workspace/template.docx",
      })],
    }));

    expect(writer.title).toBe("Generated Title");
    expect(writer.markdownPreview).toBe("Body");
  });

  it("wraps writer failures with a staged AgentError", async () => {
    await expect(writeReport(writeRequest({ llm: new FailingBindToolsModel() })))
      .rejects.toMatchObject({ code: "writer_failed", stage: "write" });
  });
});

class FailingBindToolsModel extends FakeListChatModel {
  constructor() {
    super({ responses: ["unused"] });
  }

  override bindTools(): never {
    throw new Error("bindTools failed");
  }
}

const fakeDeepAgentModel = (responses: string[]): DeepAgentRuntimeModel => {
  const model = new FakeListChatModel({ responses });
  return Object.assign(model, { bindTools: () => model });
};

const writeRequest = (overrides: {
  llm?: DeepAgentRuntimeModel;
  template?: ParsedDocument | null;
  responses?: string[];
} = {}) => ({
  llm: overrides.llm ?? fakeDeepAgentModel(overrides.responses ?? [JSON.stringify({ docx_path: "/workspace/template.docx" })]),
  assignment,
  template: overrides.template ?? null,
  plan,
  results,
  requestId: "writer-test",
  runnableConfig: {},
});

const docxTemplate = async (text: string): Promise<ParsedDocument> => {
  const rawBytes = await buildDocx(text);
  return { filename: "template.docx", kind: ".docx", text, rawBytes };
};

const buildDocx = async (text: string): Promise<Buffer> => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.file("_rels/.rels", packageRelationshipsXml());
  zip.file("word/document.xml", documentXml(text));
  return await zip.generateAsync({ type: "nodebuffer" });
};

const assignment: ParsedDocument = {
  filename: "assignment.md",
  kind: ".md",
  text: "Write a report.",
  rawBytes: Buffer.from("Write a report."),
};

const plan: TaskPlan = {
  title: "Fallback Title",
  summary: "Write report",
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

const contentTypesXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>"
);

const packageRelationshipsXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>"
);

const documentXml = (text: string): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>` +
  "</w:body></w:document>"
);
