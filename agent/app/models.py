from __future__ import annotations

from pydantic import BaseModel


class ReportResponse(BaseModel):
    file_name: str
    markdown_content: str
    docx_base64: str
    template_strategy: str
    model: str

