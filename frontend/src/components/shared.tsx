import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, FileUp, FolderOpen, LoaderCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { upload } from '../lib/api';
import type { Asset } from '../types';

export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Đang tải dữ liệu…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="notice danger" role="alert">
      <AlertTriangle size={18} />
      <span>{error instanceof Error ? error.message : 'Không tải được dữ liệu.'}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FolderOpen size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="header-actions">{children}</div>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const heading = useRef(`dialog-${Math.random().toString(36).slice(2)}`);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading.current}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="modal-head">
          <h2 id={heading.current}>{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">
            <X size={19} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Confirm({
  title,
  onConfirm,
  onClose,
  dialogTitle = 'Xác nhận lưu trữ',
  description,
  actionLabel = 'Lưu trữ',
  successMessage = 'Đã lưu trữ dữ liệu.',
}: {
  title: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  dialogTitle?: string;
  description?: string;
  actionLabel?: string;
  successMessage?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={dialogTitle} onClose={() => !busy && onClose()}>
      <p>{description || `Lưu trữ “${title}”? Dữ liệu liên kết và lịch sử vẫn được giữ lại.`}</p>
      <div className="form-actions">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Hủy
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
              toast.success(successMessage);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </Modal>
  );
}
export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} bản ghi · Trang {page}/{Math.max(1, Math.ceil(total / size))}
      </span>
      <div>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Trước
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * size >= total}
          onClick={() => onChange(page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
export function UploadBox({
  onUploaded,
  kind = 'document',
  multiple = false,
  accept = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.webp',
  label = 'Tải tài liệu',
  description = 'PDF, PNG, JPG, TIFF hoặc WEBP',
  onBusyChange,
  disabled = false,
}: {
  onUploaded: (a: Asset) => void | Promise<void>;
  kind?: string;
  multiple?: boolean;
  accept?: string;
  label?: string;
  description?: string;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  async function files(list: FileList | null) {
    if (!list?.length || busy || disabled) return;
    setBusy(true);
    onBusyChange?.(true);
    try {
      for (const file of Array.from(list).slice(0, multiple ? undefined : 1)) {
        await onUploaded(await upload(file, kind));
      }
      toast.success('Đã tải tệp vào kho lưu trữ.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (ref.current) ref.current.value = '';
    }
  }
  return (
    <div
      className={`upload-box ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!busy && !disabled) void files(e.dataTransfer.files);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        aria-label={label}
        multiple={multiple}
        disabled={busy || disabled}
        hidden
        onChange={(e) => void files(e.target.files)}
      />
      <div className="upload-icon">{busy ? <LoaderCircle className="spin" /> : <FileUp />}</div>
      <strong>{busy ? 'Đang kiểm tra và tải tệp…' : 'Kéo thả tài liệu vào đây'}</strong>
      <p>{description}</p>
      <Button variant="outline" disabled={busy || disabled} onClick={() => ref.current?.click()}>
        Chọn tệp từ máy
      </Button>
    </div>
  );
}
export const Disclaimer = () => (
  <div className="notice">
    <AlertTriangle size={18} />
    <span>
      Không phải kết luận giám định pháp y. Điểm AI chưa được hiệu chuẩn, không phải xác suất cùng dụng cụ và
      không xác thực tài liệu thật/giả.
    </span>
  </div>
);
