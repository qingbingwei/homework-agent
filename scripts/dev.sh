#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_ENV_FILE="${ROOT_DIR}/agent/.env"

if [[ -f "${AGENT_ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${AGENT_ENV_FILE}"
  set +a
fi

AGENT_HOST="${AGENT_HOST:-127.0.0.1}"
AGENT_PORT="${AGENT_PORT:-8000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
LLM_BASE_URL="${LLM_BASE_URL:-https://api.asxs.top/v1}"
LLM_MODEL="${LLM_MODEL:-gpt-5.5}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
LOG_DIR="${ROOT_DIR}/tmp/runtime"
AGENT_LOG="${LOG_DIR}/agent.log"
BACKEND_LOG="${LOG_DIR}/backend.log"

mkdir -p "${LOG_DIR}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '缺少命令: %s\n' "$1" >&2
    exit 1
  fi
}

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${AGENT_PID:-}" ]] && kill -0 "${AGENT_PID}" >/dev/null 2>&1; then
    kill "${AGENT_PID}" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "${exit_code}"
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local retries=30

  for ((i = 1; i <= retries; i++)); do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  printf '%s 启动失败，请检查日志: %s\n' "$name" "$3" >&2
  return 1
}

ensure_agent_dependencies() {
  if ! "$PYTHON_BIN" -c 'import fastapi, httpx, pypdf, uvicorn, multipart' >/dev/null 2>&1; then
    printf '安装 Python Agent 依赖...\n'
    "$PYTHON_BIN" -m pip install -r "${ROOT_DIR}/agent/requirements.txt"
  fi
}

ensure_frontend_dependencies() {
  if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
    printf '安装前端依赖...\n'
    npm --prefix "${ROOT_DIR}/frontend" install
  fi
}

start_agent() {
  printf '启动 Python Agent...\n'
  (
    cd "${ROOT_DIR}"
    LLM_BASE_URL="${LLM_BASE_URL}" \
    LLM_API_KEY="${LLM_API_KEY:-}" \
    LLM_MODEL="${LLM_MODEL}" \
    PYTHONPATH="${ROOT_DIR}/agent" \
    "$PYTHON_BIN" -m uvicorn app.main:app --app-dir "${ROOT_DIR}/agent" --host "${AGENT_HOST}" --port "${AGENT_PORT}"
  ) >"${AGENT_LOG}" 2>&1 &
  AGENT_PID=$!
  wait_for_http "http://${AGENT_HOST}:${AGENT_PORT}/health" "Python Agent" "${AGENT_LOG}"
}

start_backend() {
  printf '启动 Go Backend...\n'
  (
    cd "${ROOT_DIR}/backend"
    AGENT_SERVICE_URL="http://${AGENT_HOST}:${AGENT_PORT}" \
    FRONTEND_DIR="${ROOT_DIR}/frontend/dist" \
    BACKEND_PORT="${BACKEND_PORT}" \
    go run ./cmd/server
  ) >"${BACKEND_LOG}" 2>&1 &
  BACKEND_PID=$!
  wait_for_http "http://${BACKEND_HOST}:${BACKEND_PORT}/api/health" "Go Backend" "${BACKEND_LOG}"
}

trap cleanup EXIT INT TERM

require_command "$PYTHON_BIN"
require_command go
require_command npm
require_command curl
require_command pandoc

ensure_agent_dependencies
ensure_frontend_dependencies

printf '构建 React 前端...\n'
npm --prefix "${ROOT_DIR}/frontend" run build >/dev/null

if [[ -z "${LLM_API_KEY:-}" ]]; then
  printf '警告: 未设置 LLM_API_KEY，服务可以启动，但真实报告生成会失败。\n'
fi

start_agent
start_backend

printf '\n启动完成:\n'
printf '  前端/后端: http://%s:%s\n' "${BACKEND_HOST}" "${BACKEND_PORT}"
printf '  Agent 健康检查: http://%s:%s/health\n' "${AGENT_HOST}" "${AGENT_PORT}"
printf '  Agent 日志: %s\n' "${AGENT_LOG}"
printf '  Backend 日志: %s\n\n' "${BACKEND_LOG}"
printf '按 Ctrl+C 可同时停止全部服务。\n'

wait "${BACKEND_PID}"
