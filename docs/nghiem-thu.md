# Kiểm thử và kịch bản bảo vệ

Các ca dưới đây là tiêu chí cần đạt khi có mã chạy. Dùng hai cửa sổ trình duyệt với phiên của Minh (người bán) và Lan (người mua). Có thêm An (người mua thứ hai), một admin và một tài khoản chưa xác minh. Dùng dữ liệu hư cấu và hộp thư local. Seed trường A/B, khu A/B, danh mục Giáo trình, Đồ KTX, Điện tử, và một từ khóa giả để thử chờ duyệt.

| Ca | Thao tác kiểm tra | Dấu hiệu đạt |
|---|---|---|
| KT01 · UC01 | Đăng ký đúng miền, thử đăng nhập trước/sau khi bấm xác thực, dùng lại token, thử Google đúng/sai miền, sửa hồ sơ | Đăng nhập thành công sau xác thực. Sai miền bị chặn. Dùng lại token nhận 410. Hồ sơ công khai không chứa liên hệ riêng |
| KT02 · UC02 | Minh tải ảnh giáo trình, điền giá 65.000, đăng tin. Thử ảnh thứ 7, file sai định dạng, Lan thử sửa tin. Minh ẩn/hiện tin | Có ảnh bìa và giá đúng. Ảnh sai bị chặn. Chỉ Minh sửa được. Ẩn thì khách không mở được link, hiện lại thì tìm được |
| KT03 · UC03/04 | Tìm “Giải tích”, lọc trường A, KTX A, giá 50.000–70.000, tình trạng GOOD. Mở chi tiết. Đổi maxPrice thành 40.000 | Tin đúng xuất hiện, kết hợp lọc không khớp trả danh sách rỗng, khoảng giá đảo chiều báo lỗi. Hồ sơ chưa có đánh giá hiển thị đúng |
| KT04 · UC05 | Lan nhắn Minh từ trang tin, mở lại hội thoại ở phiên khác. An cố mở URL hội thoại riêng | Có một hội thoại Lan–Minh cho tin; thông báo mới xuất hiện trong chu kỳ polling, tải lại còn tin. An không đọc được |
| KT05 · UC06 | Trước khi mở chat, Lan gửi hai POST đồng thời cho cùng tin. Trên tin khác, Lan và An cùng gửi rồi dùng hai phiên Minh chấp thuận hai yêu cầu đồng thời | Hai POST của Lan cùng trả 200 và cùng id, DB có một PENDING. Hai người mua khác nhau có hai PENDING. Hai ACCEPT cho đúng một 200 và một 409 STATE_CONFLICT. DB có một ACCEPTED, một REJECTED, tin RESERVED. UI tải lại sau 409 |
| KT06 · UC06 | Từ lịch đã nhận, hủy rồi tạo yêu cầu mới, chốt giá 60.000 và lịch mới. Lan bấm đã nhận rồi lặp COMPLETE trên cùng id | Lịch cũ CANCELLED giữ giá và lịch. Tin mở lại sau khi hủy, lượt mới có id khác. COMPLETE ghi COMPLETED, completedAt và SOLD cùng nhau. Lặp trả 409, thời điểm và số giao dịch hoàn tất giữ nguyên |
| KT07 · UC07 | Lan lưu tin, theo dõi Minh và danh mục Giáo trình, Minh đăng cuốn khác rồi sửa giá, Lan đánh dấu thông báo đã đọc | Lưu và bỏ lưu vẫn đúng sau tải lại. Một thông báo cho cuốn mới dù theo dõi qua hai nguồn. Sửa giá không nhân bản thông báo |
| KT08 · UC08 | Sau hoàn tất, chỉ Lan chấm rồi tải lại ở cả hai phiên. Tiếp theo Minh chấm. An chấm thay, Lan chấm lại, thử đánh giá trước giao nhận | Sau lần tải lại, Lan thấy “Đã đánh giá”, Minh còn form. Mỗi bên chấm được một lượt. Người ngoài nhận 404, lượt trùng hoặc quá sớm nhận 409. Điểm và số lượt đúng theo các đánh giá thực |
| KT09 · UC09 | Đăng tin chứa từ khóa mẫu, admin duyệt. Lan báo cáo một tin đang giữ, admin gỡ và ghi lý do. Thử lại link cũ | Tin chờ không lộ ở chợ. Gỡ tin đóng yêu cầu còn mở, hai bên nhận thông báo, khách thấy 404, admin còn nhật ký |
| KT10 · UC10 | Thử vào admin bằng Lan. Admin khóa/mở tài khoản, tắt danh mục, tra số liệu theo một kỳ bao trọn demo | Lan bị chặn. Phiên đã khóa mất hiệu lực. Danh mục cũ vẫn đọc được trên tin, form mới không chọn được. Mỗi giao dịch COMPLETED chỉ tăng bộ đếm một lần |
| KT11 · Quyền và khôi phục | Gửi API khi đăng xuất, đổi id sang giao dịch người khác, mở URL QR bằng tài khoản khác, tắt rồi mở lại dịch vụ | 401/404 theo ngữ cảnh. QR riêng tư. Dữ liệu DB và ảnh đã lưu còn sau khởi động lại |
| KT12 · UI/SEO/hiệu năng | Mở link tin trong cửa sổ ẩn danh ở 360px và desktop. Kiểm tra tiêu đề trong HTML. Chạy 20 lượt tìm kiếm với cùng seed và ghi thời gian phản hồi | Có tiêu đề món và giá trong HTML, hoàn thành thao tác bằng bàn phím, màn hình không tràn ngang. Ghi số tin seed, máy demo và p50/p95 thực đo; dùng kết quả làm mốc so sánh lần sau |

KT01 có thể kiểm tra quy tắc miền và cờ email đã xác thực bằng danh tính Google giả lập ở môi trường test. Để xác nhận tích hợp thật, nhóm cần cấu hình OAuth client, callback và tài khoản thử đúng miền. Ghi riêng kết quả “giả lập” và “Google thật” trong biên bản. Buổi demo chính có thể dùng SMTP local. KT06 và KT11 kiểm cả QR thủ công ở mốc 3. Kịch bản thuyết trình bên dưới dùng COD.

### Các trường hợp bổ sung cho UC06

Chạy ca đồng thời trên PostgreSQL thử nghiệm bằng hai kết nối riêng. Đồng bộ thời điểm bắt đầu hai thao tác. Với các ca có hai thứ tự thắng, cho từng transaction lấy khóa trước ở hai lượt chạy riêng. Đọc lại tin và các yêu cầu bằng kết nối mới sau khi cả hai kết thúc.

| Ca | Điều kiện và thao tác | Kết quả cần kiểm |
|---|---|---|
| KT05a · Gửi mới đúng lúc chấp thuận | Minh chấp thuận Lan trong khi An gửi giữ cùng tin | Nếu An tạo trước, yêu cầu An chuyển REJECTED khi Minh chốt. Nếu Minh chốt trước, POST của An trả 409. Cả hai trường hợp chỉ Lan được giữ |
| KT05b · Chủ tin đóng tin | Với các tin AVAILABLE có PENDING riêng, thử ẩn, bán ngoài và sửa khiến tin quay về chờ duyệt. Thử HIDE đồng thời với ACCEPT | Mỗi lần đóng tin hủy mọi PENDING. Nếu ACCEPT thắng, HIDE trả 409 và lịch còn hiệu lực. Nếu HIDE thắng, ACCEPT trả 409. Bán ngoài không cấp quyền đánh giá |
| KT06a · Kiểm dữ liệu chốt | Mỗi lỗi dùng yêu cầu PENDING trên tin AVAILABLE/APPROVED, Minh đúng chủ và các trường khác hợp lệ. Lần lượt thử lịch quá khứ, QR thiếu id, ảnh sai purpose, QR của người khác | Lịch quá khứ và ảnh sai purpose trả 422. Thiếu qrAssetId trả 400. Ảnh khác chủ bị từ chối. Tin và các yêu cầu vẫn ở trạng thái trước khi thử. ACCEPT hợp lệ sau đó trả đủ giá, giờ, điểm hẹn và phương thức |
| KT06b · QR và lịch sử | Chốt QR hợp lệ, Lan mở ảnh, An thử mở. Dùng ảnh riêng cho ca này. Sau khi hủy, Lan tải lại và thử URL cũ. Trên ca QR khác, hoàn tất và tải lại | Khi đang giữ hoặc đã hoàn tất, Lan đọc được ảnh, An nhận 404. Sau hủy, lịch sử giữ giá, giờ, điểm hẹn và phương thức, cả hai phiên không còn qrAsset trong giao dịch và Lan nhận 404 ở URL cũ |
| KT06c · Hủy đồng thời với hoàn tất | Minh hủy và Lan xác nhận nhận món trên cùng lịch ACCEPTED, tin vẫn đủ điều kiện bán | Chỉ một thao tác thành công, thao tác còn lại nhận 409. Kết quả cuối là CANCELLED với AVAILABLE hoặc COMPLETED với SOLD |
| KT06d · Mở từ hộp thư | Lan giữ trước khi nhắn. Sau khi có hội thoại, thử lúc chưa có lịch sử đóng, rồi hủy và giữ lại. Tạo yêu cầu của An trên cùng tin | Hội thoại Lan mở đúng yêu cầu hiện hành của Lan. Khi chỉ còn lịch sử thì mở danh sách của Lan với tin đó. Hội thoại chưa có yêu cầu hiện trạng thái rỗng. Dùng conversationId của người ngoài trả 404 |
| KT09a · Khóa hoặc gỡ trong lúc giữ | Trên từng bộ dữ liệu riêng, cho admin khóa người mua rồi thử lại với người bán, mỗi vai trò đều đua với POST và ACCEPT. Thử gỡ tin đồng thời với ACCEPT | Nếu giữ thắng trước, khóa hoặc gỡ hủy yêu cầu đang mở trong cùng transaction quản trị. Nếu khóa hoặc gỡ thắng trước, thao tác giữ bị chặn. Kiểm phiên bị khóa, tin được giải phóng, tin của người bán bị khóa hoặc đã gỡ trả 404 công khai. Mở khóa không phục hồi hẹn. Giao dịch độc lập còn nguyên |
| KT11a · Quyền trên yêu cầu | Lan thử ACCEPT và Minh thử CANCEL trên PENDING, Minh thử COMPLETE trên ACCEPTED. An đọc/sửa yêu cầu riêng của Lan. Minh thử giữ tin đang bán của mình | Sai vai trò nhận 403, An nhận 404, tự giữ nhận 403. Không có thay đổi dữ liệu. Đối chứng trên yêu cầu riêng mới, Lan rút PENDING thành CANCELLED, Minh từ chối PENDING thành REJECTED |

## Kịch bản demo 5–7 phút

1. Minh đăng “Giáo trình Giải tích 1”, chọn Giáo trình, trường A, KTX A, giá 65.000 đ, tình trạng còn tốt và một ảnh bìa.
2. Lan lọc theo trường và giá, nhắn “60.000 đ ở sảnh A1 được không?”, bấm giữ. An cũng gửi giữ để minh họa trường hợp cạnh tranh.
3. Minh nhận giữ cho Lan ở giá 60.000 đ, chọn giờ tương lai tại sảnh A1, COD. Mở lại tài khoản An để thấy yêu cầu bị từ chối.
4. Lan xác nhận đã nhận sách. Minh và Lan đánh giá nhau. Mở lại tin và hồ sơ Minh để thấy nhãn đã bán cùng điểm uy tín.
5. Ở mốc 3, chuyển sang admin, mở báo cáo OPEN đã chuẩn bị trên một tin mẫu khác đang hẹn. Ghi lý do và gỡ tin qua báo cáo. Kiểm báo cáo ACTIONED, lịch bị hủy và hai bên có thông báo. Xem thống kê trong kỳ có giao dịch cuốn sách ở bước 4.

Trước buổi demo, chạy migration + seed trên DB demo, chuẩn bị phiên đăng nhập, ảnh mẫu và hộp thư. Khi nghiệm thu, ghi mã ca, phiên bản commit, người chạy, kết quả thực tế và ảnh chụp nếu lỗi. Nhóm có thể đưa bảng kết quả rút gọn vào mục triển khai và đánh giá của báo cáo.
