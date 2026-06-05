import type { EmployeeId } from '@domain/employee/Employee';
import {
  decideEnrollmentStatus,
  occupiesSeat,
  summarizeParticipation,
  type Enrollment,
  type HealthProgram,
  type ParticipationSummary,
} from '@domain/program/HealthProgram';
import type { Id } from '@domain/shared/types';
import { compareDates } from '@domain/shared/date';
import type { EnrollmentRepository, ProgramRepository } from '../ports/ProgramRepository';
import type { Clock, IdGenerator } from '../ports/system';

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

  async getAllSummaries(): Promise<Array<{ program: HealthProgram; summary: ParticipationSummary }>> {
    const programs = await this.programs.list();
    const all = await this.enrollments.list();
    return programs.map((program) => ({
      program,
      summary: summarizeParticipation(
        program,
        all.filter((e) => e.programId === program.id),
      ),
    }));
  }
}
