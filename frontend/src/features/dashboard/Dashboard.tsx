import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText, FolderUp, Layers, ScanLine, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { dateTime, statusLabel } from '../../lib/utils';
import type { Analysis, OpenAIStatus } from '../../types';
import { Empty, ErrorBox, Loading, PageHeader } from '../../components/shared';
import { Button } from '../../components/ui/button';
export function Dashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api<{
        documents: number;
        designs: number;
        impressions: number;
        organizations: number;
        analyses: number;
        recent: Analysis[];
        activity: { date: string; count: number }[];
      }>('/dashboard/summary'),
  });
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorBox error={query.error} />;
  const data = query.data;
  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN PHÂN TÍCH"
        title="Tổng quan hệ thống"
        description="Quản lý tài liệu, chuẩn bị ảnh và đối chiếu con dấu trong một quy trình."
      >
        <Button variant="outline" asChild>
          <Link to="/compare/document-stamp">
            <FileText size={17} />
            Văn bản & ảnh dấu
          </Link>
        </Button>
        <Button asChild>
          <Link to="/compare/library">
            <ScanLine size={17} />
            Tra cứu Top 3 tổ chức
          </Link>
        </Button>
      </PageHeader>
      <div className="hero-panel">
        <div>
          <span className="hero-badge">
            <Sparkles size={14} /> SO KHỚP HÌNH ẢNH CON DẤU
          </span>
          <h2>
            Từ hình ảnh đến
            <br />
            kết quả đối chiếu trực quan.
          </h2>
          <p>
            Chọn vùng con dấu, chuẩn bị ảnh và kiểm tra mức tương đồng.
            <br />
            Mọi phiên xử lý đều lưu lại nguồn ảnh và thông số đã dùng.
          </p>
          <Button asChild>
            <Link to="/compare/library">
              Tra cứu con dấu trong thư viện
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <div className="hero-graphic" aria-hidden="true">
          <div className="scan-grid">
            <ScanLine size={110} />
          </div>
          <span className="scan-label">QUAN SÁT · SO SÁNH · LƯU VẾT</span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          [FileText, 'Tài liệu nguồn', data.documents],
          [BookOpen, 'Mẫu thiết kế', data.designs],
          [Layers, 'Ảnh dấu tham chiếu', data.impressions],
          [ScanLine, 'Phiên phân tích', data.analyses],
        ].map(([Icon, label, n]) => {
          const I = Icon as typeof FileText;
          return (
            <div className="stat-card" key={String(label)}>
              <div className="stat-top">
                <span>{String(label)}</span>
                <I size={20} />
              </div>
              <strong>{String(n)}</strong>
              <small>Dữ liệu đang lưu trong hệ thống</small>
            </div>
          );
        })}
      </div>
      <div className="quick-grid">
        {[
          ['/organizations', FolderUp, 'Tổ chức & thư viện dấu', 'Chọn đơn vị, tải tài liệu và tách dấu'],
          [
            '/compare/library',
            ScanLine,
            'Tra cứu Top 3 tổ chức',
            'Đối chiếu con dấu với thư viện trong CSDL',
          ],
          [
            '/seal-library/add',
            BookOpen,
            'Thêm con dấu tổ chức',
            'Chọn tổ chức và tải ảnh trong một màn hình',
          ],
        ].map(([path, Icon, title, sub]) => {
          const I = Icon as typeof FileText;
          return (
            <Link className="quick-card" key={String(path)} to={path as string}>
              <I size={25} />
              <div>
                <strong>{title as string}</strong>
                <small>{sub as string}</small>
              </div>
              <ArrowRight size={18} />
            </Link>
          );
        })}
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Phiên phân tích gần đây</h2>
            <Link to="/history">
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>
          {data.recent.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tên phiên</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link to={`/compare/${x.id}/results`}>{x.title}</Link>
                    </td>
                    <td>{dateTime(x.created_at)}</td>
                    <td>
                      <span className={`badge ${x.status}`}>{statusLabel[x.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty
              title="Chưa có phiên phân tích"
              description="Sau khi chuẩn bị ảnh Q và K, bạn có thể bắt đầu đối chiếu tại đây."
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Trạng thái kết nối</h2>
            <span className={`status-dot ${status.data?.is_configured ? 'ok' : ''}`} />
          </div>
          <div className="connection-card">
            <div className="ai-mark">
              <Sparkles size={24} />
            </div>
            <h3>Dịch vụ so khớp con dấu</h3>
            <span className={`badge ${status.data?.is_configured ? 'completed' : 'draft'}`}>
              {status.data?.is_configured ? 'Đã cấu hình kết nối' : 'Chưa cấu hình kết nối'}
            </span>
            <p>Chuẩn bị ảnh, bắt đầu so khớp và xem kết quả trong cùng một quy trình.</p>
            <Button variant="outline" asChild>
              <Link to="/settings">
                Cài đặt kết nối <ArrowRight size={15} />
              </Link>
            </Button>
          </div>
        </section>
      </div>
      {data.activity.length > 0 && (
        <section className="panel activity">
          <div className="panel-heading">
            <h2>Hoạt động phân tích</h2>
            <span>Ngày có phát sinh phiên · UTC</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.activity}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Số phiên" fill="#0891b2" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </>
  );
}
