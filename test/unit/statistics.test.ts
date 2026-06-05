import { describe, expect, it } from 'vitest';
import {
  ageBucketOf,
  ageInYears,
  dimensionKeyOf,
  genderLabel,
} from '@domain/stats/Demographics';
import { buildMonthlyMatrix, monthKey, monthsBetween } from '@domain/stats/Statistics';
import { anEmployee } from '@test/harness/builders';

describe('Demographics - 나이/연령대', () => {
  it('생일이 안 지났으면 만 나이 -1', () => {
    expect(ageInYears('1990-07-01', '2026-06-02')).toBe(35); // 생일 전
    expect(ageInYears('1990-05-01', '2026-06-02')).toBe(36); // 생일 후
    expect(ageInYears(undefined, '2026-06-02')).toBeNull();
  });

  it('연령대 버킷', () => {
    expect(ageBucketOf('2000-01-01', '2026-06-02')).toBe('20대 이하');
    expect(ageBucketOf('1994-01-01', '2026-06-02')).toBe('30대');
    expect(ageBucketOf('1980-01-01', '2026-06-02')).toBe('40대');
    expect(ageBucketOf('1968-01-01', '2026-06-02')).toBe('50대');
    expect(ageBucketOf('1960-01-01', '2026-06-02')).toBe('60대 이상');
    expect(ageBucketOf(undefined, '2026-06-02')).toBe('미상');
  });

  it('성별 라벨 / 차원 키', () => {
    expect(genderLabel('M')).toBe('남');
    expect(genderLabel('F')).toBe('여');
    expect(genderLabel(undefined)).toBe('미상');
    const e = anEmployee({ department: '생산팀', gender: 'F', birthDate: '1980-01-01' });
    expect(dimensionKeyOf(e, 'department', '2026-06-02')).toBe('생산팀');
    expect(dimensionKeyOf(e, 'age', '2026-06-02')).toBe('40대');
    expect(dimensionKeyOf(e, 'gender', '2026-06-02')).toBe('여');
  });
});

describe('Statistics - 월 처리', () => {
  it('monthKey / monthsBetween (연 경계 포함)', () => {
    expect(monthKey('2026-06-02T09:00:00.000Z')).toBe('2026-06');
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-03', '2026-03')).toEqual(['2026-03']);
  });
});

describe('Statistics - buildMonthlyMatrix', () => {
  it('월×그룹 합계와 범위 밖 이벤트 무시', () => {
    const months = ['2026-01', '2026-02'];
    const events = [
      { month: '2026-01', group: '생산팀', value: 2 },
      { month: '2026-01', group: '품질팀', value: 1 },
      { month: '2026-02', group: '생산팀', value: 3 },
      { month: '2025-12', group: '생산팀', value: 9 }, // 범위 밖 → 무시
    ];
    const m = buildMonthlyMatrix(events, months, ['품질팀', '생산팀']);
    expect(m.groups).toEqual(['품질팀', '생산팀']); // groupOrder 우선
    expect(m.counts['생산팀']['2026-01']).toBe(2);
    expect(m.counts['생산팀']['2026-02']).toBe(3);
    expect(m.totalByMonth['2026-01']).toBe(3);
    expect(m.totalByGroup['생산팀']).toBe(5);
    expect(m.grandTotal).toBe(6);
  });
});
