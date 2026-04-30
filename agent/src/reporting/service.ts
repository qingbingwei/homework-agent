import { basename, extname } from "node:path";
import { selectCodingLlmConfig, type AppConfig, type CodingModelProfile } from "../config.js";
import { createChatModel } from "../llm/chat.js";
import { runGraph } from "../agents/graph.js";
import { parseUpload } from "../parsing/index.js";
import { buildReportBundle } from "../templates/index.js";
import { AgentError } from "../http/errors.js";

export interface ReportInput {
  assignment: { filename: string; data: Buffer };
  template: { filename: string; data: Buffer };
  requestId: string;
  codingModelProfile: CodingModelProfile;
}

export interface ReportResponse {
  file_name: string;
  markdown_content: string;
  docx_base64: string;
  template_strategy: string;
  model: string;
  coding_model_profile: CodingModelProfile;
  coding_model: string;
}

const stripExt = (filename: string): string => {
  const base = basename(filename);
  const ext = extname(base);
  return ext ? base.slice(0, -ext.length) : base;
};

export const runReportService = async (
  config: AppConfig,
  input: ReportInput,
): Promise<ReportResponse> => {
  const assignment = await parseUpload(input.assignment.filename, input.assignment.data);
  const template = await parseUpload(input.template.filename, input.template.data);
  const codingConfig = selectCodingLlmConfig(config, input.codingModelProfile);

  const planWriteModel = createChatModel(config, "plan", { tags: ["plan-write"], temperature: 0.2 });
  const codingModel = createChatModel(config, "coding", {
    tags: ["coding-agent", `coding-profile:${input.codingModelProfile}`],
    temperature: 0.1,
    codingLlm: codingConfig,
  });

  const finalState = await runGraph(
    { config, planWriteModel, codingModel },
    {
      requestId: input.requestId,
      modelLabel: `${config.planLlm.model} -> ${codingConfig.model}`,
      assignment,
      template,
    },
  );

  if (!finalState.plan || !finalState.writer) {
    throw new AgentError({
      code: "graph_incomplete",
      message: "plan-write graph did not produce a report",
      stage: "generate_report",
    });
  }

  const rendered = await buildReportBundle(template, finalState.writer.markdown, finalState.writer.title);

  const stem = stripExt(assignment.filename) || "report";
  return {
    file_name: `${stem}-report.docx`,
    markdown_content: rendered.markdownContent,
    docx_base64: rendered.docxBytes.toString("base64"),
    template_strategy: rendered.templateStrategy,
    model: config.planLlm.model,
    coding_model_profile: input.codingModelProfile,
    coding_model: codingConfig.model,
  };
};
