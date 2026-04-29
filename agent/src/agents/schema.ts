import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requires_code: z.boolean().default(false),
  language: z.enum(["python", "node", "none"]).default("none"),
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
  language: z.enum(["python", "node", "none"]).default("none"),
  stdout: z.string().default(""),
  stderr: z.string().default(""),
  artifacts: z.array(z.string()).default([]),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;
