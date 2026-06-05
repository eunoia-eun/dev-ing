import { describe, expect, it } from 'vitest';
import {
  checkSymptomHazardRelation,
  relatedOnly,
  type ExposedSubstanceHealth,
} from '@domain/hazard/symptomMatching';

const toluene: ExposedSubstanceHealth = {
  substanceName: '톨루엔',
  categoryCode: 'CHEM_ORGANIC',
  substanceNo: 91,
  targetOrgans: ['신경계', '호흡기계'],
  healthEffects: '고농도 노출 시 중추신경계를 억제한다.',
};
const acid: ExposedSubstanceHealth = {
  substanceName: '황산',
  categoryCode: 'CHEM_ACID_ALKALI',
  substanceNo: 8,
  targetOrgans: ['호흡기계', '소화기계'],
  healthEffects: '직접 접촉 시 피부 부식과 눈 자극을 일으킨다.',
};

describe('checkSymptomHazardRelation', () => {
  it('두통은 신경계 표적장기를 가진 물질과 매칭된다', () => {
    const r = checkSymptomHazardRelation(['두통'], [toluene]);
    expect(r[0].matchedSymptoms).toContain('두통');
  });

  it('어지럼증(동의어)도 신경계로 매칭된다', () => {
    const r = checkSymptomHazardRelation(['어지럼증'], [toluene]);
    expect(r[0].matchedSymptoms).toContain('어지럼증');
  });

  it('피부 증상은 본문 키워드로 매칭된다(장기명이 없어도)', () => {
    const r = checkSymptomHazardRelation(['피부 발진'], [acid]);
    expect(r[0].matchedSymptoms).toContain('피부 발진');
  });

  it('관련 없는 증상은 매칭되지 않는다', () => {
    const r = checkSymptomHazardRelation(['치통'], [toluene]);
    expect(relatedOnly(r)).toHaveLength(0);
  });

  it('매칭 수가 많은 물질이 앞으로 정렬된다', () => {
    const r = checkSymptomHazardRelation(['두통', '기침'], [acid, toluene]);
    expect(r[0].substanceName).toBe('톨루엔'); // 신경계+호흡기계 → 2건
  });
});
