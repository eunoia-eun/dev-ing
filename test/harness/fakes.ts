import type { ISODate, ISODateTime } from '@domain/shared/types';
import type { Clock, IdGenerator } from '@application/ports/system';

/**
 * 시간을 고정하는 테스트용 시계.
 * 도메인 로직이 today를 주입받도록 설계됐기 때문에, 테스트는 '오늘'을 마음대로 정할 수 있다.
 */
export class FixedClock implements Clock {
  constructor(
    private fixedToday: ISODate,
    private fixedNow?: ISODateTime,
  ) {}

  today(): ISODate {
    return this.fixedToday;
  }

  now(): ISODateTime {
    return this.fixedNow ?? `${this.fixedToday}T00:00:00.000Z`;
  }

  set(today: ISODate, now?: ISODateTime): void {
    this.fixedToday = today;
    this.fixedNow = now;
  }
}

/** 예측 가능한 순번 ID 생성기 — 테스트 단언을 쉽게 한다. */
export class SeqIdGenerator implements IdGenerator {
  private n = 0;
  constructor(private prefix = 'id') {}
  next(): string {
    this.n += 1;
    return `${this.prefix}-${this.n}`;
  }
}
