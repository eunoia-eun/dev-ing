import type { Id } from '../shared/types';
import type { HazardCategoryCode } from './HazardousSubstance';

/**
 * 부서(공정)에서 다루는 유해인자 매핑.
 * 임직원 개개인의 노출 기록과 별개로, "이 부서는 이런 유해인자를 다룬다"를 직접 지정한다.
 * (작업환경측정·위험성평가의 공정별 유해인자 파악 결과를 옮겨 적는 용도)
 *
 * 임직원이 부서를 이름(string)으로 참조하므로 여기서도 부서를 이름으로 묶는다.
 */
export interface DepartmentHazard {
  id: Id;
  /** 부서명 */
  department: string;
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  /** 물질명 스냅샷(카탈로그에서 채움) */
  substanceName: string;
  /** 공정/작업 설명(선택) */
  process?: string;
}

/** 매핑 + 적용 현황(부서 인원 / 이미 노출 등록된 인원) */
export interface DepartmentHazardView extends DepartmentHazard {
  /** 해당 부서 임직원 수 */
  employeeCount: number;
  /** 그중 이 유해인자에 노출이 이미 등록된 인원 */
  appliedCount: number;
  /** 이 유해인자에 진행 중 노출이 등록된 부서 임직원 (이름·id) */
  appliedEmployees: { id: string; name: string }[];
}
