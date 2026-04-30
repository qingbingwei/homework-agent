# Analysis

## UI Direction

- Product type: education/AI document processing SaaS dashboard.
- Pattern: compact workspace instead of landing page.
- Style: flat design, restrained borders, 8px radii, no decorative gradients.
- Controls: coding model selection should be a segmented control in the upload workflow.

## Request Flow

1. Frontend submits `assignment` and `template`.
2. Backend reads multipart files and calls agent.
3. Agent parses files, runs plan-write, runs coding-agent, writes report.

## Required Model Flow

- Add `coding_model_profile` to frontend FormData.
- Backend forwards `coding_model_profile` to agent multipart.
- Agent validates profile and selects:
  - `gpt`: existing `CODING_LLM_*`
  - `deepseek`: new `CODING_DEEPSEEK_LLM_*`

## Env Rule

DeepSeek coding-agent config must be independent and must not read from `PLAN_LLM_*`.
