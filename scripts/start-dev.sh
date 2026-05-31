#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/docker-compose.dev.yml"
API_URL="http://localhost:8080"
CLIENT_URL="http://localhost:5173"
TOTAL_STEPS=4

FORCE_REBUILD=false
DETACH=false

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RED=$'\033[31m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  BLUE=$'\033[34m'
  CYAN=$'\033[36m'
  MAGENTA=$'\033[35m'
  RESET=$'\033[0m'
else
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" BLUE="" CYAN="" MAGENTA="" RESET=""
fi

usage() {
  cat <<EOF
${BOLD}Tresor dev environment${RESET}

Usage: $(basename "$0") [options]

Options:
  --rebuild        Force rebuild of Docker images
  --detach, -d     Start in background without following logs
  -h, --help       Show this help

Requires only Docker. Starts PostgreSQL, the Go API, and the Vite dev
server entirely in containers — no local Node.js or pnpm needed.

  Client  → ${CLIENT_URL}
  API     → ${API_URL}
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild) FORCE_REBUILD=true; shift ;;
    --detach|-d) DETACH=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo -e "${RED}Unknown option:${RESET} $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

step=0
step_header() {
  step=$((step + 1))
  echo ""
  echo -e "${CYAN}${BOLD}[$step/$TOTAL_STEPS]${RESET} ${BOLD}$1${RESET}"
  echo -e "${DIM}$(printf '─%.0s' {1..48})${RESET}"
}

log_ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
log_info()  { echo -e "  ${BLUE}→${RESET} $1"; }
log_fail()  { echo -e "  ${RED}✗${RESET} $1" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_fail "Missing required command: $1"
    exit 1
  fi
}

spinner_while() {
  local message="$1"
  shift
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0

  while "$@"; do
    printf '\r  %s %s' "${BLUE}${frames[i]}${RESET}" "$message"
    i=$(((i + 1) % ${#frames[@]}))
    sleep 0.1
  done

  printf '\r\033[K'
}

service_health() {
  local service="$1"
  local container_id
  container_id="$("${COMPOSE[@]}" -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$container_id" ]]; then
    echo "missing"
    return
  fi
  docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || echo "unknown"
}

wait_for_service() {
  local service="$1"
  local attempts="${2:-120}"
  local compose_cmd
  compose_cmd="$(printf '%q ' "${COMPOSE[@]}")"

  spinner_while "Waiting for ${service}…" bash -c "
    for _ in \$(seq 1 $attempts); do
      id=\$(${compose_cmd} -f '$COMPOSE_FILE' ps -q '$service' 2>/dev/null)
      [ -z \"\$id\" ] && sleep 1 && continue

      state=\$(docker inspect --format='{{.State.Status}}' \"\$id\" 2>/dev/null || echo unknown)
      if [ \"\$state\" = exited ] || [ \"\$state\" = dead ]; then
        exit 0
      fi

      status=\$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \"\$id\" 2>/dev/null || echo unknown)
      [ \"\$status\" = healthy ] && exit 1
      sleep 1
    done
    exit 0
  "

  local container_id state status
  container_id="$("${COMPOSE[@]}" -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"
  if [[ -n "$container_id" ]]; then
    state="$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo unknown)"
    if [[ "$state" == "exited" || "$state" == "dead" ]]; then
      log_fail "${service} crashed (container exited)"
      log_info "Recent logs:"
      "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs --tail=30 "$service" 2>&1 | sed 's/^/    /' >&2
      exit 1
    fi
  fi

  status="$(service_health "$service")"
  if [[ "$status" == "healthy" ]]; then
    log_ok "${service} healthy"
  else
    log_fail "${service} not ready (status: ${status})"
    log_info "Recent logs:"
    "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs --tail=30 "$service" 2>&1 | sed 's/^/    /' >&2
    exit 1
  fi
}

wait_for_services() {
  wait_for_service db 30
  wait_for_service api 60
  wait_for_service client 120
}

print_banner() {
  echo -e "${MAGENTA}${BOLD}"
  cat <<'EOF'
  ╔══════════════════════════════════════╗
  ║           Tresor · dev mode          ║
  ╚══════════════════════════════════════╝
EOF
  echo -e "${RESET}${DIM}  Zero-knowledge password vault · Docker only${RESET}"
}

cd "$ROOT_DIR"

print_banner

step_header "Checking prerequisites"
require_cmd docker

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  log_fail "Docker Compose not found"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_fail "Docker daemon is not running"
  exit 1
fi

log_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
log_ok "Compose available"

step_header "Building & starting services"
compose_args=(-f "$COMPOSE_FILE" up -d)
if [[ "$FORCE_REBUILD" == true ]]; then
  compose_args+=(--build)
  log_info "Rebuilding images…"
else
  log_info "Starting db, api, and client…"
fi

if output="$("${COMPOSE[@]}" "${compose_args[@]}" 2>&1)"; then
  log_ok "Containers started"
else
  log_fail "Failed to start services"
  echo "$output" | sed 's/^/    /' >&2
  exit 1
fi

step_header "Waiting for services"
wait_for_services

step_header "Ready"
echo ""
echo -e "${GREEN}${BOLD}  All services up!${RESET}"
echo -e "  Client  ${CYAN}${BOLD}${CLIENT_URL}${RESET}"
echo -e "  API     ${CYAN}${BOLD}${API_URL}${RESET}"
echo ""

if [[ "$DETACH" == true ]]; then
  echo -e "${DIM}  Follow logs:  docker compose -f deploy/docker-compose.dev.yml logs -f${RESET}"
  echo -e "${DIM}  Stop stack:   docker compose -f deploy/docker-compose.dev.yml down${RESET}"
  exit 0
fi

echo -e "${DIM}  Streaming client logs · Ctrl+C to detach (containers keep running)${RESET}"
echo ""
exec "${COMPOSE[@]}" -f "$COMPOSE_FILE" logs -f client
