import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export interface DeepAgentFileData {
  content: string[];
  created_at: string;
  modified_at: string;
}

export type DeepAgentFiles = Record<string, DeepAgentFileData>;

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILL_SOURCE = join(findAgentRoot(MODULE_DIR), "skills", "docx");
const FILE_ENCODING = "utf8";

export const buildDocxSkillFiles = async (): Promise<DeepAgentFiles> => {
  const skillRoot = DEFAULT_SKILL_SOURCE;
  const files = await readSkillFiles(skillRoot, skillRoot);
  return files;
};

const readSkillFiles = async (rootDir: string, currentDir: string): Promise<DeepAgentFiles> => {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const merged: DeepAgentFiles = {};
  for (const entry of entries) {
    const absolute = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(merged, await readSkillFiles(rootDir, absolute));
      continue;
    }
    const key = toSkillPath(rootDir, absolute);
    merged[key] = await readFileData(absolute);
  }
  return merged;
};

const readFileData = async (absolutePath: string): Promise<DeepAgentFileData> => {
  const [content, fileStat] = await Promise.all([
    readFile(absolutePath, FILE_ENCODING),
    stat(absolutePath),
  ]);
  return {
    content: content.split(/\r?\n/),
    created_at: fileStat.birthtime.toISOString(),
    modified_at: fileStat.mtime.toISOString(),
  };
};

const toSkillPath = (rootDir: string, absolutePath: string): string => {
  const rel = relative(rootDir, absolutePath).split(sep).join("/");
  return `/skills/docx/${rel}`;
};

function findAgentRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(current, "skills", "docx", "SKILL.md"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return join(startDir, "..", "..");
}
