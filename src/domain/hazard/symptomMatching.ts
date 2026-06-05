import type { HazardCategoryCode } from './HazardousSubstance';

/**
 * 증상 ↔ 노출 유해인자 관련성 점검 (순수 함수, 참고용).
 *
 * 두 신호를 결합한다:
 *  1) 증상 → 표적장기(계) 매핑 후 물질의 표적장기와 교집합 (가장 신뢰도 높음)
 *  2) 증상 키워드가 물질의 건강장해 본문에 등장 (피부·눈 등 장기명이 없는 증상 보조)
 *
 * 임상 진단이 아니라 보건관리자의 의사결정 보조용이다.
 */

/** 증상어(부분일치) → 관련 표적장기(계) */
const SYMPTOM_ORGAN_MAP: Array<[string[], string[]]> = [
  [['두통', '어지러', '어지럼', '현기', '저림', '떨림', '진전', '마비', '경련', '집중력', '기억력', '불면', '졸림', '의식', '혼미'], ['신경계']],
  [['기침', '가래', '호흡곤란', '숨참', '숨이', '인후', '재채기', '천식', '쌕쌕'], ['호흡기계']],
  [['구역', '구토', '오심', '메스꺼', '복통', '소화', '속쓰림', '설사', '식욕'], ['소화기계', '위장관계']],
  [['두근', '흉통', '심계', '부정맥'], ['심혈관계']],
  [['빈혈', '코피', '멍', '출혈'], ['조혈기계']],
  [['황달'], ['간담도계']],
  [['소변', '배뇨', '부종'], ['비뇨기계']],
];

/** 증상어(부분일치) → 건강장해 본문에서 찾을 키워드 */
const SYMPTOM_TEXT_MAP: Array<[string[], string[]]> = [
  [['두통'], ['두통']],
  [['어지러', '어지럼', '현기'], ['어지러', '어지럼', '현기']],
  [['구역', '구토', '오심', '메스꺼'], ['구역', '구토', '오심']],
  [['기침'], ['기침']],
  [['피부', '발진', '가려움', '두드러기', '홍반', '습진', '피부염'], ['피부', '발진', '홍반', '습진', '피부염']],
  [['눈', '시야', '시력', '결막'], ['눈', '결막', '시력', '시야']],
  [['콧물', '비염'], ['콧물', '비염']],
  [['인후', '인두'], ['인후', '인두']],
  [['피로', '무력', '권태'], ['피로', '무력', '권태']],
  [['저림', '감각'], ['저림', '감각이상', '말초신경']],
];

function rulesFor(symptom: string): { organs: Set<string>; keywords: Set<string> } {
  const t = symptom.trim();
  const organs = new Set<string>();
  const keywords = new Set<string>();
  if (!t) return { organs, keywords };
  if (t.length >= 2) keywords.add(t); // 입력어 자체도 본문에서 탐색(2자 이상만)
  for (const [keys, orgs] of SYMPTOM_ORGAN_MAP) if (keys.some((k) => t.includes(k))) orgs.forEach((o) => organs.add(o));
  for (const [keys, kws] of SYMPTOM_TEXT_MAP) if (keys.some((k) => t.includes(k))) kws.forEach((w) => keywords.add(w));
  return { organs, keywords };
}

/** 점검 대상: 임직원이 노출된 물질 + 그 건강장해 정보 */
export interface ExposedSubstanceHealth {
  substanceName: string;
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  healthEffects?: string;
  targetOrgans: string[];
}

/** 점검 결과: 물질별로 어떤 입력 증상과 관련 가능성이 있는지 */
export interface SymptomHazardCheck {
  substanceName: string;
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  targetOrgans: string[];
  /** 이 물질과 관련 가능성이 있는 입력 증상들 (없으면 빈 배열) */
  matchedSymptoms: string[];
}

export function checkSymptomHazardRelation(
  symptoms: string[],
  exposed: ExposedSubstanceHealth[],
): SymptomHazardCheck[] {
  const cleaned = symptoms.map((s) => s.trim()).filter(Boolean);
  return exposed
    .map((e) => {
      const matched: string[] = [];
      for (const s of cleaned) {
        const { organs, keywords } = rulesFor(s);
        const organHit = e.targetOrgans.some((o) => organs.has(o));
        const textHit = e.healthEffects ? [...keywords].some((k) => e.healthEffects!.includes(k)) : false;
        if (organHit || textHit) matched.push(s);
      }
      return {
        substanceName: e.substanceName,
        categoryCode: e.categoryCode,
        substanceNo: e.substanceNo,
        targetOrgans: e.targetOrgans,
        matchedSymptoms: matched,
      };
    })
    .sort((a, b) => b.matchedSymptoms.length - a.matchedSymptoms.length);
}

/** 관련 가능성이 있는(매칭된) 물질만 */
export function relatedOnly(checks: SymptomHazardCheck[]): SymptomHazardCheck[] {
  return checks.filter((c) => c.matchedSymptoms.length > 0);
}
