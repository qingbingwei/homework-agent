import { execa } from "execa";
import type { CodeExecutionConfig, ContainerExecutionConfig } from "../../config.js";
import { LIMITS } from "../../constants.js";
import { inheritedWorkspaceEnv } from "../workspaceUtils.js";
import type { Sandbox } from "./sandbox.js";

const CONTAINER_WORKSPACE = "/workspace";
const CONTAINER_HOME = "/tmp";
const HEADLESS_MATPLOTLIB_BACKEND = "Agg";

export interface RuntimeCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RuntimeCommandInput {
  sandbox: Sandbox;
  command: string;
  args: string[];
  stdin?: string;
}

export interface CodeRuntime {
  kind: "host" | "container";
  execute(input: RuntimeCommandInput): Promise<RuntimeCommandResult>;
}

export interface ContainerRunArgsInput {
  config: ContainerExecutionConfig;
  workspaceDir: string;
  user: string | null;
  command: string;
  args: string[];
}

export const createCodeRuntime = (config: CodeExecutionConfig): CodeRuntime => (
  config.backend === "container" ? createContainerCodeRuntime(config.container) : createHostCodeRuntime()
);

export const createHostCodeRuntime = (): CodeRuntime => ({
  kind: "host",
  execute: executeHostCommand,
});

export const createContainerCodeRuntime = (config: ContainerExecutionConfig): CodeRuntime => ({
  kind: "container",
  execute: (input) => executeContainerCommand(config, input),
});

export const buildContainerRunArgs = (input: ContainerRunArgsInput): string[] => {
  const args = [
    "run",
    "--rm",
    "-i",
    "--network",
    input.config.network,
    "--cpus",
    input.config.cpus,
    "--memory",
    input.config.memory,
    "--pids-limit",
    String(input.config.pidsLimit),
    "-e",
    `HOME=${CONTAINER_HOME}`,
    "-e",
    `MPLBACKEND=${HEADLESS_MATPLOTLIB_BACKEND}`,
    "-v",
    `${input.workspaceDir}:${CONTAINER_WORKSPACE}`,
    "-w",
    CONTAINER_WORKSPACE,
  ];
  if (input.user) args.push("--user", input.user);
  args.push(input.config.image, input.command, ...input.args);
  return args;
};

const executeHostCommand = async (input: RuntimeCommandInput): Promise<RuntimeCommandResult> => {
  const result = await execa(input.command, input.args, {
    cwd: input.sandbox.rootDir,
    input: input.stdin,
    timeout: LIMITS.SANDBOX_TIMEOUT_MS,
    reject: false,
    env: inheritedWorkspaceEnv(),
  });
  return commandResult(result.exitCode ?? null, result.stdout, result.stderr);
};

const executeContainerCommand = async (
  config: ContainerExecutionConfig,
  input: RuntimeCommandInput,
): Promise<RuntimeCommandResult> => {
  const result = await execa(config.engine, buildContainerRunArgs({
    config,
    workspaceDir: input.sandbox.rootDir,
    user: containerUser(config),
    command: input.command,
    args: input.args,
  }), {
    input: input.stdin,
    timeout: LIMITS.SANDBOX_TIMEOUT_MS,
    reject: false,
  });
  return commandResult(result.exitCode ?? null, result.stdout, result.stderr);
};

const containerUser = (config: ContainerExecutionConfig): string | null => {
  if (!config.runAsCurrentUser || !process.getuid || !process.getgid) return null;
  return `${process.getuid()}:${process.getgid()}`;
};

const commandResult = (
  exitCode: number | null,
  stdout: string | undefined,
  stderr: string | undefined,
): RuntimeCommandResult => ({
  exitCode,
  stdout: stdout ?? "",
  stderr: stderr ?? "",
});
