import { describe, it, expect } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';

const TODAY = '2026-06-17';
const ONE_YEAR_AGO = '2025-06-17';

describe('StatisticsService.getOccupationalSubjects', () => {
  it('기간 내 C1/D1/D2 소견자를 반환한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          { id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '작업', hireDate: '2020-01-01', active: true },
          { id: 'e2', name: '김철수', employeeNumber: 'E002', department: '용접반', jobTitle: '작업', hireDate: '2020-01-01', active: true },
        ],
        checkups: [
          { id: 'c1', employeeId: 'e1', type: 'general', examDate: '2026-01-10', grade: 'D2' },
          { id: 'c2', employeeId: 'e2', type: 'general', examDate: '2026-02-01', grade: 'A' },
        ],
      },
      { today: TODAY },
    );
    const result = await services.statistics.getOccupationalSubjects(ONE_YEAR_AGO, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('홍길동');
    expect(result[0].grade).toBe('D2');
  });

  it('기간 밖 검진은 포함하지 않는다', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '작업', hireDate: '2020-01-01', active: true }],
        checkups: [{ id: 'c1', employeeId: 'e1', type: 'general', examDate: '2024-01-01', grade: 'D1' }],
      },
      { today: TODAY },
    );
    const result = await services.statistics.getOccupationalSubjects(ONE_YEAR_AGO, TODAY);
    expect(result).toHaveLength(0);
  });

  it('같은 임직원의 여러 건 중 가장 최근만 반환한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '작업', hireDate: '2020-01-01', active: true }],
        checkups: [
          { id: 'c1', employeeId: 'e1', type: 'general', examDate: '2025-07-01', grade: 'C1' },
          { id: 'c2', employeeId: 'e1', type: 'special', examDate: '2026-03-01', grade: 'D1' },
        ],
      },
      { today: TODAY },
    );
    const result = await services.statistics.getOccupationalSubjects(ONE_YEAR_AGO, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].examDate).toBe('2026-03-01');
    expect(result[0].grade).toBe('D1');
  });

  it('진행 중 노출 수를 집계한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [{ id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '작업', hireDate: '2020-01-01', active: true }],
        checkups: [{ id: 'c1', employeeId: 'e1', type: 'general', examDate: '2026-01-01', grade: 'D2' }],
        exposures: [
          { id: 'exp1', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 1, substanceName: '납', startDate: '2021-01-01' },
          { id: 'exp2', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 2, substanceName: '크롬', startDate: '2021-01-01' },
          { id: 'exp3', employeeId: 'e1', categoryCode: 'CHEM_METAL', substanceNo: 3, substanceName: '망간', startDate: '2021-01-01', endDate: '2025-12-31' },
        ],
      },
      { today: TODAY },
    );
    const result = await services.statistics.getOccupationalSubjects(ONE_YEAR_AGO, TODAY);
    expect(result[0].activeExposureCount).toBe(2); // endDate 있는 것 제외
  });

  it('결과를 검진일 최신순으로 정렬한다', async () => {
    const { services } = buildTestServices(
      {
        employees: [
          { id: 'e1', name: '홍길동', employeeNumber: 'E001', department: '도금반', jobTitle: '작업', hireDate: '2020-01-01', active: true },
          { id: 'e2', name: '김철수', employeeNumber: 'E002', department: '용접반', jobTitle: '작업', hireDate: '2020-01-01', active: true },
        ],
        checkups: [
          { id: 'c1', employeeId: 'e1', type: 'general', examDate: '2025-09-01', grade: 'D2' },
          { id: 'c2', employeeId: 'e2', type: 'general', examDate: '2026-03-01', grade: 'C1' },
        ],
      },
      { today: TODAY },
    );
    const result = await services.statistics.getOccupationalSubjects(ONE_YEAR_AGO, TODAY);
    expect(result[0].name).toBe('김철수'); // 최신순
    expect(result[1].name).toBe('홍길동');
  });
});
