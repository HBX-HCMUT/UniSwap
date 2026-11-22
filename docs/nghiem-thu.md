# Kiểm thử và kịch bản bảo vệ

Các ca dưới đây là tiêu chí cần đạt khi có mã chạy. Dùng hai cửa sổ trình duyệt với phiên của Minh (người bán) và Lan (người mua). Có thêm An (người mua thứ hai), một admin và một tài khoản chưa xác minh. Dùng dữ liệu hư cấu và hộp thư local. Seed trường A/B, khu A/B, danh mục Giáo trình, Đồ KTX, Điện tử, và một từ khóa giả để thử chờ duyệt.

| Ca | Thao tác kiểm tra | Dấu hiệu đạt |
|---|---|---|
| KT01 · UC01 | Đăng ký đúng miền, thử đăng nhập trước/sau khi bấm xác thực, dùng lại token, thử Google đúng/sai miền, sửa hồ sơ | Đăng nhập thành công sau xác thực. Sai miền bị chặn. Dùng lại token nhận 410. Hồ sơ công khai không chứa liên hệ riêng |
| KT02 · UC02 | Minh tải ảnh giáo trình, điền giá 65.000, đăng tin. Thử ảnh thứ 7, file sai định dạng, Lan thử sửa tin. Minh ẩn/hiện tin | Có ảnh bìa và giá đúng. Ảnh sai bị chặn. Chỉ Minh sửa được. Ẩn thì khách không mở được link, hiện lại thì tìm được |
| KT03 · UC03/04 | Tìm “Giải tích”, lọc trường A, KTX A, giá 50.000–70.000, tình trạng GOOD. Mở chi tiết. Đổi maxPrice thành 40.000 | Tin đúng xuất hiện, kết hợp lọc không khớp trả danh sách rỗng, khoảng giá đảo chiều báo lỗi. Hồ sơ chưa có đánh giá hiển thị đúng |
| KT04 · UC05 | Lan nhắn Minh từ trang tin, mở lại hội thoại ở phiên khác. An cố mở URL hội thoại riêng | Có một hội thoại Lan–Minh cho tin; thông báo mới xuất hiện trong chu kỳ polling, tải lại còn tin. An không đọc được |
| KT05 · UC06 | Lan và An gửi yêu cầu. Gửi lại yêu cầu Lan. Dùng hai phiên Minh để chấp thuận hai yêu cầu gần như đồng thời | Yêu cầu Lan giữ nguyên id. Chính xác một yêu cầu ACCEPTED, tin RESERVED, yêu cầu còn lại REJECTED. Request thua trả 409. DB không có hai lượt giữ hiệu lực |
| KT06 · UC06 | Hủy lịch đã giữ, tạo yêu cầu mới, xác nhận giá 60.000 và lịch mới, người mua bấm đã nhận. Thử chấp thuận với giờ quá khứ, thử QR thiếu ảnh, thử lặp COMPLETE | Hủy mở lại tin. Giờ qua/QR sai bị chặn. Hoàn tất làm tin SOLD và có đúng một giao dịch hoàn tất. Lặp COMPLETE trả 409 |
| KT07 · UC07 | Lan lưu tin, theo dõi Minh và danh mục Giáo trình, Minh đăng cuốn khác rồi sửa giá, Lan đánh dấu thông báo đã đọc | Lưu và bỏ lưu vẫn đúng sau tải lại. Một thông báo cho cuốn mới dù theo dõi qua hai nguồn. Sửa giá không nhân bản thông báo |
| KT08 · UC08 | Hai bên đánh giá sau hoàn tất. An chấm thay, Lan chấm lại, thử đánh giá trước giao nhận | Từng bên chấm được một lượt. Chặn người ngoài/lượt trùng/quá sớm. Điểm trung bình và số lượt đúng theo các đánh giá thực |
| KT09 · UC09 | Đăng tin chứa từ khóa mẫu, admin duyệt. Lan báo cáo một tin đang giữ, admin gỡ và ghi lý do. Thử lại link cũ | Tin chờ không lộ ở chợ. Gỡ tin đóng yêu cầu còn mở, hai bên nhận thông báo, khách thấy 404, admin còn nhật ký |
| KT10 · UC10 | Thử vào admin bằng Lan. Admin khóa/mở tài khoản, tắt danh mục, tra số liệu theo một kỳ bao trọn demo | Lan bị chặn. Phiên đã khóa mất hiệu lực. Danh mục cũ vẫn đọc được trên tin, form mới không chọn được. Mỗi giao dịch COMPLETED chỉ tăng bộ đếm một lần |
| KT11 · Quyền và khôi phục | Gửi API khi đăng xuất, đổi id sang giao dịch người khác, mở URL QR bằng tài khoản khác, tắt rồi mở lại dịch vụ | 401/404 theo ngữ cảnh. QR riêng tư. Dữ liệu DB và ảnh đã lưu còn sau khởi động lại |
| KT12 · UI/SEO/hiệu năng | Mở link tin trong cửa sổ ẩn danh ở 360px và desktop. Kiểm tra tiêu đề trong HTML. Chạy 20 lượt tìm kiếm với cùng seed và ghi thời gian phản hồi | Có tiêu đề món và giá trong HTML, hoàn thành thao tác bằng bàn phím, màn hình không tràn ngang. Ghi số tin seed, máy demo và p50/p95 thực đo; dùng kết quả làm mốc so sánh lần sau |

KT01 có thể kiểm tra quy tắc miền và cờ email đã xác thực bằng danh tính Google giả lập ở môi trường test. Để xác nhận tích hợp thật, nhóm cần cấu hình OAuth client, callback và tài khoản thử đúng miền. Ghi riêng kết quả “giả lập” và “Google thật” trong biên bản. Buổi demo chính có thể dùng SMTP local. KT06 và KT11 kiểm cả QR thủ công ở mốc 3. Kịch bản thuyết trình bên dưới dùng COD.

## Kịch bản demo 5–7 phút

1. Minh đăng “Giáo trình Giải tích 1”, chọn Giáo trình, trường A, KTX A, giá 65.000 đ, tình trạng còn tốt và một ảnh bìa.
2. Lan lọc theo trường và giá, nhắn “60.000 đ ở sảnh A1 được không?”, bấm giữ. An cũng gửi giữ để minh họa trường hợp cạnh tranh.
3. Minh nhận giữ cho Lan ở giá 60.000 đ, chọn giờ tương lai tại sảnh A1, COD. Mở lại tài khoản An để thấy yêu cầu bị từ chối.
4. Lan xác nhận đã nhận sách. Minh và Lan đánh giá nhau. Mở lại tin và hồ sơ Minh để thấy nhãn đã bán cùng điểm uy tín.
5. Chuyển sang admin, xử lý một tin có sẵn trong hàng chờ, xem thống kê giao dịch trong kỳ. Dùng tin mẫu khác để giữ nguyên lịch sử của cuốn sách vừa bán.

Trước buổi demo, chạy migration + seed trên DB demo, chuẩn bị phiên đăng nhập, ảnh mẫu và hộp thư. Khi nghiệm thu, ghi mã ca, phiên bản commit, người chạy, kết quả thực tế và ảnh chụp nếu lỗi. Nhóm có thể đưa bảng kết quả rút gọn vào mục triển khai và đánh giá của báo cáo.
