import type { EmployeeId } from '@domain/employee/Employee';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';
import type {
  HazardCatalog,
  HazardHealthDetail,
  SubstanceRef,
} from '@domain/hazard/HazardousSubstance';
import type { Id } from '@domain/shared/types';

/** 유해인자 카탈로그(읽기 전용) 공급 포트 — [별표 22] 시드 데이터 */
export interface HazardCatalogProvider {
  getCatalog(): HazardCatalog;
}

/** 유해인자별 건강장해 상세 공급 포트 (지연 로딩 가능하도록 async) */
export interface HazardHealthDetailProvider {
  getDetail(ref: SubstanceRef): Promise<HazardHealthDetail | null>;
}

/** 임직원 노출 기록 저장소 */
export interface ExposureRepository {
  list(): Promise<ExposureRecord[]>;
  listByEmployee(employeeId: EmployeeId): Promise<ExposureRecord[]>;
  getById(id: Id): Promise<ExposureRecord | null>;
  save(record: ExposureRecord): Promise<void>;
  remove(id: Id): Promise<void>;
}
