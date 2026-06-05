import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { anEmployee, anExposureRecord } from '@test/harness/builders';

describe('HazardExposureService', () => {
  it('addExposure는 카탈로그에서 물질명을 채워 저장한다', async () => {
    const { services } = buildTestServices({ employees: [anEmployee({ id: 'emp-1' })] });
    const record = await services.hazard.addExposure({
      employeeId: 'emp-1',
      ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }, // 톨루엔
      startDate: '2025-12-10',
    });
    expect(record.substanceName).toBe('톨루엔');
    expect(record.id).toBe('id-1'); // SeqIdGenerator
  });

  it('존재하지 않는 물질 참조는 예외', async () => {
    const { services } = buildTestServices();
    await expect(
      services.hazard.addExposure({
        employeeId: 'emp-1',
        ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 99999 },
        startDate: '2025-12-10',
      }),
    ).rejects.toThrow();
  });

  it('getEmployeeAssessments는 검진 도래 상태를 계산한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [anEmployee({ id: 'emp-1' })],
        exposures: [
          anExposureRecord({ id: 'x1', employeeId: 'emp-1', lastExamDate: '2025-05-20' }), // overdue
        ],
      },
      { today: '2026-06-02' },
    );
    const list = await services.hazard.getEmployeeAssessments('emp-1');
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('overdue');
    expect(list[0].nextExamDueDate).toBe('2026-05-20');
  });

  it('recordExam은 최근 검진일을 갱신해 다음 주기를 다시 계산한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [anEmployee({ id: 'emp-1' })],
        exposures: [anExposureRecord({ id: 'x1', employeeId: 'emp-1', lastExamDate: '2025-05-20' })],
      },
      { today: '2026-06-02' },
    );
    await services.hazard.recordExam('x1', '2026-06-02');
    const [a] = await services.hazard.getEmployeeAssessments('emp-1');
    expect(a.record.lastExamDate).toBe('2026-06-02');
    expect(a.nextExamDueDate).toBe('2027-06-02');
    expect(a.status).toBe('ok');
  });

  it('getOverview는 전 직원 상태를 집계하고 위급도순으로 정렬한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [anEmployee({ id: 'emp-1' }), anEmployee({ id: 'emp-2', name: '김보건' })],
        exposures: [
          anExposureRecord({ id: 'x1', employeeId: 'emp-1', lastExamDate: '2025-05-20' }), // overdue
          anExposureRecord({ id: 'x2', employeeId: 'emp-2', lastExamDate: '2025-06-05' }), // due-soon
          anExposureRecord({ id: 'x3', employeeId: 'emp-2', lastExamDate: '2025-11-15' }), // ok
        ],
      },
      { today: '2026-06-02' },
    );
    const overview = await services.hazard.getOverview();
    expect(overview.overdueCount).toBe(1);
    expect(overview.dueSoonCount).toBe(1);
    expect(overview.okCount).toBe(1);
    expect(overview.attentionItems).toHaveLength(2);
    expect(overview.attentionItems[0].assessment.status).toBe('overdue');
  });
});

describe('HazardExposureService.getHazardUsage', () => {
  it('노출 기록을 부서별로 집계한다(노출 인원 많은 순)', async () => {
    const { services } = buildTestServices({
      employees: [
        anEmployee({ id: 'e1', department: '생산팀' }),
        anEmployee({ id: 'e2', department: '품질팀' }),
      ],
      exposures: [
        anExposureRecord({ id: 'x1', employeeId: 'e1', categoryCode: 'CHEM_ORGANIC', substanceNo: 91, substanceName: '톨루엔' }),
        anExposureRecord({ id: 'x2', employeeId: 'e2', categoryCode: 'CHEM_ORGANIC', substanceNo: 91, substanceName: '톨루엔' }),
        anExposureRecord({ id: 'x3', employeeId: 'e1', categoryCode: 'CHEM_ORGANIC', substanceNo: 41, substanceName: '벤젠' }),
      ],
    });
    const usage = await services.hazard.getHazardUsage();
    const tol = usage.find((u) => u.substanceNo === 91)!;
    expect(tol.employeeCount).toBe(2);
    expect(tol.departments).toEqual(['생산팀', '품질팀']);
    const ben = usage.find((u) => u.substanceNo === 41)!;
    expect(ben.employeeCount).toBe(1);
    expect(ben.departments).toEqual(['생산팀']);
    expect(usage[0].substanceNo).toBe(91); // 노출 인원 많은 순
  });
});
