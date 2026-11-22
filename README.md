# UniSwap • Chợ đồ cũ sinh viên

Sinh viên đăng một món đồ cũ, người mua tìm theo trường hoặc KTX, hai bên trao đổi, giữ món, hẹn gặp và đánh giá nhau sau khi giao nhận. Repo này là bộ thiết kế và khung thư mục để HBX Team bắt đầu lập trình. Các màn hình, API và ca kiểm thử bên dưới là đặc tả cho giai đoạn phát triển.

## Bắt đầu ở đâu

| Khi cần | Tài liệu |
|---|---|
| Chia việc và chọn phạm vi demo | [Kế hoạch](docs/ke-hoach.md) |
| Đối chiếu yêu cầu môn học | [Báo cáo nhóm](docs/Bao_cao_thao_luan_nhom_HBX_Team_cho_do_cu_sinh_vien.docx) · [Phạm vi và use case](docs/nghiep-vu.md) |
| Thiết kế màn hình | [Luồng điều hướng và wireframe](docs/design/ui.md) |
| Chọn công nghệ, dựng môi trường | [Kiến trúc và triển khai](docs/kien-truc.md) |
| Viết migration | [ERD và quy tắc dữ liệu](docs/du-lieu.md) |
| Nối frontend với backend | [Quy ước và ví dụ HTTP](docs/api.md) · [OpenAPI](docs/openapi.yaml) |
| Chuẩn bị buổi bảo vệ | [Kiểm thử và demo](docs/nghiem-thu.md) |
| Bàn giao cho trợ lý lập trình | [Hướng dẫn làm việc](AGENT.md) |

## Cây nguồn

```text
frontend/
  src/app/           Trang và layout Next.js
  src/features/      Form, truy vấn và tương tác theo nghiệp vụ
  src/components/    Thành phần giao diện dùng chung
  src/lib/           HTTP client, định dạng tiền và ngày giờ
backend/
  src/modules/       auth, users, catalog, listings, chat, reservations,
                     reviews, subscriptions, notifications, moderation, admin
  src/common/        Guard, kiểm tra đầu vào, ánh xạ lỗi
  prisma/migrations/ Thay đổi lược đồ theo phiên bản
  prisma/seed/       Dữ liệu mẫu phục vụ demo
  test/              Kiểm thử API và luồng giao dịch
docs/
  design/            Bố cục các màn hình
```

Các thư mục con có tệp giữ chỗ để Git theo dõi được. Đợt bàn giao này chưa có ứng dụng chạy, migration hay dependency để cài đặt. Mốc 1 trong kế hoạch là điểm bắt đầu tạo hai ứng dụng.
