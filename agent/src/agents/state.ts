import { Annotation } from "@langchain/langgraph";
import type { ParsedDocument } from "../parsing/index.js";
import type { TaskPlan, TaskResult, WriterOutput } from "./schema.js";

export interface GraphInput {
  requestId: string;
  modelLabel: string;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  supplementalInstructions: string;
}

export interface GraphState {
  requestId: string;
  modelLabel: string;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  supplementalInstructions: string;
  plan: TaskPlan | null;
  results: TaskResult[];
  writer: WriterOutput | null;
}

const replaceValue = <T>(_old: T, next: T): T => next;

export const GraphAnnotation = Annotation.Root({
  requestId: Annotation<string>({ reducer: replaceValue, default: () => "" }),
  modelLabel: Annotation<string>({ reducer: replaceValue, default: () => "" }),
  assignment: Annotation<ParsedDocument>({ reducer: replaceValue }),
  template: Annotation<ParsedDocument | null>({ reducer: replaceValue }),
  supplementalInstructions: Annotation<string>({ reducer: replaceValue, default: () => "" }),
  plan: Annotation<TaskPlan | null>({ reducer: replaceValue, default: () => null }),
  results: Annotation<TaskResult[]>({ reducer: replaceValue, default: () => [] }),
  writer: Annotation<WriterOutput | null>({ reducer: replaceValue, default: () => null }),
});

export const initialGraphState = (input: GraphInput): GraphState => ({
  requestId: input.requestId,
  modelLabel: input.modelLabel,
  assignment: input.assignment,
  template: input.template,
  supplementalInstructions: input.supplementalInstructions,
  plan: null,
  results: [],
  writer: null,
});
