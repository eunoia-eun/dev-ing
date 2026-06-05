import type { EmployeeId } from '@domain/employee/Employee';
import type { HealthCheckup } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';

export interface HealthCheckupRepository {
  list(): Promise<HealthCheckup[]>;
  listByEmployee(employeeId: EmployeeId): Promise<HealthCheckup[]>;
  getById(id: Id): Promise<HealthCheckup | null>;
  save(checkup: HealthCheckup): Promise<void>;
  remove(id: Id): Promise<void>;
}
