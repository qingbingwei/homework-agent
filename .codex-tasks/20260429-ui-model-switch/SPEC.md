# 前端重构与 Coding 模型切换

## Goal

使用 `ui-ux-pro-max` 设计系统重构前端工作台，并新增 coding-agent 模型切换按钮。支持 GPT coding-agent 与独立 DeepSeek coding-agent 配置，DeepSeek 配置不能复用 `PLAN_LLM_*`。

## Scope

- 前端重构为更清晰的 SaaS 工作台布局。
- 上传流程新增 coding-agent 模型 segmented control。
- 前端将所选模型 profile 传给 backend。
- Backend 将 profile 透传给 agent。
- Agent 使用 profile 选择 GPT 或 DeepSeek coding model。
- `.env.example` 新增独立 `CODING_DEEPSEEK_LLM_*` 配置；本地 `.env` 新增实际配置。
- 运行 frontend build、agent typecheck/tests、backend tests。

## Acceptance Criteria

- UI 中可切换 `gpt` / `deepseek` coding-agent。
- 请求 multipart 中包含 `coding_model_profile`。
- Agent 不复用 `PLAN_LLM_*` 作为 coding DeepSeek 配置。
- 报告响应包含实际 coding model profile/model。
- 自动验证通过或失败原因显式记录。
