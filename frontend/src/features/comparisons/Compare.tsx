import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ExternalLink, LoaderCircle, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl } from '../../lib/api';
import { assetLabel, dateTime } from '../../lib/utils';
import type { Analysis, Asset, Candidate, Impression, OpenAIStatus, Page } from '../../types';
import { Disclaimer, Empty, ErrorBox, Loading, PageHeader, UploadBox } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { useAuth } from '../auth/Auth';

export function Compare() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState(search.get('q') || localStorage.getItem('seal-Q') || '');
  const initialK = search.get('k') || localStorage.getItem('seal-K') || '';
  const [candidates, setCandidates] = useState<Candidate[]>(
    initialK ? [{ reference_asset_id: initialK }] : [],
  );
  const [mode, setMode] = useState<'pairwise' | 'library'>('pairwise');
  const [title, setTitle] = useState('Phiên đối chiếu con dấu');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [libraryQ, setLibraryQ] = useState('');
  const [libraryOrg, setLibraryOrg] = useState('');
  const [sessionId, setSessionId] = useState(search.get('session') || '');
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
  });
  const assets = useQuery({
    queryKey: ['processed-assets'],
    queryFn: () => api<Page<Asset>>('/assets?kind=processed_stamp&page_size=100'),
  });
  const library = useQuery({
    queryKey: ['library-select', libraryQ, libraryOrg],
    queryFn: () =>
      api<Page<Impression>>(
        `/seal-impressions?q=${encodeURIComponent(libraryQ)}&page_size=100${libraryOrg ? `&organization_id=${libraryOrg}` : ''}`,
      ),
    enabled: mode === 'library',
  });
  const orgs = useQuery({
    queryKey: ['org-select'],
    queryFn: () => api<Page<{ id: string; name: string }>>('/organizations?page_size=100'),
    enabled: mode === 'library',
  });
  const qAsset = useQuery({
    queryKey: ['asset', q],
    queryFn: () => api<Asset>(`/assets/${q}`),
    enabled: !!q,
  });
  const k = candidates[0]?.reference_asset_id || '';
  const kAsset = useQuery({
    queryKey: ['asset', k],
    queryFn: () => api<Asset>(`/assets/${k}`),
    enabled: !!k,
  });
  const max = status.data?.max_candidates || 5;
  const steps = [
    'Ảnh cần kiểm tra Q',
    'Chọn ảnh đối chiếu K',
    'Kiểm tra tiền xử lý',
    'Cho phép gửi OpenAI',
    'Phân tích',
  ];
  function toggleCandidate(i: Impression, checked: boolean) {
    if (checked) {
      if (candidates.length >= max) {
        toast.error(`Chỉ chọn tối đa ${max} ảnh K.`);
        return;
      }
      setCandidates([...candidates, { reference_asset_id: i.image_asset_id, reference_impression_id: i.id }]);
    } else setCandidates(candidates.filter((c) => c.reference_impression_id !== i.id));
    setSessionId(search.get('session') || '');
  }
  async function analyse() {
    setBusy(true);
    setError('');
    try {
      let id = sessionId;
      if (!id) {
        const session = await post<Analysis>('/analyses', { title, mode, query_asset_id: q, candidates });
        id = session.id;
        setSessionId(id);
      }
      await post(`/analyses/${id}/compare-openai`, { consent, query_asset_id: q, candidates });
      await qc.invalidateQueries({ queryKey: ['history'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      nav(`/compare/${id}/results`);
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="SO KHỚP HÌNH ẢNH"
        title={search.get('session') ? 'So sánh lại · phiên bản mới' : 'Tạo phiên đối chiếu'}
        description="Chuẩn bị hai ảnh con dấu đã cắt. Kiểm tra nội dung chia sẻ trước khi phân tích."
      />
      <div className="stepper">
        {steps.map((label, i) => (
          <div key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
            <span>{step > i + 1 ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </div>
      <div className="compare-workspace panel">
        <div className="panel-heading">
          <h2>{steps[step - 1]}</h2>
          <span>Bước {step}/5</span>
        </div>
        <div className="compare-inner">
          {step === 1 && (
            <>
              <p className="muted">Ảnh Q cần được chọn ROI và lưu trong Xưởng xử lý ảnh trước khi so sánh.</p>
              <AssetPicker
                value={q}
                onChange={(id) => {
                  setQ(id);
                  setSessionId(search.get('session') || '');
                }}
                assets={assets.data?.items || []}
              />
              <div className="compare-upload">
                <UploadBox onUploaded={(a) => nav(`/preprocessing?asset=${a.id}`)} />
                <div>
                  <h3>Ảnh mới chưa được xử lý?</h3>
                  <p>Tải ảnh/PDF để mở xưởng. Sau khi cắt, bấm “Chọn làm Q” rồi quay lại So khớp con dấu.</p>
                  <Button variant="outline" asChild>
                    <Link to="/preprocessing">
                      Mở xưởng xử lý <ExternalLink size={15} />
                    </Link>
                  </Button>
                </div>
              </div>
              {qAsset.data && (
                <img className="selected-preview" src={previewUrl(q)} alt="Dấu cần kiểm tra Q" />
              )}
              {qAsset.error && <ErrorBox error={qAsset.error} />}
            </>
          )}
          {step === 2 && (
            <>
              <div className="segmented">
                <button
                  className={mode === 'pairwise' ? 'active' : ''}
                  onClick={() => {
                    setMode('pairwise');
                    setCandidates([]);
                    setSessionId(search.get('session') || '');
                  }}
                >
                  Hai ảnh tải lên
                </button>
                <button
                  className={mode === 'library' ? 'active' : ''}
                  onClick={() => {
                    setMode('library');
                    setCandidates([]);
                    setSessionId(search.get('session') || '');
                  }}
                >
                  Chọn từ thư viện
                </button>
              </div>
              {mode === 'pairwise' ? (
                <>
                  <AssetPicker
                    value={candidates[0]?.reference_asset_id || ''}
                    onChange={(id) => {
                      setCandidates(id ? [{ reference_asset_id: id }] : []);
                      setSessionId(search.get('session') || '');
                    }}
                    assets={assets.data?.items || []}
                  />
                  <UploadBox kind="original_stamp" onUploaded={(a) => nav(`/preprocessing?asset=${a.id}`)} />
                  <p className="muted">Sau khi xử lý ảnh K, chọn “Chọn làm K” rồi quay lại màn hình này.</p>
                  {kAsset.data && (
                    <figure className="selected-asset-preview">
                      <img className="selected-preview" src={previewUrl(k)} alt="Dấu đối chiếu K đã chọn" />
                      <figcaption>{assetLabel(kAsset.data)}</figcaption>
                    </figure>
                  )}
                  {kAsset.error && <ErrorBox error={kAsset.error} />}
                </>
              ) : (
                <>
                  <div className="toolbar">
                    <input
                      placeholder="Tìm đơn vị, mã mẫu, ghi chú…"
                      value={libraryQ}
                      onChange={(e) => setLibraryQ(e.target.value)}
                    />
                    <select value={libraryOrg} onChange={(e) => setLibraryOrg(e.target.value)}>
                      <option value="">Tất cả tổ chức</option>
                      {orgs.data?.items.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <span>
                      Đã chọn {candidates.length}/{max}
                    </span>
                  </div>
                  {library.isPending ? (
                    <Loading />
                  ) : library.error ? (
                    <ErrorBox error={library.error} />
                  ) : !library.data.items.length ? (
                    <Empty
                      title="Không tìm thấy mẫu phù hợp"
                      description="Thử đổi bộ lọc hoặc bổ sung mẫu tham chiếu. Hệ thống không tự gán tổ chức từ ảnh gần giống."
                    />
                  ) : (
                    <div className="candidate-grid">
                      {library.data.items
                        .filter((i) => i.is_reference)
                        .map((i) => (
                          <LibraryCandidate
                            key={i.id}
                            impression={i}
                            selected={candidates.some((c) => c.reference_impression_id === i.id)}
                            onChange={(v) => toggleCandidate(i, v)}
                          />
                        ))}
                    </div>
                  )}
                  <p className="muted">
                    Không có mẫu đúng? Có thể dừng ở đây hoặc thêm ảnh tham chiếu khác. Không bắt buộc chọn
                    mẫu gần giống.
                  </p>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <div className="comparison-images">
                <figure>
                  <figcaption>Dấu cần kiểm tra (Q)</figcaption>
                  <img src={previewUrl(q)} alt="Ảnh Q" />
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/preprocessing?asset=${q}`}>Tinh chỉnh ảnh Q</Link>
                  </Button>
                </figure>
                {candidates.map((c, i) => (
                  <figure key={c.reference_asset_id}>
                    <figcaption>Dấu đối chiếu (K{i + 1})</figcaption>
                    <img src={previewUrl(c.reference_asset_id)} alt={`Ảnh K${i + 1}`} />
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/preprocessing?asset=${c.reference_asset_id}`}>Tinh chỉnh ảnh K{i + 1}</Link>
                    </Button>
                  </figure>
                ))}
              </div>
              <div className="notice subtle">
                <Check size={18} />
                <span>
                  Chỉ ảnh đã lưu với ROI xác nhận mới được backend chấp nhận. Tinh chỉnh sẽ tạo ảnh mới; hãy
                  chọn lại phiên bản Q/K trước khi gửi.
                </span>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <label>
                Tên phiên đối chiếu
                <input maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <div className="consent-box">
                <ScanLine size={28} />
                <h3>Cho phép gửi ảnh tới OpenAI</h3>
                <p>
                  Ảnh con dấu sẽ được gửi tới dịch vụ OpenAI để phân tích. Chỉ thực hiện với dữ liệu được phép
                  chia sẻ.
                </p>
                <p>
                  Tài liệu được gửi ra dịch vụ bên ngoài khi gọi OpenAI. Lần phân tích này chỉ gửi ROI đã xử
                  lý, không gửi toàn bộ PDF.
                </p>
                <p>
                  Nếu bạn đã xác nhận dùng toàn ảnh/trang trong Xưởng, toàn bộ nội dung của ảnh đó sẽ được
                  gửi. Kiểm tra lại Q và từng K trước khi đồng ý.
                </p>
                <div className="call-summary">
                  <span>
                    Model <strong>{status.data?.model}</strong>
                  </span>
                  <span>
                    Số yêu cầu so sánh <strong>{candidates.length}</strong>
                  </span>
                  <span>
                    Chi phí <strong>Chưa xác định</strong>
                  </span>
                </div>
                <label className="check">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  Tôi được phép chia sẻ các ảnh này và đồng ý gửi tới OpenAI trong phiên này.
                </label>
              </div>
              <Disclaimer />
            </>
          )}
          {step === 5 && (
            <>
              <div className="analysis-ready">
                <div className="ready-icon">
                  <ScanLine size={36} />
                </div>
                <h2>{busy ? 'Đang đối chiếu hình ảnh…' : 'Sẵn sàng phân tích'}</h2>
                <p>
                  {busy
                    ? 'Vui lòng giữ trang mở. Kết quả sẽ được lưu khi OpenAI hoàn tất.'
                    : `${candidates.length} cặp Q/K · ${status.data?.model} · không tự động gửi thêm ứng viên.`}
                </p>
                {!status.data?.is_configured && (
                  <div className="notice danger">
                    Chưa cấu hình OPENAI_API_KEY trong backend/.env. <Link to="/settings">Xem cài đặt</Link>
                  </div>
                )}
                {error && <ErrorBox error={new Error(error)} />}
                <Button
                  disabled={busy || !consent || !status.data?.is_configured || user?.role === 'viewer'}
                  onClick={() => void analyse()}
                >
                  {busy ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}Phân tích bằng
                  OpenAI
                </Button>
                {sessionId && (
                  <Button variant="outline" asChild>
                    <Link to={`/compare/${sessionId}/results`}>Mở phiên đã lưu</Link>
                  </Button>
                )}
                <small>
                  Giới hạn thời gian mỗi cặp: {status.data?.timeout_seconds} giây. Có tối đa 2 lần thử lại ở
                  SDK cho lỗi tạm thời trong giới hạn này.
                </small>
              </div>
            </>
          )}
        </div>
        <div className="wizard-actions">
          <Button variant="outline" disabled={step === 1 || busy} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} />
            Quay lại
          </Button>
          {step < 5 && (
            <Button
              disabled={
                (step === 1 && !q) ||
                (step === 2 && !candidates.length) ||
                (step === 4 && (!consent || !title.trim()))
              }
              onClick={() => setStep(step + 1)}
            >
              Tiếp tục
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
function AssetPicker({
  value,
  onChange,
  assets,
}: {
  value: string;
  onChange: (id: string) => void;
  assets: Asset[];
}) {
  return (
    <label>
      Chọn phiên bản ảnh đã xử lý
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Chọn ảnh —</option>
        {value && !assets.some((a) => a.id === value) && (
          <option value={value}>Ảnh đã chọn · {value.slice(0, 8)}</option>
        )}
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {assetLabel(a)} · {dateTime(a.created_at)}
          </option>
        ))}
      </select>
    </label>
  );
}
function LibraryCandidate({
  impression: i,
  selected,
  onChange,
}: {
  impression: Impression;
  selected: boolean;
  onChange: (v: boolean) => void;
}) {
  const asset = useQuery({
    queryKey: ['asset', i.image_asset_id],
    queryFn: () => api<Asset>(`/assets/${i.image_asset_id}`),
  });
  const ready = asset.data?.kind === 'processed_stamp' && asset.data.source_metadata.roi_confirmed;
  return (
    <div className={`candidate-card ${selected ? 'selected' : ''}`}>
      <img src={previewUrl(i.image_asset_id)} alt={i.design_name} />
      <strong>{i.design_name}</strong>
      <small>{i.organization_name}</small>
      {ready ? (
        <label className="check">
          <input type="checkbox" checked={selected} onChange={(e) => onChange(e.target.checked)} />
          Chọn đối chiếu
        </label>
      ) : (
        <Link className="text-link" to={`/preprocessing?asset=${i.image_asset_id}`}>
          Cần xử lý và cập nhật ảnh mẫu
        </Link>
      )}
    </div>
  );
}
