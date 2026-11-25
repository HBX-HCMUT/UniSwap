# UniSwap · Chợ đồ cũ sinh viên

UniSwap giúp sinh viên tìm và trao đổi giáo trình, đồ ký túc xá, thiết bị học tập trong khu vực quanh trường: nhắn tin, giữ món, hẹn nhận, đánh giá hai chiều, quản trị tin. Bài tập lớn của **HBX Team**.

![Trang chợ UniSwap](docs/design/cho-uniswap.webp)

Stack: Next.js + TypeScript (frontend) · NestJS + Prisma + PostgreSQL (backend) · Mailpit (mail dev) · Docker Compose.

## Chạy demo (Docker, Linux/WSL)

```bash
bash agent/env.sh up
docker compose build api
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:seed
docker compose up -d --wait
```

App: http://127.0.0.1:3000 · API health: http://127.0.0.1:3001/api/v1/health · Mailpit: http://127.0.0.1:58025. Mật khẩu mẫu: `UniSwapDemo123!` (`minh@`, `lan@`, `an@`, `admin@`, `chua-xac-minh@student.example.test`).

## Phát triển local

```bash
bash agent/env.sh up          # Postgres + Mailpit (chạy được cả macOS/Windows Git Bash)
set -a; source .agent-run/local.env; set +a
npm ci && npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev                   # web :3000 + API :3001, Ctrl+C tắt cả hai
```

Cổng mặc định: 3000 web, 3001 API, 55432/55433 Postgres, 51025/58025 Mailpit. Nếu cổng bị chiếm, dừng tiến trình đang dùng trước. Bản Docker đóng gói (`compose.yaml`) dùng `network_mode: host` nên chỉ chạy trên Linux/WSL; macOS/Windows chạy web/API bằng Node như trên.

## Kiểm thử

```bash
set -a; source .agent-run/local.env; set +a
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.agent-run/browsers"
npx playwright install chromium
export DATABASE_URL="$TEST_DATABASE_URL" NODE_ENV=test CI=true
export ACCEPTANCE_EVIDENCE_DIR="$PWD/.agent-run/evidence/local"
bash agent/acceptance.sh && python3 agent/check.py evidence "$ACCEPTANCE_EVIDENCE_DIR"
```

Bộ nghiệm thu: lint, typecheck, build, 51 thao tác HTTP theo OpenAPI, luồng trình duyệt Chromium, seed idempotent. Đạt **20/20 ca**. Cần Python 3; thiếu thư viện Chromium thì `npx playwright install --with-deps chromium`.

Trên Windows, sau khi nạp biến môi trường kiểm thử vào PowerShell, chạy `node agent/tests/acceptance.mjs`. Nếu Chromium đi kèm Playwright không khởi động, đặt `$env:ACCEPTANCE_BROWSER_CHANNEL = 'msedge'` để dùng Microsoft Edge đã cài. Nếu npm nằm ngoài thư mục cài Node.js, đặt `npm_execpath` trỏ tới tệp `npm-cli.js` của bản cài npm.

## AI review pull request

Workflow [`.github/workflows/ai-review.yml`](.github/workflows/ai-review.yml) gọi DeepSeek khi PR mở/cập nhật và cập nhật một comment review (tiếng Việt theo template báo cáo). Cần secret `DEEPSEEK_API_KEY`; tuỳ chọn variable `DEEPSEEK_MODEL` (mặc định `deepseek-chat`) và `DEEPSEEK_BASE_URL`. Thiếu secret không làm đỏ PR. `ci.yml` vẫn là gate bắt buộc.

## Tài liệu

| Cần tìm | Tài liệu |
|---|---|
| Yêu cầu, nghiệp vụ, kế hoạch | [Use case](docs/nghiep-vu.md) · [Kế hoạch](docs/ke-hoach.md) · [Báo cáo gốc](docs/Bao_cao_thao_luan_nhom_HBX_Team_cho_do_cu_sinh_vien.docx) |
| Kiến trúc, ERD, dữ liệu | [Kiến trúc](docs/kien-truc.md) · [ERD](docs/du-lieu.md) · [Luồng UI](docs/design/ui.md) |
| API | [docs/api.md](docs/api.md) · [openapi.yaml](docs/openapi.yaml) |
| Nghiệm thu | [docs/nghiem-thu.md](docs/nghiem-thu.md) |
| Mã nguồn | [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md) |

Codex (tùy chọn) điều phối agent AI qua `agent/run.sh`; các bước chạy app/test độc lập với runner AI. Dừng dịch vụ: `Ctrl+C` (dev), `docker compose stop` (Docker), `bash agent/env.sh stop` (DB + Mailpit). Dữ liệu và ảnh giữ trong volume.
