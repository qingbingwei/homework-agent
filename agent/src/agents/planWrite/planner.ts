import type { RunnableConfig } from "@langchain/core/runnables";
import { TaskPlanSchema, type TaskPlan } from "../schema.js";
import type { ParsedDocument } from "../../parsing/index.js";
import type { DeepAgentRuntimeModel } from "../deepAgent.js";
import {
  extractFinalMessageText,
  extractJsonObject,
  toAgentInvocation,
  type AgentInvocation,
} from "../output.js";
import { AgentError } from "../../http/errors.js";
import { templateSummary } from "../promptUtils.js";
import { LIMITS } from "../../constants.js";
import { rootLogger } from "../../logger.js";

const PLANNER_PARSE_RETRIES = 2;

const SYSTEM_PROMPT = `You are the planning arm of a lab-report agent.
Decompose the assignment into ordered sub-tasks that the coding Deep Agent can execute.
Each task must state an unambiguous acceptance criterion.
Return raw JSON only: no Markdown fences, no prose, no comments.
All strings must be single-line valid JSON strings.
Do not put raw double quotes inside string values; use backticks or single quotes for code snippets.
Do not put raw newlines inside string values; summarize long text into one line.
Return ONLY a JSON object with this shape:
{"title":"...","summary":"...","tasks":[{"id":"...","title":"...","description":"...","requires_code":true,"language":"python|node","acceptance":"..."}]}.
Omit "language" when requires_code is false.`;

export const planAssignment = async (
  llm: DeepAgentRuntimeModel,
  assignment: ParsedDocument,
  template: ParsedDocument | null,
  runnableConfig: RunnableConfig,
  maxRetries = PLANNER_PARSE_RETRIES,
): Promise<TaskPlan> => {
  let retryFeedback: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await invokePlannerModel(llm, assignment, template, retryFeedback, runnableConfig);
    try {
      return parsePlannerOutput(toAgentInvocation({ messages: [response] }));
    } catch (err) {
      if (attempt === maxRetries) throw err;
      retryFeedback = (err as Error).message;
      rootLogger.warn({ attempt, err }, "retrying plan due to parse failure");
    }
  }
  throw new AgentError({
    code: "planner_internal",
    message: "unreachable planner retry state",
    stage: "plan",
  });
};

const invokePlannerModel = async (
  llm: DeepAgentRuntimeModel,
  assignment: ParsedDocument,
  template: ParsedDocument | null,
  retryFeedback: string | null,
  runnableConfig: RunnableConfig,
): Promise<unknown> => llm.invoke(
  [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildPlanningMessage(assignment, template, retryFeedback) },
  ],
  runnableConfig,
);

export const parsePlannerOutput = (invocation: AgentInvocation): TaskPlan => {
  if (invocation.structuredResponse) {
    return parseTaskPlanValue(invocation.structuredResponse, "structured response", "");
  }
  const raw = extractFinalMessageText(invocation);
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw plannerOutputError("plan-write planner did not return JSON", raw);
  return parseTaskPlanValue(parseJson(jsonText, raw), "JSON response", raw);
};

const buildPlanningMessage = (
  assignment: ParsedDocument,
  template: ParsedDocument | null,
  retryFeedback: string | null,
): string => (
  `Assignment (${assignment.kind}):\n---\n${assignment.text}\n---\n\n` +
  `${templateSummary(template, "Template: none uploaded. Use a standard lab-report structure.")}\n\n` +
  "Output JSON only." +
  retryMessage(retryFeedback)
);

const retryMessage = (feedback: string | null): string => (
  feedback ? `\n\nYour previous output was invalid:\n${feedback}\nFix the JSON and try again.` : ""
);

const parseJson = (jsonText: string, raw: string): unknown => {
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw plannerOutputError(`plan-write planner returned invalid JSON: ${(err as Error).message}`, raw, err);
  }
};

const parseTaskPlanValue = (value: unknown, source: string, raw: string): TaskPlan => {
  const parsed = TaskPlanSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw plannerOutputError(`plan-write planner returned invalid ${source}: ${parsed.error.message}`, raw, parsed.error);
};

const plannerOutputError = (message: string, raw: string, cause?: unknown): AgentError => new AgentError({
  code: "planner_invalid_output",
  message: `${message}; raw=${raw.slice(0, LIMITS.RAW_OUTPUT_LOG)}`,
  stage: "plan",
  cause,
});
