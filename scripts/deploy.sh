#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/lib/portable.sh

for command_name in git docker curl python3; do
  command -v "$command_name" >/dev/null || { echo "Thiếu $command_name." >&2; exit 1; }
done

if [[ ! -f .agent-run/local.env ]]; then
  echo "Cần chạy bash agent/env.sh up và cấu hình APP_ORIGIN trong .agent-run/local.env trước." >&2
  exit 1
fi

# Khóa mặc định trên Linux giữ file descriptor 8 và tự nhả khi tiến trình kết thúc.
if ! portable_lock .agent-run/deploy.lock -n; then
  echo "Đang có một lượt deploy khác." >&2
  exit 1
fi

branch="$(git branch --show-current)"
working_tree_status="$(git status --porcelain)"
if [[ "$branch" != main || -n "$working_tree_status" ]]; then
  echo "Cần chạy deploy từ nhánh main với thư mục làm việc sạch." >&2
  exit 1
fi

git pull --ff-only origin main
local_commit="$(git rev-parse HEAD)"
remote_commit="$(git rev-parse FETCH_HEAD)"
if [[ "$local_commit" != "$remote_commit" ]]; then
  echo "Commit hiện tại chưa khớp với main trên origin." >&2
  exit 1
fi
printf 'Đang triển khai commit %s.\n' "$local_commit"

# Compose nạp env_file và chuẩn hóa environment thành object trong JSON.
app_origin="$(
  docker compose config --format json |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["services"]["api"].get("environment", {}).get("APP_ORIGIN", ""))'
)"
if [[ ! "$app_origin" =~ ^https?://[^/?#[:space:]]+/?$ ]]; then
  echo "Cần đặt APP_ORIGIN thành địa chỉ web, ví dụ https://uniswap.socodo.space." >&2
  exit 1
fi

bash agent/env.sh up
docker compose build api
docker compose run --rm --no-deps api npm run db:migrate
docker compose up -d --wait --wait-timeout 120
bash scripts/smoke.sh "$app_origin"
