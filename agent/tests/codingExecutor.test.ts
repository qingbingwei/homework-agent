import { describe, expect, it } from "vitest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { runCodingPlan } from "../src/agents/codingAgent/executor.js";
import type { TaskPlan } from "../src/agents/schema.js";

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
      requestId: "mixed-plan",
      supplementalInstructions: "",
      runnableConfig: {},
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ task_id: "intro", status: "completed", stdout: "" });
    expect(results[1]).toMatchObject({ task_id: "code", stdout: "5", language: "python" });
  });

  it("preserves completed results when a later coding task reports failure", async () => {
    const model = new FakeListChatModel({
      responses: [JSON.stringify(completedCodeResult), JSON.stringify(failedCodeResult)],
    });
    const llm = Object.assign(model, { bindTools: () => model });

    const results = await runCodingPlan({
      llm,
      plan: failingPlan,
      requestId: "failing-plan",
      supplementalInstructions: "",
      runnableConfig: {},
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ task_id: "first", status: "completed", stdout: "5" });
    expect(results[1]).toMatchObject({ task_id: "second", status: "failed", stderr: "boom" });
  });
});

const completedCodeResult = {
  task_id: "first",
  status: "completed",
  explanation: "calculated",
  code: "print(2 + 3)",
  language: "python",
  stdout: "5",
  stderr: "",
  artifacts: [],
};

const failedCodeResult = {
  task_id: "second",
  status: "failed",
  explanation: "calculation failed",
  code: "",
  stdout: "",
  stderr: "boom",
  artifacts: [],
};

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

const failingPlan: TaskPlan = {
  title: "Failure",
  summary: "One success and one failure",
  tasks: [
    {
      id: "first",
      title: "Calculate first",
      description: "Calculate 2 + 3.",
      requires_code: true,
      language: "python",
      acceptance: "stdout contains 5.",
    },
    {
      id: "second",
      title: "Fail second",
      description: "Return a failed task result.",
      requires_code: true,
      language: "python",
      acceptance: "stderr explains the failure.",
    },
  ],
};
