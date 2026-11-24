#!/usr/bin/env bash
# Trợ giúp để các script của repo chạy trên Linux, macOS và Windows (Git Bash/MSYS2).
#
# Linux            : có flock, setsid (util-linux).
# macOS            : không có flock/setsid -> python3 + fcntl, perl setpgrp; bash 3.2.
# Windows Git Bash : không có flock/setsid, python không có fcntl, perl không có setpgrp
#                    -> khoá bằng mkdir (nguyên tử), dọn tiến trình bằng taskkill /T.
#
# Tránh cú pháp bash 4+ (wait -n, mapfile...) vì macOS mặc định vẫn là bash 3.2.

portable_have() { command -v "$1" >/dev/null 2>&1; }

if [ -z "${PORTABLE_OS:-}" ]; then
  case "$(uname -s 2>/dev/null)" in
    Darwin) PORTABLE_OS=macos ;;
    Linux) PORTABLE_OS=linux ;;
    MINGW*|MSYS*|CYGWIN*) PORTABLE_OS=windows ;;
    *) PORTABLE_OS=other ;;
  esac
fi

PORTABLE_PYTHON=''
for candidate in python3 python py; do
  if portable_have "$candidate"; then
    PORTABLE_PYTHON=$candidate
    break
  fi
done

# portable_lock <đường dẫn file khoá> [-n | -w giây]
# Tương đương `exec 8>file && flock 8` nhưng chọn cách khoá theo môi trường:
#   flock  : Linux (và bất cứ đâu có flock)
#   fcntl  : macOS/Linux qua python3, khoá trên fd thừa kế nên vẫn giữ sau khi python thoát
#   mkdir  : Windows Git Bash, tạo thư mục là thao tác nguyên tử
# Đặt PORTABLE_LOCK=flock|fcntl|mkdir để ép một cách (dùng khi kiểm thử).
portable_lock() {
  local path=$1
  shift
  local mode=block secs=''
  while [ $# -gt 0 ]; do
    case $1 in
      -n|--nonblock) mode=nonblock; shift ;;
      -w|--wait|--timeout) mode=wait; secs=$2; shift 2 ;;
      -w*) mode=wait; secs=${1#-w}; shift ;;
      *) shift ;;
    esac
  done

  local backend=${PORTABLE_LOCK:-auto}
  if [ "$backend" = auto ]; then
    if portable_have flock; then
      backend=flock
    elif [ "$PORTABLE_OS" = windows ] || [ -z "$PORTABLE_PYTHON" ]; then
      backend=mkdir
    else
      backend=fcntl
    fi
  fi

  if [ "$backend" = flock ]; then
    exec 8>"$path"
    if [ "$mode" = nonblock ]; then flock -n 8; return; fi
    if [ "$mode" = wait ]; then flock -w "$secs" 8; return; fi
    flock 8
    return
  fi

  if [ "$backend" = fcntl ]; then
    exec 8>"$path"
    PORTABLE_FLOCK_FD=8 PORTABLE_FLOCK_MODE=$mode PORTABLE_FLOCK_SECS=$secs "$PORTABLE_PYTHON" - <<'PY'
import fcntl, os, sys, time

fd = int(os.environ["PORTABLE_FLOCK_FD"])
mode = os.environ.get("PORTABLE_FLOCK_MODE", "block")
secs = os.environ.get("PORTABLE_FLOCK_SECS", "")


def acquire():
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


if mode == "block":
    fcntl.flock(fd, fcntl.LOCK_EX)
elif mode == "nonblock":
    sys.exit(0 if acquire() else 1)
else:
    deadline = time.time() + float(secs or 0)
    while True:
        if acquire():
            break
        if time.time() >= deadline:
            sys.exit(1)
        time.sleep(0.2)
PY
    return
  fi

  # mkdir: không có khoá của kernel nên ghi pid để lần sau dọn khoá mồ côi.
  local lockdir="$path.lockdir" holder='' deadline=0
  if [ "$mode" = wait ]; then deadline=$(( $(date +%s) + ${secs:-0} )); fi
  while :; do
    if mkdir "$lockdir" 2>/dev/null; then
      echo $$ >"$lockdir/pid"
      return 0
    fi
    holder=''
    if [ -f "$lockdir/pid" ]; then holder=$(cat "$lockdir/pid" 2>/dev/null || true); fi
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
      rm -rf "$lockdir"
      continue
    fi
    if [ "$mode" = nonblock ]; then return 1; fi
    if [ "$mode" = wait ] && [ "$(date +%s)" -ge "$deadline" ]; then return 1; fi
    sleep 0.2
  done
}

# portable_session <lệnh...>
# Chạy lệnh sao cho `portable_kill_tree <pid>` tắt được cả cây tiến trình
# (npm -> tsc-watch -> node), tránh sót tiến trình giữ cổng 3000/3001.
# Windows không có process group nên chạy thẳng; bù lại dùng taskkill /T.
portable_session() {
  if [ "$PORTABLE_OS" = windows ]; then exec "$@"; fi
  if portable_have setsid; then exec setsid "$@"; fi
  if portable_have perl; then
    exec perl -e 'setpgrp(0, 0); exec @ARGV; die "exec: $!\n"' -- "$@"
  fi
  exec "$@"
}

# portable_kill_tree <pid> [tín hiệu]
portable_kill_tree() {
  local pid=$1
  [ -n "$pid" ] || return 0
  if [ "$PORTABLE_OS" = windows ] && portable_have taskkill; then
    taskkill //T //F //PID "$pid" >/dev/null 2>&1 && return 0
  fi
  # Dấu trừ = giết cả process group; không có group thì giết từng tiến trình.
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
}
