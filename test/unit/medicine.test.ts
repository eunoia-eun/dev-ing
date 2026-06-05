import { describe, expect, it } from 'vitest';
import {
  InsufficientStockError,
  dispenseFromStock,
  isLowStock,
  restock,
} from '@domain/symptom/Medicine';
import { aMedicine } from '@test/harness/builders';

describe('dispenseFromStock', () => {
  it('재고를 줄인 새 객체를 반환하고 원본은 불변', () => {
    const med = aMedicine({ stock: 10 });
    const next = dispenseFromStock(med, 3);
    expect(next.stock).toBe(7);
    expect(med.stock).toBe(10); // 원본 불변
    expect(next).not.toBe(med);
  });

  it('재고보다 많이 수령하면 InsufficientStockError', () => {
    const med = aMedicine({ stock: 2 });
    expect(() => dispenseFromStock(med, 3)).toThrow(InsufficientStockError);
  });

  it('0 이하 수량은 거부', () => {
    expect(() => dispenseFromStock(aMedicine({ stock: 5 }), 0)).toThrow();
    expect(() => dispenseFromStock(aMedicine({ stock: 5 }), -1)).toThrow();
  });

  it('재고와 동일 수량은 허용(재고 0)', () => {
    expect(dispenseFromStock(aMedicine({ stock: 5 }), 5).stock).toBe(0);
  });
});

describe('restock', () => {
  it('재고를 늘린다', () => {
    expect(restock(aMedicine({ stock: 5 }), 10).stock).toBe(15);
  });
});

describe('isLowStock', () => {
  it('재고가 임계 이하이면 true', () => {
    expect(isLowStock(aMedicine({ stock: 3, lowStockThreshold: 3 }))).toBe(true);
    expect(isLowStock(aMedicine({ stock: 2, lowStockThreshold: 3 }))).toBe(true);
    expect(isLowStock(aMedicine({ stock: 4, lowStockThreshold: 3 }))).toBe(false);
  });
});
