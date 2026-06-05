import type { EmployeeId } from '@domain/employee/Employee';
import type { Medicine } from '@domain/symptom/Medicine';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { Id } from '@domain/shared/types';

/** 상비약 마스터 저장소 */
export interface MedicineRepository {
  list(): Promise<Medicine[]>;
  getById(id: Id): Promise<Medicine | null>;
  save(medicine: Medicine): Promise<void>;
  remove(id: Id): Promise<void>;
}

/** 증상/방문(보건실 차트) 저장소 */
export interface SymptomVisitRepository {
  list(): Promise<SymptomVisit[]>;
  listByEmployee(employeeId: EmployeeId): Promise<SymptomVisit[]>;
  getById(id: Id): Promise<SymptomVisit | null>;
  save(visit: SymptomVisit): Promise<void>;
  remove(id: Id): Promise<void>;
}
