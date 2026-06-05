import type { Employee, EmployeeId, Gender } from '@domain/employee/Employee';
import type { ISODate } from '@domain/shared/types';
import type { EmployeeRepository } from '../ports/EmployeeRepository';
import type { IdGenerator } from '../ports/system';

export interface CreateEmployeeInput {
  employeeNumber: string;
  name: string;
  department: string;
  position?: string;
  jobTitle: string;
  hireDate: ISODate;
  birthDate?: ISODate;
  gender?: Gender;
  phone?: string;
  isForeign?: boolean;
}

/** 임직원 명부 관리 (모든 메뉴가 공통으로 참조) */
export class EmployeeService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly ids: IdGenerator,
  ) {}

  async list(): Promise<Employee[]> {
    const all = await this.employees.list();
    return all
      .filter((e) => e.active)
      .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  }

  listAll(): Promise<Employee[]> {
    return this.employees.list();
  }

  getById(id: EmployeeId): Promise<Employee | null> {
    return this.employees.getById(id);
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const employee: Employee = { id: this.ids.next(), active: true, ...input };
    await this.employees.save(employee);
    return employee;
  }

  async update(employee: Employee): Promise<void> {
    await this.employees.save(employee);
  }

  /** 관리 대상에서 제외(비활성화) — 기록은 보존 */
  async deactivate(id: EmployeeId): Promise<void> {
    const employee = await this.employees.getById(id);
    if (!employee) return;
    await this.employees.save({ ...employee, active: false });
  }
}
