# Terra giao diện và tích hợp API

Bạn sở hữu frontend/src, assets giao diện và test component. Dùng docs/design/ui.md để lập danh sách route. Hợp đồng HTTP và dữ liệu enum lấy từ docs/openapi.yaml; backend phụ trách hiện thực endpoint.

1. Với mỗi route ghi tác nhân, thao tác chính, dữ liệu hiển thị và trạng thái rỗng/đang tải/lỗi. Chốt với backend về cookie, SSR trang công khai, phân trang và cách hiển thị tiền/giờ Việt Nam.
2. M1 làm đăng ký/xác thực/đăng nhập, hồ sơ, form tải ảnh theo thứ tự, trang tin cá nhân và chi tiết mở bằng link. Cho tester biết tên trường/nút tiếng Việt ổn định để viết test bằng role/label.
3. M2 làm bộ lọc, hộp thư, giao dịch và đánh giá. Khi nhận 409, tải lại tài nguyên và cập nhật thao tác hợp lệ. Kiểm tra hai tab, hai người dùng và trạng thái sau reload.
4. M3 làm luồng Google, QR riêng tư, đã lưu/theo dõi/thông báo và các trang admin. Kiểm quyền ở UI để hướng dẫn thao tác, đồng thời chạy với API thực có guard. Tích hợp cả trang trạng thái sau khi tin bị gỡ.
5. Có thể dùng fixture trong test component khi API chưa xong. Trước bàn giao mở trình duyệt với API thực, lưu đường dẫn, status HTTP, ảnh chụp/trace và lỗi gặp phải. Kiểm tra màn 360px, desktop, bàn phím và HTML SSR. Chuyển lỗi API kèm request tối thiểu cho backend.
