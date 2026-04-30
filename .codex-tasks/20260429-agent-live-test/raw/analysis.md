# Analysis

## Endpoint

- URL: `POST /generate-report`
- Content type: `multipart/form-data`
- Required fields:
  - `assignment`
  - `template`
- Response includes:
  - `file_name`
  - `markdown_content`
  - `docx_base64`
  - `template_strategy`
  - `model`

## Test Strategy

- Add `agent/tests/live/agent.live.test.ts`.
- Default base URL: `http://127.0.0.1:19000`.
- Override with `AGENT_LIVE_BASE_URL`.
- Use a minimal markdown assignment: `你好，请用一句话回复。`
- Use a minimal markdown template with `{{REPORT_TITLE}}` and `{{REPORT_BODY}}`.
- Fail explicitly on timeout, non-JSON responses, non-2xx responses, and missing response fields.
- Keep live test out of the default `npm test` run.
