/**
 * localStorage 기반 단순 컬렉션 저장소.
 * - 키가 비어 있으면 시드 데이터로 1회 초기화한다.
 * - localStorage가 없는 환경(SSR 등)에서는 메모리로 폴백한다.
 *
 * 모든 도메인 저장소(Repository)는 이 위에 얇게 구현된다.
 * 나중에 실제 백엔드로 교체할 때 이 파일과 repositories만 바꾸면 된다.
 */

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function resolveStorage(): KeyValueStorage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* 접근 불가 시 폴백 */
  }
  return createMemoryStorage();
}

export const STORAGE_PREFIX = 'whm:'; // workplace-health-manager

export class LocalStorageStore<T extends { id: string }> {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  constructor(
    key: string,
    private readonly seed: T[] = [],
  ) {
    this.key = STORAGE_PREFIX + key;
    this.storage = resolveStorage();
  }

  private readAll(): T[] {
    const raw = this.storage.getItem(this.key);
    if (raw == null) {
      this.writeAll(this.seed);
      return this.clone(this.seed);
    }
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return this.clone(this.seed);
    }
  }

  private writeAll(items: T[]): void {
    this.storage.setItem(this.key, JSON.stringify(items));
  }

  private clone(items: T[]): T[] {
    return items.map((i) => ({ ...i }));
  }

  all(): T[] {
    return this.readAll();
  }

  byId(id: string): T | null {
    return this.readAll().find((i) => i.id === id) ?? null;
  }

  upsert(item: T): void {
    const all = this.readAll();
    const idx = all.findIndex((i) => i.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    this.writeAll(all);
  }

  remove(id: string): void {
    this.writeAll(this.readAll().filter((i) => i.id !== id));
  }
}
