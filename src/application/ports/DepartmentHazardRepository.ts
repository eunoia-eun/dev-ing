import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';
import type { Id } from '@domain/shared/types';

/** 부서↔유해인자 매핑 저장소 */
export interface DepartmentHazardRepository {
  list(): Promise<DepartmentHazard[]>;
  save(item: DepartmentHazard): Promise<void>;
  remove(id: Id): Promise<void>;
}
