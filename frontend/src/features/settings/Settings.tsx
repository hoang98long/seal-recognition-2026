import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  CircleHelp,
  Cpu,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, post } from '../../lib/api';
import { dateTime } from '../../lib/utils';
import type { Entity, OpenAIStatus } from '../../types';
import { ErrorBox, Loading, PageHeader } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';
const auditActionLabels: Record<string, string> = {
  openai_connection_test: 'Kiểm tra kết nối so khớp',
  external_consent: 'Bắt đầu so khớp',
  library_search_consent: 'Bắt đầu tra cứu thư viện',
};
export function Settings() {
  const [search, setSearch] = useSearchParams();
  const { user, refresh } = useAuth();
  const requestedTab = search.get('tab') || 'connection';
  const tab = user?.must_change_password
    ? 'account'
    : requestedTab === 'openai'
      ? 'connection'
      : requestedTab;
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testError, setTestError] = useState('');
  const [changing, setChanging] = useState(false);
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
    enabled: !user?.must_change_password,
  });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ version: string; database: string; storage: string }>('/health'),
    enabled: tab === 'system',
  });
  const logs = useQuery({
    queryKey: ['audit'],
    queryFn: () => api<Entity[]>('/audit-logs'),
    enabled: tab === 'system' && user?.role === 'admin',
  });
  return (
    <>
      <PageHeader
        eyebrow="CẤU HÌNH ỨNG DỤNG"
        title="Cài đặt"
        description="Quản lý kết nối, cấu hình xử lý và bảo mật tài khoản."
      />
      {user?.must_change_password && (
        <div className="notice danger">
          <LockKeyhole size={19} />
          Bạn cần đổi mật khẩu lần đầu trước khi tiếp tục sử dụng hệ thống. Mật khẩu mới cần ít nhất 10 ký tự.
        </div>
      )}
      <div className="settings-grid">
        <nav className="settings-nav">
          {[
            ['connection', 'Kết nối so khớp', KeyRound],
            ['image', 'Xử lý ảnh', Settings2],
            ['algorithms', 'Quy trình so khớp', Cpu],
            ['account', 'Tài khoản & mật khẩu', ShieldCheck],
            ['system', 'Quản lý hệ thống', Settings2],
          ].map(([key, title, Icon]) => {
            const I = Icon as typeof Cpu;
            return (
              <button
                key={String(key)}
                disabled={user?.must_change_password && key !== 'account'}
                className={tab === key ? 'active' : ''}
                onClick={() => setSearch({ tab: String(key) })}
              >
                <I size={18} />
                {title as string}
              </button>
            );
          })}
        </nav>
        <section className="panel settings-content">
          {tab === 'connection' && (
            <>
              <div className="settings-title">
                <div className="ai-mark">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2>Kết nối dịch vụ so khớp</h2>
                  <p>Khóa API được đọc từ cấu hình riêng của backend.</p>
                </div>
              </div>
              {status.isPending ? (
                <Loading />
              ) : status.error ? (
                <ErrorBox error={status.error} />
              ) : (
                <>
                  <div className="setting-row">
                    <div>
                      <strong>Trạng thái khóa API</strong>
                      <p>Giá trị khóa không được trả về trình duyệt.</p>
                    </div>
                    <span className={`badge ${status.data.is_configured ? 'completed' : 'draft'}`}>
                      {status.data.is_configured ? 'Đã cấu hình' : 'Chưa cấu hình'}
                    </span>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Giới hạn một phiên</strong>
                      <p>Mỗi ảnh tham chiếu tương ứng một yêu cầu so sánh.</p>
                    </div>
                    <span>Tối đa {status.data.max_candidates} ảnh K</span>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Thời gian chờ mỗi cặp</strong>
                    </div>
                    <span>{status.data.timeout_seconds} giây</span>
                  </div>
                  <div className="notice subtle">
                    <CircleHelp size={18} />
                    <span>
                      Quản trị viên cấu hình kết nối tại backend/.env rồi khởi động lại backend. Bấm Kiểm tra
                      kết nối để đọc lại trạng thái.
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <Button
                      disabled={testing}
                      onClick={async () => {
                        setTesting(true);
                        setTestMessage('');
                        setTestError('');
                        try {
                          await post('/settings/openai/test', {});
                          const message =
                            'Kết nối dịch vụ đã được xác nhận. Chưa kiểm tra cặp ảnh hoặc hạn mức xử lý.';
                          setTestMessage(message);
                          toast.success(message);
                        } catch (e) {
                          setTestError((e as Error).message);
                        } finally {
                          setTesting(false);
                        }
                      }}
                    >
                      {testing ? <LoaderCircle size={16} className="spin" /> : <KeyRound size={16} />}Kiểm tra
                      kết nối
                    </Button>
                  )}
                  {testMessage && (
                    <div className="notice success">
                      <Check size={18} />
                      {testMessage}
                    </div>
                  )}
                  {testError && <ErrorBox error={new Error(testError)} />}
                </>
              )}
            </>
          )}
          {tab === 'image' && (
            <>
              <h2>Cấu hình xử lý ảnh</h2>
              <p>
                Cấu hình xử lý ảnh theo tổ chức được chỉnh trong Xưởng xử lý ảnh. Các giới hạn hệ thống được
                đọc từ backend/.env.
              </p>
              <dl className="metadata-list">
                {[
                  ['Dung lượng tải lên', `${status.data?.max_upload_mb ?? '—'} MB`],
                  ['Số trang / khung tối đa', status.data?.max_pages ?? '—'],
                  ['Cạnh ảnh tối đa để so khớp', `${status.data?.max_image_side ?? '—'} px`],
                  ['Phiên bản quy trình', status.data?.pipeline_version ?? '—'],
                  ['Đầu ra lưu trữ', 'PNG riêng, giữ nguyên tệp gốc'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {tab === 'algorithms' && (
            <>
              <h2>Quy trình so khớp con dấu</h2>
              <p>Chuẩn bị ảnh, đối chiếu với mẫu tham chiếu và lưu kết quả theo từng phiên.</p>
              <div className="algorithm-cards">
                {[
                  ['Chuẩn bị ảnh', 'Chọn trang, khoanh vùng dấu và kiểm tra chất lượng ảnh.'],
                  ['So khớp hình ảnh', 'Nhận điểm tương đồng và xếp hạng mẫu tham chiếu.'],
                  ['Lưu kết quả', 'Lưu ảnh đối chiếu, điểm và thời gian để xem lại hoặc xuất báo cáo.'],
                ].map(([name, description]) => (
                  <div key={String(name)}>
                    <Cpu size={24} />
                    <h3>{name as string}</h3>
                    <p>{description as string}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'account' && (
            <>
              <h2>Tài khoản & đổi mật khẩu</h2>
              <p>
                Đang đăng nhập với tài khoản <strong>{user?.username}</strong>. Đổi mật khẩu sẽ thu hồi các
                phiên khác.
              </p>
              <form
                className="password-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (f.get('new_password') !== f.get('confirm')) {
                    toast.error('Xác nhận mật khẩu chưa khớp.');
                    return;
                  }
                  setChanging(true);
                  const el = e.currentTarget;
                  try {
                    await post('/auth/change-password', {
                      old_password: f.get('old_password'),
                      new_password: f.get('new_password'),
                    });
                    await refresh();
                    el.reset();
                    toast.success('Đã đổi mật khẩu. Bạn có thể tiếp tục sử dụng hệ thống.');
                  } catch (err) {
                    toast.error((err as Error).message);
                  } finally {
                    setChanging(false);
                  }
                }}
              >
                <label>
                  Mật khẩu hiện tại
                  <input
                    type="password"
                    autoComplete="current-password"
                    name="old_password"
                    required
                    maxLength={256}
                  />
                </label>
                <label>
                  Mật khẩu mới (ít nhất 10 ký tự)
                  <input
                    type="password"
                    autoComplete="new-password"
                    name="new_password"
                    required
                    minLength={10}
                    maxLength={256}
                  />
                </label>
                <label>
                  Nhập lại mật khẩu mới
                  <input
                    type="password"
                    autoComplete="new-password"
                    name="confirm"
                    required
                    minLength={10}
                    maxLength={256}
                  />
                </label>
                <Button type="submit" disabled={changing}>
                  <LockKeyhole size={16} />
                  Đổi mật khẩu
                </Button>
              </form>
            </>
          )}
          {tab === 'system' && (
            <>
              <h2>Trạng thái hệ thống</h2>
              {health.isPending ? (
                <Loading />
              ) : health.error ? (
                <ErrorBox error={health.error} />
              ) : (
                <dl className="metadata-list">
                  <div>
                    <dt>Backend</dt>
                    <dd>{health.data.version}</dd>
                  </div>
                  <div>
                    <dt>PostgreSQL</dt>
                    <dd>{health.data.database === 'ok' ? 'Hoạt động' : 'Không sẵn sàng'}</dd>
                  </div>
                  <div>
                    <dt>Kho tệp</dt>
                    <dd>{health.data.storage === 'ok' ? 'Hoạt động' : 'Không sẵn sàng'}</dd>
                  </div>
                </dl>
              )}
              {user?.role === 'admin' && (
                <>
                  <h3>Nhật ký thao tác gần đây</h3>
                  <p className="muted">
                    Tối đa 100 thao tác. Nhật ký không chứa khóa API, mật khẩu hoặc nội dung ảnh.
                  </p>
                  {logs.isPending ? (
                    <Loading />
                  ) : logs.error ? (
                    <ErrorBox error={logs.error} />
                  ) : (
                    <div className="audit-list">
                      {logs.data?.map((l) => (
                        <div key={l.id}>
                          <code>{auditActionLabels[String(l.action)] || String(l.action)}</code>
                          <span>
                            {String(l.entity_type)} · {String(l.entity_id || '').slice(0, 8)}
                          </span>
                          <small>{dateTime(l.created_at)}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
