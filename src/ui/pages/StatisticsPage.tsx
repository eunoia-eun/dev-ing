import { useState } from 'react';
import { HEALTH_GRADE_LABEL, gradeTone, type HealthGrade } from '@domain/checkup/HealthCheckup';
import {
  AGE_BUCKETS,
  STAT_DIMENSIONS,
  STAT_DIMENSION_LABEL,
  type StatDimension,
} from '@domain/stats/Demographics';
import type { MonthlyMatrix } from '@domain/stats/Statistics';
import { PROGRAM_STATUS_LABEL } from '@domain/program/HealthProgram';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Spinner, Stat } from '../components/ui';
import { LineChart, type LinePoint } from '../components/LineChart';
import { downloadCsv } from '../csv';
import { formatDate } from '../format';

/** 매트릭스를 CSV 행렬로 (헤더 + 그룹행 + 합계행) */
function matrixToRows(
  matrix: MonthlyMatrix,
  groupHeader: string,
): (string | number)[][] {
  const header = [groupHeader, ...matrix.months.map(monthLabel), '합계'];
  const body = matrix.groups.map((g) => [
    g,
    ...matrix.months.map((m) => matrix.counts[g]?.[m] ?? 0),
    matrix.totalByGroup[g] ?? 0,
  ]);
  const total = ['합계', ...matrix.months.map((m) => matrix.totalByMonth[m] ?? 0), matrix.grandTotal];
  return [header, ...body, total];
}

/** 판정 등급을 카테고리로 묶은 컬럼 정의 (정상 A / 요관찰 C1·C2·CN / 유소견 D1·D2 / 재검 R) */
const GRADE_GROUPS: { label: string; danger?: boolean; grades: HealthGrade[] }[] = [
  { label: '정상', grades: ['A'] },
  { label: '요관찰', grades: ['C1', 'C2', 'CN'] },
  { label: '유소견', danger: true, grades: ['D1', 'D2'] },
  { label: '재검', grades: ['R'] },
];
const GRADE_COLS: HealthGrade[] = GRADE_GROUPS.flatMap((g) => g.grades);

/** 'YYYY-MM' → "YY.MM" */
function monthLabel(m: string): string {
  return m.length >= 7 ? `${m.slice(2, 4)}.${m.slice(5, 7)}` : m;
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function StatisticsPage() {
  const [dim, setDim] = useState<StatDimension>('department');

  return (
    <div className="stack">
      <WorkforceCard />

      <div className="toolbar">
        <span className="muted small" style={{ alignSelf: 'center' }}>
          분석 기준
        </span>
        {STAT_DIMENSIONS.map((d) => (
          <button
            key={d}
            className={`chip-toggle${dim === d ? ' active' : ''}`}
            onClick={() => setDim(d)}
          >
            {STAT_DIMENSION_LABEL[d]}
          </button>
        ))}
      </div>

      <CheckupFindingsCard dimension={dim} />
      <ExposureStatsCard dimension={dim} />
      <ProgramStatsCard dimension={dim} />
      <MonthlyActivityCards dimension={dim} />
      <SymptomTrendCard dimension={dim} />
    </div>
  );
}

/** 작은 ⬇엑셀 버튼 */
function ExcelButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn--sm" onClick={onClick} title="엑셀(CSV) 다운로드">
      ⬇ 엑셀
    </button>
  );
}

/** 인구 현황 — 성별 / 나이대 / 국적(외국인) */
function WorkforceCard() {
  const { statistics } = useServices();
  const w = useAsync(() => statistics.getWorkforceSummary(), []);
  const d = w.data;

  function exportCsv() {
    if (!d) return;
    const rows: (string | number)[][] = [
      ['구분', '항목', '인원'],
      ['성별', '남', d.gender.male],
      ['성별', '여', d.gender.female],
      ...(d.gender.unknown > 0 ? [['성별', '미상', d.gender.unknown]] : []),
      ...AGE_BUCKETS.filter((b) => d.age[b] > 0).map((b) => ['나이대', b, d.age[b]]),
      ['국적', '내국인', d.nationality.domestic],
      ['국적', '외국인', d.nationality.foreign],
      ['총원', '활성 임직원', d.total],
    ];
    downloadCsv('인구현황.csv', rows);
  }

  return (
    <Card title="인구 현황" actions={d ? <ExcelButton onClick={exportCsv} /> : undefined}>
      {w.loading ? (
        <Spinner />
      ) : w.error ? (
        <ErrorAlert message={w.error} />
      ) : !d ? null : (
        <div className="stack" style={{ gap: 14 }}>
          <div className="muted small">활성 임직원 총 {d.total}명</div>
          <div className="grid grid--2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>성별</label>
              <div className="row row--wrap" style={{ gap: 6 }}>
                <span className="badge badge--info">남 {d.gender.male}명</span>
                <span className="badge badge--info">여 {d.gender.female}명</span>
                {d.gender.unknown > 0 && <span className="badge badge--muted">미상 {d.gender.unknown}명</span>}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>국적</label>
              <div className="row row--wrap" style={{ gap: 6 }}>
                <span className="badge badge--success">내국인 {d.nationality.domestic}명</span>
                <span className="badge badge--warning">외국인 {d.nationality.foreign}명</span>
              </div>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>나이대</label>
            <div className="row row--wrap" style={{ gap: 6 }}>
              {AGE_BUCKETS.every((b) => d.age[b] === 0) ? (
                <span className="muted small">생년월일 정보 없음</span>
              ) : (
                AGE_BUCKETS.filter((b) => d.age[b] > 0).map((b) => (
                  <span key={b} className="badge badge--muted">
                    {b} {d.age[b]}명
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** ① 검진 유소견 현황 */
function CheckupFindingsCard({ dimension }: { dimension: StatDimension }) {
  const { statistics } = useServices();
  const years = useAsync(() => statistics.getCheckupYears(), []);
  const [year, setYear] = useState<number | ''>(''); // '' = 전체(임직원별 최근 검진)
  const stats = useAsync(
    () => statistics.getCheckupFindings(dimension, year === '' ? undefined : year),
    [dimension, year],
  );
  const s = stats.data;

  function exportCsv() {
    if (!s) return;
    const dimLabel = STAT_DIMENSION_LABEL[dimension].replace('별', '');
    // 카테고리 행 + 등급 행(2단 헤더를 CSV 두 줄로)
    const categoryHeader = ['', '', ...GRADE_GROUPS.flatMap((g) => g.grades.map(() => g.label))];
    const gradeHeader = [dimLabel, '검진', ...GRADE_COLS];
    const rows: (string | number)[][] = [
      categoryHeader,
      gradeHeader,
      ...s.rows.map((r) => [r.group, r.total, ...GRADE_COLS.map((g) => r.byGrade[g] || 0)]),
      ['합계', s.examined, ...GRADE_COLS.map((g) => s.byGrade[g] || 0)],
      [],
      ['관리대상자 명단'],
      ['이름', '부서', dimLabel, '판정', '검진일'],
      ...s.managed.map((m) => [m.name, m.department, m.group, HEALTH_GRADE_LABEL[m.grade], formatDate(m.examDate)]),
    ];
    downloadCsv(`검진유소견_${dimension}_${year || '최근'}.csv`, rows);
  }

  return (
    <Card
      title="검진 유소견 현황"
      bodyClassName=""
      actions={
        <div className="row" style={{ gap: 6 }}>
          <select
            className="select"
            style={{ maxWidth: 180 }}
            value={year}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">전체 (최근 검진 기준)</option>
            {(years.data ?? []).map((y) => (
              <option key={y} value={y}>
                {y}년 검진
              </option>
            ))}
          </select>
          <ExcelButton onClick={exportCsv} />
        </div>
      }
    >
      {stats.loading ? (
        <Spinner />
      ) : stats.error ? (
        <ErrorAlert message={stats.error} />
      ) : !s ? null : (
        <div className="card__body stack">
          <div className="grid grid--stats">
            <Stat
              label="유소견자 (D)"
              value={`${s.byCategory.finding}명`}
              tone="danger"
              hint={`D1 ${s.byGrade.D1}명 · D2 ${s.byGrade.D2}명`}
            />
            <Stat
              label="요관찰자 (C)"
              value={`${s.byCategory.watch}명`}
              tone="warning"
              hint={`C1 ${s.byGrade.C1}명 · C2 ${s.byGrade.C2}명 · CN ${s.byGrade.CN}명`}
            />
            <Stat label="재검 (R)" value={`${s.byGrade.R}명`} tone="info" hint="제2차 검진대상" />
            <Stat label="정상 (A)" value={`${s.byGrade.A}명`} tone="success" />
            <Stat label="미수검" value={`${s.notExamined}명`} hint={`검진 ${s.examined}명 / 활성 ${s.examined + s.notExamined}명`} />
          </div>

          {s.examined === 0 ? (
            <EmptyState icon="🩺">해당 기준의 검진 기록이 없습니다.</EmptyState>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table table--grid">
                <thead>
                  {/* 1단: 카테고리 묶음 */}
                  <tr>
                    <th rowSpan={2}>{STAT_DIMENSION_LABEL[dimension].replace('별', '')}</th>
                    <th rowSpan={2} className="num">
                      검진
                    </th>
                    {GRADE_GROUPS.map((g) => (
                      <th
                        key={g.label}
                        className="num"
                        colSpan={g.grades.length}
                        style={g.danger ? { color: 'var(--danger)' } : undefined}
                      >
                        {g.label}
                      </th>
                    ))}
                  </tr>
                  {/* 2단: 등급별 */}
                  <tr>
                    {GRADE_COLS.map((grade) => (
                      <th key={grade} className="num" title={HEALTH_GRADE_LABEL[grade]}>
                        {grade}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.group}>
                      <td>
                        <strong>{r.group}</strong>
                      </td>
                      <td className="num">{r.total}</td>
                      {GRADE_GROUPS.flatMap((g) =>
                        g.grades.map((grade) => {
                          const v = r.byGrade[grade] || 0;
                          return (
                            <td key={grade} className="num">
                              {v ? (
                                g.danger ? (
                                  <strong style={{ color: 'var(--danger)' }}>{v}</strong>
                                ) : (
                                  v
                                )
                              ) : (
                                '-'
                              )}
                            </td>
                          );
                        }),
                      )}
                    </tr>
                  ))}
                  {/* 합계(= 전체 등급별 인원) */}
                  <tr className="group-row">
                    <td>합계</td>
                    <td className="num">
                      <strong>{s.examined}</strong>
                    </td>
                    {GRADE_COLS.map((grade) => (
                      <td key={grade} className="num">
                        <strong>{s.byGrade[grade] || 0}</strong>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {s.managed.length > 0 && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>관리대상자 명단 ({s.managed.length}명)</label>
              <div className="table-wrap" style={{ maxHeight: 260 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>부서</th>
                      <th>{STAT_DIMENSION_LABEL[dimension].replace('별', '')}</th>
                      <th>판정</th>
                      <th>검진일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.managed.map((m) => (
                      <tr key={m.employeeId}>
                        <td>
                          <strong>{m.name}</strong>
                        </td>
                        <td>{m.department}</td>
                        <td className="small">{m.group}</td>
                        <td>
                          <span className={`badge badge--${gradeTone(m.grade)}`}>
                            {HEALTH_GRADE_LABEL[m.grade]}
                          </span>
                        </td>
                        <td className="small">{formatDate(m.examDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="muted small">
            ※ {year === '' ? '임직원별 가장 최근 검진' : `${year}년 검진`} 기준. 등급 분류: 정상(A) · 요관찰(C1·C2·CN) ·
            유소견(D1·D2) · 재검(R).
          </div>
        </div>
      )}
    </Card>
  );
}

/** ②③ 월별 상담·내원 / 약 반출 현황 */
function MonthlyActivityCards({ dimension }: { dimension: StatDimension }) {
  const { statistics } = useServices();
  const [start, setStart] = useState(monthsAgo(11));
  const [end, setEnd] = useState(currentMonth());
  const stats = useAsync(
    () => statistics.getMonthlyActivity(dimension, start, end),
    [dimension, start, end],
  );

  const dimLabel = STAT_DIMENSION_LABEL[dimension].replace('별', '');
  const range = (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <input className="input lab-range" type="month" value={start} onChange={(e) => setStart(e.target.value)} />
      <span className="muted">~</span>
      <input className="input lab-range" type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
      <button
        className="btn btn--sm"
        onClick={() => {
          setStart(monthsAgo(11));
          setEnd(currentMonth());
        }}
      >
        최근 12개월
      </button>
    </div>
  );

  return (
    <>
      <Card
        title="월별 상담·내원 현황"
        bodyClassName=""
        actions={
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {range}
            {stats.data && (
              <ExcelButton
                onClick={() =>
                  downloadCsv(`월별상담내원_${dimension}_${start}_${end}.csv`, matrixToRows(stats.data!.visits, dimLabel))
                }
              />
            )}
          </div>
        }
      >
        {stats.loading ? (
          <Spinner />
        ) : stats.error ? (
          <ErrorAlert message={stats.error} />
        ) : stats.data ? (
          <MatrixSection matrix={stats.data.visits} unit="건" dimension={dimension} />
        ) : null}
      </Card>

      <Card
        title="월별 약 반출 현황"
        bodyClassName=""
        actions={
          stats.data ? (
            <ExcelButton
              onClick={() =>
                downloadCsv(`월별약반출_${dimension}_${start}_${end}.csv`, matrixToRows(stats.data!.dispense, dimLabel))
              }
            />
          ) : undefined
        }
      >
        {stats.loading ? (
          <Spinner />
        ) : stats.error ? (
          <ErrorAlert message={stats.error} />
        ) : stats.data ? (
          <MatrixSection matrix={stats.data.dispense} unit="개" dimension={dimension} />
        ) : null}
      </Card>
    </>
  );
}

/** 유해인자 노출자 통계 */
function ExposureStatsCard({ dimension }: { dimension: StatDimension }) {
  const { statistics } = useServices();
  const stats = useAsync(() => statistics.getExposureStats(dimension), [dimension]);
  const s = stats.data;
  const dimLabel = STAT_DIMENSION_LABEL[dimension].replace('별', '');

  function exportCsv() {
    if (!s) return;
    const rows: (string | number)[][] = [
      [dimLabel, '노출 인원', '검진 초과', '임박', '여유'],
      ...s.rows.map((r) => [r.group, r.exposed, r.overdue, r.dueSoon, r.ok]),
      [],
      ['유해인자 분류', '노출 인원', '노출 건수'],
      ...s.byCategory.map((c) => [c.categoryName, c.employees, c.records]),
    ];
    downloadCsv(`유해인자노출자_${dimension}.csv`, rows);
  }

  return (
    <Card
      title="유해인자 노출자 통계"
      bodyClassName=""
      actions={s ? <ExcelButton onClick={exportCsv} /> : undefined}
    >
      {stats.loading ? (
        <Spinner />
      ) : stats.error ? (
        <ErrorAlert message={stats.error} />
      ) : !s ? null : s.totalExposed === 0 ? (
        <div className="card__body">
          <EmptyState icon="⚗️">진행 중인 노출 기록이 없습니다.</EmptyState>
        </div>
      ) : (
        <div className="card__body stack">
          <div className="grid grid--stats">
            <Stat label="노출 임직원" value={`${s.totalExposed}명`} hint="진행 중 노출 기준" />
            <Stat label="특수검진 초과" value={`${s.overdue}명`} tone="danger" />
            <Stat label="검진 임박" value={`${s.dueSoon}명`} tone="warning" />
          </div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{dimLabel}</th>
                  <th className="num">노출 인원</th>
                  <th className="num">검진 초과</th>
                  <th className="num">임박</th>
                  <th className="num">여유</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.group}>
                    <td>
                      <strong>{r.group}</strong>
                    </td>
                    <td className="num">{r.exposed}</td>
                    <td className="num">
                      {r.overdue ? <strong style={{ color: 'var(--danger)' }}>{r.overdue}</strong> : '-'}
                    </td>
                    <td className="num">{r.dueSoon || '-'}</td>
                    <td className="num">{r.ok || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>유해인자 분류별 노출 인원</label>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>분류</th>
                    <th className="num">노출 인원</th>
                    <th className="num">노출 건수</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byCategory.map((c) => (
                    <tr key={c.categoryCode}>
                      <td>{c.categoryName}</td>
                      <td className="num">{c.employees}</td>
                      <td className="num">{c.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** 프로그램 참여율 통계 */
function ProgramStatsCard({ dimension }: { dimension: StatDimension }) {
  const { statistics } = useServices();
  const stats = useAsync(() => statistics.getProgramStats(dimension), [dimension]);
  const s = stats.data;
  const dimLabel = STAT_DIMENSION_LABEL[dimension].replace('별', '');

  function exportCsv() {
    if (!s) return;
    const rows: (string | number)[][] = [
      ['프로그램', '분류', '상태', '정원', '확정', '대기', '수료', '충원율(%)', '평균참여율(%)'],
      ...s.programs.map((p) => [
        p.title,
        p.category,
        PROGRAM_STATUS_LABEL[p.status],
        p.capacity,
        p.enrolled,
        p.waitlisted,
        p.completed,
        p.fillRate,
        p.averageAttendanceRate ?? '-',
      ]),
      [],
      [`${dimLabel}별 참여율`, '대상 인원', '참여 인원', '참여율(%)'],
      ...s.participation.map((r) => [r.group, r.employees, r.participants, r.rate]),
    ];
    downloadCsv(`프로그램참여율_${dimension}.csv`, rows);
  }

  return (
    <Card
      title="프로그램 참여율 통계"
      bodyClassName=""
      actions={s ? <ExcelButton onClick={exportCsv} /> : undefined}
    >
      {stats.loading ? (
        <Spinner />
      ) : stats.error ? (
        <ErrorAlert message={stats.error} />
      ) : !s ? null : (
        <div className="card__body stack">
          <div className="grid grid--stats">
            <Stat label="전체 참여율" value={`${s.overallRate}%`} tone="info" hint={`${s.totalParticipants} / ${s.totalEmployees}명`} />
            <Stat label="운영 프로그램" value={`${s.programs.length}개`} />
          </div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>프로그램</th>
                  <th>상태</th>
                  <th className="num">정원/확정</th>
                  <th className="num">충원율</th>
                  <th className="num">평균 참여율</th>
                </tr>
              </thead>
              <tbody>
                {s.programs.map((p) => (
                  <tr key={p.programId}>
                    <td>
                      <strong>{p.title}</strong>
                      <div className="muted small">{p.category}</div>
                    </td>
                    <td className="small">{PROGRAM_STATUS_LABEL[p.status]}</td>
                    <td className="num">
                      {p.capacity}/{p.enrolled}
                      {p.waitlisted > 0 && <span className="muted small"> (대기 {p.waitlisted})</span>}
                    </td>
                    <td className="num">{p.fillRate}%</td>
                    <td className="num">{p.averageAttendanceRate == null ? '-' : `${p.averageAttendanceRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{dimLabel}별 참여율</label>
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{dimLabel}</th>
                    <th className="num">대상 인원</th>
                    <th className="num">참여 인원</th>
                    <th className="num">참여율</th>
                  </tr>
                </thead>
                <tbody>
                  {s.participation.map((r) => (
                    <tr key={r.group}>
                      <td>
                        <strong>{r.group}</strong>
                      </td>
                      <td className="num">{r.employees}</td>
                      <td className="num">{r.participants}</td>
                      <td className="num">{r.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="muted small">※ 참여 = 취소를 제외한 신청·확정·수료 이력이 1건 이상인 임직원.</div>
        </div>
      )}
    </Card>
  );
}

/** 특정 증상 추이 */
function SymptomTrendCard({ dimension }: { dimension: StatDimension }) {
  const { statistics } = useServices();
  const options = useAsync(() => statistics.getSymptomOptions(), []);
  const opts = options.data ?? [];
  const [symptom, setSymptom] = useState('');
  const [start, setStart] = useState(monthsAgo(11));
  const [end, setEnd] = useState(currentMonth());

  const selected = symptom || opts[0]?.symptom || '';
  const trend = useAsync(
    () => (selected ? statistics.getSymptomTrend(selected, start, end, dimension) : Promise.resolve(null)),
    [selected, start, end, dimension],
  );
  const dimLabel = STAT_DIMENSION_LABEL[dimension].replace('별', '');

  return (
    <Card
      title="특정 증상 추이"
      bodyClassName=""
      actions={
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ maxWidth: 180 }}
            value={selected}
            onChange={(e) => setSymptom(e.target.value)}
          >
            {opts.length === 0 && <option value="">증상 없음</option>}
            {opts.map((o) => (
              <option key={o.symptom} value={o.symptom}>
                {o.symptom} ({o.count})
              </option>
            ))}
          </select>
          <input className="input lab-range" type="month" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="muted">~</span>
          <input className="input lab-range" type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
          {trend.data && (
            <ExcelButton
              onClick={() =>
                downloadCsv(`증상추이_${selected}_${dimension}.csv`, matrixToRows(trend.data!, dimLabel))
              }
            />
          )}
        </div>
      }
    >
      {opts.length === 0 ? (
        <div className="card__body">
          <EmptyState icon="🩺">기록된 증상이 없습니다.</EmptyState>
        </div>
      ) : trend.loading ? (
        <Spinner />
      ) : trend.error ? (
        <ErrorAlert message={trend.error} />
      ) : trend.data ? (
        <MatrixSection matrix={trend.data} unit="건" dimension={dimension} />
      ) : null}
    </Card>
  );
}

/** 월 × 그룹 매트릭스 표 + 월별 합계 추이 그래프 */
function MatrixSection({
  matrix,
  unit,
  dimension,
}: {
  matrix: MonthlyMatrix;
  unit: string;
  dimension: StatDimension;
}) {
  if (matrix.months.length === 0) {
    return <div className="card__body muted small">조회 기간을 선택하세요.</div>;
  }
  if (matrix.grandTotal === 0) {
    return (
      <div className="card__body">
        <EmptyState icon="📊">해당 기간에 기록이 없습니다.</EmptyState>
      </div>
    );
  }
  const points: LinePoint[] = matrix.months.map((m) => ({
    label: monthLabel(m),
    value: matrix.totalByMonth[m] ?? 0,
  }));

  return (
    <div className="card__body stack">
      <div className="table-wrap" style={{ border: 'none' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{STAT_DIMENSION_LABEL[dimension].replace('별', '')}</th>
              {matrix.months.map((m) => (
                <th key={m} className="num">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="num">합계</th>
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map((g) => (
              <tr key={g}>
                <td>
                  <strong>{g}</strong>
                </td>
                {matrix.months.map((m) => {
                  const v = matrix.counts[g]?.[m] ?? 0;
                  return (
                    <td key={m} className="num">
                      {v || '-'}
                    </td>
                  );
                })}
                <td className="num">
                  <strong>{matrix.totalByGroup[g] ?? 0}</strong>
                </td>
              </tr>
            ))}
            <tr className="group-row">
              <td>합계</td>
              {matrix.months.map((m) => (
                <td key={m} className="num">
                  <strong>{matrix.totalByMonth[m] ?? 0}</strong>
                </td>
              ))}
              <td className="num">
                <strong>{matrix.grandTotal}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="muted small" style={{ marginBottom: 4 }}>
          월별 합계 추이 ({unit})
        </div>
        <LineChart points={points} unit={unit} />
      </div>
    </div>
  );
}
