# Hợp đồng REST cho frontend và backend

[OpenAPI YAML](openapi.yaml) mô tả từng method, path, tham số, kiểu dữ liệu, quyền và mã phản hồi. Có thể mở bằng trình xem OpenAPI trong IDE. Phần dưới dùng đường dẫn tương đối với /api/v1. Đây là hợp đồng thiết kế trước khi viết controller.

## Quy ước chung

- Request/response dùng JSON UTF-8, riêng POST /assets nhận multipart với file và purpose. Sau upload, frontend truyền ID ảnh do server cấp. Một tin có 1–6 ảnh đã tải xong và thuộc chủ tin.
- Cookie uniswap_session nhận khi đăng nhập. Phía web gửi cookie cùng origin. API xác định userId từ phiên. PublicProfile không có email và contact. Admin không có quyền đọc chat của người dùng qua API quản trị.
- Trang danh sách dùng page từ 1, pageSize mặc định 20, tối đa 100, kết quả gồm items, page, pageSize, total. Danh sách tin mặc định mới trước. Tin nhắn mới nhất ở trang 1, UI đảo thứ tự trong trang khi hiển thị hội thoại. Mốc demo dùng polling, tải lại trang đầu và hợp nhất theo id để không lặp.
- Các endpoint nhận tài nguyên của chính mình kiểm tra quyền mỗi lần đọc hoặc ghi. Trả 404 khi truy cập dữ liệu riêng ngoài phạm vi nhìn thấy. Trả 403 khi người dùng thấy giao dịch nhưng dùng sai vai trò. Trạng thái đã thay đổi trả 409. Khi nhận 409, UI tải lại dữ liệu và chỉ hiện các thao tác còn hợp lệ.
- Thời điểm trả theo RFC 3339, giá là số nguyên VND, ID theo UUID. Nhập sai kiểu/khoảng trả 400, lịch hẹn đã qua hoặc dùng ảnh sai mục đích trả 422.

| Nghiệp vụ | Endpoint chính | Ai thao tác |
|---|---|---|
| UC01 | /auth/register, /auth/verify, /auth/resend, /auth/login, /auth/google, /auth/google/callback, /auth/logout, /me, /users/{id} | Khách hoặc chủ phiên |
| UC02–04 | /assets, /schools, /categories, /listings, /listings/{id}, /listings/{id}/state, /me/listings | Khách đọc tin công khai, sinh viên quản lý tin của mình |
| UC05 | /conversations, /conversations/{id}/messages, /notifications | Hai thành viên của hội thoại |
| UC06, UC08 | /reservations, /reservations/{id}, /reservations/{id}/reviews, /users/{id}/reviews | Người mua/người bán, đánh giá đã công bố đọc công khai |
| UC07 | /me/saved, /me/favorites/{id}, /me/seller-follows/{id}, /me/category-follows/{id}, /notifications/{id}/read | Chủ phiên |
| UC09–10 | /reports, /admin/reports, /admin/listings, /admin/users, /admin/categories, /admin/stats | Sinh viên gửi báo cáo. Quản trị viên xử lý và xem số liệu |

## Ví dụ giao nhận tại KTX

1. Người mua gửi POST /reservations. Giá trị listingId lấy từ GET /listings. Server trả 200 với state=PENDING và id của yêu cầu. Gửi lại khi yêu cầu vẫn PENDING nhận lại cùng id.

```json
{"listingId":"3a344ac7-c822-4b2e-a7e3-5eda2a791023"}
```

2. Sau khi nhắn tin, người bán gửi PATCH /reservations/748566c4-f7eb-4b05-87f6-732d561db2db. Ngày trong ví dụ là dữ liệu minh họa. Khi demo, chọn giờ còn ở tương lai.

```json
{
  "action": "ACCEPT",
  "finalPrice": 60000,
  "meetingAt": "2027-01-15T17:30:00+07:00",
  "meetingPlace": "Sảnh A1, KTX khu A",
  "paymentMethod": "COD"
}
```

Phản hồi 200 cho người tham gia giao dịch:

```json
{
  "id":"748566c4-f7eb-4b05-87f6-732d561db2db",
  "listingId":"3a344ac7-c822-4b2e-a7e3-5eda2a791023",
  "buyerId":"11424ee7-bc03-40bb-8b34-9353792ed039",
  "sellerId":"1419957b-c764-40bd-944f-2227c690a9c9",
  "state":"ACCEPTED",
  "createdAt":"2027-01-14T10:00:00Z",
  "finalPrice":60000,
  "meetingAt":"2027-01-15T10:30:00Z",
  "meetingPlace":"Sảnh A1, KTX khu A",
  "paymentMethod":"COD"
}
```

Nếu yêu cầu vừa bị từ chối do người khác đã được giữ, cùng request trả 409.

```json
{"code":"STATE_CONFLICT","message":"Món này đã được giữ cho một người mua khác."}
```

3. Sau giao nhận, người mua PATCH cùng tài nguyên với {"action":"COMPLETE"}. Hai bên lần lượt POST /reservations/{id}/reviews với {"rating":5,"comment":"Đúng mô tả, giao đúng hẹn."}. Server suy ra targetId từ đối tác và trả 201. Thử chấm lại trả 409.

## Đọc lại giao dịch và lịch sử

Chỉ người mua và chủ tin được đọc yêu cầu. Danh sách `GET /reservations` luôn giới hạn theo phiên. Từ hộp thư, truyền `conversationId` để lọc đúng cặp tin–người mua. Hội thoại ngoài quyền xem trả 404. Trang đầu xếp yêu cầu đang chờ hoặc đã nhận trước các yêu cầu đã đóng.

| Trạng thái trả về | Dữ liệu ngoài ID, trạng thái và thời điểm tạo |
|---|---|
| PENDING, REJECTED hoặc rút trước khi được nhận | Bỏ các trường giá chốt, lịch hẹn và thanh toán |
| ACCEPTED | Có finalPrice, meetingAt, meetingPlace, paymentMethod. Với QR_MANUAL, có thêm qrAsset chứa URL đọc theo quyền |
| CANCELLED sau khi đã nhận giữ | Giữ bốn trường đã chốt để xem lịch sử. Bỏ qrAsset khỏi phản hồi của cả hai bên. Người mua hết quyền đọc ảnh dựa trên lịch này |
| COMPLETED | Giữ dữ liệu như ACCEPTED, thêm completedAt và viewerHasReviewed. Server tính cờ từ Review của chủ phiên trên chính giao dịch này |

Chủ tin tự gửi giữ nhận 403. Người mua gửi giữ một tin công khai RESERVED/SOLD nhận 409. Tin ẩn, chờ duyệt, đã gỡ hoặc thuộc người bán bị khóa trả 404 cho người ngoài. Với yêu cầu giữ riêng tư, kiểm tra phạm vi nhìn thấy trước khi kiểm tra vai trò và trạng thái.

## Các tình huống cần thống nhất khi ghép

| Hành động | Quy tắc xử lý |
|---|---|
| Đăng hoặc sửa tin | Chấp nhận danh mục active và trường có thật. Quét từ khóa đã chuẩn hóa trong tiêu đề và mô tả. Khớp từ khóa chuyển PENDING để admin xem xét. Tin sạch APPROVED. Khi sửa tin đã gỡ trả 409 |
| Ẩn/hiện và bán ngoài | HIDE từ AVAILABLE sang HIDDEN. SHOW từ HIDDEN đã duyệt sang AVAILABLE. MARK_SOLD từ AVAILABLE sang SOLD. Thao tác không hợp lệ trả 409 |
| QR thủ công | ACCEPT với QR_MANUAL bắt buộc qrAssetId thuộc người bán và purpose PAYMENT_QR. Người mua xem trong giao dịch. COD bỏ trường ảnh QR |
| Theo dõi/lưu | PUT và DELETE trả 204 khi đạt trạng thái mong muốn, kể cả khi bấm lại. Mỗi người nhận tối đa một thông báo cho lần công khai đầu tiên của một tin |
| Kiểm duyệt | DISMISS đóng báo cáo và giữ tin. REMOVE_LISTING gỡ tin và đánh dấu báo cáo ACTIONED cùng transaction. APPROVE chỉ nhận tin PENDING. REMOVE cũng có thể dùng độc lập từ hàng chờ. Thao tác lặp trên báo cáo đã đóng trả 409 |
| Thống kê | GET /admin/stats?from=...&to=... bắt buộc from trước to. Chuẩn đếm và phạm vi hiển thị ở [từ điển dữ liệu](du-lieu.md) |
