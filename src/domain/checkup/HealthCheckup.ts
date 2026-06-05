import type { EmployeeId } from '../employee/Employee';
import type { Id, ISODate } from '../shared/types';

/** 검진 종류 코드 (기본 코드 또는 사용자 추가 'ctype_*') */
export type CheckupType = string;

/** 관리 가능한 검진 종류 */
export interface CheckupTypeItem {
  id: string;
  name: string;
}

export const DEFAULT_CHECKUP_TYPES: CheckupTypeItem[] = [
  { id: 'general', name: '일반건강진단' },
  { id: 'special', name: '특수건강진단' },
  { id: 'pre_placement', name: '배치전건강진단' },
  { id: 'ad_hoc', name: '수시건강진단' },
];

/** 기본 종류 라벨(폴백용) */
export const CHECKUP_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DEFAULT_CHECKUP_TYPES.map((t) => [t.id, t.name]),
);

export function isBuiltinCheckupType(code: string): boolean {
  return DEFAULT_CHECKUP_TYPES.some((t) => t.id === code);
}

export function resolveCheckupTypeName(code: string, types: CheckupTypeItem[]): string {
  return types.find((t) => t.id === code)?.name ?? CHECKUP_TYPE_LABEL[code] ?? code;
}

/**
 * 건강관리구분(판정).
 * A 정상 / C 요관찰(C1 직업병·C2 일반·CN 질환의심) / D 유소견(D1 직업병·D2 일반) / R 제2차 검진대상
 */
export type HealthGrade = 'A' | 'C1' | 'C2' | 'CN' | 'D1' | 'D2' | 'R';

export const HEALTH_GRADE_LABEL: Record<HealthGrade, string> = {
  A: 'A (정상)',
  C1: 'C1 (직업병 요관찰)',
  C2: 'C2 (일반질병 요관찰)',
  CN: 'CN (질환의심)',
  D1: 'D1 (직업병 유소견)',
  D2: 'D2 (일반질병 유소견)',
  R: 'R (제2차 검진대상)',
};

/** 업무수행 적합여부 */
export type WorkFitness = 'fit' | 'conditional' | 'temporarily_unfit' | 'permanently_unfit';

export const WORK_FITNESS_LABEL: Record<WorkFitness, string> = {
  fit: '가 (적합)',
  conditional: '나 (조건부 적합)',
  temporarily_unfit: '다 (한시적 부적합)',
  permanently_unfit: '라 (영구적 부적합)',
};

/** 사후관리 조치 항목(사후관리소견서) */
export type FollowUpAction =
  | 'follow_up_test'
  | 'treatment_at_work'
  | 'reduced_hours'
  | 'job_change'
  | 'work_restriction'
  | 'occdisease_referral'
  | 'ppe'
  | 'lifestyle'
  | 'health_education'
  | 'other';

export const FOLLOW_UP_ACTION_LABEL: Record<FollowUpAction, string> = {
  follow_up_test: '추적검사',
  treatment_at_work: '근무 중 치료',
  reduced_hours: '근로시간 단축',
  job_change: '작업전환',
  work_restriction: '근로제한',
  occdisease_referral: '직업병 확진의뢰',
  ppe: '보호구 착용',
  lifestyle: '생활습관 관리',
  health_education: '보건교육',
  other: '기타',
};

export const FOLLOW_UP_ACTIONS = Object.keys(FOLLOW_UP_ACTION_LABEL) as FollowUpAction[];

/** 검사 항목 정의(입력 폼·매트릭스 순서·정상범위) */
export interface LabItemDef {
  code: string;
  name: string;
  unit?: string;
  /** 묶음(신체계측/혈압/혈액/지질/간기능/신장 등) */
  group: string;
  /** 정상 하한(미만이면 이상) */
  refLow?: number;
  /** 정상 상한(초과면 이상) */
  refHigh?: number;
}

/** 기본 검사 항목 카탈로그 (최초 시드 — 이후 보건관리자가 추가/제외 가능) */
export const DEFAULT_LAB_ITEMS: LabItemDef[] = [
  { code: 'height', name: '신장', unit: 'cm', group: '신체계측' },
  { code: 'weight', name: '체중', unit: 'kg', group: '신체계측' },
  { code: 'bmi', name: 'BMI', unit: 'kg/m²', group: '신체계측', refHigh: 25 },
  { code: 'waist', name: '허리둘레', unit: 'cm', group: '신체계측' },
  { code: 'sbp', name: '수축기혈압', unit: 'mmHg', group: '혈압', refHigh: 140 },
  { code: 'dbp', name: '이완기혈압', unit: 'mmHg', group: '혈압', refHigh: 90 },
  { code: 'vision_left', name: '시력(좌)', group: '시각·청각' },
  { code: 'vision_right', name: '시력(우)', group: '시각·청각' },
  { code: 'hearing_left', name: '청력 좌(4kHz)', unit: 'dB', group: '시각·청각', refHigh: 40 },
  { code: 'hearing_right', name: '청력 우(4kHz)', unit: 'dB', group: '시각·청각', refHigh: 40 },
  { code: 'glucose', name: '공복혈당', unit: 'mg/dL', group: '혈액', refLow: 70, refHigh: 100 },
  { code: 'hba1c', name: '당화혈색소', unit: '%', group: '혈액', refHigh: 5.7 },
  { code: 'hb', name: '혈색소', unit: 'g/dL', group: '혈액', refLow: 13 },
  { code: 'tchol', name: '총콜레스테롤', unit: 'mg/dL', group: '지질', refHigh: 200 },
  { code: 'hdl', name: 'HDL 콜레스테롤', unit: 'mg/dL', group: '지질', refLow: 40 },
  { code: 'ldl', name: 'LDL 콜레스테롤', unit: 'mg/dL', group: '지질', refHigh: 130 },
  { code: 'tg', name: '중성지방', unit: 'mg/dL', group: '지질', refHigh: 150 },
  { code: 'ast', name: 'AST(SGOT)', unit: 'IU/L', group: '간기능', refHigh: 40 },
  { code: 'alt', name: 'ALT(SGPT)', unit: 'IU/L', group: '간기능', refHigh: 40 },
  { code: 'ggt', name: 'γ-GTP', unit: 'IU/L', group: '간기능', refHigh: 63 },
  { code: 'cr', name: '혈청 크레아티닌', unit: 'mg/dL', group: '신장', refHigh: 1.5 },
  { code: 'egfr', name: 'eGFR', unit: 'mL/min', group: '신장', refLow: 60 },
  { code: 'urine_protein', name: '요단백', group: '신장' },
  { code: 'urine_glucose', name: '요당', group: '신장' },
  { code: 'chest_xray', name: '흉부 X선', group: '영상의학' },
];

/** 관리 가능한 검사 항목(카탈로그 엔티티). id가 곧 검사 코드. */
export interface LabItem extends LabItemDef {
  /** 검사 코드(=LabResult.code). 내장 항목은 의미코드, 사용자 추가는 'lab_*'. */
  id: string;
  /** 입력 폼에 표시할지 여부(제외=false) */
  enabled: boolean;
  /** 표시 순서(작을수록 먼저) */
  order: number;
}

/** 검사 그룹(관리 가능) */
export interface LabGroup {
  id: string;
  name: string;
  order: number;
}

/** 기본 검사 그룹(검사 항목 그룹의 등장 순서) */
export const DEFAULT_LAB_GROUPS: string[] = [...new Set(DEFAULT_LAB_ITEMS.map((i) => i.group))];

/** 내장(기본) 항목인지 */
export function isBuiltinLabItem(code: string): boolean {
  return DEFAULT_LAB_ITEMS.some((d) => d.code === code);
}

/** 한 검진의 개별 검사 결과값 */
export interface LabResult {
  code: string;
  /** 표시명 스냅샷 */
  name: string;
  value: string;
  unit?: string;
}

/** 정상범위를 벗어났는지(숫자 항목만). 비교 불가하면 false. */
export function isLabAbnormal(value: string, def?: LabItemDef): boolean {
  if (!def) return false;
  const n = Number(value);
  if (Number.isNaN(n)) return false;
  if (def.refLow != null && n < def.refLow) return true;
  if (def.refHigh != null && n > def.refHigh) return true;
  return false;
}

/**
 * 건강검진 기록 + 사후관리소견서.
 */
export interface HealthCheckup {
  id: Id;
  employeeId: EmployeeId;
  type: CheckupType;
  /** 검진일 */
  examDate: ISODate;
  /** 검진기관 */
  institution?: string;
  /** 대상 유해인자(특수검진) */
  targetHazards?: string[];
  /** 건강관리구분(판정) */
  grade: HealthGrade;
  /** 업무수행 적합여부 */
  workFitness?: WorkFitness;
  /** 사후관리 조치(복수) */
  followUpActions?: FollowUpAction[];
  /** 사후관리 소견 / 의사 소견 */
  opinion?: string;
  /** 재검·추적검사 예정일 */
  nextExamDate?: ISODate;
  /** 검사 수치(측정값) */
  labResults?: LabResult[];
  /** 작성자(보건관리자) */
  managedBy?: string;
}

/** 정상(A)이 아니면 사후관리 대상 */
export function needsManagement(grade: HealthGrade): boolean {
  return grade !== 'A';
}

/** 판정 등급의 표시 색조 (UI 뱃지용) */
export function gradeTone(grade: HealthGrade): 'success' | 'warning' | 'danger' | 'info' {
  if (grade === 'A') return 'success';
  if (grade === 'D1' || grade === 'D2') return 'danger';
  if (grade === 'R') return 'info';
  return 'warning'; // C1·C2·CN
}

/** 통계용 판정 분류 — 정상(A)/요관찰(C1·C2·CN)/유소견(D1·D2)/재검(R) */
export type GradeCategory = 'normal' | 'watch' | 'finding' | 'recheck';

export const GRADE_CATEGORY_LABEL: Record<GradeCategory, string> = {
  normal: '정상(A)',
  watch: '요관찰(C)',
  finding: '유소견(D)',
  recheck: '재검(R)',
};

export const GRADE_CATEGORIES: GradeCategory[] = ['normal', 'watch', 'finding', 'recheck'];

export function gradeCategory(grade: HealthGrade): GradeCategory {
  if (grade === 'A') return 'normal';
  if (grade === 'D1' || grade === 'D2') return 'finding';
  if (grade === 'R') return 'recheck';
  return 'watch'; // C1·C2·CN
}

export function followUpLabels(actions?: FollowUpAction[]): string {
  if (!actions || actions.length === 0) return '-';
  return actions.map((a) => FOLLOW_UP_ACTION_LABEL[a]).join(', ');
}
