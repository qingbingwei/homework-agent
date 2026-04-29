from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.config import load_settings
from app.llm_client import LLMClient
from app.models import AgentErrorResponse, ReportResponse
from app.report_service import ReportService

settings = load_settings()
service = ReportService(LLMClient(settings))
app = FastAPI(title="Homework Agent Service")
logger = logging.getLogger(__name__)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid4().hex[:12]
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except HTTPException as exc:
        response = await http_exception_handler(request, exc)
    except Exception as exc:
        response = await unhandled_exception_handler(request, exc)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = get_request_id(request)
    payload = AgentErrorResponse(
        code="agent_http_error",
        message=extract_detail(exc),
        request_id=request_id,
        stage="request_handling",
    )
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump(), headers={"X-Request-ID": request_id})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = get_request_id(request)
    logger.exception("generate-report failed request_id=%s", request_id)
    payload = AgentErrorResponse(
        code="internal_agent_error",
        message=describe_exception(exc),
        request_id=request_id,
        stage="generate_report",
    )
    return JSONResponse(status_code=500, content=payload.model_dump(), headers={"X-Request-ID": request_id})


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
    return await service.generate(assignment, template, settings.llm_model)


def describe_exception(exc: Exception) -> str:
    message = str(exc).strip()
    if message:
        return message
    return f"{exc.__class__.__name__}: no error message"


def extract_detail(exc: HTTPException) -> str:
    if isinstance(exc.detail, str) and exc.detail.strip():
        return exc.detail
    return "HTTPException without detail"


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", uuid4().hex[:12])
