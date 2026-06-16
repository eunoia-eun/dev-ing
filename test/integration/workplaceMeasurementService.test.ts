import { describe, it, expect } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';

describe('WorkplaceMeasurementService', () => {
  it('측정 결과를 등록하고 조회할 수 있다', async () => {
    const { services } = buildTestServices();
    const m = await services.measurement.add({
      measureDate: '2026-06-01',
      department: '용접반',
      substanceCode: 'CHEM_ORGANIC-1',
      substanceName: '가솔린',
      twa: 200,
      unit: 'ppm',
      limitTwa: '300 ppm',
    });
    expect(m.id).toBeTruthy();

    const list = await services.measurement.list();
    expect(list).toHaveLength(1);
    expect(list[0].measurement.substanceName).toBe('가솔린');
    expect(list[0].twaStatus).toBe('normal'); // 200/300 = 66%
    expect(list[0].overallStatus).toBe('normal');
  });

  it('80% 이상이면 주의 상태', async () => {
    const { services } = buildTestServices();
    await services.measurement.add({
      measureDate: '2026-06-01',
      department: '생산1팀',
      substanceCode: 'CHEM_ORGANIC-1',
      substanceName: '가솔린',
      twa: 260,
      unit: 'ppm',
      limitTwa: '300 ppm',
    });
    const [result] = await services.measurement.list();
    expect(result.twaStatus).toBe('warning');
  });

  it('기준 초과 시 exceeded 상태', async () => {
    const { services } = buildTestServices();
    await services.measurement.add({
      measureDate: '2026-06-01',
      department: '생산1팀',
      substanceCode: 'CHEM_ORGANIC-1',
      substanceName: '가솔린',
      twa: 350,
      unit: 'ppm',
      limitTwa: '300 ppm',
    });
    const [result] = await services.measurement.list();
    expect(result.twaStatus).toBe('exceeded');
    expect(result.overallStatus).toBe('exceeded');
  });

  it('부서 필터가 동작한다', async () => {
    const { services } = buildTestServices();
    await services.measurement.add({ measureDate: '2026-06-01', department: '용접반', substanceCode: 'C1', substanceName: 'A', twa: 1, unit: 'ppm' });
    await services.measurement.add({ measureDate: '2026-06-01', department: '생산1팀', substanceCode: 'C2', substanceName: 'B', twa: 1, unit: 'ppm' });

    const welding = await services.measurement.list('용접반');
    expect(welding).toHaveLength(1);
    expect(welding[0].measurement.department).toBe('용접반');
  });

  it('삭제하면 목록에서 사라진다', async () => {
    const { services } = buildTestServices();
    const m = await services.measurement.add({ measureDate: '2026-06-01', department: '용접반', substanceCode: 'C1', substanceName: 'A', twa: 1, unit: 'ppm' });
    await services.measurement.remove(m.id);
    expect(await services.measurement.list()).toHaveLength(0);
  });

  it('TWA·STEL 없이 등록하면 오류', async () => {
    const { services } = buildTestServices();
    await expect(
      services.measurement.add({ measureDate: '2026-06-01', department: '용접반', substanceCode: 'C1', substanceName: 'A', unit: 'ppm' }),
    ).rejects.toThrow('TWA 또는 STEL');
  });

  it('부서별 요약을 반환한다', async () => {
    const { services } = buildTestServices();
    await services.measurement.add({ measureDate: '2026-06-01', department: '용접반', substanceCode: 'C1', substanceName: 'A', twa: 350, unit: 'ppm', limitTwa: '300 ppm' });
    await services.measurement.add({ measureDate: '2026-06-01', department: '용접반', substanceCode: 'C2', substanceName: 'B', twa: 100, unit: 'ppm', limitTwa: '300 ppm' });

    const summary = await services.measurement.getSummaryByDepartment();
    const welding = summary.find((s) => s.department === '용접반');
    expect(welding?.exceeded).toBe(1);
    expect(welding?.total).toBe(2);
  });
});
