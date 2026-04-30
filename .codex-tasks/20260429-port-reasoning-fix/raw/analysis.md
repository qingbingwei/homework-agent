# Analysis

## Port Root Cause

- Deployment script defaults were changed to `19000/19080`.
- The agent service itself still defaults to `AGENT_PORT=8000` in `agent/src/config.ts`.
- `agent/.env.example` still documents `AGENT_PORT=8000`.
- Local ignored `agent/.env` also contains `AGENT_PORT=8000`.
- When running the agent directly, or when a caller sources `.env`, it can still bind common port 8000.

## Coding-Agent Request Root Cause

- `CODING_LLM_REASONING_EFFORT=xhigh` is configured.
- `agent/src/llm/chat.ts` converts `xhigh` to `max` before passing `reasoning_effort`.
- The target GPT gateway expects `xhigh`, so this conversion can produce request failures.

## Fix Direction

- Make agent runtime default and example port `19000`.
- Update local `.env` port line to `19000` without touching secrets.
- Remove `xhigh -> max` conversion and pass configured coding reasoning effort through directly.
