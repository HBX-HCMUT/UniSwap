# Backend UniSwap

Khung cho NestJS REST, Prisma và PostgreSQL. Mỗi thư mục con của src/modules phụ trách nhóm tài nguyên cùng tên trong [đặc tả API](../docs/api.md). catalog quản lý danh mục và trường, subscriptions quản lý cả lưu tin và theo dõi, moderation quản lý hàng chờ và xử lý vi phạm. admin tổng hợp số liệu và quản lý tài khoản.

Ở mốc 1, khởi tạo NestJS tại đây, thêm Prisma schema, migration đầu tiên và seed. Khởi động PostgreSQL và một SMTP local cho thử nghiệm. Đặt bộ kiểm thử giao dịch đồng thời vào test và chạy trên PostgreSQL thật. Hạn chế ảnh hưởng chéo bằng database test riêng. Chi tiết cấu hình ở [kiến trúc](../docs/kien-truc.md).
