import type { WorkplaceMeasurement } from '@domain/measurement/WorkplaceMeasurement';

export interface WorkplaceMeasurementRepository {
  list(): Promise<WorkplaceMeasurement[]>;
  save(m: WorkplaceMeasurement): Promise<void>;
  remove(id: string): Promise<void>;
}
