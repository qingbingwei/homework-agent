import type { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import type { ParsedDocument } from "../../parsing/index.js";
import { createSandbox } from "./sandbox.js";
import { CodingSandboxBackend } from "./deepSandbox.js";
import { TaskResultSchema, type Task, type TaskResult } from "../schema.js";
import { asDeepAgentModel, extractFinalMessageText, extractJsonObject } from "../deepAgent.js";

const SYSTEM_PROMPT = `You are the coding Deep Agent inside a homework-report pipeline.
- Work strictly inside the sandbox (relative paths only).
- Use write_file/read_file/edit_file for files and execute for simple allow-listed commands.
- Prefer python3 or node through execute when code is needed.
- When finished, reply ONLY with the final JSON matching the TaskResult schema:
  {"task_id":"...","status":"completed|partial|failed","explanation":"...","code":"...","language":"python|node|none","stdout":"...","stderr":"...","artifacts":["..."]}.
- Prefer executing code to verify outputs before reporting.
`;

const buildTaskMessage = (task: Task, assignment: ParsedDocument, template: ParsedDocument): string => {
  const payload = {
    task_id: task.id,
    title: task.title,
    description: task.description,
    requires_code: task.requires_code,
    language: task.language,
    acceptance: task.acceptance,
    assignment_excerpt: assignment.text.slice(0, 2000),
    template_excerpt: template.text.slice(0, 1500),
  };
  return `Execute the following task and return the JSON only:\n${JSON.stringify(payload, null, 2)}`;
};

export const runCodingAgent = async (
  llm: ChatOpenAI,
  task: Task,
  assignment: ParsedDocument,
  template: ParsedDocument,
  requestId: string,
  runnableConfig: Record<string, unknown>,
): Promise<TaskResult> => {
  const sandbox = await createSandbox(requestId, task.id);
  try {
    const agent = createDeepAgent({
      model: asDeepAgentModel(llm),
      name: "coding-agent",
      systemPrompt: SYSTEM_PROMPT,
      backend: new CodingSandboxBackend(sandbox),
    });

    const invocation = await agent.invoke(
      { messages: [{ role: "user", content: buildTaskMessage(task, assignment, template) }] } as never,
      { ...runnableConfig, recursionLimit: 30 } as never,
    );
    const content = extractFinalMessageText(invocation);
    const jsonText = extractJsonObject(content);
    if (!jsonText) {
      return {
        task_id: task.id,
        status: "failed",
        explanation: "coding-agent did not return JSON",
        code: "",
        language: "none",
        stdout: "",
        stderr: content.slice(0, 2000),
        artifacts: [],
      };
    }
    try {
      const parsed = TaskResultSchema.parse(JSON.parse(jsonText));
      return { ...parsed, task_id: task.id };
    } catch (err) {
      return {
        task_id: task.id,
        status: "failed",
        explanation: `coding-agent returned invalid JSON: ${(err as Error).message}`,
        code: "",
        language: "none",
        stdout: "",
        stderr: jsonText.slice(0, 2000),
        artifacts: [],
      };
    }
  } finally {
    await sandbox.dispose();
  }
};
