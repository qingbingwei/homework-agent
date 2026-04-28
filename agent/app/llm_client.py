from __future__ import annotations

import json

import httpx

from app.config import Settings


class LLMClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def generate_report_markdown(self, assignment_text: str, template_text: str) -> str:
        if not self._settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY is not configured")

        prompt = self._build_prompt(assignment_text, template_text)
        request_body = {
            "model": self._settings.llm_model,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a senior lab-report agent. Fully solve the assignment, "
                        "preserve the template structure, and output only Markdown."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        }
        headers = {"Authorization": f"Bearer {self._settings.llm_api_key}"}
        async with httpx.AsyncClient(timeout=self._settings.request_timeout_seconds) as client:
            response = await client.post(f"{self._settings.llm_base_url}/chat/completions", headers=headers, json=request_body)
        if response.is_error:
            raise RuntimeError(build_http_error_message(response))
        payload = response.json()
        message = payload["choices"][0]["message"]["content"]
        return normalize_content(message)

    def _build_prompt(self, assignment_text: str, template_text: str) -> str:
        prompt_payload = {
            "requirements": [
                "Solve every assignment question completely and include reasoning, implementation, and results.",
                "Use the experiment template as the structural guide for sections and terminology.",
                "Return only valid Markdown without code fences around the entire response.",
                "If the assignment asks for code, include runnable code blocks and concise explanations.",
            ],
            "template": template_text,
            "assignment": assignment_text,
        }
        return json.dumps(prompt_payload, ensure_ascii=False)


def normalize_content(content: object) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        pieces = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                pieces.append(item.get("text", ""))
        return "\n".join(pieces).strip()
    raise RuntimeError("unsupported LLM content format")


def build_http_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None
    detail = extract_error_detail(payload)
    if detail:
        return f"LLM request failed ({response.status_code}): {detail}"
    return f"LLM request failed ({response.status_code}): {response.text.strip()}"


def extract_error_detail(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        if isinstance(message, str):
            return message
    detail = payload.get("detail")
    if isinstance(detail, str):
        return detail
    return ""
