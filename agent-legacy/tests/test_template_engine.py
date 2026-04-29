from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from app.template_engine import BODY_PLACEHOLDER, TITLE_PLACEHOLDER, apply_markdown_template, inject_into_docx_template


def test_apply_markdown_template_replaces_placeholders() -> None:
    template_text = f"# {TITLE_PLACEHOLDER}\n\n{BODY_PLACEHOLDER}"
    rendered = apply_markdown_template(template_text, "## Body", "实验一")
    assert rendered == "# 实验一\n\n## Body"


def test_inject_into_docx_template_updates_document_xml() -> None:
    document_xml = (
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        f"<w:body><w:p><w:r><w:t>{TITLE_PLACEHOLDER}</w:t></w:r></w:p>"
        f"<w:p><w:r><w:t>{BODY_PLACEHOLDER}</w:t></w:r></w:p></w:body></w:document>"
    )
    template_bytes = build_docx(document_xml)
    rendered = inject_into_docx_template(template_bytes, "实验报告", "# 标题\n正文")
    assert rendered is not None

    with ZipFile(BytesIO(rendered)) as archive:
        updated_xml = archive.read("word/document.xml").decode("utf-8")
    assert TITLE_PLACEHOLDER not in updated_xml
    assert BODY_PLACEHOLDER not in updated_xml
    assert "实验报告" in updated_xml
    assert "正文" in updated_xml


def build_docx(document_xml: str) -> bytes:
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types></Types>")
        archive.writestr("word/document.xml", document_xml)
    return buffer.getvalue()
