import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { aDepartment, anEmployee } from '@test/harness/builders';

describe('DepartmentService', () => {
  it('부서를 추가하고 중복 이름은 막는다', async () => {
    const { services } = buildTestServices({ departments: [aDepartment({ id: 'd1', name: '생산팀' })] });
    await services.departments.create('품질팀');
    expect((await services.departments.list()).map((d) => d.name)).toEqual(['생산팀', '품질팀']);
    await expect(services.departments.create('생산팀')).rejects.toThrow();
  });

  it('부서명 변경 시 소속 임직원의 부서도 함께 바뀐다(cascade)', async () => {
    const { services, repos } = buildTestServices({
      departments: [aDepartment({ id: 'd1', name: '생산팀' })],
      employees: [anEmployee({ id: 'e1', department: '생산팀' }), anEmployee({ id: 'e2', department: '생산팀' })],
    });
    await services.departments.update('d1', '생산1팀');
    const emps = await repos.employees.list();
    expect(emps.every((e) => e.department === '생산1팀')).toBe(true);
  });

  it('소속 임직원이 있으면 삭제할 수 없다', async () => {
    const { services } = buildTestServices({
      departments: [aDepartment({ id: 'd1', name: '생산팀' })],
      employees: [anEmployee({ id: 'e1', department: '생산팀' })],
    });
    await expect(services.departments.remove('d1')).rejects.toThrow();
  });

  it('빈 부서는 삭제된다', async () => {
    const { services } = buildTestServices({ departments: [aDepartment({ id: 'd1', name: '빈팀' })] });
    await services.departments.remove('d1');
    expect(await services.departments.list()).toHaveLength(0);
  });

  it('listWithCounts는 부서별 인원수를 센다', async () => {
    const { services } = buildTestServices({
      departments: [aDepartment({ id: 'd1', name: '생산팀' }), aDepartment({ id: 'd2', name: '품질팀' })],
      employees: [anEmployee({ id: 'e1', department: '생산팀' }), anEmployee({ id: 'e2', department: '생산팀' })],
    });
    const list = await services.departments.listWithCounts();
    expect(list.find((x) => x.department.name === '생산팀')!.employeeCount).toBe(2);
    expect(list.find((x) => x.department.name === '품질팀')!.employeeCount).toBe(0);
  });
});
