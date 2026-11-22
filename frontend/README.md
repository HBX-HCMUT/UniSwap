# Frontend UniSwap

Khung cho Next.js App Router, TypeScript và Tailwind. Ghép mỗi URL trong [đặc tả giao diện](../docs/design/ui.md) với một page trong src/app. Ví dụ, /listings/[id] đọc chi tiết tin và điểm người bán. Nút giữ hàng dùng client component gọi API và xử lý trạng thái 409 khi món vừa có người giữ.

Ở mốc 1, khởi tạo dự án trong thư mục này, bổ sung package.json và lockfile, rồi cấu hình proxy /api về NestJS. Dùng SSR cho danh sách và chi tiết công khai. Các trang hồ sơ cá nhân, chat và quản trị lấy dữ liệu theo phiên. Các route và script chạy sẽ được bổ sung cùng mã nguồn.
