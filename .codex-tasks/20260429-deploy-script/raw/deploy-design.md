# Deployment Script Design

## Script

Path: `scripts/deploy.sh`

## Commands

- `install`: install Node dependencies with `npm ci` for `agent` and `frontend`.
- `build`: compile agent TypeScript, build frontend assets, and build the Go backend binary.
- `deploy`: run `install`, `build`, then restart both runtime services.
- `start`: validate runtime configuration and start agent plus backend from build artifacts.
- `stop`: stop backend and agent by pid files.
- `restart`: stop then start.
- `status`: print pid status and run health probes.
- `health`: run strict curl health checks against agent and backend.
- `logs`: show recent agent and backend logs.
- `test`: run backend tests with Go's `-timeout 60s`, agent typecheck/tests, and frontend build.

## Runtime Layout

- Pid files: `run/agent.pid`, `run/backend.pid`
- Logs: `logs/agent.log`, `logs/backend.log`
- Backend binary: `backend/bin/homework-backend`
- Agent runtime entry: `agent/dist/index.js`
- Frontend runtime dir: absolute `frontend/dist`

## Failure Behavior

- `set -Eeuo pipefail` is enabled.
- Missing commands fail before install/build/start.
- Go build/test commands explicitly unset inherited `GOROOT` and print the original value, because this repository does not require a custom `GOROOT` and a stale value breaks standard library versioning.
- Missing build artifacts fail `start`; `deploy` handles builds explicitly.
- Missing or placeholder LLM keys fail `start` and `deploy`.
- Occupied ports fail before launching a process.
- Failed health checks print the relevant log tail and return non-zero.
- Stop sends `TERM`; if a process does not exit within the timeout, the script returns non-zero instead of force-killing silently.

## Deployment Flow

1. `scripts/deploy.sh deploy`
2. Validate `node`, `npm`, `go`, `curl`, and a port checker.
3. Install dependencies.
4. Build agent, frontend, and backend.
5. Validate required LLM environment.
6. Start agent and wait for `/health`.
7. Start backend with `FRONTEND_DIR` and `AGENT_SERVICE_URL`.
8. Wait for `/api/health`.
