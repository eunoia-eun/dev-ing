import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { aMedicine } from '@test/harness/builders';

describe('SymptomService 입출고 대장', () => {
  it('입고 시 사유와 함께 in 기록이 남는다', async () => {
    const { services } = buildTestServices({ medicines: [aMedicine({ id: 'med-1', stock: 5 })] });
    await services.symptom.restockMedicine('med-1', 10, '정기 구매');
    const inMove = (await services.symptom.listMovements()).find((m) => m.type === 'in');
    expect(inMove?.quantity).toBe(10);
    expect(inMove?.reason).toBe('정기 구매');
    expect(inMove?.medicineName).toBeTruthy();
  });

  it('내원 수령 시 out 기록이 남는다', async () => {
    const { services } = buildTestServices({ medicines: [aMedicine({ id: 'med-1', stock: 10 })] });
    await services.symptom.recordVisit({
      employeeId: 'emp-1',
      symptoms: ['두통'],
      severity: 'mild',
      dispenses: [{ medicineId: 'med-1', quantity: 3 }],
      managedBy: '간호사',
    });
    const out = (await services.symptom.listMovements()).find((m) => m.type === 'out');
    expect(out?.quantity).toBe(3);
    expect(out?.employeeId).toBe('emp-1');
  });

  it('약품을 삭제해도 대장 기록은 보존된다', async () => {
    const { services } = buildTestServices({
      medicines: [aMedicine({ id: 'med-1', name: '테스트약', stock: 5 })],
    });
    await services.symptom.restockMedicine('med-1', 5, '구매');
    await services.symptom.removeMedicine('med-1');
    const moves = await services.symptom.listMovements();
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].medicineName).toBe('테스트약');
  });

  it('구간 조회로 필터된다', async () => {
    const { services } = buildTestServices({
      movements: [
        { id: 'm1', at: '2026-01-15T09:00:00.000Z', medicineId: 'med-1', medicineName: 'A', unit: '정', type: 'in', quantity: 5 },
        { id: 'm2', at: '2026-06-15T09:00:00.000Z', medicineId: 'med-1', medicineName: 'A', unit: '정', type: 'in', quantity: 5 },
      ],
    });
    const r = await services.symptom.listMovements({ start: '2026-06-01', end: '2026-06-30' });
    expect(r.map((m) => m.id)).toEqual(['m2']);
  });
});
