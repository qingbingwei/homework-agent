import JSZip from "jszip";
import { execa } from "execa";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentError } from "../http/errors.js";
import type { ParsedDocument } from "../parsing/index.js";
import { decodeXmlEntities, escapeXml } from "../utils/xml.js";

export const TITLE_PLACEHOLDER = "{{REPORT_TITLE}}";
export const BODY_PLACEHOLDER = "{{REPORT_BODY}}";
const DOCX_RENDER_TMP_ROOT = join(tmpdir(), "homework-agent-docx-render");

process.once("exit", () => {
  rmSync(DOCX_RENDER_TMP_ROOT, { recursive: true, force: true });
});

export type TemplateStrategy = "docx-template-preserved" | "pandoc-generated";

export interface RenderedReport {
  markdownContent: string;
  docxBytes: Buffer;
  templateStrategy: TemplateStrategy;
}

export const buildReportBundle = async (
  template: ParsedDocument | null,
  reportMarkdown: string,
  title: string,
): Promise<RenderedReport> => {
  const markdownContent = buildMarkdownContent(template, reportMarkdown, title);
  if (template?.kind === ".docx") {
    // Preserve the uploaded Word package; only edit document.xml content in place.
    const docxBytes = await injectIntoDocxTemplate(template.rawBytes, title, markdownContent);
    if (!docxBytes) throw invalidDocxTemplate("docx missing word/document.xml");
    return { markdownContent, docxBytes, templateStrategy: "docx-template-preserved" };
  }
  return {
    markdownContent,
    docxBytes: await markdownToDocx(markdownContent, null),
    templateStrategy: "pandoc-generated",
  };
};

export const cleanupStaleDocxRenderWorkdirs = async (): Promise<void> => {
  await rm(DOCX_RENDER_TMP_ROOT, { recursive: true, force: true });
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

const buildMarkdownContent = (
  template: ParsedDocument | null,
  reportMarkdown: string,
  title: string,
): string => {
  if (!template || template.kind === ".docx") return reportMarkdown.trim();
  return applyMarkdownTemplate(template.text, reportMarkdown, title);
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
  const finalXml = fillDocxDocumentXml(xml, title, markdownContent);
  zip.file("word/document.xml", finalXml);
  return await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
};

export const paragraphsToXml = (markdownContent: string): string => {
  return markdownToTextLines(markdownContent).map(textLineToParagraphXml).join("");
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

const fillDocxDocumentXml = (
  documentXml: string,
  title: string,
  markdownContent: string,
): string => {
  if (!documentXml.includes("</w:body>")) throw invalidDocxTemplate("docx missing w:body");
  const titleApplied = documentXml.split(TITLE_PLACEHOLDER).join(escapeXml(title));
  if (titleApplied.includes(BODY_PLACEHOLDER)) return replaceBodyPlaceholder(titleApplied, markdownContent);
  return fillBlankParagraphs(titleApplied, markdownContent);
};

const fillBlankParagraphs = (documentXml: string, markdownContent: string): string => {
  const lines = markdownToTextLines(markdownContent);
  let lineIndex = 0;
  const filledXml = documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (lineIndex >= lines.length || extractParagraphText(paragraph).trim()) return paragraph;
    const nextLine = lines[lineIndex] ?? "";
    lineIndex += 1;
    return insertTextIntoParagraph(paragraph, nextLine);
  });
  const leftovers = lines.slice(lineIndex).map(textLineToParagraphXml).join("");
  return leftovers ? insertBeforeSectionProperties(filledXml, leftovers) : filledXml;
};

const insertTextIntoParagraph = (paragraphXml: string, text: string): string => {
  const run = `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  return paragraphXml.replace(/<\/w:p>\s*$/, `${run}</w:p>`);
};

const insertBeforeSectionProperties = (documentXml: string, paragraphXml: string): string => {
  const sectionPattern = /(<w:sectPr\b[\s\S]*?(?:<\/w:sectPr>|\/>)\s*<\/w:body>)/;
  if (sectionPattern.test(documentXml)) return documentXml.replace(sectionPattern, `${paragraphXml}$1`);
  return documentXml.replace("</w:body>", `${paragraphXml}</w:body>`);
};

const extractParagraphText = (paragraphXml: string): string => {
  const pieces: string[] = [];
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = textRegex.exec(paragraphXml)) !== null) {
    pieces.push(decodeXmlEntities(match[1] ?? ""));
  }
  return pieces.join("");
};

const markdownToTextLines = (markdownContent: string): string[] => {
  const lines: string[] = [];
  let inCodeBlock = false;
  for (const rawLine of markdownContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && !trimmed) continue;
    const cleaned = inCodeBlock ? rawLine : cleanMarkdownLine(trimmed);
    if (cleaned.trim()) lines.push(cleaned);
  }
  return lines;
};

const cleanMarkdownLine = (line: string): string => (
  line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
);

const textLineToParagraphXml = (line: string): string => (
  `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
);

export const markdownToDocx = async (
  markdownContent: string,
  referenceDocx: Buffer | null,
): Promise<Buffer> => {
  const workingDir = await createDocxRenderWorkdir();
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

const createDocxRenderWorkdir = async (): Promise<string> => {
  await mkdir(DOCX_RENDER_TMP_ROOT, { recursive: true });
  return await mkdtemp(join(DOCX_RENDER_TMP_ROOT, "render-"));
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const invalidDocxTemplate = (message: string): AgentError => new AgentError({
  code: "invalid_docx_template",
  message,
  stage: "write",
  statusCode: 400,
});
