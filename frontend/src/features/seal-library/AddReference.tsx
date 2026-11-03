import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, LoaderCircle, Plus, Save } from 'lucide-react';
import { api, post, previewUrl } from '../../lib/api';
import type { Asset, Design, Impression, Organization, Page } from '../../types';
import { Button } from '../../components/ui/button';
import { ErrorBox, PageHeader, UploadBox } from '../../components/shared';
import { useAuth } from '../auth/Auth';
import { StampPreparation, type PreparedStamp } from '../document-demo/StampPreparation';
import '../document-demo/demo.css';

export function AddReference() {
  const [search] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [organization, setOrganization] = useState(search.get('organization') || '');
  const [newOrganization, setNewOrganization] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [design, setDesign] = useState('');
  const [name, setName] = useState('');
  const [sealType, setSealType] = useState('other');
  const [note, setNote] = useState('');
  const [asset, setAsset] = useState<Asset | null>(null);
  const [prepared, setPrepared] = useState<PreparedStamp | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Impression | null>(null);
  const submitting = useRef(false);
  const busy = uploading || preparing || saving;
  const organizations = useQuery({
    queryKey: ['intake-organizations', orgSearch, organization],
    queryFn: async () => {
      const list = await api<Page<Organization>>(
        `/organizations?q=${encodeURIComponent(orgSearch)}&page_size=100`,
      );
      if (organization && !list.items.some((o) => o.id === organization)) {
        list.items.unshift(await api<Organization>(`/organizations/${organization}`));
      }
      return list;
    },
  });
  const designs = useQuery({
    queryKey: ['intake-designs', organization],
    queryFn: () => api<Page<Design>>(`/seal-designs?organization_id=${organization}&page_size=100`),
    enabled: !!organization && !newOrganization,
  });
  const onPrepared = useCallback((value: PreparedStamp | null) => {
    setPrepared(value);
    setError('');
  }, []);
  async function save() {
    if (
      submitting.current ||
      !prepared ||
      !name.trim() ||
      (newOrganization ? !organizationName.trim() : !organization)
    )
      return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await post<Impression>('/reference-intake', {
        image_asset_id: prepared.asset.id,
        organization_id: newOrganization ? null : organization,
        organization_name: newOrganization ? organizationName.trim() : null,
        seal_design_id: newOrganization ? null : design || null,
        name: name.trim(),
        seal_type: sealType,
        note: note.trim() || null,
      });
      setSaved(result);
      await Promise.all(
        [
          'library',
          'design-options',
          'org-options',
          'org-select',
          'organizations',
          'dashboard',
          'library-select',
          'reference-options',
          'intake-organizations',
          'intake-designs',
        ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  if (user?.role === 'viewer')
    return <div className="notice">Tài khoản chỉ xem không được thêm con dấu.</div>;
  if (saved)
    return (
      <>
        <PageHeader
          eyebrow="THƯ VIỆN MẪU DẤU"
          title="Đã lưu con dấu"
          description="Ảnh dấu đã sẵn sàng để chọn khi so khớp văn bản."
        />
        <section className="panel intake-success" role="status">
          <CheckCircle2 size={38} />
          <img src={previewUrl(saved.image_asset_id)} alt="Con dấu vừa lưu vào thư viện" />
          <h2>{saved.design_name}</h2>
          <p>{saved.organization_name}</p>
          <div className="header-actions">
            <Button asChild>
              <Link to={`/compare/document-stamp?reference=${saved.id}`}>So khớp văn bản với dấu này</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOrganization(saved.organization_id);
                setNewOrganization(false);
                setDesign(saved.seal_design_id);
                setAsset(null);
                setPrepared(null);
                setSaved(null);
                setError('');
              }}
            >
              <Plus size={16} />
              Thêm ảnh dấu khác
            </Button>
            <Button variant="ghost" asChild>
              <Link to={`/seal-library?organization=${saved.organization_id}`}>Xem trong thư viện</Link>
            </Button>
          </div>
        </section>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="THƯ VIỆN MẪU DẤU"
        title="Thêm con dấu tổ chức"
        description="Chọn tổ chức, tải ảnh và xác nhận vùng dấu. Thông tin mẫu được lưu cùng ảnh trong một lần."
      >
        <Button variant="outline" disabled={busy} asChild>
          <Link to="/seal-library">
            <ArrowLeft size={16} />
            Về thư viện
          </Link>
        </Button>
      </PageHeader>
      <div className="intake-layout">
        <section className="panel intake-form" aria-label="Thông tin con dấu">
          <h2>1. Chọn tổ chức</h2>
          <div className="segmented">
            <button
              disabled={busy}
              className={!newOrganization ? 'active' : ''}
              onClick={() => {
                setNewOrganization(false);
                setDesign('');
              }}
            >
              Có sẵn
            </button>
            <button
              disabled={busy}
              className={newOrganization ? 'active' : ''}
              onClick={() => {
                setNewOrganization(true);
                setDesign('');
              }}
            >
              Tạo tổ chức mới
            </button>
          </div>
          {newOrganization ? (
            <label>
              Tên tổ chức mới
              <input
                value={organizationName}
                maxLength={500}
                disabled={busy}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Nhập tên cơ quan / tổ chức"
              />
            </label>
          ) : (
            <>
              <label>
                Tìm tổ chức
                <input
                  type="search"
                  value={orgSearch}
                  disabled={busy}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Gõ tên hoặc mã để lọc…"
                />
              </label>
              <label>
                Tổ chức
                <select
                  value={organization}
                  disabled={busy}
                  onChange={(e) => {
                    setOrganization(e.target.value);
                    setDesign('');
                  }}
                >
                  <option value="">{organizations.isPending ? 'Đang tải tổ chức…' : 'Chọn tổ chức'}</option>
                  {organizations.data?.items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              {organizations.error && <ErrorBox error={organizations.error} />}
              {organizations.data?.total === 0 && (
                <p className="muted">Không tìm thấy. Bạn có thể tạo tổ chức mới ngay tại đây.</p>
              )}
            </>
          )}
          <h2>2. Đặt tên con dấu</h2>
          {!newOrganization && !!designs.data?.items.length && (
            <label>
              Mẫu con dấu
              <select
                value={design}
                disabled={busy}
                onChange={(e) => {
                  setDesign(e.target.value);
                  const d = designs.data?.items.find((x) => x.id === e.target.value);
                  if (d) setName(d.name);
                }}
              >
                <option value="">Tạo mẫu mới cùng ảnh này</option>
                {designs.data.items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {designs.error && <ErrorBox error={designs.error} />}
          <label>
            Tên con dấu
            <input
              value={name}
              disabled={busy || !!design}
              maxLength={500}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Dấu tròn phòng hành chính"
            />
          </label>
          <details className="demo-extra">
            <summary>Loại dấu và ghi chú (không bắt buộc)</summary>
            <label>
              Loại dấu
              <select
                value={sealType}
                disabled={busy || !!design}
                onChange={(e) => setSealType(e.target.value)}
              >
                <option value="other">Chưa phân loại / khác</option>
                <option value="round">Dấu tròn</option>
                <option value="rectangular">Dấu chữ nhật</option>
              </select>
            </label>
            <label>
              Ghi chú nguồn ảnh
              <textarea
                maxLength={5000}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </details>
          <p className="muted small">Ảnh mới được lưu ở trạng thái tham chiếu, chưa xác thực.</p>
        </section>
        <div className="intake-image">
          <section className="panel intake-upload">
            <h2>3. Tải ảnh con dấu</h2>
            <p className="muted">
              Dùng ảnh dấu riêng hoặc chọn trang có dấu trong PDF. Vùng mực đỏ được gợi ý tự động.
            </p>
            <UploadBox
              disabled={saving || preparing}
              label="Tải ảnh con dấu tổ chức"
              kind="original_stamp"
              onBusyChange={setUploading}
              onUploaded={(a) => {
                setAsset(a);
                setPrepared(null);
                setError('');
                if (!design) setName(a.original_filename.replace(/\.[^.]+$/, '').slice(0, 500));
              }}
            />
          </section>
          {asset && (
            <StampPreparation
              key={asset.id}
              asset={asset}
              role="K"
              initial={null}
              onPrepared={onPrepared}
              onBusyChange={setPreparing}
            />
          )}
        </div>
      </div>
      <div className="panel intake-save" aria-live="polite">
        <div>
          <strong>{prepared ? 'Vùng dấu đã sẵn sàng' : 'Chưa xác nhận vùng dấu'}</strong>
          <p className="muted">
            {prepared
              ? 'Kiểm tra tổ chức và tên dấu, sau đó lưu vào thư viện.'
              : 'Tải ảnh và bấm xác nhận vùng dấu để tiếp tục.'}
          </p>
          {error && <ErrorBox error={new Error(error)} />}
        </div>
        <Button
          disabled={
            busy || !prepared || !name.trim() || (newOrganization ? !organizationName.trim() : !organization)
          }
          onClick={() => void save()}
        >
          {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
          {saving ? 'Đang lưu…' : 'Lưu vào thư viện'}
        </Button>
      </div>
    </>
  );
}
