import { writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { isolatedWorkspaceEnv } from "../workspaceUtils.js";

export const installPythonVirtualPathRuntime = async (rootDir: string): Promise<void> => {
  await writeFile(join(rootDir, "sitecustomize.py"), pythonVirtualPathRuntimeSource(rootDir), "utf8");
};

export const pythonVirtualPathEnv = (rootDir: string): NodeJS.ProcessEnv => {
  const base = isolatedWorkspaceEnv(rootDir);
  const existing = process.env.PYTHONPATH;
  return {
    ...base,
    PYTHONPATH: existing ? `${rootDir}${delimiter}${existing}` : rootDir,
  };
};

export const pythonVirtualPathRuntimeSource = (rootDir: string): string => (
  [
    "import builtins",
    "import io",
    "import os",
    "",
    "_PATH_MAP = {",
    `    "/workspace": ${JSON.stringify(join(rootDir, "workspace"))},`,
    `    "/skills": ${JSON.stringify(join(rootDir, "skills"))},`,
    "}",
    "",
    "def _is_path(value):",
    "    return isinstance(value, (str, bytes, os.PathLike))",
    "",
    "def _map_path(path):",
    "    if not _is_path(path):",
    "        return path",
    "    original = os.fspath(path)",
    "    is_bytes = isinstance(original, bytes)",
    "    text = os.fsdecode(original) if is_bytes else original",
    "    for virtual, real in _PATH_MAP.items():",
    "        if text == virtual or text.startswith(virtual + '/'):",
    "            mapped = real + text[len(virtual):]",
    "            return os.fsencode(mapped) if is_bytes else mapped",
    "    return path",
    "",
    "def _wrap_path_arg(fn):",
    "    def wrapped(path, *args, **kwargs):",
    "        if args and not _is_path(path) and _is_path(args[0]):",
    "            return fn(_map_path(args[0]), *args[1:], **kwargs)",
    "        return fn(_map_path(path), *args, **kwargs)",
    "    return wrapped",
    "",
    "builtins.open = _wrap_path_arg(builtins.open)",
    "io.open = _wrap_path_arg(io.open)",
    "for _name in ('stat', 'lstat', 'listdir', 'scandir', 'remove', 'unlink', 'mkdir', 'makedirs', 'rename', 'replace', 'chdir'):",
    "    if hasattr(os, _name):",
    "        setattr(os, _name, _wrap_path_arg(getattr(os, _name)))",
    "",
  ].join("\n")
);
