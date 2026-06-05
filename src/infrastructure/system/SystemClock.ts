import type { ISODate, ISODateTime } from '@domain/shared/types';
import type { Clock } from '@application/ports/system';

/** 실제 시스템 시계 — 애플리케이션의 가장자리(infrastructure)에서만 현재시각을 읽는다. */
export class SystemClock implements Clock {
  today(): ISODate {
    const d = new Date();
    const y = d.getFullYear().toString().padStart(4, '0');
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  now(): ISODateTime {
    return new Date().toISOString();
  }
}
