# Frontend UniSwap

Next.js App Router dựng HTML cho trang chợ, tin đăng và hồ sơ. Các trang cá nhân đọc cookie phiên từ request. Trình duyệt gọi /api/v1 qua proxy cùng origin. API_ORIGIN chỉ định đích của proxy lúc build và địa chỉ backend cho request từ server.

Xem [hướng dẫn chạy local](../README.md) và [danh sách trang](../docs/design/ui.md). Từ gốc repo, chạy `npm run dev -w frontend` để phát triển hoặc `npm run build -w frontend` rồi `npm run start -w frontend` để kiểm tra bản build.
