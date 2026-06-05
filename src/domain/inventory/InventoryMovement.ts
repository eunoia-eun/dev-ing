import type { EmployeeId } from '../employee/Employee';
import type { Id, ISODate, ISODateTime } from '../shared/types';

export type MovementType = 'in' | 'out';

export const MOVEMENT_TYPE_LABEL: Record<MovementType, string> = {
  in: '입고',
  out: '반출',
};

/**
 * 상비약 입출고 대장의 한 줄(재고 이동 기록).
 * 약품을 삭제해도 기록이 남도록 medicineName·unit을 스냅샷으로 저장한다.
 */
export interface InventoryMovement {
  id: Id;
  /** 발생 일시 */
  at: ISODateTime;
  medicineId: Id;
  /** 표시용 약품명 스냅샷 */
  medicineName: string;
  unit: string;
  type: MovementType;
  /** 수량(항상 양수, 방향은 type으로 구분) */
  quantity: number;
  /** 사유(입고 사유 / 내원 수령 / 재고 조정 등) */
  reason?: string;
  /** 반출 대상 임직원(내원 수령 시) */
  employeeId?: EmployeeId;
  /** 처리자 */
  managedBy?: string;
}

/** 'YYYY-MM-DD' 구간으로 필터 (양끝 포함, 일자 기준) */
export function inDateRange(at: ISODateTime, start?: ISODate, end?: ISODate): boolean {
  const day = at.slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}
