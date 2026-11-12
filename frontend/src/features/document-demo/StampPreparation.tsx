import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle, RotateCcw, Save, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl, request } from '../../lib/api';
import { defaultParameters, preprocessingPreset } from '../../lib/preprocessing';
import type { Asset, Parameters, ROI, Run } from '../../types';
import { RegionCanvas } from '../../components/image-editor/RegionCanvas';
import { ErrorBox, Loading } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { AssetName } from '../../components/AssetName';
import { assetLabel } from '../../lib/utils';
import type { Profile } from '../../types';

export interface PreparedStamp {
  asset: Asset;
  run: Run;
}

export function StampPreparation({
  asset,
  role,
  initial,
  onPrepared,
  onBusyChange,
  organizationId,
}: {
  asset: Asset;
  role: 'Q' | 'K';
  initial: PreparedStamp | null;
  onPrepared: (value: PreparedStamp | null) => void;
  onBusyChange: (busy: boolean) => void;
  organizationId?: string;
}) {
  const [page, setPage] = useState(initial?.run.source_page || 1);
  const [roi, setRoi] = useState<ROI | null>(initial?.run.roi_geometry || null);
  const [parameters, setParameters] = useState<Parameters>(
    initial?.run.parameters || { ...defaultParameters },
  );
  const [allowFull, setAllowFull] = useState(!!initial?.asset.source_metadata.whole_source_confirmed);
  const [saved, setSaved] = useState<PreparedStamp | null>(initial);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState('');
  const profiles = useQuery({
    queryKey: ['profiles', organizationId],
    queryFn: () => api<Profile[]>(`/preprocessing/profiles?organization_id=${organizationId}`),
    enabled: !!organizationId,
  });
  const suggestedPages = useRef(new Set(initial ? [initial.run.source_page] : []));
  const source = useQuery({
    queryKey: ['page-size', asset.id, page],
    queryFn: () =>
      api<{ width: number; height: number; roi: ROI | null }>(
        `/preprocessing/suggest-roi/${asset.id}?page=${page}`,
      ),
  });
  const wholePage =
    !!roi &&
    !!source.data &&
    roi.x === 0 &&
    roi.y === 0 &&
    roi.width === source.data.width &&
    roi.height === source.data.height;
  useEffect(() => {
    if (!source.data || suggestedPages.current.has(page)) return;
    suggestedPages.current.add(page);
    if (source.data.roi) setRoi(source.data.roi);
  }, [source.data, page]);
  const validRoi =
    !!roi &&
    !!source.data &&
    roi.x >= 0 &&
    roi.y >= 0 &&
    roi.width >= 2 &&
    roi.height >= 2 &&
    roi.x + roi.width <= source.data.width &&
    roi.y + roi.height <= source.data.height;

  function invalidate() {
    setSaved(null);
    setError('');
    onPrepared(null);
  }
  function changeRoi(next: ROI | null) {
    setRoi(next);
    setAllowFull(false);
    invalidate();
  }
  function changeParameters(next: Parameters) {
    setProfile('');
    setParameters(next);
    invalidate();
  }
  function choosePage(next: number) {
    setPage(next);
    setRoi(null);
    setParameters({ ...defaultParameters });
    suggestedPages.current.delete(next);
    setAllowFull(false);
    invalidate();
  }
  useEffect(() => {
    if (!validRoi || !roi) {
      setPreview('');
      setPreviewBusy(false);
      return;
    }
    const controller = new AbortController();
    let url = '';
    setPreview('');
    const timer = setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const response = await request('/preprocessing/preview', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({ source_asset_id: asset.id, page, roi, parameters }),
        });
        const blob = await response.blob();
        if (!controller.signal.aborted) {
          url = URL.createObjectURL(blob);
          setPreview(url);
          setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setPreviewBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.id, page, roi, parameters, validRoi]);

  async function save() {
    if (!validRoi || (wholePage && !allowFull) || saving) return;
    setSaving(true);
    onBusyChange(true);
    setError('');
    try {
      const result = await post<PreparedStamp>('/preprocessing/apply', {
        source_asset_id: asset.id,
        page,
        roi,
        parameters,
        roi_confirmed: true,
        allow_full_page: allowFull,
        organization_id: organizationId || null,
        profile_id: profile || null,
      });
      setSaved(result);
      onPrepared(result);
      toast.success(`Đã lưu ảnh ${role} sẵn sàng so khớp.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }
  const numberControl = (
    key: 'rotation' | 'brightness' | 'contrast' | 'gamma' | 'saturation' | 'sharpen' | 'denoise',
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="demo-number" key={key}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={parameters[key]}
        disabled={saving}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (Number.isFinite(value) && value >= min && value <= max)
            changeParameters({ ...parameters, [key]: value });
        }}
      />
    </label>
  );
  return (
    <section className="panel demo-preparation" aria-label={`Chuẩn bị ảnh ${role}`}>
      <div className="panel-heading">
        <h2>
          <span className={`demo-role role-${role}`}>{role}</span>
          {role === 'Q' ? 'Dấu trong văn bản' : 'Ảnh dấu đối chiếu'}
        </h2>
        {saved && (
          <span className="badge completed">
            <CheckCircle2 size={12} />
            Đã lưu {role}
          </span>
        )}
      </div>
      {asset.page_count > 1 && (
        <div className="page-filmstrip" aria-label={`Chọn nhanh trang ${role}`}>
          {Array.from(
            { length: Math.min(6, asset.page_count - Math.floor((page - 1) / 6) * 6) },
            (_, i) => Math.floor((page - 1) / 6) * 6 + i + 1,
          ).map((p) => (
            <button
              key={p}
              className={p === page ? 'active' : ''}
              disabled={saving}
              aria-label={`Xem trang ${p} ảnh ${role}`}
              onClick={() => choosePage(p)}
            >
              <img src={previewUrl(asset.id, p, true)} alt="" loading="lazy" />
              <span>Trang {p}</span>
            </button>
          ))}
          <button disabled={saving} onClick={() => choosePage(asset.page_count)}>
            Trang cuối
          </button>
        </div>
      )}
      <div className="demo-prep-source">
        <strong title={assetLabel(asset)}>{assetLabel(asset)}</strong>
        {asset.page_count > 1 && (
          <label>
            Trang / khung ảnh {role}
            <select value={page} disabled={saving} onChange={(e) => choosePage(Number(e.target.value))}>
              {Array.from({ length: asset.page_count }, (_, i) => (
                <option key={i} value={i + 1}>
                  Trang {i + 1} / {asset.page_count}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {asset.media_type === 'application/pdf' && (
        <p className="source-original-link">
          <a
            className="text-link"
            href={`/api/v1/assets/${asset.id}/download`}
            target="_blank"
            rel="noreferrer"
          >
            Mở PDF gốc để kiểm tra trang / con dấu
          </a>
        </p>
      )}
      {source.isPending ? (
        <Loading />
      ) : source.error ? (
        <ErrorBox error={source.error} />
      ) : (
        <>
          <RegionCanvas
            src={previewUrl(asset.id, page)}
            width={source.data.width}
            height={source.data.height}
            roi={roi}
            onChange={changeRoi}
            readOnly={saving}
          />
          <div className="demo-prep-controls">
            <div className="segmented ink-presets">
              {[
                ['original', 'Giữ ảnh gốc'],
                ['red', 'Tách mực đỏ'],
                ['bw', 'Dấu đen / xám'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  disabled={saving}
                  onClick={() => {
                    setProfile('');
                    changeParameters(preprocessingPreset(key));
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted small">
              Mực đỏ có thể lọc chữ ký đen/xanh. Với dấu đen và chữ ký cùng màu, hãy khoanh sát dấu; phần che
              khuất có thể làm giảm khả năng đối chiếu.
            </p>
            {organizationId && (
              <label>
                Cấu hình xử lý của tổ chức
                <select
                  value={profile}
                  disabled={saving}
                  onChange={(e) => {
                    const selected = profiles.data?.find((p) => p.id === e.target.value);
                    if (selected) changeParameters(selected.parameters);
                    setProfile(e.target.value);
                  }}
                >
                  <option value="">Tùy chỉnh</option>
                  {profiles.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="demo-prep-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  if (source.data.roi) changeRoi(source.data.roi);
                  else toast.info('Chưa tìm thấy mực đỏ. Hãy kéo vùng chọn thủ công.');
                }}
              >
                <WandSparkles size={15} />
                Gợi ý vùng mực đỏ {role}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() =>
                  changeRoi({ x: 0, y: 0, width: source.data.width, height: source.data.height })
                }
              >
                Dùng toàn ảnh {role}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={saving}
                aria-label={`Xóa vùng chọn ${role}`}
                onClick={() => changeRoi(null)}
              >
                <RotateCcw size={15} />
              </Button>
            </div>
            <p className="muted small">
              {roi
                ? 'Kiểm tra vùng dấu đã gợi ý; kéo khung hoặc các góc để chỉnh lại.'
                : 'Chưa tìm thấy vùng dấu. Kéo một khung bao quanh con dấu trên ảnh.'}
            </p>
            <details className="demo-extra">
              <summary>Chỉnh tọa độ và chất lượng ảnh</summary>
              {roi && (
                <div className="roi-fields">
                  {(['x', 'y', 'width', 'height'] as const).map((key, i) => (
                    <label key={key}>
                      {['X', 'Y', 'Rộng', 'Cao'][i]} {role}
                      <input
                        type="number"
                        min={i < 2 ? 0 : 2}
                        value={roi[key]}
                        disabled={saving}
                        onChange={(e) => changeRoi({ ...roi, [key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="demo-adjustments">
                {numberControl('rotation', `Góc xoay ${role}`, -180, 180)}
                {numberControl('brightness', `Độ sáng ${role}`, -100, 100)}
                {numberControl('contrast', `Tương phản ${role}`, 0.1, 3, 0.05)}
                {numberControl('gamma', `Gamma ${role}`, 0.1, 3, 0.05)}
              </div>
              <div className="demo-adjustments">
                {numberControl('saturation', `Bão hòa ${role}`, 0, 3, 0.05)}
                {numberControl('sharpen', `Làm nét ${role}`, 0, 3, 0.1)}
                {numberControl('denoise', `Khử nhiễu ${role}`, 0, 10)}
              </div>
              <p className="muted small">
                Giữ màu mực khi có thể. Làm nét và phân ngưỡng có thể thay đổi hoặc làm mất chi tiết.
              </p>
            </details>
            <label>
              Xử lý ảnh {role}
              <select
                disabled={saving}
                value="custom"
                onChange={(e) => changeParameters(preprocessingPreset(e.target.value))}
              >
                <option value="custom" disabled>
                  Giữ thông số hiện tại
                </option>
                <option value="original">Giữ nguyên màu mực</option>
                <option value="red">Tách mực đỏ</option>
                <option value="bw">Đen trắng</option>
                <option value="gentle">Làm rõ nhẹ</option>
              </select>
            </label>
            {!validRoi && <p className="demo-hint">Chọn một vùng con dấu hợp lệ trước khi lưu ảnh {role}.</p>}
            {wholePage && (
              <div className="notice">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={allowFull}
                    disabled={saving}
                    onChange={(e) => {
                      setAllowFull(e.target.checked);
                      invalidate();
                    }}
                  />
                  Chọn toàn ảnh {role}
                </label>
              </div>
            )}
            {error && <ErrorBox error={new Error(error)} />}
            <Button
              className="w-full"
              disabled={!validRoi || (wholePage && !allowFull) || saving || !!saved}
              onClick={() => void save()}
            >
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {saving
                ? 'Đang lưu vùng dấu…'
                : saved
                  ? `Ảnh ${role} đã sẵn sàng`
                  : `Xác nhận vùng dấu ${role}`}
            </Button>
          </div>
          <div className="demo-crop-preview">
            <span>{saved ? `Phiên bản ${role} đã lưu` : `Xem trước vùng ${role} sau xử lý`}</span>
            {saved ? (
              <img src={previewUrl(saved.asset.id)} alt={`Ảnh ${role} đã chuẩn bị`} />
            ) : preview ? (
              <img src={preview} alt={`Xem trước ảnh ${role}`} />
            ) : (
              <p>{previewBusy ? 'Đang xử lý bản xem trước…' : 'Bản xem trước xuất hiện khi có vùng chọn.'}</p>
            )}
          </div>
          {saved && <AssetName asset={saved.asset} />}
        </>
      )}
    </section>
  );
}
