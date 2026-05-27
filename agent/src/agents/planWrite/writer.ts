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
Read /workspace/context.json first. It already contains assignment text, template text, plan, coding outputs, stdout, stderr, and artifact metadata.
Do not read .docx files with read_file; DOCX files are ZIP packages. Inspect them by unpacking with zip tooling and reading the extracted XML.
Do not look for source-code files in /workspace unless ls shows they exist; use results[].code and results[].artifacts from context.json instead.
When a DOCX template was uploaded, strictly preserve the uploaded Word package and template structure; unpack, edit XML content in place, repack, and validate instead of rebuilding with pandoc.
When no DOCX template was uploaded, edit the provided starter DOCX into a complete standalone report.
If any task result is partial or failed, state the limitation explicitly in the report instead of claiming completion.
For shell commands, use relative paths such as workspace/template.docx and skills/docx/scripts/office/unpack.py.
Run validation commands directly. Do not use shell fallbacks such as "|| echo", "|| true", or commands that turn validation failures into success.
Do not discover or construct host temp-directory paths; use /workspace, /skills, or the relative paths above.
Python scripts executed in the writer workspace may use /workspace and /skills paths directly.
Never recursively scan from the filesystem root, such as glob('/**'), Path('/').rglob(), os.walk('/'), or find /.
Write the finished document to /workspace/final.docx.
After /workspace/final.docx exists and a structural/content validation command succeeds, stop using tools and return the final JSON immediately.
Return raw JSON only: {"title":"...","markdown_preview":"...","docx_path":"/workspace/final.docx"}.`;

export interface WriteReportRequest {
  llm: DeepAgentRuntimeModel;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  plan: TaskPlan;
  results: TaskResult[];
  requestId: string;
  supplementalInstructions: string;
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
      { ...request.runnableConfig, recursionLimit: LIMITS.WRITER_AGENT_RECURSION_LIMIT },
    );
    const parsed = parseWriterResult(extractFinalMessageText(toAgentInvocation(invocation)));
    return {
      title: parsed.title ?? request.plan.title,
      markdownPreview: parsed.markdown_preview,
      docxBytes: await workspace.downloadDocx(parsed.docx_path),
      templateStrategy: workspace.templateUploaded ? "deep-agent-docx-template" : "deep-agent-docx-generated",
    };
  } catch (err) {
    if (err instanceof AgentError) throw err;
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
  "Use the docx skill instructions and scripts. Return the final JSON immediately after the DOCX exists and validation passes."
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
