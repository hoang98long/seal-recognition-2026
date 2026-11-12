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

## Rà soát PDF, hồ sơ tổ chức và Top 3 qua API — 10/11/2026

- Migration `20261110_org_flow` đã chạy trên CSDL local; `alembic current` ở head, `alembic check` không có drift. Sao lưu trước migration: `data/backups/seal-before-org-workflow-20261110-082837.dump` (60.592 byte).
- Đã thêm bốn danh mục VPCP, TTCP, BCA, BQP và tên hiển thị cho bốn ảnh xử lý cũ. Số bản ghi nghiệp vụ trước/sau giữ nguyên: 1 user, 7 tệp/ảnh, 2 tài liệu, 0 ảnh thư viện tham chiếu, 3 kết quả. Không tự gán đơn vị cho ảnh cũ khi chưa có xác nhận; giao diện cho dùng lại ảnh đã xử lý để lưu vào đơn vị.
- PDFium khởi tạo form trước khi mở page, render cả annotations và AcroForm appearances. Kiểm tra trực tiếp hai PDF trong kho local: nguồn `e2cfe17b`, trang 1 đỏ 0 → 2.732 pixel và trang 4 đỏ 0 → 5.583; nguồn `67caeef1`, trang 1 đỏ 0 → 4.102; trang 10 vốn đúng giữ 15.693 → 15.693. Không sửa byte PDF gốc.
- Vùng SVG có nền bắt chuột, công cụ vẽ lại và xử lý khung ban đầu phủ toàn ảnh; dùng ref để giữ ROI cuối khi pointer-up, không commit khi pointer-cancel. E2E khoanh dấu đen không dùng nút gợi ý, kiểm tra ROI rộng ~240px trên ảnh 300px và preview/saved output.
- Hồ sơ tổ chức có thư viện dấu, nhiều tài liệu, cấu hình xử lý dùng chung; gắn được cấu hình cá nhân cũ vào tổ chức. E2E kiểm tra cấu hình đã gắn và áp dụng độ sáng 7 trong xưởng. Upload nhiều tệp giữ hàng đợi, hỗ trợ tách nhiều dấu cùng tài liệu và chọn lại ảnh đã xử lý.
- Preview K xuất hiện ngay bước chọn; đổi tên ảnh không đổi SHA256/byte ảnh, tên tự nhập được giữ khi thêm vào thư viện. Tên tự sinh có nguồn/trang/tổ chức/mã ngắn; ảnh cũ cũng được backfill tên hiển thị.
- Tra cứu dùng OpenAI từng cặp với toàn bộ corpus hợp lệ, không cắt ở giới hạn 5 của luồng thủ công. Xếp tối đa ba tổ chức khác nhau theo điểm cao nhất trong các mẫu đã so. Kiểm tra số cặp trước consent, tiến độ, lỗi/ranking tạm thời, retry chỉ phần lỗi/chưa chạy, quyền người dùng và trường hợp điểm null không được tự gán số.
- Prompt `seal-only-vi-v2` loại chữ ký/chức danh ngoài dấu khỏi tiêu chí khác biệt; yêu cầu đọc đủ các cung chữ và không điền chữ bị che. Hai ảnh Vision có `detail: high`, phóng nhỏ có giới hạn để đọc chữ; snapshot giữ chính sách encode ảnh. Không cam kết đọc được nét mất/che khuất, chưa chạy kiểm chứng trả phí bằng key thật.
- Màu nhất quán trong kết quả cặp, Top 3 và báo cáo: >90 xanh, 70–90 vàng, <70 đỏ, null xám. Báo cáo Top 3 ghi rõ phạm vi hoàn tất/tạm thời và cách gom điểm.
- **59 pytest đạt (20.54s)**; **6 Playwright đạt (54.5s)**; TypeScript/Vite build đạt, các chunk <500 kB; Ruff và `git diff --check` đạt. Đã xem ảnh Top 3 desktop 1366px và điện thoại 390px, kiểm tra không tràn ngang. Các cảnh báo dependency đã ghi ở phần trước vẫn không làm hỏng kiểm tra.
- Test dùng schema và bộ ảnh riêng, SDK OpenAI HTTP mock; không dùng key thật và không gọi API trả phí. Sau hoàn tất còn 0 schema E2E; server kiểm thử đã được dừng. Model/key trong `.env` local được giữ nguyên; test tự pin model để không phụ thuộc cấu hình cá nhân.
- Hướng dẫn và đề xuất tiếp theo: [Luồng tổ chức và Top 3](organization_workflow.md).

## Sửa cấu hình model với key hiện tại — 10/11/2026

- Key local xác thực thành công với OpenAI. ID `gpt-6.1` đang cấu hình không nằm trong danh sách model key được truy cập; đã đổi riêng `OPENAI_MODEL` thành `gpt-6.1-sol`. Kiểm tra tự động xác nhận key và tất cả giá trị cấu hình khác giữ nguyên. `.env` vẫn được Git bỏ qua.
- API thông tin model xác nhận `gpt-6.1-sol`. Chạy trực tiếp provider của ứng dụng với hai ảnh vòng tròn tự tạo đã hoàn tất Vision và parse/validate `SealVisualComparison`: 3.901 input token, 869 output token. Đây là yêu cầu API thật có tính phí, không gửi ảnh/tài liệu người dùng, không tạo bản ghi kết quả trong CSDL ứng dụng. Không dùng phép thử này để đánh giá độ chính xác giám định.
- Nút Kiểm tra kết nối dùng `models.retrieve`, thay yêu cầu sinh văn bản giới hạn 16 token có thể báo chưa hoàn tất trên reasoning model. Thông báo nêu rõ chỉ xác nhận key/ID model, chưa kiểm tra ảnh hoặc hạn mức; mở trang Cài đặt không tự gọi OpenAI.
- Tách thông báo thiếu quyền 403 và không tìm thấy model 404, giữ mã lỗi API tương thích và không trả chi tiết upstream/khóa ra trình duyệt. Không tự chuyển model khi phân tích lỗi.
- **64 pytest đạt (21,03 giây)**, gồm kiểm tra GET thông tin model không sinh nội dung, lỗi 401/403/404, không lộ key/chi tiết upstream và quyền admin. TypeScript/Vite build, Ruff và `git diff --check` đạt. Các cảnh báo dependency đã ghi phía trên vẫn tồn tại; kiểm thử tự động dùng HTTP mock và schema riêng.
- Sau đổi `.env`, dừng/chạy lại backend để bỏ cấu hình cache. Kết quả lỗi lịch sử giữ nguyên; chạy so khớp lại sau khi xác nhận chia sẻ ảnh để lưu kết quả mới.

## Quản lý con dấu ngay trong hồ sơ tổ chức — 10/11/2026

- Thêm Chỉnh sửa/Xóa trên từng thẻ dấu của hồ sơ tổ chức, dùng cùng thành phần với lưới/bảng thư viện chung. Sửa tên mẫu, ghi chú, tải PDF/ảnh thay thế hoặc dùng ảnh đã xử lý; khoanh vùng, xác nhận và xem ảnh cũ/mới trước khi lưu. Hủy không đổi bản ghi thư viện; xóa cần xác nhận và loại dấu khỏi tra cứu mới.
- `PATCH /reference-intake/{id}` lưu tên mẫu, ghi chú, ảnh và nguồn trong cùng giao dịch. Kiểm tra quyền, ROI/run xử lý, tổ chức của nguồn; thay ảnh đưa trạng thái về `reference_only` và bỏ mô tả màu/chất lượng cũ. Byte ảnh, candidate và snapshot kết quả trước đó không bị ghi đè. Xóa dùng trạng thái `deleted` hiện có; không xóa tệp vật lý.
- Quyền tệp cho phép chủ phiên xem ảnh đã dùng trong phiên của mình sau khi mẫu bị thay/xóa. Người khác không được truy cập ảnh đã ngừng chia sẻ chỉ vì biết ID. Tài khoản chỉ xem không có nút và API từ chối chỉnh sửa/xóa; dấu riêng vẫn được bảo vệ.
- **69 pytest đạt (28,16 giây)**, gồm đổi tên/ghi chú, thay ảnh/reset xác thực, nguồn khác tổ chức, rollback cả tài liệu mới khi lỗi, quyền người dùng, xóa khỏi corpus và bảo toàn kết quả/báo cáo/ảnh lịch sử. **7 Playwright đạt (1 phút)**, có luồng mới kiểm tra sửa tên → upload/cắt ảnh → preview → lưu → hủy → xóa → xem kết quả cũ. TypeScript/Vite build và Ruff đạt.
- Đã xem ảnh giao diện sửa dấu ở desktop 1366px và điện thoại 390px; kiểm tra dialog và trang không tràn ngang. Kiểm thử dùng schema/tệp riêng và OpenAI giả lập; không gọi API thật, không sửa `.env` hay các con dấu của CSDL ứng dụng. Không cần migration mới.

## Giao diện so khớp trung tính và kết quả gọn — 12/11/2026

- Thay tên nhà cung cấp và các thông tin model/prompt/token bằng nhãn trung tính trong luồng văn bản, so khớp nâng cao, Top 3, thanh điều hướng, tổng quan, cài đặt và lịch sử. Thông báo lỗi phía trình bày được ánh xạ theo mã lỗi; giữ thông báo kết nối/thời gian chờ/thiếu hạn mức có ích cho thao tác. Xác nhận chia sẻ vẫn nêu dịch vụ xử lý bên ngoài.
- Dùng `MatchSummary` chung cho kết quả tại chỗ và trang đối chiếu: điểm %, mức đánh giá theo cùng ngưỡng màu, thời gian xử lý và ảnh Q/K. Bỏ diễn giải dài, OCR, quan sát, mức tự tin, chi tiết dấu hiệu và metadata dịch vụ. Top 3 giữ ảnh, đơn vị và điểm; không hiển thị đoạn diễn giải do bộ xử lý trả về. Không tạo chỉ số thành phần hoặc nhãn thuật toán chưa triển khai.
- Báo cáo HTML cũng dùng bản gọn, giữ ảnh nhúng và ghi chú thủ công được escape. Lỗi/thiếu dữ liệu không gán điểm; phản hồi đầy đủ, metadata model/prompt/usage và lịch sử vẫn giữ trong CSDL/API nội bộ. Không sửa key, model, prompt, cách gọi API hoặc cấu trúc CSDL.
- **70 pytest đạt (27,22 giây)**, gồm kiểm tra báo cáo không xuất nội dung chi tiết/nhà cung cấp nhưng API vẫn giữ phản hồi đầy đủ, các lỗi upstream không sinh điểm và ghi chú thủ công được escape. **7 Playwright đạt (1,1 phút)**; kiểm tra lại **3 luồng văn bản đạt (26 giây)** sau khi xếp Q/K theo chiều dọc trên điện thoại. TypeScript/Vite build và `git diff --check` đạt.
- Đã xem ảnh kết quả desktop 1366px và điện thoại 390px, kiểm tra cả hai ảnh nằm trọn vùng hiển thị. Kiểm thử dùng schema riêng và API giả lập; không gửi tài liệu hoặc phát sinh lượt OpenAI thật. Các server kiểm thử đã kết thúc; dữ liệu ứng dụng được giữ nguyên.

## Bắt đầu so khớp trực tiếp, nhãn chọn toàn ảnh gọn — 12/11/2026

- Bỏ checkbox và bước xác nhận truyền dữ liệu riêng trong luồng văn bản, so khớp nâng cao và Top 3. Bấm So khớp/So khớp lại/Tra cứu/Tiếp tục là thao tác bắt đầu xử lý; không tự gọi khi tải ảnh hoặc mở trang. Payload tiếp tục gửi `consent: true` để tương thích API và lưu sự kiện theo thao tác chủ động này. Luồng nâng cao giảm từ 5 còn 4 bước, có chặn bấm trùng.
- Nhãn toàn ảnh chỉ còn `Chọn toàn ảnh Q/K` hoặc `Chọn toàn ảnh/trang`; vẫn giữ kiểm tra ROI và cờ toàn ảnh khi lưu. Loại câu chữ truyền dữ liệu khỏi phần giới thiệu, toàn ảnh, cài đặt, trang chủ, sidebar, đăng nhập và lỗi hiển thị. Kiểm tra mã frontend không còn nội dung cố định về gửi/chia sẻ/bên ngoài.
- Nhật ký quản trị chuyển các mã sự kiện sang nhãn Bắt đầu so khớp/Bắt đầu tra cứu/Kiểm tra kết nối, giữ nguyên bản ghi nội bộ. Tab kết nối dùng `connection`, vẫn đọc được liên kết `tab=openai` cũ.
- TypeScript/Vite build và `git diff --check` đạt; **7 Playwright đạt (1,1 phút)**. Kiểm tra bổ sung **3 luồng văn bản đạt (26,7 giây)**, gồm nhật ký quản trị giả lập, so khớp trực tiếp/chạy lại, chọn toàn ảnh, thiếu cấu hình không gọi và lỗi upstream không tạo điểm. Đã xem ảnh luồng kết quả không còn checkbox xác nhận riêng. Test dùng schema riêng/API giả lập; không sửa key hoặc dữ liệu ứng dụng.

## Kết luận và căn cứ so khớp súc tích — 12/11/2026

- Prompt `seal-brief-vi-v3` yêu cầu nhận xét ngắn: tối đa hai căn cứ tương đồng, hai khác biệt, một vùng chưa rõ; mỗi mô tả căn cứ tối đa 120 ký tự, hạn chế tối đa 160 ký tự. Tiếp tục chỉ so con dấu, không dùng chữ ký làm căn cứ khác biệt và không tự tạo chỉ số chưa đo.
- Thêm `compact_explanation` dùng phản hồi đã lưu: một câu kết luận theo ngưỡng điểm, tối đa ba căn cứ 140 ký tự và một lưu ý 160 ký tự. Không cắt ngang câu dài; không đưa chữ ký, nội dung kỹ thuật, phần trăm thành phần hoặc nhận định cùng dụng cụ/thật giả vào căn cứ. Thiếu dữ liệu không đưa các quan sát thành bằng chứng đã khớp; lỗi không có giải thích giả. Không đổi điểm để phù hợp lời nhận xét.
- API kết quả thêm `explanation`, tương thích dữ liệu cũ; Top 3 gắn giải thích của mẫu tốt nhất mỗi tổ chức. Kết quả tại chỗ, trang đối chiếu và báo cáo HTML dùng chung nội dung. Không thêm lượt API để tóm tắt; không đổi key/model hoặc cấu trúc CSDL. Xem [thiết kế và ví dụ](concise_explanations.md).
- **78 pytest đạt (30,45 giây)**; **7 Playwright đạt (1,2 phút)**; TypeScript/Vite build và Ruff đạt. Kiểm tra lại **3 luồng văn bản đạt (28,6 giây)** sau khi chỉnh phần giải thích chiếm đủ chiều ngang trên điện thoại. Bao gồm giới hạn số ý/độ dài, cân bằng giống/khác, lọc chữ ký và chỉ số chưa đo, bảo toàn điểm, phản hồi cũ, báo cáo và Top 3.
- Đã xem ảnh desktop 1366px và điện thoại 390px. Test dùng schema riêng và API giả lập; chưa đánh giá độ chính xác của prompt mới trên bộ ảnh dấu thật hoặc bằng lượt gọi trả phí. Các nhận xét là căn cứ mô tả, không phải phân rã trọng số của điểm. Cần chạy lại mẫu để lưu kết quả dùng prompt v3; dữ liệu cũ giữ nguyên.
