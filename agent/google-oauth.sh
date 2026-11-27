#!/usr/bin/env bash
# Thêm cấu hình Google OAuth vào .agent-run/local.env.
#
#   bash agent/google-oauth.sh
#   bash agent/google-oauth.sh <client-id> <client-secret> [redirect-uri]
#
# Redirect URI phải trùng khớp từng ký tự với mục "Authorized redirect URIs" trong
# Google Cloud Console. Mặc định lấy APP_ORIGIN trong local.env + /api/v1/auth/google/callback.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

env_file=.agent-run/local.env
callback=/api/v1/auth/google/callback
[[ -f $env_file ]] || { echo "Chưa có $env_file, chạy 'bash agent/env.sh up' trước." >&2; exit 1; }
case $# in
  0)
    read -r -p "Google Client ID: " client_id
    read -r -s -p "Google Client Secret: " client_secret
    printf '\n'
    ;;
  2|3)
    client_id=$1
    client_secret=$2
    ;;
  *)
    echo "Dùng: bash agent/google-oauth.sh [<client-id> <client-secret> [redirect-uri]]" >&2
    exit 1
    ;;
esac
[[ $client_id =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Client ID không hợp lệ." >&2; exit 1; }
[[ $client_secret =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Client Secret không hợp lệ." >&2; exit 1; }

# Bỏ nháy bao quanh và dấu / cuối để nối path không bị "//".
strip() {
  local value=$1
  value=${value%\"}; value=${value#\"}
  value=${value%\'}; value=${value#\'}
  printf '%s' "${value%/}"
}
app_origin=$(strip "$(sed -n 's/^APP_ORIGIN=//p' "$env_file" | tail -1)")
redirect=$(strip "${3:-${app_origin:-http://127.0.0.1:3000}$callback}")

case "$redirect" in
  http://127.0.0.1:*|http://localhost:*|https://*) ;;
  *) echo "Redirect URI phải là https, http://127.0.0.1 hoặc http://localhost." >&2; exit 1 ;;
esac
case "$redirect" in
  *"$callback") ;;
  *) echo "Redirect URI phải kết thúc bằng $callback (Google trả redirect_uri_mismatch nếu khác)." >&2; exit 1 ;;
esac

tmp=$(mktemp "$env_file.XXXXXX")
trap 'rm -f "$tmp"' EXIT

# Đọc giá trị qua môi trường để secret không xuất hiện trong đối số của awk.
OAUTH_CLIENT_ID=$client_id OAUTH_CLIENT_SECRET=$client_secret OAUTH_REDIRECT_URI=$redirect awk '
  BEGIN {
    id = ENVIRON["OAUTH_CLIENT_ID"]
    secret = ENVIRON["OAUTH_CLIENT_SECRET"]
    redirect = ENVIRON["OAUTH_REDIRECT_URI"]
  }
  /^GOOGLE_CLIENT_ID=/     { if (!done_id++) print "GOOGLE_CLIENT_ID=" id; next }
  /^GOOGLE_CLIENT_SECRET=/ { if (!done_secret++) print "GOOGLE_CLIENT_SECRET=" secret; next }
  /^GOOGLE_REDIRECT_URI=/  { if (!done_redirect++) print "GOOGLE_REDIRECT_URI=" redirect; next }
  { print }
  END {
    if (!done_id) print "GOOGLE_CLIENT_ID=" id
    if (!done_secret) print "GOOGLE_CLIENT_SECRET=" secret
    if (!done_redirect) print "GOOGLE_REDIRECT_URI=" redirect
  }
' "$env_file" >"$tmp"

mv "$tmp" "$env_file"
trap - EXIT

echo "Đã ghi cấu hình Google vào $env_file"
echo "  redirect URI: $redirect"
echo
echo "Nhớ thêm chính xác URI này vào Google Cloud Console → Credentials → OAuth client →"
echo "Authorized redirect URIs, sau đó khởi động lại API. Với Docker, chạy docker compose up -d --no-build."
