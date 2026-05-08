import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { runReportService, type ReportServiceDeps } from "../src/reporting/service.js";
import type { AppConfig } from "../src/config.js";

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
      planLlm: {
        baseUrl: "https://example.invalid/v1",
        apiKey: "sk-test",
        model: "deepseek-v4-pro",
        reasoningEffort: "high",
        thinkingType: "enabled",
      },
      codingLlm: {
        kind: "gpt",
        provider: "OpenAI",
        baseUrl: "https://example.invalid/v1",
        apiKey: "sk-test",
        model: "gpt-5.5",
        reviewModel: "gpt-5.5",
        reasoningEffort: "xhigh",
        thinkingType: "enabled",
        disableResponseStorage: true,
        networkAccess: "enabled",
        windowsWslSetupAcknowledged: true,
        contextWindow: 400000,
        autoCompactTokenLimit: 360000,
        wireApi: "responses",
        requiresOpenAIAuth: true,
      },
      codingDeepseekLlm: {
        kind: "deepseek",
        baseUrl: "https://example.invalid/v1",
        apiKey: "sk-test",
        model: "deepseek-v4-pro",
        reasoningEffort: "max",
        thinkingType: "enabled",
      },
      langsmith: { enabled: false, apiKey: "", project: "test", endpoint: "" },
    };

    const templateMarkdown = Buffer.from("# {{REPORT_TITLE}}\n\n{{REPORT_BODY}}", "utf8");
    const assignmentDocx = await buildDocx(["What is 2 + 3?"]);
    const finalDocx = await buildDocx(["The sum equals 5."]);

    const deps: Partial<ReportServiceDeps> = {
      runGraph: async (_deps, input) => ({
        ...input,
        plan: {
          title: "Demo Lab Report",
          summary: "Single-task demo plan for testing",
          tasks: [
            {
              id: "task-1",
              title: "Compute 2 + 3",
              description: "Return the integer result.",
              requires_code: false,
              acceptance: "final JSON reports status completed",
            },
          ],
        },
        results: [
          {
            task_id: "task-1",
            status: "completed",
            explanation: "2+3 equals 5",
            code: "",
            stdout: "5",
            stderr: "",
            artifacts: [],
          },
        ],
        writer: {
          title: "Demo Lab Report",
          markdownPreview: "# Demo Lab Report\n\nThe sum equals 5.",
          docxBytes: finalDocx,
          templateStrategy: "deep-agent-docx-generated",
        },
      }),
    };

    const response = await runReportService(
      config,
      {
        assignment: { filename: "homework.docx", data: assignmentDocx },
        template: { filename: "template.md", data: templateMarkdown },
        requestId: "req-test",
        codingModelProfile: "deepseek",
        codingReasoningEffort: "high",
        codingThinkingType: "disabled",
      },
      deps,
    );

    expect(response.model).toBe("deepseek-v4-pro");
    expect(response.coding_model_profile).toBe("deepseek");
    expect(response.coding_model).toBe("deepseek-v4-pro");
    expect(response.coding_reasoning_effort).toBe("high");
    expect(response.coding_thinking_type).toBe("disabled");
    expect(response.template_strategy).toBe("deep-agent-docx-generated");
    expect(response.markdown_content).toContain("Demo Lab Report");
    expect(response.file_name).toBe("homework-report.docx");
    expect(response.docx_base64.length).toBeGreaterThan(100);
  });
});
