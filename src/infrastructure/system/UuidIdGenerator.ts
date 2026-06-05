import type { IdGenerator } from '@application/ports/system';

/** crypto.randomUUID 기반 ID 생성기 (미지원 환경 대비 폴백 포함) */
export class UuidIdGenerator implements IdGenerator {
  next(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
    // 폴백: 충분히 고유한 임의 문자열
    return `id-${Math.abs(hashNow())}-${randomSuffix()}`;
  }
}

function hashNow(): number {
  // Date를 직접 쓰되 ID 용도이므로 무방
  return Date.now() ^ Math.floor(Math.random() * 0xffffffff);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
