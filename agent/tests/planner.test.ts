import { describe, expect, it } from "vitest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { parsePlannerOutput, planAssignment } from "../src/agents/planWrite/planner.js";
import type { DeepAgentRuntimeModel } from "../src/agents/deepAgent.js";
import type { ParsedDocument } from "../src/parsing/index.js";

const validPlan = {
  title: "Demo",
  summary: "One task",
  tasks: [
    {
      id: "task-1",
      title: "Answer",
      description: "Return the answer.",
      requires_code: false,
      language: "none",
      acceptance: "A completed result is produced.",
    },
  ],
};

describe("parsePlannerOutput", () => {
  it("accepts structuredResponse when a provider supplies one", () => {
    const result = parsePlannerOutput({
      structuredResponse: validPlan,
      messages: [{ content: '{"title":"broken "quote"}' }],
    });

    expect(result).toMatchObject({ title: "Demo", tasks: [{ id: "task-1" }] });
    expect(result.tasks[0]?.language).toBeUndefined();
  });

  it("parses fenced JSON text when structured output is absent", () => {
    const result = parsePlannerOutput({
      messages: [{ content: `\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\`` }],
    });

    expect(result.summary).toBe("One task");
  });

  it("throws an explicit planner error for malformed JSON text", () => {
    expect(() => parsePlannerOutput({
      messages: [{ content: '{"title":"Bad","summary":"broken","tasks":[{"id":"1","title":"oops "quote"}]}' }],
    })).toThrowError(/planner returned invalid JSON/);
  });
});

describe("planAssignment", () => {
  it("retries invalid JSON output and returns the corrected plan", async () => {
    const llm = fakeDeepAgentModel([
      '{"title":"Bad","summary":"broken","tasks":[{"id":"1","title":"oops "quote"}]}',
      JSON.stringify(validPlan),
    ]);

    const result = await planAssignment(llm, assignment, null, {}, 1);

    expect(result).toMatchObject({ title: "Demo", tasks: [{ id: "task-1" }] });
  });
});

const assignment: ParsedDocument = {
  filename: "assignment.md",
  kind: ".md",
  text: "Write a short report.",
  rawBytes: Buffer.from("Write a short report."),
};

const fakeDeepAgentModel = (responses: string[]): DeepAgentRuntimeModel => {
  const model = new FakeListChatModel({ responses });
  return Object.assign(model, { bindTools: () => model });
};
