import type { Employee, EmployeeId } from '@domain/employee/Employee';

export interface EmployeeRepository {
  list(): Promise<Employee[]>;
  getById(id: EmployeeId): Promise<Employee | null>;
  save(employee: Employee): Promise<void>;
  remove(id: EmployeeId): Promise<void>;
}
