import { describe, expect, it } from "vitest";

const LIVE_TEST_ENABLED = process.env.AGENT_LIVE_TEST === "1";
const BASE_URL = process.env.AGENT_LIVE_BASE_URL ?? "http://127.0.0.1:19000";
const CODING_MODEL_PROFILE = process.env.AGENT_LIVE_CODING_MODEL_PROFILE ?? "deepseek";
const REQUEST_TIMEOUT_MINUTES = 30;
const MS_PER_MINUTE = 60_000;
const REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MINUTES * MS_PER_MINUTE;

interface ReportResponse {
  file_name: string;
  markdown_content: string;
  docx_base64: string;
  template_strategy: string;
  model: string;
  coding_model_profile: string;
  coding_model: string;
}

const markdownFile = (content: string): Blob => new Blob([content], { type: "text/markdown;charset=utf-8" });

const buildFormData = (): FormData => {
  const form = new FormData();
  form.append("assignment", markdownFile("# 简单问题\n\n你好，请用一句话回复。"), "assignment.md");
  form.append("template", markdownFile("# {{REPORT_TITLE}}\n\n{{REPORT_BODY}}\n"), "template.md");
  form.append("coding_model_profile", CODING_MODEL_PROFILE);
  return form;
};

const readErrorBody = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return JSON.stringify(await response.json());
  }
  return await response.text();
};

const postReport = async (): Promise<ReportResponse> => {
  const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/generate-report`, {
    method: "POST",
    body: buildFormData(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`agent returned ${response.status} ${response.statusText}: ${body}`);
  }
  return (await response.json()) as ReportResponse;
};

describe.skipIf(!LIVE_TEST_ENABLED)("live agent /generate-report", () => {
  it("responds to a minimal Chinese greeting assignment", async () => {
    const payload = await postReport();

    expect(payload.file_name).toMatch(/assignment-report\.docx$/);
    expect(payload.markdown_content).toContain("#");
    expect(payload.markdown_content.length).toBeGreaterThan(0);
    expect(payload.docx_base64.length).toBeGreaterThan(0);
    expect(payload.model.length).toBeGreaterThan(0);
    expect(payload.coding_model_profile).toBe(CODING_MODEL_PROFILE);
    expect(payload.coding_model.length).toBeGreaterThan(0);
  }, REQUEST_TIMEOUT_MS);
});
