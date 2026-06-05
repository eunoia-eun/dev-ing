import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHECKUP_TYPES,
  DEFAULT_LAB_GROUPS,
  DEFAULT_LAB_ITEMS,
  type LabItem,
} from '@domain/checkup/HealthCheckup';
import { buildTestServices } from '@test/harness/buildTestServices';

const seedTypes = DEFAULT_CHECKUP_TYPES.map((t) => ({ ...t }));
const seedGroups = DEFAULT_LAB_GROUPS.map((name, i) => ({ id: `grp_${i}`, name, order: i }));
const seedLab = DEFAULT_LAB_ITEMS.map((d, i) => ({ ...d, id: d.code, enabled: true, order: i }));

describe('CheckupTypeService', () => {
  it('종류를 추가하고, 기본 종류는 삭제할 수 없다', async () => {
    const { services } = buildTestServices({ checkupTypes: seedTypes });
    const t = await services.checkupTypes.create('채용검진');
    expect((await services.checkupTypes.list()).some((x) => x.name === '채용검진')).toBe(true);
    await expect(services.checkupTypes.remove('general')).rejects.toThrow();
    await services.checkupTypes.remove(t.id);
    expect((await services.checkupTypes.list()).some((x) => x.id === t.id)).toBe(false);
  });

  it('사용 중인 종류는 삭제할 수 없다', async () => {
    const { services } = buildTestServices({ checkupTypes: seedTypes });
    const t = await services.checkupTypes.create('임시검진');
    await services.checkup.add({ employeeId: 'emp-1', type: t.id, examDate: '2026-01-01', grade: 'A' });
    await expect(services.checkupTypes.remove(t.id)).rejects.toThrow();
  });
});

describe('LabGroupService', () => {
  it('그룹을 추가하고, 소속 항목이 있는 그룹은 삭제 차단', async () => {
    const { services } = buildTestServices({ labGroups: seedGroups, labItems: seedLab });
    const g = await services.labGroups.create('생물학적 지표');
    expect((await services.labGroups.list()).some((x) => x.name === '생물학적 지표')).toBe(true);

    const blood = (await services.labGroups.list()).find((x) => x.name === '혈액')!;
    await expect(services.labGroups.remove(blood.id)).rejects.toThrow();

    await services.labGroups.remove(g.id); // 빈 그룹은 삭제됨
    expect((await services.labGroups.list()).some((x) => x.id === g.id)).toBe(false);
  });
});

describe('LabItemService.move', () => {
  it('항목 순서를 위로 이동한다', async () => {
    const { services } = buildTestServices({ labItems: seedLab });
    const before = (await services.labItems.list()).map((i) => i.id);
    await services.labItems.move(before[1], 'up');
    const after = (await services.labItems.list()).map((i) => i.id);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });

  it('reorder는 전달한 id 순서대로 재배치한다(드래그)', async () => {
    const { services } = buildTestServices({ labItems: seedLab });
    const ids = (await services.labItems.list()).map((i) => i.id);
    const newOrder = [ids[1], ids[2], ids[0], ...ids.slice(3)];
    await services.labItems.reorder(newOrder);
    expect((await services.labItems.list()).map((i) => i.id)).toEqual(newOrder);
  });

  it('order가 없는 과거 데이터도 마이그레이션 후 이동된다', async () => {
    const noOrder = DEFAULT_LAB_ITEMS.map((d) => ({
      ...d,
      id: d.code,
      enabled: true,
    })) as unknown as LabItem[]; // order 누락(과거 데이터 모사)
    const { services } = buildTestServices({ labItems: noOrder });
    const before = (await services.labItems.list()).map((i) => i.id);
    await services.labItems.move(before[0], 'down');
    const after = (await services.labItems.list()).map((i) => i.id);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });
});
