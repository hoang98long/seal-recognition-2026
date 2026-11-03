# So khớp văn bản và ảnh con dấu

Mở **Văn bản & ảnh dấu** trong sidebar hoặc Tổng quan: **http://localhost:5180/compare/document-stamp**. Đường dẫn cũ `/demo/document-stamp` vẫn được chuyển tiếp. Khởi động bằng `uvicorn` và `npm run dev` theo [hướng dẫn terminal](vscode.md).

## So khớp trong ba bước

1. **Chọn văn bản & dấu mẫu:** tải PDF/ảnh văn bản. Tải ảnh dấu từ máy hoặc mở **Chọn từ thư viện**, tìm theo tên dấu/tổ chức. Không cần chuẩn bị thư viện trước.
2. **Kiểm tra vùng dấu:** chọn đúng trang nếu tệp có nhiều trang. Vùng mực đỏ được gợi ý tự động; kéo khung để chỉnh hoặc khoanh thủ công nếu không có gợi ý. Bấm **Xác nhận vùng dấu Q/K** để lưu. Dấu đã chuẩn bị trong thư viện dùng ngay, không phải cắt lại. Tọa độ/thông số nâng cao nằm trong mục mở rộng. Dùng toàn ảnh vẫn cần xác nhận riêng.
3. **So khớp & kết quả:** kiểm tra hai ảnh, xác nhận quyền chia sẻ và bấm **So khớp bằng OpenAI**. Tên phiên tự điền theo văn bản và có thể sửa trước lần chạy đầu. Kết quả hiện ngay bên dưới: điểm/null, nhận xét, giống/khác/chưa rõ, chữ đọc được, hạn chế và khuyến nghị.
4. **Báo cáo / lịch sử:** xuất HTML để in/lưu PDF, mở kết quả đầy đủ để khoanh vùng hoặc xem kỹ thuật. Chạy lại cần xác nhận chia sẻ lại và thêm phiên bản kết quả; không ghi đè bản cũ. Nếu chỉnh ROI/thông số, phải lưu lại Q/K trước khi gửi tiếp.

Key/model lấy từ backend/.env và key không được đưa ra frontend. Nếu đổi cấu hình, khởi động lại backend và bấm **Đọc lại trạng thái** trên trang.

Thiếu key vẫn tải/chuẩn bị ảnh được, nút so khớp bị khóa. Key sai, timeout, 429, refusal hoặc phản hồi không hợp lệ hiển thị lỗi, không tự tạo điểm. Chỉ gọi API khi bấm so khớp sau xác nhận; có thể phát sinh phí theo tài khoản API.

Các bước chuẩn bị được giữ trong trang đang mở; tải lại trang sẽ bắt đầu luồng mới. Tệp đã lưu vẫn nằm trong kho, phiên/kết quả đã tạo vẫn mở lại được từ **Lịch sử phân tích**. Không tự gửi lại request khi tải trang.

## Thêm con dấu tổ chức

Mở **Thêm con dấu tổ chức** tại Tổng quan/Thư viện hoặc bấm **Thêm con dấu** trên dòng tổ chức để điền sẵn đơn vị.

1. Chọn tổ chức có sẵn (có ô tìm tên/mã), hoặc chọn **Tạo tổ chức mới** và nhập tên ngay tại đây.
2. Tải ảnh dấu hoặc PDF có dấu. Tên dấu tự điền theo tên tệp và có thể sửa. Nếu tổ chức đã có mẫu, chọn mẫu để thêm ảnh vào cùng mẫu đó.
3. Kiểm tra và xác nhận vùng dấu; chỉnh chất lượng chỉ khi cần.
4. Bấm **Lưu vào thư viện** ở thanh thao tác cuối màn hình. Tổ chức mới, mẫu mới và ảnh được lưu trong cùng giao dịch; lỗi không để lại tổ chức/mẫu mới dang dở.
5. Chọn **So khớp văn bản với dấu này**, **Thêm ảnh dấu khác** hoặc **Xem trong thư viện**. Ảnh mới có trạng thái tham chiếu, chưa xác thực; không giả định cùng dụng cụ vật lý.

## Dữ liệu và API

Dùng lại upload, documents, preprocessing/apply, analyses và compare-openai. Thêm `POST /reference-intake` để lưu tổ chức/mẫu/ảnh cùng một lần, `GET /preprocessing/by-output/{asset_id}` để dùng lại ảnh đã chuẩn bị (có kiểm tra quyền truy cập). Phiên pairwise gắn source_document_id và ảnh Q đúng trang. Chọn nguyên ảnh thư viện giữ reference_impression_id; chỉnh lại K tạo bản xử lý mới có metadata nguồn ảnh. Mỗi processed asset/run giữ ROI/thông số/SHA256; snapshot lưu chính xác hai ảnh, model, prompt và usage. Không cần migration mới.

Kết quả chỉ là tương đồng biểu kiến, chưa hiệu chuẩn; không phải xác suất cùng dụng cụ hoặc kết luận tài liệu thật/giả. Dấu mờ/thiếu chi tiết có thể trả không đủ cơ sở kết luận và điểm null.

## Kiểm thử

```powershell
cd frontend
npm run build
npm run test:e2e
```

E2E dùng PDF/ảnh thử nghiệm, schema PostgreSQL riêng và mock của SDK OpenAI. Kiểm tra chọn trang, xác nhận vùng/toàn ảnh, thêm tổ chức cùng dấu, dùng lại thư viện, consent, báo cáo, chạy lại, thiếu key/lỗi upstream và màn hình nhỏ. Không gọi API trả phí trong kiểm thử. Backend kiểm tra quyền truy cập, liên kết tổ chức/mẫu và rollback khi lỗi.
