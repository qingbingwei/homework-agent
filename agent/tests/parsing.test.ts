import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseUpload } from "../src/parsing/index.js";

const buildMinimalDocx = async (paragraphs: string[]): Promise<Buffer> => {
  const zip = new JSZip();
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space=\"preserve\">${text}</w:t></w:r></w:p>`)
    .join("");
  const documentXml = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>${body}</w:body></w:document>`;
  zip.file("word/document.xml", documentXml);
  return await zip.generateAsync({ type: "nodebuffer" });
};

describe("parseUpload", () => {
  it("reads markdown content", async () => {
    const parsed = await parseUpload("homework.md", Buffer.from("# Assignment\n\nSolve it.", "utf8"));
    expect(parsed.kind).toBe(".md");
    expect(parsed.text).toContain("Solve it.");
  });

  it("parses docx paragraphs into newline-joined text", async () => {
    const docx = await buildMinimalDocx(["Hello", "World"]);
    const parsed = await parseUpload("demo.docx", docx);
    expect(parsed.text.split("\n")).toEqual(["Hello", "World"]);
  });

  it("rejects unsupported suffixes with AgentError", async () => {
    await expect(parseUpload("note.txt", Buffer.from("anything"))).rejects.toMatchObject({
      code: "unsupported_file_type",
      stage: "ingest",
    });
  });
});
