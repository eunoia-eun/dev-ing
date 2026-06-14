import type { LabGroup } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';
import type { LabGroupRepository } from '../ports/LabGroupRepository';
import type { LabItemRepository } from '../ports/LabItemRepository';
import type { IdGenerator } from '../ports/system';

/** 검사 그룹 관리. 소속 검사 항목이 있는 그룹은 삭제 차단. */
export class LabGroupService {
  constructor(
    private readonly groups: LabGroupRepository,
    private readonly items: LabItemRepository,
    private readonly ids: IdGenerator,
  ) {}

  async list(): Promise<LabGroup[]> {
    return (await this.groups.list()).sort((a, b) => a.order - b.order);
  }

  async create(name: string): Promise<LabGroup> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('그룹명을 입력하세요.');
    const all = await this.groups.list();
    if (all.some((g) => g.name === trimmed)) throw new Error('이미 존재하는 그룹이에요.');
    const order = all.reduce((m, g) => Math.max(m, g.order), -1) + 1;
    const group: LabGroup = { id: `grp_${this.ids.next()}`, name: trimmed, order };
    await this.groups.save(group);
    return group;
  }

  async remove(id: Id): Promise<void> {
    const group = await this.groups.getById(id);
    if (!group) return;
    const used = (await this.items.list()).some((i) => i.group === group.name);
    if (used) {
      throw new Error('이 그룹에 속한 검사 항목이 있어 삭제할 수 없어요. 먼저 항목의 그룹을 바꾸거나 삭제하세요.');
    }
    await this.groups.remove(id);
  }
}
