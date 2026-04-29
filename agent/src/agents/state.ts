import type { AgentErrorPayload } from "../http/errors.js";
import type { ParsedDocument } from "../parsing/index.js";
import type { TaskPlan, TaskResult } from "./schema.js";

export interface GraphInput {
  requestId: string;
  modelLabel: string;
  assignment: ParsedDocument;
  template: ParsedDocument;
}

export interface WriterOutput {
  title: string;
  markdown: string;
}

export interface GraphState {
  requestId: string;
  modelLabel: string;
  assignment: ParsedDocument;
  template: ParsedDocument;
  plan: TaskPlan | null;
  results: TaskResult[];
  writer: WriterOutput | null;
  error: AgentErrorPayload | null;
}

export const initialGraphState = (input: GraphInput): GraphState => ({
  requestId: input.requestId,
  modelLabel: input.modelLabel,
  assignment: input.assignment,
  template: input.template,
  plan: null,
  results: [],
  writer: null,
  error: null,
});
