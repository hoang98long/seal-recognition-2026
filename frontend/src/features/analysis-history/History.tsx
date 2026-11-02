import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Download, ExternalLink, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime, statusLabel } from '../../lib/utils';
import type { Analysis, Page } from '../../types';
import { Empty, ErrorBox, Loading, PageHeader, Pagination } from '../../components/shared';
import { Button } from '../../components/ui/button';
export function History() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [model, setModel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [author, setAuthor] = useState('');
  const [code, setCode] = useState('');
  const [page, setPage] = useState(1);
  const filters = new URLSearchParams({
    q,
    status,
    model,
    design_code: code,
    page: String(page),
    page_size: '20',
  });
  if (from) filters.set('date_from', new Date(`${from}T00:00:00`).toISOString());
  if (to) filters.set('date_to', new Date(`${to}T23:59:59`).toISOString());
  if (author) filters.set('created_by', author);
  const query = useQuery({
    queryKey: ['history', filters.toString()],
    queryFn: () => api<Page<Analysis>>(`/analyses?${filters}`),
  });
  return (
    <>
      <PageHeader
        eyebrow="LƯU VẾT HOẠT ĐỘNG"
        title="Lịch sử phân tích"
        description="Mở lại ảnh nguồn và từng phiên bản kết quả. Chạy lại sẽ giữ nguyên kết quả trước."
      />
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Tìm tên phiên…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="filter-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái</option>
          {['draft', 'running', 'completed', 'failed'].map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
        <input
          className="filter-input"
          placeholder="Model"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <details className="filter-details">
        <summary>Bộ lọc bổ sung</summary>
        <div className="form-grid">
          <label>
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Mã người tạo (UUID)
            <input
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Mã mẫu thiết kế
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </details>
      <section className="panel">
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorBox error={query.error} />
        ) : !query.data.items.length ? (
          <Empty
            title="Chưa có phiên phù hợp"
            description="Các phiên được lưu ngay khi tạo và giữ cả kết quả thành công, không đủ dữ liệu hoặc lỗi."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Phiên đối chiếu</th>
                  <th>Chế độ</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <small>{s.id.slice(0, 8)}</small>
                    </td>
                    <td>{s.mode === 'library' ? 'Thư viện' : 'Hai ảnh'}</td>
                    <td>{dateTime(s.created_at)}</td>
                    <td>
                      <span className={`badge ${s.status}`}>{statusLabel[s.status]}</span>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/compare/${s.id}/results`}>
                          Mở phiên
                          <ArrowUpRight size={15} />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && <Pagination page={page} total={query.data.total} size={20} onChange={setPage} />}
      </section>
    </>
  );
}
export function Reports() {
  const query = useQuery({ queryKey: ['reports'], queryFn: () => api<Analysis[]>('/reports') });
  return (
    <>
      <PageHeader
        eyebrow="TỔNG HỢP HỒ SƠ"
        title="Báo cáo phân tích"
        description="Báo cáo HTML lưu đầy đủ ảnh Q/K, model, thông số xử lý và các lần so sánh. Dùng In → Lưu PDF trong trình duyệt."
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorBox error={query.error} />
      ) : !query.data.length ? (
        <Empty
          title="Chưa có báo cáo"
          description="Báo cáo xuất hiện khi phiên có ít nhất một kết quả phân tích."
        />
      ) : (
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>Hồ sơ</th>
                <th>Cập nhật</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/compare/${s.id}/results`}>
                      <strong>{s.title}</strong>
                    </Link>
                    <small>{s.id.slice(0, 8)}</small>
                  </td>
                  <td>{dateTime(s.updated_at || s.created_at)}</td>
                  <td>
                    <span className={`badge ${s.status}`}>{statusLabel[s.status]}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/v1/reports/${s.id}`} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          Xem / in
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          aria-label="Tải báo cáo HTML"
                          href={`/api/v1/reports/${s.id}/export?download=true`}
                        >
                          <Download size={17} />
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
