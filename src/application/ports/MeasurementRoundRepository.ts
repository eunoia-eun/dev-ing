import type { MeasurementRound, MeasurementDocument } from '@domain/measurement/MeasurementRound';

export interface MeasurementRoundRepository {
  list(): Promise<MeasurementRound[]>;
  getById(id: string): Promise<MeasurementRound | null>;
  save(round: MeasurementRound): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface MeasurementDocumentRepository {
  listByRound(roundId: string): Promise<MeasurementDocument[]>;
  getById(id: string): Promise<MeasurementDocument | null>;
  save(doc: MeasurementDocument): Promise<void>;
  remove(id: string): Promise<void>;
  removeByRound(roundId: string): Promise<void>;
}

export interface FileStore {
  save(id: string, data: ArrayBuffer): Promise<void>;
  load(id: string): Promise<ArrayBuffer | null>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}
