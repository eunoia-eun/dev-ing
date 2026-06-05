import type { Id, ISODate } from '../shared/types';

export type EmployeeId = Id;

export type Gender = 'M' | 'F';

/** 임직원(근로자) */
export interface Employee {
  id: EmployeeId;
  /** 사번 */
  employeeNumber: string;
  name: string;
  /** 부서 */
  department: string;
  /** 직급 (선택) */
  position?: string;
  /** 담당 업무/직무 — 유해인자 노출 판단의 근거가 된다 */
  jobTitle: string;
  /** 입사일 */
  hireDate: ISODate;
  birthDate?: ISODate;
  gender?: Gender;
  phone?: string;
  /** 외국인 여부 — 없거나 false면 내국인(기본) */
  isForeign?: boolean;
  /** 퇴사 등으로 관리 대상에서 제외되었는지 */
  active: boolean;
}

/** 국적 표시 라벨 (외국인 / 내국인) */
export function nationalityLabel(employee: Pick<Employee, 'isForeign'>): string {
  return employee.isForeign ? '외국인' : '내국인';
}

export function employeeDisplayName(e: Employee): string {
  return `${e.name} (${e.department}${e.position ? ` · ${e.position}` : ''})`;
}
