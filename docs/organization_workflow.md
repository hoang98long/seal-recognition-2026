# Tổ chức → thư viện dấu → tra cứu Top 3 qua OpenAI

Luồng chính ở **Tổ chức & thư viện dấu** (`/organizations`) và **Tra cứu Top 3 tổ chức** (`/compare/library`). Khởi động bằng `uvicorn` và `npm run dev` như [hướng dẫn terminal](vscode.md). Sau cập nhật này nên khởi động lại backend một lần rồi làm mới trình duyệt.

## 1. Hồ sơ tổ chức

CSDL local đã được thêm danh mục **VPCP — Văn phòng Chính phủ**, **TTCP — Thủ tướng Chính phủ**, **BCA — Bộ Công an**, **BQP — Bộ Quốc phòng**. Đây chỉ là danh mục đơn vị, không phải dấu mẫu hoặc kết quả so khớp giả. Có thể tạo thêm đơn vị bằng **Thêm tổ chức**.

Bấm tên đơn vị hoặc **Xem con dấu** để mở hồ sơ. Ba mục trong hồ sơ:

- **Con dấu:** lưới ảnh tham chiếu của đơn vị, mở cặp đối chiếu hoặc đưa một mẫu làm Q để tra cứu cả thư viện.
- **Tài liệu nguồn:** PDF/ảnh đã tải theo đơn vị, số trang, tệp gốc và đường tắt **Tách con dấu**.
- **Cấu hình xử lý:** bộ thông số dùng chung theo đơn vị. Mục “Hồ sơ cá nhân” trước đây thực chất là cấu hình tiền xử lý, nay được đưa về tổ chức; cấu hình cũ chưa có tổ chức có thể gắn vào đơn vị tại mục này. Tài khoản đăng nhập và mật khẩu vẫn thuộc phần tài khoản.

## 2. Tải tài liệu, tách và lưu dấu

1. Trong hồ sơ đơn vị, bấm **Tải tài liệu & tách dấu**. Có thể chọn nhiều PDF/ảnh trong một lần; danh sách tệp đã tải cho phép chuyển qua từng tài liệu.
2. Chọn đúng trang qua danh sách trang, ảnh thu nhỏ hoặc **Trang cuối**. Dấu điện tử nằm trong chú thích PDF hoặc biểu mẫu chữ ký được render cùng nội dung trang.
3. Kéo chuột khoanh sát con dấu. Có thể vẽ khung mới ngay khi chưa có vùng chọn; nút **Chọn vùng** đưa công cụ về chế độ vẽ lại. Kéo góc để sửa kích thước, kéo khung để di chuyển sau khi vẽ. Gợi ý mực đỏ là tùy chọn, không bắt buộc.
4. **Tách mực đỏ** giúp loại chữ ký/chữ in đen hoặc xanh. **Dấu đen / xám** cho xử lý xám/ngưỡng. Với dấu đen và chữ ký cùng màu, cần khoanh sát dấu; bộ lọc màu không thể bảo đảm tách riêng hai loại nét đó.
5. Kiểm tra preview, bấm **Xác nhận vùng dấu Q/K**. Có thể chọn toàn ảnh/trang thay cho khoanh vùng. Các thông số thêm nằm trong phần mở rộng. Có thể đổi tên ảnh bằng biểu tượng bút bên tên đã lưu.
6. Bấm **Lưu vào thư viện**. Tài liệu, trang nguồn, ảnh xử lý và đơn vị được liên kết. Ảnh được gắn trạng thái tham chiếu, chưa tự xác thực.
7. Sau khi lưu, chọn **Tách dấu khác từ tài liệu này**, **Tài liệu tiếp theo** hoặc **Thêm ảnh dấu khác**. Như vậy một tài liệu có thể cho nhiều ảnh dấu đã khoanh riêng.

Nếu đã xử lý ảnh trước đây, chọn **Hoặc chọn ảnh đã xử lý** trong trang thêm dấu, hoặc từ xưởng bấm **Lưu vào tổ chức**. Tên hiển thị mặc định có nguồn, trang, tổ chức khi biết và mã ngắn để tránh trùng. Đổi tên không thay đổi byte ảnh, SHA256 hay snapshot kết quả cũ.

Nếu bản cắt cũ từng thiếu dấu do PDF chưa render biểu mẫu/chú thích, hãy cắt và lưu phiên bản mới từ PDF gốc. Bản sửa không tự ghi đè các ảnh đã lưu trước đây.

### Chỉnh sửa, thay ảnh và xóa con dấu

Trong hồ sơ tổ chức, mỗi thẻ dấu có **Chỉnh sửa** và **Xóa**. Các nút này cũng có trong thư viện chung; chỉ tài khoản có quyền chỉnh sửa được sử dụng.

- **Chỉnh sửa:** đổi tên mẫu và ghi chú rồi bấm **Lưu thay đổi**. Tên mẫu dùng chung cho các ảnh thuộc mẫu đó; ghi chú áp dụng riêng cho ảnh đang chọn.
- **Thay ảnh con dấu:** tải PDF/ảnh mới hoặc chọn ảnh đã xử lý. Khoanh vùng, bấm **Xác nhận vùng dấu K**, kiểm tra ảnh hiện tại/ảnh thay thế rồi **Lưu thay đổi**. Tài liệu và trang nguồn mới tự liên kết với tổ chức. Ảnh mới về trạng thái **Chỉ tham chiếu** để kiểm tra lại; nhãn xác thực của ảnh cũ không được chuyển sang ảnh mới. **Giữ ảnh hiện tại** hoặc **Hủy** bỏ thay đổi chưa lưu trên con dấu.
- **Xóa:** cần xác nhận trước khi gỡ ảnh khỏi thư viện và các lượt tra cứu mới. Ảnh gốc, tệp đã xử lý và kết quả đối chiếu trước đó vẫn được giữ lại; người có phiên đối chiếu vẫn xem được ảnh đã dùng trong phiên của mình.

Chỉnh sửa/xóa không gửi ảnh tới OpenAI và không phát sinh lượt phân tích. Các phiên đã tạo tiếp tục dùng ảnh đã chọn lúc tạo; muốn đối chiếu với ảnh thay thế, chọn lại dấu trong thư viện hoặc tạo phiên mới. Thay đổi này sử dụng cấu trúc CSDL hiện có, không cần chạy migration hoặc script đồng bộ.

## 3. Tra cứu toàn thư viện và Top 3 tổ chức

1. Mở `/compare/library`, tải PDF/ảnh bất kỳ và chuẩn bị Q. Hoặc từ xưởng/ảnh đã chuẩn bị bấm **Tra cứu Top 3**.
2. Màn hình cho biết số mẫu hợp lệ, số tổ chức và số cặp Q/K sẽ gửi. Chỉ ảnh `processed_stamp` đã xác nhận vùng, có run xử lý và thuộc mẫu/đơn vị đang hoạt động mới tham gia. Mẫu chưa sẵn sàng được thống kê riêng.
3. Bấm **Tra cứu Top 3** để bắt đầu ngay sau khi chuẩn bị Q. Đây vẫn là so sánh từng cặp qua OpenAI API; giao diện dùng nhãn trung tính, chưa có thuật toán matching nội bộ. Giới hạn 5 K của màn hình so khớp thủ công không cắt bớt lượt tra cứu toàn thư viện này.
4. Theo dõi tiến độ. Mỗi kết quả được lưu ngay sau một cặp ảnh. Có thể mở lại phiên qua Lịch sử và nút **Top 3 & tiến độ tra cứu** trong kết quả chi tiết.
5. Top 3 là tối đa ba **tổ chức khác nhau**; điểm của mỗi đơn vị là **điểm cao nhất trong các mẫu đã so của đơn vị đó**, không phải trung bình, không phải xác suất sở hữu dấu. CSDL có ít hơn ba đơn vị đủ dữ liệu thì hiển thị đúng số có kết quả.
6. Có lỗi API hoặc backend bị ngắt: bảng ghi rõ kết quả tạm thời/chưa quét đủ. **Tiếp tục** chỉ chạy cặp lỗi hoặc chưa có kết quả, giữ các cặp đã thành công. Phiên ngắt đột ngột được nhận diện sau thời gian không có cập nhật lớn hơn timeout API + 120 giây. Backend cần chạy để tác vụ nền tiếp tục; không tự thực thi sau khi tiến trình bị dừng.

Màu nhất quán trên kết quả cặp, Top 3 và báo cáo: **>90% xanh**, **70–90% vàng**, **<70% đỏ**, **không đủ dữ liệu màu xám/không gán điểm**. Ngưỡng màu chỉ giúp đọc kết quả, không ép model chấm điểm cao.

Kết quả hiển thị gọn gồm điểm, mức đánh giá, ảnh đối chiếu, thời gian và xếp hạng tổ chức. Mỗi mẫu kết quả có một câu kết luận, tối đa ba căn cứ quan sát và một lưu ý nếu có; Top 3 dùng nhận xét của mẫu đạt điểm cao nhất thuộc từng đơn vị. Diễn giải chi tiết, OCR, model/prompt/token không hiển thị trên giao diện hoặc báo cáo xuất. Dữ liệu đầy đủ vẫn được lưu nội bộ; không tự tạo điểm thành phần hoặc số lượng đặc trưng khi bộ xử lý chưa trả các chỉ số đó.

## Chỉ so sánh con dấu và đọc chữ

Prompt `seal-brief-vi-v3` tiếp tục yêu cầu bỏ chữ ký, tên người ký và chức danh/chữ đánh máy chồng lên khỏi tiêu chí tương đồng. Nét che được ghi là vùng chưa rõ, không tự coi là khác biệt của dấu. Chữ in rõ khác nhau trên vành dấu vẫn là khác biệt thiết kế có ý nghĩa.

Hai ảnh gửi API dùng `detail: high`. Ảnh nhỏ được phóng tối đa 4 lần, cạnh dài tối đa 1024 cho mục đích đọc chữ, vẫn tuân thủ giới hạn ảnh cấu hình. Phóng ảnh không phục hồi nét đã mất. Model được yêu cầu đọc đủ các cung chữ, kiểm tra dấu tiếng Việt và không tự điền từ như “Thủ” nếu thật sự bị che. Các kết quả cũ vẫn giữ prompt/model tại thời điểm chạy; cần tạo lượt so khớp mới để dùng prompt mới.

Tham khảo: [OpenAI Images and vision](https://developers.openai.com/api/docs/guides/images-vision) mô tả hạn chế với chữ nhỏ và chữ xoay; [pypdfium2](https://pypdfium2.readthedocs.io/en/stable/python_api.html) mô tả `init_forms`, `may_draw_forms`, `draw_annots`.

## Đồng bộ CSDL local

Migration `20261110_org_flow` bổ sung `source_documents.organization_id`, `preprocessing_profiles.organization_id` và `file_assets.display_name`, không xóa các bảng/cột cũ.

Trước cập nhật đã tạo bản sao lưu PostgreSQL: `data/backups/seal-before-org-workflow-20261110-082837.dump`. Khi đồng bộ lần đầu: 1 người dùng, 7 ảnh/tệp, 2 tài liệu nguồn, 0 ảnh tham chiếu thư viện và 3 kết quả phân tích được giữ nguyên số lượng; bốn ảnh xử lý cũ được đặt tên hiển thị. Không tự đoán tổ chức để gắn các ảnh cũ: hãy chọn đơn vị và dùng lại ảnh đã xử lý để lưu thành mẫu tham chiếu trước khi tra cứu.

Để triển khai trên máy khác có cấu hình PostgreSQL tương ứng: kích hoạt venv, chạy `python scripts/sync_organization_workflow.py` từ thư mục gốc. Script yêu cầu `pg_dump`, sao lưu trước rồi mới migration và thêm danh mục theo cách idempotent. Không cần chạy lại trên máy local đã được đồng bộ trong lượt cập nhật này.

## Gợi ý vận hành tiếp theo

- Mỗi đơn vị nên có vài mẫu rõ từ nhiều tài liệu, giữ ảnh gốc, tránh chỉ lưu một ảnh bị chữ ký che nhiều.
- Tạo bộ kiểm chứng riêng gồm dấu đỏ/đen, dấu nhỏ, chữ xoay, chữ “Thủ”, văn bản/chữ ký chồng nét để đối chiếu khi thay prompt hoặc model.
- Đánh dấu chất lượng và phiên bản mẫu theo thời kỳ; khi thư viện lớn, cân nhắc worker nền riêng và dự toán chi phí trước khi quét nhiều cặp API.
