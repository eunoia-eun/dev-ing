import type { Id } from '../shared/types';

/** 부서 */
export interface Department {
  id: Id;
  name: string;
  /** 비고(설명) */
  note?: string;
}
