export type ErrorStage =
  | "request_handling"
  | "ingest"
  | "plan"
  | "code"
  | "write"
  | "generate_report";

export interface AgentErrorPayload {
  code: string;
  message: string;
  request_id: string;
  stage: ErrorStage;
}

export class AgentError extends Error {
  public readonly code: string;
  public readonly stage: ErrorStage;
  public readonly statusCode: number;

  constructor(options: {
    code: string;
    message: string;
    stage: ErrorStage;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.code = options.code;
    this.stage = options.stage;
    this.statusCode = options.statusCode ?? 500;
    if (options.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export const describeException = (exc: unknown): string => {
  if (exc instanceof Error) {
    const raw = exc.message?.trim();
    if (raw) return raw;
    return `${exc.name}: no error message`;
  }
  if (typeof exc === "string" && exc.trim().length > 0) return exc;
  return "unknown error";
};
