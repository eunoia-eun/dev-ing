import { describe, expect, it } from 'vitest';
import { InsufficientStockError } from '@domain/symptom/Medicine';
import { buildTestServices } from '@test/harness/buildTestServices';
import { aMedicine } from '@test/harness/builders';

describe('SymptomService.recordVisit', () => {
  it('방문을 기록하고 수령한 상비약 재고를 차감한다', async () => {
    const { services, repos } = buildTestServices(
      { medicines: [aMedicine({ id: 'med-1', stock: 5, unit: '정' })] },
      { today: '2026-06-02' },
    );
    const visit = await services.symptom.recordVisit({
      employeeId: 'emp-1',
      symptoms: ['두통'],
      severity: 'mild',
      dispenses: [{ medicineId: 'med-1', quantity: 2 }],
      managedBy: '보건관리자',
    });
    expect(visit.dispensedMedicines[0]).toMatchObject({ medicineName: '테스트약', quantity: 2 });
    expect(visit.visitedAt).toBe('2026-06-02T00:00:00.000Z'); // FixedClock
    const med = await repos.medicines.getById('med-1');
    expect(med?.stock).toBe(3);
  });

  it('같은 약품을 여러 줄로 수령하면 합산해 차감한다', async () => {
    const { services, repos } = buildTestServices({
      medicines: [aMedicine({ id: 'med-1', stock: 10 })],
    });
    await services.symptom.recordVisit({
      employeeId: 'emp-1',
      symptoms: ['통증'],
      severity: 'mild',
      dispenses: [
        { medicineId: 'med-1', quantity: 1 },
        { medicineId: 'med-1', quantity: 2 },
      ],
      managedBy: '보건관리자',
    });
    expect((await repos.medicines.getById('med-1'))?.stock).toBe(7);
  });

  it('재고가 부족하면 예외를 던지고, 재고도 방문기록도 바뀌지 않는다(부분 반영 방지)', async () => {
    const { services, repos } = buildTestServices({
      medicines: [aMedicine({ id: 'med-1', stock: 1 })],
    });
    await expect(
      services.symptom.recordVisit({
        employeeId: 'emp-1',
        symptoms: ['두통'],
        severity: 'mild',
        dispenses: [{ medicineId: 'med-1', quantity: 5 }],
        managedBy: '보건관리자',
      }),
    ).rejects.toThrow(InsufficientStockError);

    expect((await repos.medicines.getById('med-1'))?.stock).toBe(1); // 그대로
    expect(await services.symptom.listVisits()).toHaveLength(0); // 저장 안 됨
  });

  it('restockMedicine은 재고를 보충한다', async () => {
    const { services } = buildTestServices({
      medicines: [aMedicine({ id: 'med-1', stock: 2 })],
    });
    const updated = await services.symptom.restockMedicine('med-1', 8);
    expect(updated.stock).toBe(10);
  });

  it('getLowStockMedicines는 임계 이하 약품만 반환한다', async () => {
    const { services } = buildTestServices({
      medicines: [
        aMedicine({ id: 'med-1', stock: 2, lowStockThreshold: 3 }),
        aMedicine({ id: 'med-2', stock: 50, lowStockThreshold: 10 }),
      ],
    });
    const low = await services.symptom.getLowStockMedicines();
    expect(low.map((m) => m.id)).toEqual(['med-1']);
  });

  it('등록 시 점검 결과와 created 로그를 함께 저장한다', async () => {
    const { services } = buildTestServices();
    const v = await services.symptom.recordVisit({
      employeeId: 'emp-1',
      symptoms: ['두통'],
      severity: 'mild',
      dispenses: [],
      managedBy: '간호사',
      hazardFindings: [{ substanceName: '톨루엔', matchedSymptoms: ['두통'], targetOrgans: ['신경계'] }],
    });
    expect(v.hazardFindings?.[0].substanceName).toBe('톨루엔');
    expect(v.log).toEqual([{ at: '2026-06-02T00:00:00.000Z', action: 'created', by: '간호사' }]);
  });
});

describe('SymptomService.updateVisit', () => {
  const base = {
    employeeId: 'emp-1',
    severity: 'mild' as const,
    managedBy: '간호사',
  };

  it('변경분만 재고에 반영하고 updated 로그를 누적한다', async () => {
    const { services, repos } = buildTestServices({ medicines: [aMedicine({ id: 'med-1', stock: 10 })] });
    const v = await services.symptom.recordVisit({
      ...base,
      symptoms: ['두통'],
      dispenses: [{ medicineId: 'med-1', quantity: 2 }],
    });
    expect((await repos.medicines.getById('med-1'))?.stock).toBe(8);

    const u = await services.symptom.updateVisit(v.id, {
      ...base,
      symptoms: ['두통', '발열'],
      dispenses: [{ medicineId: 'med-1', quantity: 5 }], // +3 추가 차감
    });
    expect((await repos.medicines.getById('med-1'))?.stock).toBe(5);
    expect(u.log?.map((l) => l.action)).toEqual(['created', 'updated']);
    expect(u.log?.[1].note).toContain('증상');
    expect(u.log?.[1].note).toContain('투약');
  });

  it('수령량을 줄이면 재고를 반납한다', async () => {
    const { services, repos } = buildTestServices({ medicines: [aMedicine({ id: 'med-1', stock: 10 })] });
    const v = await services.symptom.recordVisit({
      ...base,
      symptoms: ['두통'],
      dispenses: [{ medicineId: 'med-1', quantity: 4 }],
    });
    await services.symptom.updateVisit(v.id, {
      ...base,
      symptoms: ['두통'],
      dispenses: [{ medicineId: 'med-1', quantity: 1 }],
    });
    expect((await repos.medicines.getById('med-1'))?.stock).toBe(9); // 3 반납
  });

  it('증가분이 재고를 초과하면 예외, 재고 불변', async () => {
    const { services, repos } = buildTestServices({ medicines: [aMedicine({ id: 'med-1', stock: 3 })] });
    const v = await services.symptom.recordVisit({
      ...base,
      symptoms: ['두통'],
      dispenses: [{ medicineId: 'med-1', quantity: 2 }],
    });
    await expect(
      services.symptom.updateVisit(v.id, {
        ...base,
        symptoms: ['두통'],
        dispenses: [{ medicineId: 'med-1', quantity: 10 }],
      }),
    ).rejects.toThrow();
    expect((await repos.medicines.getById('med-1'))?.stock).toBe(1); // 불변
  });
});

describe('SymptomService 상비약 관리', () => {
  it('신규 약품을 등록한다', async () => {
    const { services } = buildTestServices();
    const m = await services.symptom.addMedicine({
      name: '겔포스',
      category: '제산제',
      unit: '포',
      stock: 5,
      lowStockThreshold: 3,
    });
    expect(m.name).toBe('겔포스');
    expect((await services.symptom.listMedicines()).some((x) => x.id === m.id)).toBe(true);
  });

  it('적정 보유량 등 정보를 수정한다', async () => {
    const { services } = buildTestServices({
      medicines: [aMedicine({ id: 'med-1', lowStockThreshold: 3, stock: 10 })],
    });
    const u = await services.symptom.updateMedicine('med-1', {
      name: '수정약',
      category: '기타',
      unit: '정',
      stock: 20,
      lowStockThreshold: 8,
    });
    expect(u.lowStockThreshold).toBe(8);
    expect(u.stock).toBe(20);
    expect(u.name).toBe('수정약');
  });

  it('약품을 삭제한다', async () => {
    const { services } = buildTestServices({ medicines: [aMedicine({ id: 'med-1' })] });
    await services.symptom.removeMedicine('med-1');
    expect(await services.symptom.listMedicines()).toHaveLength(0);
  });

  it('약품명이 비면 등록 실패', async () => {
    const { services } = buildTestServices();
    await expect(
      services.symptom.addMedicine({ name: '  ', category: '기타', unit: '정', stock: 0, lowStockThreshold: 0 }),
    ).rejects.toThrow();
  });
});
