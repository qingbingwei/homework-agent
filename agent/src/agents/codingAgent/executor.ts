import type { RunnableConfig } from "@langchain/core/runnables";
import { createAgent, type CreateAgentParams } from "langchain";
import type { ParsedDocument } from "../../parsing/index.js";
import { createSandbox, type Sandbox } from "./sandbox.js";
import { buildCodingTools } from "./tools.js";
import { AgentError } from "../../http/errors.js";
import { TaskResultSchema, type Task, type TaskPlan, type TaskResult } from "../schema.js";
import { extractFinalMessageText, extractJsonObject, toAgentInvocation } from "../output.js";
import { LIMITS } from "../../constants.js";

const SYSTEM_PROMPT = `You are the coding agent inside a homework-report pipeline.
- Work strictly inside the sandbox (relative paths only).
- Available tools are write_file, read_file, run_python, run_node, and run_shell.
- Prefer write_file/read_file for files; write_file creates parent directories automatically.
- Prefer run_python or run_node for code snippets and verification.
- Use run_shell only for simple allow-listed commands with argv-style args; do not use shell separators, pipes, redirects, delete commands, or package installers.
- Do not install dependencies with pip/npm. Write dependency manifests when needed and verify with available runtimes only.
- The sandbox is shared across all tasks in this plan. Reuse and edit existing files instead of starting over.
- Once the acceptance criterion is met, stop calling tools and return the final JSON immediately.
- If a dependency, GUI display, network, or command is unavailable, stop retrying variants and return status "partial" with the blocker in stderr.
- When finished, reply ONLY with the final JSON matching the TaskResult schema:
  {"task_id":"...","status":"completed|partial|failed","explanation":"...","code":"...","language":"python|node","stdout":"...","stderr":"...","artifacts":["..."]}.
- Omit "language" when no Python or Node code is involved.
- Prefer executing code to verify outputs before reporting.
`;

export interface CodingPlanRequest {
  llm: CodingModel;
  plan: TaskPlan;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  requestId: string;
  runnableConfig: RunnableConfig;
}

interface TaskMessageInput {
  task: Task;
}

interface CodingTaskRequest extends TaskMessageInput {
  agent: CodingAgent;
  runnableConfig: RunnableConfig;
}

const buildTaskMessage = (input: TaskMessageInput): string => {
  const { task } = input;
  return [
    `Task ID: ${task.id}`,
    `Title: ${task.title}`,
    `Description: ${task.description}`,
    `Acceptance: ${task.acceptance}`,
    task.language ? `Language: ${task.language}` : "",
    "Return the final TaskResult JSON only.",
  ].filter(Boolean).join("\n");
};

export const runCodingPlan = async (request: CodingPlanRequest): Promise<TaskResult[]> => {
  const { llm, plan, requestId, runnableConfig } = request;
  const sandbox = await createSandbox(requestId, "workspace");
  const agent = buildCodingAgent(llm, sandbox);
  const results: TaskResult[] = [];
  try {
    for (const task of plan.tasks) {
      if (!task.requires_code) {
        results.push(nonCodeTaskResult(task));
        continue;
      }
      const result = await runCodingTask({ agent, task, runnableConfig });
      if (result.status === "failed") throw codingTaskFailed(result);
      results.push(result);
    }
    return results;
  } finally {
    await sandbox.dispose();
  }
};

type CodingAgent = ReturnType<typeof createAgent>;
type CodingModel = NonNullable<CreateAgentParams["model"]>;

const buildCodingAgent = (llm: CodingModel, sandbox: Sandbox): CodingAgent => createAgent({
  model: llm,
  tools: Object.values(buildCodingTools(sandbox)),
  systemPrompt: SYSTEM_PROMPT,
});

const runCodingTask = async (request: CodingTaskRequest): Promise<TaskResult> => {
  const { agent, task, runnableConfig } = request;
  const invocation = await agent.invoke(
    { messages: [{ role: "user", content: buildTaskMessage(request) }] },
    buildTaskRunnableConfig(runnableConfig, task, { recursionLimit: 20 }),
  );
  const content = extractFinalMessageText(toAgentInvocation(invocation));
  const jsonText = extractJsonObject(content);
  if (!jsonText) throw codingOutputError(task, "coding-agent did not return JSON", content);
  return parseCodingResult(task, jsonText);
};

const parseCodingResult = (task: Task, jsonText: string): TaskResult => {
  try {
    const parsed = TaskResultSchema.parse(JSON.parse(jsonText));
    return { ...parsed, task_id: task.id };
  } catch (err) {
    throw codingOutputError(task, `coding-agent returned invalid JSON: ${(err as Error).message}`, jsonText);
  }
};

const buildTaskRunnableConfig = (
  baseConfig: RunnableConfig,
  task: Task,
  overrides: RunnableConfig = {},
): RunnableConfig => ({
  ...baseConfig,
  ...overrides,
  runName: `coding-agent/${task.id}`,
  tags: [...arrayValue(baseConfig.tags), `task:${task.id}`],
  metadata: { ...objectValue(baseConfig.metadata), task_title: task.title },
});

export const nonCodeTaskResult = (task: Task): TaskResult => TaskResultSchema.parse({
  task_id: task.id,
  status: "completed",
  explanation: "Non-code task; no coding execution was required.",
  code: "",
  stdout: "",
  stderr: "",
  artifacts: [],
});

const codingTaskFailed = (result: TaskResult): AgentError => new AgentError({
  code: "coding_task_failed",
  message: `coding task ${result.task_id} failed: ${result.explanation}`,
  stage: "code",
});

const codingOutputError = (task: Task, message: string, raw: string): AgentError => new AgentError({
  code: "coding_agent_invalid_output",
  message: `${message}; task=${task.id}; raw=${raw.slice(0, LIMITS.RESULT_SUMMARY)}`,
  stage: "code",
});

const arrayValue = (value: unknown): string[] => (
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
);

const objectValue = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
);
