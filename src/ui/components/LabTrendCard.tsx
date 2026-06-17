import { useMemo, useState } from 'react';
import { buildLabTrend, defaultLabRange } from '@domain/checkup/labTrend';
import {
  resolveCheckupTypeName,
  type CheckupTypeItem,
  type HealthCheckup,
  type LabItem,
} from '@domain/checkup/HealthCheckup';
import { Card } from './ui';
import { LineChart, type LinePoint } from './LineChart';

function formatYearMonth(iso: string): string {
  return iso.slice(0, 7).replace('-', '.');
}

export function LabTrendCard({
  checkups,
  labItems,
  checkupTypes,
}: {
  checkups: HealthCheckup[];
  labItems: LabItem[];
  checkupTypes: CheckupTypeItem[];
}) {
  const thisYear = new Date().getFullYear();
  const fallback = defaultLabRange(thisYear);
  const [start, setStart] = useState(fallback.start);
  const [end, setEnd] = useState(fallback.end);
  const [view, setView] = useState<'table' | 'graph'>('table');
  const [graphCode, setGraphCode] = useState('');
  const trend = useMemo(
    () => buildLabTrend(checkups, { start, end }, labItems),
    [checkups, start, end, labItems],
  );

  const numericRows = trend.rows.filter((r) =>
    r.cells.some((c) => c.value != null && !Number.isNaN(Number(c.value))),
  );
  const selectedRow = numericRows.find((r) => r.code === graphCode) ?? numericRows[0];
  const points: LinePoint[] = selectedRow
    ? trend.columns.map((col, i) => {
        const raw = selectedRow.cells[i]?.value;
        const num = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        return { label: formatYearMonth(col.examDate), value: num };
      })
    : [];

  return (
    <Card
      title="검사 수치 추이"
      bodyClassName=""
      actions={
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 0 }}>
            <button
              className={`chip-toggle${view === 'table' ? ' active' : ''}`}
              onClick={() => setView('table')}
            >
              표
            </button>
            <button
              className={`chip-toggle${view === 'graph' ? ' active' : ''}`}
              onClick={() => setView('graph')}
            >
              그래프
            </button>
          </div>
          <input className="input lab-range" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="muted">~</span>
          <input className="input lab-range" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button
            className="btn btn--sm"
            onClick={() => {
              setStart(fallback.start);
              setEnd(fallback.end);
            }}
          >
            최근 5년
          </button>
        </div>
      }
    >
      {trend.columns.length === 0 ? (
        <div className="empty">
          <span className="ico">📈</span>해당 기간에 검사 수치 기록이 없어요.
        </div>
      ) : view === 'graph' ? (
        <div className="card__body">
          {numericRows.length === 0 ? (
            <div className="muted small">그래프로 표시할 수치 항목이 없어요.</div>
          ) : (
            <>
              <div className="toolbar">
                <select
                  className="select"
                  style={{ maxWidth: 240 }}
                  value={selectedRow?.code ?? ''}
                  onChange={(e) => setGraphCode(e.target.value)}
                >
                  {numericRows.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                      {r.unit ? ` (${r.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <LineChart
                points={points}
                unit={selectedRow?.unit}
                refLow={selectedRow?.def?.refLow}
                refHigh={selectedRow?.def?.refHigh}
              />
              <div className="muted small" style={{ marginTop: 6 }}>
                초록 음영은 정상범위, 빨간 점은 범위를 벗어난 값이에요.
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="table-wrap" style={{ border: 'none' }}>
          <table className="table lab-trend">
            <thead>
              <tr>
                <th className="lab-trend__item">검사항목</th>
                {trend.columns.map((c) => (
                  <th key={c.checkupId} className="num">
                    {formatYearMonth(c.examDate)}
                    <div className="muted small">
                      {resolveCheckupTypeName(c.type, checkupTypes).replace('건강진단', '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.rows.map((row) => (
                <tr key={row.code}>
                  <th className="lab-trend__item">
                    {row.name}
                    {row.unit ? <span className="muted small"> {row.unit}</span> : null}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className={`num${cell.abnormal ? ' lab-abn' : ''}`}>
                      {cell.value ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
