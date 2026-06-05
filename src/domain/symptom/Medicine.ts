import type { Id } from '../shared/types';

/** 상비약 마스터 */
export interface Medicine {
  id: Id;
  name: string;
  /** 분류: 진통제 / 소화제 / 감기약 / 외용제 / 위생용품 등 */
  category: string;
  /** 수량 단위: 정 / 포 / 개 / 매 등 */
  unit: string;
  /** 현재 재고 수량 */
  stock: number;
  /** 재고 부족 경고 기준 (이 값 이하이면 보충 필요) */
  lowStockThreshold: number;
}

/** 1회 수령(불출) 내역 — 증상 방문 기록에 포함된다 */
export interface MedicineDispense {
  medicineId: Id;
  /** 표시용 약품명 스냅샷 */
  medicineName: string;
  quantity: number;
  unit: string;
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly medicine: Medicine,
    public readonly requested: number,
  ) {
    super(
      `재고 부족: '${medicine.name}' 재고 ${medicine.stock}${medicine.unit}, 요청 ${requested}${medicine.unit}`,
    );
    this.name = 'InsufficientStockError';
  }
}

export function isLowStock(medicine: Medicine): boolean {
  return medicine.stock <= medicine.lowStockThreshold;
}

/**
 * 상비약 불출 — 재고를 줄인 '새' Medicine 을 돌려준다(불변).
 * 재고가 부족하면 InsufficientStockError 를 던진다.
 * 순수 함수: 입력 객체를 변경하지 않는다.
 */
export function dispenseFromStock(medicine: Medicine, quantity: number): Medicine {
  if (quantity <= 0) {
    throw new Error('수령 수량은 1 이상이어야 합니다.');
  }
  if (quantity > medicine.stock) {
    throw new InsufficientStockError(medicine, quantity);
  }
  return { ...medicine, stock: medicine.stock - quantity };
}

/** 입고(재고 보충) */
export function restock(medicine: Medicine, quantity: number): Medicine {
  if (quantity <= 0) {
    throw new Error('입고 수량은 1 이상이어야 합니다.');
  }
  return { ...medicine, stock: medicine.stock + quantity };
}
