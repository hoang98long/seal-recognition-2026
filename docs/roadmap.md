# Roadmap thuật toán

V1 chỉ có OpenAI Vision và tiền xử lý OpenCV/Pillow. Chưa có phát hiện giả mạo, ICP, embedding, 35 đặc trưng hay xác suất cùng dụng cụ.

V2:

- Bộ dữ liệu con dấu được gắn nhãn, có quyền sử dụng, tách train/test theo dụng cụ và tổ chức.
- StampDetectorProvider: YOLO, benchmark ROI với nhãn người dùng.
- StampSegmenterProvider: segmentation mực, đánh giá chồng chữ/mất nét/mực nhạt.
- StampRegistrationProvider: fitting/ECC/phase correlation/ICP hai chiều đa khởi tạo, lưu transform và giới hạn biến dạng.
- FeatureExtractorProvider: IoU/Dice/Chamfer/NN/SSIM/NCC/OCR/FFT và chi tiết cục bộ có định nghĩa/version/kiểm chứng.
- RetrieverProvider: Siamese + pgvector/FAISS top-K nội bộ; không gửi hàng nghìn ảnh tới OpenAI.
- Worker queue ở ranh giới orchestrator, phục hồi job chết và hủy bền vững.

V3:

- PairClassifierProvider: Random Forest/LightGBM, phân biệt thiết kế với nguồn vật lý, SHAP trên đặc trưng đã kiểm chứng.
- ScoreCalibrationProvider: validation độc lập, ROC/PR/FAR/FRR, hiệu chuẩn và miền áp dụng trước dùng từ xác suất.
- ReportProvider: vùng khác biệt từ mask/transform tái lập được, không dùng tọa độ model ngôn ngữ làm chứng cứ hình học.
- PDF server/font tiếng Việt có quyền, retention/backup/audit production.

Brief đề xuất hướng nghiên cứu từ công trình shoeprint matching arXiv:2405.14878. Chuyển sang con dấu là nghiên cứu tương lai, chưa xác minh hiệu năng. Skeleton ICP/Siamese/ensemble ném NotImplementedError và không nằm trong registry.
