import type { ISODate } from '../shared/types';
import { compareDates } from '../shared/date';
import {
  DEFAULT_LAB_ITEMS,
  isLabAbnormal,
  type CheckupType,
  type HealthCheckup,
  type LabItemDef,
} from './HealthCheckup';

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

export interface LabTrendColumn {
  checkupId: string;
  examDate: ISODate;
  type: CheckupType;
}

export interface LabTrendCell {
  value: string | null;
  abnormal: boolean;
}

export interface LabTrendRow {
  code: string;
  name: string;
  unit?: string;
  def?: LabItemDef;
  /** columns와 같은 순서의 셀 값 */
  cells: LabTrendCell[];
}

export interface LabTrend {
  columns: LabTrendColumn[];
  rows: LabTrendRow[];
}

/**
 * 검진 기록들을 '검사항목(행) × 검진일(열, 오래된→최신)' 매트릭스로 변환한다(순수 함수).
 * range 안에서 검사 수치가 있는 검진만 대상으로 한다.
 */
export function buildLabTrend(
  checkups: HealthCheckup[],
  range: DateRange,
  labItems: LabItemDef[] = DEFAULT_LAB_ITEMS,
): LabTrend {
  const inRange = checkups
    .filter(
      (c) =>
        c.labResults &&
        c.labResults.length > 0 &&
        compareDates(c.examDate, range.start) >= 0 &&
        compareDates(c.examDate, range.end) <= 0,
    )
    .sort((a, b) => compareDates(a.examDate, b.examDate)); // 시간순(오래된 → 최신)

  const columns: LabTrendColumn[] = inRange.map((c) => ({
    checkupId: c.id,
    examDate: c.examDate,
    type: c.type,
  }));

  // 등장하는 검사 코드 수집 → 카탈로그 순서 우선, 그 외 코드는 뒤에
  const present = new Set<string>();
  inRange.forEach((c) => c.labResults!.forEach((r) => present.add(r.code)));
  const orderedCodes = [
    ...labItems.filter((d) => present.has(d.code)).map((d) => d.code),
    ...[...present].filter((code) => !labItems.some((d) => d.code === code)),
  ];

  const rows: LabTrendRow[] = orderedCodes.map((code) => {
    const def = labItems.find((d) => d.code === code);
    const snap = inRange.flatMap((c) => c.labResults!).find((r) => r.code === code);
    const name = def?.name ?? snap?.name ?? code;
    const unit = def?.unit ?? snap?.unit;
    const cells: LabTrendCell[] = inRange.map((c) => {
      const r = c.labResults!.find((x) => x.code === code);
      return { value: r ? r.value : null, abnormal: r ? isLabAbnormal(r.value, def) : false };
    });
    return { code, name, unit, def, cells };
  });

  return { columns, rows };
}

/** 올해 기준 과거 N개년(올해 포함) 기본 조회기간. nowYear는 가장자리에서 주입. */
export function defaultLabRange(nowYear: number, years = 5): DateRange {
  return { start: `${nowYear - (years - 1)}-01-01`, end: `${nowYear}-12-31` };
}
