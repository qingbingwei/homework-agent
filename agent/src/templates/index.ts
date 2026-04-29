import JSZip from "jszip";
import { execa } from "execa";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentError } from "../http/errors.js";
import type { ParsedDocument } from "../parsing/index.js";

export const TITLE_PLACEHOLDER = "{{REPORT_TITLE}}";
export const BODY_PLACEHOLDER = "{{REPORT_BODY}}";

export type TemplateStrategy = "docx-xml-placeholder" | "reference-docx" | "pandoc-generated";

export interface RenderedReport {
  markdownContent: string;
  docxBytes: Buffer;
  templateStrategy: TemplateStrategy;
}

export const buildReportBundle = async (
  template: ParsedDocument,
  reportMarkdown: string,
  title: string,
): Promise<RenderedReport> => {
  const markdownContent = applyMarkdownTemplate(template.text, reportMarkdown, title);
  const { bytes, strategy } = await buildDocxOutput(template, markdownContent, title);
  return { markdownContent, docxBytes: bytes, templateStrategy: strategy };
};

export const applyMarkdownTemplate = (
  templateText: string,
  reportMarkdown: string,
  title: string,
): string => {
  if (templateText.includes(TITLE_PLACEHOLDER) || templateText.includes(BODY_PLACEHOLDER)) {
    return templateText
      .split(TITLE_PLACEHOLDER)
      .join(title)
      .split(BODY_PLACEHOLDER)
      .join(reportMarkdown);
  }
  return reportMarkdown.trim();
};

const buildDocxOutput = async (
  template: ParsedDocument,
  markdownContent: string,
  title: string,
): Promise<{ bytes: Buffer; strategy: TemplateStrategy }> => {
  if (template.kind === ".docx") {
    const injected = await injectIntoDocxTemplate(template.rawBytes, title, markdownContent);
    if (injected) {
      return { bytes: injected, strategy: "docx-xml-placeholder" };
    }
    const bytes = await markdownToDocx(markdownContent, template.rawBytes);
    return { bytes, strategy: "reference-docx" };
  }
  const bytes = await markdownToDocx(markdownContent, null);
  return { bytes, strategy: "pandoc-generated" };
};

export const injectIntoDocxTemplate = async (
  templateBytes: Buffer,
  title: string,
  markdownContent: string,
): Promise<Buffer | null> => {
  const zip = await JSZip.loadAsync(templateBytes);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) return null;
  const xml = await documentEntry.async("string");
  if (!xml.includes(TITLE_PLACEHOLDER) && !xml.includes(BODY_PLACEHOLDER)) {
    return null;
  }
  const titleApplied = xml.split(TITLE_PLACEHOLDER).join(escapeXml(title));
  const finalXml = replaceBodyPlaceholder(titleApplied, markdownContent);
  zip.file("word/document.xml", finalXml);
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
};

export const paragraphsToXml = (markdownContent: string): string => {
  const fragments: string[] = [];
  for (const rawLine of markdownContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/^[#\-\s]+/, "");
    if (!cleaned) continue;
    fragments.push(
      `<w:p><w:r><w:t xml:space="preserve">${escapeXml(cleaned)}</w:t></w:r></w:p>`,
    );
  }
  return fragments.join("");
};

export const replaceBodyPlaceholder = (documentXml: string, markdownContent: string): string => {
  const paragraphXml = paragraphsToXml(markdownContent);
  const pattern = new RegExp(
    `<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?${escapeRegex(BODY_PLACEHOLDER)}(?:(?!</w:p>)[\\s\\S])*?</w:p>`,
  );
  if (pattern.test(documentXml)) {
    return documentXml.replace(pattern, paragraphXml);
  }
  return documentXml.split(BODY_PLACEHOLDER).join(escapeXml(markdownContent));
};

export const markdownToDocx = async (
  markdownContent: string,
  referenceDocx: Buffer | null,
): Promise<Buffer> => {
  const workingDir = await mkdtemp(join(tmpdir(), "homework-agent-template-"));
  try {
    const markdownPath = join(workingDir, "report.md");
    const outputPath = join(workingDir, "report.docx");
    await writeFile(markdownPath, markdownContent, "utf8");
    const args = [markdownPath, "-o", outputPath];
    if (referenceDocx) {
      const referencePath = join(workingDir, "reference.docx");
      await writeFile(referencePath, referenceDocx);
      args.push("--reference-doc", referencePath);
    }
    try {
      await execa("pandoc", args, { stdio: "pipe" });
    } catch (err) {
      throw new AgentError({
        code: "pandoc_failed",
        message: `pandoc failed: ${(err as Error).message}`,
        stage: "write",
        statusCode: 500,
        cause: err,
      });
    }
    return await readFile(outputPath);
  } finally {
    await rm(workingDir, { recursive: true, force: true });
  }
};

const escapeXml = (value: string): string =>
  value
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
    .split('"')
    .join("&quot;")
    .split("'")
    .join("&apos;");

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
