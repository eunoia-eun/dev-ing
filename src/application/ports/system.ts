import type { ISODate, ISODateTime } from '@domain/shared/types';

/**
 * 현재 시각 공급 포트.
 * 도메인 로직은 현재시각을 직접 읽지 않고, 애플리케이션 계층이 Clock으로 주입한다.
 * → 테스트에서는 FixedClock으로 시간을 고정할 수 있다.
 */
export interface Clock {
  today(): ISODate;
  now(): ISODateTime;
}

/** 식별자 생성 포트 */
export interface IdGenerator {
  next(): string;
}
