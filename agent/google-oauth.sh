#!/usr/bin/env bash
# Thêm cấu hình Google OAuth vào .agent-run/local.env.
#
#   bash agent/google-oauth.sh <client-id> <client-secret> [redirect-uri]
#
# Redirect URI phải trùng khớp từng ký tự với mục "Authorized redirect URIs" trong
# Google Cloud Console. Mặc định lấy APP_ORIGIN trong local.env + /api/v1/auth/google/callback.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

env_file=.agent-run/local.env
[[ -f $env_file ]] || { echo "Chưa có $env_file, chạy 'bash agent/env.sh up' trước." >&2; exit 1; }
[[ $# -ge 2 ]] || { echo "Dùng: bash agent/google-oauth.sh <client-id> <client-secret> [redirect-uri]" >&2; exit 1; }

client_id=$1
client_secret=$2
app_origin=$(sed -n 's/^APP_ORIGIN=//p' "$env_file" | tail -1)
redirect=${3:-${app_origin:-http://127.0.0.1:3000}/api/v1/auth/google/callback}

case "$redirect" in
  http://127.0.0.1:*|http://localhost:*|https://*) ;;
  *) echo "Redirect URI phải là https, http://127.0.0.1 hoặc http://localhost." >&2; exit 1 ;;
esac

# Ghi đè tại chỗ, giữ nguyên các biến khác và thứ tự.
tmp=$(mktemp "$env_file.XXXXXX")
grep -vE '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|GOOGLE_REDIRECT_URI)=' "$env_file" >/dev/null || true
awk -v id="$client_id" -v secret="$client_secret" -v redirect="$redirect" '
  BEGIN { done_id = done_secret = done_redirect = 0 }
  /^GOOGLE_CLIENT_ID=/      { print "GOOGLE_CLIENT_ID=" id; done_id = 1; next }
  /^GOOGLE_CLIENT_SECRET=/  { print "GOOGLE_CLIENT_SECRET=" secret; done_secret = 1; next }
  /^GOOGLE_REDIRECT_URI=/   { print "GOOGLE_REDIRECT_URI=" redirect; done_redirect = 1; next }
  { print }
  END {
    if (!done_id) print "GOOGLE_CLIENT_ID=" id
    if (!done_secret) print "GOOGLE_CLIENT_SECRET=" secret
    if (!done_redirect) print "GOOGLE_REDIRECT_URI=" redirect
  }
' "$env_file" >"$tmp"
mv "$tmp" "$env_file"

echo "Đã ghi cấu hình Google vào $env_file"
echo "  redirect URI: $redirect"
echo
echo "Nhớ thêm chính xác URI này vào Google Cloud Console → Credentials → OAuth client →"
echo "Authorized redirect URIs, sau đó khởi động lại API."
