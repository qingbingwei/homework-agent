from __future__ import annotations

import httpx

from app.llm_client import build_http_error_message, extract_error_detail, normalize_content


def test_normalize_content_supports_text_list() -> None:
    content = [{"type": "text", "text": "第一行"}, {"type": "text", "text": "第二行"}]
    assert normalize_content(content) == "第一行\n第二行"


def test_extract_error_detail_prefers_error_message() -> None:
    payload = {"error": {"message": "额度不足", "code": "insufficient_quota"}}
    assert extract_error_detail(payload) == "额度不足"


def test_build_http_error_message_uses_provider_detail() -> None:
    request = httpx.Request("POST", "https://example.com")
    response = httpx.Response(403, request=request, json={"error": {"message": "额度不足"}})
    assert build_http_error_message(response) == "LLM request failed (403): 额度不足"
