# Progress Log

## Session Start

- **Date**: 2026-04-29
- **Task name**: `20260429-homework-agent-epic`
- **Task dir**: `.codex-tasks/20260429-homework-agent-epic/`
- **Spec**: See `EPIC.md`
- **Plan**: See `SUBTASKS.csv` (5 subtasks)
- **Environment**: Go backend / Python agent / static frontend

## Context Recovery Block

- **Current milestone**: #12 — Validate one-click startup and publish iteration commit
- **Current status**: IN_PROGRESS
- **Last completed**: #11 — Add one-click startup script and Makefile entry
- **Current artifact**: `.codex-tasks/20260429-homework-agent-epic/SUBTASKS.csv`
- **Key context**: 当前已补上一键启动能力，`scripts/dev.sh` 会自动校验依赖、构建前端并同时拉起 Agent 与 Backend。
- **Known issues**: 真实 LLM 生成仍受上游 `insufficient_quota` 限制，但错误已完整暴露，不影响本地架构迭代。
- **Next action**: 提交一键启动脚本相关变更并推送到 GitHub。

## Milestone 1: Initialize repository and epic artifacts

- **Status**: DONE
- **Started**: 00:00
- **Completed**: 00:10
- **What was done**:
  - 初始化本地 Git 仓库并创建首个提交。
  - 创建 GitHub 私有仓库并推送 `main` 分支。
  - 建立 TaskMaster Epic 工件与子任务拆解。
- **Validation**: `git status --short --branch` / `gh repo create ... --push` → success
- **Files changed**:
  - `.gitignore` — 增加基础忽略规则
  - `.codex-tasks/20260429-homework-agent-epic/EPIC.md` — 定义 Epic 目标与约束
  - `.codex-tasks/20260429-homework-agent-epic/SUBTASKS.csv` — 拆解 5 个子任务
  - `.codex-tasks/20260429-homework-agent-epic/PROGRESS.md` — 记录恢复上下文

## Milestone 2-4: Build agent, backend, and React frontend

- **Status**: DONE
- **Started**: 00:10
- **Completed**: 02:15
- **What was done**:
  - 实现 Python FastAPI Agent，支持 `.docx`、`.pdf`、`.md` 解析、模板填充、Pandoc 转 DOCX、LLM 调用与错误透传。
  - 实现 Go 后端上传接口、Agent 调用客户端、健康检查聚合与静态资源托管。
  - 将前端从静态 HTML 重构为 React + Vite，拆分上传、健康状态、结果展示、下载能力。
- **Problems encountered**:
  - Problem: 外部 LLM API 返回 403。
  - Resolution: 进一步定位为 `insufficient_quota`，并将详细错误消息透传到后端与前端界面。
  - Retry count: 2
- **Validation**: `make test` → exit 0；`curl http://127.0.0.1:8080/api/health` → exit 0；`curl -X POST ... /api/report/generate` → 502 with upstream quota detail
- **Files changed**:
  - `agent/app/main.py` — 暴露 Agent HTTP API
  - `agent/app/document_parser.py` — 实现多格式文档解析
  - `agent/app/template_engine.py` — 实现模板填充与 DOCX 生成
  - `agent/app/llm_client.py` — 实现 OpenAI 兼容调用与错误提取
  - `backend/internal/agent/client.go` — 实现 Go 到 Agent 的 multipart 调用
  - `backend/internal/transporthttp/handler.go` — 实现聚合健康检查与上传接口
  - `frontend/src/App.jsx` — 组织 React 页面状态与交互
  - `frontend/src/ui/UploadPanel.jsx` — 上传交互组件
  - `frontend/src/ui/ReportResult.jsx` — 结果预览与下载组件
  - `frontend/src/services/api.js` — 前端 API 访问封装

## Milestone 5: Run integration validation and publish commits

- **Status**: DONE
- **Started**: 02:15
- **Completed**: 02:20
- **What was done**:
  - 完成 `make test` 全量验证，并确认前后端与 Agent 基础链路可运行。
  - 将首轮全栈脚手架提交并推送至 GitHub。
  - 验证在线生成失败原因为上游配额不足，而不是本地路由或协议错误。
- **Validation**: `make test` → exit 0；`git push origin main` → success；`curl -X POST http://127.0.0.1:8080/api/report/generate` → 502 with upstream quota detail
- **Next step**: Milestone 6 — Enhance backend capabilities and integration coverage

## Milestone 6-7: Backend/API hardening and React UX iteration

- **Status**: DONE
- **Started**: 02:20
- **Completed**: 03:02
- **What was done**:
  - 为 Go 后端增加 `agentService` 接口注入，降低 HTTP 处理器与具体实现耦合。
  - 增加 `/api/capabilities` 能力描述接口，并补齐健康接口、能力接口、上传接口测试。
  - 为 React 前端增加拖拽上传组件、系统能力面板与周期性健康刷新 Hook。
- **Validation**: `go test ./...` → exit 0；`npm --prefix frontend run build` → exit 0；`curl http://127.0.0.1:8080/api/capabilities` → exit 0
- **Files changed**:
  - `backend/internal/transporthttp/handler.go` — 增加能力接口与依赖注入
  - `backend/internal/transporthttp/handler_test.go` — 增加能力与上传端点测试
  - `backend/internal/agent/client.go` — 增加 Agent 健康检查方法
  - `frontend/src/hooks/useSystemInfo.js` — 封装健康与能力拉取逻辑
  - `frontend/src/ui/DropzoneField.jsx` — 新增拖拽上传组件
  - `frontend/src/ui/CapabilitiesPanel.jsx` — 新增系统能力展示组件
  - `frontend/src/ui/UploadPanel.jsx` — 接入拖拽交互
  - `frontend/src/App.jsx` — 接入系统信息与能力面板

## Milestone 8: Run second-round validation and publish iteration commit

- **Status**: DONE
- **Started**: 03:02
- **Completed**: 03:05
- **What was done**:
  - 执行第二轮 `make test` 全量验证。
  - 启动后端并确认 `/api/capabilities` 与 `/api/health` 运行正常。
  - 提交并推送第二轮体验与架构优化代码。
- **Validation**: `make test` → exit 0；`curl http://127.0.0.1:8080/api/capabilities` → exit 0；`git push origin main` → success
- **Next step**: Milestone 9 — Standardize backend error contracts and frontend error UX

## Milestone 9: Standardize backend error contracts and frontend error UX

- **Status**: DONE
- **Started**: 03:05
- **Completed**: 03:06
- **What was done**:
  - 将上传失败响应统一为 JSON 结构，包含 `code`、`message`、`source`。
  - 为上游额度不足场景增加错误分类，保留真实错误详情。
  - 更新 React API 封装与错误告警面板，前端可区分上游额度与通用处理失败。
- **Validation**: `make test` → exit 0；`curl -i -X POST http://127.0.0.1:8080/api/report/generate` → 502 JSON with `upstream_quota_exceeded`
- **Files changed**:
  - `backend/internal/transporthttp/handler.go` — 引入结构化错误响应
  - `backend/internal/transporthttp/handler_test.go` — 增加错误响应测试
  - `frontend/src/services/api.js` — 解析 JSON 错误并抛出带元数据的异常
  - `frontend/src/ui/UploadPanel.jsx` — 渲染更友好的错误提示

## Milestone 10: Run third-round validation and publish iteration commit

- **Status**: DONE
- **Started**: 03:06
- **Completed**: 03:08
- **What was done**:
  - 完成第三轮 `make test` 全量验证。
  - 启动后端并确认上传错误返回结构化 JSON。
  - 提交并推送第三轮错误体验优化代码。
- **Validation**: `make test` → exit 0；`curl -i -X POST http://127.0.0.1:8080/api/report/generate` → 502 JSON；`git push origin main` → success

## Milestone 11: Add one-click startup script and Makefile entry

- **Status**: DONE
- **Started**: 10:16
- **Completed**: 10:19
- **What was done**:
  - 新增 `scripts/dev.sh`，统一处理依赖检查、前端构建、Agent 启动、Backend 启动与退出清理。
  - 为 `Makefile` 增加 `setup`、`agent-install`、`frontend-install`、`dev` 入口。
  - 启动脚本在未设置 `LLM_API_KEY` 时显式提示，但仍允许服务启动用于本地联调。
- **Validation**: `bash -n scripts/dev.sh` → exit 0；`bash scripts/dev.sh` → health/capabilities reachable
