import { realpathSync } from "node:fs";
import { join } from "node:path";

const VIRTUAL_ROOTS = [
  { path: "/workspace", segment: "workspace" },
  { path: "/skills", segment: "skills" },
] as const;

const ROOT_RECURSIVE_SCAN_ERROR =
  "Refusing root-wide recursive filesystem scan. Writer files are under /workspace and /skills; use those paths or relative workspace paths.";

const ROOT_RECURSIVE_SCAN_PATTERNS = [
  /\bglob\.glob\(\s*["']\/\*\*/s,
  /\bPath\(\s*["']\/["']\s*\)\.rglob\(/s,
  /\bos\.walk\(\s*["']\/["']\s*\)/s,
  /(?:^|[;&|]\s*)find\s+\/(?:\s|$)/s,
] as const;

export const rewriteVirtualPaths = (rootDir: string, command: string): string => {
  let rewritten = "";
  let quote: string | null = null;
  let escaped = false;
  for (let index = 0; index < command.length;) {
    const replacement = virtualRootReplacement(rootDir, command, index, quote !== null);
    if (replacement) {
      rewritten += replacement.text;
      index += replacement.length;
      continue;
    }
    const char = command[index] ?? "";
    rewritten += char;
    const state = nextQuoteState({ quote, escaped, char });
    quote = state.quote;
    escaped = state.escaped;
    index += 1;
  }
  return rewritten;
};

export const normalizeVirtualPathOutput = (rootDir: string, output: string): string => {
  let normalized = output;
  for (const mapping of outputPathMappings(rootDir)) {
    normalized = replacePathPrefix(normalized, mapping.real, mapping.virtual);
  }
  return normalized;
};

export const rootRecursiveScanError = (command: string): string | null => (
  ROOT_RECURSIVE_SCAN_PATTERNS.some((pattern) => pattern.test(command))
    ? ROOT_RECURSIVE_SCAN_ERROR
    : null
);

const virtualRootReplacement = (
  rootDir: string,
  command: string,
  index: number,
  quoted: boolean,
): { text: string; length: number } | null => {
  const root = VIRTUAL_ROOTS.find((item) => command.startsWith(item.path, index));
  if (!root || !isVirtualPathBoundary(command[index + root.path.length])) return null;
  const realPath = join(rootDir, root.segment);
  return { text: quoted ? realPath : shellQuote(realPath), length: root.path.length };
};

const outputPathMappings = (rootDir: string): Array<{ real: string; virtual: string }> => {
  const roots = rootDirAliases(rootDir);
  const mappings = roots.flatMap((root) => [
    ...VIRTUAL_ROOTS.map((item) => ({
      real: join(root, item.segment),
      virtual: item.path,
    })),
    { real: root, virtual: "/workspace-root" },
  ]);
  return mappings.sort((left, right) => right.real.length - left.real.length);
};

const rootDirAliases = (rootDir: string): string[] => {
  const roots = new Set([rootDir, realpathSync(rootDir)]);
  for (const root of [...roots]) {
    if (root.startsWith("/private/")) roots.add(`/System/Volumes/Data${root}`);
  }
  return [...roots];
};

const replacePathPrefix = (value: string, realPath: string, virtualPath: string): string => (
  value.replace(new RegExp(`${escapeRegExp(realPath)}(?=$|[\\s"'\\),:;\\]\\}/])`, "g"), virtualPath)
);

const isVirtualPathBoundary = (char: string | undefined): boolean => (
  char === undefined || char === "/" || /\s|["'`;|&)]/.test(char)
);

const nextQuoteState = (state: { quote: string | null; escaped: boolean; char: string }) => {
  if (state.escaped) return { quote: state.quote, escaped: false };
  if (state.char === "\\" && state.quote !== "'") return { quote: state.quote, escaped: true };
  if (state.char !== "'" && state.char !== "\"") return { quote: state.quote, escaped: false };
  if (state.quote === null) return { quote: state.char, escaped: false };
  return { quote: state.quote === state.char ? null : state.quote, escaped: false };
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
