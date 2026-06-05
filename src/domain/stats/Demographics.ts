import type { Employee } from '../employee/Employee';
import type { ISODate } from '../shared/types';

/** 통계 분석 차원 */
export type StatDimension = 'department' | 'age' | 'gender';

export const STAT_DIMENSIONS: StatDimension[] = ['department', 'age', 'gender'];

export const STAT_DIMENSION_LABEL: Record<StatDimension, string> = {
  department: '부서별',
  age: '연령별',
  gender: '성별',
};

export const AGE_BUCKETS = ['20대 이하', '30대', '40대', '50대', '60대 이상', '미상'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** 생년월일과 기준일(today)로 만 나이 계산. 생일이 아직 안 지났으면 -1. */
export function ageInYears(birthDate: ISODate | undefined, today: ISODate): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.slice(0, 10).split('-').map(Number);
  if (!by || !ty) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export function ageBucketOf(birthDate: ISODate | undefined, today: ISODate): AgeBucket {
  const age = ageInYears(birthDate, today);
  if (age == null) return '미상';
  if (age < 30) return '20대 이하';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  return '60대 이상';
}

export function genderLabel(gender: Employee['gender']): string {
  return gender === 'M' ? '남' : gender === 'F' ? '여' : '미상';
}

/** 임직원을 선택한 차원의 그룹 키로 매핑 */
export function dimensionKeyOf(employee: Employee, dim: StatDimension, today: ISODate): string {
  if (dim === 'department') return employee.department || '미상';
  if (dim === 'age') return ageBucketOf(employee.birthDate, today);
  return genderLabel(employee.gender);
}

/** 차원별 그룹 표시 순서(부서는 호출자가 정렬해서 넘긴다) */
export function dimensionGroupOrder(
  dim: StatDimension,
  departments: string[],
): string[] {
  if (dim === 'age') return [...AGE_BUCKETS];
  if (dim === 'gender') return ['남', '여', '미상'];
  return departments;
}
