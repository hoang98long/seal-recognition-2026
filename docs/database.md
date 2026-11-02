# PostgreSQL và migration

Database seal_forensics. Migration 4884d09442b4 tạo 15 bảng (14 nghiệp vụ + auth_sessions), UUID PK, TIMESTAMPTZ, JSONB, FK, unique/index và score constraint 0–100. Không create_all khi startup. UTC ở DB, UI theo giờ trình duyệt, báo cáo ghi rõ UTC.

| Bảng | Trách nhiệm |
| --- | --- |
| users | Username unique chuẩn hóa chữ thường, Argon2, role/active/bắt đổi mật khẩu. |
| auth_sessions | HMAC token/CSRF, thời hạn và user; không lưu token nguyên văn. |
| organizations | Mã unique nullable, parent FK, chặn chu trình qua API; soft-delete. |
| seal_designs | Mẫu thiết kế thuộc tổ chức, loại, hiệu lực, ghi chú; soft-delete. |
| seal_devices | Dụng cụ thuộc thiết kế, mã unique, chứng cứ nguồn gốc; nullable ở impression. |
| file_assets | MIME/SHA256/kích thước/path UUID/owner/metadata; không BLOB. |
| source_documents | File, tên, số văn bản, tags, số trang/khung và owner. |
| seal_impressions | Một ảnh/lần đóng, design, optional device/document, nguồn thu và xác thực. |
| preprocessing_profiles | Thông số JSONB, owner/default/version. |
| preprocessing_runs | Source/output asset, trang, ROI, thông số đầy đủ, profile, pipeline version, người thao tác. |
| analysis_sessions | Q, mode, owner/status/consent/notes. |
| analysis_candidates | K, impression tùy chọn, thứ tự, cách chọn, active cho lần chạy mới. |
| analysis_results | Append-only, model/SDK/prompt/usage, score nullable, error, thời gian, snapshot Q/K. |
| annotation_regions | Rectangle chuẩn hóa [0,1], Q/K, label/tác giả/source user. |
| audit_logs | Actor/action/entity/sanitized details; không credential/ảnh. |

ERD trong [README](../README.md#kiến-trúc). system_settings tùy chọn, V1 dùng .env và profiles. Không có khóa OpenAI trong DB.

Dedup upload gốc chỉ khi cùng user/kind/SHA256. SHA256 có index, không global unique để không đồng nhất quyền giữa người dùng và cho phép phiên bản pixel giống nhau nhưng provenance khác. Path unique. Mỗi processed variant có asset/run riêng. Upload đồng thời có thể tạo hai bản gốc giống bytes, không ảnh hưởng quyền hay provenance.

Soft-delete tổ chức/mẫu/dụng cụ/impression giữ FK cũ và lịch sử, không cascade dữ liệu giám định. Snapshot result giữ ID/SHA256/run; thay Q/K của phiên không thay result cũ. Annotation là thao tác riêng có audit.

```powershell
Set-Location backend
..\.venv\Scripts\alembic.exe upgrade head
..\.venv\Scripts\alembic.exe current
..\.venv\Scripts\alembic.exe check
..\.venv\Scripts\python.exe -m app.seed
..\.venv\Scripts\alembic.exe revision --autogenerate -m "mo ta thay doi"
```

Review migration trước áp dụng. Downgrade đầu tiên xóa schema ứng dụng, chỉ dùng DB test hoặc sau sao lưu. Backup cần cả DB và STORAGE_ROOT cùng thời điểm. Không commit dump.
