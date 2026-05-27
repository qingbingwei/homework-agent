import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseMessageLike } from "@langchain/core/messages";
import { TaskPlanSchema, type TaskPlan } from "../schema.js";
import type { ParsedDocument } from "../../parsing/index.js";
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

interface PlannerMessageInput {
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  supplementalInstructions: string;
  retryFeedback: string | null;
}

export interface PlannerModel {
  invoke(messages: BaseMessageLike[], options?: RunnableConfig): Promise<unknown>;
}

export interface PlanAssignmentRequest {
  llm: PlannerModel;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  supplementalInstructions: string;
  runnableConfig: RunnableConfig;
  maxRetries?: number;
}

const SYSTEM_PROMPT = `You are the planning arm of a lab-report agent.
Decompose the assignment into ordered sub-tasks that the coding Deep Agent can execute.
Each task must state an unambiguous acceptance criterion.
For tightly coupled coding assignments that edit the same source tree, prefer broad cohesive implementation tasks over many tiny feature tasks.
Do not split work by every UI control or method when those changes touch the same files; group them into an integrated build-and-verify task.
Return raw JSON only: no Markdown fences, no prose, no comments.
All strings must be single-line valid JSON strings.
Do not put raw double quotes inside string values; use backticks or single quotes for code snippets.
Do not put raw newlines inside string values; summarize long text into one line.
Return ONLY a JSON object with this shape:
{"title":"...","summary":"...","tasks":[{"id":"...","title":"...","description":"...","requires_code":true,"language":"python|node|java|cpp","acceptance":"..."}]}.
Omit "language" when requires_code is false.`;

export const planAssignment = async (request: PlanAssignmentRequest): Promise<TaskPlan> => {
  const maxRetries = request.maxRetries ?? PLANNER_PARSE_RETRIES;
  let retryFeedback: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await invokePlannerModel({ ...request, retryFeedback });
      return parsePlannerOutput(toAgentInvocation({ messages: [response] }));
    } catch (err) {
      if (!shouldRetryPlannerOutput(err, attempt, maxRetries)) throw err;
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
  request: PlanAssignmentRequest & { retryFeedback: string | null },
): Promise<unknown> => {
  return await request.llm.invoke(plannerMessages(request), request.runnableConfig);
};

const plannerMessages = (input: PlannerMessageInput): BaseMessageLike[] => [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: buildPlanningMessage(input) },
];

export const parsePlannerOutput = (invocation: AgentInvocation): TaskPlan => {
  if (invocation.structuredResponse) {
    return parseTaskPlanValue(invocation.structuredResponse, "structured response", "");
  }
  const raw = extractFinalMessageText(invocation);
  const jsonText = extractJsonObject(raw);
  if (!jsonText) throw plannerOutputError("plan-write planner did not return JSON", raw);
  return parseTaskPlanValue(parseJson(jsonText, raw), "JSON response", raw);
};

const buildPlanningMessage = (input: PlannerMessageInput): string => (
  `Assignment (${input.assignment.kind}):\n---\n${input.assignment.text}\n---\n\n` +
  `${templateSummary(input.template, "Template: none uploaded. Use a standard lab-report structure.")}\n\n` +
  supplementalInstructionsBlock(input.supplementalInstructions) +
  "Output JSON only." +
  retryMessage(input.retryFeedback)
);

const supplementalInstructionsBlock = (instructions: string): string => (
  instructions ? `Supplemental user instructions:\n---\n${instructions}\n---\n\n` : ""
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

const shouldRetryPlannerOutput = (err: unknown, attempt: number, maxRetries: number): boolean => (
  err instanceof AgentError &&
  err.stage === "plan" &&
  err.code === "planner_invalid_output" &&
  attempt < maxRetries
);

const plannerOutputError = (message: string, raw: string, cause?: unknown): AgentError => new AgentError({
  code: "planner_invalid_output",
  message: `${message}; raw=${raw.slice(0, LIMITS.RAW_OUTPUT_LOG)}`,
  stage: "plan",
  cause,
});
