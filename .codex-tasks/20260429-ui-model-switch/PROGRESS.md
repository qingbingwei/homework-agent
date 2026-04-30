# Progress

## Recovery

任务: 前端重构与 Coding 模型切换
形态: single-full
进度: 6/6
当前: complete
文件: .codex-tasks/20260429-ui-model-switch/TODO.csv
下一步: none

## Log

- 2026-04-29: 已使用 `ui-ux-pro-max` 生成设计系统：专业 SaaS 工作台、扁平化、indigo/emerald、紧凑信息结构。
- 2026-04-29: 当前上传链路为 frontend `/api/report/generate` -> backend multipart -> agent `/generate-report`。
- 2026-04-29: 当前 agent 只有一个 coding config，需要新增独立 `CODING_DEEPSEEK_LLM_*`。
- 2026-04-30: 已将 DeepSeek coding profile 拆成独立 `CodingDeepseekLlmConfig`，只读取 `BASE_URL/API_KEY/MODEL/REASONING_EFFORT/THINKING_TYPE` 5 个 env。
- 2026-04-30: 已贯通 `coding_model_profile`：frontend form -> backend `/api/report/generate` -> agent `/generate-report` -> report response。
- 2026-04-30: 已按工作台风格重构前端，新增 GPT/DeepSeek segmented model switch，并移除大圆角、阴影和渐变样式。
- 2026-04-30: 验证通过：`npm --prefix frontend run build`、`npm --prefix agent run typecheck`、`npm --prefix agent test`、`env -u GOROOT go test -timeout 60s ./...`。
