import { useEffect, useRef, useState } from 'react';
import type { ROI } from '../../types';
import { Button } from '../ui/button';
import { Hand, Maximize, MousePointer2, ZoomIn, ZoomOut } from 'lucide-react';

export function RegionCanvas({
  src,
  width,
  height,
  roi,
  onChange,
  regions = [],
  readOnly = false,
}: {
  src: string;
  width: number;
  height: number;
  roi: ROI | null;
  onChange: (r: ROI) => void;
  regions?: { geometry: ROI; color: string; label: string }[];
  readOnly?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 600, h: 500 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(false);
  const [draft, setDraft] = useState<ROI | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    roi: ROI | null;
    handle: string;
    scrollX: number;
    scrollY: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setBoxSize({ w: el.clientWidth - 32, h: el.clientHeight - 32 }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    setZoom(1);
    setDraft(null);
  }, [src]);
  const scale = Math.min(boxSize.w / width, boxSize.h / height, 1) * zoom;
  const displayed = draft || roi;
  const point = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(width, Math.round(((e.clientX - rect.left) / rect.width) * width))),
      y: Math.max(0, Math.min(height, Math.round(((e.clientY - rect.top) / rect.height) * height))),
    };
  };
  function start(e: React.PointerEvent, handle = 'new') {
    if (readOnly && !pan) return;
    e.preventDefault();
    e.stopPropagation();
    const p = point(e);
    drag.current = {
      ...p,
      roi,
      handle,
      scrollX: box.current!.scrollLeft,
      scrollY: box.current!.scrollTop,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    svg.current!.setPointerCapture(e.pointerId);
    if (!pan && handle === 'new') setDraft({ x: p.x, y: p.y, width: 2, height: 2 });
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (pan) {
      box.current!.scrollLeft = d.scrollX - (e.clientX - d.clientX);
      box.current!.scrollTop = d.scrollY - (e.clientY - d.clientY);
      return;
    }
    const p = point(e);
    let r: ROI;
    if (d.handle === 'move' && d.roi) {
      r = {
        ...d.roi,
        x: Math.max(0, Math.min(width - d.roi.width, d.roi.x + p.x - d.x)),
        y: Math.max(0, Math.min(height - d.roi.height, d.roi.y + p.y - d.y)),
      };
    } else {
      const old = d.roi;
      const anchor =
        old && d.handle !== 'new'
          ? {
              x: d.handle.includes('w') ? old.x + old.width : old.x,
              y: d.handle.includes('n') ? old.y + old.height : old.y,
            }
          : { x: d.x, y: d.y };
      r = {
        x: Math.min(p.x, anchor.x),
        y: Math.min(p.y, anchor.y),
        width: Math.max(2, Math.abs(p.x - anchor.x)),
        height: Math.max(2, Math.abs(p.y - anchor.y)),
      };
      r.width = Math.min(r.width, width - r.x);
      r.height = Math.min(r.height, height - r.y);
    }
    setDraft(r);
  }
  function end(e: React.PointerEvent) {
    if (!drag.current) return;
    if (!pan && draft && draft.width >= 2 && draft.height >= 2) onChange(draft);
    drag.current = null;
    setDraft(null);
    if (svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);
  }
  const handleSize = 9 / Math.max(scale, 0.05);
  return (
    <div className="canvas-component">
      <div className="canvas-tools">
        <div>
          <Button
            size="icon"
            variant={!pan ? 'default' : 'ghost'}
            onClick={() => setPan(false)}
            aria-label="Chọn vùng"
          >
            <MousePointer2 size={16} />
          </Button>
          <Button
            size="icon"
            variant={pan ? 'default' : 'ghost'}
            onClick={() => setPan(true)}
            aria-label="Di chuyển ảnh"
          >
            <Hand size={16} />
          </Button>
        </div>
        <div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            aria-label="Thu nhỏ"
          >
            <ZoomOut size={17} />
          </Button>
          <span>{Math.round(scale * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setZoom(Math.min(8, zoom + 0.25))}
            aria-label="Phóng to"
          >
            <ZoomIn size={17} />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setZoom(1)} aria-label="Vừa màn hình">
            <Maximize size={16} />
          </Button>
        </div>
      </div>
      <div ref={box} className={`canvas-scroll ${pan ? 'panning' : ''}`}>
        <div className="canvas-image-wrap" style={{ width: width * scale, height: height * scale }}>
          <img src={src} alt="Ảnh nguồn để chọn vùng" draggable={false} />
          <svg
            ref={svg}
            viewBox={`0 0 ${width} ${height}`}
            onPointerDown={(e) => start(e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Vẽ vùng hình chữ nhật trên ảnh"
            className="roi-svg"
          >
            {regions.map((region, i) => (
              <g key={i}>
                <rect
                  {...region.geometry}
                  stroke={region.color}
                  fill={region.color}
                  fillOpacity=".12"
                  strokeWidth={2 / scale}
                />
                <title>{region.label}</title>
              </g>
            ))}
            {displayed && (
              <g>
                <path
                  d={`M0,0H${width}V${height}H0Z M${displayed.x},${displayed.y}v${displayed.height}h${displayed.width}v-${displayed.height}Z`}
                  fill="rgba(10,28,47,.3)"
                  fillRule="evenodd"
                  pointerEvents="none"
                />
                <rect
                  {...displayed}
                  fill="transparent"
                  stroke="#06b6d4"
                  strokeWidth={2 / scale}
                  onPointerDown={(e) => start(e, 'move')}
                />
                {!readOnly &&
                  [
                    ['nw', displayed.x, displayed.y],
                    ['ne', displayed.x + displayed.width, displayed.y],
                    ['sw', displayed.x, displayed.y + displayed.height],
                    ['se', displayed.x + displayed.width, displayed.y + displayed.height],
                  ].map(([key, x, y]) => (
                    <rect
                      key={key}
                      x={Number(x) - handleSize / 2}
                      y={Number(y) - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill="white"
                      stroke="#0891b2"
                      strokeWidth={1 / scale}
                      style={{ cursor: `${key}-resize` }}
                      onPointerDown={(e) => start(e, String(key))}
                    />
                  ))}
              </g>
            )}
          </svg>
        </div>
      </div>
      <div className="canvas-foot">
        {width} × {height} px{' '}
        <span>{pan ? 'Kéo để di chuyển ảnh' : 'Kéo để vẽ, di chuyển hoặc thay đổi kích thước ROI'}</span>
      </div>
    </div>
  );
}
