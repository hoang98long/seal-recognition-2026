import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { LoaderCircle, RefreshCw, ScanLine } from 'lucide-react';
import { api, post, previewUrl } from '../../lib/api';
import { scoreBand, scoreLabel, statusLabel } from '../../lib/utils';
import { resultErrorMessage } from '../../lib/comparisonPresentation';
import type { Asset, ComparisonExplanation as Explanation, OpenAIStatus } from '../../types';
import { ComparisonExplanation } from '../../components/ComparisonExplanation';
import { Button } from '../../components/ui/button';
import { Disclaimer, ErrorBox, Loading, PageHeader, UploadBox } from '../../components/shared';
import { useAuth } from '../auth/Auth';
import { StampPreparation, type PreparedStamp } from '../document-demo/StampPreparation';
import '../document-demo/demo.css';
import '../organizations/workspace.css';

export interface LookupState {
  id: string;
  query_asset_id: string;
  title: string;
  status: string;
  total: number;
  processed: number;
  pending: number;
  successful: number;
  retry_count: number;
  insufficient_count: number;
  complete_scan: boolean;
  aggregation: string;
  errors: { candidate_id: string; code: string; message: string }[];
  rankings: {
    id: string;
    name: string;
    code: string | null;
    score: number;
    result_id: string;
    reference_asset_id: string;
    summary: string;
    explanation?: Explanation | null;
  }[];
}

export function OrganizationLookup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [sessionId, setSessionId] = useState(search.get('session') || '');
  const [asset, setAsset] = useState<Asset | null>(null);
  const [prepared, setPrepared] = useState<PreparedStamp | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadingAsset, setLoadingAsset] = useState(false);
  const submitRef = useRef(false);
  const linkedQ = search.get('q');
  const status = useQuery({
    queryKey: ['openai-status'],
    queryFn: () => api<OpenAIStatus>('/settings/openai/status'),
  });
  const inventory = useQuery({
    queryKey: ['search-inventory'],
    queryFn: () =>
      api<{ reference_count: number; organization_count: number; excluded_count: number }>(
        '/library-searches/inventory',
      ),
  });
  const job = useQuery({
    queryKey: ['lookup', sessionId],
    queryFn: () => api<LookupState>(`/library-searches/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.status || '') ? 1500 : false,
  });
  const running =
    submitting || (!!sessionId && job.isPending) || ['queued', 'running'].includes(job.data?.status || '');
  const busy = running || uploading || preparing || loadingAsset;
  const preparedCallback = useCallback((value: PreparedStamp | null) => {
    setPrepared(value);
    setError('');
  }, []);
  useEffect(() => {
    if (!linkedQ) return;
    let cancelled = false;
    setLoadingAsset(true);
    (async () => {
      const ready = await api<PreparedStamp | null>(`/preprocessing/by-output/${linkedQ}`);
      const a = ready?.asset || (await api<Asset>(`/assets/${linkedQ}`));
      if (!cancelled) {
        setAsset(a);
        setPrepared(ready);
      }
    })()
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingAsset(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedQ]);
  async function start(resume = false) {
    if (submitRef.current || !status.data?.is_configured || (!resume && !prepared)) return;
    submitRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (resume) await post(`/library-searches/${sessionId}/resume`, { consent: true });
      else {
        const result = await post<LookupState>('/library-searches', {
          query_asset_id: prepared!.asset.id,
          consent: true,
          expected_reference_count: inventory.data?.reference_count || 0,
          title: `Tra cứu ${asset?.original_filename || 'con dấu'}`.slice(0, 250),
        });
        qc.setQueryData(['lookup', result.id], result);
        setSessionId(result.id);
        setSearch({ session: result.id }, { replace: true });
      }
      await qc.invalidateQueries({ queryKey: ['lookup'] });
      await qc.invalidateQueries({ queryKey: ['history'] });
    } catch (e) {
      setError((e as Error).message);
      void inventory.refetch();
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }
  function reset() {
    if (busy) return;
    setAsset(null);
    setPrepared(null);
    setSessionId('');
    setError('');
    setSearch({}, { replace: true });
  }
  const retry = !!sessionId && !!job.data?.retry_count && !running;
  const qId = job.data?.query_asset_id || prepared?.asset.id;
  return (
    <>
      <PageHeader
        eyebrow="TRA CỨU THƯ VIỆN CON DẤU"
        title="Top 3 tổ chức có dấu tương đồng"
        description="Một dấu cần kiểm tra, đối chiếu với tất cả mẫu hợp lệ trong CSDL và xếp hạng theo tổ chức."
      >
        <Button variant="outline" disabled={busy} onClick={reset}>
          <RefreshCw size={16} />
          Tra cứu mới
        </Button>
      </PageHeader>
      <div className="workflow-guide">
        <Link to="/organizations">1. Tổ chức & thư viện dấu</Link>
        <span>2. Chuẩn bị dấu cần kiểm tra</span>
        <span>3. So khớp thư viện → Top 3</span>
      </div>
      {user?.role === 'viewer' ? (
        <div className="notice">Tài khoản chỉ xem có thể mở kết quả tra cứu đã lưu trong Lịch sử.</div>
      ) : (
        <>
          <div className="lookup-layout">
            <div>
              {!sessionId ? (
                <>
                  <section className="panel workspace-upload">
                    <h2>1. Tải dấu hoặc văn bản cần kiểm tra</h2>
                    <p className="muted">PDF, ảnh dấu đỏ hoặc đen. Chọn đúng trang rồi khoanh sát con dấu.</p>
                    <UploadBox
                      disabled={busy}
                      label="Tải dấu để tra cứu thư viện"
                      onBusyChange={setUploading}
                      onUploaded={(a) => {
                        setAsset(a);
                        setPrepared(null);
                        setError('');
                      }}
                    />
                  </section>
                  {loadingAsset && <Loading />}
                  {asset && prepared && asset.id === prepared.asset.id ? (
                    <section className="panel ready-reference">
                      <h2>Dấu Q đã chuẩn bị</h2>
                      <img src={previewUrl(prepared.asset.id)} alt="Dấu Q đã chuẩn bị để tra cứu" />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPrepared(null);
                        }}
                      >
                        Chỉnh lại vùng dấu từ ảnh này
                      </Button>
                    </section>
                  ) : (
                    asset && (
                      <StampPreparation
                        key={asset.id}
                        asset={asset}
                        role="Q"
                        initial={prepared}
                        onPrepared={preparedCallback}
                        onBusyChange={setPreparing}
                      />
                    )
                  )}
                </>
              ) : (
                <section className="panel ready-reference">
                  <h2>Dấu cần kiểm tra (Q)</h2>
                  {qId && <img src={previewUrl(qId)} alt="Dấu Q trong phiên tra cứu" />}
                  <p className="muted">Nguồn và thông số được giữ theo ảnh đã xác nhận.</p>
                </section>
              )}
            </div>
            <section className="panel workspace-upload lookup-confirm">
              <h2>2. So khớp thư viện</h2>
              {inventory.isPending ? (
                <Loading />
              ) : inventory.error ? (
                <ErrorBox error={inventory.error} />
              ) : (
                <>
                  <div className="lookup-count">
                    <strong>{sessionId ? (job.data?.total ?? '…') : inventory.data.reference_count}</strong>
                    <span>
                      cặp ảnh đối chiếu{!sessionId && ` · ${inventory.data.organization_count} tổ chức`}
                    </span>
                  </div>
                  <p>
                    Mỗi mẫu tham chiếu được so một lần với Q. Điểm tổ chức là điểm cao nhất trong các mẫu của
                    đơn vị đó; hiển thị tối đa 3 tổ chức khác nhau.
                  </p>
                  {!sessionId && inventory.data.excluded_count > 0 && (
                    <div className="notice">
                      Có {inventory.data.excluded_count} mẫu chưa đủ điều kiện (chưa xử lý hoặc đơn vị/mẫu
                      ngưng hoạt động), chưa tham gia tra cứu.
                    </div>
                  )}
                  {!sessionId && !inventory.data.reference_count && (
                    <div className="notice">
                      Chưa có mẫu sẵn sàng.{' '}
                      <Link to="/organizations">Mở tổ chức để tải tài liệu và thêm dấu.</Link>
                    </div>
                  )}
                  <p className="muted small">
                    {status.data?.is_configured
                      ? 'Sẵn sàng đối chiếu với các mẫu trong thư viện.'
                      : 'Dịch vụ so khớp chưa được cấu hình. Bạn vẫn có thể chuẩn bị ảnh.'}
                  </p>
                  <div className="score-legend">
                    <span className="score-badge score-green">&gt;90% tương đồng cao</span>
                    <span className="score-badge score-yellow">70–90% cần xem xét</span>
                    <span className="score-badge score-red">&lt;70% ít tương đồng</span>
                  </div>
                  {(!sessionId || retry) && (
                    <>
                      <Button
                        className="w-full"
                        disabled={
                          busy ||
                          !status.data?.is_configured ||
                          (!retry && (!prepared || !inventory.data.reference_count))
                        }
                        onClick={() => void start(retry)}
                      >
                        {submitting ? <LoaderCircle size={17} className="spin" /> : <ScanLine size={17} />}
                        {retry ? `Tiếp tục ${job.data?.retry_count} cặp còn lại / lỗi` : 'Tra cứu Top 3'}
                      </Button>
                    </>
                  )}
                  {!sessionId && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        void inventory.refetch();
                      }}
                    >
                      Đọc lại thư viện
                    </button>
                  )}
                </>
              )}
              {error && <ErrorBox error={new Error(error)} />}
              {sessionId &&
                (job.isPending ? (
                  <Loading />
                ) : job.error ? (
                  <ErrorBox error={job.error} />
                ) : (
                  <div className="lookup-progress" role="status">
                    <h3>{statusLabel[job.data.status] || job.data.status}</h3>
                    <progress max={job.data.total || 1} value={job.data.processed} />
                    <p>
                      Đã xử lý {job.data.processed}/{job.data.total} · có kết quả {job.data.successful} · lỗi{' '}
                      {job.data.errors.length}
                    </p>
                    <p className="muted small">
                      Bạn có thể mở lại phiên này từ Lịch sử. Nếu backend khởi động lại, dùng Tiếp tục khi
                      phiên được nhận diện gián đoạn.
                    </p>
                  </div>
                ))}
            </section>
          </div>
        </>
      )}
      {job.data && (
        <section className="lookup-results" aria-label="Top tổ chức tương đồng">
          <div className="panel-heading">
            <h2>
              {job.data.complete_scan
                ? 'Kết quả xếp hạng tổ chức'
                : 'Kết quả tạm thời · chưa quét đủ thư viện'}
            </h2>
            <Link to={`/compare/${sessionId}/results`}>Các cặp ảnh & báo cáo</Link>
          </div>
          <p className="muted">{job.data.aggregation}</p>
          {job.data.errors.map((e) => (
            <ErrorBox key={e.candidate_id} error={new Error(resultErrorMessage(e.code))} />
          ))}
          {job.data.insufficient_count > 0 && (
            <div className="notice">
              Có {job.data.insufficient_count} cặp không đủ dữ liệu; các cặp này không được gán điểm để xếp
              hạng.
            </div>
          )}
          <div className="organization-ranking">
            {job.data.rankings.map((item, i) => (
              <article key={item.id} className={`panel ranking-card score-${scoreBand(item.score)}`}>
                <div className="rank-heading">
                  <span className="rank-number">0{i + 1}</span>
                  <div>
                    <Link to={`/organizations/${item.id}`}>
                      <h2>{item.name}</h2>
                    </Link>
                    <small>{item.code}</small>
                  </div>
                  <strong className={`score-badge score-${scoreBand(item.score)}`}>{item.score}%</strong>
                </div>
                <div className="ranking-images">
                  {qId && <img src={previewUrl(qId)} alt="Dấu cần kiểm tra Q" />}
                  <img src={previewUrl(item.reference_asset_id)} alt={`Mẫu khớp nhất của ${item.name}`} />
                </div>
                <span className={`score-badge score-${scoreBand(item.score)}`}>{scoreLabel(item.score)}</span>
                {item.explanation && <ComparisonExplanation explanation={item.explanation} />}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/compare/${sessionId}/results?result=${item.result_id}`}>Xem ảnh đối chiếu</Link>
                </Button>
              </article>
            ))}
          </div>
          {!job.data.rankings.length && !running && (
            <p>
              Chưa có cặp đủ dữ liệu để xếp hạng. Kiểm tra vùng dấu, ảnh nguồn và trạng thái xử lý trước khi
              thử lại.
            </p>
          )}
        </section>
      )}
      <Disclaimer />
    </>
  );
}
