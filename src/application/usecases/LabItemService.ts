import { isBuiltinLabItem, type LabItem } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';
import type { LabItemRepository } from '../ports/LabItemRepository';
import type { IdGenerator } from '../ports/system';

export interface NewLabItemInput {
  name: string;
  group: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
}

/**
 * 검사 항목 카탈로그 관리.
 * 기본(내장) 항목은 '제외'(enabled=false)만 가능하고, 사용자 추가 항목은 삭제도 가능하다.
 */
export class LabItemService {
  constructor(
    private readonly items: LabItemRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** 전체(관리용) — order 순. 과거 데이터에 order가 없으면 1회 마이그레이션. */
  async list(): Promise<LabItem[]> {
    const all = await this.items.list();
    const needsMigration = all.some((i) => typeof i.order !== 'number' || Number.isNaN(i.order));
    if (needsMigration) {
      for (let i = 0; i < all.length; i++) {
        all[i] = { ...all[i], order: i };
        await this.items.save(all[i]);
      }
    }
    return [...all].sort((a, b) => a.order - b.order);
  }

  /** 입력 폼/표시에 쓸 활성 항목만 */
  async listEnabled(): Promise<LabItem[]> {
    return (await this.items.list()).filter((i) => i.enabled);
  }

  async create(input: NewLabItemInput): Promise<LabItem> {
    const name = input.name.trim();
    if (!name) throw new Error('검사 항목명을 입력하세요.');
    const id = `lab_${this.ids.next()}`;
    const all = await this.list(); // 마이그레이션된 order 보장
    const order = all.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    const item: LabItem = {
      id,
      code: id,
      name,
      group: input.group.trim() || '기타',
      unit: input.unit?.trim() || undefined,
      refLow: input.refLow,
      refHigh: input.refHigh,
      enabled: true,
      order,
    };
    await this.items.save(item);
    return item;
  }

  /** 드래그 등으로 전달된 id 순서대로 order를 0..N으로 재배치한다. */
  async reorder(orderedIds: string[]): Promise<void> {
    const items = await this.list();
    const byId = new Map(items.map((i) => [i.id, i]));
    for (let i = 0; i < orderedIds.length; i++) {
      const item = byId.get(orderedIds[i]);
      if (item && item.order !== i) await this.items.save({ ...item, order: i });
    }
  }

  /** 순서 이동 — 위치를 바꾼 뒤 전체 order를 0..N으로 다시 매겨 확실히 반영한다. */
  async move(id: Id, direction: 'up' | 'down'): Promise<void> {
    const ordered = await this.list();
    const idx = ordered.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].order !== i) await this.items.save({ ...ordered[i], order: i });
    }
  }

  async update(id: Id, input: NewLabItemInput): Promise<LabItem> {
    const existing = await this.items.getById(id);
    if (!existing) throw new Error('검사 항목을 찾을 수 없어요.');
    const updated: LabItem = {
      ...existing,
      name: input.name.trim() || existing.name,
      group: input.group.trim() || existing.group,
      unit: input.unit?.trim() || undefined,
      refLow: input.refLow,
      refHigh: input.refHigh,
    };
    await this.items.save(updated);
    return updated;
  }

  /** 제외(false) / 포함(true) */
  async setEnabled(id: Id, enabled: boolean): Promise<void> {
    const existing = await this.items.getById(id);
    if (!existing) return;
    await this.items.save({ ...existing, enabled });
  }

  async remove(id: Id): Promise<void> {
    if (isBuiltinLabItem(id)) {
      throw new Error('기본 검사 항목은 삭제할 수 없어요. 대신 "제외"하세요.');
    }
    await this.items.remove(id);
  }
}
