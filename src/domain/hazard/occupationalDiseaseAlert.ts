import type { HealthCheckup, HealthGrade } from '../checkup/HealthCheckup';
import type { ExposureRecord } from './ExposureAssessment';

export type AlertGrade = Extract<HealthGrade, 'C1' | 'D1' | 'D2'>;

const ALERT_GRADES: HealthGrade[] = ['C1', 'D1', 'D2'];

export interface OccupationalDiseaseAlert {
  substanceCode: string;
  substanceName: string;
  exposureStartDate: string;
  checkupDate: string;
  checkupType: string;
  grade: AlertGrade;
  /** 검진 시 의사 소견 */
  opinion?: string;
}

/**
 * 가장 최근 검진이 C1/D1/D2이고 진행 중인 유해인자 노출이 있을 때
 * "직업병 연관 검토 필요" 알림을 생성한다.
 *
 * 가장 최근 검진이 A/C2/CN/R이면 빈 배열(최근 결과가 양호).
 * 진행 중 노출이 없으면 빈 배열.
 */
export function detectOccupationalDiseaseAlerts(
  checkups: HealthCheckup[],
  activeExposures: ExposureRecord[],
): OccupationalDiseaseAlert[] {
  if (checkups.length === 0 || activeExposures.length === 0) return [];

  const latest = [...checkups].sort((a, b) => b.examDate.localeCompare(a.examDate))[0];
  if (!ALERT_GRADES.includes(latest.grade)) return [];

  return activeExposures.map((exp) => ({
    substanceCode: `${exp.categoryCode}-${exp.substanceNo}`,
    substanceName: exp.substanceName,
    exposureStartDate: exp.startDate,
    checkupDate: latest.examDate,
    checkupType: latest.type,
    grade: latest.grade as AlertGrade,
    opinion: latest.opinion,
  }));
}
