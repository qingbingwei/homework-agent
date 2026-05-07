import type { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import type { ParsedDocument } from "../../parsing/index.js";
import type { TaskPlan, TaskResult } from "../schema.js";
import type { WriterOutput } from "../state.js";
import { asDeepAgentModel, extractFinalMessageText } from "../deepAgent.js";
import { buildDocxSkillFiles } from "../skills.js";

const DOCX_SKILL_SOURCE = "/skills/";
const SYSTEM_PROMPT = `You are the writing arm of the plan-write controller.
Produce the final lab report as Markdown that matches the provided template structure.
The Markdown will be rendered into a Word .docx deliverable, so use the docx skill when document structure, headings, tables, lists, or Word-specific formatting matters.
Keep code blocks intact, explain results, and never wrap the whole response in code fences.
Do not create files; return the final Markdown report as the final answer.`;

export const writeReport = async (
  llm: ChatOpenAI,
  assignment: ParsedDocument,
  template: ParsedDocument,
  plan: TaskPlan,
  results: TaskResult[],
  runnableConfig: Record<string, unknown>,
): Promise<WriterOutput> => {
  const agent = createDeepAgent({
    model: asDeepAgentModel(llm),
    name: "plan-write-writer",
    systemPrompt: SYSTEM_PROMPT,
    skills: [DOCX_SKILL_SOURCE],
  });
  const invocation = await agent.invoke(
    {
      files: await buildDocxSkillFiles(),
      messages: [{ role: "user", content: buildWriterMessage(assignment, template, plan, results) }],
    } as never,
    { ...runnableConfig, recursionLimit: 30 } as never,
  );
  const clean = extractFinalMessageText(invocation).trim();
  const titleMatch = clean.match(/^#\s+(.+)$/m);
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : plan.title;
  return { title, markdown: clean };
};

const buildWriterMessage = (
  assignment: ParsedDocument,
  template: ParsedDocument,
  plan: TaskPlan,
  results: TaskResult[],
): string => (
  `Plan summary: ${plan.summary}\n\nAssignment (${assignment.kind}):\n---\n${assignment.text}\n---\n\n` +
  `Template (${template.kind}):\n---\n${template.text}\n---\n\n` +
  `Completed tasks JSON:\n${JSON.stringify(results, null, 2)}\n\n` +
  'Return the final Markdown report. Start with a top-level "#" title that can be used as REPORT_TITLE.'
);
