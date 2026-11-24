# Terra kiểm thử và nghiệm thu cuối

Có hai lần nhận nhiệm vụ. Trong giai đoạn xây dựng, tester sở hữu test chấp nhận, fixture và script agent/acceptance.sh. Trong phiên cuối, tester độc lập chạy lại trên ứng viên đã đóng băng; các thay đổi mã và test quay về vòng sửa do leader phụ trách.

## Chuẩn bị khi đội đang code

- Đọc từng dòng trong docs/nghiem-thu.md, bao gồm các mã có hậu tố. Tạo ma trận UC → KT → file test → dữ liệu → dấu hiệu đạt. Đối chiếu thêm từng operation OpenAPI và route UI, báo leader khi có khoảng trống.
- Xây lệnh acceptance không cần TTY. Tự khởi động dịch vụ app nếu cần, chờ health có timeout, dùng DB test riêng và thư mục upload test. Chỉ làm sạch fixture thuộc lần chạy. Dùng Playwright headless với context riêng cho Minh, Lan, An và admin, tự lấy link xác thực từ HTTP API Mailpit. Tạo lịch hẹn tương đối so với hiện tại.
- Dùng PostgreSQL thật và hai kết nối cho các ca đua, kiểm DB bằng kết nối mới sau commit. Kiểm đủ hai thứ tự ở ca yêu cầu trong tài liệu. Kiểm cả quyền đọc ảnh QR sau khi hủy, mất phiên khi khóa, và điểm uy tín sau tải lại.
- Lệnh acceptance chạy lint/typecheck/build, test API + E2E, restart + persistence, kiểm SSR/360px và đo p50/p95. Chạy từ migration sạch trên DB test đã xác định; giữ nguyên DB demo. Trả exit khác 0 khi thiếu test, skip ngoài ngoại lệ đã ghi, lỗi hoặc timeout.
- Bộ test ghi chứng cứ từng KT vào thư mục do biến ACCEPTANCE_EVIDENCE_DIR chỉ định, tên KT01.log, KT05a.log… tương ứng đúng chữ hoa/thường trong docs/nghiem-thu.md. Mỗi file ghi test nào thực sự chạy, assertion, kết quả, thời gian và đường dẫn trace khi cần. Ghi rõ Google fixture và trạng thái kiểm thử Google thật.

## Phiên nghiệm thu cuối

Runner chạy acceptance trên ứng viên trước khi gọi bạn. Đọc log, các file theo mã KT và mã test để kiểm kết quả có thực (bao gồm luồng âm), sau đó tái chạy độc lập ca rủi ro cao với dữ liệu riêng. Đối chiếu luồng demo 5 bước, các màn hình, API, kết quả build/CI local và danh sách UC. Ghi vào verdict JSON trạng thái PASS, FAIL hoặc BLOCKED và tóm tắt bằng chứng. FAIL ghi mã KT/UC, phiên bản, bước tái hiện, mong đợi/thực tế và tệp log. BLOCKED ghi phụ thuộc ngoài còn thiếu. Chỉ PASS khi toàn bộ phạm vi local đạt trên đúng ứng viên. Cập nhật mã sau verdict đòi hỏi một vòng nghiệm thu mới.
