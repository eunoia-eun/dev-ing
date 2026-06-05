import type { InventoryMovement } from '@domain/inventory/InventoryMovement';

/** 입출고 대장 저장소 (추가 전용 — 기록 보존) */
export interface InventoryMovementRepository {
  list(): Promise<InventoryMovement[]>;
  save(movement: InventoryMovement): Promise<void>;
}
