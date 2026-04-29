# Project Analysis

## Components

- `agent/`: TypeScript Fastify service. It loads `agent/.env`, listens on `AGENT_HOST` / `AGENT_PORT`, and exposes `/health` plus `/generate-report`.
- `backend/`: Go HTTP server. It listens on `BACKEND_PORT`, proxies report generation to `AGENT_SERVICE_URL`, serves `/api/*`, and serves static frontend files from `FRONTEND_DIR`.
- `frontend/`: Vite React application. Production output is `frontend/dist`; runtime API calls use relative `/api/*` endpoints.

## Build Contracts

- Agent package requires Node `>=20`.
- Agent build command: `npm --prefix agent run build`.
- Frontend build command: `npm --prefix frontend run build`.
- Backend build command from `backend/`: `go build -o bin/homework-backend ./cmd/server`.
- Full project validation is represented by Makefile target `test`, but deployment can validate each component directly.

## Runtime Contracts

- Agent runtime entry after build: `node agent/dist/index.js`.
- Backend runtime entry after build: `backend/bin/homework-backend`.
- Backend must receive an absolute `FRONTEND_DIR` to avoid cwd-sensitive static file resolution.
- Backend should receive `AGENT_SERVICE_URL`, defaulting to the agent URL used by the deployment script.

## Environment

- Required for real report generation:
  - `PLAN_LLM_API_KEY`
  - `CODING_LLM_API_KEY`
- Agent also supports model, base URL, reasoning, tracing, and port variables in `agent/.env.example`.
- Script validation should accept either exported environment variables or values in `agent/.env`.
- Placeholder values such as `sk-replace-me` must fail deployment.

## Endpoints

- Agent health: `GET http://<AGENT_HOST>:<AGENT_PORT>/health`
- Backend health: `GET http://127.0.0.1:<BACKEND_PORT>/api/health`
- Frontend/API is served by backend in production.

## Existing Gaps

- `scripts/dev.sh` is deleted in the current worktree, and `scripts/` is empty.
- No production deployment script exists.
- Runtime pid/log directories are not currently ignored by `.gitignore`.
