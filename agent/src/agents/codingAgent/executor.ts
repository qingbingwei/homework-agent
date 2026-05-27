import type { RunnableConfig } from "@langchain/core/runnables";
import { createAgent, type CreateAgentParams } from "langchain";
import { createSandbox, type Sandbox } from "./sandbox.js";
import { buildCodingTools } from "./tools.js";
import { createHostCodeRuntime, type CodeRuntime } from "./runtime.js";
import { AgentError } from "../../http/errors.js";
import { failedTaskResult, nonCodeTaskResult, TaskResultSchema, type Task, type TaskPlan, type TaskResult } from "../schema.js";
import { extractFinalMessageText, extractJsonObject, toAgentInvocation } from "../output.js";
import { LIMITS } from "../../constants.js";
import { rootLogger } from "../../logger.js";

const SYSTEM_PROMPT = `You are the coding agent inside a homework-report pipeline.
- Work strictly inside the sandbox (relative paths only).
- Available tools are write_file, edit_file, read_file, run_python, run_node, and run_shell.
- Prefer write_file/read_file for files; write_file creates parent directories automatically.
- Use read_file with offset_line/line_limit to inspect source chunks; never use run_python to print file contents or line ranges.
- Use edit_file for exact text replacements after reading a file; do not use run_python as a one-line file editor.
- Batch related file edits into one coherent tool call or script, then verify once.
- Prefer run_python or run_node for code snippets and verification.
- Use run_shell for Java/C/C++ compile-run checks with allow-listed commands such as javac, java, gcc, and g++; pass argv-style args only.
- Do not use shell separators, pipes, redirects, delete commands, or package installers.
- Do not install dependencies with pip/npm. Write dependency manifests when needed and verify with available runtimes only.
- The sandbox is shared across all tasks in this plan. Reuse and edit existing files instead of starting over.
- Once the acceptance criterion is met and relevant compile/tests/custom assertions pass, stop calling tools and return the final JSON immediately.
- Do not spend extra tool calls reviewing unchanged source after verification passes.
- If a dependency, GUI display, network, or command is unavailable, stop retrying variants and return status "partial" with the blocker in stderr.
- When finished, reply ONLY with the final JSON matching the TaskResult schema:
  {"task_id":"...","status":"completed|partial|failed","explanation":"...","code":"...","language":"python|node|java|cpp","stdout":"...","stderr":"...","artifacts":["..."]}.
- Omit "language" when no Python, Node, Java, or C/C++ code is involved.
- Prefer executing code to verify outputs before reporting.
`;

export interface CodingPlanRequest {
  llm: CodingModel;
  plan: TaskPlan;
  requestId: string;
  supplementalInstructions: string;
  runnableConfig: RunnableConfig;
  runtime?: CodeRuntime;
}

interface TaskMessageInput {
  task: Task;
  supplementalInstructions: string;
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
    supplementalInstructionsBlock(input.supplementalInstructions),
    "Stop condition: after implementing and passing relevant verification, return final TaskResult JSON immediately.",
    "Return the final TaskResult JSON only.",
  ].filter(Boolean).join("\n");
};

export const runCodingPlan = async (request: CodingPlanRequest): Promise<TaskResult[]> => {
  const { llm, plan, requestId, runnableConfig } = request;
  const sandbox = await createSandbox(requestId, sandboxTaskId(plan));
  const runtime = request.runtime ?? createHostCodeRuntime();
  const agent = buildCodingAgent(llm, sandbox, runtime);
  const results: TaskResult[] = [];
  try {
    for (const task of plan.tasks) {
      if (!task.requires_code) {
        results.push(nonCodeTaskResult(task));
        continue;
      }
      const result = await runCodingTaskOrFailureResult({
        agent,
        task,
        supplementalInstructions: request.supplementalInstructions,
        runnableConfig,
      });
      results.push(result);
      if (result.status === "failed") {
        rootLogger.warn({ requestId, taskId: task.id }, "coding task returned failed status");
      }
    }
    return results;
  } finally {
    await sandbox.dispose();
  }
};

type CodingAgent = ReturnType<typeof createAgent>;
type CodingModel = NonNullable<CreateAgentParams["model"]>;

const buildCodingAgent = (llm: CodingModel, sandbox: Sandbox, runtime: CodeRuntime): CodingAgent => createAgent({
  model: llm,
  tools: Object.values(buildCodingTools(sandbox, runtime)),
  systemPrompt: SYSTEM_PROMPT,
});

const runCodingTask = async (request: CodingTaskRequest): Promise<TaskResult> => {
  const { agent, task, runnableConfig } = request;
  const invocation = await agent.invoke(
    { messages: [{ role: "user", content: buildTaskMessage(request) }] },
    buildTaskRunnableConfig(runnableConfig, task, { recursionLimit: LIMITS.CODING_AGENT_RECURSION_LIMIT }),
  );
  const content = extractFinalMessageText(toAgentInvocation(invocation));
  const jsonText = extractJsonObject(content);
  if (!jsonText) throw codingOutputError(task, "coding-agent did not return JSON", content);
  return parseCodingResult(task, jsonText);
};

const runCodingTaskOrFailureResult = async (request: CodingTaskRequest): Promise<TaskResult> => {
  try {
    return await runCodingTask(request);
  } catch (err) {
    rootLogger.error({ err, taskId: request.task.id }, "coding task failed before producing valid output");
    return failedTaskResult(
      request.task,
      "Coding task failed before producing a valid TaskResult.",
      errorDetails(err),
    );
  }
};

const supplementalInstructionsBlock = (instructions: string): string => (
  instructions ? `Supplemental user instructions:\n${instructions}` : ""
);

const sandboxTaskId = (plan: TaskPlan): string => {
  const taskIds = plan.tasks.filter((task) => task.requires_code).map((task) => task.id);
  return taskIds.length > 0 ? taskIds.join("-") : "non-code";
};

const errorDetails = (err: unknown): string => {
  if (err instanceof Error) return err.stack ?? err.message;
  return String(err);
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
