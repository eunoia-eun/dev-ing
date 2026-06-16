import { describe, it, expect } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';

const TODAY = '2026-06-17';

describe('EmployeeProfileService 직업병 연관 알림', () => {
  it('검진 D2 + 활성 노출 있으면 알림 생성', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '도금작업', hireDate: '2020-01-01', active: true }],
        exposures: [{ id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01' }],
        checkups: [{ id: 'chk1', employeeId: 'e1', type: 'general', examDate: '2026-01-10', grade: 'D2' }],
      },
      { today: TODAY },
    );
    const profile = await services.profile.getProfile('e1');
    expect(profile.occupationalAlerts).toHaveLength(1);
    expect(profile.occupationalAlerts[0].grade).toBe('D2');
    expect(profile.occupationalAlerts[0].substanceName).toBe('납');
    expect(profile.occupationalAlerts[0].checkupDate).toBe('2026-01-10');
  });

  it('검진 D1 + 활성 노출 2건 → 2개 알림', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '도금작업', hireDate: '2020-01-01', active: true }],
        exposures: [
          { id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01' },
          { id: 'exp2', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 2, substanceName: '크롬', startDate: '2021-01-01' },
        ],
        checkups: [{ id: 'chk1', employeeId: 'e1', type: 'special', examDate: '2026-02-01', grade: 'D1' }],
      },
      { today: TODAY },
    );
    const profile = await services.profile.getProfile('e1');
    expect(profile.occupationalAlerts).toHaveLength(2);
  });

  it('최근 검진 A이면 알림 없음', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '도금작업', hireDate: '2020-01-01', active: true }],
        exposures: [{ id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01' }],
        checkups: [
          { id: 'chk1', employeeId: 'e1', type: 'general', examDate: '2025-01-01', grade: 'D2' },
          { id: 'chk2', employeeId: 'e1', type: 'general', examDate: '2026-01-01', grade: 'A' },
        ],
      },
      { today: TODAY },
    );
    const profile = await services.profile.getProfile('e1');
    expect(profile.occupationalAlerts).toHaveLength(0);
  });

  it('노출이 종료됐으면 알림 없음', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '도금작업', hireDate: '2020-01-01', active: true }],
        exposures: [{ id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01', endDate: '2025-12-31' }],
        checkups: [{ id: 'chk1', employeeId: 'e1', type: 'general', examDate: '2026-01-10', grade: 'D2' }],
      },
      { today: TODAY },
    );
    const profile = await services.profile.getProfile('e1');
    expect(profile.occupationalAlerts).toHaveLength(0);
  });

  it('검진 없으면 알림 없음', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '도금작업', hireDate: '2020-01-01', active: true }],
        exposures: [{ id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01' }],
      },
      { today: TODAY },
    );
    const profile = await services.profile.getProfile('e1');
    expect(profile.occupationalAlerts).toHaveLength(0);
  });
});
