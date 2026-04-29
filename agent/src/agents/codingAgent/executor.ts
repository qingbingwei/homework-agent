import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import type { ParsedDocument } from "../../parsing/index.js";
import { createSandbox } from "./sandbox.js";
import { buildCodingTools } from "./tools.js";
import { TaskResultSchema, type Task, type TaskResult } from "../schema.js";

const SYSTEM_PROMPT = `You are the coding-agent inside a homework-report pipeline.
- Work strictly inside the sandbox (relative paths only).
- Use write_file/read_file for files, run_python/run_node/run_shell for execution.
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

const extractJson = (text: string): string | null => {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}\s*$/);
  return match ? match[0] : null;
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
    const tools = buildCodingTools(sandbox);
    const agent = createReactAgent({
      llm,
      tools: [tools.writeFile, tools.readFile, tools.runShell, tools.runPython, tools.runNode],
    });

    const invocation = await agent.invoke(
      {
        messages: [
          new SystemMessage(SYSTEM_PROMPT),
          new HumanMessage(buildTaskMessage(task, assignment, template)),
        ],
      },
      { ...runnableConfig, recursionLimit: 12 },
    );

    const finalMessage = invocation.messages[invocation.messages.length - 1];
    const content = typeof finalMessage?.content === "string"
      ? finalMessage.content
      : JSON.stringify(finalMessage?.content ?? "");
    const jsonText = extractJson(content);
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
