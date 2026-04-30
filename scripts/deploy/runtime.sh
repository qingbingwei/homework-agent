#!/usr/bin/env bash

build_agent() {
  log "building agent"
  npm --prefix "$AGENT_DIR" run build
}

build_frontend() {
  log "building frontend"
  npm --prefix "$FRONTEND_APP_DIR" run build
}

build_backend() {
  log "building backend"
  mkdir -p "$BACKEND_BIN_DIR"
  (cd "$BACKEND_DIR" && go_cmd build -o "$BACKEND_BIN" ./cmd/server)
}

ensure_build_artifacts() {
  [ -f "$AGENT_DIST_ENTRY" ] || fail "missing agent build: run scripts/deploy.sh build"
  [ -f "$FRONTEND_DIST_DIR/index.html" ] || fail "missing frontend build: run scripts/deploy.sh build"
  [ -x "$BACKEND_BIN" ] || fail "missing backend binary: run scripts/deploy.sh build"
}

preflight_start() {
  local agent_port_value backend_port_value
  require_runtime_tools
  ensure_build_artifacts
  validate_runtime_env
  agent_port_value="$(agent_port)"
  backend_port_value="$(backend_port)"
  assert_port AGENT_PORT "$agent_port_value"
  assert_port BACKEND_PORT "$backend_port_value"
  ensure_distinct_runtime_ports "$agent_port_value" "$backend_port_value"
  log "agent url: $(agent_base_url)"
  log "backend url: $(backend_base_url)"
  log "frontend url: $(frontend_public_url) (served by backend)"
  log "frontend dir: $(frontend_runtime_dir)"
}

ensure_service_stopped() {
  local name pid pid_file
  name="$1"
  pid_file="$2"
  pid="$(read_pid "$pid_file" || true)"
  [ -n "$pid" ] || return 0
  if is_pid_running "$pid"; then
    fail "$name already running with pid $pid"
  fi
  log "removing stale $name pid file"
  rm -f "$pid_file"
}

start_agent() {
  local host pid port url
  host="$(agent_host)"
  port="$(agent_port)"
  url="$(agent_base_url)"
  ensure_service_stopped agent "$AGENT_PID_FILE"
  check_port_available agent "$port"
  mkdir -p "$RUN_DIR" "$LOG_DIR"
  log "starting agent"
  (
    cd "$AGENT_DIR"
    nohup env AGENT_HOST="$host" AGENT_PORT="$port" node "$AGENT_DIST_ENTRY" >"$AGENT_LOG" 2>&1 &
    printf '%s\n' "$!" > "$AGENT_PID_FILE"
  )
  pid="$(read_pid "$AGENT_PID_FILE")"
  sleep "$STARTUP_GRACE_SECONDS"
  if ! is_pid_running "$pid"; then
    tail_log "$AGENT_LOG"
    fail "agent exited during startup"
  fi
  if ! wait_http "$url/health" agent; then
    tail_log "$AGENT_LOG"
    fail "agent health check failed"
  fi
}

start_backend() {
  local agent_timeout_seconds agent_url frontend_dir pid port url
  port="$(backend_port)"
  url="$(backend_base_url)"
  agent_url="$(agent_base_url)"
  agent_timeout_seconds="$(agent_client_timeout_seconds)"
  frontend_dir="$(frontend_runtime_dir)"
  [ -d "$frontend_dir" ] || fail "frontend dir does not exist: $frontend_dir"
  ensure_service_stopped backend "$BACKEND_PID_FILE"
  check_port_available backend "$port"
  mkdir -p "$RUN_DIR" "$LOG_DIR"
  log "starting backend"
  (
    cd "$BACKEND_DIR"
    nohup env BACKEND_PORT="$port" AGENT_SERVICE_URL="$agent_url" FRONTEND_DIR="$frontend_dir" AGENT_CLIENT_TIMEOUT_SECONDS="$agent_timeout_seconds" "$BACKEND_BIN" >"$BACKEND_LOG" 2>&1 &
    printf '%s\n' "$!" > "$BACKEND_PID_FILE"
  )
  pid="$(read_pid "$BACKEND_PID_FILE")"
  sleep "$STARTUP_GRACE_SECONDS"
  if ! is_pid_running "$pid"; then
    tail_log "$BACKEND_LOG"
    fail "backend exited during startup"
  fi
  if ! wait_http "$url/api/health" backend; then
    tail_log "$BACKEND_LOG"
    fail "backend health check failed"
  fi
}

start_processes() {
  start_agent
  start_backend
}

start_services() {
  preflight_start
  start_processes
}

wait_for_exit() {
  local attempt name pid
  pid="$1"
  name="$2"
  for attempt in $(seq 1 "$STOP_WAIT_SECONDS"); do
    if ! is_pid_running "$pid"; then
      return
    fi
    sleep 1
  done
  fail "$name did not stop after $STOP_WAIT_SECONDS seconds"
}

stop_one() {
  local name pid pid_file
  name="$1"
  pid_file="$2"
  pid="$(read_pid "$pid_file" || true)"
  if [ -z "$pid" ]; then
    log "$name is not running"
    return
  fi
  if ! is_pid_running "$pid"; then
    log "removing stale $name pid file"
    rm -f "$pid_file"
    return
  fi
  log "stopping $name pid $pid"
  kill "$pid"
  wait_for_exit "$pid" "$name"
  rm -f "$pid_file"
}

stop_services() {
  stop_one backend "$BACKEND_PID_FILE"
  stop_one agent "$AGENT_PID_FILE"
}

restart_services() {
  preflight_start
  stop_services
  start_processes
}

health_checks() {
  require_command curl
  curl -fsS "$(agent_base_url)/health"
  printf '\n'
  curl -fsS "$(backend_base_url)/api/health"
  printf '\n'
}

service_status() {
  local name pid pid_file url
  name="$1"
  pid_file="$2"
  url="$3"
  pid="$(read_pid "$pid_file" || true)"
  if [ -n "$pid" ] && is_pid_running "$pid"; then
    printf '%s: running pid=%s\n' "$name" "$pid"
  else
    printf '%s: stopped\n' "$name"
  fi
  if command_exists curl && curl -fsS "$url" >/dev/null 2>&1; then
    printf '%s health: ok\n' "$name"
  else
    printf '%s health: failed\n' "$name"
  fi
}

status_services() {
  service_status agent "$AGENT_PID_FILE" "$(agent_base_url)/health"
  service_status backend "$BACKEND_PID_FILE" "$(backend_base_url)/api/health"
}

show_logs() {
  tail_log "$AGENT_LOG"
  tail_log "$BACKEND_LOG"
}
