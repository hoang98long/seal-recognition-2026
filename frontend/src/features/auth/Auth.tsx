import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScanLine, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, post } from '../../lib/api';
import type { User } from '../../types';
import { Button } from '../../components/ui/button';
import { Loading } from '../../components/shared';

const AuthContext = createContext<{ user: User | null; refresh: () => Promise<unknown> }>({
  user: null,
  refresh: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/auth/me'),
    retry: false,
    staleTime: 60000,
  });
  return (
    <AuthContext.Provider value={{ user: query.data || null, refresh: query.refetch }}>
      {query.isPending ? <Loading /> : children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
const loginSchema = z.object({
  username: z.string().min(1, 'Nhập tên đăng nhập.'),
  password: z.string().min(1, 'Nhập mật khẩu.'),
  remember: z.boolean(),
});
export function LoginPage() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '', remember: false },
  });
  if (user)
    return <Navigate to={user.must_change_password ? '/settings?tab=account' : '/dashboard'} replace />;
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="brand">
          <ScanLine size={32} />
          <span>
            SEAL<span className="brand-light"> / </span>FORENSICS
          </span>
        </div>
        <div>
          <p className="eyebrow">KHÔNG GIAN PHÂN TÍCH NỘI BỘ</p>
          <h1>
            Mỗi chi tiết.
            <br />
            Một cơ sở
            <br />
            <span>đối chiếu.</span>
          </h1>
          <p className="login-lead">
            Phân tích và đối chiếu hình ảnh con dấu.
            <br />
            Quy trình rõ ràng. Dữ liệu có thể truy vết.
          </p>
          <div className="seal-art" aria-hidden="true">
            <div>
              <ScanLine size={74} />
              <span>QUAN SÁT · ĐỐI CHIẾU</span>
            </div>
          </div>
        </div>
        <small>
          <ShieldCheck size={16} /> Tài liệu · Thư viện con dấu · Lịch sử đối chiếu
        </small>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <div className="login-mark">
            <ScanLine size={28} />
          </div>
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập hệ thống</h2>
          <p>HỆ THỐNG GIÁM ĐỊNH CON DẤU</p>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await post('/auth/login', values);
                qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
                await refresh();
                nav('/dashboard');
              } catch (e) {
                toast.error((e as Error).message);
              }
            })}
          >
            <label>
              Tên đăng nhập
              <input
                autoComplete="username"
                placeholder="Nhập tên đăng nhập"
                {...form.register('username')}
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                {...form.register('password')}
              />
            </label>
            <label className="check">
              <input type="checkbox" {...form.register('remember')} /> Duy trì phiên đăng nhập trong 7 ngày
            </label>
            {Object.values(form.formState.errors).map((e, i) => (
              <p className="field-error" key={i}>
                {e.message}
              </p>
            ))}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <div className="dev-note">
            Môi trường phát triển: <strong>admin / admin</strong>
            <br />
            Bạn cần đổi mật khẩu ở lần đăng nhập đầu.
          </div>
          <p className="login-foot">
            Kết quả phân tích hỗ trợ quan sát thị giác.
            <br />
            Không thay thế kết luận giám định pháp y.
          </p>
        </div>
      </div>
    </div>
  );
}
