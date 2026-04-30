# Agent 实际 URL 活性测试

## Goal

新增 tests 目录下的实际 URL 活性测试，直接调用运行中的 agent `/generate-report`，用最小“你好”问题验证真实服务能返回报告内容，并显式暴露超时或上游失败。

## Scope

- 新增 live test 文件，不 mock agent 或 LLM。
- 新增 npm 脚本用于手动运行 live test。
- 避免普通 `npm test` 被真实外部服务依赖阻塞。
- 运行静态检查和可执行验证。

## Acceptance Criteria

- `agent/tests/live/` 下存在实际 URL 测试。
- `npm run test:live` 可对 `AGENT_LIVE_BASE_URL` 或默认 `http://127.0.0.1:19000` 发起 multipart 请求。
- 测试失败时输出 HTTP 状态、响应体或超时原因。
- 普通 `npm test` 不运行 live test。
