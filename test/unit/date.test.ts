import { describe, expect, it } from 'vitest';
import { addDays, addMonths, compareDates, diffInDays, isISODate } from '@domain/shared/date';

describe('addMonths', () => {
  it('단순 가산', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2025-12-20', 2)).toBe('2026-02-20');
  });

  it('말일 보정: 1/31 + 1개월 = 2/28', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('윤년 보정: 1/31 + 1개월 = 2/29', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('addDays / diffInDays / compareDates', () => {
  it('addDays', () => {
    expect(addDays('2026-06-02', 30)).toBe('2026-07-02');
    expect(addDays('2026-06-02', -2)).toBe('2026-05-31');
  });

  it('diffInDays는 b-a', () => {
    expect(diffInDays('2026-06-02', '2026-06-12')).toBe(10);
    expect(diffInDays('2026-06-12', '2026-06-02')).toBe(-10);
    expect(diffInDays('2026-06-02', '2026-06-02')).toBe(0);
  });

  it('compareDates', () => {
    expect(compareDates('2026-06-01', '2026-06-02')).toBe(-1);
    expect(compareDates('2026-06-02', '2026-06-02')).toBe(0);
    expect(compareDates('2026-06-03', '2026-06-02')).toBe(1);
  });
});

describe('isISODate', () => {
  it('유효한 날짜', () => {
    expect(isISODate('2026-06-02')).toBe(true);
  });
  it('형식·존재하지 않는 날짜 거부', () => {
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026/06/02')).toBe(false);
    expect(isISODate('abc')).toBe(false);
  });
});
