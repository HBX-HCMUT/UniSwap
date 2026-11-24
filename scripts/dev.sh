#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib/portable.sh
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
    if [[ -n "$pid" ]]; then
      portable_kill_tree "$pid"
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
portable_session npm run dev -w backend & api_pid=$!
portable_session npm run dev -w frontend -- --hostname 127.0.0.1 & web_pid=$!
if ((BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 3))); then
  wait -n "$api_pid" "$web_pid"
else
  # bash 3.2 (macOS mặc định) không có `wait -n`: chờ tới khi một bên dừng.
  while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do
    sleep 2
  done
fi
