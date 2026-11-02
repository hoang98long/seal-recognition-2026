import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileImage, Search } from 'lucide-react';
import { api, post, previewUrl } from '../../lib/api';
import { dateTime } from '../../lib/utils';
import type { Document, Page } from '../../types';
import { Empty, ErrorBox, Loading, PageHeader, Pagination, UploadBox } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';
export function Documents() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { user } = useAuth();
  const docs = useQuery({
    queryKey: ['documents', q, page],
    queryFn: () => api<Page<Document>>(`/documents?q=${encodeURIComponent(q)}&page=${page}&page_size=12`),
  });
  return (
    <>
      <PageHeader
        eyebrow="TÀI LIỆU NGUỒN"
        title="Kho tài liệu"
        description="Tải lên và lưu giữ bản gốc. Chọn trang để bắt đầu xử lý vùng con dấu."
      />
      {user?.role !== 'viewer' && (
        <UploadBox
          multiple
          onUploaded={async (a) => {
            await post('/documents', { file_asset_id: a.id, display_name: a.original_filename });
            await qc.invalidateQueries({ queryKey: ['documents'] });
          }}
        />
      )}
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Tìm theo tên tài liệu…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <span className="muted">{docs.data?.total || 0} tài liệu</span>
      </div>
      {docs.isPending ? (
        <Loading />
      ) : docs.error ? (
        <ErrorBox error={docs.error} />
      ) : !docs.data.items.length ? (
        <Empty
          title="Kho tài liệu chưa có dữ liệu"
          description="Tải một tệp PDF hoặc ảnh để bắt đầu. Tệp gốc sẽ được giữ nguyên."
        />
      ) : (
        <div className="document-grid">
          {docs.data.items.map((d) => (
            <article className="document-card" key={d.id}>
              <Link to={`/preprocessing?asset=${d.file_asset_id}`} className="document-thumb">
                <img
                  loading="lazy"
                  src={previewUrl(d.file_asset_id)}
                  alt={`Trang đầu của ${d.display_name}`}
                />
                <span className="page-count">{d.page_count} trang / khung</span>
              </Link>
              <div className="document-info">
                <div className="document-name">
                  <FileImage size={17} />
                  <h3 title={d.display_name}>{d.display_name}</h3>
                </div>
                <p>{dateTime(d.created_at)}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/preprocessing?asset=${d.file_asset_id}`}>
                    Chọn con dấu để xử lý
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
                <a className="text-link" href={`/api/v1/assets/${d.file_asset_id}/download`}>
                  Tải bản gốc
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
      {docs.data && <Pagination page={page} total={docs.data.total} size={12} onChange={setPage} />}
    </>
  );
}
