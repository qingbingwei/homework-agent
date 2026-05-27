import { describe, expect, it } from "vitest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import {
  parsePlannerOutput,
  planAssignment,
  type PlannerModel,
} from "../src/agents/planWrite/planner.js";
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
    const llm = fakePlannerModel([
      '{"title":"Bad","summary":"broken","tasks":[{"id":"1","title":"oops "quote"}]}',
      JSON.stringify(validPlan),
    ]);

    const result = await planAssignment(planRequest(llm, { maxRetries: 1 }));

    expect(result).toMatchObject({ title: "Demo", tasks: [{ id: "task-1" }] });
  });

  it("retries an empty model response and returns the corrected plan", async () => {
    const llm = sequencePlannerModel([
      { content: "" },
      { content: JSON.stringify(validPlan) },
    ]);

    const result = await planAssignment(planRequest(llm, { maxRetries: 1 }));

    expect(result).toMatchObject({ title: "Demo", tasks: [{ id: "task-1" }] });
  });
});

const assignment: ParsedDocument = {
  filename: "assignment.md",
  kind: ".md",
  text: "Write a short report.",
  rawBytes: Buffer.from("Write a short report."),
};

const fakePlannerModel = (responses: string[]): PlannerModel => new FakeListChatModel({ responses });

const sequencePlannerModel = (results: unknown[]): PlannerModel => {
  let index = 0;
  return {
    invoke: async () => {
      const result = results[index];
      index += 1;
      if (!result) throw new Error("test planner model exhausted");
      return result;
    },
  };
};

const planRequest = (llm: PlannerModel, options: { maxRetries?: number } = {}) => ({
  llm,
  assignment,
  template: null,
  supplementalInstructions: "",
  runnableConfig: {},
  maxRetries: options.maxRetries,
});
