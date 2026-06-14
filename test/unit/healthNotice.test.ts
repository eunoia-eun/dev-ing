import { describe, expect, it } from 'vitest';
import { computeHealthNotice } from '@domain/employee/HealthNotice';
import type { ExposureAssessment } from '@domain/hazard/ExposureAssessment';
import { anExposureRecord, aCheckup } from '@test/harness/builders';

function anAssessment(overrides: Partial<ExposureAssessment> = {}): ExposureAssessment {
  return {
    record: anExposureRecord(),
    nextExamDueDate: '2026-12-01',
    basis: 'periodic',
    status: 'ok',
    daysUntilDue: 100,
    ...overrides,
  };
}

describe('computeHealthNotice', () => {
  it('노출·검진·프로그램 모두 양호하면 도장 3칸 모두 great이고 칭찬 메시지', () => {
    const result = computeHealthNotice({
      activeExposures: [anAssessment({ status: 'ok' })],
      latestCheckup: aCheckup({ grade: 'A' }),
      enrollmentStatuses: ['enrolled'],
    });
    expect(result.stamps.every((s) => s.level === 'great')).toBe(true);
    expect(result.message).toContain('완벽');
  });

  it('특수검진 기한 초과가 있으면 specialExam 도장이 help', () => {
    const result = computeHealthNotice({
      activeExposures: [anAssessment({ status: 'overdue' })],
      latestCheckup: undefined,
      enrollmentStatuses: [],
    });
    const stamp = result.stamps.find((s) => s.key === 'specialExam')!;
    expect(stamp.level).toBe('help');
    expect(stamp.text).toBe('꼭 챙겨주세요');
  });

  it('특수검진 임박만 있으면(초과 없음) specialExam 도장이 warn', () => {
    const result = computeHealthNotice({
      activeExposures: [anAssessment({ status: 'due-soon' })],
      latestCheckup: undefined,
      enrollmentStatuses: [],
    });
    const stamp = result.stamps.find((s) => s.key === 'specialExam')!;
    expect(stamp.level).toBe('warn');
  });

  it('건강검진 유소견(D1)이면 checkupResult 도장이 help', () => {
    const result = computeHealthNotice({
      activeExposures: [],
      latestCheckup: aCheckup({ grade: 'D1' }),
      enrollmentStatuses: [],
    });
    const stamp = result.stamps.find((s) => s.key === 'checkupResult')!;
    expect(stamp.level).toBe('help');
  });

  it('건강검진 요관찰(C1)이면 checkupResult 도장이 warn', () => {
    const result = computeHealthNotice({
      activeExposures: [],
      latestCheckup: aCheckup({ grade: 'C1' }),
      enrollmentStatuses: [],
    });
    const stamp = result.stamps.find((s) => s.key === 'checkupResult')!;
    expect(stamp.level).toBe('warn');
  });

  it('프로그램 신청 이력이 없으면 program 도장이 warn, 취소만 있어도 warn', () => {
    const noneResult = computeHealthNotice({
      activeExposures: [],
      latestCheckup: undefined,
      enrollmentStatuses: [],
    });
    const cancelledResult = computeHealthNotice({
      activeExposures: [],
      latestCheckup: undefined,
      enrollmentStatuses: ['cancelled'],
    });
    expect(noneResult.stamps.find((s) => s.key === 'program')!.level).toBe('warn');
    expect(cancelledResult.stamps.find((s) => s.key === 'program')!.level).toBe('warn');
  });

  it('도장 중 하나라도 help면 보건관리자 안내 메시지', () => {
    const result = computeHealthNotice({
      activeExposures: [anAssessment({ status: 'overdue' })],
      latestCheckup: aCheckup({ grade: 'A' }),
      enrollmentStatuses: ['enrolled'],
    });
    expect(result.message).toContain('보건관리자');
  });
});
