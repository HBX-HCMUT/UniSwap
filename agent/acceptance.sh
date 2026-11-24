#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib/portable.sh
umask 077

# Next.js đóng địa chỉ API riêng của lượt chạy vào bản build dùng chung.
mkdir -p .agent-run
portable_lock .agent-run/acceptance.lock -w 1200
if [[ -z ${PLAYWRIGHT_BROWSERS_PATH:-} && -d .agent-run/browsers ]]; then
  export PLAYWRIGHT_BROWSERS_PATH="$PWD/.agent-run/browsers"
fi

exec node agent/tests/acceptance.mjs "$@"
