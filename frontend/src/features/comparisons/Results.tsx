import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Download, ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, post, previewUrl } from '../../lib/api';
import { dateTime, scoreBand, scoreLabel, statusLabel, verdictLabel } from '../../lib/utils';
import type { Analysis, Annotation, Asset, Evidence, Result, ROI } from '../../types';
import { Disclaimer, Empty, ErrorBox, Loading, PageHeader } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { RegionCanvas } from '../../components/image-editor/RegionCanvas';
import { useAuth } from '../auth/Auth';

export function Results() {
  const { sessionId } = useParams();
  const [search] = useSearchParams();
  const [selected, setSelected] = useState(search.get('result') || '');
  const [tab, setTab] = useState('summary');
  const [swap, setSwap] = useState(false);
  const [sync, setSync] = useState(true);
  const [zoomQ, setZoomQ] = useState(1);
  const [zoomK, setZoomK] = useState(1);
  const [overlay, setOverlay] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const session = useQuery({
    queryKey: ['analysis', sessionId],
    queryFn: () => api<Analysis>(`/analyses/${sessionId}`),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
  const results = useQuery({
    queryKey: ['results', sessionId],
    queryFn: () => api<Result[]>(`/analyses/${sessionId}/results`),
    refetchInterval: session.data?.status === 'running' ? 2000 : false,
  });
  const result = results.data?.find((r) => r.id === selected) || results.data?.[0];
  const q = result?.input_metadata.query.asset_id;
  const k = result?.input_metadata.reference.asset_id;
  const qAsset = useQuery({
    queryKey: ['asset', q],
    queryFn: () => api<Asset>(`/assets/${q}`),
    enabled: !!q,
  });
  const kAsset = useQuery({
    queryKey: ['asset', k],
    queryFn: () => api<Asset>(`/assets/${k}`),
    enabled: !!k,
  });
  if (session.isPending || results.isPending) return <Loading />;
  if (session.error || results.error) return <ErrorBox error={session.error || results.error} />;
  const canOverlay = qAsset.data?.width === kAsset.data?.width && qAsset.data?.height === kAsset.data?.height;
  const data = result?.structured_result;
  return (
    <>
      <PageHeader
        eyebrow="RÉSULTAT · KẾT QUẢ ĐỐI CHIẾU"
        title={session.data.title}
        description={`Phiên ${sessionId?.slice(0, 8)} · ${dateTime(session.data.created_at)} · ${statusLabel[session.data.status]}`}
      >
        <Button variant="outline" asChild>
          <a href={`/api/v1/reports/${sessionId}`} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Xem / in báo cáo
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/api/v1/reports/${sessionId}/export?download=true`}>
            <Download size={16} />
            Xuất HTML
          </a>
        </Button>
        {session.data.mode === 'organization_search' && (
          <Button asChild>
            <Link to={`/compare/library?session=${sessionId}`}>Top 3 & tiến độ tra cứu</Link>
          </Button>
        )}
        {q && k && session.data.mode !== 'organization_search' && (
          <Button asChild>
            <Link to={`/compare/new?session=${sessionId}&q=${q}&k=${k}`}>
              <RotateCcw size={16} />
              So sánh lại sau tiền xử lý
            </Link>
          </Button>
        )}
      </PageHeader>
      <Disclaimer />
      {!result ? (
        <Empty
          title={session.data.status === 'running' ? 'Đang chờ OpenAI phản hồi' : 'Phiên chưa có kết quả'}
          description="Mọi lần chạy được lưu thành kết quả mới. Có thể tiếp tục phiên với các ảnh đã chọn."
        >
          <Button asChild>
            <Link
              to={`/compare/new?session=${sessionId}&q=${session.data.query_asset_id}&k=${session.data.candidates[0]?.reference_asset_id || ''}`}
            >
              Tiếp tục phiên
            </Link>
          </Button>
        </Empty>
      ) : (
        <>
          <div className="result-toolbar">
            <label>
              Phiên bản / ảnh tham chiếu
              <select value={result.id} onChange={(e) => setSelected(e.target.value)}>
                {results.data.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    #{results.data.length - i} · {dateTime(r.created_at)} · {statusLabel[r.result_status]} · K{' '}
                    {r.input_metadata.reference.asset_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <span className="badge">{result.model_name}</span>
            <span className="muted">{result.duration_ms.toLocaleString('vi-VN')} ms</span>
          </div>
          {result.result_status === 'error' ? (
            <ErrorBox
              error={new Error(result.error_summary || 'Không phân tích được ảnh. Không có điểm tương đồng.')}
            />
          ) : (
            <div className={`result-summary panel score-${scoreBand(data?.visual_similarity_score)}`}>
              <div className="score-circle">
                <strong>{data?.visual_similarity_score ?? '—'}</strong>
                <span>/ 100</span>
              </div>
              <div>
                <p className="eyebrow">ĐIỂM TƯƠNG ĐỒNG DO AI ƯỚC LƯỢNG</p>
                <h2>{verdictLabel[result.verdict]}</h2>
                <span className={`score-badge score-${scoreBand(data?.visual_similarity_score)}`}>
                  {scoreLabel(data?.visual_similarity_score)}
                </span>
                <p>{data?.summary_vi}</p>
                <small>
                  Mức tự tin thị giác: {statusLabel[data?.visual_confidence_label || 'low']} · Chưa hiệu chuẩn
                </small>
              </div>
            </div>
          )}
          <section className="panel result-images-panel">
            <div className="panel-heading">
              <h2>Đối chiếu hình ảnh</h2>
              <div className="row-actions">
                <label className="check">
                  <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />
                  Zoom đồng bộ
                </label>
                <Button size="sm" variant="ghost" onClick={() => setSwap(!swap)}>
                  <ArrowLeftRight size={15} />
                  Hoán đổi hiển thị
                </Button>
                <Button
                  size="sm"
                  variant={overlay ? 'default' : 'outline'}
                  disabled={!canOverlay}
                  onClick={() => setOverlay(!overlay)}
                >
                  Chồng ảnh
                </Button>
              </div>
            </div>
            {overlay && canOverlay ? (
              <div className="overlay-area">
                <p className="notice">Overlay tham khảo, chưa căn chỉnh hình học.</p>
                <label>
                  Độ mờ ảnh K
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </label>
                <div
                  className="overlay-images"
                  style={{ aspectRatio: `${qAsset.data?.width}/${qAsset.data?.height}` }}
                >
                  <img src={previewUrl(q!)} alt="Q nền" />
                  <img src={previewUrl(k!)} alt="K chồng lên Q" style={{ opacity }} />
                </div>
              </div>
            ) : (
              <div className={`comparison-images ${swap ? 'swapped' : ''}`}>
                {(
                  [
                    { id: q, role: 'Q', zoom: zoomQ, setZoom: setZoomQ },
                    { id: k, role: 'K', zoom: zoomK, setZoom: setZoomK },
                  ] as const
                ).map((item) => (
                  <figure key={item.role} className={`image-${item.role}`}>
                    <figcaption>
                      {item.role === 'Q' ? 'Dấu cần kiểm tra (Q)' : 'Dấu đối chiếu (K)'}
                    </figcaption>
                    <div className="zoom-image">
                      <img
                        src={previewUrl(item.id!)}
                        alt={`Ảnh ${item.role}`}
                        style={{ transform: `scale(${item.zoom})` }}
                      />
                    </div>
                    <label>
                      Phóng to {item.zoom.toFixed(1)}×
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step=".1"
                        value={item.zoom}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          item.setZoom(value);
                          if (sync) {
                            setZoomQ(value);
                            setZoomK(value);
                          }
                        }}
                      />
                    </label>
                    {result.input_metadata[item.role === 'Q' ? 'query' : 'reference'].preprocessing?.id && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to={`/preprocessing/${result.input_metadata[item.role === 'Q' ? 'query' : 'reference'].preprocessing.id}`}
                        >
                          Mở ảnh nguồn & thông số
                        </Link>
                      </Button>
                    )}
                  </figure>
                ))}
              </div>
            )}
            {!canOverlay && (
              <p className="image-note">
                Chồng ảnh khả dụng khi hai ảnh có cùng kích thước. V1 chưa tự căn chỉnh hình học.
              </p>
            )}
          </section>
          <section className="panel result-details">
            <div className="tabs">
              {[
                ['summary', 'Tổng quan'],
                ['matching', 'Điểm tương đồng'],
                ['differing', 'Điểm khác biệt'],
                ['uncertain', 'Vùng chưa rõ'],
                ['technical', 'Chi tiết kỹ thuật'],
                ['annotations', 'Khoanh vùng'],
              ].map(([key, title]) => (
                <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                  {title}
                </button>
              ))}
            </div>
            <div className="tab-content">
              {tab === 'summary' && (
                <>
                  <div className="form-grid">
                    <div>
                      <h3>Quan sát ảnh Q</h3>
                      <StringList values={data?.observations_q || []} />
                      <h4>Chữ đọc được</h4>
                      <StringList values={data?.text_recognition_q || []} />
                    </div>
                    <div>
                      <h3>Quan sát ảnh K</h3>
                      <StringList values={data?.observations_k || []} />
                      <h4>Chữ đọc được</h4>
                      <StringList values={data?.text_recognition_k || []} />
                    </div>
                  </div>
                  <h3>Hạn chế</h3>
                  <StringList values={data?.limitations || []} />
                  <h3>Khuyến nghị</h3>
                  <p>{data?.recommendation_vi || 'Chưa có khuyến nghị.'}</p>
                </>
              )}
              {tab === 'matching' && <EvidenceList values={data?.matching_features || []} tone="similar" />}
              {tab === 'differing' && (
                <EvidenceList values={data?.differing_features || []} tone="different" />
              )}
              {tab === 'uncertain' && (
                <EvidenceList values={data?.uncertain_features || []} tone="uncertain" />
              )}
              {tab === 'technical' && (
                <>
                  <dl className="metadata-list">
                    {[
                      ['Nhà cung cấp', 'OpenAI Vision'],
                      ['Model', result.model_name],
                      ['Phiên bản SDK', result.provider_version],
                      ['Phiên bản prompt', result.prompt_version],
                      ['Mã yêu cầu', result.request_id_provider || 'Không có'],
                      ['Thời gian xử lý', `${result.duration_ms} ms`],
                      ['Chi phí', 'Chưa xác định'],
                      ['Hiệu chuẩn', 'Chưa hiệu chuẩn'],
                      ['SHA256 ảnh Q', result.input_metadata.query.sha256],
                      ['SHA256 ảnh K', result.input_metadata.reference.sha256],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <h3>Sử dụng token</h3>
                  <pre>{JSON.stringify(result.token_usage, null, 2)}</pre>
                  <h3>Thông số và nguồn ảnh đã lưu</h3>
                  <pre>{JSON.stringify(result.input_metadata, null, 2)}</pre>
                </>
              )}
              {tab === 'annotations' && qAsset.data && kAsset.data && (
                <Annotations result={result} q={qAsset.data} k={kAsset.data} />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
function StringList({ values }: { values: string[] }) {
  return values.length ? (
    <ul className="simple-list">
      {values.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>
  ) : (
    <p className="muted">Không có thông tin quan sát được ghi nhận.</p>
  );
}
function EvidenceList({ values, tone }: { values: Evidence[]; tone: string }) {
  return values.length ? (
    <div className="evidence-list">
      {values.map((e, i) => (
        <article key={i} className={tone}>
          <div>
            <span className="badge">{statusLabel[e.category]}</span>
            <span className="muted">Mức độ: {statusLabel[e.strength]}</span>
          </div>
          <h3>{e.description}</h3>
          <p>Vị trí mô tả: {e.region_description}</p>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      title="Không có dấu hiệu được ghi nhận"
      description="Vùng không quan sát rõ không được tự coi là khác biệt."
    />
  );
}
function Annotations({ result, q, k }: { result: Result; q: Asset; k: Asset }) {
  const [role, setRole] = useState<'Q' | 'K'>('Q');
  const [rect, setRect] = useState<ROI | null>(null);
  const [label, setLabel] = useState('uncertain');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const asset = role === 'Q' ? q : k;
  const colors: Record<string, string> = {
    similar: '#059669',
    different: '#dc2626',
    uncertain: '#d97706',
    user_note: '#2563eb',
  };
  const regions = result.annotations
    .filter((a) => a.image_role === role)
    .map((a) => ({
      geometry: {
        x: a.geometry.x * asset.width,
        y: a.geometry.y * asset.height,
        width: a.geometry.width * asset.width,
        height: a.geometry.height * asset.height,
      },
      color: colors[a.label],
      label: a.note || statusLabel[a.label],
    }));
  return (
    <>
      <div className="notice subtle">
        Khoanh vùng do người dùng vẽ, không phải tọa độ do AI xác định. Xanh lá: tương đồng · Đỏ: khác biệt ·
        Vàng: chưa rõ · Xanh dương: ghi chú.
      </div>
      <div className="annotation-tools">
        <select
          aria-label="Ảnh khoanh vùng"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as 'Q' | 'K');
            setRect(null);
          }}
        >
          <option value="Q">Ảnh Q</option>
          <option value="K">Ảnh K</option>
        </select>
        <select aria-label="Loại đánh dấu" value={label} onChange={(e) => setLabel(e.target.value)}>
          {Object.keys(colors).map((key) => (
            <option key={key} value={key}>
              {statusLabel[key]}
            </option>
          ))}
        </select>
        <input
          aria-label="Ghi chú vùng"
          placeholder="Ghi chú vùng quan sát…"
          value={note}
          maxLength={3000}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          disabled={!rect || busy || user?.role === 'viewer'}
          onClick={async () => {
            if (!rect) return;
            setBusy(true);
            try {
              await post<Annotation>(`/analysis-results/${result.id}/annotations`, {
                image_role: role,
                label,
                note,
                geometry: {
                  x: rect.x / asset.width,
                  y: rect.y / asset.height,
                  width: rect.width / asset.width,
                  height: rect.height / asset.height,
                },
              });
              setRect(null);
              setNote('');
              await qc.invalidateQueries({ queryKey: ['results', result.session_id] });
              toast.success('Đã lưu vùng đánh dấu thủ công.');
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus size={15} />
          Lưu vùng
        </Button>
      </div>
      <RegionCanvas
        src={previewUrl(asset.id)}
        width={asset.width}
        height={asset.height}
        roi={rect}
        onChange={setRect}
        regions={regions}
        readOnly={user?.role === 'viewer'}
      />
      <ul className="annotation-list">
        {result.annotations.map((a) => (
          <li key={a.id}>
            <span style={{ color: colors[a.label] }}>●</span>
            <strong>
              {a.image_role} · {statusLabel[a.label]}
            </strong>
            <span>{a.note}</span>
            <small>Người dùng · {dateTime(a.created_at)}</small>
            {user?.role !== 'viewer' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Xóa đánh dấu"
                onClick={async () => {
                  try {
                    await api(`/annotations/${a.id}`, { method: 'DELETE' });
                    await qc.invalidateQueries({ queryKey: ['results', result.session_id] });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 size={15} />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
