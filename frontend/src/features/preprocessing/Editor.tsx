import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Undo2,
  Redo2,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl, request } from '../../lib/api';
import type { Asset, Organization, Page, Parameters, Profile, ROI, Run } from '../../types';
import { AssetName } from '../../components/AssetName';
import { assetLabel } from '../../lib/utils';
import { ErrorBox, Loading, Modal, PageHeader, UploadBox } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { RegionCanvas } from '../../components/image-editor/RegionCanvas';
import { useAuth } from '../auth/Auth';
import { defaultParameters as defaults } from '../../lib/preprocessing';

type EditorState = { parameters: Parameters; roi: ROI };
export function Editor() {
  const [search, setSearch] = useSearchParams();
  const { runId } = useParams();
  const [assetId, setAssetId] = useState(search.get('asset') || '');
  const [organization, setOrganization] = useState(search.get('organization') || '');
  const initializedSource = useRef('');
  const initialProfileApplied = useRef(false);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<EditorState>({
    parameters: { ...defaults },
    roi: { x: 0, y: 0, width: 2, height: 2 },
  });
  const [undo, setUndo] = useState<EditorState[]>([]);
  const [redo, setRedo] = useState<EditorState[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [allowFullPage, setAllowFullPage] = useState(false);
  const [saved, setSaved] = useState<Asset | null>(null);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const readOnly = user?.role === 'viewer';
  const restore = useRef<Run | null>(null);
  const assets = useQuery({
    queryKey: ['assets-editor'],
    queryFn: () => api<Page<Asset>>('/assets?page_size=100'),
  });
  const asset = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => api<Asset>(`/assets/${assetId}`),
    enabled: !!assetId,
  });
  const profiles = useQuery({
    queryKey: ['profiles', organization],
    queryFn: () =>
      api<Profile[]>(`/preprocessing/profiles${organization ? `?organization_id=${organization}` : ''}`),
  });
  const organizations = useQuery({
    queryKey: ['org-options'],
    queryFn: () => api<Page<Organization>>('/organizations?page_size=100'),
  });
  const source = useQuery({
    queryKey: ['page-size', assetId, page],
    queryFn: () =>
      api<{ width: number; height: number; roi: ROI | null }>(
        `/preprocessing/suggest-roi/${assetId}?page=${page}`,
      ),
    enabled: !!assetId,
  });
  useEffect(() => {
    if (!runId) return;
    void api<Run>(`/preprocessing/runs/${runId}`)
      .then((run) => {
        restore.current = run;
        setState({ roi: run.roi_geometry, parameters: run.parameters });
        setAssetId(run.source_asset_id);
        setPage(run.source_page);
      })
      .catch((e) => toast.error(e.message));
  }, [runId]);
  useEffect(() => {
    if (!source.data) return;
    const sourceKey = `${assetId}:${page}`;
    if (initializedSource.current === sourceKey) return;
    initializedSource.current = sourceKey;
    const run = restore.current;
    setState(
      run
        ? { roi: run.roi_geometry, parameters: run.parameters }
        : {
            roi: { x: 0, y: 0, width: source.data.width, height: source.data.height },
            parameters: profiles.data?.find((profile) => profile.id === profileId)?.parameters || {
              ...defaults,
            },
          },
    );
    restore.current = null;
    setConfirmed(false);
    setAllowFullPage(false);
    setSaved(null);
    setUndo([]);
    setRedo([]);
  }, [source.data, assetId, page]);
  useEffect(() => {
    if (assetId && !source.data) return;
    const initial = profiles.data?.find((x) => x.id === search.get('profile'));
    if (initial && !initialProfileApplied.current) {
      initialProfileApplied.current = true;
      setState((old) => ({ ...old, parameters: initial.parameters }));
      setProfileId(initial.id);
    }
  }, [profiles.data, search, assetId, source.data]);
  const p = state.parameters;
  const wholePage =
    !!source.data &&
    state.roi.x === 0 &&
    state.roi.y === 0 &&
    state.roi.width === source.data.width &&
    state.roi.height === source.data.height;
  function change(next: EditorState) {
    setUndo((prev) => [...prev.slice(-79), state]);
    setRedo([]);
    setState(next);
    setSaved(null);
  }
  function param<K extends keyof Parameters>(key: K, value: Parameters[K]) {
    change({ ...state, parameters: { ...p, [key]: value } });
    setProfileId(null);
  }
  function roiChange(roi: ROI) {
    change({ ...state, roi });
    setConfirmed(false);
    setAllowFullPage(false);
  }
  useEffect(() => {
    if (!assetId || !source.data || readOnly) return;
    const ctrl = new AbortController();
    let url = '';
    const timer = setTimeout(async () => {
      setPreviewBusy(true);
      setPreviewError('');
      try {
        const response = await request('/preprocessing/preview', {
          method: 'POST',
          body: JSON.stringify({
            source_asset_id: assetId,
            page,
            roi: state.roi,
            parameters: state.parameters,
          }),
          signal: ctrl.signal,
        });
        url = URL.createObjectURL(await response.blob());
        if (!ctrl.signal.aborted) setPreview(url);
      } catch (e) {
        if (!ctrl.signal.aborted) setPreviewError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setPreviewBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId, page, state, source.data, readOnly]);
  function chooseAsset(id: string) {
    restore.current = null;
    initializedSource.current = '';
    setAssetId(id);
    setPage(1);
    setSearch({ asset: id, ...(organization ? { organization } : {}) });
    setSaved(null);
    setConfirmed(false);
  }
  async function save() {
    setSaveBusy(true);
    try {
      const result = await post<{ run: Run; asset: Asset }>('/preprocessing/apply', {
        source_asset_id: assetId,
        page,
        roi: state.roi,
        parameters: p,
        profile_id: profileId,
        roi_confirmed: confirmed,
        allow_full_page: allowFullPage,
        organization_id: organization || null,
      });
      setSaved(result.asset);
      await qc.invalidateQueries({ queryKey: ['assets-editor'] });
      await qc.invalidateQueries({ queryKey: ['processed-assets'] });
      toast.success('Đã lưu phiên bản PNG và thông số xử lý.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaveBusy(false);
    }
  }
  function selectRole(role: 'Q' | 'K') {
    if (!saved) return;
    localStorage.setItem(`seal-${role}`, saved.id);
    toast.success(`Đã chọn phiên bản này làm ảnh ${role}. Mở So khớp con dấu để tiếp tục.`);
  }
  const slider = (
    key: keyof Parameters,
    label: string,
    min: number,
    max: number,
    step = 1,
    disabled = false,
  ) => (
    <div className={`slider-field ${disabled ? 'disabled' : ''}`} key={key}>
      <span>
        {label}
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={Number(p[key])}
          disabled={disabled || readOnly}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= min && v <= max) param(key, v);
          }}
        />
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Number(p[key])}
        disabled={disabled || readOnly}
        onChange={(e) => param(key, Number(e.target.value))}
      />
    </div>
  );
  const toggle = (
    key: 'grayscale' | 'red_mask' | 'invert' | 'apply_mask',
    label: string,
    disabled = false,
  ) => (
    <label className="check" key={key}>
      <input
        type="checkbox"
        checked={p[key]}
        disabled={disabled || readOnly}
        onChange={(e) => param(key, e.target.checked)}
      />
      {label}
    </label>
  );
  return (
    <>
      <PageHeader
        eyebrow="CHUẨN BỊ ẢNH"
        title="Xưởng xử lý ảnh"
        description="Chọn vùng con dấu trên ảnh gốc, điều chỉnh thông số và lưu một phiên bản riêng."
      >
        <Button
          variant="outline"
          disabled={!undo.length}
          onClick={() => {
            setRedo([state, ...redo]);
            setState(undo[undo.length - 1]);
            setUndo(undo.slice(0, -1));
            setSaved(null);
            setConfirmed(false);
          }}
        >
          <Undo2 size={15} />
          Hoàn tác
        </Button>
        <Button
          variant="outline"
          disabled={!redo.length}
          onClick={() => {
            setUndo([...undo, state]);
            setState(redo[0]);
            setRedo(redo.slice(1));
            setSaved(null);
            setConfirmed(false);
          }}
        >
          <Redo2 size={15} />
          Làm lại
        </Button>
        <Button
          variant="outline"
          disabled={!source.data || readOnly}
          onClick={() => {
            if (!source.data) return;
            change({
              parameters: { ...defaults },
              roi: { x: 0, y: 0, width: source.data.width, height: source.data.height },
            });
            setConfirmed(false);
            setAllowFullPage(false);
            setProfileId(null);
          }}
        >
          <RotateCcw size={15} />
          Đặt lại
        </Button>
        <Button
          disabled={!confirmed || (wholePage && !allowFullPage) || saveBusy || readOnly || !assetId}
          onClick={() => void save()}
        >
          <Save size={16} />
          {saveBusy ? 'Đang lưu…' : 'Áp dụng và lưu'}
        </Button>
      </PageHeader>
      <div className="editor-grid">
        <aside className="panel source-panel">
          <div className="panel-heading">
            <h2>Tài liệu nguồn</h2>
          </div>
          <div className="source-content">
            {!readOnly && (
              <UploadBox
                onUploaded={(a) => {
                  chooseAsset(a.id);
                  void qc.invalidateQueries({ queryKey: ['assets-editor'] });
                }}
              />
            )}
            <label>
              Chọn tệp đã tải
              <select value={assetId} onChange={(e) => chooseAsset(e.target.value)}>
                <option value="">— Chọn tài liệu —</option>
                {assets.data?.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {assetLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            {asset.data && (
              <>
                <p className="source-meta">
                  {asset.data.media_type} · {(asset.data.file_size / 1024).toFixed(0)} KB
                </p>
                <label>
                  Trang / khung ảnh
                  <select value={page} onChange={(e) => setPage(Number(e.target.value))}>
                    {Array.from({ length: asset.data.page_count }, (_, i) => (
                      <option key={i} value={i + 1}>
                        Trang {i + 1} / {asset.data!.page_count}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="page-thumbs">
                  {Array.from({ length: asset.data.page_count }, (_, i) => (
                    <button
                      key={i}
                      className={page === i + 1 ? 'selected' : ''}
                      onClick={() => setPage(i + 1)}
                    >
                      <img loading="lazy" src={previewUrl(assetId, i + 1)} alt={`Trang ${i + 1}`} />
                      <span>Trang {i + 1}</span>
                    </button>
                  ))}
                </div>
                <a href={`/api/v1/assets/${assetId}/download`} className="text-link">
                  <Download size={14} /> Tải bản gốc
                </a>
              </>
            )}
          </div>
        </aside>
        <section className="editor-center">
          {!assetId ? (
            <div className="panel editor-placeholder">
              <ScanLine size={50} />
              <h2>Chọn tài liệu để bắt đầu</h2>
              <p>Ảnh gốc giữ nguyên. Mọi điều chỉnh được lưu thành phiên bản mới.</p>
            </div>
          ) : source.isPending ? (
            <Loading />
          ) : source.error ? (
            <ErrorBox error={source.error} />
          ) : (
            <>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Chọn vùng trên ảnh gốc</h2>
                  <span>Tọa độ trước khi xoay</span>
                </div>
                <RegionCanvas
                  src={previewUrl(assetId, page)}
                  width={source.data.width}
                  height={source.data.height}
                  roi={state.roi}
                  onChange={roiChange}
                  readOnly={readOnly}
                />
              </div>
              <div className="roi-tools panel">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    if (source.data.roi) roiChange(source.data.roi);
                    else toast.info('Không phát hiện vùng mực đỏ. Hãy vẽ ROI thủ công.');
                  }}
                >
                  <WandSparkles size={15} />
                  Gợi ý vùng mực đỏ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readOnly}
                  onClick={() =>
                    roiChange({ x: 0, y: 0, width: source.data.width, height: source.data.height })
                  }
                >
                  Chọn lại toàn ảnh
                </Button>
                <div className="roi-fields">
                  {(['x', 'y', 'width', 'height'] as const).map((key, i) => (
                    <label key={key}>
                      {['X', 'Y', 'Rộng', 'Cao'][i]}
                      <input
                        type="number"
                        min={key === 'width' || key === 'height' ? 2 : 0}
                        value={state.roi[key]}
                        disabled={readOnly}
                        onChange={(e) => roiChange({ ...state.roi, [key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={readOnly}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  Tôi xác nhận ROI đã chọn là vùng con dấu cần xử lý
                </label>
                {wholePage && (
                  <div className="notice">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={allowFullPage}
                        onChange={(e) => {
                          setAllowFullPage(e.target.checked);
                          setSaved(null);
                        }}
                        disabled={readOnly}
                      />
                      Chọn toàn ảnh/trang
                    </label>
                  </div>
                )}
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Xem trước sau xử lý</h2>
                  <span>{previewBusy ? 'Đang cập nhật…' : 'Tính toán bằng backend'}</span>
                </div>
                {previewError ? (
                  <ErrorBox error={new Error(previewError)} />
                ) : (
                  <div className="processed-preview">
                    {preview ? (
                      <img src={preview} alt="Kết quả tiền xử lý xem trước" />
                    ) : (
                      <p>{readOnly ? 'Chế độ chỉ xem.' : 'Đang tạo bản xem trước…'}</p>
                    )}
                  </div>
                )}
              </div>
              {saved && (
                <>
                  <AssetName asset={saved} editable={!readOnly} />
                  <div className="saved-bar">
                    <span>
                      <Check size={17} />
                      Đã lưu phiên bản {saved.id.slice(0, 8)}
                    </span>
                    <Button size="sm" onClick={() => selectRole('Q')}>
                      Chọn làm Q
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => selectRole('K')}>
                      Chọn làm K
                    </Button>
                    <a href={`/api/v1/assets/${saved.id}/download`}>
                      <Download size={18} />
                      <span className="sr-only">Tải ảnh xử lý</span>
                    </a>
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to={`/seal-library/add?asset=${saved.id}${organization ? `&organization=${organization}` : ''}`}
                      >
                        Lưu vào tổ chức
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/compare/library?q=${saved.id}`}>Tra cứu Top 3</Link>
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
        <aside className="panel parameters-panel">
          <div className="panel-heading">
            <h2>Thông số xử lý</h2>
            <Button
              size="icon"
              variant="ghost"
              disabled={readOnly}
              aria-label="Đặt lại thông số"
              onClick={() => {
                change({ ...state, parameters: { ...defaults } });
                setProfileId(null);
              }}
            >
              <RotateCcw size={16} />
            </Button>
          </div>
          <div className="parameters-content">
            <label>
              Tổ chức / đơn vị
              <select
                value={organization}
                disabled={readOnly}
                onChange={(e) => {
                  setOrganization(e.target.value);
                  setProfileId(null);
                  setSaved(null);
                }}
              >
                <option value="">Chưa gắn tổ chức</option>
                {organizations.data?.items.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.code ? `${o.code} · ` : ''}
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cấu hình nhanh
              <select
                defaultValue="original"
                disabled={readOnly}
                onChange={(e) => {
                  const presets: Record<string, Partial<Parameters>> = {
                    original: {},
                    red: { red_mask: true, background: 'white' },
                    bw: { grayscale: true, threshold_mode: 'otsu' },
                    gentle: { contrast: 1.1, sharpen: 0.3 },
                  };
                  change({ ...state, parameters: { ...defaults, ...presets[e.target.value] } });
                  setProfileId(null);
                }}
              >
                <option value="original">Ảnh gốc</option>
                <option value="red">Mực đỏ</option>
                <option value="bw">Đen trắng</option>
                <option value="gentle">Làm rõ nhẹ</option>
              </select>
            </label>
            <label>
              Cấu hình xử lý của tổ chức
              <select
                value={profileId || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const selected = profiles.data?.find((x) => x.id === e.target.value);
                  if (selected) {
                    change({ ...state, parameters: selected.parameters });
                    setProfileId(selected.id);
                  }
                }}
              >
                <option value="">Tùy chỉnh</option>
                {profiles.data
                  ?.filter((x) => (organization ? x.organization_id === organization : !x.organization_id))
                  .map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || !organization}
              onClick={() => setProfileModal(true)}
            >
              <Copy size={14} />
              Lưu cấu hình cho tổ chức
            </Button>
            <h3>Hình học & ánh sáng</h3>
            {slider('rotation', 'Góc xoay (độ)', -180, 180)}
            <div className="inline-buttons">
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => param('rotation', p.rotation <= -90 ? p.rotation + 270 : p.rotation - 90)}
              >
                <RotateCcw size={14} />
                -90°
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => param('rotation', p.rotation >= 90 ? p.rotation - 270 : p.rotation + 90)}
              >
                <RotateCw size={14} />
                +90°
              </Button>
            </div>
            {slider('brightness', 'Độ sáng', -100, 100)}
            {slider('contrast', 'Tương phản', 0.1, 3, 0.05)}
            {slider('gamma', 'Gamma', 0.1, 3, 0.05)}
            {slider(
              'saturation',
              'Bão hòa màu',
              0,
              3,
              0.05,
              (p.grayscale && !p.red_mask) || (p.threshold_mode !== 'off' && !p.red_mask),
            )}
            {slider('denoise', 'Khử nhiễu', 0, 10)}
            {slider('sharpen', 'Làm nét', 0, 3, 0.1)}
            <h3>Màu & phân ngưỡng</h3>
            {toggle('red_mask', 'Tách mực đỏ (HSV)')}
            {p.red_mask && (
              <>
                {slider('hue_width', 'Biên sắc đỏ H (0/179)', 0, 45)}
                {slider('saturation_min', 'Bão hòa tối thiểu S', 0, 255)}
                {slider('value_min', 'Độ sáng tối thiểu V', 0, 255)}
                {toggle('apply_mask', 'Áp dụng mặt nạ vào ảnh lưu')}
                <label>
                  Nền ảnh
                  <select
                    value={p.background}
                    disabled={readOnly}
                    onChange={(e) => param('background', e.target.value as Parameters['background'])}
                  >
                    <option value="none">Giữ nền theo mặt nạ</option>
                    <option value="white">Nền trắng</option>
                    <option value="transparent">PNG nền trong suốt</option>
                    <option value="overlay">Lớp phủ mặt nạ (chỉ xem trước)</option>
                  </select>
                </label>
              </>
            )}
            {toggle('grayscale', 'Chuyển ảnh xám', p.red_mask)}
            <label>
              Phân ngưỡng
              <select
                value={p.threshold_mode}
                disabled={p.red_mask || readOnly}
                onChange={(e) => param('threshold_mode', e.target.value as Parameters['threshold_mode'])}
              >
                <option value="off">Tắt</option>
                <option value="otsu">Otsu tự động</option>
                <option value="adaptive">Ngưỡng thích nghi</option>
                <option value="manual">Ngưỡng thủ công</option>
              </select>
            </label>
            {p.threshold_mode === 'manual' &&
              !p.red_mask &&
              slider('threshold_value', 'Giá trị ngưỡng', 0, 255)}
            <h3>Hình thái học</h3>
            <label>
              Phép xử lý
              <select
                value={p.morphology}
                disabled={readOnly}
                onChange={(e) => param('morphology', e.target.value as Parameters['morphology'])}
              >
                <option value="none">Không áp dụng</option>
                <option value="open">Mở (loại đốm nhỏ)</option>
                <option value="close">Đóng (nối nét gần nhau)</option>
              </select>
            </label>
            {p.morphology !== 'none' && slider('kernel_size', 'Kích thước nhân', 1, 9)}
            {toggle('invert', 'Đảo màu')}
            <p className="processing-warning">
              Làm nét, phân ngưỡng và hình thái học có thể làm mất hoặc thay đổi chi tiết. Ảnh sau xử lý không
              bổ sung bằng chứng gốc.
            </p>
            <p className="muted small">
              Thứ tự: cắt → xoay → sáng/tương phản/gamma → màu → khử nhiễu → làm nét → xám/ngưỡng hoặc HSV →
              hình thái → xuất PNG.
            </p>
          </div>
        </aside>
      </div>
      {profileModal && (
        <Modal title="Lưu cấu hình xử lý theo tổ chức" onClose={() => setProfileModal(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileSaving(true);
              try {
                await post('/preprocessing/profiles', {
                  name: profileName,
                  parameters: p,
                  is_default: false,
                  organization_id: organization || null,
                });
                await qc.invalidateQueries({ queryKey: ['profiles'] });
                setProfileModal(false);
                toast.success('Đã lưu cấu hình xử lý.');
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setProfileSaving(false);
              }
            }}
          >
            <label>
              Tên cấu hình
              <input
                required
                maxLength={200}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <Button type="submit" disabled={profileSaving}>
                Lưu cấu hình
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
