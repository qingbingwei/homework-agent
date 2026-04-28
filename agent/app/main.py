from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile

from app.config import load_settings
from app.llm_client import LLMClient
from app.models import ReportResponse
from app.report_service import ReportService

settings = load_settings()
service = ReportService(LLMClient(settings))
app = FastAPI(title="Homework Agent Service")


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "model": settings.llm_model,
        "agent_key_configured": bool(settings.llm_api_key),
        "base_url": settings.llm_base_url,
    }


@app.post("/generate-report", response_model=ReportResponse)
async def generate_report(
    assignment: UploadFile = File(...),
    template: UploadFile = File(...),
) -> ReportResponse:
    try:
        return await service.generate(assignment, template, settings.llm_model)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

