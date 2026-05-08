import { basename, extname } from "node:path";
import {
  selectCodingLlmConfig,
  type AppConfig,
  type CodingModelProfile,
  type DeepseekReasoningEffort,
  type DeepseekThinkingType,
} from "../config.js";
import { createChatModel } from "../llm/chat.js";
import { runGraph } from "../agents/graph.js";
import { parseUpload } from "../parsing/index.js";
import { AgentError } from "../http/errors.js";

export interface ReportInput {
  assignment: { filename: string; data: Buffer };
  template?: { filename: string; data: Buffer } | null;
  requestId: string;
  codingModelProfile: CodingModelProfile;
  codingReasoningEffort?: DeepseekReasoningEffort;
  codingThinkingType?: DeepseekThinkingType;
}

export interface ReportResponse {
  file_name: string;
  markdown_content: string;
  docx_base64: string;
  template_strategy: string;
  model: string;
  coding_model_profile: CodingModelProfile;
  coding_model: string;
  coding_reasoning_effort: string;
  coding_thinking_type: string;
}

export interface ReportServiceDeps {
  parseUpload: typeof parseUpload;
  createChatModel: typeof createChatModel;
  runGraph: typeof runGraph;
}

const defaultDeps: ReportServiceDeps = {
  parseUpload,
  createChatModel,
  runGraph,
};

const stripExt = (filename: string): string => {
  const base = basename(filename);
  const ext = extname(base);
  return ext ? base.slice(0, -ext.length) : base;
};

export const runReportService = async (
  config: AppConfig,
  input: ReportInput,
  deps: Partial<ReportServiceDeps> = {},
): Promise<ReportResponse> => {
  const providers = { ...defaultDeps, ...deps };
  const assignment = await providers.parseUpload(input.assignment.filename, input.assignment.data);
  const template = input.template ? await providers.parseUpload(input.template.filename, input.template.data) : null;
  const codingConfig = selectCodingLlmConfig(
    config,
    input.codingModelProfile,
    input.codingReasoningEffort,
    input.codingThinkingType,
  );

  const planWriteModel = providers.createChatModel(config, "plan", { tags: ["plan-write"], temperature: 0.2 });
  const codingModel = providers.createChatModel(config, "coding", {
    tags: ["coding-agent", `coding-profile:${input.codingModelProfile}`],
    temperature: 0.1,
    codingLlm: codingConfig,
  });

  const finalState = await providers.runGraph(
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

  const stem = stripExt(assignment.filename) || "report";
  return {
    file_name: `${stem}-report.docx`,
    markdown_content: finalState.writer.markdownPreview,
    docx_base64: finalState.writer.docxBytes.toString("base64"),
    template_strategy: finalState.writer.templateStrategy,
    model: config.planLlm.model,
    coding_model_profile: input.codingModelProfile,
    coding_model: codingConfig.model,
    coding_reasoning_effort: codingConfig.reasoningEffort,
    coding_thinking_type: codingConfig.thinkingType,
  };
};
