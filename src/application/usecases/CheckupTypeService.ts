import { isBuiltinCheckupType, type CheckupTypeItem } from '@domain/checkup/HealthCheckup';
import type { Id } from '@domain/shared/types';
import type { CheckupTypeRepository } from '../ports/CheckupTypeRepository';
import type { HealthCheckupRepository } from '../ports/HealthCheckupRepository';
import type { IdGenerator } from '../ports/system';

/** 검진 종류 관리. 기본 종류는 삭제 불가, 사용 중인 종류는 삭제 차단. */
export class CheckupTypeService {
  constructor(
    private readonly types: CheckupTypeRepository,
    private readonly checkups: HealthCheckupRepository,
    private readonly ids: IdGenerator,
  ) {}

  list(): Promise<CheckupTypeItem[]> {
    return this.types.list();
  }

  async create(name: string): Promise<CheckupTypeItem> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('검진 종류명을 입력하세요.');
    const all = await this.types.list();
    if (all.some((t) => t.name === trimmed)) throw new Error('이미 존재하는 검진 종류입니다.');
    const item: CheckupTypeItem = { id: `ctype_${this.ids.next()}`, name: trimmed };
    await this.types.save(item);
    return item;
  }

  async remove(id: Id): Promise<void> {
    if (isBuiltinCheckupType(id)) {
      throw new Error('기본 검진 종류는 삭제할 수 없습니다.');
    }
    const used = (await this.checkups.list()).some((c) => c.type === id);
    if (used) throw new Error('이 종류를 사용하는 검진 기록이 있어 삭제할 수 없습니다.');
    await this.types.remove(id);
  }
}
