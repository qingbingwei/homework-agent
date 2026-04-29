import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import type { ChatOpenAI } from "@langchain/openai";
import type { ParsedDocument } from "../../parsing/index.js";
import type { TaskPlan, TaskResult } from "../schema.js";
import type { WriterOutput } from "../state.js";

const writerPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are the writing arm of the plan-write controller. Produce the final lab report as Markdown that matches the provided template structure. Keep code blocks intact, explain results, and never wrap the whole response in code fences.",
  ],
  [
    "human",
    `Plan summary: {plan_summary}\n\nAssignment ({assignment_kind}):\n---\n{assignment_text}\n---\n\nTemplate ({template_kind}):\n---\n{template_text}\n---\n\nCompleted tasks JSON:\n{task_results}\n\nReturn the final Markdown report. Start with a top-level \"#\" title that can be used as REPORT_TITLE.`,
  ],
]);

export const writeReport = async (
  llm: ChatOpenAI,
  assignment: ParsedDocument,
  template: ParsedDocument,
  plan: TaskPlan,
  results: TaskResult[],
  runnableConfig: Record<string, unknown>,
): Promise<WriterOutput> => {
  const chain = writerPrompt.pipe(llm).pipe(new StringOutputParser());
  const markdown = await chain.invoke(
    {
      plan_summary: plan.summary,
      assignment_kind: assignment.kind,
      assignment_text: assignment.text,
      template_kind: template.kind,
      template_text: template.text,
      task_results: JSON.stringify(results, null, 2),
    },
    runnableConfig,
  );
  const clean = markdown.trim();
  const titleMatch = clean.match(/^#\s+(.+)$/m);
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : plan.title;
  return { title, markdown: clean };
};
