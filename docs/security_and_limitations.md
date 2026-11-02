# Bảo mật và giới hạn V1

- Seed admin/admin chỉ khi development, hash Argon2. Lần đầu chỉ gọi me/logout/change-password; nghiệp vụ trả 403 đến khi đổi mật khẩu. Production từ chối mật khẩu admin/tài khoản chưa đổi. Không tự public server.
- Token/CSRF ngẫu nhiên, lưu HMAC với SESSION_SECRET_KEY. Cookie HttpOnly/SameSite Strict, Secure ở production. Mutation cần X-CSRF-Token, kiểm tra Origin nếu có. Login 10/5 phút/IP, test OpenAI 3/phút/user, compare 10/phút/user, preview 120/phút/user. Limiter trong process; nhiều worker cần shared store.
- File và phiên riêng theo owner, admin có quyền xem toàn bộ. Ảnh reference active là tài nguyên chung cho người đã đăng nhập. Chia sẻ processed ROI không cho quyền xem file gốc. Viewer không mutation; backend kiểm tra quyền.
- Decode thật/MIME theo bytes; whitelist PDF/PNG/JPEG/TIFF/WEBP. Giới hạn bytes/trang/pixel. Từ chối tệp hỏng/mã hóa không đọc được. PDFium render, không thực thi embedded script. UUID paths/containment chống traversal; không static public data.
- SQLAlchemy parameter binding. Strict inputs. API không trả password hash/token hash/storage path/key. Validation không echo input. Request log không query/body/upstream text; audit không credential/base64.
- .env/data/dump/node_modules/venv bị ignore. Secret phiên local ngẫu nhiên. Quyền disk và backup do máy triển khai quản lý; V1 không mã hóa at-rest.
- OpenAI cần consent phiên và giới hạn K; lưu timestamp/provider/snapshot. Không gọi khi upload/preview/settings/health. Hai PNG ROI/cặp, tối đa cạnh 2048px, không upscale, store=False. Nếu ROI là toàn ảnh/trang, API và UI yêu cầu xác nhận allow_full_page riêng, cảnh báo toàn bộ nội dung có thể được gửi. Cấu hình store=False không thay thế chính sách lưu giữ của nhà cung cấp.
- Timeout giới hạn một cặp kể cả SDK retry tối đa 2 lần có backoff. Không tự frontend retry. Nhiều K có thể completed một phần rồi failed, giữ kết quả trước. Mất trình duyệt không đảm bảo hủy upstream. V1 chưa durable job queue.
- Refusal/timeout/429/invalid schema không sinh điểm giả. insufficient_data ép score/same_design_plausible về null. Không có probability_same_device, không tọa độ AI. Annotation source user, không sửa nội dung AI.
- React hiển thị text. Báo cáo escape nội dung người dùng/AI, CSP sandbox/default-src none, chỉ data image/style nội bộ, không script. HTML xuất chứa ảnh nhạy cảm; người tải tự quản lý quyền chia sẻ. PDF dùng trình duyệt in, chưa PDF server.
- Mask đỏ có thể bỏ mực khác màu, morphology thay đổi hình dạng, sharpen không phục hồi chứng cứ. Khác scale/góc/điều kiện chụp có thể ảnh hưởng kết quả. Overlay chưa registration. Màu chỉ đặc tính phụ. Không suy ra cùng dụng cụ, thật/giả hoặc tên tổ chức.
- Dropdown và bộ chọn V1 lấy tối đa 100 bản ghi; danh sách chính có pagination. Kho lớn cần bộ chọn tìm kiếm phía server. Chưa có retention tự động. Upload orphan nếu DB lỗi cần đối soát thủ công, không tự xóa để tránh mất chứng cứ.

Trước production cần admin mạnh, TLS/reverse proxy, origin đúng, DB user tối thiểu quyền, giới hạn proxy, backup/restore đã thử và đánh giá mô hình trên tập độc lập. Không mô tả các hạng mục này là đã hoàn thành trong V1.
