import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { anEmployee, anExposureRecord, aDepartmentHazard } from '@test/harness/builders';

describe('HazardExposureService 부서↔유해인자 매핑', () => {
  it('linkDepartmentHazard는 카탈로그에서 물질명을 채워 부서에 묶는다', async () => {
    const { services } = buildTestServices();
    const m = await services.hazard.linkDepartmentHazard({
      department: '생산팀',
      ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }, // 톨루엔
      process: '도장',
    });
    expect(m.substanceName).toBe('톨루엔');
    expect(m.department).toBe('생산팀');
    expect(m.process).toBe('도장');
    expect(m.id).toBe('id-1');
  });

  it('같은 부서에 같은 유해인자를 중복으로 묶으면 예외', async () => {
    const { services } = buildTestServices({
      departmentHazards: [aDepartmentHazard({ id: 'dh1', department: '생산팀' })],
    });
    await expect(
      services.hazard.linkDepartmentHazard({
        department: '생산팀',
        ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 91 },
      }),
    ).rejects.toThrow();
  });

  it('존재하지 않는 물질을 묶으면 예외', async () => {
    const { services } = buildTestServices();
    await expect(
      services.hazard.linkDepartmentHazard({
        department: '생산팀',
        ref: { categoryCode: 'CHEM_ORGANIC', substanceNo: 99999 },
      }),
    ).rejects.toThrow();
  });

  it('getDepartmentHazards는 부서 인원/적용 인원을 함께 집계한다', async () => {
    const { services } = buildTestServices({
      employees: [
        anEmployee({ id: 'e1', department: '생산팀' }),
        anEmployee({ id: 'e2', department: '생산팀' }),
      ],
      exposures: [
        // e1만 톨루엔 노출이 이미 등록됨
        anExposureRecord({ id: 'x1', employeeId: 'e1', categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }),
      ],
      departmentHazards: [
        aDepartmentHazard({ id: 'dh1', department: '생산팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }),
      ],
    });
    const [view] = await services.hazard.getDepartmentHazards();
    expect(view.employeeCount).toBe(2);
    expect(view.appliedCount).toBe(1);
    // 적용된 임직원 명단(이름·id)도 함께 — 적용현황 클릭 시 표시용
    expect(view.appliedEmployees).toEqual([{ id: 'e1', name: '홍길동' }]);
  });

  it('applyDepartmentHazardToEmployees는 미적용 임직원에게만 노출을 일괄 등록한다', async () => {
    const { services, repos } = buildTestServices(
      {
        employees: [
          anEmployee({ id: 'e1', department: '생산팀' }),
          anEmployee({ id: 'e2', department: '생산팀' }),
          anEmployee({ id: 'e3', department: '품질팀' }), // 다른 부서는 제외
        ],
        exposures: [
          anExposureRecord({ id: 'x1', employeeId: 'e1', categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }),
        ],
        departmentHazards: [
          aDepartmentHazard({ id: 'dh1', department: '생산팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }),
        ],
      },
      { today: '2026-06-02' },
    );

    const result = await services.hazard.applyDepartmentHazardToEmployees('dh1');
    expect(result.total).toBe(2); // 생산팀 2명
    expect(result.created).toBe(1); // e2만 신규
    expect(result.skipped).toBe(1); // e1은 이미 있음

    // e2에 노출이 생겼고 시작일은 오늘
    const e2 = (await repos.exposures.listByEmployee('e2'))[0];
    expect(e2.substanceName).toBe('톨루엔');
    expect(e2.startDate).toBe('2026-06-02');

    // e3(다른 부서)에는 생기지 않음
    expect(await repos.exposures.listByEmployee('e3')).toHaveLength(0);

    // 다시 적용하면 모두 건너뜀
    const again = await services.hazard.applyDepartmentHazardToEmployees('dh1');
    expect(again.created).toBe(0);
    expect(again.skipped).toBe(2);
  });

  it('unlinkDepartmentHazard는 매핑만 제거하고 이미 등록된 노출은 남긴다', async () => {
    const { services, repos } = buildTestServices({
      employees: [anEmployee({ id: 'e1', department: '생산팀' })],
      departmentHazards: [
        aDepartmentHazard({ id: 'dh1', department: '생산팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 91 }),
      ],
    });
    await services.hazard.applyDepartmentHazardToEmployees('dh1');
    await services.hazard.unlinkDepartmentHazard('dh1');

    expect(await services.hazard.getDepartmentHazards()).toHaveLength(0);
    // 일괄 적용으로 만들어진 노출은 그대로 유지
    expect(await repos.exposures.listByEmployee('e1')).toHaveLength(1);
  });
});
