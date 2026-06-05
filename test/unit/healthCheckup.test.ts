import { describe, expect, it } from 'vitest';
import { followUpLabels, gradeTone, needsManagement } from '@domain/checkup/HealthCheckup';

describe('HealthCheckup 도메인 헬퍼', () => {
  it('A는 사후관리 불필요, 그 외는 필요', () => {
    expect(needsManagement('A')).toBe(false);
    expect(needsManagement('C1')).toBe(true);
    expect(needsManagement('D1')).toBe(true);
    expect(needsManagement('R')).toBe(true);
  });

  it('gradeTone — 판정별 색조', () => {
    expect(gradeTone('A')).toBe('success');
    expect(gradeTone('C1')).toBe('warning');
    expect(gradeTone('C2')).toBe('warning');
    expect(gradeTone('D1')).toBe('danger');
    expect(gradeTone('D2')).toBe('danger');
    expect(gradeTone('R')).toBe('info');
  });

  it('followUpLabels — 한글 라벨로 변환', () => {
    expect(followUpLabels(['ppe', 'lifestyle'])).toBe('보호구 착용, 생활습관 관리');
    expect(followUpLabels([])).toBe('-');
    expect(followUpLabels(undefined)).toBe('-');
  });
});
