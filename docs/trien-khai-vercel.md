# Triển khai UniSwap trên Vercel

Bản công khai dùng hai project Vercel từ cùng repo. Next.js nhận lưu lượng từ trình duyệt và chuyển `/api/v1` đến NestJS. NestJS kết nối PostgreSQL trên Neon và lưu ảnh trong Vercel Blob Private.

[Bản demo UniSwap](https://uniswap-hbx-web.vercel.app) · [Kiểm tra kết nối API](https://uniswap-hbx-web.vercel.app/api/v1/health)

## Tạo project và cấu hình

| Project | Thư mục gốc | Framework | Cấu hình |
|---|---|---|---|
| `uniswap-hbx-web` | `frontend` | Next.js | `API_ORIGIN=https://uniswap-hbx-api.vercel.app`. Đặt `NEXT_PUBLIC_ASSET_DIRECT_UPLOAD=1` trước khi build để gửi ảnh lớn hơn 4 MiB thẳng đến Blob. |
| `uniswap-hbx-api` | `backend` | NestJS | `APP_ORIGIN=https://uniswap-hbx-web.vercel.app`. Đặt `DATABASE_URL` theo kết nối pooled của Neon và `JWT_SECRET` ngẫu nhiên có ít nhất 32 ký tự. Kết nối kho Blob Private để cấp `BLOB_READ_WRITE_TOKEN`. |

Chọn Node.js 24 cho cả hai project. Bật **Include source files outside of the Root Directory in the Build Step** vì web dùng ảnh mẫu từ `backend/demo-media` và API dùng `docs/openapi.yaml` để kiểm tra hợp đồng. Bước cài package của backend sinh Prisma Client qua `postinstall`. Dùng domain production cho kết nối giữa hai project.

Trước lần chạy đầu, nạp URL kết nối trực tiếp của Neon vào `DATABASE_URL` trong phiên quản trị rồi chạy `npm run db:migrate`. Runtime API dùng URL pooled đã đặt trong Vercel. Áp dụng migration một lần cho đúng DB trước khi chuyển lưu lượng sang bản mới.

Để nạp dữ liệu mẫu, nạp thêm token của kho Blob Private và hai biến `DEMO_STUDENT_PASSWORD`, `DEMO_ADMIN_PASSWORD` trong phiên quản trị rồi chạy `npm run db:seed`. Dùng hai mật khẩu khác nhau, mỗi mật khẩu dài tối thiểu 16 ký tự. Seed lặp lại giữ các tài khoản và tin đã có. Chuyển mật khẩu demo qua kênh riêng nếu giảng viên cần thử các trang yêu cầu đăng nhập.

## Đăng nhập và mail

Trong Google Auth Platform, đăng ký callback `https://uniswap-hbx-web.vercel.app/api/v1/auth/google/callback`. Thêm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` và `STUDENT_EMAIL_DOMAINS` vào project API. Giữ các bí mật trong biến môi trường của Vercel. Nếu demo đăng ký bằng email, nối dịch vụ SMTP qua `SMTP_URL` và cấu hình `SMTP_FROM` theo địa chỉ gửi đã xác minh.

## Kiểm tra trước khi chia sẻ

1. Dùng cửa sổ ẩn danh mở URL production và một link chi tiết tin. Kiểm tra `/api/v1/health` trả `{"ok":true}`.
2. Chạy KT01 với tài khoản Google trường thật và một tài khoản ngoài miền. Xác nhận phiên còn hiệu lực sau khi tải lại trang.
3. Đăng một tin có ảnh, gồm một ảnh hơn 4 MiB để kiểm tra đường tải trực tiếp. Tải lại trang, đổi phiên và xác nhận ảnh của tin công khai vẫn hiển thị.
4. Chạy luồng giữ món và xử lý báo cáo. Với QR, kiểm tra người mua đã chốt xem được ảnh và người ngoài nhận 404. Sau khi hủy hẹn, URL QR cũ trả 404 cho người mua.
5. Mở lại link production sau một lượt deploy, kiểm tra ảnh và giao dịch đã lưu.

Chi tiết từng ca có trong [kịch bản nghiệm thu](nghiem-thu.md).
