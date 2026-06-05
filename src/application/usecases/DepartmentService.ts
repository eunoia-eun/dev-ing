import type { Department } from '@domain/department/Department';
import type { Id } from '@domain/shared/types';
import type { DepartmentRepository } from '../ports/DepartmentRepository';
import type { EmployeeRepository } from '../ports/EmployeeRepository';
import type { IdGenerator } from '../ports/system';

export interface DepartmentWithCount {
  department: Department;
  /** 소속 활성 임직원 수 */
  employeeCount: number;
}

/**
 * 부서 관리.
 * 임직원은 부서를 '이름'으로 참조하므로, 부서명 변경 시 소속 임직원에 반영(cascade)하고,
 * 소속 임직원이 있는 부서는 삭제를 막는다.
 */
export class DepartmentService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly employees: EmployeeRepository,
    private readonly ids: IdGenerator,
  ) {}

  async list(): Promise<Department[]> {
    return (await this.departments.list()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 부서별 소속 임직원 수 포함 목록 */
  async listWithCounts(): Promise<DepartmentWithCount[]> {
    const [depts, emps] = await Promise.all([this.list(), this.employees.list()]);
    return depts.map((department) => ({
      department,
      employeeCount: emps.filter((e) => e.active && e.department === department.name).length,
    }));
  }

  async create(name: string, note?: string): Promise<Department> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('부서명을 입력하세요.');
    const all = await this.departments.list();
    if (all.some((d) => d.name === trimmed)) throw new Error('이미 존재하는 부서명입니다.');
    const department: Department = { id: this.ids.next(), name: trimmed, note: note?.trim() || undefined };
    await this.departments.save(department);
    return department;
  }

  /** 부서명/비고 수정. 부서명이 바뀌면 소속 임직원의 부서명도 함께 변경. */
  async update(id: Id, name: string, note?: string): Promise<Department> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('부서명을 입력하세요.');
    const dept = await this.departments.getById(id);
    if (!dept) throw new Error('부서를 찾을 수 없습니다.');
    const all = await this.departments.list();
    if (all.some((d) => d.id !== id && d.name === trimmed)) {
      throw new Error('이미 존재하는 부서명입니다.');
    }
    const oldName = dept.name;
    const updated: Department = { ...dept, name: trimmed, note: note?.trim() || undefined };
    await this.departments.save(updated);

    if (oldName !== trimmed) {
      const emps = await this.employees.list();
      for (const e of emps.filter((e) => e.department === oldName)) {
        await this.employees.save({ ...e, department: trimmed });
      }
    }
    return updated;
  }

  /** 소속 임직원이 없을 때만 삭제 가능 */
  async remove(id: Id): Promise<void> {
    const dept = await this.departments.getById(id);
    if (!dept) return;
    const emps = await this.employees.list();
    const count = emps.filter((e) => e.active && e.department === dept.name).length;
    if (count > 0) {
      throw new Error(`소속 임직원이 ${count}명 있어 삭제할 수 없습니다. 먼저 이동하거나 제외하세요.`);
    }
    await this.departments.remove(id);
  }
}
