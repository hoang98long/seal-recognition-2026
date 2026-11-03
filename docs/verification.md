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

Tác vụ thủ công tiếp theo: mở hai terminal, kích hoạt .venv rồi chạy uvicorn trong backend; chạy npm run dev trong frontend. Xem lệnh đầy đủ tại [hướng dẫn terminal](vscode.md). Đăng nhập và đổi mật khẩu bắt buộc; điền OPENAI_API_KEY và khởi động lại backend nếu muốn dùng phân tích OpenAI thật. Xử lý ảnh/CRUD không cần key.

## Chạy trực tiếp trong terminal VS Code

- Đã bỏ các launcher backend/frontend .ps1/.cmd, run_backend.py và cấu hình task/debug VS Code không còn dùng.
- Dùng .venv có sẵn tại thư mục gốc: kích hoạt trước, sau đó chạy uvicorn app.main:app trong thư mục backend với --port 8010. Frontend chạy npm run dev trong thư mục frontend; Vite đọc port/proxy từ frontend/.env.local.
- Các script khởi tạo database, thiết lập .env và hạ tầng kiểm thử được giữ lại vì còn được sử dụng; chúng không cần chạy mỗi lần khởi động ứng dụng.
- Đã chạy đúng các lệnh thủ công trong PowerShell: Activate.ps1 chọn python.exe/uvicorn.exe trong .venv; uvicorn --reload khởi động backend 8010; npm run dev khởi động frontend 5180. Health backend, trang frontend và health qua proxy đều trả HTTP 200. Các server kiểm tra đã được dừng sau xác nhận.

## Mục demo văn bản & ảnh dấu · 03/11/2026

- Thêm trang `/demo/document-stamp`, mục sidebar và nút vào từ Tổng quan. Tải PDF/ảnh văn bản cùng ảnh dấu tham chiếu, chọn trang/ROI, xem trước và lưu Q/K ngay tại trang; xác nhận chia sẻ, gọi provider OpenAI hiện có và hiển thị kết quả/báo cáo tại chỗ.
- Tận dụng API upload/documents/preprocessing/analyses hiện có; phiên gắn source_document_id, từng lần gọi lưu snapshot Q/K và kết quả riêng. Không cần migration mới hoặc thay đổi cách chạy uvicorn/npm run dev.
- Build TypeScript/Vite đạt. Toàn bộ E2E Chrome **4 passed**, gồm 3 kiểm thử mới: PDF hai trang + ảnh dấu đến kết quả/report/rerun, thiếu key không gửi dữ liệu, lỗi upstream không sinh điểm và retry cùng phiên sau xác nhận lại. Luồng nghiệp vụ cũ cũng qua kiểm thử sau khi thêm mục mới.
- Kiểm thử sử dụng PostgreSQL/schema riêng và HTTP mock của official OpenAI SDK, không gọi API trả phí, không sửa dữ liệu hoặc key của ứng dụng thường. Kết quả kiểm thử ghi rõ DEMO. Chưa xác minh mục demo mới bằng một lần gọi OpenAI thật có tính phí.
- Đã xem giao diện kết quả ở 1366×768, kiểm tra tablet 820px không tràn ngang. Ruff cho script test và git diff --check đạt; các cảnh báo PURE annotation của dependency Zod vẫn như trước, không làm hỏng build.
- Hướng dẫn thao tác: [Demo văn bản & ảnh dấu](demo_document_stamp.md). Khi backend/frontend đang chạy, mở http://localhost:5180/demo/document-stamp. Key/model lấy từ backend/.env; nếu vừa thay đổi cấu hình, khởi động lại backend và đọc lại trạng thái trên trang.

## Cải tiến giao diện và nhập dấu tổ chức — 03/11/2026

- Tăng chữ nền từ 14px lên 16px, tăng nhãn/nút/bảng và chú thích, dùng rem. Sidebar rộng hơn và cuộn được khi màn hình thấp.
- Bỏ tên Demo khỏi giao diện so khớp, dùng `/compare/document-stamp`; đường dẫn cũ chuyển tiếp. Các nút bắt đầu ở Tổng quan ưu tiên luồng văn bản/ảnh dấu.
- Thêm `/seal-library/add`: chọn/tạo tổ chức, tải ảnh/PDF, gợi ý vùng dấu, xác nhận và lưu mẫu/ảnh trong một màn hình. Có thể thêm ảnh vào mẫu đã có; thanh lưu thuận tiện khi cuộn. Ảnh mới có trạng thái reference_only, chưa xác thực.
- `POST /reference-intake` kiểm tra quyền ảnh, ROI, tổ chức hoạt động và mẫu thuộc đúng tổ chức. Tổ chức/mẫu/ảnh cùng giao dịch; kiểm thử lỗi sau flush xác nhận không còn tổ chức/mẫu mới dang dở. Không cần migration.
- So khớp cho phép tìm/chọn dấu thư viện. `GET /preprocessing/by-output/{asset_id}` kiểm tra quyền trước khi trả ảnh/run để dùng lại bản đã chuẩn bị. Chọn nguyên ảnh thư viện giữ reference_impression_id. Thông số nâng cao thu gọn; nút xác nhận vùng đồng thời lưu ảnh. Xác nhận chia sẻ OpenAI và xác nhận toàn ảnh vẫn riêng biệt.
- Backend: **50 pytest đạt**, gồm các kiểm tra mới cho quyền truy cập, tái sử dụng mẫu, liên kết tổ chức và rollback. Ruff trên các file backend thay đổi đạt.
- Frontend: TypeScript/Vite build đạt; **5 Playwright đạt (42.3s)**. Bao gồm upload trực tiếp, PDF nhiều trang, chạy lại, thiếu key, lỗi upstream, tổ chức mới → thư viện → so khớp và luồng quản lý/xử lý/chú thích/báo cáo cũ.
- Đã xem ảnh giao diện thêm dấu ở desktop 1366px và kết quả trên điện thoại 390px; kiểm tra tablet 820px và điện thoại không tràn ngang.
- E2E dùng schema riêng và SDK OpenAI mock, không dùng key thật hoặc API trả phí. Sau khi hoàn tất còn **0 schema E2E**. Các server kiểm thử đã dừng; không thay đổi dữ liệu/key của ứng dụng thường.
- Hướng dẫn hiện tại: [So khớp văn bản và nhập con dấu tổ chức](demo_document_stamp.md).
