import JSZip from "jszip";
import pdfParse from "pdf-parse";
import { extname } from "node:path";
import { AgentError } from "../http/errors.js";

export type DocumentKind = ".docx" | ".pdf" | ".md";

export interface ParsedDocument {
  filename: string;
  kind: DocumentKind;
  text: string;
  rawBytes: Buffer;
}

export const SUPPORTED_SUFFIXES: readonly DocumentKind[] = [".docx", ".pdf", ".md"];

export const parseUpload = async (filename: string, rawBytes: Buffer): Promise<ParsedDocument> => {
  const suffix = extname(filename).toLowerCase() as DocumentKind;
  if (!SUPPORTED_SUFFIXES.includes(suffix)) {
    throw new AgentError({
      code: "unsupported_file_type",
      message: `unsupported file type: ${suffix || "<none>"}`,
      stage: "ingest",
      statusCode: 400,
    });
  }

  const text = await extractText(suffix, rawBytes);
  return {
    filename: filename || "document",
    kind: suffix,
    rawBytes,
    text: text.trim(),
  };
};

const extractText = async (suffix: DocumentKind, rawBytes: Buffer): Promise<string> => {
  if (suffix === ".md") {
    return rawBytes.toString("utf8");
  }
  if (suffix === ".pdf") {
    const parsed = await pdfParse(rawBytes);
    return parsed.text;
  }
  return extractDocxText(rawBytes);
};

export const extractDocxText = async (rawBytes: Buffer): Promise<string> => {
  const zip = await JSZip.loadAsync(rawBytes);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new AgentError({
      code: "invalid_docx",
      message: "docx missing word/document.xml",
      stage: "ingest",
      statusCode: 400,
    });
  }
  const xml = await documentFile.async("string");
  return extractTextFromDocumentXml(xml);
};

export const extractTextFromDocumentXml = (xml: string): string => {
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let paragraphMatch: RegExpExecArray | null;
  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = paragraphMatch[1] ?? "";
    const pieces: string[] = [];
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
      pieces.push(decodeXmlEntities(textMatch[1] ?? ""));
    }
    const joined = pieces.join("").trim();
    if (joined) paragraphs.push(joined);
  }
  return paragraphs.join("\n");
};

const xmlEntities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decodeXmlEntities = (value: string): string =>
  value.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (match, group: string) => {
    if (match.startsWith("&#")) {
      const code = Number(group.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return xmlEntities[match] ?? match;
  });
