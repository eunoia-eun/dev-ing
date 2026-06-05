import type { Assignment } from '@domain/employee/Assignment';
import type { EmployeeId } from '@domain/employee/Employee';
import type { Id } from '@domain/shared/types';

/** 배치(발령) 이력 저장소 */
export interface AssignmentRepository {
  list(): Promise<Assignment[]>;
  listByEmployee(employeeId: EmployeeId): Promise<Assignment[]>;
  getById(id: Id): Promise<Assignment | null>;
  save(assignment: Assignment): Promise<void>;
  remove(id: Id): Promise<void>;
}
