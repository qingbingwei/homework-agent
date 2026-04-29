from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

SUPPORTED_SUFFIXES = {".docx", ".md", ".pdf"}


@dataclass(frozen=True)
class ParsedDocument:
    filename: str
    suffix: str
    text: str
    raw_bytes: bytes


async def parse_upload(upload: UploadFile) -> ParsedDocument:
    raw_bytes = await upload.read()
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"unsupported file type: {suffix}")

    if suffix == ".md":
        text = raw_bytes.decode("utf-8", errors="ignore")
    elif suffix == ".pdf":
        text = extract_pdf_text(raw_bytes)
    else:
        text = extract_docx_text(raw_bytes)
    return ParsedDocument(filename=upload.filename or "document", suffix=suffix, text=text.strip(), raw_bytes=raw_bytes)


def extract_pdf_text(raw_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def extract_docx_text(raw_bytes: bytes) -> str:
    with ZipFile(BytesIO(raw_bytes)) as archive:
        xml_payload = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml_payload)
    lines: list[str] = []
    for paragraph in root.iterfind(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        fragments = [node.text or "" for node in paragraph.iterfind(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")]
        paragraph_text = "".join(fragments).strip()
        if paragraph_text:
            lines.append(paragraph_text)
    return "\n".join(lines)

