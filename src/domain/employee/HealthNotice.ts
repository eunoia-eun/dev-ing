import type { ExposureAssessment } from '../hazard/ExposureAssessment';
import { gradeCategory, type HealthCheckup } from '../checkup/HealthCheckup';
import type { EnrollmentStatus } from '../program/HealthProgram';

/** 임직원 홈 화면용 "건강 알림장" 도장 한 칸 */
export type HealthStampLevel = 'great' | 'warn' | 'help';

export interface HealthStamp {
  key: 'specialExam' | 'checkupResult' | 'program';
  icon: string;
  label: string;
  level: HealthStampLevel;
  text: string;
  emoji: string;
}

export interface HealthNoticeResult {
  stamps: HealthStamp[];
  message: string;
}

export interface HealthNoticeInput {
  /** 진행 중(active)인 노출의 특수검진 도래 평가 */
  activeExposures: ExposureAssessment[];
  /** 최신 건강검진(없으면 미실시) */
  latestCheckup?: HealthCheckup;
  /** 취소되지 않은 건강프로그램 신청 상태 목록 */
  enrollmentStatuses: EnrollmentStatus[];
}

/**
 * 임직원 홈 화면에 표시할 "건강 알림장"의 도장 3칸(특수검진·건강검진·건강프로그램)을 계산한다.
 */
export function computeHealthNotice(input: HealthNoticeInput): HealthNoticeResult {
  const stamps: HealthStamp[] = [
    stampForSpecialExam(input.activeExposures),
    stampForCheckup(input.latestCheckup),
    stampForProgram(input.enrollmentStatuses),
  ];
  return { stamps, message: overallMessage(stamps) };
}

function stampForSpecialExam(exposures: ExposureAssessment[]): HealthStamp {
  const base = { key: 'specialExam' as const, icon: '⚗️', label: '특수검진 일정' };
  if (exposures.length === 0 || exposures.every((ex) => ex.status === 'ok')) {
    return { ...base, level: 'great', text: '참 잘했어요', emoji: '🌟' };
  }
  if (exposures.some((ex) => ex.status === 'overdue')) {
    return { ...base, level: 'help', text: '꼭 챙겨주세요', emoji: '🚨' };
  }
  return { ...base, level: 'warn', text: '조금만 더 챙겨요', emoji: '⏰' };
}

function stampForCheckup(checkup?: HealthCheckup): HealthStamp {
  const base = { key: 'checkupResult' as const, icon: '🩺', label: '건강검진 결과' };
  if (!checkup) return { ...base, level: 'great', text: '참 잘했어요', emoji: '🌟' };
  switch (gradeCategory(checkup.grade)) {
    case 'normal':
      return { ...base, level: 'great', text: '참 잘했어요', emoji: '🌟' };
    case 'watch':
      return { ...base, level: 'warn', text: '관찰이 필요해요', emoji: '👀' };
    case 'recheck':
      return { ...base, level: 'warn', text: '재검을 받아봐요', emoji: '🔍' };
    case 'finding':
      return { ...base, level: 'help', text: '보건실에 들러주세요', emoji: '🩹' };
  }
}

function stampForProgram(statuses: EnrollmentStatus[]): HealthStamp {
  const base = { key: 'program' as const, icon: '🏃', label: '건강프로그램 참여' };
  if (statuses.some((s) => s !== 'cancelled')) {
    return { ...base, level: 'great', text: '참 잘했어요', emoji: '🌟' };
  }
  return { ...base, level: 'warn', text: '한번 참여해봐요', emoji: '🙋' };
}

function overallMessage(stamps: HealthStamp[]): string {
  if (stamps.some((s) => s.level === 'help')) {
    return '보건관리자가 도와드릴게요! 함께 챙겨봐요 💙';
  }
  if (stamps.every((s) => s.level === 'great')) {
    return '오늘도 완벽해요! 정말 최고예요 🎉';
  }
  return '오늘도 수고했어요! 조금만 더 힘내봐요 💙';
}
