#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?Cách dùng: bash scripts/smoke.sh <URL>}"
base_url="${base_url%/}"
if [[ ! "$base_url" =~ ^https?://[^/?#[:space:]]+$ ]]; then
  echo "Cần truyền địa chỉ gốc của UniSwap, ví dụ https://uniswap.socodo.space." >&2
  exit 1
fi

curl_options=(--silent --show-error --connect-timeout 3 --max-time 10)

curl "${curl_options[@]}" --fail --retry 8 --retry-connrefused --retry-delay 2 \
  --url "$base_url/api/v1/health" |
  python3 -c '
import json
import sys

try:
    healthy = json.load(sys.stdin).get("ok") is True
except (ValueError, AttributeError):
    healthy = False

if not healthy:
    sys.exit("API health cần trả JSON với ok=true.")
'

home_status="$(curl "${curl_options[@]}" --output /dev/null --write-out '%{http_code}' --url "$base_url/")"
if [[ "$home_status" != 200 ]]; then
  echo "Trang chủ trả HTTP $home_status, cần HTTP 200." >&2
  exit 1
fi

profile_status="$(curl "${curl_options[@]}" --output /dev/null --write-out '%{http_code}' --url "$base_url/api/v1/me")"
if [[ "$profile_status" != 401 ]]; then
  echo "/api/v1/me trả HTTP $profile_status khi chưa đăng nhập, cần HTTP 401." >&2
  exit 1
fi

echo "Smoke test thành công tại $base_url."
