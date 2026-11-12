import type { Result } from '../types';
import { scoreBand, scoreLabel } from '../lib/utils';
import { resultErrorMessage, resultScore } from '../lib/comparisonPresentation';
import { ErrorBox } from './shared';
import { ComparisonExplanation } from './ComparisonExplanation';

export function MatchSummary({ result }: { result: Result }) {
  if (result.result_status === 'error')
    return <ErrorBox error={new Error(resultErrorMessage(result.error_code))} />;
  const score = resultScore(result);
  return (
    <div className={`result-summary panel score-${scoreBand(score)}`}>
      <div className="score-circle">
        <strong>{score ?? '—'}</strong>
        <span>{score == null ? '/ 100' : '%'}</span>
      </div>
      <div>
        <p className="eyebrow">ĐIỂM TƯƠNG ĐỒNG</p>
        <h2>{scoreLabel(score)}</h2>
        {result.explanation ? (
          <ComparisonExplanation explanation={result.explanation} />
        ) : (
          <p>
            {score == null
              ? 'Chưa đủ dữ liệu để chấm điểm. Hãy kiểm tra vùng dấu và chất lượng ảnh rồi so khớp lại.'
              : 'Mức tương đồng giữa dấu cần kiểm tra và dấu đối chiếu.'}
          </p>
        )}
        <small>Thời gian xử lý: {result.duration_ms.toLocaleString('vi-VN')} ms</small>
      </div>
    </div>
  );
}
