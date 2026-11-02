# Kết quả kiểm tra · 02/11/2026

Môi trường: Windows, Python 3.13.9, Node.js 22.14.0, PostgreSQL có sẵn tại localhost:5432. Dependency Python được ghi trong `backend/requirements.lock.txt`, JavaScript trong `frontend/package-lock.json`.

| Kiểm tra | Kết quả |
| --- | --- |
| Tạo database seal_forensics | Đã tạo, giữ nguyên PostgreSQL đang có. |
| Alembic upgrade head | Đạt, revision 4884d09442b4, 15 bảng. |
| Alembic check | Đạt, không có schema drift. |
| Seed idempotent | Đạt, một admin và hai tổ chức DEMO; không seed kết quả phân tích. |
| Pytest PostgreSQL | 46 passed. Schema riêng, migration thật, ảnh DEMO sinh trong test. |
| Ruff | Đạt trên backend và scripts. |
| npm run build | Đạt TypeScript + Vite, routes chia chunk; mọi chunk <500 kB. |
| Playwright Chrome | Đạt luồng đăng nhập → đổi mật khẩu → tổ chức/mẫu → upload → vẽ ROI → xử lý → lưu Q/K → SDK HTTP mock → kết quả → annotation → báo cáo → các route. Có kiểm tra desktop 1366×768 và tablet 820×1180. |
| Chạy server development thật | Backend 8010, frontend 5180; health 200 qua cả API trực tiếp và Vite proxy. |
| Đăng nhập admin/admin trên DB ứng dụng thật | 200, /me yêu cầu đổi mật khẩu; đã logout, chưa đổi mật khẩu của người dùng. |
| OpenAI Vision bằng khóa hợp lệ | **CHƯA XÁC NHẬN VỚI API THẬT — OPENAI_API_KEY đang trống.** |
| Docker build/run | Chưa chạy; Dockerfile/compose được cung cấp, không tự tạo DB container. |

SDK OpenAI 2.54.0 được kiểm tra chữ ký `responses.parse`, dùng Pydantic Structured Outputs. Test mock ở HTTP transport của official SDK, kiểm tra payload đúng hai ảnh ROI, model, store=False, parse/validate và lưu DB. Có test missing key, refusal, invalid structured result, 401/403/404/429/500, timeout/network, insufficient_data → null, consent, nhiều K, guard running/phục hồi phiên bị gián đoạn, XSS trong báo cáo và quyền file/phiên.

Không có API call trả phí trong kiểm thử. Server E2E độc lập ghi rõ **DEMO — không phải AI thật**, không được nhập trong app.main. Test không sửa mật khẩu/metadata của database ứng dụng thật.

Cảnh báo dependency không làm hỏng kiểm tra: Starlette cảnh báo test client httpx sẽ chuyển sang httpx2 ở phiên bản sau; Rollup loại hai chú thích PURE đặt sai vị trí trong Zod. Không tắt kiểm tra hoặc che các cảnh báo đó.

Cổng 8000 và 5173 đang thuộc phần mềm khác (5173 là “DCPC · Infrastructure Console”), nên không dừng hoặc thay tiến trình đó. Cấu hình local riêng dùng API_PORT=8010, FRONTEND_ORIGIN=http://localhost:5180; frontend/.env.local dùng proxy 8010 và port 5180. File .env.example vẫn giữ mặc định 8000/5173. README có cách đổi đồng bộ khi cổng chuẩn trống.

Sau kiểm tra, schema thử nghiệm đã được dọn (0 schema còn lại), database ứng dụng không có phiên phân tích DEMO. Các server kiểm tra được dừng sau khi xác nhận; dịch vụ khác tại 8000/5173 được giữ nguyên.

Tác vụ thủ công tiếp theo: chạy hai script start trong hai terminal, đăng nhập và đổi mật khẩu bắt buộc; điền OPENAI_API_KEY và khởi động lại backend nếu muốn dùng phân tích OpenAI thật. Xử lý ảnh/CRUD không cần key. Kết quả AI không được dùng như kết luận giám định pháp y.
