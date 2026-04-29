import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { runReportService } from "../src/reporting/service.js";
import type { AppConfig } from "../src/config.js";

vi.mock("../src/llm/chat.js", async () => {
  const planJson = JSON.stringify({
    title: "Demo Lab Report",
    summary: "Single-task demo plan for testing",
    tasks: [
      {
        id: "task-1",
        title: "Compute 2 + 3",
        description: "Return the integer result.",
        requires_code: false,
        language: "none",
        acceptance: "final JSON reports status completed",
      },
    ],
  });
  const codingJson = JSON.stringify({
    task_id: "task-1",
    status: "completed",
    explanation: "2+3 equals 5",
    code: "",
    language: "none",
    stdout: "5",
    stderr: "",
    artifacts: [],
  });
  const reportMarkdown = "# Demo Lab Report\n\nThe sum equals 5.";

  const responses = [
    `\`\`\`json\n${planJson}\n\`\`\``,
    codingJson,
    codingJson,
    reportMarkdown,
    reportMarkdown,
  ];

  return {
    createChatModel: () => new FakeListChatModel({ responses }),
  };
});

const buildDocx = async (paragraphs: string[]): Promise<Buffer> => {
  const zip = new JSZip();
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space=\"preserve\">${text}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>${body}</w:body></w:document>`,
  );
  return await zip.generateAsync({ type: "nodebuffer" });
};

describe("runReportService (graph smoke)", () => {
  it("produces a ReportResponse for a trivial assignment", async () => {
    const config: AppConfig = {
      host: "127.0.0.1",
      port: 0,
      llmBaseUrl: "https://example.invalid/v1",
      llmApiKey: "sk-test",
      llmModel: "gpt-5.5",
      langsmith: { enabled: false, apiKey: "", project: "test", endpoint: "" },
    };

    const templateMarkdown = Buffer.from("# {{REPORT_TITLE}}\n\n{{REPORT_BODY}}", "utf8");
    const assignmentDocx = await buildDocx(["What is 2 + 3?"]);

    const response = await runReportService(config, {
      assignment: { filename: "homework.docx", data: assignmentDocx },
      template: { filename: "template.md", data: templateMarkdown },
      requestId: "req-test",
    });

    expect(response.model).toBe("gpt-5.5");
    expect(response.template_strategy).toBe("pandoc-generated");
    expect(response.markdown_content).toContain("Demo Lab Report");
    expect(response.file_name).toBe("homework-report.docx");
    expect(response.docx_base64.length).toBeGreaterThan(100);
  });
});
