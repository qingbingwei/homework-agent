#!/usr/bin/env bash

AGENT_DIR="$ROOT_DIR/agent"
FRONTEND_APP_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

AGENT_ENV_FILE="$AGENT_DIR/.env"
AGENT_DIST_ENTRY="$AGENT_DIR/dist/src/index.js"
FRONTEND_DIST_DIR="$FRONTEND_APP_DIR/dist"
BACKEND_BIN_DIR="$BACKEND_DIR/bin"
BACKEND_BIN="$BACKEND_BIN_DIR/homework-backend"

RUN_DIR="$ROOT_DIR/run"
LOG_DIR="$ROOT_DIR/logs"
AGENT_PID_FILE="$RUN_DIR/agent.pid"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
AGENT_LOG="$LOG_DIR/agent.log"
BACKEND_LOG="$LOG_DIR/backend.log"

MIN_NODE_MAJOR=20
DEFAULT_AGENT_HOST="127.0.0.1"
DEFAULT_AGENT_PORT="19000"
DEFAULT_BACKEND_PORT="19080"
DEFAULT_AGENT_CLIENT_TIMEOUT_SECONDS="1800"
STARTUP_GRACE_SECONDS=1
HTTP_RETRIES=30
HTTP_SLEEP_SECONDS=1
STOP_WAIT_SECONDS=10
LOG_TAIL_LINES=80

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] error: %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  command_exists "$1" || fail "missing required command: $1"
}

require_node_version() {
  local major version
  version="$(node --version)"
  major="${version#v}"
  major="${major%%.*}"
  [[ "$major" =~ ^[0-9]+$ ]] || fail "cannot parse node version: $version"
  (( major >= MIN_NODE_MAJOR )) || fail "node >= $MIN_NODE_MAJOR required, got $version"
}

require_base_tools() {
  require_command node
  require_node_version
  require_command npm
  require_command go
}

go_cmd() {
  if [ -n "${GOROOT:-}" ]; then
    log "running go with GOROOT unset; current GOROOT=$GOROOT"
    env -u GOROOT go "$@"
    return
  fi
  go "$@"
}

require_runtime_tools() {
  require_base_tools
  require_command curl
  if ! command_exists lsof && ! command_exists ss; then
    fail "missing required port checker: lsof or ss"
  fi
}

env_file_value() {
  local key line
  key="$1"
  [ -f "$AGENT_ENV_FILE" ] || return 1
  line="$(sed -n "s/^[[:space:]]*$key[[:space:]]*=[[:space:]]*//p" "$AGENT_ENV_FILE" | tail -n 1)"
  [ -n "$line" ] || return 1
  printf '%s' "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^[\"']//" -e "s/[\"']$//"
}

env_value() {
  local default key value
  key="$1"
  default="$2"
  value="${!key:-}"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi
  value="$(env_file_value "$key" || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi
  printf '%s' "$default"
}

deploy_env_value() {
  local default deploy_key key value
  key="$1"
  default="$2"
  deploy_key="DEPLOY_$key"
  value="${!deploy_key:-}"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi
  value="${!key:-}"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi
  printf '%s' "$default"
}

validate_required_secret() {
  local key value
  key="$1"
  value="$(env_value "$key" "")"
  case "$value" in
    ""|"sk-replace-me"|"replace-me"|"changeme")
      fail "$key is required; export it or set a real value in agent/.env"
      ;;
  esac
}

validate_runtime_env() {
  validate_required_secret PLAN_LLM_API_KEY
  validate_required_secret CODING_LLM_API_KEY
}

agent_host() {
  deploy_env_value AGENT_HOST "$DEFAULT_AGENT_HOST"
}

agent_port() {
  deploy_env_value AGENT_PORT "$DEFAULT_AGENT_PORT"
}

backend_port() {
  deploy_env_value BACKEND_PORT "$DEFAULT_BACKEND_PORT"
}

agent_client_timeout_seconds() {
  deploy_env_value AGENT_CLIENT_TIMEOUT_SECONDS "$DEFAULT_AGENT_CLIENT_TIMEOUT_SECONDS"
}

assert_port() {
  local name port
  name="$1"
  port="$2"
  [[ "$port" =~ ^[0-9]+$ ]] || fail "$name must be numeric, got: $port"
  (( port >= 1 && port <= 65535 )) || fail "$name out of range: $port"
}

connect_host() {
  local host
  host="$1"
  case "$host" in
    "0.0.0.0"|"::") printf '%s' "$DEFAULT_AGENT_HOST" ;;
    *) printf '%s' "$host" ;;
  esac
}

agent_base_url() {
  local host port
  host="$(connect_host "$(agent_host)")"
  port="$(agent_port)"
  printf 'http://%s:%s' "$host" "$port"
}

backend_base_url() {
  printf 'http://127.0.0.1:%s' "$(backend_port)"
}

frontend_public_url() {
  backend_base_url
}

ensure_distinct_runtime_ports() {
  local agent_port_value backend_port_value
  agent_port_value="$1"
  backend_port_value="$2"
  if [ "$agent_port_value" = "$backend_port_value" ]; then
    fail "AGENT_PORT and BACKEND_PORT must be different; frontend is served by backend in production"
  fi
}

absolute_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$ROOT_DIR" "$1" ;;
  esac
}

frontend_runtime_dir() {
  absolute_path "${FRONTEND_DIR:-$FRONTEND_DIST_DIR}"
}

read_pid() {
  local pid_file
  pid_file="$1"
  [ -f "$pid_file" ] || return 1
  tr -d '[:space:]' < "$pid_file"
}

is_pid_running() {
  kill -0 "$1" >/dev/null 2>&1
}

port_in_use() {
  local port
  port="$1"
  if command_exists lsof; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command_exists ss; then
    ss -ltn "( sport = :$port )" | tail -n +2 | grep -q .
    return $?
  fi
  return 2
}

check_port_available() {
  local name port result
  name="$1"
  port="$2"
  if port_in_use "$port"; then
    fail "$name port $port is already in use"
  else
    result=$?
    [ "$result" -ne 2 ] || fail "cannot check $name port $port"
  fi
}

tail_log() {
  local file
  file="$1"
  if [ -f "$file" ]; then
    log "last $LOG_TAIL_LINES lines from $file:"
    tail -n "$LOG_TAIL_LINES" "$file" >&2
    return
  fi
  log "log file does not exist: $file"
}

wait_http() {
  local attempt name url
  url="$1"
  name="$2"
  for attempt in $(seq 1 "$HTTP_RETRIES"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name healthy: $url"
      return
    fi
    sleep "$HTTP_SLEEP_SECONDS"
  done
  return 1
}
