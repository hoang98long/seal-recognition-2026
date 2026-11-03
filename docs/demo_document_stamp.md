# Demo: con dấu trong văn bản đối chiếu ảnh tải lên

Mục riêng **Demo văn bản & ảnh dấu** ở sidebar, hoặc nút cùng tên tại Tổng quan. Đường dẫn local: **http://localhost:5180/demo/document-stamp**. Khởi động vẫn bằng `uvicorn` và `npm run dev` như [hướng dẫn terminal](vscode.md).

## Luồng demo

1. **Tải văn bản & ảnh dấu:** bên trái tải PDF hoặc ảnh văn bản có con dấu (Q); bên phải tải PNG/JPG/TIFF/WEBP của dấu tham chiếu (K). Không cần tạo tổ chức hay mẫu trong thư viện. Tệp được lưu nội bộ, chưa gọi OpenAI.
2. **Chọn vùng và chuẩn bị Q/K:** chọn đúng trang PDF/khung ảnh, kéo ROI hình chữ nhật hoặc dùng gợi ý vùng mực đỏ rồi chỉnh lại. Điều chỉnh xoay, sáng, tương phản, gamma hoặc preset nếu cần. Xác nhận vùng và bấm **Lưu ảnh Q để so khớp**, **Lưu ảnh K để so khớp** ngay tại trang này. Nếu dùng toàn ảnh, cần xác nhận riêng rằng toàn bộ nội dung có thể được gửi.
3. **So khớp & xem kết quả:** kiểm tra hai ảnh sẽ gửi, tên model và số yêu cầu (một cặp Q/K); nhập tên phiên, xác nhận được phép chia sẻ, bấm **So khớp bằng OpenAI**. Kết quả hiện ngay bên dưới: điểm ước lượng/null, nhận xét, giống/khác/chưa rõ, chữ đọc được, hạn chế và khuyến nghị.
4. **Báo cáo / lịch sử:** xuất HTML để in/lưu PDF, mở kết quả đầy đủ để khoanh vùng hoặc xem kỹ thuật. Chạy lại cần xác nhận chia sẻ lại và thêm phiên bản kết quả; không ghi đè bản cũ. Nếu chỉnh ROI/thông số, phải lưu lại Q/K trước khi gửi tiếp.

“Demo” là tên của luồng trình diễn, **không phải kết quả AI giả**. Ứng dụng thường dùng provider OpenAI hiện có, key/model từ backend/.env. Key không được đưa ra frontend. Nếu đổi key/model, khởi động lại backend và bấm **Đọc lại trạng thái** trên trang.

Thiếu key vẫn tải/chuẩn bị ảnh được, nút so khớp bị khóa. Key sai, timeout, 429, refusal hoặc phản hồi không hợp lệ hiển thị lỗi, không tự tạo điểm. Chỉ gọi API khi bấm so khớp sau xác nhận; có thể phát sinh phí theo tài khoản API.

Các bước chuẩn bị được giữ trong trang đang mở; tải lại trang sẽ bắt đầu giao diện demo mới. Tệp đã lưu vẫn nằm trong kho, phiên/kết quả đã tạo vẫn mở lại được từ **Lịch sử phân tích**. Không tự gửi lại request khi tải trang.

## Dữ liệu và API

Dùng lại upload, documents, preprocessing/apply, analyses và compare-openai. Phiên pairwise gắn source_document_id, ảnh Q từ đúng trang, K từ tệp người dùng tải lên. Mỗi processed asset/run giữ ROI/thông số/SHA256; snapshot kết quả lưu chính xác hai ảnh đã gửi, model, prompt và usage. Không cần thêm bảng hoặc migration.

Kết quả chỉ là tương đồng biểu kiến, chưa hiệu chuẩn; không phải xác suất cùng dụng cụ hoặc kết luận tài liệu thật/giả. Dấu mờ/thiếu chi tiết có thể trả không đủ cơ sở kết luận và điểm null.

## Kiểm thử

```powershell
cd frontend
npm run build
npm run test:e2e
```

Kiểm thử mới sinh PDF DEMO hai trang và ảnh dấu DEMO, dùng backend/PostgreSQL riêng cùng HTTP mock của official OpenAI SDK. Kiểm tra chọn trang 2, ROI/tiền xử lý, xác nhận toàn ảnh K, consent, lưu nguồn văn bản, kết quả, báo cáo, chạy lại không ghi đè, lỗi upstream và trường hợp thiếu key. Mock chỉ được nạp trong hạ tầng kiểm thử; không phải fallback của ứng dụng thường.
