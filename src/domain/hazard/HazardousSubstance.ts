/**
 * 특수건강진단 대상 유해인자 카탈로그 도메인 타입.
 * 원천: 산업안전보건법 시행규칙 [별표 22] (개정 2021. 11. 19.)
 * 데이터: src/infrastructure/seed/hazardousSubstances.json (PDF에서 파싱)
 */

/** 유해인자 분류 코드 */
export type HazardCategoryCode =
  | 'CHEM_ORGANIC' // 유기화합물(109종)
  | 'CHEM_METAL' // 금속류(20종)
  | 'CHEM_ACID_ALKALI' // 산 및 알카리류(8종)
  | 'CHEM_GAS' // 가스 상태 물질류(14종)
  | 'CHEM_PERMIT' // 허가 대상 유해물질(12종)
  | 'CHEM_MWF' // 금속가공유
  | 'DUST' // 분진(7종)
  | 'PHYSICAL' // 물리적 인자(8종)
  | 'NIGHT_WORK'; // 야간작업(2종)

/** 카탈로그 상의 개별 유해인자(물질) */
export interface HazardSubstance {
  /** 분류 내 번호 */
  no: number;
  nameKo: string;
  nameEn: string | null;
  /** CAS 번호 (해당 없으면 null) */
  cas: string | null;
}

/** 유해인자 분류 (유기화합물, 금속류 등) */
export interface HazardCategory {
  code: HazardCategoryCode;
  /** 대분류 그룹명 (화학적 인자 / 분진 / 물리적 인자 / 야간작업) */
  group: string;
  /** 분류명 (유기화합물 등) */
  name: string;
  /**
   * 배치 후 첫 특수건강진단 시기(개월). [별표 23] 기준의 분류별 일반 기본값.
   * 물질별 세부 기준은 보건관리자가 노출 등록 시 조정할 수 있다.
   */
  firstExamMonths: number;
  /** 특수건강진단 주기(개월) */
  cycleMonths: number;
  substances: HazardSubstance[];
}

/** 카탈로그 전체 */
export interface HazardCatalog {
  source: string;
  revision: string;
  note: string;
  categories: HazardCategory[];
}

/** 특정 물질을 가리키는 참조 (분류코드 + 번호) */
export interface SubstanceRef {
  categoryCode: HazardCategoryCode;
  substanceNo: number;
}

/**
 * 유해인자별 건강장해 상세.
 * 원천: 근로자건강진단 실무지침 제3권 「유해인자별 건강장해」(산업안전보건연구원, 2024).
 * 데이터: src/infrastructure/seed/hazardHealthDetails.json (PDF에서 파싱)
 */
/**
 * 한국 고용노동부 화학물질 노출기준(2020.1.14.) — 항목별 구조화.
 * 값 단위는 가스·증기는 ppm, 분진·미스트·금속은 ㎎/㎥ 기준(원문 표기 그대로 보존).
 */
export interface KoreanExposureLimit {
  /** 시간가중평균(TWA). 'C'가 붙으면 최고노출기준(Ceiling) */
  twa?: string;
  /** 단시간노출기준(STEL) */
  stel?: string;
  /** 피부흡수 해당 여부 */
  skin?: boolean;
  /** 발암성 등급(1A·1B·2, 주석 포함) */
  carcinogen?: string;
  /** 생식세포 변이원성 등급 */
  mutagen?: string;
  /** 생식독성 등급 */
  reproToxic?: string;
}

export interface HazardHealthDetail {
  /** 원문 표기 물질명(검증용) */
  docName: string;
  /** CAS 번호 */
  cas?: string | null;
  /** 동의어 */
  synonyms?: string;
  /** 물리·화학적 성질 */
  physicalChemical?: string;
  /** 한국 고용노동부 노출기준(2020.1.14.) */
  exposureLimitKr?: KoreanExposureLimit;
  /** 흡수·대사·배설·반감기 */
  absorption?: string;
  /** 표적장기(만성 건강영향에서 추출) */
  targetOrgans: string[];
  /** 발생원 및 용도 */
  uses?: string;
  /** 주로 노출되는 공정 */
  process?: string;
  /** 표적장기별 건강장해(급성/만성/발암성) 본문 */
  healthEffects?: string;
}

export function findCategory(
  catalog: HazardCatalog,
  code: HazardCategoryCode,
): HazardCategory | undefined {
  return catalog.categories.find((c) => c.code === code);
}

export function findSubstance(
  catalog: HazardCatalog,
  ref: SubstanceRef,
): { category: HazardCategory; substance: HazardSubstance } | undefined {
  const category = findCategory(catalog, ref.categoryCode);
  if (!category) return undefined;
  const substance = category.substances.find((s) => s.no === ref.substanceNo);
  if (!substance) return undefined;
  return { category, substance };
}

/** 카탈로그 전체에서 이름/영문/CAS로 검색 */
export function searchSubstances(
  catalog: HazardCatalog,
  query: string,
): Array<{ category: HazardCategory; substance: HazardSubstance }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: Array<{ category: HazardCategory; substance: HazardSubstance }> = [];
  for (const category of catalog.categories) {
    for (const substance of category.substances) {
      const haystack = [substance.nameKo, substance.nameEn ?? '', substance.cas ?? '']
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) out.push({ category, substance });
    }
  }
  return out;
}
