# Chạy đội agent không cần trực bàn phím

Dùng một máy phát triển Linux riêng hoặc VM có checkout UniSwap và giữ máy thức trong suốt lượt chạy. Runner thực thi cả script nghiệm thu do đội tạo trên máy này. Cấp cho tài khoản chạy quyền trên đúng checkout và Docker của môi trường thử nghiệm. Dùng dữ liệu hư cấu. Bộ runner không cần thông tin GitHub, khóa cloud hay tài khoản ngân hàng.

## Chuẩn bị một lần

1. Có Git, Bash, Python 3, Node.js và npm, Docker Engine + Compose có hỗ trợ --wait, curl, OpenSSL, flock và GNU timeout. Cài các thư viện hệ thống cho Chromium headless trên VM trước lượt dài. Với distro được Playwright hỗ trợ, có thể dùng lệnh cài dependency hệ thống của Playwright ở bước chuẩn bị máy. Leader khóa phiên bản Node, Playwright và package ở M0, cài browser đúng phiên bản trong thư mục cache của workspace (ví dụ .agent-run/browsers).
2. Dùng Codex CLI hỗ trợ exec, output-schema và multi_agent_v2. Cú pháp runner đã đối chiếu với CLI 0.171.0. Chạy `codex login` một lần nếu cần, bảo đảm tài khoản được dùng gpt-6.2-astra và gpt-6.1-terra. Máy cần mạng đến Codex, registry npm, kho ảnh container và mirror trình duyệt. Thử preflight dưới cùng tài khoản sẽ chạy unattended.
3. Nếu chuyển sang máy khác, mang theo trạng thái checkout đang làm, gồm tài liệu và thư mục agent/. Nếu dùng git clone, cần lưu các tệp này vào commit mà máy đó lấy được. Repo hiện tại có thể chạy trực tiếp trên working tree.
4. Trong thư mục gốc chạy các lệnh sau. Bước up tự tạo mật khẩu ngẫu nhiên ở lần đầu, tái sử dụng cấu hình khi chạy lại, rồi chờ dịch vụ sẵn sàng.

```bash
bash agent/env.sh check
bash agent/env.sh up
```

| Tài nguyên | Địa chỉ trên VM | Cách sử dụng |
|---|---|---|
| PostgreSQL demo | 127.0.0.1:55432 / uniswap_demo | DATABASE_URL cho app demo |
| PostgreSQL test | 127.0.0.1:55433 / uniswap_test | TEST_DATABASE_URL cho test, volume và mật khẩu riêng |
| SMTP thử nghiệm | 127.0.0.1:51025 | Gửi email xác thực tới hộp thư local |
| HTTP Mailpit | http://127.0.0.1:58025 | Tester đọc thư bằng API, lọc theo email riêng của test |
| Trạng thái runner | .agent-run/ | local.env, cache, board, kết quả, log và chứng cứ, được Git ignore |

Nạp .agent-run/local.env trong tiến trình app local. Đối với mọi test có ghi dữ liệu, đặt DATABASE_URL bằng TEST_DATABASE_URL và kiểm host, port, tên DB đúng bộ test **trước migration/reset**. Lệnh acceptance được runner truyền các biến này. Các agent tự chạy test dùng cùng nguyên tắc. Tách upload test theo lần chạy. URL cho web/API demo theo docs/kien-truc.md; E2E có thể dùng cổng app riêng. Runner đặt cache npm và Playwright trong .agent-run/. Khi cài browser, tester dùng cùng PLAYWRIGHT_BROWSERS_PATH với tiến trình acceptance.

## Khởi chạy khi muốn bắt đầu code

```bash
bash agent/run.sh
```

Để runner tiếp tục khi đóng terminal trên VM, có thể chạy nền:

```bash
mkdir -p .agent-run
nohup bash agent/run.sh > .agent-run/runner.log 2>&1 < /dev/null &
```

Runner tự thực hiện up, khóa một lượt chạy cho mỗi checkout và mở Astra trong chế độ codex exec. Thiết lập workspace-write, truy cập mạng cho dịch vụ local/dependency và policy never áp dụng theo từng lần gọi. Policy never trả lỗi tại chỗ khi thao tác vượt quyền. Với host áp policy hạn chế mạng hoặc loopback, cần chuẩn bị VM có quyền thực thi phù hợp trước lượt dài. Tài khoản Codex đã đăng nhập vẫn cần quota và quyền model trong toàn bộ thời gian chạy. [Codex non-interactive](https://developers.openai.com/codex/noninteractive/) · [Subagents](https://developers.openai.com/codex/subagents/)

## Cách vòng chạy ra quyết định

- Astra đọc kế hoạch và tự giao việc, từ M0 tới M4. Mỗi lượt leader xử lý một gói việc và ghi checkpoint ngắn ở .agent-run/checkpoint.md. PROGRESS tự mở lượt kế tiếp. Khi leader trả READY, runner lấy SHA-256 của các tệp nguồn tracked và untracked đang hiện diện ngoài danh sách ignore. Kết quả lưu trong .agent-run/run-*/<vòng>/.
- Trong đợt setup, agent/acceptance.sh là deliverable của tester ở M0 và được hoàn thiện xuyên các mốc. Nếu thiếu lệnh này khi bàn giao, gate thất bại. Runner chạy nó với CI=true, DB test, timeout và thư mục chứng cứ mới cho từng vòng. Tester đối chiếu từng log với assertion thực tế.
- Gate lỗi được trả thẳng cho leader. Sau khi gate đạt, runner gọi Terra trong một phiên độc lập sau giai đoạn triển khai. Terra rà gate, chạy lại ca trọng yếu, ghi chứng cứ recheck và trả verdict. PASS cần đồng thời gate đạt, đủ log từng KT, có log recheck, tester PASS và fingerprint không đổi. Log được tạo ở mỗi vòng, tách khỏi mã nguồn.
- Nếu có lỗi sản phẩm, runner ghi phản hồi cho vòng sửa, tự mở phiên leader mới, đọc lại board và tiếp tục. BLOCKED dành cho phụ thuộc ngoài không thể giải quyết trong môi trường đã cấp. Hết quota, mất login, mất host hoặc timeout có thể làm CLI dừng. Trạng thái vẫn còn trên đĩa.
- Mặc định leader dùng high. Có thể đặt LEADER_EFFORT=medium để giảm mức suy luận. MAX_LEADER_STEPS (mặc định 12) giới hạn tổng số phiên leader mỗi lần gọi runner; đây là giới hạn số lượt, không phải hạn mức token. Mặc định tối đa 5 vòng triển khai–nghiệm thu mỗi lần gọi, tối đa 4 giờ mỗi phiên model và 45 phút cho acceptance để kiểm soát tài nguyên. Đây là giới hạn mỗi lần chạy, áp dụng cả khi gate chưa đạt. Ví dụ tăng thời gian trước khi chạy dài:

```bash
MAX_ROUNDS=8 AGENT_TIMEOUT=6h ACCEPTANCE_TIMEOUT=90m bash agent/run.sh
```

Xem .agent-run/feedback.txt, board.md, file *.console và verdict cuối cùng. Runner trả 0 khi đạt; 1 khi hết vòng; 3 khi nhận BLOCKED; lỗi preflight/CLI giữ mã lỗi tương ứng. Sau khi khôi phục điều kiện ngoài, chạy lại cùng lệnh để tiếp tục từ checkout, board và phản hồi. Tắt dịch vụ bằng `bash agent/env.sh stop`. Volume và local.env cần được giữ cùng nhau để khởi động lại.

## Ranh giới của lần chạy tự động

Tự động hóa được seed dữ liệu, đọc thư xác thực, nhiều phiên trình duyệt, thao tác admin, thanh toán COD/QR thủ công theo kịch bản giả lập và kiểm thử chấp thuận đồng thời. Đăng nhập Google trong sản phẩm dùng OAuth cấu hình qua môi trường. Theo KT01, test tự động dùng danh tính thử và ghi rõ mức xác minh. Nếu cần bằng chứng với Google thật, chủ ứng dụng cần cấp OAuth client, redirect URI và tài khoản trường phù hợp riêng. Báo cáo cuối phải phân biệt trạng thái này với kết quả MVP local.
