import { useCallback, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle, Pencil, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, previewUrl } from '../../lib/api';
import { assetLabel } from '../../lib/utils';
import type { Asset, Impression, Page } from '../../types';
import { Button } from '../../components/ui/button';
import { Confirm, ErrorBox, Modal, UploadBox } from '../../components/shared';
import { StampPreparation, type PreparedStamp } from '../document-demo/StampPreparation';
import '../document-demo/demo.css';

export function ReferenceActions({
  impression,
  onChanged,
}: {
  impression: Impression;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function refresh() {
    onChanged?.();
    await Promise.all(
      [
        'library',
        'library-select',
        'reference-options',
        'intake-designs',
        'design-options',
        'design-usage',
        'impressions-related',
        'search-inventory',
        'organization-documents',
        'dashboard',
      ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
    );
  }
  return (
    <>
      <div className="reference-actions">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil size={15} />
          Chỉnh sửa
        </Button>
        <Button size="sm" variant="ghost" className="reference-delete" onClick={() => setDeleting(true)}>
          <Trash2 size={15} />
          Xóa
        </Button>
      </div>
      {editing && (
        <EditReference impression={impression} onClose={() => setEditing(false)} onSaved={refresh} />
      )}
      {deleting && (
        <Confirm
          title={impression.design_name}
          dialogTitle="Xóa con dấu khỏi thư viện?"
          description={`Xóa “${impression.design_name}” khỏi ${impression.organization_name}? Con dấu này sẽ không còn xuất hiện trong thư viện hoặc tra cứu mới. Ảnh và kết quả đối chiếu trước đó vẫn được giữ lại.`}
          actionLabel="Xóa con dấu"
          successMessage="Đã xóa con dấu khỏi thư viện."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api(`/seal-impressions/${impression.id}`, { method: 'DELETE' });
            await refresh();
          }}
        />
      )}
    </>
  );
}

function EditReference({
  impression,
  onClose,
  onSaved,
}: {
  impression: Impression;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const formId = useId();
  const [name, setName] = useState(impression.design_name);
  const [note, setNote] = useState(impression.note || '');
  const [replacing, setReplacing] = useState(false);
  const [source, setSource] = useState<Asset | null>(null);
  const [initial, setInitial] = useState<PreparedStamp | null>(null);
  const [prepared, setPrepared] = useState<PreparedStamp | null>(null);
  const [version, setVersion] = useState(0);
  const [existing, setExisting] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const busy = uploading || preparing || loading || saving;
  const assets = useQuery({
    queryKey: ['processed-assets'],
    queryFn: () => api<Page<Asset>>('/assets?kind=processed_stamp&page_size=100'),
    enabled: replacing,
  });
  const onPrepared = useCallback((value: PreparedStamp | null) => {
    setPrepared(value);
    setError('');
  }, []);
  function chooseSource(asset: Asset, ready: PreparedStamp | null = null) {
    setSource(asset);
    setPrepared(ready);
    setInitial(ready);
    setError('');
    setVersion((v) => v + 1);
  }
  async function selectExisting(id: string) {
    setExisting(id);
    if (!id) {
      setSource(null);
      setPrepared(null);
      return;
    }
    setLoading(true);
    setPrepared(null);
    setError('');
    try {
      const ready = await api<PreparedStamp | null>(`/preprocessing/by-output/${id}`);
      if (!ready) throw new Error('Ảnh chưa có thông tin xử lý. Hãy tải ảnh nguồn và khoanh vùng dấu.');
      chooseSource(await api<Asset>(`/assets/${ready.run.source_asset_id}`), ready);
    } catch (e) {
      setSource(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    if (busy || submitting.current || !name.trim() || (replacing && !prepared)) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await api(`/reference-intake/${impression.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          note: note.trim() || null,
          ...(replacing && prepared ? { image_asset_id: prepared.asset.id } : {}),
        }),
      });
      await onSaved();
      toast.success('Đã cập nhật con dấu.');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <Modal title="Chỉnh sửa con dấu" className="reference-edit-modal" onClose={() => !busy && onClose()}>
      <p className="muted">{impression.organization_name}</p>
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Tên mẫu dấu
          <input
            required
            maxLength={500}
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted reference-name-hint">
          Tên dùng chung cho các ảnh thuộc cùng mẫu dấu. Ghi chú và ảnh thay thế chỉ áp dụng cho con dấu này.
        </p>
        <label>
          Ghi chú con dấu
          <textarea
            maxLength={5000}
            value={note}
            disabled={saving}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </form>
      <div className={`reference-preview ${replacing ? 'is-replacing' : ''}`}>
        <figure>
          <figcaption>Ảnh hiện tại</figcaption>
          <img src={previewUrl(impression.image_asset_id)} alt="Con dấu hiện tại" />
        </figure>
        {replacing && (
          <figure>
            <figcaption>Ảnh thay thế</figcaption>
            {prepared ? (
              <img src={previewUrl(prepared.asset.id)} alt="Con dấu thay thế đã chuẩn bị" />
            ) : (
              <p>Chọn ảnh và xác nhận vùng dấu bên dưới.</p>
            )}
          </figure>
        )}
      </div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setReplacing(!replacing);
          setSource(null);
          setPrepared(null);
          setInitial(null);
          setExisting('');
          setError('');
        }}
      >
        <ImagePlus size={16} />
        {replacing ? 'Giữ ảnh hiện tại' : 'Thay ảnh con dấu'}
      </Button>
      {replacing && (
        <div className="reference-replacement">
          <p>Tải PDF/ảnh mới hoặc dùng ảnh đã xử lý, khoanh vùng con dấu rồi xác nhận trước khi lưu.</p>
          <UploadBox
            label="Tải ảnh thay thế con dấu"
            disabled={busy}
            onBusyChange={setUploading}
            onUploaded={(asset) => {
              setExisting('');
              chooseSource(asset);
            }}
          />
          {!!assets.data?.items.length && (
            <label>
              Hoặc chọn ảnh đã xử lý
              <select value={existing} disabled={busy} onChange={(e) => void selectExisting(e.target.value)}>
                <option value="">— Chọn ảnh —</option>
                {assets.data.items
                  .filter((a) => a.id !== impression.image_asset_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {assetLabel(a)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {assets.error && <ErrorBox error={assets.error} />}
          {loading && <p role="status">Đang mở ảnh đã xử lý…</p>}
          {source && !loading && (
            <StampPreparation
              key={`${source.id}-${version}`}
              asset={source}
              role="K"
              initial={initial}
              organizationId={impression.organization_id}
              onPrepared={onPrepared}
              onBusyChange={setPreparing}
            />
          )}
          <p className="muted">
            Ảnh thay thế được lưu ở mức “Chỉ tham chiếu” để kiểm tra lại chất lượng. Các phiên đối chiếu cũ
            tiếp tục dùng ảnh cũ.
          </p>
        </div>
      )}
      {error && <ErrorBox error={new Error(error)} />}
      <div className="form-actions">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" form={formId} disabled={busy || !name.trim() || (replacing && !prepared)}>
          {saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}Lưu thay đổi
        </Button>
      </div>
    </Modal>
  );
}
