# Hướng dẫn làm việc trong repo UniSwap

UniSwap là bài tập lớn của HBX Team. Viết tài liệu và nội dung giao diện bằng tiếng Việt. Dùng tên tiếng Anh nhất quán cho mã nguồn, trường dữ liệu và đường dẫn API. Khi nhận một việc, đọc [kế hoạch](docs/ke-hoach.md) và use case tương ứng trong [nghiệp vụ](docs/nghiep-vu.md). Báo cáo gốc ở mục “Bắt đầu ở đâu” trong [README](README.md).

## Cách thực hiện một chức năng

1. Xác định ai dùng, dữ liệu thuộc ai, trạng thái trước và sau thao tác. Dùng mã UC và ca nghiệm thu để thống nhất với người làm đầu còn lại.
2. Kiểm tra [hợp đồng API](docs/openapi.yaml) và [ERD](docs/du-lieu.md). Nếu thay đổi payload, trạng thái hoặc quyền, cập nhật tài liệu cùng thay đổi mã.
3. Đặt trang trong frontend/src/app, logic tương tác trong frontend/src/features. Backend dùng NestJS theo nghiệp vụ trong backend/src/modules. Controller đọc DTO, service quyết định quyền và chuyển trạng thái, Prisma xử lý truy vấn và transaction.
4. Sau khi có mã, chạy lint, typecheck và các test liên quan theo script thực tế trong package.json. Mọi thay đổi giữ hàng phải kiểm cả hai yêu cầu đồng thời. Thử ít nhất một trường hợp từ chối quyền cho route riêng tư. Ghi lại kết quả thực tế khi bàn giao.
5. Dùng migration và seed lặp lại được. Chỉ reset cơ sở dữ liệu demo khi người vận hành xác nhận đúng môi trường. Mẫu minh họa dùng tài khoản và dữ liệu hư cấu.

## Quy ước dự án

- Một tài khoản sinh viên có thể vừa mua vừa bán. Backend xác định chủ tin, người mua và người được đánh giá từ phiên và quan hệ trong DB.
- Số tiền là số nguyên VND. Lưu thời điểm có múi giờ, API dùng RFC 3339, giao diện hiển thị giờ Việt Nam. ID là UUID.
- Ảnh tin đăng lưu qua bộ lưu trữ. Chỉ lưu metadata trong DB. Tệp cấu hình local, bí mật JWT, mật khẩu SMTP và khóa OAuth thuộc biến môi trường.
- Tách phần báo cáo mô tả khỏi quyết định triển khai của nhóm. Ghi thay đổi ảnh hưởng luồng demo vào tài liệu tương ứng. Khi thiếu thời gian, dùng thứ tự ưu tiên trong kế hoạch.
