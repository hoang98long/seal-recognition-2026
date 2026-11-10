import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  ChevronRight,
  FileText,
  Files,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScanLine,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../features/auth/Auth';
import { api, post } from '../../lib/api';
import type { OpenAIStatus } from '../../types';
import { Button } from '../ui/button';
import { Loading } from '../shared';
import { Notifications } from './Notifications';

const links = [
  ['/dashboard', 'Tổng quan', LayoutDashboard],
  ['/organizations', 'Tổ chức & thư viện dấu', Building2],
  ['/compare/library', 'Tra cứu Top 3 tổ chức', ScanLine],
  ['/documents', 'Tài liệu nguồn', FileText],
  ['/preprocessing', 'Xưởng xử lý ảnh', FlaskConical],
  ['/compare/document-stamp', 'Văn bản & ảnh dấu', Files],
  ['/compare/new', 'So khớp nâng cao', ScanLine],
  ['/seal-library', 'Thư viện mẫu dấu', BookOpen],
  ['/history', 'Lịch sử phân tích', History],
  ['/reports', 'Báo cáo', FileText],
  ['/settings', 'Cài đặt', Settings],
] as const;
export function Layout() {
  const { user, refresh } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('theme') === 'dark');
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
    enabled: !!user && !user.must_change_password,
    staleTime: 30000,
  });
  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password && loc.pathname !== '/settings')
    return <Navigate to="/settings?tab=account" replace />;
  const current =
    links.find((x) => loc.pathname.startsWith(x[0]))?.[1] ||
    (loc.pathname.startsWith('/compare/') ? 'Kết quả đối chiếu' : 'Người dùng');
  return (
    <div className={`app-shell ${dark ? 'dark' : ''}`}>
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <NavLink to="/dashboard" className="brand">
          <div className="brand-symbol">
            <ScanLine size={26} />
          </div>
          <span>
            SEAL<span className="brand-light"> / </span>FORENSICS<small>HỆ THỐNG GIÁM ĐỊNH CON DẤU</small>
          </span>
        </NavLink>
        <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${path === '/seal-library' ? 'nav-divider' : ''}`
              }
            >
              <Icon size={19} />
              {label}
              {path === '/compare/new' && <span className="nav-tag">AI</span>}
            </NavLink>
          ))}
          {user.role === 'admin' && (
            <NavLink to="/users" className="nav-link">
              <Users size={19} /> Người dùng
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-label">
            <ShieldCheck size={18} />
            <span>
              Môi trường nội bộ<small>Chia sẻ ảnh theo xác nhận</small>
            </span>
          </div>
          <div className="sidebar-version">
            PHIÊN BẢN 1.0 <span>● TRỰC TUYẾN NỘI BỘ</span>
          </div>
        </div>
      </aside>
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Mở menu"
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span>Không gian làm việc</span>
            <ChevronRight size={15} />
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <NavLink to="/settings" className={`connection ${status.data?.is_configured ? 'connected' : ''}`}>
              <i />
              {status.data?.is_configured ? 'OpenAI đã cấu hình' : 'Chưa cấu hình OpenAI'}
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chuyển giao diện sáng tối"
              onClick={() => {
                localStorage.setItem('theme', dark ? 'light' : 'dark');
                setDark(!dark);
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Notifications disabled={user.must_change_password} />
            <div className="user-chip">
              <span>{user.full_name.slice(0, 1)}</span>
              <div>
                <strong>{user.full_name}</strong>
                <small>
                  {user.role === 'admin'
                    ? 'Quản trị viên'
                    : user.role === 'viewer'
                      ? 'Chỉ xem'
                      : 'Phân tích viên'}
                </small>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Đăng xuất"
              onClick={async () => {
                try {
                  await post('/auth/logout', {});
                  localStorage.removeItem('seal-Q');
                  localStorage.removeItem('seal-K');
                  qc.clear();
                  await refresh();
                  nav('/login');
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <main className="page-content">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>HỆ THỐNG GIÁM ĐỊNH CON DẤU</span>
          <span>Phân tích thị giác hỗ trợ chuyên viên · V1.0</span>
        </footer>
      </div>
    </div>
  );
}
