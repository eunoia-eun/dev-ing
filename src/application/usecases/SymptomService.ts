import type { EmployeeId } from '@domain/employee/Employee';
import {
  dispenseFromStock,
  isLowStock,
  restock,
  type Medicine,
  type MedicineDispense,
} from '@domain/symptom/Medicine';
import type {
  BloodPressure,
  HazardFinding,
  Severity,
  SymptomVisit,
  VisitLogEntry,
} from '@domain/symptom/Symptom';
import type {
  InventoryMovement,
  MovementType,
} from '@domain/inventory/InventoryMovement';
import { inDateRange } from '@domain/inventory/InventoryMovement';
import type { Id, ISODate } from '@domain/shared/types';
import type { MedicineRepository, SymptomVisitRepository } from '../ports/SymptomRepository';
import type { InventoryMovementRepository } from '../ports/InventoryMovementRepository';
import type { Clock, IdGenerator } from '../ports/system';

export interface DispenseInput {
  medicineId: Id;
  quantity: number;
}

export interface RecordVisitInput {
  employeeId: EmployeeId;
  symptoms: string[];
  symptomNote?: string;
  severity: Severity;
  bodyTemperature?: number;
  bloodPressure?: BloodPressure;
  dispenses: DispenseInput[];
  action?: string;
  managedBy: string;
  /** 방문 시점의 증상 ↔ 노출 유해인자 점검 결과(관련 물질만) */
  hazardFindings?: HazardFinding[];
}

export interface MedicineInput {
  name: string;
  /** 분류(예: 진통·해열제, 소화제, 외용제) */
  category: string;
  unit: string;
  stock: number;
  /** 적정 보유량(이 값 이하이면 부족 경고) */
  lowStockThreshold: number;
}

/**
 * 메뉴 2. 건강 관련 증상 및 상비약 수령 차트.
 * 방문 기록을 남기면서, 수령한 상비약 재고를 도메인 규칙(dispenseFromStock)에 따라 차감한다.
 */
export class SymptomService {
  constructor(
    private readonly visits: SymptomVisitRepository,
    private readonly medicines: MedicineRepository,
    private readonly movements: InventoryMovementRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  /** 입출고 대장에 한 줄 기록 */
  private async logMovement(m: {
    at: string;
    medicine: Pick<Medicine, 'id' | 'name' | 'unit'>;
    type: MovementType;
    quantity: number;
    reason?: string;
    employeeId?: EmployeeId;
    managedBy?: string;
  }): Promise<void> {
    if (m.quantity <= 0) return;
    await this.movements.save({
      id: this.ids.next(),
      at: m.at,
      medicineId: m.medicine.id,
      medicineName: m.medicine.name,
      unit: m.medicine.unit,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      employeeId: m.employeeId,
      managedBy: m.managedBy,
    });
  }

  /** 입출고 대장 조회(최신순, 구간 필터) */
  async listMovements(range?: { start?: ISODate; end?: ISODate }): Promise<InventoryMovement[]> {
    const all = await this.movements.list();
    return all
      .filter((m) => inDateRange(m.at, range?.start, range?.end))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  listVisits(): Promise<SymptomVisit[]> {
    return this.visits.list();
  }

  listVisitsByEmployee(employeeId: EmployeeId): Promise<SymptomVisit[]> {
    return this.visits.listByEmployee(employeeId);
  }

  listMedicines(): Promise<Medicine[]> {
    return this.medicines.list();
  }

  async getLowStockMedicines(): Promise<Medicine[]> {
    const all = await this.medicines.list();
    return all.filter(isLowStock);
  }

  /**
   * 방문 기록 + 상비약 수령 처리.
   * 모든 수령 항목의 재고를 먼저 검증/차감(부족 시 예외)한 뒤에야 기록을 저장한다
   * → 일부만 반영되는 일을 막는다.
   */
  async recordVisit(input: RecordVisitInput): Promise<SymptomVisit> {
    // 1) 같은 약품의 중복 수령을 합산
    const requested = new Map<Id, number>();
    for (const d of input.dispenses) {
      if (d.quantity <= 0) continue;
      requested.set(d.medicineId, (requested.get(d.medicineId) ?? 0) + d.quantity);
    }

    // 2) 재고 검증 + 차감(작업 복사본). 하나라도 부족하면 여기서 예외 → 저장 안 함
    const updatedMedicines: Medicine[] = [];
    const dispensed: MedicineDispense[] = [];
    for (const [medicineId, quantity] of requested) {
      const medicine = await this.medicines.getById(medicineId);
      if (!medicine) throw new Error(`상비약을 찾을 수 없습니다: ${medicineId}`);
      const next = dispenseFromStock(medicine, quantity); // 부족하면 InsufficientStockError
      updatedMedicines.push(next);
      dispensed.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantity,
        unit: medicine.unit,
      });
    }

    // 3) 검증 통과 후 실제 저장 (재고 갱신 → 방문 기록)
    for (const m of updatedMedicines) {
      await this.medicines.save(m);
    }

    const now = this.clock.now();
    const visit: SymptomVisit = {
      id: this.ids.next(),
      employeeId: input.employeeId,
      visitedAt: now,
      symptoms: input.symptoms,
      symptomNote: input.symptomNote,
      severity: input.severity,
      bodyTemperature: input.bodyTemperature,
      bloodPressure: input.bloodPressure,
      dispensedMedicines: dispensed,
      action: input.action,
      managedBy: input.managedBy,
      hazardFindings: input.hazardFindings,
      log: [{ at: now, action: 'created', by: input.managedBy }],
    };
    await this.visits.save(visit);

    // 입출고 대장에 반출 기록
    for (const d of dispensed) {
      await this.logMovement({
        at: now,
        medicine: { id: d.medicineId, name: d.medicineName, unit: d.unit },
        type: 'out',
        quantity: d.quantity,
        reason: '내원 수령',
        employeeId: input.employeeId,
        managedBy: input.managedBy,
      });
    }
    return visit;
  }

  /**
   * 방문 기록 수정.
   * - 상비약 변경분만큼 재고를 정합성 있게 보정(증가분은 차감/검증, 감소분은 반납).
   * - 변경 요약을 만들어 log에 'updated' 한 줄을 누적한다.
   */
  async updateVisit(visitId: Id, input: RecordVisitInput): Promise<SymptomVisit> {
    const existing = await this.visits.getById(visitId);
    if (!existing) throw new Error('방문 기록을 찾을 수 없습니다.');

    // 신규/기존 수령 합산
    const newReq = new Map<Id, number>();
    for (const d of input.dispenses) {
      if (d.quantity > 0) newReq.set(d.medicineId, (newReq.get(d.medicineId) ?? 0) + d.quantity);
    }
    const oldReq = new Map<Id, number>();
    for (const d of existing.dispensedMedicines) {
      oldReq.set(d.medicineId, (oldReq.get(d.medicineId) ?? 0) + d.quantity);
    }

    // 변경분(delta)만큼 재고 보정값 계산(검증 우선 → 부분 반영 방지)
    const updatedMedicines: Medicine[] = [];
    const deltas: Array<{ medicine: Medicine; delta: number }> = [];
    const dispensed: MedicineDispense[] = [];
    for (const medId of new Set([...newReq.keys(), ...oldReq.keys()])) {
      const want = newReq.get(medId) ?? 0;
      const had = oldReq.get(medId) ?? 0;
      const delta = want - had;
      const medicine = await this.medicines.getById(medId);
      if (!medicine) {
        if (want > 0) throw new Error(`상비약을 찾을 수 없습니다: ${medId}`);
        continue;
      }
      if (delta > 0) updatedMedicines.push(dispenseFromStock(medicine, delta)); // 부족 시 예외
      else if (delta < 0) updatedMedicines.push(restock(medicine, -delta));
      if (delta !== 0) deltas.push({ medicine, delta });
    }
    for (const [medId, quantity] of newReq) {
      const medicine = await this.medicines.getById(medId);
      if (!medicine) throw new Error(`상비약을 찾을 수 없습니다: ${medId}`);
      dispensed.push({ medicineId: medicine.id, medicineName: medicine.name, quantity, unit: medicine.unit });
    }

    // 검증 통과 후 저장
    for (const m of updatedMedicines) await this.medicines.save(m);

    const note = summarizeVisitChanges(existing, input);
    const entry: VisitLogEntry = {
      at: this.clock.now(),
      action: 'updated',
      by: input.managedBy || existing.managedBy,
      note,
    };
    const updated: SymptomVisit = {
      ...existing,
      symptoms: input.symptoms,
      symptomNote: input.symptomNote,
      severity: input.severity,
      bodyTemperature: input.bodyTemperature,
      bloodPressure: input.bloodPressure,
      dispensedMedicines: dispensed,
      action: input.action,
      managedBy: input.managedBy || existing.managedBy,
      hazardFindings: input.hazardFindings,
      log: [...(existing.log ?? []), entry],
    };
    await this.visits.save(updated);

    // 변경분을 대장에 기록(추가 반출 / 반납)
    for (const { medicine, delta } of deltas) {
      await this.logMovement({
        at: entry.at,
        medicine,
        type: delta > 0 ? 'out' : 'in',
        quantity: Math.abs(delta),
        reason: '내원기록 수정',
        employeeId: updated.employeeId,
        managedBy: updated.managedBy,
      });
    }
    return updated;
  }

  /** 입고(반입) — 재고 증가 + 대장 기록 */
  async restockMedicine(medicineId: Id, quantity: number, reason?: string): Promise<Medicine> {
    const medicine = await this.medicines.getById(medicineId);
    if (!medicine) throw new Error('상비약을 찾을 수 없습니다.');
    const next = restock(medicine, quantity);
    await this.medicines.save(next);
    await this.logMovement({
      at: this.clock.now(),
      medicine: next,
      type: 'in',
      quantity,
      reason: reason?.trim() || '입고',
      managedBy: '보건관리자',
    });
    return next;
  }

  /** 신규 상비약 등록 */
  async addMedicine(input: MedicineInput): Promise<Medicine> {
    const name = input.name.trim();
    if (!name) throw new Error('약품명을 입력하세요.');
    const medicine: Medicine = {
      id: this.ids.next(),
      name,
      category: input.category.trim() || '기타',
      unit: input.unit.trim() || '개',
      stock: Math.max(0, Math.round(input.stock || 0)),
      lowStockThreshold: Math.max(0, Math.round(input.lowStockThreshold || 0)),
    };
    await this.medicines.save(medicine);
    if (medicine.stock > 0) {
      await this.logMovement({
        at: this.clock.now(),
        medicine,
        type: 'in',
        quantity: medicine.stock,
        reason: '신규 등록(초기 재고)',
        managedBy: '보건관리자',
      });
    }
    return medicine;
  }

  /** 상비약 정보 수정(분류·단위·적정 보유량·재고). 재고가 바뀌면 '재고 조정'으로 대장 기록. */
  async updateMedicine(id: Id, input: MedicineInput): Promise<Medicine> {
    const existing = await this.medicines.getById(id);
    if (!existing) throw new Error('상비약을 찾을 수 없습니다.');
    const updated: Medicine = {
      ...existing,
      name: input.name.trim() || existing.name,
      category: input.category.trim() || existing.category,
      unit: input.unit.trim() || existing.unit,
      stock: Math.max(0, Math.round(input.stock)),
      lowStockThreshold: Math.max(0, Math.round(input.lowStockThreshold)),
    };
    await this.medicines.save(updated);
    const delta = updated.stock - existing.stock;
    if (delta !== 0) {
      await this.logMovement({
        at: this.clock.now(),
        medicine: updated,
        type: delta > 0 ? 'in' : 'out',
        quantity: Math.abs(delta),
        reason: '재고 조정',
        managedBy: '보건관리자',
      });
    }
    return updated;
  }

  async removeMedicine(id: Id): Promise<void> {
    await this.medicines.remove(id);
  }

  async deleteVisit(visitId: Id): Promise<void> {
    await this.visits.remove(visitId);
  }
}

/** 수정 전/후를 비교해 변경된 항목을 요약한다(로그 note용). */
function summarizeVisitChanges(old: SymptomVisit, input: RecordVisitInput): string {
  const changed: string[] = [];
  if (old.symptoms.join(', ') !== input.symptoms.join(', ')) changed.push('증상');
  if (old.severity !== input.severity) changed.push('정도');
  if ((old.bodyTemperature ?? null) !== (input.bodyTemperature ?? null)) changed.push('체온');
  const bpStr = (bp?: BloodPressure) => (bp ? `${bp.systolic}/${bp.diastolic}` : '');
  if (bpStr(old.bloodPressure) !== bpStr(input.bloodPressure)) changed.push('혈압');
  if ((old.action ?? '') !== (input.action ?? '')) changed.push('조치');
  if ((old.symptomNote ?? '') !== (input.symptomNote ?? '')) changed.push('메모');
  const dispStr = (list: Array<{ medicineId: string; quantity: number }>) =>
    list
      .filter((d) => d.quantity > 0)
      .map((d) => `${d.medicineId}:${d.quantity}`)
      .sort()
      .join(',');
  if (dispStr(old.dispensedMedicines) !== dispStr(input.dispenses)) changed.push('투약');
  return changed.length ? `${changed.join(', ')} 변경` : '변경 없음';
}
