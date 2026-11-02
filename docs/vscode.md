# Chạy trực tiếp trong terminal VS Code

Mở **File → Open Folder…**, chọn `D:\01_viettree_code\seal-recognition-2026`. Chọn **Terminal → New Terminal** để mở terminal thứ nhất, bấm dấu **+** để tạo terminal thứ hai. Giữ cả hai terminal mở khi dùng ứng dụng.

Không dùng launcher hoặc task VS Code. Backend chạy bằng uvicorn trong môi trường .venv; frontend chạy bằng npm run dev.

## Terminal 1 — backend (PowerShell)

```powershell
Set-Location "D:\01_viettree_code\seal-recognition-2026\backend"
..\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

`.venv` nằm tại thư mục gốc dự án, ngang hàng với backend/frontend. Sau khi kích hoạt, dấu nhắc thường có `(.venv)`. Lệnh uvicorn dùng đúng thư viện Python trong môi trường này.

Đợi thông báo `Application startup complete`. API docs: **http://localhost:8010/docs**. Backend đọc cấu hình DB/OpenAI từ `backend/.env`.

## Terminal 2 — frontend (PowerShell)

```powershell
Set-Location "D:\01_viettree_code\seal-recognition-2026\frontend"
npm run dev
```

Không cần kích hoạt .venv ở terminal frontend. Vite đọc cổng/proxy từ `frontend/.env.local`. Đợi thông báo `Local`, sau đó mở **http://localhost:5180**.

Đăng nhập **admin / admin** nếu chưa đổi mật khẩu development, sau đó đổi mật khẩu bắt buộc. Dừng server bằng **Ctrl+C** trong từng terminal. Sau khi dừng backend, dùng `deactivate` nếu muốn thoát .venv.

## Khi PowerShell chặn Activate.ps1 hoặc npm.ps1

Nếu gặp lỗi `running scripts is disabled` hoặc `cannot be loaded`, chạy lệnh sau **trong chính terminal đang báo lỗi**, rồi thử lại bước kích hoạt/npm:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Lệnh chỉ áp dụng cho terminal hiện tại, hết hiệu lực khi đóng terminal. Không cần thay policy toàn máy. Mỗi terminal có phạm vi riêng; chỉ thực hiện khi terminal đó bị chặn.

Nếu muốn dùng **Command Prompt** thay PowerShell: ở menu mũi tên cạnh dấu **+** chọn **Command Prompt**, rồi chạy:

```bat
cd /d D:\01_viettree_code\seal-recognition-2026\backend
..\.venv\Scripts\activate.bat
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

Terminal Command Prompt thứ hai:

```bat
cd /d D:\01_viettree_code\seal-recognition-2026\frontend
npm run dev
```

## Thiết lập lần đầu — chỉ khi thiếu dependency hoặc DB

Máy hiện tại đã có .venv, node_modules và database. Không cần cài lại mỗi lần chạy. Nếu lấy source trên máy mới:

```powershell
Set-Location "D:\01_viettree_code\seal-recognition-2026"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".\backend[dev]" -c .\backend\requirements.lock.txt
python .\scripts\setup_env.py
# Điền kết nối PostgreSQL trong backend/.env trước khi chạy phần dưới.
Set-Location backend
python -m app.init_db
alembic upgrade head
python -m app.seed
```

Seed admin/admin chỉ cho development, không ghi đè mật khẩu admin đã đổi. Thiết lập frontend trong terminal khác:

```powershell
Set-Location "D:\01_viettree_code\seal-recognition-2026\frontend"
npm install
npm run dev
```

File .env.example mặc định dùng 8000/5173; trên máy mới dùng các cổng đó hoặc đồng bộ theo bảng dưới để dùng 8010/5180.

## Cổng và cấu hình hiện tại

| Thiết lập | Giá trị |
| --- | --- |
| Cổng trong lệnh `uvicorn --port` | `8010` |
| `backend/.env`: `API_PORT` (giá trị tham chiếu của ứng dụng) | `8010` |
| `backend/.env`: `FRONTEND_ORIGIN` | `http://localhost:5180` |
| `frontend/.env.local`: `SEAL_FRONTEND_PORT` | `5180` |
| `frontend/.env.local`: `SEAL_API_TARGET` | `http://127.0.0.1:8010` |

Uvicorn CLI **không tự đọc API_PORT** từ .env của ứng dụng; luôn dùng `--port 8010` như lệnh ở trên. Nếu đổi cổng, cập nhật lệnh uvicorn và origin/proxy tương ứng, rồi dừng/chạy lại hai server. Dùng **localhost** khi mở giao diện để cookie và origin nhất quán.

## Các file hỗ trợ còn giữ

- `scripts/init_db.ps1`, `scripts/init_db.sh`: khởi tạo DB/migration/seed nếu muốn dùng công cụ tiện ích.
- `scripts/setup_env.py`: tạo .env mẫu và khóa phiên ngẫu nhiên, không ghi đè file đã có.
- `scripts/e2e_backend.py`, `scripts/cleanup_e2e.py`: được Playwright sử dụng để chạy/dọn môi trường kiểm thử riêng.

Không cần các file này để khởi động ứng dụng hằng ngày. Các launcher và cấu hình VS Code tự chạy đã được xóa.

Nếu báo thiếu uvicorn, kiểm tra đã kích hoạt đúng .venv bằng `python -c "import sys; print(sys.executable)"`; đường dẫn phải nằm trong `.venv\Scripts\python.exe`. Nếu thiếu npm, kiểm tra Node.js và mở lại VS Code sau khi cài. Nếu cổng đã được sử dụng, kiểm tra terminal cũ trước khi chạy thêm server.
