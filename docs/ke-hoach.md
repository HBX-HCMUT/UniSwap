# Kế hoạch triển khai UniSwap

Mục tiêu của buổi demo là cho hai sinh viên dùng hai trình duyệt để giao dịch một cuốn giáo trình. Người thứ ba dùng màn hình quản trị để xử lý tin bị báo cáo. Các mốc dưới đây là thứ tự đề xuất, nhóm có thể phân công theo người và lịch học sau. Báo cáo mục V phân công giai đoạn nghiên cứu, chưa phân công sprint lập trình.

| Mốc | Việc của nhóm | Điều kiện chuyển mốc |
|---|---|---|
| 0 · Bàn giao thiết kế (đợt này) | Đọc báo cáo, dựng cây nguồn, thống nhất cách gọi, viết use case, wireframe, ERD, API, ca nghiệm thu | Từng nhóm chức năng mục III có màn hình, endpoint và ca kiểm tra |
| 1 · Đăng được một tin | Khởi tạo Next.js và NestJS, khóa phiên bản, Compose cho PostgreSQL + hộp thư SMTP local, migration User/Listing/Catalog, seed trường, danh mục. Làm phiên đăng nhập, xác thực email, đăng ảnh và trang chi tiết | Khách mở link xem tin, tài khoản chưa xác thực bị chặn đăng, chủ tin sửa được giá |
| 2 · Mua được một món | Tìm/lọc, hội thoại, giữ hàng, hẹn gặp, hoàn tất COD và đánh giá. Ghi thông báo giao dịch trong transaction chốt hẹn. Làm ràng buộc dữ liệu trước khi nối nút xác nhận trên UI | Minh và Lan đi hết bước 1–4 của demo COD. Dùng thêm phiên An để thấy người bán chỉ chấp thuận được một yêu cầu |
| 3 · Hoàn thiện mục III | Google OAuth, giao diện thông báo, yêu thích/theo dõi, công cụ kiểm duyệt, danh mục và thống kê. Thêm QR thủ công do người bán cung cấp | Chạy hết bảng nghiệm thu, kể cả QR. Tại bước 5 của demo, admin xử lý báo cáo OPEN trên một tin mẫu khác rồi kiểm tra thống kê |
| 4 · Chạy thử trước buổi bảo vệ | Seed lại DB thử nghiệm, cấu hình ảnh/SMTP, Docker build, CI lint + typecheck + test + build, chạy thử từ máy khác | Mở được trang chi tiết trực tiếp qua URL, xem tốt trên điện thoại và hoàn thành demo sau khi tải lại trang |

## Chia việc theo sản phẩm bàn giao

- Bạn phụ trách dữ liệu và backend chốt migration, transaction nhận giữ và các kiểm tra quyền. Hai người làm cùng một luồng thống nhất request/response trong OpenAPI trước khi viết giao diện.
- Một người phụ trách trang tìm kiếm, đăng tin và ảnh. Một người phụ trách tài khoản, hội thoại và giao dịch. Phần quản trị, kiểm thử và dữ liệu demo có thể chia cho các thành viên còn lại. Đây là gợi ý phân việc, nhóm trưởng quyết định người phụ trách.
- Mỗi mốc ghép frontend và backend ngay khi có một hành trình dùng được. Khi thiếu SMTP thật, dùng hộp thư local. Khi thiếu dịch vụ ảnh, dùng thư mục lưu ảnh của server ở môi trường phát triển.

## Quyết định nhóm nên kiểm tra trước mốc 1

1. Dùng tên UniSwap thống nhất trên UI và báo cáo. Mục II còn gọi là HBX Market.
2. Cung cấp danh sách miền email sinh viên thực tế. Với seed local dùng miền giả `student.example.test`.
3. Duyệt phương án một tin cho một món hoặc một combo, người bán chọn người được giữ, người mua xác nhận đã nhận. Lịch hẹn và giá chốt do người bán nhập sau khi trao đổi.
4. Ưu tiên COD gặp tại trường. Giao tận nơi có thể do hai bên tự thỏa thuận qua chat. GHN, PayOS, phí đẩy tin và quảng cáo là phần mở rộng. Lọc theo môn học và trao đổi hiện vật được đề cập ở mục II, nên thêm sau khi hoàn thành giao dịch bán đầu tiên.
5. Nếu cần rút thời gian, giữ luồng mốc 1–2 và quyền kiểm duyệt cơ bản, báo rõ phần mục III chưa demo. Viết một bộ use case, một ERD, một hợp đồng API và một kịch bản demo là đủ cho nhóm. Nội dung SWOT, doanh thu và marketing đã có vị trí riêng trong báo cáo môn học.

Chi tiết cách chạy nghiệm thu ở [kịch bản kiểm thử](nghiem-thu.md).
