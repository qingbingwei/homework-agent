from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from app.document_parser import ParsedDocument, parse_upload
from app.llm_client import LLMClient
from app.models import ReportResponse
from app.template_engine import build_report_bundle


@dataclass(frozen=True)
class ReportArtifacts:
    assignment: ParsedDocument
    template: ParsedDocument
    report_markdown: str


class ReportService:
    def __init__(self, llm_client: LLMClient) -> None:
        self._llm_client = llm_client

    async def generate(self, assignment_file: UploadFile, template_file: UploadFile, model_name: str) -> ReportResponse:
        assignment = await parse_upload(assignment_file)
        template = await parse_upload(template_file)
        report_markdown = await self._llm_client.generate_report_markdown(assignment.text, template.text)
        report_title = derive_report_title(report_markdown, assignment.filename)
        rendered = build_report_bundle(template, report_markdown, report_title)
        file_stem = Path(assignment.filename).stem or "report"
        return ReportResponse(
            file_name=f"{file_stem}-report.docx",
            markdown_content=rendered.markdown_content,
            docx_base64=base64.b64encode(rendered.docx_bytes).decode("utf-8"),
            template_strategy=rendered.template_strategy,
            model=model_name,
        )


def derive_report_title(report_markdown: str, fallback_filename: str) -> str:
    for line in report_markdown.splitlines():
        if line.startswith("#"):
            return line.lstrip("# ").strip()
    return f"{Path(fallback_filename).stem} 实验报告"

