# Vận hành đội agent UniSwap

Đích bàn giao là toàn bộ UC01–UC10 chạy được qua giao diện và API, có dữ liệu demo lặp lại được và bằng chứng nghiệm thu trên cùng một bản mã. Đây là kế hoạch thực thi. Lệnh khởi chạy nằm trong [hướng dẫn môi trường](moi-truong.md).

| Vai trò | Phạm vi sở hữu | Điểm giao |
|---|---|---|
| [Astra điều phối](agent_leader.md) | Phạm vi, thứ tự, hạ tầng, tích hợp, hợp đồng chung | Giao ứng viên đã tích hợp cho tester |
| [Terra backend](agent_backend.md) | NestJS, Prisma, migration, dữ liệu, kiểm thử module | Bàn giao API đã gọi được cho UI và tester |
| [Terra UI và kết nối API](agent_ui_api.md) | Next.js, giao diện và HTTP client | Bàn giao hành trình chạy trên trình duyệt |
| [Terra tester](agent_tester.md) | Bộ kiểm thử chấp nhận độc lập, kết quả và bằng chứng | Ký PASS hoặc giao lỗi về leader |

Trong phiên triển khai, mặc định một Astra high và tối đa một Terra medium cùng hoạt động. Tester viết bộ kiểm thử từ sớm. Khi Astra bàn giao, runner chạy một phiên Terra mới làm người nghiệm thu cuối. Các file Markdown là chỉ dẫn được giao qua prompt. Runner chọn model của hai phiên chính; leader chỉ định model và đường dẫn chỉ dẫn khi giao mỗi việc con.

## Kế hoạch từ repo khung tới demo hoàn chỉnh

| Gói, phụ thuộc | Backend | UI và kết nối API | Bằng chứng tester |
|---|---|---|---|
| M0 · Nền chạy | Leader khởi tạo app, khóa phiên bản, thống nhất script, cấu hình; backend dựng Prisma, migration cơ sở và seed trường/danh mục/người dùng. Smoke /health | Web gọi được API qua /api/v1 cùng origin | Từ dữ liệu test riêng, chạy migration, seed hai lần, gọi health và mở web bằng trình duyệt headless |
| M1 · UC01–02, UC04 sau M0 | Xác thực SMTP, phiên, hồ sơ; catalog, ảnh local có phân quyền, tạo/sửa/ẩn/hiện/bán tin và lọc từ khóa | Đăng ký, nhận link từ thư, đăng nhập, hồ sơ, đăng 1–6 ảnh, quản lý tin và trang chi tiết | KT01 phần email, KT02, chi tiết KT03. Minh đăng, Lan xem ở cửa sổ riêng, Lan sửa giá bị chặn |
| M2a · UC03, UC05 sau M1 | Bộ lọc cùng phân trang, hội thoại theo người mua và tin, nhắn tin có lịch sử | Danh sách, lọc, hộp thư, polling, liên kết giao dịch | KT03–04, kiểm dữ liệu riêng tư và tải lại |
| M2b · UC06, UC08 sau M1, ghép M2a | Yêu cầu giữ, khóa DB, lịch hẹn, COD, hoàn tất, đánh giá hai chiều và ghi thông báo trong transaction | Danh sách mua/bán, hẹn, hủy, 409 tải lại, đánh giá; từ chat mở đúng yêu cầu | KT05–06, KT08, KT05a/b, KT06c/d, KT11a trên PostgreSQL; demo giao dịch COD |
| M3a · UC01, UC06, UC07 sau M2 | Google OAuth, QR thủ công, lưu tin/theo dõi, phát thông báo một lần | Google, QR theo quyền, đã lưu, theo dõi và đánh dấu đã đọc | KT01 phần Google, KT06a/b, KT07, KT11 |
| M3b · UC09–10 sau M2 | Báo cáo, duyệt/gỡ, khóa/mở, danh mục, nhật ký và thống kê đúng kỳ | Quản trị hàng chờ/tin/tài khoản/danh mục, nhập lý do, xem số liệu | KT09–10, KT09a; kiểm gỡ/khóa khi có giao dịch đồng thời |
| M4 · Tích hợp sau M3a+b | Leader hoàn thiện boot, build, CI, cấu hình mẫu, chạy lại từ DB test riêng; đối chiếu mọi operation trong OpenAPI hiện hành | Duyệt lại các trang theo đặc tả, di động, trạng thái lỗi/rỗng/đã tải lại | Tất cả ca trong docs/nghiem-thu.md kể cả ca bổ sung; KT12, demo 5 bước, restart dịch vụ và chạy lại từ đầu |

M2a và M2b có thể làm song song sau khi chốt dữ liệu dùng chung. M3a và M3b có thể chạy song song với một chủ ghi cho từng migration. Google phải có luồng thật có thể cấu hình. Kiểm thử tự động dùng nhà cung cấp OAuth giả lập chỉ bật ở test, ghi riêng kết quả tích hợp Google thật nếu có sẵn credential. Mức hoàn thành 100% ở đây áp dụng cho **MVP local theo tài liệu nghiệm thu**. Publish lên VPS, thanh toán ngân hàng tự động và kết quả xác minh với Google thật là các trạng thái riêng.

## Giao tiếp, sở hữu và hồi phục

1. Leader ghi sổ công việc vào `.agent-run/board.md` trước khi giao. Mỗi hàng gồm ID, mốc/UC/KT, người phụ trách, file được ghi, phụ thuộc, đầu vào, điều kiện đạt, trạng thái và đường dẫn bằng chứng. Chỉ leader cập nhật sổ. Trạng thái đi từ READY qua ACTIVE, REVIEW tới DONE, hoặc BLOCKED kèm nguyên nhân.
2. Giao nhiệm vụ con bằng model rõ ràng, ngữ cảnh mới và đường dẫn file vai trò. Kèm đúng ID, payload/quyền/trạng thái tham chiếu, phạm vi ghi và người nhận bàn giao. Cùng workspace, mỗi tệp có một người ghi trong một thời điểm.
3. Hai đầu trao đổi trực tiếp khi thay đổi DTO hoặc phát hiện lệch hợp đồng, báo lại leader bằng ID. Leader so sánh OpenAPI, use case và tác động lên dữ liệu cũ, ghi quyết định vào board; giao đúng một người cập nhật hợp đồng trước khi hai đầu ghép lại.
4. Mẫu bàn giao: “ID; file đã sửa; lệnh đã chạy và exit code; request/response hoặc ảnh/trace; ca còn mở; người nhận”. Lưu bằng chứng ở `.agent-run/evidence/<ID>/`. Mỗi agent báo bằng chứng mới trước khi nhận thêm việc.
5. Tester gửi lỗi kèm dữ liệu tái hiện và kết quả mong đợi. Leader phân cho chủ file, tester chạy lại ca lỗi và các ca liên quan. Mở lại DONE nếu bản tích hợp hồi quy.
6. Khi đổi phiên, leader đọc board, phản hồi tester gần nhất và git diff trước khi lập lịch tiếp. Giữ thay đổi sẵn có của người dùng. Hoàn tất một gói thì tiếp tục gói phụ thuộc cho tới M4.
