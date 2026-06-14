import type { EmployeeId } from '../employee/Employee';
import { compareDates } from '../shared/date';
import type { Id, ISODate } from '../shared/types';

export type ProgramStatus =
  | 'recruiting' // 모집 중
  | 'ongoing' // 진행 중
  | 'closed'; // 종료

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  recruiting: '모집 중',
  ongoing: '진행 중',
  closed: '종료',
};

/** 건강증진 프로그램 (금연, 운동, 스트레스 관리 등) */
export interface HealthProgram {
  id: Id;
  title: string;
  description: string;
  /** 분류: 금연 / 운동 / 영양 / 스트레스 / 근골격계 등 */
  category: string;
  /** 정원 */
  capacity: number;
  startDate: ISODate;
  endDate: ISODate;
  status: ProgramStatus;
}

export type EnrollmentStatus =
  | 'applied' // 신청
  | 'enrolled' // 확정
  | 'waitlisted' // 대기
  | 'completed' // 수료
  | 'cancelled'; // 취소

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  applied: '신청',
  enrolled: '확정',
  waitlisted: '대기',
  completed: '수료',
  cancelled: '취소',
};

/** 프로그램 신청/참여 기록 */
export interface Enrollment {
  id: Id;
  programId: Id;
  employeeId: EmployeeId;
  status: EnrollmentStatus;
  appliedAt: ISODate;
  /** 참여율(%) 0~100 — 수료 판정·현황 집계용 */
  attendanceRate?: number;
}

/** 정원을 차지하는(=확정/신청/수료) 상태인지 */
export function occupiesSeat(status: EnrollmentStatus): boolean {
  return status === 'applied' || status === 'enrolled' || status === 'completed';
}

/** 모집 중·진행 중인 프로그램만 정보 수정이 가능하다(종료된 프로그램은 수정 불가). */
export function canEditProgram(program: HealthProgram): boolean {
  return program.status !== 'closed';
}

/**
 * 신청 시 부여할 상태를 결정한다.
 * 정원이 남아 있으면 'enrolled', 가득 찼으면 'waitlisted'.
 * (순수 함수 — 현재 좌석 점유 수만으로 판정)
 */
export function decideEnrollmentStatus(
  program: HealthProgram,
  currentOccupiedSeats: number,
): EnrollmentStatus {
  if (program.status === 'closed') {
    throw new Error('종료된 프로그램에는 신청할 수 없습니다.');
  }
  return currentOccupiedSeats < program.capacity ? 'enrolled' : 'waitlisted';
}

export interface ParticipationSummary {
  programId: Id;
  capacity: number;
  /** 좌석을 차지한 인원 (신청+확정+수료) */
  occupied: number;
  enrolled: number;
  waitlisted: number;
  completed: number;
  cancelled: number;
  /** 정원 대비 충원율(%) */
  fillRate: number;
  /** 수료자 평균 참여율(%) — 데이터 없으면 null */
  averageAttendanceRate: number | null;
}

/** 한 프로그램의 등록 목록으로 참여 현황을 집계한다(순수 함수). */
export function summarizeParticipation(
  program: HealthProgram,
  enrollments: Enrollment[],
): ParticipationSummary {
  let occupied = 0;
  let enrolled = 0;
  let waitlisted = 0;
  let completed = 0;
  let cancelled = 0;
  const attendance: number[] = [];

  for (const e of enrollments) {
    if (occupiesSeat(e.status)) occupied += 1;
    if (e.status === 'enrolled') enrolled += 1;
    if (e.status === 'waitlisted') waitlisted += 1;
    if (e.status === 'completed') completed += 1;
    if (e.status === 'cancelled') cancelled += 1;
    if (typeof e.attendanceRate === 'number') attendance.push(e.attendanceRate);
  }

  const fillRate = program.capacity === 0 ? 0 : Math.round((occupied / program.capacity) * 100);
  const averageAttendanceRate =
    attendance.length === 0
      ? null
      : Math.round(attendance.reduce((a, b) => a + b, 0) / attendance.length);

  return {
    programId: program.id,
    capacity: program.capacity,
    occupied,
    enrolled,
    waitlisted,
    completed,
    cancelled,
    fillRate,
    averageAttendanceRate,
  };
}

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/** 올해 1/1~12/31 기본 조회기간. nowYear는 가장자리에서 주입. */
export function defaultProgramRange(nowYear: number): DateRange {
  return { start: `${nowYear}-01-01`, end: `${nowYear}-12-31` };
}

/** 프로그램 운영기간(startDate~endDate)이 조회기간과 겹치는지(순수 함수) */
export function isProgramInRange(program: HealthProgram, range: DateRange): boolean {
  return compareDates(program.startDate, range.end) <= 0 && compareDates(program.endDate, range.start) >= 0;
}
