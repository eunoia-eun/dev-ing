import type { CheckupTypeItem } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';

export interface CheckupTypeRepository {
  list(): Promise<CheckupTypeItem[]>;
  getById(id: Id): Promise<CheckupTypeItem | null>;
  save(item: CheckupTypeItem): Promise<void>;
  remove(id: Id): Promise<void>;
}
