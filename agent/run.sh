#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
base=.agent-run
mkdir -p "$base"
exec 9>"$base/run.lock"
flock -n 9 || { echo 'Một runner đang hoạt động' >&2; exit 2; }
limit=${MAX_ROUNDS:-5}
[[ "$limit" =~ ^[1-9][0-9]*$ ]] || { echo 'MAX_ROUNDS cần là số nguyên dương' >&2; exit 2; }
steps=${MAX_LEADER_STEPS:-12}
effort=${LEADER_EFFORT:-high}
[[ "$steps" =~ ^[1-9][0-9]*$ && "$effort" =~ ^(medium|high)$ ]] || { echo 'Kiểm tra MAX_LEADER_STEPS và LEADER_EFFORT' >&2; exit 2; }
bash agent/env.sh check
bash agent/env.sh up
session=$(mktemp -d "$base/run-XXXXXXXX")
echo "Thư mục kết quả: $session"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/$base/browsers"
export npm_config_cache="$PWD/$base/npm-cache"
# Dùng workspace-write trong máy phát triển biệt lập; dịch vụ local và npm cần mạng.
invoke() {
  local model=$1 effort=$2 outfile=$3 prompt=$4
  timeout --kill-after=30s "${AGENT_TIMEOUT:-4h}" codex -a never exec \
    --enable multi_agent_v2 -c agents.max_threads=2 \
    -c sandbox_workspace_write.network_access=true \
    -c "model_reasoning_effort=\"$effort\"" -s workspace-write -m "$model" \
    --output-schema agent/verdict.schema.json -o "$outfile" "$prompt" \
    >"$outfile.console" 2>&1
}
feedback="$base/feedback.txt"
step=0
last_failed=""
for ((round=1; round<=limit; round++)); do
  out="$session/$round"
  mkdir -p "$out/kt"
  while true; do
    ((step+=1))
    ((step <= steps)) || { echo "Chạm giới hạn lượt leader; xem $base/checkpoint.md"; exit 1; }
    result="$out/leader-$step.json"
    echo "Lượt leader $step/$steps · nghiệm thu $round/$limit · $effort"
    invoke gpt-6.2-astra "$effort" "$result" \
      "Chế độ tiết kiệm. Đọc $base/checkpoint.md nếu có, phần cuối board.md trong $base và $feedback nếu có. Theo agent/agent_leader.md. Chọn đúng một gói việc còn thiếu từ trạng thái hiện tại. Dùng bằng chứng cũ nếu phần mã liên quan chưa đổi. Tự làm hoặc giao tối đa một Terra medium phạm vi hẹp. Chỉ đọc mục tài liệu liên quan; chuyển log dài ra file, chỉ đọc đoạn lỗi. Cập nhật $base/checkpoint.md sau từng kết quả (tối đa 12 dòng: việc xong, tệp đổi, test/log, lỗi, bước tiếp). Trả PROGRESS để tự chuyển gói, READY khi đủ điều kiện nghiệm thu toàn MVP, BLOCKED khi hết đường tiến. Tóm tắt cả bước tiếp trong summary."
    state=$(python3 agent/check.py status "$result" PROGRESS READY BLOCKED)
    if [[ $state == BLOCKED ]]; then cp "$result" "$feedback"; exit 3; fi
    [[ $state == READY ]] && break
    cp "$result" "$feedback"
  done
  candidate=$(python3 agent/check.py fingerprint)
  echo "$candidate" > "$out/candidate.sha256"
  echo "Vòng $round/$limit · chạy nghiệm thu"
  # Chỉ nạp secrets demo/test cho tiến trình acceptance.
  if ! (
    set -a
    source "$base/local.env"
    set +a
    unset DEMO_DB_PASSWORD TEST_DB_PASSWORD
    export DATABASE_URL="$TEST_DATABASE_URL" NODE_ENV=test CI=true
    export ACCEPTANCE_EVIDENCE_DIR="$PWD/$out/kt"
    timeout --kill-after=30s "${ACCEPTANCE_TIMEOUT:-45m}" bash agent/acceptance.sh
  ) >"$out/acceptance.log" 2>&1; then
    echo "Nghiệm thu thất bại; xem $out/acceptance.log. Leader rà nguyên nhân." >"$feedback"
    gate=FAIL
  elif ! python3 agent/check.py evidence "$out/kt" >>"$out/acceptance.log" 2>&1; then
    echo "Thiếu chứng cứ; xem $out/acceptance.log." >"$feedback"
    gate=FAIL
  else
    gate=PASS
  fi
  if [[ $gate == FAIL ]]; then
    tail -c 3000 "$out/acceptance.log" >> "$feedback"
    if [[ $last_failed == "$candidate" ]]; then
      echo "Ứng viên chưa đổi sau hai lần gate lỗi; xem $feedback"; exit 1
    fi
    last_failed=$candidate
    continue
  fi
  echo "Vòng $round/$limit · tester độc lập"
  invoke gpt-6.1-terra medium "$out/tester.json" \
    "Bạn là tester cuối độc lập. Đọc AGENTS.md, agent/agent_tester.md và docs/nghiem-thu.md. Ứng viên $candidate. Gate máy: $gate. Đọc $out/acceptance.log và $out/kt. Tự chạy lại ca rủi ro với DB test và lưu bằng chứng bổ sung vào $out/recheck/. Giữ nguyên mã ứng viên. Giao verdict PASS, FAIL hoặc BLOCKED theo kết quả thực, kèm lý do và bằng chứng."
  state=$(python3 agent/check.py status "$out/tester.json" PASS FAIL BLOCKED)
  actual=$(python3 agent/check.py fingerprint)
  if [[ $gate == PASS && $state == PASS && $actual == "$candidate" ]] && \
      [[ -d "$out/recheck" && -n "$(find "$out/recheck" -type f -size +0c -print -quit)" ]]; then
    echo "PASS · $out/tester.json · $candidate" | tee "$feedback"
    exit 0
  fi
  {
    echo "Xem $out/tester.json, $out/acceptance.log và $out/recheck/. Gate=$gate, tester=$state."
    echo "Candidate=$candidate, hiện tại=$actual. Cần log recheck độc lập."
    cat "$out/tester.json"
  } > "$feedback"
  if [[ $state == BLOCKED ]]; then echo "BLOCKED · $feedback"; exit 3; fi
done
echo "Chưa đạt sau $limit vòng; checkpoint tại $feedback" >&2
exit 1
