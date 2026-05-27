import { rmSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";
import { execa } from "execa";
import {
  FilesystemBackend,
  type BackendProtocol,
  type EditResult,
  type ExecuteResponse,
  type FileDownloadResponse,
  type FileInfo,
  type FileUploadResponse,
  type GrepMatch,
  type SandboxBackendProtocol,
  type WriteResult,
} from "deepagents";
import type { ParsedDocument } from "../../parsing/index.js";
import type { TaskPlan, TaskResult } from "../schema.js";
import { buildDocxSkillFiles } from "../skills.js";
import { AgentError } from "../../http/errors.js";
import { LIMITS } from "../../constants.js";
import { sanitizeWorkspaceSegment } from "../workspaceUtils.js";
import { installPythonVirtualPathRuntime, pythonVirtualPathEnv } from "./pythonVirtualPaths.js";
import { normalizeVirtualPathOutput, rootRecursiveScanError, rewriteVirtualPaths } from "./workspacePaths.js";

export { normalizeVirtualPathOutput, rootRecursiveScanError, rewriteVirtualPaths } from "./workspacePaths.js";

const WRITER_ROOT = join(tmpdir(), "homework-agent-writer-docx");
export const TEMPLATE_DOCX_PATH = "/workspace/template.docx";
export const FINAL_DOCX_PATH = "/workspace/final.docx";
const CONTEXT_JSON_PATH = "/workspace/context.json";
const US_LETTER_WIDTH_DXA = "12240";
const US_LETTER_HEIGHT_DXA = "15840";
const DEFAULT_MARGIN_DXA = "1440";

process.once("exit", () => {
  rmSync(WRITER_ROOT, { recursive: true, force: true });
});

export interface DocxWriterWorkspace {
  backend: SandboxBackendProtocol;
  templateUploaded: boolean;
  dispose(): Promise<void>;
  downloadDocx(path: string): Promise<Buffer>;
}

export interface CreateDocxWriterWorkspaceInput {
  requestId: string;
  assignment: ParsedDocument;
  template: ParsedDocument | null;
  plan: TaskPlan;
  results: TaskResult[];
  supplementalInstructions: string;
}

export const cleanupStaleDocxWriterWorkspaces = async (): Promise<void> => {
  await rm(WRITER_ROOT, { recursive: true, force: true }).catch(() => undefined);
};

export const createDocxWriterWorkspace = async (
  input: CreateDocxWriterWorkspaceInput,
): Promise<DocxWriterWorkspace> => {
  const rootDir = join(WRITER_ROOT, sanitizeWorkspaceSegment(input.requestId, "req"));
  await mkdir(rootDir, { recursive: true });
  await installPythonVirtualPathRuntime(rootDir);
  const backend = new LocalDocxSandbox(rootDir, `docx-writer-${input.requestId}`);
  await backend.uploadFiles(await workspaceFiles(input));
  return {
    backend,
    templateUploaded: input.template?.kind === ".docx",
    dispose: async () => rm(rootDir, { recursive: true, force: true }),
    downloadDocx: (path) => downloadDocx(backend, path),
  };
};

const workspaceFiles = async (
  input: CreateDocxWriterWorkspaceInput,
): Promise<Array<[string, Uint8Array]>> => [
  ...await skillUploads(),
  [TEMPLATE_DOCX_PATH, input.template?.kind === ".docx" ? input.template.rawBytes : await starterDocx()],
  [CONTEXT_JSON_PATH, Buffer.from(JSON.stringify(writerContext(input), null, 2), "utf8")],
];

const writerContext = (input: CreateDocxWriterWorkspaceInput) => ({
  assignment: { kind: input.assignment.kind, filename: input.assignment.filename, text: input.assignment.text },
  template: input.template
    ? { kind: input.template.kind, filename: input.template.filename, text: input.template.text }
    : null,
  uploaded_docx_template: input.template?.kind === ".docx",
  supplemental_instructions: input.supplementalInstructions,
  plan: input.plan,
  results: input.results,
  paths: { template_docx: TEMPLATE_DOCX_PATH, final_docx: FINAL_DOCX_PATH, context_json: CONTEXT_JSON_PATH },
});

const skillUploads = async (): Promise<Array<[string, Uint8Array]>> => {
  const skillFiles = await buildDocxSkillFiles();
  return Object.entries(skillFiles).map(([path, file]) => [
    path,
    Buffer.from(file.content.join("\n"), "utf8"),
  ]);
};

const downloadDocx = async (backend: SandboxBackendProtocol, path: string): Promise<Buffer> => {
  if (!backend.downloadFiles) throw writerWorkspaceError("writer backend does not support docx download");
  const [file] = await backend.downloadFiles([path]);
  if (!file?.content) throw writerWorkspaceError(`writer did not create docx at ${path}`);
  const bytes = Buffer.from(file.content);
  await validateDocx(bytes, path);
  return bytes;
};

const validateDocx = async (bytes: Buffer, path: string): Promise<void> => {
  const zip = await JSZip.loadAsync(bytes).catch((err) => {
    throw writerWorkspaceError(`writer output is not a valid docx zip: ${path}`, err);
  });
  if (!zip.file("word/document.xml")) throw writerWorkspaceError(`writer output missing word/document.xml: ${path}`);
};

const starterDocx = async (): Promise<Buffer> => {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.file("_rels/.rels", packageRelationshipsXml());
  zip.file("word/document.xml", starterDocumentXml());
  zip.file("word/_rels/document.xml.rels", relationshipsXml());
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
};

class LocalDocxSandbox implements SandboxBackendProtocol {
  private readonly files: BackendProtocol;

  constructor(private readonly rootDir: string, public readonly id: string) {
    this.files = new FilesystemBackend({ rootDir, virtualMode: true });
  }

  async lsInfo(path: string): Promise<FileInfo[]> { return await this.files.lsInfo(path); }
  async read(path: string, offset?: number, limit?: number): Promise<string> {
    return await this.files.read(path, offset, limit);
  }
  readRaw(path: string) { return this.files.readRaw(path); }
  async write(path: string, content: string): Promise<WriteResult> {
    return await this.files.write(path, content);
  }
  async edit(path: string, oldValue: string, newValue: string, all?: boolean): Promise<EditResult> {
    return await this.files.edit(path, oldValue, newValue, all);
  }
  async grepRaw(pattern: string, path?: string | null, glob?: string | null): Promise<GrepMatch[] | string> {
    return await this.files.grepRaw(pattern, path, glob);
  }
  async globInfo(pattern: string, path?: string): Promise<FileInfo[]> {
    return await this.files.globInfo(pattern, path);
  }
  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    return await this.files.uploadFiles!(files);
  }
  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    return await this.files.downloadFiles!(paths);
  }
  async execute(command: string): Promise<ExecuteResponse> { return executeInWorkspace(this.rootDir, command); }
}

const executeInWorkspace = async (rootDir: string, command: string): Promise<ExecuteResponse> => {
  const scanError = rootRecursiveScanError(command);
  if (scanError) return { output: scanError, exitCode: 2, truncated: false };

  const result = await execa("bash", ["-lc", rewriteVirtualPaths(rootDir, command)], {
    cwd: rootDir,
    timeout: LIMITS.SANDBOX_TIMEOUT_MS,
    reject: false,
    env: pythonVirtualPathEnv(rootDir),
  });
  const rawOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const output = normalizeVirtualPathOutput(rootDir, rawOutput);
  return {
    output: truncate(output),
    exitCode: result.exitCode ?? null,
    truncated: output.length > LIMITS.TOOL_STDOUT,
  };
};

const truncate = (value: string): string => (
  value.length <= LIMITS.TOOL_STDOUT ? value : `${value.slice(0, LIMITS.TOOL_STDOUT)}\n...<truncated>`
);

const writerWorkspaceError = (message: string, cause?: unknown): AgentError => new AgentError({
  code: "writer_docx_workspace_failed",
  message,
  stage: "write",
  cause,
});

const contentTypesXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>"
);

const packageRelationshipsXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>"
);

const relationshipsXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
);

const starterDocumentXml = (): string => (
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:r><w:t xml:space="preserve">{{REPORT_BODY}}</w:t></w:r></w:p>' +
  `<w:sectPr><w:pgSz w:w="${US_LETTER_WIDTH_DXA}" w:h="${US_LETTER_HEIGHT_DXA}"/>` +
  `<w:pgMar w:top="${DEFAULT_MARGIN_DXA}" w:right="${DEFAULT_MARGIN_DXA}" ` +
  `w:bottom="${DEFAULT_MARGIN_DXA}" w:left="${DEFAULT_MARGIN_DXA}"/></w:sectPr>` +
  "</w:body></w:document>"
);
