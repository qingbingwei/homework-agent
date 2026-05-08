import { describe, expect, it } from "vitest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { runCodingPlan } from "../src/agents/codingAgent/executor.js";
import type { ParsedDocument } from "../src/parsing/index.js";
import type { TaskPlan } from "../src/agents/schema.js";

const assignment: ParsedDocument = {
  filename: "assignment.md",
  kind: ".md",
  text: "Return a report with one calculation.",
  rawBytes: Buffer.from("Return a report with one calculation."),
};

describe("runCodingPlan", () => {
  it("does not invoke the coding model for non-code tasks in mixed plans", async () => {
    const codeResult = JSON.stringify({
      task_id: "code",
      status: "completed",
      explanation: "calculated",
      code: "print(2 + 3)",
      language: "python",
      stdout: "5",
      stderr: "",
      artifacts: [],
    });
    const model = new FakeListChatModel({ responses: [codeResult] });
    const llm = Object.assign(model, { bindTools: () => model });
    const results = await runCodingPlan({
      llm,
      plan: mixedPlan,
      assignment,
      template: null,
      requestId: "mixed-plan",
      runnableConfig: {},
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ task_id: "intro", status: "completed", stdout: "" });
    expect(results[1]).toMatchObject({ task_id: "code", stdout: "5", language: "python" });
  });
});

const mixedPlan: TaskPlan = {
  title: "Mixed",
  summary: "One prose task and one code task",
  tasks: [
    {
      id: "intro",
      title: "Explain goal",
      description: "Summarize the assignment.",
      requires_code: false,
      acceptance: "Writer has enough context.",
    },
    {
      id: "code",
      title: "Calculate",
      description: "Calculate 2 + 3.",
      requires_code: true,
      language: "python",
      acceptance: "stdout contains 5.",
    },
  ],
};
