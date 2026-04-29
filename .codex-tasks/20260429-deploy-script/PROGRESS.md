# Progress

## Recovery

任务: 分析整个项目并给出完整部署脚本
形态: single-full
进度: 5/5
当前: Completed
文件: .codex-tasks/20260429-deploy-script/TODO.csv
下一步: 无，任务已完成。

## Log

- 2026-04-29: 初始化 Full Single taskmaster 任务文件。
- 2026-04-29: 完成项目结构分析，确认部署包含 agent、backend、frontend 三个组件。
- 2026-04-29: 完成部署脚本设计，命令覆盖 install/build/deploy/start/stop/status/health/logs/test。
- 2026-04-29: 完成部署脚本实现，入口为 scripts/deploy.sh，helper 位于 scripts/deploy/。
- 2026-04-29: 验证通过：bash -n 三个脚本文件通过，scripts/deploy.sh help/status 通过，scripts/deploy.sh build 通过。
- 2026-04-29: scripts/deploy.sh test 在 sandbox 内因 httptest 本地端口绑定权限失败；按权限规则提权重跑后通过。
- 2026-04-29: 已记录部署用法、运行期目录和环境变量要求。

## Deployment Usage

- Full deploy: `scripts/deploy.sh deploy`
- Build only: `scripts/deploy.sh build`
- Start built services: `scripts/deploy.sh start`
- Stop services: `scripts/deploy.sh stop`
- Status: `scripts/deploy.sh status`
- Health checks: `scripts/deploy.sh health`
- Logs: `scripts/deploy.sh logs`
- Validation: `scripts/deploy.sh test`

## Runtime Notes

- Required secrets: `PLAN_LLM_API_KEY` and `CODING_LLM_API_KEY`, either exported or set in `agent/.env`.
- Runtime pid files are under `run/`; logs are under `logs/`.
- Backend serves `frontend/dist` and talks to the local agent via `AGENT_SERVICE_URL`.
- Go commands intentionally run with inherited `GOROOT` unset and print the original value when present.
