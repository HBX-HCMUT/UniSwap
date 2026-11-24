#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

# Next.js đóng địa chỉ API riêng của lượt chạy vào bản build dùng chung.
mkdir -p .agent-run
exec 8>.agent-run/acceptance.lock
flock -w 1200 8
if [[ -z ${PLAYWRIGHT_BROWSERS_PATH:-} && -d .agent-run/browsers ]]; then
  export PLAYWRIGHT_BROWSERS_PATH="$PWD/.agent-run/browsers"
fi

exec node agent/tests/acceptance.mjs "$@"
