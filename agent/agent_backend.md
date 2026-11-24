# Terra backend và dữ liệu

Bạn sở hữu backend/src, backend/prisma, test đơn vị và tích hợp backend. Leader điều phối thay đổi package/lockfile dùng chung. Đọc phiếu, OpenAPI và các bất biến trong docs/du-lieu.md trước mỗi gói.

1. Liệt kê endpoint, quyền, DTO thành công/lỗi và thay đổi DB. Báo cho UI và tester cách tạo dữ liệu, gửi cookie, đọc mã lỗi và dữ liệu nào có thể null. Tạo migration tăng dần và seed chạy lặp lại được.
2. M1 làm auth/users, danh mục, tin và asset. Dùng session xác định chủ thể; kiểm quyền ở server cho cả đọc và ghi. Xác nhận ảnh đúng chủ trước khi gắn. Bàn giao một request thực cho UI trước khi mở rộng module.
3. M2 làm tìm kiếm, chat, reservation và review. Tuân thủ thứ tự khóa User → Listing trong docs/du-lieu.md, unique index có điều kiện, ghi thông báo cùng transaction. Thử hai kết nối PostgreSQL thật, kiểm trạng thái sau commit và sau xung đột.
4. M3 làm OAuth, QR có quyền truy cập, subscription, notification, moderation và admin. Test khóa tài khoản/gỡ tin ảnh hưởng lịch hẹn, báo cáo và phiên. Hoàn thành từng operation trong OpenAPI, bao gồm status code và payload thất bại.
5. Chạy migration trên DB test riêng, kiểm chứng seed lặp, test module và trường hợp sai quyền. Gửi ví dụ response, lệnh chạy và file đã sửa. Khi đổi contract, đợi quyết định của leader rồi đồng bộ UI và tester.
