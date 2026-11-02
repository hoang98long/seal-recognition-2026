import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, post } from '../../lib/api';
import type { Organization, Page } from '../../types';
import { Confirm, Empty, ErrorBox, Loading, Modal, PageHeader, Pagination } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';
export function Organizations() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Organization | null | undefined>();
  const [deleting, setDeleting] = useState<Organization | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const editable = user?.role !== 'viewer';
  const query = useQuery({
    queryKey: ['organizations', q, page],
    queryFn: () =>
      api<Page<Organization>>(
        `/organizations?q=${encodeURIComponent(q)}&page=${page}&page_size=20&status=all`,
      ),
  });
  const all = useQuery({
    queryKey: ['org-options'],
    queryFn: () => api<Page<Organization>>('/organizations?page_size=100'),
  });
  return (
    <>
      <PageHeader
        eyebrow="THƯ VIỆN THAM CHIẾU"
        title="Cơ quan / tổ chức"
        description="Quản lý đơn vị sở hữu mẫu thiết kế và thông tin nguồn tham chiếu."
      >
        {editable && (
          <Button onClick={() => setEditing(null)}>
            <Plus size={17} />
            Thêm tổ chức
          </Button>
        )}
      </PageHeader>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Tìm tên hoặc mã tổ chức…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <section className="panel">
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorBox error={query.error} />
        ) : !query.data.items.length ? (
          <Empty
            title="Chưa có tổ chức phù hợp"
            description="Thêm đơn vị để quản lý các mẫu thiết kế con dấu."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tổ chức</th>
                  <th>Mã đơn vị</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="entity-name">
                        <span className="entity-icon">
                          <Building2 size={19} />
                        </span>
                        <div>
                          <strong>{o.name}</strong>
                          <small>{o.short_name || o.description}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{o.code || '—'}</code>
                    </td>
                    <td>{o.address || 'Chưa bổ sung'}</td>
                    <td>
                      <span className="badge">
                        {o.status === 'active' ? 'Đang hoạt động' : 'Ngưng hoạt động'}
                      </span>
                    </td>
                    <td>
                      {editable && (
                        <div className="row-actions">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Sửa ${o.name}`}
                            onClick={() => setEditing(o)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Lưu trữ ${o.name}`}
                            onClick={() => setDeleting(o)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && <Pagination page={page} total={query.data.total} size={20} onChange={setPage} />}
      </section>
      {editing !== undefined && (
        <Modal title={editing ? 'Chỉnh sửa tổ chức' : 'Thêm tổ chức'} onClose={() => setEditing(undefined)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              const values = Object.fromEntries(Array.from(f).map(([k, v]) => [k, v === '' ? null : v]));
              try {
                if (editing)
                  await api(`/organizations/${editing.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(values),
                  });
                else await post('/organizations', values);
                await qc.invalidateQueries({ queryKey: ['organizations'] });
                await qc.invalidateQueries({ queryKey: ['org-options'] });
                setEditing(undefined);
                toast.success('Đã lưu thông tin tổ chức.');
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tên tổ chức *<input name="name" required maxLength={500} defaultValue={editing?.name} />
            </label>
            <div className="form-grid">
              <label>
                Mã đơn vị
                <input name="code" maxLength={80} defaultValue={editing?.code || ''} />
              </label>
              <label>
                Tên viết tắt
                <input name="short_name" maxLength={200} defaultValue={editing?.short_name || ''} />
              </label>
            </div>
            <label>
              Đơn vị cấp trên
              <select
                name="parent_organization_id"
                defaultValue={String(editing?.parent_organization_id || '')}
              >
                <option value="">Không có</option>
                {all.data?.items
                  .filter((o) => o.id !== editing?.id)
                  .map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Địa chỉ
              <input name="address" maxLength={1000} defaultValue={editing?.address || ''} />
            </label>
            <label>
              Mô tả
              <textarea name="description" maxLength={5000} defaultValue={editing?.description || ''} />
            </label>
            <label>
              Trạng thái
              <select name="status" defaultValue={editing?.status || 'active'}>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngưng hoạt động</option>
              </select>
            </label>
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
          title={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`/organizations/${deleting.id}`, { method: 'DELETE' });
            await qc.invalidateQueries({ queryKey: ['organizations'] });
            await qc.invalidateQueries({ queryKey: ['org-options'] });
          }}
        />
      )}
    </>
  );
}
