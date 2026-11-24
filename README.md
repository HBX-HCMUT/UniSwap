# UniSwap · Chợ đồ cũ sinh viên

UniSwap giúp sinh viên tìm và trao đổi giáo trình, đồ ký túc xá và thiết bị học tập trong khu vực quanh trường. Người mua có thể nhắn tin, giữ món và hẹn nhận. Sau khi giao nhận, hai bên có thể đánh giá nhau. Đây là bài tập lớn của **HBX Team**.

![Trang chợ UniSwap với bộ lọc và các tin đăng mẫu](docs/design/cho-uniswap.webp)

[Chạy demo](#chạy-demo-bằng-docker) · [Phát triển local](#phát-triển-local) · [Dừng dịch vụ](#dừng-và-chạy-lại) · [Kiểm thử](#kiểm-thử) · [Tài liệu](#tài-liệu-dự-án)

## Tính năng

- **Chợ sinh viên** · Xác thực email trường, đăng tin có ảnh, tìm theo từ khóa và lọc theo trường, khu vực, danh mục, tình trạng và giá.
- **Giao dịch** · Nhắn tin, yêu cầu giữ món, chốt lịch hẹn, trả tiền khi nhận hoặc chuyển khoản QR thủ công và đánh giá hai chiều. Mỗi món chỉ được giữ cho một người mua tại cùng thời điểm.
- **Theo dõi và quản trị** · Lưu tin, theo dõi người bán hoặc danh mục, nhận thông báo, báo cáo tin và xử lý vi phạm.

Giao diện dùng Next.js và TypeScript. API REST dùng NestJS, Prisma và PostgreSQL. Mailpit nhận thư xác thực trong môi trường demo.

## Chạy demo bằng Docker

Chạy các lệnh trong thư mục gốc của bản clone. Dùng **Linux** hoặc môi trường Linux trên Windows/macOS, chẳng hạn WSL 2 hoặc máy ảo. Bản Docker đóng gói dùng host networking, nên Docker Engine cần chạy trong cùng môi trường Linux với shell. Cần Docker Compose hỗ trợ `--wait`, Bash, `curl`, `openssl` và `flock`. Luồng này chỉ cần Docker để chạy Node.js và ứng dụng.

### 1. Bật database và hộp thư

```bash
bash agent/env.sh up
```

Lệnh tạo `.agent-run/local.env` ở lần chạy đầu, sau đó bật PostgreSQL demo, PostgreSQL test và Mailpit bằng Docker Compose. Mailpit giữ thư trong hộp thư phát triển để bạn mở liên kết xác thực bằng trình duyệt. Tệp cấu hình local có mật khẩu được tạo tự động và được Git bỏ qua.

### 2. Build, tạo bảng và nạp dữ liệu mẫu

```bash
docker compose build api
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:seed
docker compose up -d --wait
```

Mỗi bước cần thành công trước khi chạy bước kế tiếp. Lần build đầu cần tải image và các gói npm. Migration và seed có thể chạy lại khi cập nhật dự án.

### 3. Mở ứng dụng

| Dịch vụ | Địa chỉ |
|---|---|
| UniSwap | [127.0.0.1:3000](http://127.0.0.1:3000) |
| Kiểm tra API và kết nối database | [/api/v1/health](http://127.0.0.1:3001/api/v1/health) |
| Hộp thư xác thực Mailpit | [127.0.0.1:58025](http://127.0.0.1:58025) |

Mật khẩu của các tài khoản mẫu là `UniSwapDemo123!`.

| Tài khoản | Dùng để thử |
|---|---|
| `minh@student.example.test` | Đăng tin và chốt lịch hẹn |
| `lan@student.example.test` | Tìm món, nhắn tin, giữ món và đánh giá |
| `an@student.example.test` | Thử hai người cùng muốn giữ một món |
| `admin@student.example.test` | Duyệt hoặc gỡ tin, khóa tài khoản và xem thống kê |
| `chua-xac-minh@student.example.test` | Thử gửi lại thư xác thực |

Mở Minh và Lan ở hai hồ sơ trình duyệt riêng để thử luồng **đăng tin → nhắn tin → giữ món → xác nhận đã nhận → đánh giá**. Seed cũng chuẩn bị một tin đang hẹn có báo cáo mở để thử quản trị. [Kịch bản demo chi tiết](docs/nghiem-thu.md)

## Phát triển local

Dùng cách này nếu cần sửa mã và tải lại tự động. Cài Node.js theo [`.nvmrc`](.nvmrc), npm theo [`package.json`](package.json) và các công cụ hạ tầng ở trên. Script `npm run dev` dùng `setsid` từ util-linux. Nếu đang chạy web/API bằng Docker, dừng hai container ấy bằng `docker compose stop` để giải phóng cổng 3000 và 3001.

```bash
bash agent/env.sh up
set -a
source .agent-run/local.env
set +a

npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Giữ terminal mở và truy cập [127.0.0.1:3000](http://127.0.0.1:3000). Frontend chuyển tiếp các request `/api/v1` tới NestJS. Thư xác thực và cookie phiên dùng `APP_ORIGIN`, vì vậy hãy mở đúng hostname đã cấu hình.

### macOS và Windows (Git Bash)

`agent/env.sh`, `scripts/dev.sh` và `agent/acceptance.sh` tự nhận môi trường qua [`scripts/lib/portable.sh`](scripts/lib/portable.sh):

| Môi trường | Khoá file | Tắt cả cây tiến trình |
|---|---|---|
| Linux | `flock` (util-linux) | `setsid` + `kill -<pgid>` |
| macOS | `python3` + `fcntl` trên fd thừa kế | `perl setpgrp` + `kill -<pgid>` |
| Windows Git Bash | `mkdir` nguyên tử (có dọn khoá mồ côi theo pid) | `taskkill /T /F` |

Nhờ vậy `bash agent/env.sh up` và `npm run dev` chạy trực tiếp trên macOS và trên Windows dùng **Git Bash** (không phải PowerShell/cmd), không cần util-linux hay WSL. Trên Windows cần Node.js, Git Bash và Docker Desktop; `python3` chỉ cần cho `agent/acceptance.sh`. Riêng bản Docker đóng gói ở [`compose.yaml`](compose.yaml) dùng `network_mode: host` nên vẫn cần Linux/WSL; trên macOS và Windows hãy chạy web và API bằng Node như mục này.

## Dừng và chạy lại

| Muốn dừng | Thao tác |
|---|---|
| Web và API do `npm run dev` mở | Nhấn `Ctrl+C` trong terminal đang chạy |
| Web và API chạy bằng Docker | `docker compose stop` |
| Hai database và Mailpit | `bash agent/env.sh stop` |

Các lệnh dừng giữ lại dữ liệu PostgreSQL và ảnh trong volume. Để mở lại bản Docker với mã và dữ liệu đã chuẩn bị, chạy `bash agent/env.sh up` rồi `docker compose up -d --wait`. Sau khi đổi mã, build lại bằng `docker compose build api` và chạy migration trước khi mở app.

Nếu app chưa lên, dùng `docker compose ps` và `docker compose logs --tail=80 api web`. Nếu một cổng bị chiếm, dừng tiến trình đang dùng cổng đó trước khi mở app. Các cổng mặc định là 3000, 3001, 55432, 55433, 51025 và 58025.

## Kiểm thử

Trên Linux, cài dependency và mở hạ tầng theo mục phát triển local. Chạy các lệnh sau từ gốc repo. Bộ nghiệm thu tự mở web/API trên cổng riêng, chạy lint, typecheck, build, kiểm thử API và Chromium. Dữ liệu test dùng một schema riêng trong `uniswap_test`.

```bash
set -a
source .agent-run/local.env
set +a

export PLAYWRIGHT_BROWSERS_PATH="$PWD/.agent-run/browsers"
npx playwright install chromium
export DATABASE_URL="$TEST_DATABASE_URL" NODE_ENV=test CI=true
export ACCEPTANCE_EVIDENCE_DIR="$PWD/.agent-run/evidence/local"
bash agent/acceptance.sh &&
python3 agent/check.py evidence "$ACCEPTANCE_EVIDENCE_DIR"
```

Cần Python 3 cho bước kiểm tra bằng chứng. Nếu Linux thiếu thư viện chạy Chromium, cài bằng `npx playwright install --with-deps chromium`. Kết quả từng ca lưu ở thư mục bằng chứng.

Bản bàn giao đã đạt **20/20 ca nghiệm thu local**. Bộ kiểm thử gọi đủ 51 thao tác HTTP trong OpenAPI và kiểm tra cả luồng demo trên trình duyệt. [Tiêu chí nghiệm thu](docs/nghiem-thu.md) · [Workflow CI](.github/workflows/ci.yml)

## AI review pull request (DeepSeek)

Workflow [`.github/workflows/ai-review.yml`](.github/workflows/ai-review.yml) chạy khi PR mở/cập nhật và **cập nhật một comment review** (không spam mỗi lần push).

1. Thêm secret `DEEPSEEK_API_KEY` (Settings → Secrets and variables → Actions).
2. Tuỳ chọn: thêm variable `DEEPSEEK_MODEL` (mặc định `deepseek-chat`; dùng `deepseek-reasoner` nếu muốn suy luận sâu hơn).
3. Chạy tay: Actions → "AI review" → Run workflow, nhập số PR.

Review bỏ qua file khoá, ảnh và file sinh tự động, cắt diff trên 60.000 ký tự, tối đa 8 góp ý. Thiếu secret (PR từ fork) hoặc lỗi API **không làm đỏ PR**. Đây là gợi ý tự động, không thay review của người; `ci.yml` vẫn là gate bắt buộc.

## Cấu hình và phạm vi demo

- Tham khảo [`.env.example`](.env.example) để bổ sung cấu hình vào `.agent-run/local.env`. Khi đổi `API_ORIGIN` cho bản đóng gói, cập nhật build arg trong [Compose](compose.yaml) rồi build lại web.
- Demo dùng miền `student.example.test` và SMTP local. Luồng Google OAuth đã được kiểm thử với nhà cung cấp giả lập. Để thử Google thật, cấu hình OAuth client, secret, redirect URI và miền email được chấp nhận rồi khởi động lại API.
- Đối soát chuyển khoản QR do hai bên thực hiện thủ công. PayOS và GHN là phần mở rộng theo [kế hoạch](docs/ke-hoach.md).

## Tài liệu dự án

| Cần tìm | Tài liệu |
|---|---|
| Yêu cầu và phạm vi | [Báo cáo gốc của HBX Team](docs/Bao_cao_thao_luan_nhom_HBX_Team_cho_do_cu_sinh_vien.docx) · [Use case](docs/nghiep-vu.md) · [Kế hoạch](docs/ke-hoach.md) |
| Giao diện và kiến trúc | [Luồng điều hướng](docs/design/ui.md) · [Kiến trúc](docs/kien-truc.md) · [ERD](docs/du-lieu.md) |
| Mã nguồn | [Next.js trong frontend](frontend/README.md) · [NestJS và Prisma trong backend](backend/README.md) |
| API và nghiệm thu | [API](docs/api.md) · [OpenAPI](docs/openapi.yaml) · [Nghiệm thu](docs/nghiem-thu.md) |
| Phát triển với agent AI | [Quy ước repo](AGENTS.md) · [Runner và các vai trò](agent/README.md) |

Codex là công cụ tùy chọn để điều phối agent AI qua `agent/run.sh`. Các bước mở ứng dụng và chạy bộ kiểm thử ở trên chạy độc lập với runner AI.
