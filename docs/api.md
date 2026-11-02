# API V1

Base URL `/api/v1`. OpenAPI động tại `/docs`, JSON tại `/openapi.json`. Request schemas trong `backend/app/schemas`, types frontend trong `frontend/src/types`. UUID là string, datetime ISO8601 UTC, date YYYY-MM-DD, score JSON number hoặc null. Không trả BLOB/path disk/key/password hash.

Auth cookie `seal_session` HttpOnly, CSRF cookie `seal_csrf` có thể đọc. Login trả `{user,csrf_token}`. Mutation sau login gửi `X-CSRF-Token: <csrf_token>`; GET không cần CSRF. Origin nếu có phải đúng FRONTEND_ORIGIN. Tài khoản must_change_password chỉ được me/logout/change-password. Roles: R = người dùng đã đăng nhập, W = admin/analyst, A = admin. File/phiên còn kiểm tra ownership; admin được xem toàn bộ, active reference được chia sẻ trong nội bộ.

Response lỗi thống nhất:

```json
{"error":{"code":"openai_not_configured","message":"Chưa cấu hình OPENAI_API_KEY trong backend/.env. Vẫn có thể xử lý ảnh nội bộ."}}
```

401 chưa đăng nhập/sai credential; 403 CSRF/role/owner/bắt đổi mật khẩu; 404 không tồn tại; 409 unique/concurrent running; 422 invalid input/ROI/consent; 429 limiter/upstream quota; 502 upstream/refusal/parse; 503 DB/key; 504 timeout. Không trả nguyên upstream error hoặc echo body mật khẩu.

## Danh sách endpoint

`{id}`/`{ident}` đều là UUID. List phân trang trả `{items,total,page,page_size}`. Query chung cho CRUD thư viện: `q`, `page>=1`, `page_size=1..100`, `status=active|inactive|all`, `sort=newest|oldest`, organization_id/seal_design_id khi phù hợp. `PATCH` chỉ gửi trường cần sửa; required field không được đặt null. DELETE soft-delete.

| Method / path | Quyền | Request / response |
| --- | --- | --- |
| GET /health | Public | `{status,version,database,storage}`, 503 khi DB/schema/storage chưa sẵn sàng, không gọi OpenAI. |
| POST /auth/login | Public | `{username,password,remember?}` → `{user,csrf_token}`, cookie. |
| GET /auth/me | R | User không có password hash. |
| POST /auth/logout | R | `{}` → message, xóa phiên và cookie. |
| POST /auth/change-password | R | `{old_password,new_password}` → user/CSRF mới, thu hồi mọi phiên cũ. |
| GET /users | A | Mảng user. |
| POST /users | A | `{username,full_name,password,role}` → user, 201; phải đổi mật khẩu lần đầu. |
| PATCH /users/{id} | A | `{full_name?,role?,is_active?}`; thu hồi phiên, chặn tự khóa admin hiện tại. |
| GET /dashboard/summary | R | documents/designs/impressions/organizations/analyses, recent[], activity[{date,count}]; số thật theo quyền. |
| GET /organizations | R | Page Organization. |
| POST /organizations | W | OrganizationIn → Organization, 201. |
| GET/PATCH/DELETE /organizations/{id} | R/W/W | Chi tiết/cập nhật/lưu trữ. |
| GET /seal-designs | R | Page Design. |
| POST /seal-designs | W | DesignIn → Design, 201. |
| GET/PATCH/DELETE /seal-designs/{id} | R/W/W | Chi tiết/cập nhật/lưu trữ. |
| GET /seal-designs/{id}/usage | R | Mảng Result của phiên người dùng được phép đọc. |
| GET /seal-devices | R | Page Device. |
| POST /seal-devices | W | DeviceIn → Device, 201. |
| GET/PATCH/DELETE /seal-devices/{id} | R/W/W | Chi tiết/cập nhật/lưu trữ. |
| GET /seal-impressions | R | Page Impression + design_name/organization_name; private chỉ owner/admin. |
| POST /seal-impressions | W | ImpressionIn, suy organization từ design, kiểm tra device cùng design → Impression, 201. |
| GET/PATCH/DELETE /seal-impressions/{id} | R/W/W | Chi tiết/cập nhật/lưu trữ; kiểm tra private. |
| POST /assets/upload | W | multipart file, query kind=document/original_stamp → Asset, 201. |
| GET /assets | R | Page Asset của chính người dùng, filter kind. |
| GET /assets/{id} | R | Asset metadata, ownership/reference check. |
| GET /assets/{id}/download | R | Attachment bytes, MIME xác thực, no-store. |
| GET /assets/{id}/preview | R | PNG; query page (1-based), full=false; cạnh mặc định 1600, header X-Image-Width/Height là kích thước nguồn. |
| GET /documents | R | Page Document, q/page/page_size; chỉ owner hoặc admin. |
| POST /documents | W | `{file_asset_id,display_name,document_no?,description?,tags?}` → Document, 201; cùng file trả bản hiện có. |
| GET /documents/{id} | R | Document + asset metadata. |
| GET /documents/{id}/pages/{page}/preview | R | PNG của đúng trang/khung, không trộn trang. |
| GET /preprocessing/profiles | R | Mảng Profile của user hoặc profile chung. |
| POST /preprocessing/profiles | W | `{name,parameters,is_default?}` → Profile, 201. |
| GET /preprocessing/suggest-roi/{asset_id}?page=1 | R | `{roi:null|{x,y,width,height},width,height,message}` theo ảnh nguồn. |
| POST /preprocessing/preview | W | PreprocessIn → PNG preview cạnh 1200, không tạo variant. |
| POST /preprocessing/apply | W | PreprocessIn với roi_confirmed=true → `{run,asset}`, 201. |
| GET /preprocessing/runs/{id} | R | Run, quyền theo output asset. |
| POST /analyses | W | AnalysisIn → Session, 201. Q/K phải processed ROI confirmed. |
| GET /analyses | R | Page Session; q/status/model/design_code/created_by/date_from/date_to/page/page_size; scope theo owner. |
| GET /analyses/{id} | R | Session + candidates đang selected. |
| POST /analyses/{id}/compare-openai | W | `{consent,query_asset_id?,candidates?}` → `{id,status,calls}`; đồng bộ chờ OpenAI, append-only Result. |
| GET /analyses/{id}/results | R | Mảng Result mới nhất trước, kèm annotations[], input_metadata snapshot. |
| POST /analysis-results/{id}/annotations | W | `{label,image_role,geometry,note?}` → Annotation source=user, 201. |
| DELETE /annotations/{id} | W | Tác giả/admin, xóa vùng thủ công + audit. |
| GET /reports | R | Mảng tối đa 100 Session có result, theo quyền. |
| GET /reports/{analysis_id} | R | HTML tự chứa ảnh, escape text, print CSS, CSP sandbox. |
| GET /reports/{analysis_id}/export?download=true | R | HTML attachment; Ctrl+P để in/lưu PDF. |
| GET /settings/openai/status | R | Configured boolean, model, max_candidates/timeout/image limits/pipeline version; không có key. |
| POST /settings/openai/test | A | `{}` → message/model/request_id/usage của một request văn bản tối thiểu; 3 lần/phút. |
| GET /audit-logs | A | 100 audit entries gần nhất, không secret. |

## Schemas nghiệp vụ

- OrganizationIn: name required; code/short_name/parent_organization_id/description/address optional; status=active.
- DesignIn: organization_id/name required; design_code, seal_type=round|rectangular|other, description, issued_at, valid_from/to, status, reference_notes.
- DeviceIn: seal_design_id required; internal_device_code/inventory_note/active_from/to/provenance_note nullable, source_confidence=unknown|documented|verified, status.
- ImpressionIn: seal_design_id/image_asset_id required; seal_device_id nullable; source_document_id/source_page; is_reference=true; capture_method=unknown|scan|photo|uploaded|digital; image_quality_note/observed_color/note; verification_status=reference_only|unverified|verified; status.
- Profile: id/owner/name/is_default/parameters/version/created_at/updated_at.
- Asset: id/kind/original_filename/media_type/file_size/sha256/width/height/page_count/uploaded_by/created_at/source_metadata. Path ẩn. Source metadata của processed có source_asset_id/source_page/roi_confirmed/roi/pipeline_version.
- Run: id/source_asset_id/output_asset_id/profile_id/source_page/roi_geometry/parameters/pipeline_version/initiated_by/created_at.
- Session: id/title/mode/source_document_id/query_asset_id/created_by/status/consent_at/consent_provider/completed_at/processing_notes/timestamps.
- Candidate: reference_asset_id required, reference_impression_id optional; server thêm id/session/order/selection_method/is_selected.
- Result: id/session_id/candidate_id/provider/model_name/provider_version/prompt_version/result_status/visual_similarity_score/verdict/confidence_label/structured_result/narrative/quality_flags/request_id_provider/token_usage/estimated_cost_usd/error_code/error_summary/started_at/completed_at/duration_ms/is_uncalibrated=true/input_metadata/created_at. estimated_cost_usd null khi chưa có bảng giá; không có probability_same_device.

## Ví dụ tiền xử lý

```json
{
  "source_asset_id":"UUID",
  "page":1,
  "roi":{"x":30,"y":40,"width":300,"height":300},
  "roi_confirmed":true,
  "allow_full_page":false,
  "parameters":{
    "rotation":0,"brightness":0,"contrast":1,"gamma":1,"saturation":1,
    "sharpen":0,"denoise":0,"grayscale":false,
    "threshold_mode":"off","threshold_value":127,
    "red_mask":true,"hue_width":15,"saturation_min":60,"value_min":40,
    "morphology":"none","kernel_size":3,"invert":false,
    "background":"white","apply_mask":true
  }
}
```

Bounds: rotation -180..180, brightness -100..100, contrast/gamma .1..3, saturation/sharpen 0..3, denoise 0..10, H width 0..45 (wrap cả 0/179), S/V 0..255, kernel 1..9. Threshold off/otsu/adaptive/manual; morphology none/open/close; background none/white/transparent/overlay. Red mask ưu tiên hơn grayscale/threshold; UI khóa thao tác không có ý nghĩa. Mask tính trước morphology; giữ màu trong mask khi loại nền. Overlay chỉ ảnh preview, ảnh lưu theo apply_mask. Pixel nguồn được crop trước xoay.

## Ví dụ tạo/phân tích phiên

```json
{"title":"Đối chiếu DEMO","mode":"pairwise","query_asset_id":"Q_UUID","candidates":[{"reference_asset_id":"K_UUID"}]}
```

```json
{"consent":true}
```

Rerun có thể gửi Q/candidates mới để tạo phiên bản kết quả mới. Mỗi ứng viên là một call, giới hạn theo .env. Cùng ảnh K không được trùng, pairwise khi tạo cần đúng một K. Lỗi candidate sau không xóa result candidate trước.

Structured_result tuân thủ `SealVisualComparison`: status success/insufficient_data; verdict visually_similar/partially_similar/visually_different/insufficient_evidence; score number|null; visual_confidence_label low/medium/high; same_design_plausible bool|null; summary_vi; observations_q/k, text_recognition_q/k, limitations là string arrays; matching/differing/uncertain_features là EvidenceItem arrays; recommendation_vi. EvidenceItem gồm category outer_ring/inner_ring/text/symbol/layout/color/local_detail/other, description, strength weak/moderate/strong/uncertain, region_description **bằng lời**. Không có bounding box AI.

Annotation geometry `{x,y,width,height}` chuẩn hóa [0,1] theo ảnh Q hoặc K của **result đó**, x+width/y+height <=1. Label similar/different/uncertain/user_note. Source chỉ user, không được client gửi algorithm. Người dùng không sửa structured_result.
