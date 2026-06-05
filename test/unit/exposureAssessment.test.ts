import { describe, expect, it } from 'vitest';
import {
  assessExposure,
  byUrgency,
  isExposureEnded,
  type ExposureAssessment,
} from '@domain/hazard/ExposureAssessment';
import type { HazardCategory } from '@domain/hazard/HazardousSubstance';
import { anExposureRecord } from '@test/harness/builders';

const organic: HazardCategory = {
  code: 'CHEM_ORGANIC',
  group: '화학적 인자',
  name: '유기화합물',
  firstExamMonths: 6,
  cycleMonths: 12,
  substances: [],
};

const TODAY = '2026-06-02';

describe('assessExposure - 첫 검진(배치 후 최초)', () => {
  it('검진 이력이 없으면 배치일 + firstExamMonths 가 예정일', () => {
    const record = anExposureRecord({ startDate: '2025-12-10', lastExamDate: undefined });
    const a = assessExposure(record, organic, TODAY);
    expect(a.basis).toBe('first');
    expect(a.nextExamDueDate).toBe('2026-06-10');
    expect(a.daysUntilDue).toBe(8);
    expect(a.status).toBe('due-soon');
  });
});

describe('assessExposure - 주기 검진', () => {
  it('검진 이력이 있으면 최근 검진일 + cycleMonths 가 예정일', () => {
    const record = anExposureRecord({ startDate: '2020-01-01', lastExamDate: '2025-11-15' });
    const a = assessExposure(record, organic, TODAY);
    expect(a.basis).toBe('periodic');
    expect(a.nextExamDueDate).toBe('2026-11-15');
    expect(a.status).toBe('ok');
  });

  it('예정일이 오늘보다 과거면 overdue', () => {
    const record = anExposureRecord({ lastExamDate: '2025-05-20' });
    const a = assessExposure(record, organic, TODAY);
    expect(a.nextExamDueDate).toBe('2026-05-20');
    expect(a.status).toBe('overdue');
    expect(a.daysUntilDue).toBeLessThan(0);
  });
});

describe('assessExposure - 임박 임계값', () => {
  it('정확히 30일 남으면 due-soon, 31일이면 ok', () => {
    const due30 = anExposureRecord({ lastExamDate: '2025-07-02' }); // +12개월 = 2026-07-02 (30일)
    expect(assessExposure(due30, organic, TODAY).status).toBe('due-soon');

    const due31 = anExposureRecord({ lastExamDate: '2025-07-03' }); // 2026-07-03 (31일)
    expect(assessExposure(due31, organic, TODAY).status).toBe('ok');
  });
});

describe('assessExposure - 종료된 노출(from-to)', () => {
  it('endDate가 있으면 overdue 조건이어도 status=ended', () => {
    // lastExamDate 기준으로는 overdue이지만 종료 처리됨
    const record = anExposureRecord({ lastExamDate: '2025-05-20', endDate: '2025-12-31' });
    const a = assessExposure(record, organic, TODAY);
    expect(isExposureEnded(record)).toBe(true);
    expect(a.status).toBe('ended');
  });

  it('endDate가 없으면 진행 중으로 평가', () => {
    const record = anExposureRecord({ lastExamDate: '2025-05-20' });
    expect(isExposureEnded(record)).toBe(false);
    expect(assessExposure(record, organic, TODAY).status).toBe('overdue');
  });
});

describe('byUrgency 정렬', () => {
  it('overdue → due-soon → ok → ended 순', () => {
    const make = (overrides: Parameters<typeof anExposureRecord>[0]): ExposureAssessment =>
      assessExposure(anExposureRecord(overrides), organic, TODAY);
    const list = [
      make({ lastExamDate: '2025-11-15' }), // ok
      make({ lastExamDate: '2025-05-20', endDate: '2025-12-31' }), // ended
      make({ lastExamDate: '2025-05-20' }), // overdue
      make({ lastExamDate: '2025-06-05' }), // due-soon
    ];
    const sorted = [...list].sort(byUrgency);
    expect(sorted.map((a) => a.status)).toEqual(['overdue', 'due-soon', 'ok', 'ended']);
  });
});
