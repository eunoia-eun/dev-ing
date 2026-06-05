import { describe, expect, it } from 'vitest';
import { DEFAULT_LAB_ITEMS } from '@domain/checkup/HealthCheckup';
import { buildTestServices } from '@test/harness/buildTestServices';

const seedLab = DEFAULT_LAB_ITEMS.map((d, i) => ({ ...d, id: d.code, enabled: true, order: i }));

describe('LabItemService', () => {
  it('기본 항목에 청력·시력이 포함되어 있다', () => {
    const codes = DEFAULT_LAB_ITEMS.map((d) => d.code);
    expect(codes).toContain('hearing_left');
    expect(codes).toContain('vision_left');
  });

  it('항목을 추가하면 활성 목록에 포함된다', async () => {
    const { services } = buildTestServices({ labItems: seedLab });
    const item = await services.labItems.create({ name: '청력 6kHz', group: '청각', unit: 'dB', refHigh: 40 });
    expect(item.enabled).toBe(true);
    const enabled = await services.labItems.listEnabled();
    expect(enabled.some((i) => i.name === '청력 6kHz')).toBe(true);
  });

  it('제외하면 활성 목록에서 빠지지만 전체 목록엔 남는다', async () => {
    const { services } = buildTestServices({ labItems: seedLab });
    await services.labItems.setEnabled('glucose', false);
    expect((await services.labItems.listEnabled()).some((i) => i.id === 'glucose')).toBe(false);
    expect((await services.labItems.list()).some((i) => i.id === 'glucose')).toBe(true);
  });

  it('기본 항목은 삭제할 수 없고, 추가한 항목은 삭제된다', async () => {
    const { services } = buildTestServices({ labItems: seedLab });
    await expect(services.labItems.remove('glucose')).rejects.toThrow();
    const item = await services.labItems.create({ name: '커스텀', group: '기타' });
    await services.labItems.remove(item.id);
    expect((await services.labItems.list()).some((i) => i.id === item.id)).toBe(false);
  });
});
