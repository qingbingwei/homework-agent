from __future__ import annotations

from fastapi.testclient import TestClient

from app import main
from app.main import describe_exception


def test_describe_exception_returns_message() -> None:
    assert describe_exception(RuntimeError("boom")) == "boom"


def test_describe_exception_falls_back_to_exception_name() -> None:
    class SilentError(Exception):
        def __str__(self) -> str:
            return ""

    assert describe_exception(SilentError()) == "SilentError: no error message"


def test_unhandled_exception_returns_structured_error(monkeypatch) -> None:
    class SilentError(Exception):
        def __str__(self) -> str:
            return ""

    async def fake_generate(*_args, **_kwargs):
        raise SilentError()

    monkeypatch.setattr(main.service, "generate", fake_generate)
    client = TestClient(main.app)
    response = client.post(
        "/generate-report",
        files={
            "assignment": ("assignment.md", b"# a", "text/markdown"),
            "template": ("template.md", b"# b", "text/markdown"),
        },
    )

    payload = response.json()
    assert response.status_code == 500
    assert payload["code"] == "internal_agent_error"
    assert payload["message"] == "SilentError: no error message"
    assert payload["stage"] == "generate_report"
    assert payload["request_id"] == response.headers["X-Request-ID"]
