import type { Id, ISODate } from '../shared/types';
import type { EmployeeId } from './Employee';

/**
 * 배치(발령) 이력 한 건 — 임직원이 특정 기간 동안 어느 부서에서 어떤 업무를 했는지.
 * 부서·업무가 바뀔 때마다 이전 배치를 종료(endDate)하고 새 배치를 시작해 from-to로 쌓는다.
 * (임직원은 부서를 이름(string)으로 참조하므로 여기서도 이름으로 보존)
 */
export interface Assignment {
  id: Id;
  employeeId: EmployeeId;
  department: string;
  jobTitle: string;
  /** 배치(발령) 시작일 */
  startDate: ISODate;
  /** 배치 종료일 — 없으면 현재 진행 중 */
  endDate?: ISODate;
  note?: string;
}

/** 진행 중(종료일 없음) 배치인지 */
export function isCurrentAssignment(a: Assignment): boolean {
  return a.endDate == null || a.endDate === '';
}
