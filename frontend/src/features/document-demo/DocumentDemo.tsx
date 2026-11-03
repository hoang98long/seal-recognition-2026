import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import type { Analysis, Asset, Document, OpenAIStatus, Result } from '../../types';
import { Button } from '../../components/ui/button';
import { Disclaimer, ErrorBox, Loading, PageHeader, UploadBox } from '../../components/shared';
import { useAuth } from '../auth/Auth';
import { StampPreparation, type PreparedStamp } from './StampPreparation';
import { DemoResults } from './DemoResults';
import './demo.css';

export function DocumentDemo() {
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
  const [title, setTitle] = useState('Demo đối chiếu văn bản & ảnh dấu');
  const [consent, setConsent] = useState(false);
  const [analysisId, setAnalysisId] = useState('');
  const [error, setError] = useState('');
  const [uploadingQ, setUploadingQ] = useState(false);
  const [uploadingK, setUploadingK] = useState(false);
  const [savingQ, setSavingQ] = useState(false);
  const [savingK, setSavingK] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const submitting = useRef(false);
  const busy = uploadingQ || uploadingK || savingQ || savingK || analysing;
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
    setConsent(false);
    setError('');
  }, []);
  const preparedK = useCallback((value: PreparedStamp | null) => {
    setReferenceStamp(value);
    setConsent(false);
    setError('');
  }, []);
  function resetSession() {
    setAnalysisId('');
    setConsent(false);
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
    setTitle('Demo đối chiếu văn bản & ảnh dấu');
  }
  async function analyse() {
    if (
      submitting.current ||
      !source ||
      !queryStamp ||
      !referenceStamp ||
      !consent ||
      !status.data?.is_configured
    )
      return;
    submitting.current = true;
    setAnalysing(true);
    setError('');
    setConsent(false);
    let id = analysisId;
    try {
      const candidates = [{ reference_asset_id: referenceStamp.asset.id }];
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
        eyebrow="DEMO TỪ TẢI LÊN ĐẾN KẾT QUẢ"
        title="Văn bản & ảnh dấu"
        description="So sánh con dấu trong một văn bản với một ảnh dấu tải lên — thực hiện trọn luồng tại đây."
      >
        <Button variant="outline" disabled={busy} onClick={newDemo}>
          <RefreshCw size={16} />
          Bắt đầu demo mới
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
                Tải dữ liệu, chọn đúng trang và vùng dấu Q/K, kiểm tra trước khi gửi. Không cần tạo tổ chức
                hoặc mẫu trong thư viện.
              </p>
            </div>
            <span className="demo-local-badge">
              <ShieldCheck size={15} />
              Chỉ gửi sau khi xác nhận
            </span>
          </section>
          <div className="stepper demo-stepper">
            {['Tải văn bản & ảnh dấu', 'Chọn vùng và chuẩn bị Q/K', 'So khớp & xem kết quả'].map(
              (label, i) => (
                <div key={label} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}>
                  <span>{step > i + 1 ? <Check size={16} /> : `0${i + 1}`}</span>
                  <strong>{label}</strong>
                </div>
              ),
            )}
          </div>
          <div className="demo-provider-status">
            <span className={`badge ${status.data?.is_configured ? 'completed' : 'draft'}`}>
              {status.isPending
                ? 'Đang kiểm tra cấu hình OpenAI…'
                : status.data?.is_configured
                  ? `OpenAI đã cấu hình · ${status.data.model}`
                  : 'Chưa cấu hình khóa OpenAI'}
            </span>
            <button
              className="text-link"
              disabled={status.isFetching || analysing}
              onClick={() => void status.refetch()}
            >
              Đọc lại trạng thái
            </button>
            <span className="muted small">Upload và chuẩn bị ảnh chỉ xử lý nội bộ.</span>
          </div>
          {status.error && <ErrorBox error={status.error} />}
          {status.data && !status.data.is_configured && (
            <div className="notice">
              Chưa cấu hình OPENAI_API_KEY trong backend/.env. Bạn vẫn có thể tải lên và chuẩn bị Q/K; điền
              key và khởi động lại backend để so khớp. <Link to="/settings">Xem cài đặt</Link>
            </div>
          )}
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
                  label="Tải văn bản có con dấu"
                  onBusyChange={setUploadingQ}
                  onUploaded={async (asset) => {
                    const document = await post<Document>('/documents', {
                      file_asset_id: asset.id,
                      display_name: asset.original_filename,
                    });
                    setSource({ asset, document });
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
                    <p>Tải một ảnh con dấu mẫu để đối chiếu trực tiếp (K).</p>
                  </div>
                </div>
                <UploadBox
                  label="Tải ảnh dấu đối chiếu"
                  kind="original_stamp"
                  accept=".png,.jpg,.jpeg,.tif,.tiff,.webp"
                  description="PNG, JPG, TIFF hoặc WEBP; có thể chọn khung TIFF"
                  onBusyChange={setUploadingK}
                  onUploaded={(asset) => {
                    if (!asset.media_type.startsWith('image/'))
                      throw new Error('Ảnh K phải là PNG, JPG, TIFF hoặc WEBP.');
                    setReference(asset);
                    setReferenceVersion((v) => v + 1);
                    setReferenceStamp(null);
                    resetSession();
                  }}
                />
                {reference && <SourceFile asset={reference} />}
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
              <StampPreparation
                key={`K-${reference.id}-${referenceVersion}`}
                asset={reference}
                role="K"
                initial={referenceStamp}
                onPrepared={preparedK}
                onBusyChange={setSavingK}
              />
            </div>
          )}
          {step === 3 && queryStamp && referenceStamp && (
            <>
              <section className="panel demo-review">
                <div className="panel-heading">
                  <h2>Kiểm tra hai ảnh sẽ gửi tới OpenAI</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setConsent(false);
                      setStep(2);
                    }}
                  >
                    Chỉnh lại vùng / thông số
                  </Button>
                </div>
                <div className="comparison-images">
                  <figure>
                    <figcaption>Dấu trong văn bản (Q) · trang {queryStamp.run.source_page}</figcaption>
                    <img src={previewUrl(queryStamp.asset.id)} alt="Ảnh Q sẽ gửi OpenAI" />
                  </figure>
                  <figure>
                    <figcaption>Ảnh dấu đối chiếu (K)</figcaption>
                    <img src={previewUrl(referenceStamp.asset.id)} alt="Ảnh K sẽ gửi OpenAI" />
                  </figure>
                </div>
                <div className="demo-review-form">
                  <label>
                    Tên phiên demo
                    <input
                      value={title}
                      maxLength={250}
                      disabled={busy || !!analysisId}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <div className="call-summary">
                    <span>
                      Nhà cung cấp<strong>OpenAI Vision</strong>
                    </span>
                    <span>
                      Model<strong>{status.data?.model || 'Đang tải…'}</strong>
                    </span>
                    <span>
                      Số yêu cầu<strong>1 cặp Q/K</strong>
                    </span>
                    <span>
                      Chi phí<strong>Chưa xác định</strong>
                    </span>
                  </div>
                  {(queryStamp.asset.source_metadata.whole_source_confirmed ||
                    referenceStamp.asset.source_metadata.whole_source_confirmed) && (
                    <div className="notice">
                      Bạn đã chọn dùng toàn ảnh/trang cho{' '}
                      {queryStamp.asset.source_metadata.whole_source_confirmed ? 'Q' : ''}
                      {queryStamp.asset.source_metadata.whole_source_confirmed &&
                      referenceStamp.asset.source_metadata.whole_source_confirmed
                        ? ' và '
                        : ''}
                      {referenceStamp.asset.source_metadata.whole_source_confirmed ? 'K' : ''}. Toàn bộ nội
                      dung ảnh đó sẽ được gửi.
                    </div>
                  )}
                  <label className="check demo-consent">
                    <input
                      type="checkbox"
                      checked={consent}
                      disabled={busy}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Tôi được phép chia sẻ hai ảnh Q/K này và đồng ý gửi tới OpenAI để phân tích.
                  </label>
                  <p className="muted small">
                    Khóa lấy từ backend/.env, không đưa vào trình duyệt. Mỗi lần chạy cần xác nhận lại; kết
                    quả mới được lưu thành phiên bản riêng.
                  </p>
                  {error && <ErrorBox error={new Error(error)} />}
                  <Button
                    disabled={busy || !consent || !title.trim() || !status.data?.is_configured}
                    onClick={() => void analyse()}
                  >
                    {analysing ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}
                    {analysing
                      ? 'Đang so khớp bằng OpenAI…'
                      : latest
                        ? 'So khớp lại bằng OpenAI'
                        : 'So khớp bằng OpenAI'}
                  </Button>
                  {analysing && (
                    <p className="demo-wait" role="status">
                      Đang đợi OpenAI phân tích hai ảnh. Thời gian chờ tối đa mỗi cặp:{' '}
                      {status.data?.timeout_seconds} giây. Vui lòng giữ trang mở.
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
                setConsent(false);
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
                    : 'Chọn ROI và lưu cả Q, K trước khi tiếp tục.'
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
