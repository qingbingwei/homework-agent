import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  BODY_PLACEHOLDER,
  TITLE_PLACEHOLDER,
  applyMarkdownTemplate,
  buildReportBundle,
  injectIntoDocxTemplate,
  paragraphsToXml,
} from "../src/templates/index.js";
import type { ParsedDocument } from "../src/parsing/index.js";

const buildTemplateDocx = async (): Promise<Buffer> => {
  const zip = new JSZip();
  const body = `<w:p><w:r><w:t xml:space=\"preserve\">${TITLE_PLACEHOLDER}</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t xml:space=\"preserve\">${BODY_PLACEHOLDER}</w:t></w:r></w:p>`;
  zip.file(
    "word/document.xml",
    `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>${body}</w:body></w:document>`,
  );
  return await zip.generateAsync({ type: "nodebuffer" });
};

const buildBlankDocxTemplate = async (): Promise<Buffer> => {
  const zip = new JSZip();
  const body = `<w:p><w:r><w:t xml:space=\"preserve\">Template heading</w:t></w:r></w:p>` +
    "<w:p></w:p>" +
    `<w:p><w:pPr><w:sectPr /></w:pPr></w:p>`;
  zip.file(
    "word/document.xml",
    `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>${body}</w:body></w:document>`,
  );
  zip.file("customXml/item1.xml", "<kept />");
  return await zip.generateAsync({ type: "nodebuffer" });
};

describe("applyMarkdownTemplate", () => {
  it("substitutes placeholders in markdown template", () => {
    const template = `# ${TITLE_PLACEHOLDER}\n\n${BODY_PLACEHOLDER}`;
    const result = applyMarkdownTemplate(template, "content", "My Title");
    expect(result).toBe("# My Title\n\ncontent");
  });

  it("falls back to raw markdown when no placeholders exist", () => {
    expect(applyMarkdownTemplate("plain", "report", "ignored")).toBe("report");
  });
});

describe("paragraphsToXml", () => {
  it("converts markdown lines into w:p fragments", () => {
    const xml = paragraphsToXml("# Title\n- bullet\ncontent");
    expect(xml).toContain("Title");
    expect(xml).toContain("bullet");
    expect(xml).toContain("content");
    expect(xml.split("<w:p>")).toHaveLength(4); // 3 paragraphs + leading empty string
  });
});

describe("injectIntoDocxTemplate", () => {
  it("returns a docx buffer with placeholders replaced", async () => {
    const template = await buildTemplateDocx();
    const result = await injectIntoDocxTemplate(template, "Final Title", "Body line");
    expect(result).toBeInstanceOf(Buffer);
    const zip = await JSZip.loadAsync(result!);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Final Title");
    expect(xml).toContain("Body line");
    expect(xml).not.toContain(TITLE_PLACEHOLDER);
    expect(xml).not.toContain(BODY_PLACEHOLDER);
  });
});

describe("buildReportBundle", () => {
  it("preserves uploaded docx package structure instead of rebuilding with pandoc", async () => {
    const rawBytes = await buildBlankDocxTemplate();
    const template: ParsedDocument = {
      filename: "template.docx",
      kind: ".docx",
      text: "Template heading",
      rawBytes,
    };

    const result = await buildReportBundle(template, "# Generated Title\n\nGenerated body", "Generated Title");

    expect(result.templateStrategy).toBe("docx-template-preserved");
    const zip = await JSZip.loadAsync(result.docxBytes);
    expect(await zip.file("customXml/item1.xml")!.async("string")).toBe("<kept />");
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Template heading");
    expect(xml).toContain("Generated Title");
    expect(xml).toContain("Generated body");
  });
});
