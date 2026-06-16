import { describe, it, expect } from 'vitest';
import {
  parseExposureLimit,
  assessExceedance,
  assessMeasurement,
} from '@domain/measurement/WorkplaceMeasurement';
import type { WorkplaceMeasurement } from '@domain/measurement/WorkplaceMeasurement';

describe('parseExposureLimit', () => {
  it('ppm 단위 파싱', () => {
    const result = parseExposureLimit('300 ppm');
    expect(result).toEqual({ value: 300, unit: 'ppm', isCeiling: false });
  });

  it('최고노출기준(C) 파싱', () => {
    const result = parseExposureLimit('C 0.05 ppm');
    expect(result).toEqual({ value: 0.05, unit: 'ppm', isCeiling: true });
  });

  it('㎎/㎥ → mg/m³ 정규화', () => {
    const result = parseExposureLimit('3 ㎎/㎥');
    expect(result).toEqual({ value: 3, unit: 'mg/m³', isCeiling: false });
  });

  it('소수점 파싱', () => {
    const result = parseExposureLimit('0.2 ppm');
    expect(result?.value).toBe(0.2);
  });

  it('undefined → null 반환', () => {
    expect(parseExposureLimit(undefined)).toBeNull();
    expect(parseExposureLimit('')).toBeNull();
  });
});

describe('assessExceedance', () => {
  it('정상 (80% 미만)', () => {
    expect(assessExceedance(200, '300 ppm')).toBe('normal');
  });

  it('주의 (80% 이상 100% 미만)', () => {
    expect(assessExceedance(250, '300 ppm')).toBe('warning'); // 83%
  });

  it('정확히 80%는 주의', () => {
    expect(assessExceedance(240, '300 ppm')).toBe('warning');
  });

  it('초과 (100% 이상)', () => {
    expect(assessExceedance(310, '300 ppm')).toBe('exceeded');
  });

  it('실측값 없으면 unknown', () => {
    expect(assessExceedance(undefined, '300 ppm')).toBe('unknown');
  });

  it('기준 없으면 unknown', () => {
    expect(assessExceedance(100, undefined)).toBe('unknown');
  });
});

describe('assessMeasurement', () => {
  const base: WorkplaceMeasurement = {
    id: 'test-1',
    measureDate: '2026-01-01',
    department: '생산1팀',
    substanceCode: 'CHEM_ORGANIC-1',
    substanceName: '가솔린',
    unit: 'ppm',
    limitTwa: '300 ppm',
    limitStel: '500 ppm',
  };

  it('TWA·STEL 모두 정상이면 전체 정상', () => {
    const result = assessMeasurement({ ...base, twa: 100, stel: 200 });
    expect(result.twaStatus).toBe('normal');
    expect(result.stelStatus).toBe('normal');
    expect(result.overallStatus).toBe('normal');
  });

  it('STEL 초과 시 전체 판정은 초과', () => {
    const result = assessMeasurement({ ...base, twa: 100, stel: 510 });
    expect(result.twaStatus).toBe('normal');
    expect(result.stelStatus).toBe('exceeded');
    expect(result.overallStatus).toBe('exceeded');
  });

  it('측정값 없으면 unknown', () => {
    const result = assessMeasurement({ ...base });
    expect(result.overallStatus).toBe('unknown');
  });
});
