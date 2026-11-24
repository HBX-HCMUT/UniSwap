# Backend UniSwap

NestJS phục vụ REST ở /api/v1. Prisma và PostgreSQL lưu giao dịch, phiên và hồ sơ. Kho ảnh local giữ nội dung tệp, controller đọc lại quyền mỗi lần trả ảnh. Controller nhận dữ liệu theo OpenAPI, service xác định quyền người dùng và áp dụng chuyển trạng thái.

Xem [hướng dẫn chạy ở gốc repo](../README.md) để khởi động hạ tầng, áp dụng migration và seed. Từ gốc, chạy `npm run build -w backend` và `npm run start -w backend` với biến môi trường đã nạp. `GET /api/v1/health` kiểm tra kết nối DB. Kiểm thử tích hợp dùng PostgreSQL test và các phiên HTTP độc lập.
