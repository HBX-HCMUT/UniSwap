"""Kiểm tra dấu vân tay của ứng viên, trạng thái bàn giao và bộ chứng cứ KT."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def fingerprint():
    files = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"]
    ).split(b"\0")
    digest = hashlib.sha256()
    for name in sorted(set(files) - {b""}):
        path = Path(os.fsdecode(name))
        if path.is_symlink():
            data = os.fsencode(os.readlink(path))
            mode = b"link"
        elif path.is_file():
            data = path.read_bytes()
            mode = str(path.stat().st_mode & 0o111).encode()
        else:
            continue
        digest.update(name + b"\0" + mode + b"\0" + hashlib.sha256(data).digest())
    return digest.hexdigest()


def evidence(folder):
    cases = re.findall(r"^\| (KT\d+[a-z]?) ·", Path("docs/nghiem-thu.md").read_text(), re.M)
    if len(set(cases)) < 12:
        sys.exit("Danh sách KT không hợp lệ")
    for case in cases:
        log = folder / (case + ".log")
        if not log.is_file() or not log.read_text().strip():
            sys.exit(f"Thiếu chứng cứ {case}")
    print(f"Đã tìm thấy chứng cứ cho {len(set(cases))} ca")


if __name__ == "__main__":
    if sys.argv[1] == "fingerprint":
        print(fingerprint())
    elif sys.argv[1] == "evidence":
        evidence(Path(sys.argv[2]))
    elif sys.argv[1] == "status":
        item = json.loads(Path(sys.argv[2]).read_text())
        if not item.get("summary", "").strip() or item["status"] not in sys.argv[3:]:
            sys.exit("Bàn giao không hợp lệ")
        print(item["status"])
    else:
        sys.exit(2)
