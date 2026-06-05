import { describe, expect, it } from 'vitest';
import {
  decideEnrollmentStatus,
  summarizeParticipation,
} from '@domain/program/HealthProgram';
import { aProgram, anEnrollment } from '@test/harness/builders';

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
