import type { LabItem } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';

export interface LabItemRepository {
  list(): Promise<LabItem[]>;
  getById(id: Id): Promise<LabItem | null>;
  save(item: LabItem): Promise<void>;
  remove(id: Id): Promise<void>;
}
