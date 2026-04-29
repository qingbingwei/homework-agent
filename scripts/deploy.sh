#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/deploy/common.sh"
source "$ROOT_DIR/scripts/deploy/runtime.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh <command>

Commands:
  install   Install agent and frontend dependencies with npm ci.
  build     Build agent, frontend, and backend artifacts.
  deploy    Install, build, then restart services.
  start     Start built agent and backend services.
  stop      Stop services by pid file.
  restart   Stop then start services.
  status    Print pid and health status.
  health    Run strict health checks.
  logs      Print recent runtime logs.
  test      Run backend, agent, and frontend validation checks.
USAGE
}

install_dependencies() {
  require_base_tools
  log "installing agent dependencies"
  npm --prefix "$AGENT_DIR" ci
  log "installing frontend dependencies"
  npm --prefix "$FRONTEND_APP_DIR" ci
}

build_all() {
  require_base_tools
  build_agent
  build_frontend
  build_backend
}

run_tests() {
  require_base_tools
  (cd "$BACKEND_DIR" && go_cmd test -timeout 60s ./...)
  npm --prefix "$AGENT_DIR" run typecheck
  npm --prefix "$AGENT_DIR" test
  npm --prefix "$FRONTEND_APP_DIR" run build
}

deploy() {
  install_dependencies
  build_all
  restart_services
}

main() {
  local command_name
  command_name="${1:-}"
  case "$command_name" in
    install) install_dependencies ;;
    build) build_all ;;
    deploy) deploy ;;
    start) start_services ;;
    stop) stop_services ;;
    restart) restart_services ;;
    status) status_services ;;
    health) health_checks ;;
    logs) show_logs ;;
    test) run_tests ;;
    ""|help|-h|--help) usage ;;
    *) usage; fail "unknown command: $command_name" ;;
  esac
}

main "$@"
