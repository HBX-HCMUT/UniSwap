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
callback=/api/v1/auth/google/callback
[[ -f $env_file ]] || { echo "Chưa có $env_file, chạy 'bash agent/env.sh up' trước." >&2; exit 1; }
[[ $# -ge 2 ]] || { echo "Dùng: bash agent/google-oauth.sh <client-id> <client-secret> [redirect-uri]" >&2; exit 1; }

client_id=$1
client_secret=$2
[[ -n ${client_id// /} ]] || { echo "client-id không được rỗng." >&2; exit 1; }
[[ -n ${client_secret// /} ]] || { echo "client-secret không được rỗng." >&2; exit 1; }

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

# Ghi đè tại chỗ, giữ nguyên các biến khác và thứ tự; không nhân bản dòng.
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
trap - EXIT

echo "Đã ghi cấu hình Google vào $env_file"
echo "  redirect URI: $redirect"
echo
echo "Nhớ thêm chính xác URI này vào Google Cloud Console → Credentials → OAuth client →"
echo "Authorized redirect URIs, sau đó khởi động lại API."
