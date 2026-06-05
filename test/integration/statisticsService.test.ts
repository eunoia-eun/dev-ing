import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import {
  anEmployee,
  aCheckup,
  aSymptomVisit,
  anExposureRecord,
  aProgram,
  anEnrollment,
} from '@test/harness/builders';

describe('StatisticsService - 인구 현황', () => {
  it('성별·나이대·국적(외국인 기본 내국인) 인원을 집계한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          anEmployee({ id: 'e1', gender: 'M', birthDate: '1990-01-01' }), // 36 → 30대
          anEmployee({ id: 'e2', gender: 'F', birthDate: '1975-01-01', isForeign: true }), // 51 → 50대, 외국인
          anEmployee({ id: 'e3', gender: 'M' }), // 나이 미상, 내국인(기본)
        ],
      },
      { today: '2026-06-02' },
    );
    const w = await services.statistics.getWorkforceSummary();
    expect(w.total).toBe(3);
    expect(w.gender).toEqual({ male: 2, female: 1, unknown: 0 });
    expect(w.age['30대']).toBe(1);
    expect(w.age['50대']).toBe(1);
    expect(w.age['미상']).toBe(1);
    expect(w.nationality).toEqual({ domestic: 2, foreign: 1 });
  });
});

describe('StatisticsService - 검진 유소견 현황', () => {
  it('부서별로 유소견(D)/요관찰(C)/정상(A)을 집계한다(임직원별 최근 검진 기준)', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          anEmployee({ id: 'e1', department: '생산팀' }),
          anEmployee({ id: 'e2', department: '생산팀' }),
          anEmployee({ id: 'e3', department: '품질팀' }),
          anEmployee({ id: 'e4', department: '품질팀' }), // 미수검
        ],
        checkups: [
          // e1: 2024 A → 2025 D1 (최근 D1)
          aCheckup({ id: 'c1', employeeId: 'e1', examDate: '2024-05-01', grade: 'A' }),
          aCheckup({ id: 'c2', employeeId: 'e1', examDate: '2025-05-01', grade: 'D1' }),
          aCheckup({ id: 'c3', employeeId: 'e2', examDate: '2025-04-01', grade: 'C2' }),
          aCheckup({ id: 'c4', employeeId: 'e3', examDate: '2025-03-01', grade: 'A' }),
        ],
      },
      { today: '2026-06-02' },
    );

    const stats = await services.statistics.getCheckupFindings('department');
    expect(stats.examined).toBe(3);
    expect(stats.notExamined).toBe(1); // e4
    expect(stats.byCategory.finding).toBe(1); // e1 D1
    expect(stats.byCategory.watch).toBe(1); // e2 C2
    expect(stats.byCategory.normal).toBe(1); // e3 A
    expect(stats.byGrade.D1).toBe(1);

    const prod = stats.rows.find((r) => r.group === '생산팀')!;
    expect(prod.total).toBe(2);
    expect(prod.finding).toBe(1);
    expect(prod.watch).toBe(1);
    // 판정 등급별 인원 구분 (D1 1명, C2 1명)
    expect(prod.byGrade.D1).toBe(1);
    expect(prod.byGrade.C2).toBe(1);
    expect(prod.byGrade.D2).toBe(0);

    // 관리대상자 명단(요관찰·유소견·재검) — 심각도순(유소견 먼저)
    expect(stats.managed.map((m) => m.employeeId)).toEqual(['e1', 'e2']);
    expect(stats.managed[0].grade).toBe('D1');
  });

  it('연도를 지정하면 그 해 최근 검진만 본다', async () => {
    const { services } = buildTestServices({
      employees: [anEmployee({ id: 'e1', department: '생산팀' })],
      checkups: [
        aCheckup({ id: 'c1', employeeId: 'e1', examDate: '2024-05-01', grade: 'D2' }),
        aCheckup({ id: 'c2', employeeId: 'e1', examDate: '2025-05-01', grade: 'A' }),
      ],
    });
    const y2024 = await services.statistics.getCheckupFindings('department', 2024);
    expect(y2024.byCategory.finding).toBe(1);
    const y2025 = await services.statistics.getCheckupFindings('department', 2025);
    expect(y2025.byCategory.normal).toBe(1);
    expect(await services.statistics.getCheckupYears()).toEqual([2025, 2024]);
  });
});

describe('StatisticsService - 월별 상담/내원·약 반출', () => {
  it('성별 차원으로 월별 상담 건수와 약 반출 수량을 집계한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          anEmployee({ id: 'e1', gender: 'M', department: '생산팀' }),
          anEmployee({ id: 'e2', gender: 'F', department: '품질팀' }),
        ],
        visits: [
          aSymptomVisit({ id: 'v1', employeeId: 'e1', visitedAt: '2026-05-10T09:00:00.000Z' }),
          aSymptomVisit({ id: 'v2', employeeId: 'e1', visitedAt: '2026-06-01T09:00:00.000Z' }),
          aSymptomVisit({ id: 'v3', employeeId: 'e2', visitedAt: '2026-06-02T09:00:00.000Z' }),
        ],
        movements: [
          { id: 'm1', at: '2026-06-01T09:00:00.000Z', medicineId: 'med-1', medicineName: '타이레놀', unit: '정', type: 'out', quantity: 2, employeeId: 'e1' },
          { id: 'm2', at: '2026-06-02T09:00:00.000Z', medicineId: 'med-1', medicineName: '타이레놀', unit: '정', type: 'out', quantity: 1, employeeId: 'e2' },
          { id: 'm3', at: '2026-06-01T09:00:00.000Z', medicineId: 'med-1', medicineName: '타이레놀', unit: '정', type: 'in', quantity: 50 }, // 입고는 제외
        ],
      },
      { today: '2026-06-02' },
    );

    const stats = await services.statistics.getMonthlyActivity('gender', '2026-05', '2026-06');
    expect(stats.months).toEqual(['2026-05', '2026-06']);

    // 상담/내원: 남 2건(5월1·6월1), 여 1건(6월)
    expect(stats.visits.totalByGroup['남']).toBe(2);
    expect(stats.visits.totalByGroup['여']).toBe(1);
    expect(stats.visits.counts['남']['2026-05']).toBe(1);
    expect(stats.visits.grandTotal).toBe(3);

    // 약 반출: 남 2정, 여 1정 (입고 제외)
    expect(stats.dispense.totalByGroup['남']).toBe(2);
    expect(stats.dispense.totalByGroup['여']).toBe(1);
    expect(stats.dispense.grandTotal).toBe(3);
  });
});

describe('StatisticsService - 유해인자 노출자 통계', () => {
  it('진행 중 노출만 부서별 인원·특수검진 상태·분류별로 집계', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          anEmployee({ id: 'e1', department: '생산팀' }),
          anEmployee({ id: 'e2', department: '생산팀' }),
          anEmployee({ id: 'e3', department: '품질팀' }),
        ],
        exposures: [
          anExposureRecord({ id: 'x1', employeeId: 'e1' }), // 톨루엔, lastExam 없음 → overdue
          anExposureRecord({ id: 'x2', employeeId: 'e2' }), // overdue
          anExposureRecord({ id: 'x3', employeeId: 'e3', lastExamDate: '2025-11-15' }), // ok
          anExposureRecord({ id: 'x4', employeeId: 'e3', endDate: '2024-12-31' }), // 종료 → 제외
        ],
      },
      { today: '2026-06-02' },
    );

    const s = await services.statistics.getExposureStats('department');
    expect(s.totalExposed).toBe(3);
    expect(s.overdue).toBe(2);

    const prod = s.rows.find((r) => r.group === '생산팀')!;
    expect(prod.exposed).toBe(2);
    expect(prod.overdue).toBe(2);
    const qa = s.rows.find((r) => r.group === '품질팀')!;
    expect(qa.exposed).toBe(1);
    expect(qa.ok).toBe(1);

    // 분류별: 톨루엔=유기화합물, 종료 제외하면 3명/3건
    const organic = s.byCategory.find((c) => c.categoryCode === 'CHEM_ORGANIC')!;
    expect(organic.categoryName).toBe('유기화합물');
    expect(organic.employees).toBe(3);
    expect(organic.records).toBe(3);
  });
});

describe('StatisticsService - 프로그램 참여율 통계', () => {
  it('프로그램별 충원과 차원별 참여율을 집계(취소는 참여 제외)', async () => {
    const { services } = buildTestServices({
      employees: [
        anEmployee({ id: 'e1', department: '생산팀' }),
        anEmployee({ id: 'e2', department: '생산팀' }),
        anEmployee({ id: 'e3', department: '품질팀' }),
      ],
      programs: [aProgram({ id: 'p1', capacity: 2 })],
      enrollments: [
        anEnrollment({ id: 'n1', programId: 'p1', employeeId: 'e1', status: 'enrolled' }),
        anEnrollment({ id: 'n2', programId: 'p1', employeeId: 'e2', status: 'enrolled' }),
        anEnrollment({ id: 'n3', programId: 'p1', employeeId: 'e3', status: 'cancelled' }),
      ],
    });

    const s = await services.statistics.getProgramStats('department');
    const p1 = s.programs.find((p) => p.programId === 'p1')!;
    expect(p1.enrolled).toBe(2);
    expect(p1.fillRate).toBe(100);

    expect(s.totalParticipants).toBe(2); // e1,e2 (e3 취소)
    expect(s.overallRate).toBe(67); // 2/3

    const prod = s.participation.find((r) => r.group === '생산팀')!;
    expect(prod.participants).toBe(2);
    expect(prod.rate).toBe(100);
    const qa = s.participation.find((r) => r.group === '품질팀')!;
    expect(qa.rate).toBe(0);
  });
});

describe('StatisticsService - 특정 증상 추이', () => {
  it('증상 목록(빈도순)과 월별 추이를 집계', async () => {
    const { services } = buildTestServices({
      employees: [
        anEmployee({ id: 'e1', department: '생산팀' }),
        anEmployee({ id: 'e2', department: '품질팀' }),
      ],
      visits: [
        aSymptomVisit({ id: 'v1', employeeId: 'e1', visitedAt: '2026-05-10T09:00:00.000Z', symptoms: ['두통'] }),
        aSymptomVisit({ id: 'v2', employeeId: 'e1', visitedAt: '2026-06-01T09:00:00.000Z', symptoms: ['두통', '어지러움'] }),
        aSymptomVisit({ id: 'v3', employeeId: 'e2', visitedAt: '2026-06-02T09:00:00.000Z', symptoms: ['소화불량'] }),
      ],
    });

    const options = await services.statistics.getSymptomOptions();
    expect(options[0]).toEqual({ symptom: '두통', count: 2 });

    const trend = await services.statistics.getSymptomTrend('두통', '2026-05', '2026-06', 'department');
    expect(trend.grandTotal).toBe(2);
    expect(trend.counts['생산팀']['2026-05']).toBe(1);
    expect(trend.counts['생산팀']['2026-06']).toBe(1);
  });
});
