import type { RunnableConfig } from "@langchain/core/runnables";
import { createDeepAgent } from "deepagents";
import { z } from "zod";
import type { ParsedDocument } from "../../parsing/index.js";
import type { TaskPlan, TaskResult, WriterOutput } from "../schema.js";
import { asDeepAgentModel, type DeepAgentRuntimeModel } from "../deepAgent.js";
import { extractFinalMessageText, extractJsonObject, toAgentInvocation } from "../output.js";
import { AgentError } from "../../http/errors.js";
import { LIMITS } from "../../constants.js";
import {
  FINAL_DOCX_PATH,
  TEMPLATE_DOCX_PATH,
  type DocxWriterWorkspace,
  createDocxWriterWorkspace,
} from "./docxWorkspace.js";

const DOCX_SKILL_SOURCE = "/skills/";
const SYSTEM_PROMPT = `You are the writing arm of the plan-write controller.
Use the docx skill to create the final Word document directly.
The working DOCX file is at /workspace/template.docx and all task context is in /workspace/context.json.
When a DOCX template was uploaded, strictly preserve the uploaded Word package and template structure; unpack, edit XML content in place, repack, and validate instead of rebuilding with pandoc.
When no DOCX template was uploaded, edit the provided starter DOCX into a complete standalone report.
For shell commands, use relative paths such as workspace/template.docx and skills/docx/scripts/office/unpack.py.
Write the finished document to /workspace/final.docx.
Return raw JSON only: {"title":"...","markdown_preview":"...","docx_path":"/workspace/final.docx"}.`;

export interface WriteReportRequest {
  llm: DeepAgentRuntimeModel;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  plan: TaskPlan;
  results: TaskResult[];
  requestId: string;
  runnableConfig: RunnableConfig;
}

const WriterAgentResultSchema = z.object({
  title: z.string().min(1).optional(),
  markdown_preview: z.string().default(""),
  docx_path: z.string().min(1).default(FINAL_DOCX_PATH),
});

export const writeReport = async (
  request: WriteReportRequest,
): Promise<WriterOutput> => {
  let workspace: DocxWriterWorkspace | null = null;
  try {
    workspace = await createDocxWriterWorkspace(request);
    const agent = createDeepAgent({
      model: asDeepAgentModel(request.llm),
      name: "plan-write-writer",
      systemPrompt: SYSTEM_PROMPT,
      skills: [DOCX_SKILL_SOURCE],
      backend: workspace.backend,
    });
    const invocation = await agent.invoke(
      { messages: [{ role: "user", content: buildWriterMessage(workspace.templateUploaded) }] },
      { ...request.runnableConfig, recursionLimit: 80 },
    );
    const parsed = parseWriterResult(extractFinalMessageText(toAgentInvocation(invocation)));
    return {
      title: parsed.title ?? request.plan.title,
      markdownPreview: parsed.markdown_preview,
      docxBytes: await workspace.downloadDocx(parsed.docx_path),
      templateStrategy: workspace.templateUploaded ? "deep-agent-docx-template" : "deep-agent-docx-generated",
    };
  } catch (err) {
    throw new AgentError({
      code: "writer_failed",
      message: `report writing failed: ${(err as Error).message}`,
      stage: "write",
      cause: err,
    });
  } finally {
    if (workspace) await workspace.dispose();
  }
};

const buildWriterMessage = (templateUploaded: boolean): string => (
  `Read /workspace/context.json and produce the final DOCX at ${FINAL_DOCX_PATH}.\n` +
  `Template path: ${TEMPLATE_DOCX_PATH}. Uploaded DOCX template: ${templateUploaded ? "yes" : "no"}.\n` +
  "Use the docx skill instructions and scripts. Return the final JSON only after the DOCX exists."
);

const parseWriterResult = (raw: string): z.infer<typeof WriterAgentResultSchema> => {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw writerOutputError("writer did not return JSON", raw);
  try {
    return WriterAgentResultSchema.parse(JSON.parse(jsonText));
  } catch (err) {
    throw writerOutputError(`writer returned invalid JSON: ${(err as Error).message}`, raw, err);
  }
};

const writerOutputError = (message: string, raw: string, cause?: unknown): AgentError => new AgentError({
  code: "writer_invalid_output",
  message: `${message}; raw=${raw.slice(0, LIMITS.RESULT_SUMMARY)}`,
  stage: "write",
  cause,
});
