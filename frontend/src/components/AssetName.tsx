import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { assetLabel } from '../lib/utils';
import type { Asset } from '../types';
import { Modal } from './shared';
import { Button } from './ui/button';

export function AssetName({ asset, editable = true }: { asset: Asset; editable?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(assetLabel(asset));
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState(assetLabel(asset));
  useEffect(() => setDisplay(assetLabel(asset)), [asset.id, asset.display_name, asset.original_filename]);
  return (
    <div className="asset-name">
      <strong>{display}</strong>
      {editable && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Đổi tên ảnh đã xử lý"
          onClick={() => {
            setName(display);
            setOpen(true);
          }}
        >
          <Pencil size={15} />
        </Button>
      )}
      {open && (
        <Modal
          title="Đổi tên ảnh đã xử lý"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const updated = await api<Asset>(`/assets/${asset.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ display_name: name.trim() }),
                });
                setDisplay(assetLabel(updated));
                await Promise.all(
                  [['asset', asset.id], ['processed-assets'], ['assets-editor'], ['library']].map(
                    (queryKey) => qc.invalidateQueries({ queryKey }),
                  ),
                );
                setOpen(false);
                toast.success('Đã đổi tên hiển thị.');
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tên hiển thị
              <input
                autoFocus
                required
                maxLength={250}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <p className="muted">Tên mới giúp nhận diện ảnh, không thay đổi nội dung tệp hoặc kết quả cũ.</p>
            <Button type="submit" disabled={busy || !name.trim()}>
              Lưu tên
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
