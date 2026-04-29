import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import type { ChatOpenAI } from "@langchain/openai";
import { TaskPlanSchema, type TaskPlan } from "../schema.js";
import type { ParsedDocument } from "../../parsing/index.js";

const planParser = StructuredOutputParser.fromZodSchema(
  z.object({
    title: TaskPlanSchema.shape.title,
    summary: TaskPlanSchema.shape.summary,
    tasks: TaskPlanSchema.shape.tasks,
  }),
);

const planPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are the plan-write controller of a lab-report agent. Decompose the assignment into ordered sub-tasks that the coding-agent can execute. Each task must state an unambiguous acceptance criterion. Return ONLY the JSON described below.\n{format_instructions}",
  ],
  [
    "human",
    `Assignment ({assignment_kind}):\n---\n{assignment_text}\n---\n\nTemplate ({template_kind}):\n---\n{template_text}\n---\n\nOutput JSON only.`,
  ],
]);

export const planAssignment = async (
  llm: ChatOpenAI,
  assignment: ParsedDocument,
  template: ParsedDocument,
  runnableConfig: Record<string, unknown>,
): Promise<TaskPlan> => {
  const chain = planPrompt.pipe(llm).pipe(planParser);
  const response = await chain.invoke(
    {
      assignment_kind: assignment.kind,
      assignment_text: assignment.text,
      template_kind: template.kind,
      template_text: template.text,
      format_instructions: planParser.getFormatInstructions(),
    },
    runnableConfig,
  );
  return TaskPlanSchema.parse(response);
};
