import type { EmployeeId } from '@domain/employee/Employee';
import type { Enrollment, HealthProgram } from '@domain/program/HealthProgram';
import type { Id } from '@domain/shared/types';

export interface ProgramRepository {
  list(): Promise<HealthProgram[]>;
  getById(id: Id): Promise<HealthProgram | null>;
  save(program: HealthProgram): Promise<void>;
  remove(id: Id): Promise<void>;
}

export interface EnrollmentRepository {
  list(): Promise<Enrollment[]>;
  listByProgram(programId: Id): Promise<Enrollment[]>;
  listByEmployee(employeeId: EmployeeId): Promise<Enrollment[]>;
  getById(id: Id): Promise<Enrollment | null>;
  save(enrollment: Enrollment): Promise<void>;
  remove(id: Id): Promise<void>;
}
