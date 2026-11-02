import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Grid2X2, List, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl } from '../../lib/api';
import { dateTime, statusLabel } from '../../lib/utils';
import type { Asset, Design, Device, Entity, Impression, Organization, Page, Result } from '../../types';
import {
  Confirm,
  Empty,
  ErrorBox,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  UploadBox,
} from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';

type Tab = 'seal-impressions' | 'seal-designs' | 'seal-devices';
export function Library() {
  const [tab, setTab] = useState<Tab>('seal-impressions');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [org, setOrg] = useState('');
  const [grid, setGrid] = useState(true);
  const [editing, setEditing] = useState<Entity | null | undefined>();
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [detail, setDetail] = useState<Impression | null>(null);
  const [detailTab, setDetailTab] = useState('images');
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkDesign, setBulkDesign] = useState('');
  const qc = useQueryClient();
  const { user } = useAuth();
  const editable = user?.role !== 'viewer';
  const query = useQuery({
    queryKey: ['library', tab, q, page, org],
    queryFn: () =>
      api<Page<Entity>>(
        `/${tab}?q=${encodeURIComponent(q)}&page=${page}&page_size=18&status=all${org ? `&organization_id=${org}` : ''}`,
      ),
  });
  const orgs = useQuery({
    queryKey: ['org-options'],
    queryFn: () => api<Page<Organization>>('/organizations?page_size=100'),
  });
  const designs = useQuery({
    queryKey: ['design-options'],
    queryFn: () => api<Page<Design>>('/seal-designs?page_size=100'),
  });
  const devices = useQuery({
    queryKey: ['device-options'],
    queryFn: () => api<Page<Device>>('/seal-devices?page_size=100'),
  });
  const assets = useQuery({
    queryKey: ['processed-assets'],
    queryFn: () => api<Page<Asset>>('/assets?kind=processed_stamp&page_size=100'),
  });
  const usage = useQuery({
    queryKey: ['design-usage', detail?.seal_design_id],
    queryFn: () => api<Result[]>(`/seal-designs/${detail!.seal_design_id}/usage`),
    enabled: !!detail,
  });
  const label =
    tab === 'seal-designs' ? 'mẫu thiết kế' : tab === 'seal-devices' ? 'dụng cụ' : 'ảnh dấu tham chiếu';
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['library'] });
    await qc.invalidateQueries({ queryKey: ['design-options'] });
    await qc.invalidateQueries({ queryKey: ['device-options'] });
  };
  const text = (key: string, title: string, required = false) => (
    <label key={key}>
      {title}
      {required ? ' *' : ''}
      <input
        name={key}
        required={required}
        maxLength={key === 'name' ? 500 : 80}
        defaultValue={String(editing?.[key] || '')}
      />
    </label>
  );
  const area = (key: string, title: string) => (
    <label key={key}>
      {title}
      <textarea name={key} maxLength={5000} defaultValue={String(editing?.[key] || '')} />
    </label>
  );
  const select = (
    key: string,
    title: string,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <label>
      {title}
      {required ? ' *' : ''}
      <select name={key} required={required} defaultValue={String(editing?.[key] || '')}>
        <option value="">— Chọn —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <PageHeader
        eyebrow="KHO THAM CHIẾU"
        title="Thư viện mẫu con dấu"
        description="Tách biệt mẫu thiết kế, dụng cụ vật lý và từng ảnh dấu đóng. Không suy luận cùng nguồn vật lý."
      >
        {editable && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setBulk(true);
                setBulkDesign(designs.data?.items[0]?.id || '');
              }}
            >
              Tải nhiều ảnh mẫu
            </Button>
            <Button onClick={() => setEditing(null)}>
              <Plus size={17} />
              Thêm {label}
            </Button>
          </>
        )}
      </PageHeader>
      <div className="tabs">
        {(
          [
            ['seal-impressions', 'Ảnh dấu tham chiếu'],
            ['seal-designs', 'Mẫu thiết kế'],
            ['seal-devices', 'Dụng cụ đóng dấu'],
          ] as const
        ).map(([key, title]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => {
              setTab(key);
              setPage(1);
              setQ('');
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder={`Tìm ${label}…`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {tab !== 'seal-devices' && (
          <select
            className="filter-select"
            value={org}
            onChange={(e) => {
              setOrg(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả tổ chức</option>
            {orgs.data?.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        {tab === 'seal-impressions' && (
          <div className="view-toggle">
            <Button
              size="icon"
              aria-label="Dạng lưới"
              variant={grid ? 'default' : 'ghost'}
              onClick={() => setGrid(true)}
            >
              <Grid2X2 size={16} />
            </Button>
            <Button
              size="icon"
              aria-label="Dạng danh sách"
              variant={!grid ? 'default' : 'ghost'}
              onClick={() => setGrid(false)}
            >
              <List size={17} />
            </Button>
          </div>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorBox error={query.error} />
      ) : !query.data.items.length ? (
        <Empty
          title={`Chưa có ${label}`}
          description="Tạo tổ chức, thêm mẫu thiết kế, sau đó tải ảnh đóng mẫu hoặc chọn ảnh đã xử lý."
        >
          <Button variant="outline" asChild>
            <Link to="/preprocessing">Mở xưởng xử lý ảnh</Link>
          </Button>
        </Empty>
      ) : tab === 'seal-impressions' && grid ? (
        <div className="library-grid">
          {(query.data.items as Impression[]).map((i) => (
            <article className="stamp-card" key={i.id}>
              <button
                className="stamp-image"
                onClick={() => {
                  setDetail(i);
                  setDetailTab('images');
                }}
              >
                <img
                  loading="lazy"
                  src={previewUrl(i.image_asset_id)}
                  alt={`Dấu tham chiếu ${i.design_name}`}
                />
                <span className="badge">{statusLabel[i.verification_status]}</span>
              </button>
              <div className="stamp-info">
                <span className="eyebrow">{i.organization_name}</span>
                <h3>{i.design_name}</h3>
                <p>{i.note || 'Ảnh tham chiếu chưa bổ sung ghi chú.'}</p>
                <div className="stamp-actions">
                  <button
                    className="text-link"
                    onClick={() => {
                      setDetail(i);
                      setDetailTab('images');
                    }}
                  >
                    Xem chi tiết
                  </button>
                  {editable && (
                    <div className="row-actions">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Sửa ảnh dấu"
                        onClick={() => setEditing(i)}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Lưu trữ ảnh dấu"
                        onClick={() => setDeleting(i)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  {tab === 'seal-impressions'
                    ? 'Ảnh dấu'
                    : tab === 'seal-designs'
                      ? 'Mẫu thiết kế'
                      : 'Dụng cụ'}
                </th>
                <th>Thông tin liên kết</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {String(item.name || item.internal_device_code || item.design_name || 'Chưa có mã')}
                    </strong>
                    <small>{String(item.design_code || item.note || item.provenance_note || '')}</small>
                  </td>
                  <td>
                    {String(
                      item.organization_name ||
                        orgs.data?.items.find((o) => o.id === item.organization_id)?.name ||
                        designs.data?.items.find((d) => d.id === item.seal_design_id)?.name ||
                        '—',
                    )}
                  </td>
                  <td>
                    <span className="badge">{statusLabel[String(item.status)] || String(item.status)}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {tab === 'seal-impressions' && (
                        <Button variant="ghost" size="sm" onClick={() => setDetail(item as Impression)}>
                          Chi tiết
                        </Button>
                      )}
                      {tab === 'seal-designs' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTab('seal-impressions');
                            setQ(String(item.name));
                            setPage(1);
                          }}
                        >
                          Xem ảnh
                        </Button>
                      )}
                      {editable && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Chỉnh sửa"
                            onClick={() => setEditing(item)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Lưu trữ"
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {query.data && <Pagination page={page} total={query.data.total} size={18} onChange={setPage} />}
      <div className="notice subtle">
        <BookOpen size={18} />
        <span>
          Ảnh trong thư viện là dữ liệu tham chiếu. Nhãn “Đã xác thực” do chuyên viên ghi nhận, không phải kết
          luận của AI.
        </span>
      </div>
      {editing !== undefined && (
        <Modal title={`${editing ? 'Chỉnh sửa' : 'Thêm'} ${label}`} onClose={() => setEditing(undefined)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const values: Record<string, unknown> = Object.fromEntries(
                Array.from(form).map(([k, v]) => [k, v === '' ? null : v]),
              );
              if (tab === 'seal-impressions') {
                values.is_reference = true;
                values.capture_method = values.capture_method || 'unknown';
                values.verification_status = values.verification_status || 'reference_only';
              }
              setBusy(true);
              try {
                await api(`/${tab}${editing ? `/${editing.id}` : ''}`, {
                  method: editing ? 'PATCH' : 'POST',
                  body: JSON.stringify(values),
                });
                await refresh();
                setEditing(undefined);
                toast.success('Đã lưu thông tin thư viện.');
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tab === 'seal-designs' && (
              <>
                {select(
                  'organization_id',
                  'Tổ chức',
                  orgs.data?.items.map((o) => ({ value: o.id, label: o.name })) || [],
                  true,
                )}
                {text('name', 'Tên mẫu thiết kế', true)}
                <div className="form-grid">
                  {text('design_code', 'Mã mẫu')}
                  {select(
                    'seal_type',
                    'Loại dấu',
                    [
                      { value: 'round', label: 'Dấu tròn' },
                      { value: 'rectangular', label: 'Dấu chữ nhật' },
                      { value: 'other', label: 'Khác' },
                    ],
                    true,
                  )}
                </div>
                {area('description', 'Mô tả')}
                {area('reference_notes', 'Ghi chú nguồn tham chiếu')}
                <div className="form-grid">
                  <label>
                    Ngày phát hành
                    <input name="issued_at" type="date" defaultValue={String(editing?.issued_at || '')} />
                  </label>
                  <label>
                    Hiệu lực từ
                    <input name="valid_from" type="date" defaultValue={String(editing?.valid_from || '')} />
                  </label>
                  <label>
                    Hiệu lực đến
                    <input name="valid_to" type="date" defaultValue={String(editing?.valid_to || '')} />
                  </label>
                </div>
              </>
            )}
            {tab === 'seal-devices' && (
              <>
                {select(
                  'seal_design_id',
                  'Mẫu thiết kế',
                  designs.data?.items.map((d) => ({ value: d.id, label: d.name })) || [],
                  true,
                )}
                {text('internal_device_code', 'Mã dụng cụ nội bộ')}
                {select(
                  'source_confidence',
                  'Cơ sở nguồn gốc',
                  [
                    { value: 'unknown', label: 'Chưa rõ' },
                    { value: 'documented', label: 'Có hồ sơ' },
                    { value: 'verified', label: 'Đã xác thực' },
                  ],
                  true,
                )}
                {area('inventory_note', 'Thông tin kiểm kê')}
                {area('provenance_note', 'Bằng chứng nguồn gốc')}
                <div className="form-grid">
                  <label>
                    Sử dụng từ
                    <input type="date" name="active_from" defaultValue={String(editing?.active_from || '')} />
                  </label>
                  <label>
                    Sử dụng đến
                    <input type="date" name="active_to" defaultValue={String(editing?.active_to || '')} />
                  </label>
                </div>
              </>
            )}
            {tab === 'seal-impressions' && (
              <>
                {select(
                  'seal_design_id',
                  'Mẫu thiết kế',
                  designs.data?.items.map((d) => ({ value: d.id, label: d.name })) || [],
                  true,
                )}
                {select(
                  'seal_device_id',
                  'Dụng cụ (để trống nếu chưa rõ)',
                  devices.data?.items.map((d) => ({
                    value: d.id,
                    label: d.internal_device_code || d.id.slice(0, 8),
                  })) || [],
                )}
                <label>
                  Ảnh đã xử lý *
                  <select name="image_asset_id" required defaultValue={String(editing?.image_asset_id || '')}>
                    <option value="">— Chọn ảnh từ Xưởng xử lý —</option>
                    {!!editing?.image_asset_id &&
                      !assets.data?.items.some((a) => a.id === editing.image_asset_id) && (
                        <option value={String(editing.image_asset_id)}>Ảnh hiện tại</option>
                      )}
                    {assets.data?.items.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.original_filename} · {a.id.slice(0, 8)} · {dateTime(a.created_at)}
                      </option>
                    ))}
                  </select>
                </label>
                <Link to="/preprocessing" className="text-link">
                  Mở xưởng để cắt và lưu ảnh mẫu
                </Link>
                {select(
                  'verification_status',
                  'Trạng thái tham chiếu',
                  [
                    { value: 'reference_only', label: 'Chỉ tham chiếu' },
                    { value: 'unverified', label: 'Chưa xác thực' },
                    { value: 'verified', label: 'Đã xác thực' },
                  ],
                  true,
                )}
                {select('capture_method', 'Phương pháp thu ảnh', [
                  { value: 'unknown', label: 'Chưa rõ' },
                  { value: 'scan', label: 'Quét' },
                  { value: 'photo', label: 'Chụp' },
                  { value: 'uploaded', label: 'Tải lên' },
                  { value: 'digital', label: 'Ảnh số' },
                ])}
                {text('observed_color', 'Màu quan sát')}
                {area('image_quality_note', 'Chất lượng ảnh')}
                {area('note', 'Ghi chú')}
              </>
            )}
            {select(
              'status',
              'Trạng thái',
              [
                { value: 'active', label: 'Đang sử dụng' },
                { value: 'inactive', label: 'Ngưng sử dụng' },
              ],
              true,
            )}
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
                Hủy
              </Button>
              <Button type="submit" disabled={busy}>
                Lưu thông tin
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Confirm
          title={String(deleting.name || deleting.design_name || deleting.internal_device_code || 'Bản ghi')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/${tab}/${deleting.id}`, { method: 'DELETE' });
            await refresh();
          }}
        />
      )}
      {bulk && (
        <Modal title="Tải nhiều ảnh đóng mẫu" onClose={() => setBulk(false)}>
          <label>
            Mẫu thiết kế
            <select value={bulkDesign} onChange={(e) => setBulkDesign(e.target.value)}>
              <option value="">— Chọn mẫu thiết kế —</option>
              {designs.data?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Mỗi ảnh tạo một lần đóng tham chiếu riêng. Ảnh toàn trang cần được cắt và cập nhật trước khi đối
            chiếu.
          </p>
          {bulkDesign ? (
            <UploadBox
              multiple
              kind="original_stamp"
              onUploaded={async (a) => {
                if (!a.media_type.startsWith('image/') || a.page_count !== 1)
                  throw new Error('Hãy xử lý PDF/TIFF nhiều trang trong Xưởng trước.');
                await post('/seal-impressions', {
                  seal_design_id: bulkDesign,
                  image_asset_id: a.id,
                  is_reference: true,
                  verification_status: 'reference_only',
                  capture_method: 'uploaded',
                });
                await refresh();
              }}
            />
          ) : (
            <p>Chọn mẫu thiết kế trước khi tải ảnh.</p>
          )}
        </Modal>
      )}
      {detail && (
        <Modal title={detail.design_name} onClose={() => setDetail(null)}>
          <div className="tabs">
            {[
              ['images', 'Hình ảnh'],
              ['organization', 'Đơn vị'],
              ['metadata', 'Thông tin'],
              ['impressions', 'Các lần đóng'],
              ['usage', 'Lịch sử sử dụng'],
            ].map(([key, title]) => (
              <button
                key={key}
                className={detailTab === key ? 'active' : ''}
                onClick={() => setDetailTab(key)}
              >
                {title}
              </button>
            ))}
          </div>
          {detailTab === 'images' && (
            <>
              <img className="detail-stamp" src={previewUrl(detail.image_asset_id)} alt="Ảnh tham chiếu" />
              <p>
                <span className="badge">{statusLabel[detail.verification_status]}</span> · {detail.note}
              </p>
              <Button variant="outline" asChild>
                <Link to={`/preprocessing?asset=${detail.image_asset_id}`}>Mở trong xưởng xử lý</Link>
              </Button>
            </>
          )}
          {detailTab === 'organization' && (
            <>
              <h3>{detail.organization_name}</h3>
              <p>
                {orgs.data?.items.find((o) => o.id === detail.organization_id)?.address ||
                  'Chưa bổ sung địa chỉ.'}
              </p>
            </>
          )}
          {detailTab === 'metadata' && (
            <dl className="metadata-list">
              {Object.entries(detail).map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {(
                      {
                        seal_design_id: 'Mẫu thiết kế',
                        organization_id: 'Tổ chức',
                        seal_device_id: 'Dụng cụ',
                        verification_status: 'Trạng thái xác thực',
                        capture_method: 'Phương pháp thu ảnh',
                        image_quality_note: 'Chất lượng ảnh',
                        observed_color: 'Màu quan sát',
                        source_page: 'Trang nguồn',
                        note: 'Ghi chú',
                        created_at: 'Ngày tạo',
                        image_asset_id: 'Mã tệp',
                        is_reference: 'Ảnh tham chiếu',
                        id: 'Mã bản ghi',
                      } as Record<string, string>
                    )[k] || k}
                  </dt>
                  <dd>
                    {v === true
                      ? 'Có'
                      : v === false
                        ? 'Không'
                        : statusLabel[String(v)] || String(v ?? 'Chưa rõ')}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {detailTab === 'impressions' && <RelatedImpressions designId={detail.seal_design_id} />}{' '}
          {detailTab === 'usage' &&
            (usage.isPending ? (
              <Loading />
            ) : usage.error ? (
              <ErrorBox error={usage.error} />
            ) : usage.data.length ? (
              <ul className="simple-list">
                {usage.data.map((r) => (
                  <li key={r.id}>
                    <Link to={`/compare/${r.session_id}/results`}>
                      {dateTime(r.created_at)} · {r.model_name} · {statusLabel[r.result_status]}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                title="Chưa có lần sử dụng"
                description="Các phiên đối chiếu với ảnh mẫu này sẽ xuất hiện tại đây."
              />
            ))}
        </Modal>
      )}
    </>
  );
}
function RelatedImpressions({ designId }: { designId: string }) {
  const query = useQuery({
    queryKey: ['impressions-related', designId],
    queryFn: () => api<Page<Impression>>(`/seal-impressions?seal_design_id=${designId}&page_size=100`),
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorBox error={query.error} />
  ) : (
    <div className="related-grid">
      {query.data.items.map((i) => (
        <div key={i.id}>
          <img src={previewUrl(i.image_asset_id)} alt="Một lần đóng tham chiếu" />
          <small>{dateTime(i.created_at)}</small>
          <p>{i.note || 'Chưa bổ sung ghi chú'}</p>
        </div>
      ))}
    </div>
  );
}
