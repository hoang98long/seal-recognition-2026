import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../../lib/api';
import { dateTime, statusLabel } from '../../lib/utils';
import type { Analysis, Page } from '../../types';
import { Button } from '../ui/button';
import { ErrorBox, Loading } from '../shared';

export function Notifications({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Page<Analysis>>('/analyses?page_size=5'),
    enabled: open && !disabled,
    staleTime: 0,
  });
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div
      ref={root}
      className="notification-root"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Thông báo phiên phân tích"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} />
      </Button>
      {open && (
        <div className="notification-popover">
          <h3>Hoạt động phân tích gần đây</h3>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorBox error={query.error} />
          ) : query.data.items.length ? (
            query.data.items.map((item) => (
              <Link key={item.id} to={`/compare/${item.id}/results`} onClick={() => setOpen(false)}>
                <strong>{item.title}</strong>
                <span className={`badge ${item.status}`}>{statusLabel[item.status]}</span>
                <small>{dateTime(item.created_at)}</small>
              </Link>
            ))
          ) : (
            <p>Chưa có phiên phân tích. Các trạng thái mới sẽ hiển thị khi mở danh sách này.</p>
          )}
          <Link to="/history" onClick={() => setOpen(false)}>
            Mở lịch sử phân tích
          </Link>
        </div>
      )}
    </div>
  );
}
