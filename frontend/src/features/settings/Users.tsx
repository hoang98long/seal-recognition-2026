import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, post } from '../../lib/api';
import { statusLabel } from '../../lib/utils';
import type { User } from '../../types';
import { ErrorBox, Loading, Modal, PageHeader } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';
export function Users() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api<User[]>('/users'),
    enabled: user?.role === 'admin',
  });
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return (
    <>
      <PageHeader
        eyebrow="QUẢN TRỊ"
        title="Người dùng & phân quyền"
        description="Quyền admin, phân tích viên và chỉ xem được kiểm tra trực tiếp tại backend."
      >
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          Thêm tài khoản
        </Button>
      </PageHeader>
      <section className="panel">
        {users.isPending ? (
          <Loading />
        ) : users.error ? (
          <ErrorBox error={users.error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.full_name}</strong>
                    <small>
                      {u.username}
                      {u.must_change_password ? ' · Cần đổi mật khẩu' : ''}
                    </small>
                  </td>
                  <td>
                    <select
                      aria-label={`Vai trò ${u.username}`}
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={async (e) => {
                        try {
                          await api(`/users/${u.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role: e.target.value }),
                          });
                          await qc.invalidateQueries({ queryKey: ['users'] });
                          toast.success('Đã cập nhật quyền và thu hồi phiên cũ.');
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      {['admin', 'analyst', 'viewer'].map((r) => (
                        <option key={r} value={r}>
                          {statusLabel[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="badge">{u.is_active ? 'Đang hoạt động' : 'Đã khóa'}</span>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={u.id === user.id}
                      onClick={async () => {
                        try {
                          await api(`/users/${u.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ is_active: !u.is_active }),
                          });
                          await qc.invalidateQueries({ queryKey: ['users'] });
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {u.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {creating && (
        <Modal title="Tạo tài khoản" onClose={() => setCreating(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await post('/users', Object.fromEntries(f));
                await qc.invalidateQueries({ queryKey: ['users'] });
                setCreating(false);
                toast.success('Đã tạo tài khoản. Người dùng phải đổi mật khẩu khi đăng nhập.');
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tên đăng nhập
              <input name="username" required pattern="[a-zA-Z0-9_.-]{3,80}" autoComplete="off" />
            </label>
            <label>
              Họ tên
              <input name="full_name" required maxLength={200} />
            </label>
            <label>
              Mật khẩu ban đầu
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={256}
                autoComplete="new-password"
              />
            </label>
            <label>
              Vai trò
              <select name="role" defaultValue="analyst">
                {['admin', 'analyst', 'viewer'].map((r) => (
                  <option value={r} key={r}>
                    {statusLabel[r]}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={busy}>
                Tạo tài khoản
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
