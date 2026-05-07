import type { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { TaskPlanSchema, type TaskPlan } from "../schema.js";
import type { ParsedDocument } from "../../parsing/index.js";
import { asDeepAgentModel, extractFinalMessageText, extractJsonObject } from "../deepAgent.js";

const SYSTEM_PROMPT = `You are the planning arm of a lab-report agent.
Decompose the assignment into ordered sub-tasks that the coding Deep Agent can execute.
Each task must state an unambiguous acceptance criterion.
Return ONLY a JSON object with this shape:
{"title":"...","summary":"...","tasks":[{"id":"...","title":"...","description":"...","requires_code":true,"language":"python|node|none","acceptance":"..."}]}.`;

export const planAssignment = async (
  llm: ChatOpenAI,
  assignment: ParsedDocument,
  template: ParsedDocument,
  runnableConfig: Record<string, unknown>,
): Promise<TaskPlan> => {
  const agent = createDeepAgent({
    model: asDeepAgentModel(llm),
    name: "plan-write-planner",
    systemPrompt: SYSTEM_PROMPT,
  });
  const invocation = await agent.invoke(
    { messages: [{ role: "user", content: buildPlanningMessage(assignment, template) }] } as never,
    { ...runnableConfig, recursionLimit: 20 } as never,
  );
  const jsonText = extractJsonObject(extractFinalMessageText(invocation));
  if (!jsonText) throw new Error("plan-write planner did not return JSON");
  return TaskPlanSchema.parse(JSON.parse(jsonText));
};

const buildPlanningMessage = (assignment: ParsedDocument, template: ParsedDocument): string => (
  `Assignment (${assignment.kind}):\n---\n${assignment.text}\n---\n\n` +
  `Template (${template.kind}):\n---\n${template.text}\n---\n\nOutput JSON only.`
);
