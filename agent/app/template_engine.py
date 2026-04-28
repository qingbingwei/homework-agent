from __future__ import annotations

import html
import re
import subprocess
import tempfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from app.document_parser import ParsedDocument

TITLE_PLACEHOLDER = "{{REPORT_TITLE}}"
BODY_PLACEHOLDER = "{{REPORT_BODY}}"


@dataclass(frozen=True)
class RenderedReport:
    markdown_content: str
    docx_bytes: bytes
    template_strategy: str


def build_report_bundle(template_doc: ParsedDocument, report_markdown: str, title: str) -> RenderedReport:
    markdown_content = apply_markdown_template(template_doc.text, report_markdown, title)
    docx_bytes, strategy = build_docx_output(template_doc, markdown_content, title)
    return RenderedReport(markdown_content=markdown_content, docx_bytes=docx_bytes, template_strategy=strategy)


def apply_markdown_template(template_text: str, report_markdown: str, title: str) -> str:
    if TITLE_PLACEHOLDER in template_text or BODY_PLACEHOLDER in template_text:
        return template_text.replace(TITLE_PLACEHOLDER, title).replace(BODY_PLACEHOLDER, report_markdown)
    return report_markdown.strip()


def build_docx_output(template_doc: ParsedDocument, markdown_content: str, title: str) -> tuple[bytes, str]:
    if template_doc.suffix == ".docx":
        injected = inject_into_docx_template(template_doc.raw_bytes, title, markdown_content)
        if injected is not None:
            return injected, "docx-xml-placeholder"
        return markdown_to_docx(markdown_content, template_doc.raw_bytes), "reference-docx"
    return markdown_to_docx(markdown_content, None), "pandoc-generated"


def inject_into_docx_template(template_bytes: bytes, title: str, markdown_content: str) -> bytes | None:
    with ZipFile(BytesIO(template_bytes)) as archive:
        document_xml = archive.read("word/document.xml").decode("utf-8")
        if TITLE_PLACEHOLDER not in document_xml and BODY_PLACEHOLDER not in document_xml:
            return None

        updated_xml = document_xml.replace(TITLE_PLACEHOLDER, html.escape(title))
        updated_xml = replace_body_placeholder(updated_xml, markdown_content)

        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as target:
            for name in archive.namelist():
                payload = updated_xml.encode("utf-8") if name == "word/document.xml" else archive.read(name)
                target.writestr(name, payload)
    return output.getvalue()


def paragraphs_to_xml(markdown_content: str) -> str:
    xml_paragraphs = []
    for raw_line in markdown_content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        cleaned = line.lstrip("#- ")
        xml_paragraphs.append(
            "<w:p><w:r><w:t xml:space=\"preserve\">"
            f"{html.escape(cleaned)}"
            "</w:t></w:r></w:p>"
        )
    return "".join(xml_paragraphs)


def replace_body_placeholder(document_xml: str, markdown_content: str) -> str:
    paragraph_xml = paragraphs_to_xml(markdown_content)
    pattern = re.compile(r"<w:p[\\s\\S]*?" + re.escape(BODY_PLACEHOLDER) + r"[\\s\\S]*?</w:p>")
    updated_xml, count = pattern.subn(paragraph_xml, document_xml, count=1)
    if count == 0:
        return document_xml.replace(BODY_PLACEHOLDER, html.escape(markdown_content))
    return updated_xml


def markdown_to_docx(markdown_content: str, reference_docx: bytes | None) -> bytes:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        markdown_path = temp_path / "report.md"
        output_path = temp_path / "report.docx"
        markdown_path.write_text(markdown_content, encoding="utf-8")

        command = ["pandoc", str(markdown_path), "-o", str(output_path)]
        if reference_docx is not None:
            reference_path = temp_path / "reference.docx"
            reference_path.write_bytes(reference_docx)
            command.extend(["--reference-doc", str(reference_path)])

        completed = subprocess.run(command, check=True, capture_output=True, text=True)
        if completed.stderr:
            completed.stderr.strip()
        return output_path.read_bytes()
