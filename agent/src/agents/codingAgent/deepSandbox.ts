import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { execa } from "execa";
import type {
  EditResult,
  ExecuteResponse,
  FileData,
  FileDownloadResponse,
  FileInfo,
  FileUploadResponse,
  GrepMatch,
  SandboxBackendProtocol,
  WriteResult,
} from "deepagents";
import type { Sandbox } from "./sandbox.js";

const COMMAND_TIMEOUT_MS = 20_000;
const OUTPUT_LIMIT = 8_000;
const SIMPLE_COMMAND = /^[A-Za-z0-9_./-]+(?:\s+(?:"[^"]*"|'[^']*'|[^\s;&|<>`$(){}]+))*$/;
const COMMAND_ALLOWLIST = new Set(["python3", "node", "ls", "pwd", "true", "false"]);

export class CodingSandboxBackend implements SandboxBackendProtocol {
  readonly id: string;

  constructor(private readonly sandbox: Sandbox) {
    this.id = `${sandbox.requestId}-${sandbox.taskId}`;
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    const root = this.toAbsolute(path);
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    return await Promise.all(entries.map(async (entry) => {
      const absolute = join(root, entry.name);
      const info = await stat(absolute);
      return {
        path: this.toVirtual(absolute, entry.isDirectory()),
        is_dir: entry.isDirectory(),
        size: info.size,
        modified_at: info.mtime.toISOString(),
      };
    }));
  }

  async read(filePath: string, offset = 0, limit = 500): Promise<string> {
    try {
      return formatRead(await this.readRaw(filePath), offset, limit);
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  }

  async readRaw(filePath: string): Promise<FileData> {
    const absolute = this.toAbsolute(filePath);
    const [content, info] = await Promise.all([readFile(absolute, "utf8"), stat(absolute)]);
    return {
      content: content.split(/\r?\n/),
      created_at: info.birthtime.toISOString(),
      modified_at: info.mtime.toISOString(),
    };
  }

  async grepRaw(pattern: string, path = "/", glob?: string | null): Promise<GrepMatch[]> {
    const files = await this.collectFiles(this.toAbsolute(path), glob ?? undefined);
    const matches: GrepMatch[] = [];
    for (const absolute of files) {
      const lines = (await readFile(absolute, "utf8")).split(/\r?\n/);
      lines.forEach((text, index) => {
        if (text.includes(pattern)) matches.push({ path: this.toVirtual(absolute), line: index + 1, text });
      });
    }
    return matches;
  }

  async globInfo(pattern: string, path = "/"): Promise<FileInfo[]> {
    const files = await this.collectFiles(this.toAbsolute(path), pattern);
    return await Promise.all(files.map(async (absolute) => {
      const info = await stat(absolute);
      return { path: this.toVirtual(absolute), is_dir: false, size: info.size, modified_at: info.mtime.toISOString() };
    }));
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    const absolute = this.toAbsolute(filePath);
    try {
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, content, { encoding: "utf8", flag: "wx" });
      return { path: filePath, filesUpdate: null };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  async edit(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    const absolute = this.toAbsolute(filePath);
    const content = await readFile(absolute, "utf8");
    const count = countOccurrences(content, oldString);
    if (count === 0) return { error: `String not found in file '${filePath}'` };
    if (count > 1 && !replaceAll) return { error: `Multiple occurrences found in '${filePath}'` };
    const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString);
    await writeFile(absolute, updated, "utf8");
    return { path: filePath, filesUpdate: null, occurrences: replaceAll ? count : 1 };
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const parsed = parseSimpleCommand(command);
    if (!parsed || !COMMAND_ALLOWLIST.has(parsed.command)) {
      return { output: `Error: command not allowed: ${command}`, exitCode: 126, truncated: false };
    }
    const result = await execa(parsed.command, parsed.args, {
      cwd: this.sandbox.rootDir,
      timeout: COMMAND_TIMEOUT_MS,
      reject: false,
      env: sanitizedEnv(),
    });
    return toExecuteResponse(result.stdout ?? "", result.stderr ?? "", result.exitCode ?? null);
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    return await Promise.all(files.map(async ([path, content]) => {
      const result = await this.write(path, Buffer.from(content).toString("utf8"));
      return { path, error: result.error ? "permission_denied" : null };
    }));
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    return await Promise.all(paths.map(async (path) => {
      try {
        return { path, content: await readFile(this.toAbsolute(path)), error: null };
      } catch {
        return { path, content: null, error: "file_not_found" };
      }
    }));
  }

  private toAbsolute(path: string): string {
    const normalized = path.startsWith("/") ? path.slice(1) : path;
    return this.sandbox.resolveWithin(normalized);
  }

  private toVirtual(absolute: string, directory = false): string {
    const rel = relative(this.sandbox.rootDir, absolute).split(/[\\/]/).join("/");
    return `/${rel}${directory ? "/" : ""}`;
  }

  private async collectFiles(root: string, glob?: string): Promise<string[]> {
    const info = await stat(root).catch(() => null);
    if (!info) return [];
    if (info.isFile()) return matchesGlob(root, glob) ? [root] : [];
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => this.collectFiles(join(root, entry.name), glob)));
    return nested.flat();
  }
}

const formatRead = (file: FileData, offset: number, limit: number): string => (
  file.content.slice(offset, offset + limit)
    .map((line, index) => `${String(offset + index + 1).padStart(6)}\t${line}`)
    .join("\n")
);

const countOccurrences = (content: string, needle: string): number => (
  needle.length === 0 ? 0 : content.split(needle).length - 1
);

const matchesGlob = (absolute: string, glob?: string): boolean => {
  if (!glob || glob === "**/*") return true;
  if (glob.startsWith("*.")) return absolute.endsWith(glob.slice(1));
  return absolute.endsWith(glob.replace(/^\*\*\//, ""));
};

const parseSimpleCommand = (command: string): { command: string; args: string[] } | null => {
  if (!SIMPLE_COMMAND.test(command)) return null;
  const tokens = command.match(/"([^"]*)"|'([^']*)'|[^\s]+/g) ?? [];
  if (tokens.length === 0) return null;
  const [rawCommand, ...args] = tokens.map((token) => token.replace(/^["']|["']$/g, ""));
  return rawCommand ? { command: rawCommand, args } : null;
};

const toExecuteResponse = (stdout: string, stderr: string, exitCode: number | null): ExecuteResponse => {
  const output = [stdout, stderr].filter(Boolean).join("\n");
  return { output: truncate(output), exitCode, truncated: output.length > OUTPUT_LIMIT };
};

const truncate = (value: string): string => (
  value.length <= OUTPUT_LIMIT ? value : value.slice(0, OUTPUT_LIMIT)
);

const sanitizedEnv = (): NodeJS.ProcessEnv => {
  const allowedKeys = ["PATH", "HOME", "LANG", "LC_ALL", "LC_CTYPE"];
  return Object.fromEntries(allowedKeys.flatMap((key) => {
    const value = process.env[key];
    return typeof value === "string" ? [[key, value]] : [];
  }));
};
