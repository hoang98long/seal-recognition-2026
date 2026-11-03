import { Link } from 'react-router-dom';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBox } from '../../components/shared';
import { dateTime, statusLabel, verdictLabel } from '../../lib/utils';
import type { Evidence, Result } from '../../types';

export function DemoResults({
  result,
  sessionId,
  count,
}: {
  result: Result;
  sessionId: string;
  count: number;
}) {
  const data = result.structured_result;
  return (
    <section className="demo-results" aria-label="Kết quả demo">
      <div className="demo-result-heading">
        <div>
          <p className="eyebrow">KẾT QUẢ ĐƯỢC LƯU TRONG LỊCH SỬ</p>
          <h2>Kết quả đối chiếu văn bản & ảnh dấu</h2>
          <p>
            {dateTime(result.created_at)} · {result.model_name} · {count} phiên bản kết quả
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/v1/reports/${sessionId}/export?download=true`}>
              <Download size={15} />
              Xuất báo cáo HTML
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/compare/${sessionId}/results`}>
              <ExternalLink size={15} />
              Mở kết quả đầy đủ
            </Link>
          </Button>
        </div>
      </div>
      {result.result_status === 'error' ? (
        <ErrorBox
          error={new Error(result.error_summary || 'Không phân tích được ảnh. Không có điểm tương đồng.')}
        />
      ) : (
        <>
          <div className="result-summary panel">
            <div className="score-circle">
              <strong>{data.visual_similarity_score ?? '—'}</strong>
              <span>/ 100</span>
            </div>
            <div>
              <p className="eyebrow">ĐIỂM TƯƠNG ĐỒNG DO AI ƯỚC LƯỢNG</p>
              <h2>{verdictLabel[data.verdict]}</h2>
              <p>{data.summary_vi}</p>
              <small>
                Mức tự tin thị giác: {statusLabel[data.visual_confidence_label]} · Chưa hiệu chuẩn
              </small>
            </div>
          </div>
          <div className="demo-evidence-grid">
            <EvidenceCard title="Điểm tương đồng" tone="similar" values={data.matching_features} />
            <EvidenceCard title="Điểm khác biệt" tone="different" values={data.differing_features} />
            <EvidenceCard title="Vùng chưa rõ" tone="uncertain" values={data.uncertain_features} />
          </div>
          <div className="panel demo-result-notes">
            <div className="form-grid">
              <div>
                <h3>Quan sát dấu trong văn bản (Q)</h3>
                <TextList values={data.observations_q} />
                <h4>Chữ đọc được</h4>
                <TextList values={data.text_recognition_q} />
              </div>
              <div>
                <h3>Quan sát ảnh dấu tham chiếu (K)</h3>
                <TextList values={data.observations_k} />
                <h4>Chữ đọc được</h4>
                <TextList values={data.text_recognition_k} />
              </div>
            </div>
            <h3>Hạn chế của phép so sánh</h3>
            <TextList values={data.limitations} />
            <h3>Khuyến nghị</h3>
            <p>{data.recommendation_vi}</p>
          </div>
        </>
      )}
      <details className="demo-technical panel">
        <summary>Thông tin lần gọi và nguồn ảnh</summary>
        <dl className="metadata-list">
          <div>
            <dt>Model / phiên bản prompt</dt>
            <dd>
              {result.model_name} / {result.prompt_version}
            </dd>
          </div>
          <div>
            <dt>Thời gian</dt>
            <dd>{result.duration_ms.toLocaleString('vi-VN')} ms</dd>
          </div>
          <div>
            <dt>Ảnh Q / trang văn bản</dt>
            <dd>
              {result.input_metadata.query.asset_id.slice(0, 8)} /{' '}
              {result.input_metadata.query.preprocessing?.source_page}
            </dd>
          </div>
          <div>
            <dt>Ảnh K</dt>
            <dd>{result.input_metadata.reference.asset_id.slice(0, 8)}</dd>
          </div>
          <div>
            <dt>Request ID</dt>
            <dd>{result.request_id_provider || 'Không có'}</dd>
          </div>
          <div>
            <dt>Chi phí</dt>
            <dd>Chưa xác định; không có bảng giá được cấu hình</dd>
          </div>
        </dl>
        <pre>{JSON.stringify(result.token_usage, null, 2)}</pre>
      </details>
    </section>
  );
}
function EvidenceCard({ title, tone, values }: { title: string; tone: string; values: Evidence[] }) {
  return (
    <section className={`panel demo-evidence ${tone}`}>
      <h3>{title}</h3>
      {values.length ? (
        values.map((item, i) => (
          <article key={i}>
            <span className="badge">
              {statusLabel[item.category] || 'Khác'} · {statusLabel[item.strength]}
            </span>
            <p>{item.description}</p>
            <small>{item.region_description}</small>
          </article>
        ))
      ) : (
        <p className="muted">Không có dấu hiệu được ghi nhận.</p>
      )}
    </section>
  );
}
function TextList({ values }: { values: string[] }) {
  return values.length ? (
    <ul className="simple-list">
      {values.map((value, i) => (
        <li key={i}>{value}</li>
      ))}
    </ul>
  ) : (
    <p className="muted small">Không có thông tin quan sát được ghi nhận.</p>
  );
}
