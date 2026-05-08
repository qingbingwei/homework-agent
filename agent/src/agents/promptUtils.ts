import type { ParsedDocument } from "../parsing/index.js";

export const templateSummary = (
  template: ParsedDocument | null,
  fallback: string,
): string => {
  if (!template) return fallback;
  return `Template (${template.kind}):\n---\n${template.text}\n---`;
};
