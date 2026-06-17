/**
 * 작업환경측정 결과 도메인.
 * 산업안전보건법 제125조에 따른 정기 작업환경측정 기록 및 법적 노출기준 초과 여부 평가.
 */

export type ExceedanceStatus = 'normal' | 'warning' | 'exceeded' | 'unknown';

export interface WorkplaceMeasurement {
  id: string;
  /** 소속 측정 회차 ID */
  roundId?: string;
  /** 측정일 (ISO 날짜) */
  measureDate: string;
  /** 측정 부서(공정) */
  department: string;
  /** 유해인자 코드 (예: "CHEM_ORGANIC-1") */
  substanceCode: string;
  /** 유해인자명 (비정규화) */
  substanceName: string;
  /** 실측 TWA 값 */
  twa?: number;
  /** 실측 STEL 값 */
  stel?: number;
  /** 측정 단위 (예: "ppm", "mg/m³") */
  unit: string;
  /** 법적 TWA 기준 문자열 (등록 시 스냅샷, 예: "300 ppm") */
  limitTwa?: string;
  /** 법적 STEL 기준 문자열 */
  limitStel?: string;
  note?: string;
}

export interface MeasurementAssessment {
  measurement: WorkplaceMeasurement;
  twaStatus: ExceedanceStatus;
  stelStatus: ExceedanceStatus;
  /** TWA·STEL 중 더 위험한 쪽 */
  overallStatus: ExceedanceStatus;
}

/**
 * 노출기준 문자열을 파싱한다.
 * 예: "300 ppm" → { value: 300, unit: "ppm", isCeiling: false }
 *     "C 0.05 ppm" → { value: 0.05, unit: "ppm", isCeiling: true }
 *     "3 ㎎/㎥"  → { value: 3, unit: "mg/m³", isCeiling: false }
 */
export function parseExposureLimit(
  str: string | undefined,
): { value: number; unit: string; isCeiling: boolean } | null {
  if (!str) return null;
  const s = str.trim();
  const isCeiling = /^C\s/i.test(s);
  const cleaned = isCeiling ? s.replace(/^C\s+/i, '') : s;
  const match = cleaned.match(/^([\d.]+)\s*(.+)$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;
  const raw = match[2].trim();
  const unit = raw
    .replace('㎎/㎥', 'mg/m³')
    .replace('㎍/㎥', 'µg/m³')
    .replace('㎎', 'mg')
    .replace('개/㎤', '개/cm³');
  return { value, unit, isCeiling };
}

/**
 * 실측값과 법적 노출기준 문자열을 비교해 초과 상태를 반환한다.
 * - 80% 미만: 'normal'
 * - 80% 이상 100% 미만: 'warning'
 * - 100% 이상: 'exceeded'
 * - 기준 없음 또는 실측 없음: 'unknown'
 */
export function assessExceedance(
  measured: number | undefined,
  limitStr: string | undefined,
): ExceedanceStatus {
  if (measured === undefined || measured === null) return 'unknown';
  const limit = parseExposureLimit(limitStr);
  if (!limit) return 'unknown';
  const ratio = measured / limit.value;
  if (ratio >= 1.0) return 'exceeded';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

const STATUS_RANK: Record<ExceedanceStatus, number> = {
  exceeded: 2,
  warning: 1,
  normal: 0,
  unknown: -1,
};

export function assessMeasurement(m: WorkplaceMeasurement): MeasurementAssessment {
  const twaStatus = assessExceedance(m.twa, m.limitTwa);
  const stelStatus = assessExceedance(m.stel, m.limitStel);
  const overallStatus =
    STATUS_RANK[twaStatus] >= STATUS_RANK[stelStatus] ? twaStatus : stelStatus;
  return { measurement: m, twaStatus, stelStatus, overallStatus };
}
