import { Link } from 'react-router-dom';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { MatchSummary } from '../../components/MatchSummary';
import { dateTime } from '../../lib/utils';
import type { Result } from '../../types';

export function DemoResults({
  result,
  sessionId,
  count,
}: {
  result: Result;
  sessionId: string;
  count: number;
}) {
  return (
    <section className="demo-results" aria-label="Kết quả so khớp">
      <div className="demo-result-heading">
        <div>
          <p className="eyebrow">KẾT QUẢ ĐƯỢC LƯU TRONG LỊCH SỬ</p>
          <h2>Kết quả đối chiếu văn bản & ảnh dấu</h2>
          <p>
            {dateTime(result.created_at)} · {count} phiên bản kết quả
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
              Xem ảnh đối chiếu
            </Link>
          </Button>
        </div>
      </div>
      <MatchSummary result={result} />
    </section>
  );
}
