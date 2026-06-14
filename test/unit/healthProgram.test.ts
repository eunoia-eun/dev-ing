import { describe, expect, it } from 'vitest';
import {
  canEditProgram,
  decideEnrollmentStatus,
  defaultProgramRange,
  isProgramInRange,
  summarizeParticipation,
} from '@domain/program/HealthProgram';
import { aProgram, anEnrollment } from '@test/harness/builders';

describe('canEditProgram', () => {
  it('모집 중·진행 중인 프로그램은 수정 가능', () => {
    expect(canEditProgram(aProgram({ status: 'recruiting' }))).toBe(true);
    expect(canEditProgram(aProgram({ status: 'ongoing' }))).toBe(true);
  });
  it('종료된 프로그램은 수정 불가', () => {
    expect(canEditProgram(aProgram({ status: 'closed' }))).toBe(false);
  });
});

describe('decideEnrollmentStatus', () => {
  it('정원이 남으면 enrolled', () => {
    expect(decideEnrollmentStatus(aProgram({ capacity: 2 }), 1)).toBe('enrolled');
  });
  it('정원이 가득 차면 waitlisted', () => {
    expect(decideEnrollmentStatus(aProgram({ capacity: 2 }), 2)).toBe('waitlisted');
  });
  it('종료된 프로그램은 예외', () => {
    expect(() => decideEnrollmentStatus(aProgram({ status: 'closed' }), 0)).toThrow();
  });
});

describe('summarizeParticipation', () => {
  it('상태별 집계, 충원율, 평균 참여율', () => {
    const program = aProgram({ capacity: 3 });
    const enrollments = [
      anEnrollment({ id: 'e1', status: 'enrolled' }),
      anEnrollment({ id: 'e2', status: 'enrolled' }),
      anEnrollment({ id: 'e3', status: 'waitlisted' }),
      anEnrollment({ id: 'e4', status: 'completed', attendanceRate: 80 }),
      anEnrollment({ id: 'e5', status: 'cancelled' }),
    ];
    const s = summarizeParticipation(program, enrollments);
    expect(s.occupied).toBe(3); // enrolled 2 + completed 1
    expect(s.enrolled).toBe(2);
    expect(s.waitlisted).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.fillRate).toBe(100); // 3/3
    expect(s.averageAttendanceRate).toBe(80);
  });

  it('참여율 데이터가 없으면 averageAttendanceRate는 null', () => {
    const s = summarizeParticipation(aProgram({ capacity: 2 }), [
      anEnrollment({ id: 'e1', status: 'enrolled' }),
    ]);
    expect(s.averageAttendanceRate).toBeNull();
    expect(s.fillRate).toBe(50);
  });
});

describe('defaultProgramRange', () => {
  it('해당 연도 1/1~12/31을 반환한다', () => {
    expect(defaultProgramRange(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('isProgramInRange', () => {
  const range = { start: '2026-01-01', end: '2026-12-31' };

  it('운영기간이 조회기간 내에 완전히 포함되면 true', () => {
    const program = aProgram({ startDate: '2026-06-01', endDate: '2026-08-31' });
    expect(isProgramInRange(program, range)).toBe(true);
  });

  it('운영기간이 조회기간과 일부 겹치면 true (시작이 이전, 종료가 기간 내)', () => {
    const program = aProgram({ startDate: '2025-12-01', endDate: '2026-01-15' });
    expect(isProgramInRange(program, range)).toBe(true);
  });

  it('운영기간이 조회기간과 일부 겹치면 true (시작이 기간 내, 종료가 이후)', () => {
    const program = aProgram({ startDate: '2026-12-15', endDate: '2027-01-15' });
    expect(isProgramInRange(program, range)).toBe(true);
  });

  it('운영기간이 조회기간보다 완전히 이전이면 false', () => {
    const program = aProgram({ startDate: '2025-01-01', endDate: '2025-12-31' });
    expect(isProgramInRange(program, range)).toBe(false);
  });

  it('운영기간이 조회기간보다 완전히 이후이면 false', () => {
    const program = aProgram({ startDate: '2027-01-01', endDate: '2027-12-31' });
    expect(isProgramInRange(program, range)).toBe(false);
  });
});
