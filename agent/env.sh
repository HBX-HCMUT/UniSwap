#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
run=.agent-run
compose() {
  docker compose --env-file "$run/local.env" -f agent/compose.yaml "$@"
}
require_commands() {
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null || { echo "Thiếu $cmd" >&2; exit 1; }
  done
}
case "${1:-check}" in
  check)
    require_commands codex docker node npm git python3 curl openssl flock timeout
    codex --version
    codex login status
    codex features list | awk '$1 == "multi_agent_v2" {found=1} END {exit !found}'
    git rev-parse --show-toplevel
    docker compose version
    docker info --format '{{.ServerVersion}}'
    ;;
  up)
    require_commands docker curl openssl flock
    mkdir -p "$run"
    exec 8>"$run/setup.lock"
    flock 8
    if [[ ! -f "$run/local.env" ]]; then
      demo=$(openssl rand -hex 24)
      testpw=$(openssl rand -hex 24)
      jwt=$(openssl rand -hex 32)
      tmp=$(mktemp "$run/env.XXXXXXXX")
      cat > "$tmp" <<VARS
DEMO_DB_PASSWORD=$demo
TEST_DB_PASSWORD=$testpw
DATABASE_URL=postgresql://uniswap:$demo@127.0.0.1:55432/uniswap_demo
TEST_DATABASE_URL=postgresql://uniswap:$testpw@127.0.0.1:55433/uniswap_test
JWT_SECRET=$jwt
SMTP_URL=smtp://127.0.0.1:51025
MAILPIT_API_URL=http://127.0.0.1:58025
STUDENT_EMAIL_DOMAINS=student.example.test
APP_ORIGIN=http://127.0.0.1:3000
VARS
      mv "$tmp" "$run/local.env"
    fi
    compose up -d --wait --wait-timeout 120
    curl --retry 12 --retry-connrefused --retry-delay 1 -fsS --max-time 5 http://127.0.0.1:58025/api/v1/messages >/dev/null
    ;;
  stop) compose stop ;;
  *) echo 'Dùng check, up hoặc stop' >&2; exit 2 ;;
esac
