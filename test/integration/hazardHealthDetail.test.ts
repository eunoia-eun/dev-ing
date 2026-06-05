import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { anEmployee, anExposureRecord } from '@test/harness/builders';

describe('HazardExposureService.getHealthDetail', () => {
  it('벤젠(유기화합물-41)의 유해인자별 건강장해 상세를 반환한다', async () => {
    const { services } = buildTestServices();
    const detail = await services.hazard.getHealthDetail({
      categoryCode: 'CHEM_ORGANIC',
      substanceNo: 41,
    });
    expect(detail).not.toBeNull();
    expect(detail!.docName).toContain('벤젠');
    expect(detail!.targetOrgans).toContain('조혈기계');
    expect(detail!.healthEffects).toBeTruthy();
    // 추가 항목: 동의어·물리화학·흡수대사
    expect(detail!.synonyms).toBeTruthy();
    expect(detail!.physicalChemical).toBeTruthy();
    expect(detail!.absorption).toBeTruthy();
    // 노출기준은 항목별로 구조화(단위 포함) — 벤젠: TWA 0.5 ppm, STEL 2.5 ppm, 발암성 1A, 변이원성 1B
    expect(detail!.exposureLimitKr).toMatchObject({
      twa: '0.5 ppm',
      stel: '2.5 ppm',
      carcinogen: '1A',
      mutagen: '1B',
    });
  });

  it('야간작업도 건강장해 자료를 가진다', async () => {
    const { services } = buildTestServices();
    const d1 = await services.hazard.getHealthDetail({ categoryCode: 'NIGHT_WORK', substanceNo: 1 });
    expect(d1?.healthEffects).toBeTruthy();
  });

  it('자료가 없는 유해광선(PHYSICAL-6)은 null을 반환한다', async () => {
    const { services } = buildTestServices();
    const detail = await services.hazard.getHealthDetail({
      categoryCode: 'PHYSICAL',
      substanceNo: 6,
    });
    expect(detail).toBeNull();
  });
});

describe('HazardExposureService.checkSymptomRelations', () => {
  it('노출 물질의 건강장해(표적장기)와 입력 증상을 교차 점검한다', async () => {
    const { services } = buildTestServices({
      employees: [anEmployee({ id: 'emp-1' })],
      exposures: [
        anExposureRecord({
          id: 'x1',
          employeeId: 'emp-1',
          categoryCode: 'CHEM_ORGANIC',
          substanceNo: 91, // 톨루엔 — 표적장기 신경계
          substanceName: '톨루엔',
        }),
      ],
    });
    const checks = await services.hazard.checkSymptomRelations('emp-1', ['두통']);
    const tol = checks.find((c) => c.substanceNo === 91);
    expect(tol?.matchedSymptoms).toContain('두통');
  });

  it('노출 기록이 없으면 빈 배열', async () => {
    const { services } = buildTestServices({ employees: [anEmployee({ id: 'emp-9' })] });
    expect(await services.hazard.checkSymptomRelations('emp-9', ['두통'])).toEqual([]);
  });
});
