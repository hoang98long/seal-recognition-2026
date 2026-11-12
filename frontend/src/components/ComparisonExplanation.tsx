import type { ComparisonExplanation as Explanation } from '../types';

export function ComparisonExplanation({ explanation }: { explanation: Explanation }) {
  return (
    <div className="match-explanation">
      <p className="match-conclusion">
        <strong>Kết luận:</strong> {explanation.conclusion}
      </p>
      {!!explanation.reasons.length && (
        <ul className="match-reasons" aria-label="Căn cứ đối chiếu">
          {explanation.reasons.map((reason, index) => (
            <li key={`${reason.kind}-${index}`}>
              <span className={`match-reason-label ${reason.kind}`}>
                {reason.kind === 'matching' ? 'Tương đồng' : 'Khác biệt'}
              </span>
              <span>{reason.text}</span>
            </li>
          ))}
        </ul>
      )}
      {explanation.limitation && (
        <p className="match-limitation">
          <strong>Lưu ý:</strong> {explanation.limitation}
        </p>
      )}
    </div>
  );
}
