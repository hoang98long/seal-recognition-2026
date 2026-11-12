# Hệ thống giám định con dấu · MVP V1

Ứng dụng nội bộ **FastAPI + PostgreSQL + React/TypeScript**, giao diện tiếng Việt. Tải PDF/ảnh, chọn ROI thủ công, tiền xử lý có thể tái lập, quản lý thư viện tham chiếu và so sánh hai ROI qua OpenAI Vision. Bản gốc giữ nguyên; ảnh lưu disk, metadata và lịch sử lưu PostgreSQL.

**Không phải kết luận giám định pháp y.** Điểm 0–100 chưa hiệu chuẩn, không phải xác suất cùng dụng cụ hay chứng minh văn bản thật/giả. Có thể trả “KHÔNG ĐỦ CƠ SỞ KẾT LUẬN”, điểm `null`. Không suy đoán tổ chức khi không có mẫu phù hợp.

## Chạy trên máy hiện tại

`.venv`, thư viện npm, database `seal_forensics`, migration và seed development đã được thiết lập. `backend/.env` chứa cấu hình local riêng. Xem [kết quả kiểm tra](docs/verification.md).

Mở thư mục dự án trong VS Code, chọn **Terminal → New Terminal** và chạy trực tiếp trong hai terminal PowerShell riêng. Xem [hướng dẫn terminal VS Code](docs/vscode.md).

```powershell
# Terminal 1 — backend
Set-Location "D:\01_viettree_code\seal-recognition-2026\backend"
..\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

```powershell
# Terminal 2 — frontend
Set-Location "D:\01_viettree_code\seal-recognition-2026\frontend"
npm run dev
```

Trên máy này, cấu hình local dùng **http://localhost:5180**, backend **http://localhost:8010**, OpenAPI **http://localhost:8010/docs** để tránh xung đột với cổng 8000/5173 của ứng dụng khác. Đăng nhập **admin / admin** nếu chưa đổi mật khẩu development, sau đó đổi mật khẩu bắt buộc. Giữ cả hai terminal mở; dừng bằng **Ctrl+C** trong từng terminal.

Nếu PowerShell báo `Activate.ps1` hoặc `npm.ps1` bị chặn, chạy `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` trong chính terminal đó rồi thử lại. Cấu hình chỉ có hiệu lực trong phiên terminal hiện tại. Hoặc chọn terminal **Command Prompt** và làm theo [hướng dẫn](docs/vscode.md).

Muốn trở về cổng chuẩn khi đã trống: đổi lệnh uvicorn thành `--port 8000`, đặt API_PORT=8000 và FRONTEND_ORIGIN=http://localhost:5173 trong backend/.env, đồng thời SEAL_API_TARGET=http://127.0.0.1:8000 và SEAL_FRONTEND_PORT=5173 trong frontend/.env.local. Uvicorn CLI dùng `--port`, không tự đọc biến API_PORT của ứng dụng. File mẫu giữ các cổng mặc định 8000/5173.

Để dùng OpenAI thật: điền `OPENAI_API_KEY` trong `backend/.env`, đặt `OPENAI_MODEL` đúng ID model mà key được phép dùng rồi khởi động lại backend. Cấu hình mẫu dùng `gpt-4.1`; cấu hình local đã kiểm tra ngày 10/11/2026 dùng `gpt-6.1-sol` (ID `gpt-6.1` không hợp lệ với key hiện tại). Cài đặt → Kết nối so khớp → Kiểm tra kết nối xác thực key và ID model bằng API thông tin model, không sinh nội dung. Kiểm tra này chưa xác nhận khả năng xử lý ảnh hoặc hạn mức; tiếp đó chạy một cặp ảnh được phép chia sẻ để kiểm tra Vision, có tính phí API. Đã kiểm tra thành công luồng Vision + Structured Outputs thật bằng hai ảnh tự tạo, không gửi tài liệu người dùng. Không tự thay thế bằng kết quả giả.

## Thiết lập từ đầu trên Windows

Yêu cầu Python 3.11+ (đã kiểm tra với 3.13), Node.js LTS và PostgreSQL tại `localhost:5432`. Không cần Poppler, Redis hoặc PostgreSQL container. PowerShell tại thư mục dự án:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".\backend[dev]" -c .\backend\requirements.lock.txt
.\.venv\Scripts\python.exe .\scripts\setup_env.py
notepad .\backend\.env
```

Điền `DATABASE_URL=postgresql+psycopg://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/seal_forensics` với mật khẩu riêng (URL-encode ký tự đặc biệt). Script tạo khóa phiên ngẫu nhiên, không ghi đè `.env` đã có. Không đưa `.env` vào Git. Thiếu khóa OpenAI vẫn dùng upload, CRUD và xử lý ảnh.

```powershell
$env:PYTHONUTF8 = "1"
.\scripts\init_db.ps1
```

Script chỉ tạo database nếu chưa có, không reset/xóa DB. Nếu thiếu quyền, dùng pgAdmin kết nối database `postgres` rồi chạy `CREATE DATABASE seal_forensics;`, hoặc:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE seal_forensics;"
```

Các lệnh riêng sau khi tạo DB:

```powershell
Set-Location backend
..\.venv\Scripts\Activate.ps1
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Terminal thứ hai:

```powershell
Set-Location frontend
npm install
npm run dev
```

Dùng **localhost** ở trình duyệt để nhất quán FRONTEND_ORIGIN và cookie; không trộn với 127.0.0.1. Vite chuyển tiếp `/api` sang backend. Với môi trường mới dùng file .env.example mặc định, chọn uvicorn `--port 8000` và giao diện `http://localhost:5173`; với cấu hình local hiện tại dùng 8010/5180 như trên.

## Quy trình sử dụng

**Luồng theo tổ chức:** mở **Tổ chức & thư viện dấu** tại `/organizations` → chọn/tạo đơn vị → tải nhiều tài liệu, khoanh và lưu dấu → mở **Tra cứu Top 3 tổ chức** tại `/compare/library` để so Q với toàn bộ ảnh tham chiếu hợp lệ qua OpenAI API. Điểm tổ chức lấy mức cao nhất trong các mẫu đã so; màu xanh >90%, vàng 70–90%, đỏ <70%. Xem [hướng dẫn đầy đủ và đồng bộ CSDL local](docs/organization_workflow.md).

PDF đã hỗ trợ lớp chú thích/biểu mẫu chứa dấu điện tử; có thể kéo chuột vẽ vùng ngay cả khi chưa bấm gợi ý. Ảnh đã xử lý có tên theo nguồn/trang/đơn vị và được đổi tên. Preview K xuất hiện ngay tại bước chọn K. Cấu hình xử lý được quản lý theo tổ chức.

**So khớp văn bản & ảnh dấu:** vào mục **Văn bản & ảnh dấu** tại `/compare/document-stamp`. Tải văn bản, tải ảnh dấu hoặc chọn dấu đã lưu theo tổ chức, kiểm tra vùng dấu được gợi ý rồi bấm **So khớp con dấu**. Kết quả và báo cáo hiện ngay trong cùng luồng. Đường dẫn `/demo/document-stamp` cũ tự chuyển sang trang mới. Xem [hướng dẫn so khớp](docs/demo_document_stamp.md).

Giao diện so khớp và báo cáo dùng cách gọi trung tính; kết quả gồm điểm %, mức tương đồng, ảnh Q/K, thời gian và Top 3 khi tra cứu thư viện. Bản giải thích gồm một câu kết luận, tối đa ba căn cứ quan sát và một lưu ý. Các diễn giải dài/OCR và thông tin nhà cung cấp/model/prompt/token không được trình bày. Backend vẫn dùng API hiện có, giữ phản hồi đầy đủ trong CSDL và bắt đầu xử lý khi người dùng bấm So khớp hoặc Tra cứu; chưa triển khai thuật toán matching mới. Xem [thiết kế giải thích ngắn](docs/concise_explanations.md).


**Nhập con dấu tổ chức:** chọn **Thêm con dấu tổ chức** tại Tổng quan, Thư viện hoặc ngay trên dòng tổ chức. Trang `/seal-library/add` cho phép chọn/tạo tổ chức, tải ảnh/PDF, xác nhận vùng dấu và lưu mẫu cùng ảnh trong một lần. Sau khi lưu, có thể so khớp ngay hoặc thêm ảnh khác cho cùng mẫu. Không cần tạo dụng cụ đóng dấu.

1. Đăng nhập và đổi mật khẩu bắt buộc. Dashboard hiển thị số liệu DB thật, không seed phiên phân tích giả.
2. Tài liệu nguồn → tải PDF/PNG/JPG/TIFF/WEBP. Chọn từng trang/khung, giới hạn mặc định 25 MB, 100 trang, 40 triệu pixel/trang.
3. Xưởng xử lý → chọn nguồn/trang. Kéo ROI, kéo góc resize hoặc nhập X/Y/Rộng/Cao theo **pixel nguồn trước khi xoay**. Kiểm tra gợi ý vùng mực đỏ bằng mắt.
4. Điều chỉnh góc xoay, sáng/tương phản/gamma, bão hòa, khử nhiễu, nét, HSV, ngưỡng, hình thái, đảo màu, nền. Preview tính bằng backend. Lưu/copy hồ sơ thông số cho Q/K; ROI chọn riêng từng ảnh.
5. Xác nhận ROI → Áp dụng và lưu. Tải PNG hoặc chọn làm Q/K. Chỉnh tiếp cần lưu phiên bản mới trước khi chọn.
6. Thư viện → **Thêm con dấu tổ chức**. Chọn tổ chức có sẵn hoặc nhập tên mới, tải ảnh và xác nhận vùng dấu. Mẫu mới được lưu cùng ảnh; cũng có thể thêm ảnh vào mẫu có sẵn. Các tab mẫu thiết kế/dụng cụ dành cho quản lý chi tiết khi cần.
7. So khớp → chọn Q/K tải lên hoặc tối đa 5 K thư viện. Kiểm tra ảnh và bấm **So khớp con dấu**. Luồng nâng cao gồm 4 bước; không còn bước xác nhận riêng.
8. Xem dấu hiệu giống/khác/chưa rõ, hạn chế, model/usage. Zoom, hoán đổi hiển thị, chồng ảnh cùng kích thước (chưa căn chỉnh hình học). Khoanh vùng người dùng được lưu riêng với nguồn user.
9. So sánh lại tạo kết quả mới cùng phiên; giữ nguyên ID ảnh, SHA256 và thông số của kết quả cũ. Xuất HTML tự chứa ảnh; **Ctrl+P → Lưu dưới dạng PDF** trong trình duyệt.

“Lớp phủ mặt nạ” chỉ tô preview, không lưu màu xanh vào ảnh mực. Làm nét không phục hồi chứng cứ gốc. Preview hiển thị cạnh tối đa 1200px, PNG lưu theo ROI đầy đủ. Nếu dùng toàn ảnh/trang thay vì crop, tích **Chọn toàn ảnh/trang** ở bước chuẩn bị.

## Kiến trúc

```text
backend/app/api/v1/    HTTP, auth, RBAC, CSRF
backend/app/services/  lưu tệp, PDF, tiền xử lý, orchestration, báo cáo
backend/app/matching/  MatchingProvider, OpenAI, skeleton V2/V3
backend/app/db/        SQLAlchemy models, repositories, session
backend/alembic/       migration PostgreSQL upgrade/downgrade
backend/tests/         PostgreSQL + ảnh DEMO + SDK qua HTTP mock
frontend/src/          layout, UI, canvas và các trang nghiệp vụ
scripts/               công cụ khởi tạo và hạ tầng E2E (không cần để chạy hằng ngày)
docker/                Dockerfile, reverse proxy tùy chọn
data/                  uploads/, processed/, reports/ (gitignored)
```

Tài liệu: [kiến trúc](docs/architecture.md), [DB](docs/database.md), [API](docs/api.md), [bảo mật/giới hạn](docs/security_and_limitations.md), [roadmap](docs/roadmap.md).

```mermaid
erDiagram
  users ||--o{ file_assets : uploads
  organizations ||--o{ seal_designs : owns
  seal_designs ||--o{ seal_devices : instantiates
  seal_designs ||--o{ seal_impressions : references
  seal_devices o|--o{ seal_impressions : documented_source
  file_assets ||--o| source_documents : source
  file_assets ||--o{ preprocessing_runs : input_output
  preprocessing_profiles o|--o{ preprocessing_runs : parameters
  file_assets ||--o{ seal_impressions : image
  analysis_sessions ||--|{ analysis_candidates : compares
  analysis_sessions ||--o{ analysis_results : versions
  analysis_candidates ||--o{ analysis_results : reference
  analysis_results ||--o{ annotation_regions : manual_regions
  users ||--o{ audit_logs : acts
```

## Kiểm thử

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\ruff.exe check app tests
..\.venv\Scripts\alembic.exe check
Set-Location ..\frontend
npm.cmd run build
npm.cmd run test:e2e
```

Pytest tạo **schema ngẫu nhiên riêng**, chạy Alembic/seed thật và dọn đúng schema đó; không truncate bảng ứng dụng. Cần quyền CREATE SCHEMA. Ảnh DEMO sinh trong test. OpenAI mock ở HTTP transport của **official SDK**, không tốn phí API.

Playwright dùng backend/DB/storage riêng và cổng 18081/15174, không đổi mật khẩu admin thật. Dùng Chrome Windows có sẵn; máy khác có thể cần `npm.cmd exec -- playwright install chromium`. Kết quả test ghi **DEMO — không phải AI thật**. Mock không được nạp ở ứng dụng thường.

## Docker tùy chọn

Compose chỉ có backend/frontend, không tạo PostgreSQL và không chiếm 5432. DB trên host Windows dùng **host.docker.internal**; backend chạy trực tiếp dùng **localhost**:

```powershell
$env:DOCKER_DATABASE_URL = "postgresql+psycopg://postgres:YOUR_LOCAL_PASSWORD@host.docker.internal:5432/seal_forensics"
docker compose build
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.seed
docker compose up
```

Các cổng bind 127.0.0.1. Storage gắn `./data`. Không seed production; provision admin mạnh riêng trước chuyển production.

## Xử lý sự cố

| Hiện tượng | Xử lý |
| --- | --- |
| DB connection refused | Kiểm tra PostgreSQL service, localhost:5432; Docker dùng host.docker.internal. |
| Database does not exist | Kết nối DB postgres, tạo seal_forensics rồi chạy migration. |
| Sai thông tin DB | Sửa DATABASE_URL, URL-encode mật khẩu, restart backend. |
| OpenAI invalid key / 401 | Điền OPENAI_API_KEY ở backend/.env; không nhập ở frontend. |
| Model not found / thiếu quyền | Đổi OPENAI_MODEL thành model hỗ trợ Vision + Structured Outputs mà tài khoản có quyền; restart. |
| 429 | Kiểm tra hạn mức/billing API hoặc đợi. Không tự sinh điểm thay thế. |
| Timeout / mạng | Kiểm tra proxy/firewall, timeout cấu hình; chạy lại thủ công. Kết quả lỗi vẫn lưu. |
| PDF / mã hóa / codec | Dùng PDF không mật khẩu, kiểm tra tệp; pypdfium2 có wheel Windows, không cần Poppler. |
| CORS / cookie / CSRF | Dùng http://localhost:5173, kiểm tra FRONTEND_ORIGIN, cho cookie và đăng nhập lại. |
| 403 đổi mật khẩu / quyền | Đổi mật khẩu lần đầu; viewer không được mutation. |
| Migration conflict | `alembic current`, `alembic heads`, `alembic check`; sao lưu trước sửa, không stamp head để che lỗi. |
| Thiếu tệp disk | Khôi phục DB và data từ cùng backup; DB không chứa BLOB. |
| Cổng đã dùng | Dừng đúng tiến trình của bạn hoặc đổi port/FRONTEND_ORIGIN/proxy đồng bộ. |
| Unicode PowerShell | `$env:PYTHONUTF8="1"`; scripts khởi động đã đặt sẵn. |

Gói ChatGPT và quyền/billing API được quản lý riêng; ứng dụng dùng **OpenAI API**. Không suy ra quyền model từ gói chat. Tham khảo [hướng dẫn API chính thức](https://developers.openai.com/api/docs/quickstart).
