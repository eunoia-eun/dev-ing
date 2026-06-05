import type { ISODate } from './types';

/**
 * 순수 날짜 계산 함수 모음.
 *
 * 도메인 로직이 결정적(deterministic)이고 테스트하기 쉽도록,
 * 여기서는 "현재 시각"을 절대 읽지 않는다(Date.now() 사용 금지).
 * 기준일(today)은 항상 호출자가 인자로 넘겨준다. (→ 테스트 하네스의 FixedClock 참고)
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && toISODate(d) === value;
}

/** Date(UTC) → 'YYYY-MM-DD' */
function toISODate(d: Date): ISODate {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parse(date: ISODate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * 개월 수를 더한다. 말일 보정 포함.
 * 예) addMonths('2026-01-31', 1) === '2026-02-28'
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const d = parse(date);
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1));
  // 원래 '일'을 유지하되, 해당 월의 말일을 넘지 않게 보정
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toISODate(result);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** b - a (일 단위). a가 b보다 과거면 양수. */
export function diffInDays(a: ISODate, b: ISODate): number {
  const ms = parse(b).getTime() - parse(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** a < b 면 -1, 같으면 0, a > b 면 1 */
export function compareDates(a: ISODate, b: ISODate): -1 | 0 | 1 {
  const da = parse(a).getTime();
  const db = parse(b).getTime();
  return da < db ? -1 : da > db ? 1 : 0;
}
