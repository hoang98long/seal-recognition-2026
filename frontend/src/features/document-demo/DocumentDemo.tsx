import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Image,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { api, post, previewUrl } from '../../lib/api';
import type { Analysis, Asset, Document, Impression, OpenAIStatus, Result } from '../../types';
import { Button } from '../../components/ui/button';
import { Disclaimer, ErrorBox, Loading, PageHeader, UploadBox } from '../../components/shared';
import { useAuth } from '../auth/Auth';
import { StampPreparation, type PreparedStamp } from './StampPreparation';
import { DemoResults } from './DemoResults';
import { ReferencePicker } from './ReferencePicker';
import './demo.css';

export function DocumentDemo() {
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const [source, setSource] = useState<{ asset: Asset; document: Document } | null>(null);
  const [reference, setReference] = useState<Asset | null>(null);
  const [sourceVersion, setSourceVersion] = useState(0);
  const [referenceVersion, setReferenceVersion] = useState(0);
  const [queryStamp, setQueryStamp] = useState<PreparedStamp | null>(null);
  const [referenceStamp, setReferenceStamp] = useState<PreparedStamp | null>(null);
  const [title, setTitle] = useState('Đối chiếu văn bản & ảnh dấu');
  const [referenceMode, setReferenceMode] = useState<'upload' | 'library'>(
    search.get('reference') ? 'library' : 'upload',
  );
  const [libraryReference, setLibraryReference] = useState<Impression | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  const [analysisId, setAnalysisId] = useState('');
  const [error, setError] = useState('');
  const [uploadingQ, setUploadingQ] = useState(false);
  const [uploadingK, setUploadingK] = useState(false);
  const [savingQ, setSavingQ] = useState(false);
  const [savingK, setSavingK] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const submitting = useRef(false);
  const busy = uploadingQ || uploadingK || savingQ || savingK || analysing || loadingReference;
  const linkedReference = search.get('reference');
  useEffect(() => {
    if (!linkedReference) {
      setLoadingReference(false);
      return;
    }
    let cancelled = false;
    setLoadingReference(true);
    (async () => {
      const item = await api<Impression>(`/seal-impressions/${linkedReference}`);
      const prepared = await api<PreparedStamp | null>(`/preprocessing/by-output/${item.image_asset_id}`);
      const asset = prepared?.asset || (await api<Asset>(`/assets/${item.image_asset_id}`));
      if (!cancelled) {
        setReference(asset);
        setReferenceStamp(prepared);
        setLibraryReference(item);
      }
    })()
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingReference(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedReference]);
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
  });
  const results = useQuery({
    queryKey: ['demo-results', analysisId],
    queryFn: () => api<Result[]>(`/analyses/${analysisId}/results`),
    enabled: !!analysisId,
  });
  const latest = results.data?.[0];
  const latestMatches =
    latest &&
    queryStamp &&
    referenceStamp &&
    latest.input_metadata.query.asset_id === queryStamp.asset.id &&
    latest.input_metadata.reference.asset_id === referenceStamp.asset.id;
  const preparedQ = useCallback((value: PreparedStamp | null) => {
    setQueryStamp(value);
    setError('');
  }, []);
  const preparedK = useCallback((value: PreparedStamp | null) => {
    setReferenceStamp(value);
    setError('');
  }, []);
  function resetSession() {
    setAnalysisId('');
    setError('');
  }
  function newDemo() {
    if (busy) return;
    setSource(null);
    setReference(null);
    setQueryStamp(null);
    setReferenceStamp(null);
    resetSession();
    setStep(1);
    setTitle('Đối chiếu văn bản & ảnh dấu');
    setLibraryReference(null);
    setSearch({}, { replace: true });
  }
  async function analyse() {
    if (
      submitting.current ||
      !source ||
      !title.trim() ||
      !queryStamp ||
      !referenceStamp ||
      !status.data?.is_configured
    )
      return;
    submitting.current = true;
    setAnalysing(true);
    setError('');
    let id = analysisId;
    try {
      const candidates = [
        {
          reference_asset_id: referenceStamp.asset.id,
          reference_impression_id:
            libraryReference?.image_asset_id === referenceStamp.asset.id ? libraryReference.id : null,
        },
      ];
      if (!id) {
        const session = await post<Analysis>('/analyses', {
          title: title.trim(),
          mode: 'pairwise',
          query_asset_id: queryStamp.asset.id,
          source_document_id: source.document.id,
          candidates,
          processing_notes:
            'Đối chiếu trực tiếp con dấu đã cắt từ văn bản với ảnh dấu do người dùng tải lên; ROI được người dùng xác nhận.',
        });
        id = session.id;
        setAnalysisId(id);
      }
      await post(`/analyses/${id}/compare-openai`, {
        consent: true,
        query_asset_id: queryStamp.asset.id,
        candidates,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (id) {
        try {
          await qc.fetchQuery({
            queryKey: ['demo-results', id],
            queryFn: () => api<Result[]>(`/analyses/${id}/results`),
            staleTime: 0,
          });
        } catch (e) {
          setError((e as Error).message);
        }
      }
      await Promise.all(
        [['history'], ['dashboard'], ['reports'], ['notifications']].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      );
      submitting.current = false;
      setAnalysing(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="SO KHỚP CON DẤU"
        title="So khớp văn bản & ảnh dấu"
        description="Tải văn bản, chọn dấu đối chiếu và nhận kết quả trong cùng một quy trình."
      >
        <Button variant="outline" disabled={busy} onClick={newDemo}>
          <RefreshCw size={16} />
          So khớp mới
        </Button>
      </PageHeader>
      {user?.role === 'viewer' ? (
        <div className="notice">
          Tài khoản chỉ xem không được tải ảnh hoặc gọi phân tích.{' '}
          <Link to="/history">Mở lịch sử phân tích</Link>
        </div>
      ) : (
        <>
          <section className="demo-intro">
            <div className="demo-intro-icon">
              <ScanLine size={29} />
            </div>
            <div>
              <h2>Một văn bản. Một ảnh mẫu. Một lần đối chiếu.</h2>
              <p>
                Tải ảnh dấu trực tiếp hoặc chọn dấu của tổ chức trong thư viện. Hệ thống gợi ý vùng dấu để bạn
                kiểm tra và xác nhận.
              </p>
            </div>
            <span className="demo-local-badge">
              <ShieldCheck size={15} />
              Chuẩn bị ảnh · So khớp · Xem kết quả
            </span>
          </section>
          <div className="stepper demo-stepper">
            {['Chọn văn bản & dấu mẫu', 'Kiểm tra vùng dấu', 'So khớp & kết quả'].map((label, i) => (
              <div key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
                <span>{step > i + 1 ? <Check size={16} /> : `0${i + 1}`}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          <div className="demo-provider-status">
            <span className={`badge ${status.data?.is_configured ? 'completed' : 'draft'}`}>
              {status.isPending
                ? 'Đang kiểm tra dịch vụ so khớp…'
                : status.data?.is_configured
                  ? 'Sẵn sàng so khớp'
                  : 'Chưa cấu hình dịch vụ so khớp'}
            </span>
            <button
              className="text-link"
              disabled={status.isFetching || analysing}
              onClick={() => void status.refetch()}
            >
              Đọc lại trạng thái
            </button>
            <span className="muted small">Chuẩn bị ảnh để so khớp.</span>
          </div>
          {status.error && <ErrorBox error={status.error} />}
          {status.data && !status.data.is_configured && (
            <div className="notice">
              Dịch vụ so khớp chưa sẵn sàng. Bạn vẫn có thể tải lên và chuẩn bị Q/K; liên hệ quản trị viên để
              kiểm tra kết nối. <Link to="/settings">Xem cài đặt</Link>
            </div>
          )}
          {step !== 3 && error && <ErrorBox error={new Error(error)} />}
          {step === 1 && (
            <div className="demo-upload-grid">
              <section className="panel demo-upload-card" aria-label="Văn bản cần kiểm tra">
                <div className="demo-upload-heading">
                  <FileText size={25} />
                  <div>
                    <h2>1. Văn bản có con dấu</h2>
                    <p>Chọn trang và cắt dấu cần kiểm tra (Q) ở bước tiếp theo.</p>
                  </div>
                </div>
                <UploadBox
                  disabled={loadingReference}
                  label="Tải văn bản có con dấu"
                  onBusyChange={setUploadingQ}
                  onUploaded={async (asset) => {
                    const document = await post<Document>('/documents', {
                      file_asset_id: asset.id,
                      display_name: asset.original_filename,
                    });
                    setSource({ asset, document });
                    setTitle(`Đối chiếu ${asset.original_filename}`.slice(0, 250));
                    setSourceVersion((v) => v + 1);
                    setQueryStamp(null);
                    resetSession();
                  }}
                />
                {source && <SourceFile asset={source.asset} />}
              </section>
              <section className="panel demo-upload-card" aria-label="Ảnh dấu tham chiếu">
                <div className="demo-upload-heading">
                  <Image size={25} />
                  <div>
                    <h2>2. Ảnh dấu đối chiếu</h2>
                    <p>Tải ảnh mới hoặc dùng lại dấu đã lưu của tổ chức.</p>
                  </div>
                </div>
                <div className="segmented">
                  <button
                    className={referenceMode === 'upload' ? 'active' : ''}
                    disabled={busy}
                    onClick={() => setReferenceMode('upload')}
                  >
                    Tải ảnh lên
                  </button>
                  <button
                    className={referenceMode === 'library' ? 'active' : ''}
                    disabled={busy}
                    onClick={() => setReferenceMode('library')}
                  >
                    Chọn từ thư viện
                  </button>
                </div>
                {referenceMode === 'upload' ? (
                  <UploadBox
                    disabled={loadingReference}
                    label="Tải ảnh dấu đối chiếu"
                    kind="original_stamp"
                    accept=".png,.jpg,.jpeg,.tif,.tiff,.webp"
                    description="PNG, JPG, TIFF hoặc WEBP; có thể chọn khung TIFF"
                    onBusyChange={setUploadingK}
                    onUploaded={(asset) => {
                      if (!asset.media_type.startsWith('image/'))
                        throw new Error('Ảnh K phải là PNG, JPG, TIFF hoặc WEBP.');
                      setReference(asset);
                      setLibraryReference(null);
                      setSearch({}, { replace: true });
                      setReferenceVersion((v) => v + 1);
                      setReferenceStamp(null);
                      resetSession();
                    }}
                  />
                ) : (
                  <ReferencePicker
                    selected={libraryReference?.id || ''}
                    disabled={busy}
                    onSelect={async (item) => {
                      setLoadingReference(true);
                      try {
                        const prepared = await api<PreparedStamp | null>(
                          `/preprocessing/by-output/${item.image_asset_id}`,
                        );
                        const asset = prepared?.asset || (await api<Asset>(`/assets/${item.image_asset_id}`));
                        setReference(asset);
                        setReferenceStamp(prepared);
                        setLibraryReference(item);
                        setReferenceVersion((v) => v + 1);
                        resetSession();
                        setSearch({}, { replace: true });
                      } finally {
                        setLoadingReference(false);
                      }
                    }}
                  />
                )}
                {loadingReference && <Loading />}
                {reference && (
                  <>
                    <SourceFile asset={reference} />
                    {libraryReference && (
                      <p className="reference-selected">
                        Đã chọn: {libraryReference.organization_name} · {libraryReference.design_name}
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
          {step === 2 && source && reference && (
            <div className="demo-preparation-grid">
              <StampPreparation
                key={`Q-${source.asset.id}-${sourceVersion}`}
                asset={source.asset}
                role="Q"
                initial={queryStamp}
                onPrepared={preparedQ}
                onBusyChange={setSavingQ}
              />
              {libraryReference && referenceStamp ? (
                <section className="panel ready-reference" aria-label="Dấu thư viện đã sẵn sàng">
                  <h2>
                    <Check size={20} /> Dấu mẫu đã sẵn sàng
                  </h2>
                  <img src={previewUrl(referenceStamp.asset.id)} alt="Dấu đối chiếu từ thư viện" />
                  <h3>{libraryReference.design_name}</h3>
                  <p>{libraryReference.organization_name}</p>
                  <p className="muted">Sử dụng vùng dấu đã xác nhận trong thư viện.</p>
                  <Button variant="outline" onClick={() => preparedK(null)}>
                    Chỉnh lại vùng dấu mẫu
                  </Button>
                </section>
              ) : (
                <StampPreparation
                  key={`K-${reference.id}-${referenceVersion}`}
                  asset={reference}
                  role="K"
                  initial={referenceStamp}
                  onPrepared={preparedK}
                  onBusyChange={setSavingK}
                />
              )}
            </div>
          )}
          {step === 3 && queryStamp && referenceStamp && (
            <>
              <section className="panel demo-review">
                <div className="panel-heading">
                  <h2>Kiểm tra hai ảnh con dấu</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setStep(2);
                    }}
                  >
                    Chỉnh lại vùng / thông số
                  </Button>
                </div>
                <div className="comparison-images">
                  <figure>
                    <figcaption>Dấu trong văn bản (Q) · trang {queryStamp.run.source_page}</figcaption>
                    <img src={previewUrl(queryStamp.asset.id)} alt="Ảnh Q dùng để so khớp" />
                  </figure>
                  <figure>
                    <figcaption>Ảnh dấu đối chiếu (K)</figcaption>
                    <img src={previewUrl(referenceStamp.asset.id)} alt="Ảnh K dùng để đối chiếu" />
                  </figure>
                </div>
                <div className="demo-review-form">
                  <label>
                    Tên phiên so khớp
                    <input
                      value={title}
                      maxLength={250}
                      disabled={busy || !!analysisId}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  {(queryStamp.asset.source_metadata.whole_source_confirmed ||
                    referenceStamp.asset.source_metadata.whole_source_confirmed) && (
                    <div className="notice">
                      Bạn đã chọn dùng toàn ảnh/trang cho{' '}
                      {queryStamp.asset.source_metadata.whole_source_confirmed ? 'Q' : ''}
                      {queryStamp.asset.source_metadata.whole_source_confirmed &&
                      referenceStamp.asset.source_metadata.whole_source_confirmed
                        ? ' và '
                        : ''}
                      {referenceStamp.asset.source_metadata.whole_source_confirmed ? 'K' : ''}.
                    </div>
                  )}
                  <p className="muted small">Kết quả được lưu tự động để xem lại và xuất báo cáo.</p>
                  {error && <ErrorBox error={new Error(error)} />}
                  <Button
                    disabled={busy || !title.trim() || !status.data?.is_configured}
                    onClick={() => void analyse()}
                  >
                    {analysing ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}
                    {analysing ? 'Đang so khớp…' : latest ? 'So khớp lại' : 'So khớp con dấu'}
                  </Button>
                  {analysing && (
                    <p className="demo-wait" role="status">
                      Đang xử lý hai ảnh. Thời gian chờ tối đa mỗi cặp: {status.data?.timeout_seconds} giây.
                      Vui lòng giữ trang mở.
                    </p>
                  )}
                </div>
              </section>
              {!analysing && results.isFetching && <Loading />}
              {!analysing && results.error && <ErrorBox error={results.error} />}
              {!analysing && latestMatches && latest && (
                <DemoResults result={latest} sessionId={analysisId} count={results.data?.length || 1} />
              )}
              {!analysing && latest && !latestMatches && (
                <div className="notice">
                  Ảnh đã thay đổi. Hãy so khớp lại để có kết quả cho Q/K hiện tại. Kết quả cũ vẫn được giữ
                  trong lịch sử.
                </div>
              )}
              {analysisId && (
                <p className="demo-history-link">
                  <Link to={`/compare/${analysisId}/results`}>
                    Mở phiên đã lưu · {analysisId.slice(0, 8)}
                  </Link>
                </p>
              )}
            </>
          )}
          <div className="demo-navigation">
            <Button
              variant="outline"
              disabled={step === 1 || busy}
              onClick={() => {
                setStep(step - 1);
              }}
            >
              <ArrowLeft size={16} />
              Quay lại
            </Button>
            <span>
              {step === 1
                ? source && reference
                  ? 'Đã có đủ hai tệp nguồn.'
                  : 'Tải văn bản và một ảnh dấu để tiếp tục.'
                : step === 2
                  ? queryStamp && referenceStamp
                    ? 'Q và K đã được lưu, sẵn sàng đối chiếu.'
                    : 'Kiểm tra và xác nhận vùng dấu ở cả hai ảnh.'
                  : 'Kết quả và báo cáo được lưu trong lịch sử.'}
            </span>
            {step < 3 && (
              <Button
                disabled={busy || (step === 1 ? !source || !reference : !queryStamp || !referenceStamp)}
                onClick={() => setStep(step + 1)}
              >
                {step === 1 ? 'Chọn vùng con dấu' : 'Tiếp tục so khớp'}
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
          <Disclaimer />
        </>
      )}
    </>
  );
}
function SourceFile({ asset }: { asset: Asset }) {
  return (
    <div className="demo-source-file">
      <Check size={18} />
      <div>
        <strong>{asset.original_filename}</strong>
        <small>
          {asset.page_count} trang / khung · {(asset.file_size / 1024).toFixed(0)} KB · {asset.media_type}
        </small>
      </div>
    </div>
  );
}
