import type { LabGroup } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';

export interface LabGroupRepository {
  list(): Promise<LabGroup[]>;
  getById(id: Id): Promise<LabGroup | null>;
  save(group: LabGroup): Promise<void>;
  remove(id: Id): Promise<void>;
}
