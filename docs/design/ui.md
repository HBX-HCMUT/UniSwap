# Màn hình và điều hướng

Ưu tiên điện thoại khi sinh viên đứng ở KTX. Trên màn hình nhỏ, thanh dưới có Chợ, Đăng tin, Hộp thư, Cá nhân. Trên desktop chuyển sang thanh đầu trang, bộ lọc ở cột trái. Khu vực quản trị có điều hướng riêng. Trước khi đăng nhập, lưu đường dẫn nội bộ để quay lại tin vừa xem.

| Trang / đường dẫn web | Nội dung, hành động chính | Trạng thái cần thiết kế |
|---|---|---|
| Chợ · / | Từ khóa, lọc nhanh theo danh mục, bộ lọc giá/danh mục/tình trạng/trường/KTX, sắp xếp mới/giá, thẻ ảnh–tên–giá–khu vực, phân trang | Đang tải, không tìm thấy + xóa lọc, nhập sai khoảng giá, mất kết nối + thử lại |
| Tin · /listings/[id] | Bộ ảnh, giá VND, mô tả, tình trạng, địa điểm, thẻ người bán và điểm. Nhắn tin, giữ món, lưu, báo cáo | Chủ tin thấy quản lý. Đang giữ/đã bán hiện nhãn thay nút giữ. Tin bị gỡ hiện đường về chợ |
| Tài khoản · /register, /login, /verify | Email trường, mật khẩu hoặc Google. Trang xác minh đọc token, yêu cầu người dùng bấm xác nhận rồi POST | Chờ thư, gửi lại, link hết hạn, sai miền, tài khoản bị khóa |
| Hồ sơ · /users/[id], /me | Hồ sơ công khai có tên, trường, điểm, đánh giá, tin đang bán và theo dõi. Chủ tài khoản sửa trường, KTX, liên hệ qua /me | Chưa có đánh giá, bỏ theo dõi. Thông tin liên hệ riêng chỉ hiển thị ở /me |
| Tin của tôi · /me/listings, /sell, /listings/[id]/edit | Form ảnh (chọn thứ tự), tên món, giá, tình trạng, danh mục, trường, khu vực, mô tả. Xem/sửa, ẩn/hiện, đánh dấu đã bán | Báo lỗi cạnh trường sai, xem trước ảnh, lỗi tải ảnh, chờ duyệt và đã gỡ kèm trạng thái |
| Hộp thư · /inbox, /inbox/[id] | Chọn hội thoại theo tin, đọc tin cũ, gửi tin, mở giao dịch | Hội thoại trống, đang gửi, lỗi gửi cho phép giữ nội dung, huy hiệu tin mới |
| Giao dịch · /me/reservations, /reservations/[id] | Lọc theo vai trò mua/bán, xem đối tác và lịch hẹn. Các nút theo bảng dưới đây | Giờ hẹn quá khứ, người khác vừa giữ, lịch đã hủy, đã hoàn tất |
| Đã lưu và theo dõi · /me/saved | Danh sách tin đã lưu, người bán và danh mục đang theo dõi. Bật theo dõi danh mục từ bộ lọc ở chợ | Tin hết bán hiện trạng thái nếu còn công khai, tin bị gỡ ẩn khỏi danh sách |
| Thông báo · /notifications | Tin nhắn, lịch hẹn, tin mới, kết quả kiểm duyệt. Bấm để đánh dấu đã đọc rồi mở tài nguyên | Rỗng, đã đọc, liên kết hết quyền xem |
| Quản trị · /admin và /admin/{reports,listings,users,categories} | Bộ đếm theo kỳ, hàng chờ theo từ khóa, báo cáo có lý do, chi tiết tin, khóa/mở tài khoản, sửa danh mục | Yêu cầu lý do khi xử lý. Tải lại khi người khác đã xử lý, quyền admin kiểm ở API |

## Luồng tìm món và xem chi tiết

- **UC03.** Sau khi tìm hoặc lọc, trang thu gọn phần ảnh mở đầu để đưa kết quả lên sớm. Mỗi tiêu chí đang áp dụng có nút bỏ riêng. Bỏ bộ lọc giữ từ khóa và thứ tự sắp xếp, đồng thời đưa kết quả về trang đầu. Cách đặt bộ lọc cạnh kết quả trên desktop dựa trên [hướng dẫn tìm kiếm của eBay](https://www.ebay.com/help/buying/search-tips/use-search?id=4006). Cách kết hợp danh mục, từ khóa và sắp xếp tham khảo [luồng duyệt Carousell](https://blog.carousell.com/carousell-pro-tips/buying-guide/browse-carousell/) và [hướng dẫn lọc của Airbnb](https://www.airbnb.com/help/article/479).
- **UC04.** Từ tin mở qua trang kết quả, liên kết “Về kết quả” khôi phục truy vấn, bộ lọc, thứ tự và số trang. Người mở tin bằng đường dẫn trực tiếp có liên kết “Về chợ”.

## Thao tác trên từng yêu cầu giữ

| Trạng thái | Người mua | Người bán |
|---|---|---|
| PENDING | Rút yêu cầu | Xác nhận giữ, Từ chối |
| ACCEPTED | Đã nhận món, Hủy hẹn | Hủy hẹn |
| COMPLETED | Đánh giá người bán | Đánh giá người mua |
| REJECTED, CANCELLED | Xem lịch sử | Xem lịch sử |

Sau phản hồi 409, tải lại yêu cầu và tin để cập nhật nhãn và nút. Khi mở lại giao dịch COMPLETED, dùng `viewerHasReviewed` của phiên hiện tại. Nếu đã đánh giá, hiển thị “Đã đánh giá” thay cho form.

Từ hộp thư, “Mở giao dịch” gọi `GET /reservations?conversationId=…`. Nếu có yêu cầu PENDING hoặc ACCEPTED, mở yêu cầu đó. Nếu chỉ có yêu cầu đã đóng, mở danh sách lịch sử của hội thoại. Nếu danh sách rỗng, hiện “Chưa có yêu cầu giữ”. Người mua có thể giữ trực tiếp từ trang tin và mở “Nhắn người bán” sau đó.

## Wireframe ba màn hình của giao dịch

```text
CHỢ ĐỒ CŨ                       CHI TIẾT TIN                  GIỮ HÀNG · PHÍA NGƯỜI BÁN
[Tìm giáo trình...      Tìm]    [        Ảnh 1/3        ]     Giáo trình Giải tích 1
[Trường ▾] [Bộ lọc ▾]           Giáo trình Giải tích 1        Lan muốn giữ món này
Mới nhất ▾                      65.000 đ · Còn tốt            Giá chốt   [60000       ] đ
[Ảnh] Giáo trình Giải tích 1    KTX A · Trường A              Ngày và giờ [chọn giờ   ]
      65.000 đ · KTX A          Người bán: Minh · 4,8 (5)    Điểm hẹn   [Sảnh A1     ]
[Ảnh] Đèn bàn học               [Nhắn tin] [Giữ món]          Thanh toán [Khi nhận   ▾]
      90.000 đ · KTX B          [Lưu] [Báo cáo tin]           [Xác nhận giữ] [Từ chối]

SAU KHI CHẤP THUẬN · PHÍA NGƯỜI MUA
Đang giữ cho bạn · 60.000 đ
Sảnh A1 · giờ hẹn hiển thị theo giờ Việt Nam
[Nhắn người bán] [Đã nhận món] [Hủy hẹn]
```

Nhấn “Đã nhận món” mở hộp xác nhận có tên món và giá. Thành công chuyển sang màn hình hoàn tất có nút “Đánh giá Minh”. Khi dùng QR, hiển thị ảnh chỉ trong trang hẹn của hai bên. Trạng thái nút luôn có chữ, hỗ trợ bàn phím, nhãn trường và thông báo lỗi cho trình đọc màn hình. Màn hình 360px chuyển bộ lọc sang ngăn mở riêng và giữ nút giao dịch trong vùng nhìn.
