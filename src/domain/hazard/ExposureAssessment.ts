import type { EmployeeId } from '../employee/Employee';
import type { Id, ISODate } from '../shared/types';
import { addMonths, compareDates, diffInDays } from '../shared/date';
import type { HazardCategory, HazardCategoryCode } from './HazardousSubstance';

/**
 * 한 임직원이 특정 유해인자에 노출되고 있다는 기록.
 * (= 특수건강진단 대상이 되는 업무 배치)
 */
export interface ExposureRecord {
  id: Id;
  employeeId: EmployeeId;
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  /** 표시용 물질명 스냅샷 (카탈로그가 개정돼도 당시 기록을 보존) */
  substanceName: string;
  /** 노출(업무 배치) 시작일 */
  startDate: ISODate;
  /** 노출 종료일 — 부서·업무 변경 등으로 더 이상 노출되지 않으면 기입(없으면 진행 중) */
  endDate?: ISODate;
  /** 노출 당시 부서 스냅샷 (등록 시점의 임직원 부서) */
  department?: string;
  /** 노출 당시 담당 업무 스냅샷 */
  jobTitle?: string;
  /** 가장 최근에 받은 특수건강진단일 (아직 없으면 undefined) */
  lastExamDate?: ISODate;
  note?: string;
}

/** 노출이 종료(과거 이력)됐는지 — endDate가 있으면 종료 */
export function isExposureEnded(record: ExposureRecord): boolean {
  return record.endDate != null && record.endDate !== '';
}

/** 다음 검진까지의 여유에 따른 상태 */
export type ExposureStatus =
  | 'overdue' // 기한 초과 (검진 필요)
  | 'due-soon' // 임박 (기본 30일 이내)
  | 'ok' // 여유
  | 'ended'; // 종료(과거 이력) — 검진 도래 대상 아님

export interface ExposureAssessment {
  record: ExposureRecord;
  /** 다음 특수건강진단 예정일 */
  nextExamDueDate: ISODate;
  /** 첫 검진(배치 후 최초)인지, 주기 검진인지 */
  basis: 'first' | 'periodic';
  status: ExposureStatus;
  /** 오늘 기준 예정일까지 남은 일수 (음수면 초과) */
  daysUntilDue: number;
}

/** '임박' 으로 볼 기본 임계 일수 */
export const DUE_SOON_THRESHOLD_DAYS = 30;

/**
 * 노출 기록 + 분류 기준 + 기준일(today)로 다음 검진일과 상태를 계산한다.
 *
 * - 아직 검진 이력이 없으면: 배치일 + firstExamMonths (배치 후 최초 특수건강진단)
 * - 검진 이력이 있으면:    최근 검진일 + cycleMonths (주기 검진)
 *
 * 순수 함수 — IO·현재시각에 의존하지 않으므로 단위 테스트가 결정적이다.
 */
export function assessExposure(
  record: ExposureRecord,
  category: HazardCategory,
  today: ISODate,
  dueSoonThresholdDays: number = DUE_SOON_THRESHOLD_DAYS,
): ExposureAssessment {
  const basis: 'first' | 'periodic' = record.lastExamDate ? 'periodic' : 'first';
  const anchor = record.lastExamDate ?? record.startDate;
  const months = basis === 'first' ? category.firstExamMonths : category.cycleMonths;
  const nextExamDueDate = addMonths(anchor, months);
  const daysUntilDue = diffInDays(today, nextExamDueDate);

  // 종료된 노출은 검진 도래 대상이 아니다(이력으로만 보존).
  let status: ExposureStatus;
  if (isExposureEnded(record)) {
    status = 'ended';
  } else if (compareDates(nextExamDueDate, today) < 0) {
    status = 'overdue';
  } else if (daysUntilDue <= dueSoonThresholdDays) {
    status = 'due-soon';
  } else {
    status = 'ok';
  }

  return { record, nextExamDueDate, basis, status, daysUntilDue };
}

const STATUS_ORDER: Record<ExposureStatus, number> = {
  overdue: 0,
  'due-soon': 1,
  ok: 2,
  ended: 3,
};

/** 위급한(초과 → 임박 → 여유) 순으로 정렬하기 위한 비교자 */
export function byUrgency(a: ExposureAssessment, b: ExposureAssessment): number {
  const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (s !== 0) return s;
  return a.daysUntilDue - b.daysUntilDue;
}

export const EXPOSURE_STATUS_LABEL: Record<ExposureStatus, string> = {
  overdue: '기한 초과',
  'due-soon': '임박',
  ok: '여유',
  ended: '종료',
};
