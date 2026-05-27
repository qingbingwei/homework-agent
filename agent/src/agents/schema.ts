import { z } from "zod";

const LanguageSchema = z.preprocess(
  (value) => (value === "none" ? undefined : value),
  z.enum(["python", "node", "java", "cpp"]).optional(),
);

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requires_code: z.boolean().default(false),
  language: LanguageSchema,
  acceptance: z.string().min(1),
});

export const TaskPlanSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  tasks: z.array(TaskSchema).min(1),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

export const TaskResultSchema = z.object({
  task_id: z.string().min(1),
  status: z.enum(["completed", "partial", "failed"]),
  explanation: z.string().min(1),
  code: z.string().default(""),
  language: LanguageSchema,
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  artifacts: z.array(z.string()).default([]),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;

export const nonCodeTaskResult = (task: Task): TaskResult => ({
  task_id: task.id,
  status: "completed",
  explanation: "Non-code task; no coding execution was required.",
  code: "",
  stdout: "",
  stderr: "",
  artifacts: [],
});

export const failedTaskResult = (task: Task, explanation: string, stderr: string): TaskResult => ({
  task_id: task.id,
  status: "failed",
  explanation,
  code: "",
  stdout: "",
  stderr,
  artifacts: [],
});

export type WriterTemplateStrategy = "deep-agent-docx-template" | "deep-agent-docx-generated";

export interface WriterOutput {
  title: string;
  docxBytes: Buffer;
  markdownPreview: string;
  templateStrategy: WriterTemplateStrategy;
}
