# Kết luận ngắn và căn cứ so khớp

Mục tiêu là giúp người xem hiểu **mức đánh giá dựa vào những quan sát nào**, với lượng thông tin giới hạn. Đây là diễn giải mô tả, không phải bảng trọng số hay phép giải thích định lượng từng phần của điểm.

## Nội dung hiển thị

- **Kết luận:** một câu theo mức điểm đã trả về. Trên 90 là tương đồng cao; 70–90 cần xem xét; dưới 70 là ít tương đồng; thiếu dữ liệu thì không chấm điểm.
- **Căn cứ đối chiếu:** tối đa ba ý, mỗi ý tối đa 140 ký tự. Nếu có cả điểm giống và khác, giữ ít nhất một ý khác biệt. Điểm thấp ưu tiên khác biệt; những mục trùng tiêu chí được gộp theo nhóm quan sát.
- **Lưu ý:** tối đa một nội dung 160 ký tự về giới hạn quan sát. Không tự thêm hạn chế nếu phản hồi không ghi nhận; trường hợp thiếu dữ liệu có hướng dẫn kiểm tra lại ảnh.

Ảnh Q/K, thời gian và các ngưỡng màu giữ nguyên. Cùng phần giải thích được dùng cho kết quả tại chỗ, trang đối chiếu, mẫu tốt nhất của mỗi tổ chức trong Top 3 và báo cáo HTML.

## Cách tạo giải thích

1. Prompt `seal-brief-vi-v3` yêu cầu từng nhận xét ngắn, chỉ nói về con dấu. Tối đa hai căn cứ tương đồng, hai căn cứ khác biệt và một vùng chưa rõ. Không bắt điền đủ số lượng; không so chữ ký và không đoán nét bị che.
2. Phản hồi vẫn theo schema hiện có và được lưu đầy đủ. Không thêm một yêu cầu API riêng để viết bản tóm tắt.
3. `compact_explanation` tạo kết luận thống nhất với mức điểm, chọn căn cứ thực sự đã ghi nhận và một hạn chế. Không dùng diễn giải để nâng/hạ điểm. Loại nhận xét về chữ ký khỏi căn cứ, nội dung kỹ thuật, kết luận thật/giả/cùng dụng cụ và phần trăm/đặc trưng chưa đo.
4. Không cắt ngang câu dài để tránh mất ý phủ định/điều kiện. Với kết quả cũ, chỉ chọn căn cứ đủ ngắn, giữ dữ liệu gốc; nếu cần căn cứ súc tích hơn, chạy lại với prompt mới. Các nhận xét riêng về chữ nhỏ, màu hoặc phần che khuất không được biến thành chứng cứ trùng dụng cụ vật lý.

Schema trình bày thêm vào API kết quả dưới trường `explanation` (ví dụ minh họa, không phải một kết quả đã đo):

```json
{
  "conclusion": "Hai ảnh có mức tương đồng cao về các đặc điểm con dấu quan sát được.",
  "reasons": [
    {"kind": "matching", "text": "Vòng viền và bố cục chữ tương đồng."},
    {"kind": "differing", "text": "Khoảng cách một số ký tự có khác biệt."}
  ],
  "limitation": "Một phần chữ trên vành dấu bị che khuất."
}
```

Kết quả lỗi không có giải thích hoặc điểm giả. Kết quả thiếu dữ liệu không hiển thị các quan sát như bằng chứng đã khớp. Tên nhà cung cấp/model và cơ chế truyền dữ liệu tiếp tục không nằm trong nội dung trình bày cố định.

## Khi bổ sung thuật toán

Adapter thuật toán có thể trả cùng cấu trúc `explanation`; giao diện không phụ thuộc nhà cung cấp. Mỗi căn cứ phải xuất phát từ phép đo/đặc trưng thực sự có: hình dạng vòng, bố cục, chữ đã đọc được, biểu tượng hoặc chi tiết tương ứng. Chưa đo được tiêu chí nào thì không sinh điểm thành phần, số lượng keypoint hay mức đóng góp cho tiêu chí đó. Giữ riêng hạn chế chất lượng và kết luận tương đồng, không dùng tên tổ chức hoặc phần bị che để điền lý do.

Tham khảo kỹ thuật: [OpenAI Docs — Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) cho cơ chế schema/Pydantic hiện có; [Images and vision](https://developers.openai.com/api/docs/guides/images-vision) nêu hạn chế khi đọc chữ nhỏ, chữ xoay và nhận xét hình ảnh. Schema ràng buộc định dạng, không tự bảo đảm căn cứ quan sát đúng; vẫn cần bộ ảnh kiểm chứng thực tế.
