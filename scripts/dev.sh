#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .agent-run/local.env ]]; then
  set -a
  source .agent-run/local.env
  set +a
fi
: "${DATABASE_URL:?Cần cấu hình DATABASE_URL}" "${JWT_SECRET:?Cần cấu hình JWT_SECRET}"
api_pid='' web_pid=''
cleanup() {
  trap - EXIT INT TERM
  for pid in "$api_pid" "$web_pid"; do
    if [[ -n "$pid" ]]; then kill -- "-$pid" 2>/dev/null || true; fi
  done
  wait || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
setsid npm run dev -w backend & api_pid=$!
setsid npm run dev -w frontend -- --hostname 127.0.0.1 & web_pid=$!
wait -n "$api_pid" "$web_pid"
