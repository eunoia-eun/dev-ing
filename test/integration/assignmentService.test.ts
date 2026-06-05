import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import {
  anEmployee,
  anExposureRecord,
  anAssignment,
  aDepartmentHazard,
} from '@test/harness/builders';

describe('AssignmentService 배치(발령) 이력', () => {
  it('배치 이력이 없으면 입사일 기준 최초 배치를 만들어 준다', async () => {
    const { services } = buildTestServices({
      employees: [
        anEmployee({ id: 'e1', department: '생산팀', jobTitle: '도장', hireDate: '2019-01-02' }),
      ],
    });
    const timeline = await services.assignments.getTimeline('e1');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].department).toBe('생산팀');
    expect(timeline[0].jobTitle).toBe('도장');
    expect(timeline[0].startDate).toBe('2019-01-02');
    expect(timeline[0].endDate).toBeUndefined();
  });

  it('changeAssignment: 이전 배치 종료 + 새 배치 시작 + 임직원 부서·업무 갱신', async () => {
    const { services, repos } = buildTestServices(
      {
        employees: [anEmployee({ id: 'e1', department: '생산팀', jobTitle: '도장' })],
        assignments: [
          anAssignment({ id: 'a1', employeeId: 'e1', department: '생산팀', jobTitle: '도장', startDate: '2018-03-02' }),
        ],
      },
      { today: '2026-06-02' },
    );

    const result = await services.assignments.changeAssignment({
      employeeId: 'e1',
      department: '품질팀',
      jobTitle: '분석',
      effectiveDate: '2025-01-01',
    });

    expect(result.assignment.department).toBe('품질팀');
    expect(result.assignment.startDate).toBe('2025-01-01');

    const timeline = await services.assignments.getTimeline('e1');
    expect(timeline).toHaveLength(2);
    // 이전 배치는 변경일 전날로 종료
    expect(timeline[0].endDate).toBe('2024-12-31');
    expect(timeline[1].endDate).toBeUndefined();

    // 임직원 현재 부서·업무가 갱신됨
    const e1 = await repos.employees.getById('e1');
    expect(e1?.department).toBe('품질팀');
    expect(e1?.jobTitle).toBe('분석');
  });

  it('변경 시 진행 중 노출을 변경일 전날로 종료하고, 새 부서 유해인자를 제안한다', async () => {
    const { services, repos } = buildTestServices(
      {
        employees: [anEmployee({ id: 'e1', department: '생산팀', jobTitle: '도장' })],
        exposures: [
          anExposureRecord({ id: 'x1', employeeId: 'e1', categoryCode: 'CHEM_ORGANIC', substanceNo: 91, substanceName: '톨루엔' }),
        ],
        departmentHazards: [
          aDepartmentHazard({ id: 'dh1', department: '품질팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 26, substanceName: '메탄올' }),
        ],
      },
      { today: '2026-06-02' },
    );

    const result = await services.assignments.changeAssignment({
      employeeId: 'e1',
      department: '품질팀',
      jobTitle: '분석',
      effectiveDate: '2025-01-01',
    });

    // 진행 중 노출 1건이 종료됨
    expect(result.endedExposures).toBe(1);
    const x1 = await repos.exposures.getById('x1');
    expect(x1?.endDate).toBe('2024-12-31');

    // 새 부서(품질팀) 유해인자 제안
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].substanceName).toBe('메탄올');
  });

  it('종료된 노출은 특수검진 도래 집계(getOverview)에서 빠진다', async () => {
    const { services } = buildTestServices(
      {
        employees: [anEmployee({ id: 'e1', department: '생산팀' })],
        exposures: [
          // 기한이 한참 지난(overdue) 노출이지만 종료 처리됨
          anExposureRecord({ id: 'x1', employeeId: 'e1', lastExamDate: '2020-01-01', endDate: '2024-12-31' }),
        ],
      },
      { today: '2026-06-02' },
    );
    const overview = await services.hazard.getOverview();
    expect(overview.overdueCount).toBe(0);
    expect(overview.attentionItems).toHaveLength(0);

    // 이력 조회에는 '종료' 상태로 남아 있음
    const [a] = await services.hazard.getEmployeeAssessments('e1');
    expect(a.status).toBe('ended');
  });

  it('addExposure는 노출 당시 부서·업무를 임직원 현재 값으로 스냅샷한다', async () => {
    const { services } = buildTestServices({
      employees: [anEmployee({ id: 'e1', department: '생산팀', jobTitle: '도장' })],
    });
    const rec = await services.hazard.addExposure({
      employeeId: 'e1',
      ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 91 },
      startDate: '2026-01-02',
    });
    expect(rec.department).toBe('생산팀');
    expect(rec.jobTitle).toBe('도장');
  });
});
