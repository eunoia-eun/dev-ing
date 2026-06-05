import type { EmployeeId } from '../employee/Employee';
import type { Id, ISODate, ISODateTime } from '../shared/types';
import type { MedicineDispense } from './Medicine';

/** 증상 정도 */
export type Severity = 'mild' | 'moderate' | 'severe';

export const SEVERITY_LABEL: Record<Severity, string> = {
  mild: '경증',
  moderate: '중등도',
  severe: '중증',
};

/** 혈압 측정값 */
export interface BloodPressure {
  systolic: number; // 수축기
  diastolic: number; // 이완기
}

/** 방문 시점에 기록된 '증상 ↔ 노출 유해인자' 점검 결과 스냅샷 */
export interface HazardFinding {
  substanceName: string;
  /** 관련 가능성이 있는 입력 증상 */
  matchedSymptoms: string[];
  /** 해당 물질 표적장기 */
  targetOrgans: string[];
}

/** 등록·수정 변경 이력 한 줄 */
export interface VisitLogEntry {
  at: ISODateTime;
  action: 'created' | 'updated';
  /** 처리한 보건관리자 */
  by: string;
  /** 변경 요약(수정 시) */
  note?: string;
}

/**
 * 건강 관련 증상 및 상비약 수령 기록(1회 방문).
 * = 보건실 방문 차트 한 줄.
 */
export interface SymptomVisit {
  id: Id;
  employeeId: EmployeeId;
  /** 방문 일시 */
  visitedAt: ISODateTime;
  /** 증상 태그 (예: 두통, 소화불량, 발열) */
  symptoms: string[];
  /** 증상 상세 메모 */
  symptomNote?: string;
  severity: Severity;
  /** 체온(℃) */
  bodyTemperature?: number;
  bloodPressure?: BloodPressure;
  /** 수령한 상비약 내역 */
  dispensedMedicines: MedicineDispense[];
  /** 조치 사항 (예: 휴식 후 복귀 / 병원 안내 / 귀가) */
  action?: string;
  /** 처리한 보건관리자명 */
  managedBy: string;
  /** 증상 ↔ 노출 유해인자 점검 결과(관련 가능성이 있는 물질만) */
  hazardFindings?: HazardFinding[];
  /** 등록·수정 변경 이력 */
  log?: VisitLogEntry[];
}

/** 방문 일자(YYYY-MM-DD) 추출 */
export function visitDate(visit: SymptomVisit): ISODate {
  return visit.visitedAt.slice(0, 10);
}

/** 고혈압 주의 여부(단순 기준: 140/90 이상) — 참고용 플래그 */
export function isHypertensive(bp: BloodPressure): boolean {
  return bp.systolic >= 140 || bp.diastolic >= 90;
}

/** 발열 여부(37.5℃ 이상) — 참고용 플래그 */
export function hasFever(temperatureCelsius: number): boolean {
  return temperatureCelsius >= 37.5;
}
