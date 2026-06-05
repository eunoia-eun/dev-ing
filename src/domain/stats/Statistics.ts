/**
 * 통계 집계용 순수 함수.
 * 월(YYYY-MM) 키 처리와 '월 × 그룹' 매트릭스 빌더 — IO·현재시각에 의존하지 않는다.
 */

/** ISO 일시/일자 → 'YYYY-MM' */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** 두 월(YYYY-MM, 포함) 사이의 월 목록을 오래된→최신 순으로 */
export function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  if (!sy || !ey) return [];
  const out: string[] = [];
  let y = sy;
  let m = sm;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 600) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return out;
}

export interface MonthlyMatrix {
  months: string[];
  groups: string[];
  /** counts[group][month] = 값 합계 */
  counts: Record<string, Record<string, number>>;
  totalByMonth: Record<string, number>;
  totalByGroup: Record<string, number>;
  grandTotal: number;
}

/**
 * 이미 {month, group, value}로 매핑된 이벤트들을 '월 × 그룹' 매트릭스로 집계한다.
 * months 범위 밖의 이벤트는 무시. groupOrder가 주어지면 그 순서를 우선하고,
 * 그 외에 등장한 그룹은 뒤에 가나다순으로 덧붙인다.
 */
export function buildMonthlyMatrix(
  events: Array<{ month: string; group: string; value: number }>,
  months: string[],
  groupOrder: string[] = [],
): MonthlyMatrix {
  const monthSet = new Set(months);
  const counts: Record<string, Record<string, number>> = {};
  const totalByMonth: Record<string, number> = {};
  const totalByGroup: Record<string, number> = {};
  let grandTotal = 0;
  const seen = new Set<string>();

  for (const e of events) {
    if (!monthSet.has(e.month)) continue;
    const group = e.group || '미상';
    seen.add(group);
    counts[group] ??= {};
    counts[group][e.month] = (counts[group][e.month] ?? 0) + e.value;
    totalByMonth[e.month] = (totalByMonth[e.month] ?? 0) + e.value;
    totalByGroup[group] = (totalByGroup[group] ?? 0) + e.value;
    grandTotal += e.value;
  }

  const ordered = [...groupOrder.filter((g) => seen.has(g))];
  for (const g of [...seen].sort()) if (!ordered.includes(g)) ordered.push(g);

  return { months, groups: ordered, counts, totalByMonth, totalByGroup, grandTotal };
}
