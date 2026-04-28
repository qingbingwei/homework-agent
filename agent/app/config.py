from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    llm_base_url: str
    llm_api_key: str
    llm_model: str
    request_timeout_seconds: int


def load_settings() -> Settings:
    timeout_value = os.getenv("LLM_TIMEOUT_SECONDS", "180")
    return Settings(
        llm_base_url=os.getenv("LLM_BASE_URL", "https://api.asxs.top/v1"),
        llm_api_key=os.getenv("LLM_API_KEY", ""),
        llm_model=os.getenv("LLM_MODEL", "gpt-5.5"),
        request_timeout_seconds=int(timeout_value),
    )

