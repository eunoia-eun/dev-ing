import { isCurrentAssignment, type Assignment } from '@domain/employee/Assignment';
import type { EmployeeId } from '@domain/employee/Employee';
import type { HazardCategoryCode } from '@domain/hazard/HazardousSubstance';
import { addDays } from '@domain/shared/date';
import type { ISODate } from '@domain/shared/types';
import type { AssignmentRepository } from '../ports/AssignmentRepository';
import type { EmployeeRepository } from '../ports/EmployeeRepository';
import type { ExposureRepository } from '../ports/HazardRepository';
import type { DepartmentHazardRepository } from '../ports/DepartmentHazardRepository';
import type { Clock, IdGenerator } from '../ports/system';

export interface ChangeAssignmentInput {
  employeeId: EmployeeId;
  department: string;
  jobTitle: string;
  /** 변경(발령) 시행일 — 새 배치의 시작일 */
  effectiveDate: ISODate;
  note?: string;
}

/** 새 부서에 매핑된 유해인자 제안(노출 일괄 등록 후보) */
export interface HazardSuggestion {
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  substanceName: string;
  process?: string;
}

export interface ChangeAssignmentResult {
  assignment: Assignment;
  /** 변경일 기준으로 종료 처리된 진행 중 노출 수 */
  endedExposures: number;
  /** 새 부서 유해인자 제안(중복 제외 — UI에서 골라 노출 등록) */
  suggestions: HazardSuggestion[];
}

/**
 * 배치(발령) 이력 관리 + 부서·업무 변경 코디네이션.
 * 변경 시: 이전 배치 종료 → 새 배치 시작 → 임직원 현재 부서·업무 갱신 →
 *         진행 중 노출 종료 → 새 부서 유해인자를 제안으로 반환.
 */
export class AssignmentService {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly employees: EmployeeRepository,
    private readonly exposures: ExposureRepository,
    private readonly deptHazards: DepartmentHazardRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** 임직원 배치 이력(과거→현재). 기록이 없으면 입사일 기준 최초 배치를 만들어 둔다. */
  async getTimeline(employeeId: EmployeeId): Promise<Assignment[]> {
    const list = await this.ensure(employeeId);
    return [...list].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
    );
  }

  /** 배치 이력이 없으면 임직원 현재 부서·업무로 '최초 배치'(입사일 시작)를 1건 생성 */
  private async ensure(employeeId: EmployeeId): Promise<Assignment[]> {
    const existing = await this.assignments.listByEmployee(employeeId);
    if (existing.length > 0) return existing;
    const employee = await this.employees.getById(employeeId);
    if (!employee) return [];
    const initial: Assignment = {
      id: this.ids.next(),
      employeeId,
      department: employee.department,
      jobTitle: employee.jobTitle,
      startDate: employee.hireDate,
    };
    await this.assignments.save(initial);
    return [initial];
  }

  async changeAssignment(input: ChangeAssignmentInput): Promise<ChangeAssignmentResult> {
    const department = input.department.trim();
    const jobTitle = input.jobTitle.trim();
    if (!department || !jobTitle) throw new Error('새 부서와 담당 업무를 입력하세요.');
    if (!input.effectiveDate) throw new Error('변경(발령)일을 입력하세요.');

    const employee = await this.employees.getById(input.employeeId);
    if (!employee) throw new Error('임직원을 찾을 수 없어요.');

    const timeline = await this.ensure(input.employeeId);
    const dayBefore = addDays(input.effectiveDate, -1);

    // 1) 진행 중 배치 종료
    for (const a of timeline) {
      if (isCurrentAssignment(a)) {
        await this.assignments.save({ ...a, endDate: dayBefore });
      }
    }

    // 2) 새 배치 시작
    const assignment: Assignment = {
      id: this.ids.next(),
      employeeId: input.employeeId,
      department,
      jobTitle,
      startDate: input.effectiveDate,
      note: input.note?.trim() || undefined,
    };
    await this.assignments.save(assignment);

    // 3) 임직원 현재 부서·업무 갱신
    await this.employees.save({ ...employee, department, jobTitle });

    // 4) 진행 중 노출 종료 (변경일 전날까지)
    const exposures = await this.exposures.listByEmployee(input.employeeId);
    let endedExposures = 0;
    for (const x of exposures) {
      if (x.endDate == null || x.endDate === '') {
        await this.exposures.save({ ...x, endDate: dayBefore });
        endedExposures += 1;
      }
    }

    // 5) 새 부서 매핑 유해인자를 제안으로
    const mappings = (await this.deptHazards.list()).filter((m) => m.department === department);
    const suggestions: HazardSuggestion[] = mappings.map((m) => ({
      categoryCode: m.categoryCode,
      substanceNo: m.substanceNo,
      substanceName: m.substanceName,
      process: m.process,
    }));

    return { assignment, endedExposures, suggestions };
  }

  /** 배치 기록 직접 종료(수정용) */
  async endAssignment(id: string, endDate?: ISODate): Promise<void> {
    const a = await this.assignments.getById(id);
    if (!a) throw new Error('배치 기록을 찾을 수 없어요.');
    await this.assignments.save({ ...a, endDate: endDate ?? this.clock.today() });
  }
}
