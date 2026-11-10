import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl } from '../../lib/api';
import { dateTime } from '../../lib/utils';
import type { Document, Impression, Organization, Page, Profile } from '../../types';
import { Button } from '../../components/ui/button';
import { Empty, ErrorBox, Loading, PageHeader, Pagination, UploadBox } from '../../components/shared';
import { useAuth } from '../auth/Auth';

export function OrganizationWorkspace() {
  const { organizationId } = useParams();
  const { user } = useAuth();
  const editable = user?.role !== 'viewer';
  const qc = useQueryClient();
  const [tab, setTab] = useState('stamps');
  const [page, setPage] = useState(1);
  const [legacy, setLegacy] = useState('');
  const organization = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: () => api<Organization>(`/organizations/${organizationId}`),
  });
  const stamps = useQuery({
    queryKey: ['library', 'organization', organizationId, page],
    queryFn: () =>
      api<Page<Impression>>(`/seal-impressions?organization_id=${organizationId}&page=${page}&page_size=18`),
  });
  const documents = useQuery({
    queryKey: ['organization-documents', organizationId, page],
    queryFn: () =>
      api<Page<Document>>(`/documents?organization_id=${organizationId}&page=${page}&page_size=18`),
    enabled: tab === 'documents',
  });
  const profiles = useQuery({
    queryKey: ['profiles', organizationId],
    queryFn: () => api<Profile[]>(`/preprocessing/profiles?organization_id=${organizationId}`),
  });
  const oldProfiles = useQuery({
    queryKey: ['profiles', 'legacy'],
    queryFn: () => api<Profile[]>('/preprocessing/profiles'),
    enabled: tab === 'profiles',
  });
  if (organization.isPending) return <Loading />;
  if (organization.error) return <ErrorBox error={organization.error} />;
  const o = organization.data;
  return (
    <>
      <PageHeader
        eyebrow={`HỒ SƠ TỔ CHỨC · ${o.code || o.short_name || ''}`}
        title={o.name}
        description="Tài liệu nguồn, thư viện con dấu và cấu hình xử lý ảnh cùng một đơn vị."
      >
        <Button variant="outline" asChild>
          <Link to="/organizations">
            <ArrowLeft size={16} />
            Các tổ chức
          </Link>
        </Button>
        {editable && (
          <Button asChild>
            <Link to={`/seal-library/add?organization=${o.id}`}>
              <Plus size={16} />
              Tải tài liệu & tách dấu
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className="workflow-guide">
        <span>1. Chọn tổ chức</span>
        <span>2. Tải tài liệu, tách và lưu dấu</span>
        <Link to="/compare/library">3. Tra cứu Top 3 qua OpenAI →</Link>
      </div>
      <div className="tabs">
        {[
          ['stamps', `Con dấu (${stamps.data?.total ?? '…'})`],
          ['documents', 'Tài liệu nguồn'],
          ['profiles', `Cấu hình xử lý (${profiles.data?.length ?? '…'})`],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'stamps' &&
        (stamps.isPending ? (
          <Loading />
        ) : stamps.error ? (
          <ErrorBox error={stamps.error} />
        ) : (
          <>
            {stamps.data.items.length ? (
              <div className="library-grid">
                {stamps.data.items.map((i) => (
                  <article className="stamp-card" key={i.id}>
                    <Link className="stamp-image" to={`/compare/document-stamp?reference=${i.id}`}>
                      <img
                        src={previewUrl(i.image_asset_id)}
                        alt={`Con dấu ${i.design_name}`}
                        loading="lazy"
                      />
                    </Link>
                    <div className="stamp-info">
                      <span className="eyebrow">{o.code || o.name}</span>
                      <h3>{i.design_name}</h3>
                      <p>{i.note || dateTime(i.created_at)}</p>
                      <div className="header-actions">
                        <Button size="sm" asChild>
                          <Link to={`/compare/document-stamp?reference=${i.id}`}>Đối chiếu dấu này</Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/compare/library?q=${i.image_asset_id}`}>Tra cứu thư viện</Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Đơn vị chưa có con dấu"
                description="Tải tài liệu PDF/ảnh, khoanh vùng dấu rồi lưu vào hồ sơ này."
              >
                {editable && (
                  <Button asChild>
                    <Link to={`/seal-library/add?organization=${o.id}`}>Thêm dấu đầu tiên</Link>
                  </Button>
                )}
              </Empty>
            )}
            <Pagination page={page} size={18} total={stamps.data.total} onChange={setPage} />
          </>
        ))}
      {tab === 'documents' && (
        <>
          {editable && (
            <section className="panel workspace-upload">
              <h2>Tải tài liệu cho {o.code || o.name}</h2>
              <UploadBox
                multiple
                label="Tải tài liệu tổ chức"
                onUploaded={async (asset) => {
                  await post('/documents', {
                    file_asset_id: asset.id,
                    display_name: asset.original_filename,
                    organization_id: o.id,
                  });
                  await qc.invalidateQueries({ queryKey: ['organization-documents', o.id] });
                }}
              />
            </section>
          )}
          {documents.isPending ? (
            <Loading />
          ) : documents.error ? (
            <ErrorBox error={documents.error} />
          ) : (
            <>
              <div className="document-grid">
                {documents.data.items.map((doc) => (
                  <article className="document-card" key={doc.id}>
                    <img
                      className="document-thumb"
                      src={previewUrl(doc.file_asset_id)}
                      alt={doc.display_name}
                      loading="lazy"
                    />
                    <div className="document-info">
                      <h3>{doc.display_name}</h3>
                      <p>{doc.page_count} trang / khung</p>
                      <Button size="sm" asChild>
                        <Link to={`/seal-library/add?organization=${o.id}&document=${doc.id}`}>
                          <ScanLine size={15} />
                          Tách con dấu
                        </Link>
                      </Button>
                      <a
                        className="text-link"
                        href={`/api/v1/assets/${doc.file_asset_id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={14} />
                        Mở tệp gốc
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              <Pagination page={page} size={18} total={documents.data.total} onChange={setPage} />
              {!documents.data.total && (
                <Empty
                  title="Chưa có tài liệu"
                  description="Tài liệu tải trong hồ sơ tổ chức sẽ xuất hiện ở đây."
                />
              )}
            </>
          )}
        </>
      )}
      {tab === 'profiles' && (
        <section className="panel workspace-upload">
          <h2>Cấu hình xử lý dùng chung cho đơn vị</h2>
          <p className="muted">
            Đây là bộ thông số cắt/mực/độ sáng, giúp các ảnh của cùng đơn vị được chuẩn bị nhất quán.
          </p>
          {profiles.error && <ErrorBox error={profiles.error} />}
          {profiles.data?.map((p) => (
            <div className="profile-row" key={p.id}>
              <strong>{p.name}</strong>
              <span className="badge">
                {p.parameters.red_mask ? 'Tách mực đỏ' : p.parameters.grayscale ? 'Đen trắng' : 'Giữ màu mực'}
              </span>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/preprocessing?organization=${o.id}&profile=${p.id}`}>Áp dụng trong xưởng</Link>
              </Button>
            </div>
          ))}
          {!profiles.data?.length && <p>Chưa có cấu hình. Mở xưởng, chọn tổ chức này và lưu bộ thông số.</p>}
          {editable && (
            <>
              <Button asChild>
                <Link to={`/preprocessing?organization=${o.id}`}>Mở xưởng theo tổ chức</Link>
              </Button>
              <hr />
              <label>
                Gắn cấu hình cũ chưa thuộc tổ chức
                <select value={legacy} onChange={(e) => setLegacy(e.target.value)}>
                  <option value="">Chọn cấu hình cũ</option>
                  {oldProfiles.data
                    ?.filter(
                      (p) => !p.organization_id && (p.owner_user_id === user?.id || user?.role === 'admin'),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                variant="outline"
                disabled={!legacy}
                onClick={async () => {
                  try {
                    await api(`/preprocessing/profiles/${legacy}/organization`, {
                      method: 'PATCH',
                      body: JSON.stringify({ organization_id: o.id }),
                    });
                    setLegacy('');
                    await qc.invalidateQueries({ queryKey: ['profiles'] });
                    toast.success('Đã gắn cấu hình vào tổ chức.');
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Gắn vào {o.code || 'tổ chức'}
              </Button>
            </>
          )}
        </section>
      )}
    </>
  );
}
