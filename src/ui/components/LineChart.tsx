export interface LinePoint {
  label: string;
  value: number | null;
}

/**
 * 의존성 없는 단일 시계열 SVG 라인차트.
 * 정상범위(refLow~refHigh)는 음영 밴드로, 범위를 벗어난 점은 빨간색으로 표시.
 */
export function LineChart({
  points,
  unit,
  refLow,
  refHigh,
  height = 220,
}: {
  points: LinePoint[];
  unit?: string;
  refLow?: number;
  refHigh?: number;
  height?: number;
}) {
  const width = 560;
  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 34;
  const iw = width - padL - padR;
  const ih = height - padT - padB;

  const nums = points.map((p) => p.value).filter((v): v is number => v != null);
  if (nums.length === 0) return <div className="muted small">표시할 수치가 없습니다.</div>;

  let min = Math.min(...nums, ...(refLow != null ? [refLow] : []));
  let max = Math.max(...nums, ...(refHigh != null ? [refHigh] : []));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;

  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - min) / (max - min)) * ih;

  const isAbnormal = (v: number) =>
    (refLow != null && v < refLow) || (refHigh != null && v > refHigh);

  // 정상범위 밴드(상·하한)
  const bandTop = refHigh != null ? y(refHigh) : padT;
  const bandBottom = refLow != null ? y(refLow) : padT + ih;

  // null은 건너뛰고 연속 점을 잇는다
  const linePts = points
    .map((p, i) => (p.value != null ? `${x(i)},${y(p.value)}` : null))
    .filter(Boolean)
    .join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" className="linechart">
      {/* 정상범위 밴드 */}
      {(refLow != null || refHigh != null) && (
        <rect
          x={padL}
          y={Math.min(bandTop, bandBottom)}
          width={iw}
          height={Math.abs(bandBottom - bandTop)}
          fill="var(--success-soft)"
          opacity={0.6}
        />
      )}
      {/* 축 */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke="var(--border)" />
      <line x1={padL} y1={padT + ih} x2={padL + iw} y2={padT + ih} stroke="var(--border)" />
      {/* y 라벨(최대/최소) */}
      <text x={padL - 6} y={padT + 4} textAnchor="end" className="linechart__axis">
        {Math.round(max)}
      </text>
      <text x={padL - 6} y={padT + ih} textAnchor="end" className="linechart__axis">
        {Math.round(min)}
      </text>
      {/* 선 */}
      <polyline points={linePts} fill="none" stroke="var(--primary)" strokeWidth={2} />
      {/* 점 + 값 + x라벨 */}
      {points.map((p, i) =>
        p.value == null ? null : (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={3.5}
              fill={isAbnormal(p.value) ? 'var(--danger)' : 'var(--primary)'}
            />
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="linechart__val">
              {p.value}
            </text>
          </g>
        ),
      )}
      {points.map((p, i) => (
        <text key={`l${i}`} x={x(i)} y={height - 12} textAnchor="middle" className="linechart__axis">
          {p.label}
        </text>
      ))}
      {unit && (
        <text x={padL} y={padT - 2} className="linechart__axis">
          ({unit})
        </text>
      )}
    </svg>
  );
}
