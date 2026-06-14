import type { EmployeeId } from '@domain/employee/Employee';
import {
  canEditProgram,
  decideEnrollmentStatus,
  isProgramInRange,
  occupiesSeat,
  summarizeParticipation,
  type DateRange,
  type Enrollment,
  type HealthProgram,
  type ParticipationSummary,
  type ProgramStatus,
} from '@domain/program/HealthProgram';
import type { Id, ISODate } from '@domain/shared/types';
import { compareDates } from '@domain/shared/date';
import type { EnrollmentRepository, ProgramRepository } from '../ports/ProgramRepository';
import type { Clock, IdGenerator } from '../ports/system';

export interface CreateProgramInput {
  title: string;
  description: string;
  category: string;
  capacity: number;
  startDate: ISODate;
  endDate: ISODate;
  status: ProgramStatus;
}

/**
 * 메뉴 3. 건강프로그램 신청 및 참여 현황.
 * 정원 초과 시 자동 대기(waitlist), 취소 시 대기자 자동 승급을 처리한다.
 */
export class ProgramService {
  constructor(
    private readonly programs: ProgramRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  listPrograms(): Promise<HealthProgram[]> {
    return this.programs.list();
  }

  getProgram(id: Id): Promise<HealthProgram | null> {
    return this.programs.getById(id);
  }

  async createProgram(input: CreateProgramInput): Promise<HealthProgram> {
    const program: HealthProgram = { id: this.ids.next(), ...input };
    await this.programs.save(program);
    return program;
  }

  /** 모집 중·진행 중인 프로그램의 정보를 수정한다(종료된 프로그램은 수정 불가). */
  async updateProgram(id: Id, input: CreateProgramInput): Promise<HealthProgram> {
    const existing = await this.programs.getById(id);
    if (!existing) throw new Error('프로그램을 찾을 수 없습니다.');
    if (!canEditProgram(existing)) throw new Error('종료된 프로그램은 수정할 수 없습니다.');
    const updated: HealthProgram = { id, ...input };
    await this.programs.save(updated);
    return updated;
  }

  /** 프로그램 삭제 — 신청/참여 기록도 함께 삭제한다. */
  async removeProgram(id: Id): Promise<void> {
    const enrollments = await this.enrollments.listByProgram(id);
    for (const e of enrollments) {
      await this.enrollments.remove(e.id);
    }
    await this.programs.remove(id);
  }

  listEnrollmentsByProgram(programId: Id): Promise<Enrollment[]> {
    return this.enrollments.listByProgram(programId);
  }

  listEnrollmentsByEmployee(employeeId: EmployeeId): Promise<Enrollment[]> {
    return this.enrollments.listByEmployee(employeeId);
  }

  /** 신청 — 정원이 차 있으면 대기 상태로 등록 */
  async apply(programId: Id, employeeId: EmployeeId): Promise<Enrollment> {
    const program = await this.programs.getById(programId);
    if (!program) throw new Error('프로그램을 찾을 수 없습니다.');

    const existing = await this.enrollments.listByProgram(programId);
    const already = existing.find(
      (e) => e.employeeId === employeeId && e.status !== 'cancelled',
    );
    if (already) throw new Error('이미 신청한 프로그램입니다.');

    const occupied = existing.filter((e) => occupiesSeat(e.status)).length;
    const status = decideEnrollmentStatus(program, occupied);

    const enrollment: Enrollment = {
      id: this.ids.next(),
      programId,
      employeeId,
      status,
      appliedAt: this.clock.today(),
    };
    await this.enrollments.save(enrollment);
    return enrollment;
  }

  /** 신청 취소 — 좌석이 비면 가장 먼저 신청한 대기자를 확정으로 승급 */
  async cancel(enrollmentId: Id): Promise<void> {
    const enrollment = await this.enrollments.getById(enrollmentId);
    if (!enrollment) return;
    const freedSeat = occupiesSeat(enrollment.status);
    await this.enrollments.save({ ...enrollment, status: 'cancelled' });

    if (!freedSeat) return;
    const program = await this.programs.getById(enrollment.programId);
    if (!program) return;
    const siblings = await this.enrollments.listByProgram(enrollment.programId);
    const occupied = siblings.filter((e) => occupiesSeat(e.status)).length;
    if (occupied >= program.capacity) return; // 아직 자리가 없음

    const nextWaiting = siblings
      .filter((e) => e.status === 'waitlisted')
      .sort((a, b) => compareDates(a.appliedAt, b.appliedAt))[0];
    if (nextWaiting) {
      await this.enrollments.save({ ...nextWaiting, status: 'enrolled' });
    }
  }

  async setAttendanceRate(enrollmentId: Id, rate: number): Promise<void> {
    const enrollment = await this.enrollments.getById(enrollmentId);
    if (!enrollment) throw new Error('신청 내역을 찾을 수 없습니다.');
    const clamped = Math.max(0, Math.min(100, Math.round(rate)));
    await this.enrollments.save({ ...enrollment, attendanceRate: clamped });
  }

  async markCompleted(enrollmentId: Id): Promise<void> {
    const enrollment = await this.enrollments.getById(enrollmentId);
    if (!enrollment) throw new Error('신청 내역을 찾을 수 없습니다.');
    await this.enrollments.save({ ...enrollment, status: 'completed' });
  }

  async getParticipationSummary(programId: Id): Promise<ParticipationSummary> {
    const program = await this.programs.getById(programId);
    if (!program) throw new Error('프로그램을 찾을 수 없습니다.');
    const enrollments = await this.enrollments.listByProgram(programId);
    return summarizeParticipation(program, enrollments);
  }

  /** range를 주면 운영기간이 그 기간과 겹치는 프로그램만 반환(기본: 전체). */
  async getAllSummaries(range?: DateRange): Promise<Array<{ program: HealthProgram; summary: ParticipationSummary }>> {
    const programs = await this.programs.list();
    const all = await this.enrollments.list();
    const filtered = range ? programs.filter((p) => isProgramInRange(p, range)) : programs;
    return filtered.map((program) => ({
      program,
      summary: summarizeParticipation(
        program,
        all.filter((e) => e.programId === program.id),
      ),
    }));
  }
}
