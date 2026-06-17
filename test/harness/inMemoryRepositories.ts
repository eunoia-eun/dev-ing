import type { Employee, EmployeeId } from '@domain/employee/Employee';
import type { Assignment } from '@domain/employee/Assignment';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';
import type { Medicine } from '@domain/symptom/Medicine';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { Enrollment, HealthProgram } from '@domain/program/HealthProgram';
import type { CheckupTypeItem, HealthCheckup, LabGroup, LabItem } from '@domain/checkup/HealthCheckup';
import type { Department } from '@domain/department/Department';
import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';
import type { InventoryMovement } from '@domain/inventory/InventoryMovement';
import type { Account } from '@domain/auth/Account';
import type { WorkplaceMeasurement } from '@domain/measurement/WorkplaceMeasurement';
import type { MeasurementRound, MeasurementDocument } from '@domain/measurement/MeasurementRound';
import type { Id } from '@domain/shared/types';
import type { WorkplaceMeasurementRepository } from '@application/ports/WorkplaceMeasurementRepository';
import type {
  MeasurementRoundRepository,
  MeasurementDocumentRepository,
  FileStore,
} from '@application/ports/MeasurementRoundRepository';

import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import type { AssignmentRepository } from '@application/ports/AssignmentRepository';
import type { InventoryMovementRepository } from '@application/ports/InventoryMovementRepository';
import type { DepartmentRepository } from '@application/ports/DepartmentRepository';
import type { DepartmentHazardRepository } from '@application/ports/DepartmentHazardRepository';
import type { LabItemRepository } from '@application/ports/LabItemRepository';
import type { LabGroupRepository } from '@application/ports/LabGroupRepository';
import type { CheckupTypeRepository } from '@application/ports/CheckupTypeRepository';
import type { ExposureRepository } from '@application/ports/HazardRepository';
import type { MedicineRepository, SymptomVisitRepository } from '@application/ports/SymptomRepository';
import type { EnrollmentRepository, ProgramRepository } from '@application/ports/ProgramRepository';
import type { HealthCheckupRepository } from '@application/ports/HealthCheckupRepository';
import type { IAccountRepository } from '@application/ports/IAccountRepository';

/** 인메모리 컬렉션 — 빠르고 결정적인 테스트용. localStorage를 거치지 않는다. */
class InMemoryStore<T extends { id: string }> {
  private items: T[];
  constructor(seed: T[] = []) {
    this.items = seed.map((i) => ({ ...i }));
  }
  all(): T[] {
    return this.items.map((i) => ({ ...i }));
  }
  byId(id: string): T | null {
    const found = this.items.find((i) => i.id === id);
    return found ? { ...found } : null;
  }
  upsert(item: T): void {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) this.items[idx] = { ...item };
    else this.items.push({ ...item });
  }
  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }
}

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private store: InMemoryStore<Employee>;
  constructor(seed: Employee[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: EmployeeId) {
    return Promise.resolve(this.store.byId(id));
  }
  save(employee: Employee) {
    this.store.upsert(employee);
    return Promise.resolve();
  }
  remove(id: EmployeeId) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private store: InMemoryStore<Assignment>;
  constructor(seed: Assignment[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  listByEmployee(employeeId: EmployeeId) {
    return Promise.resolve(this.store.all().filter((a) => a.employeeId === employeeId));
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(assignment: Assignment) {
    this.store.upsert(assignment);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryExposureRepository implements ExposureRepository {
  private store: InMemoryStore<ExposureRecord>;
  constructor(seed: ExposureRecord[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  listByEmployee(employeeId: EmployeeId) {
    return Promise.resolve(this.store.all().filter((r) => r.employeeId === employeeId));
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(record: ExposureRecord) {
    this.store.upsert(record);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryMedicineRepository implements MedicineRepository {
  private store: InMemoryStore<Medicine>;
  constructor(seed: Medicine[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(medicine: Medicine) {
    this.store.upsert(medicine);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemorySymptomVisitRepository implements SymptomVisitRepository {
  private store: InMemoryStore<SymptomVisit>;
  constructor(seed: SymptomVisit[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  listByEmployee(employeeId: EmployeeId) {
    return Promise.resolve(this.store.all().filter((v) => v.employeeId === employeeId));
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(visit: SymptomVisit) {
    this.store.upsert(visit);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryProgramRepository implements ProgramRepository {
  private store: InMemoryStore<HealthProgram>;
  constructor(seed: HealthProgram[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(program: HealthProgram) {
    this.store.upsert(program);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryEnrollmentRepository implements EnrollmentRepository {
  private store: InMemoryStore<Enrollment>;
  constructor(seed: Enrollment[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  listByProgram(programId: Id) {
    return Promise.resolve(this.store.all().filter((e) => e.programId === programId));
  }
  listByEmployee(employeeId: EmployeeId) {
    return Promise.resolve(this.store.all().filter((e) => e.employeeId === employeeId));
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(enrollment: Enrollment) {
    this.store.upsert(enrollment);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryInventoryMovementRepository implements InventoryMovementRepository {
  private store: InMemoryStore<InventoryMovement>;
  constructor(seed: InventoryMovement[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  save(movement: InventoryMovement) {
    this.store.upsert(movement);
    return Promise.resolve();
  }
}

export class InMemoryDepartmentRepository implements DepartmentRepository {
  private store: InMemoryStore<Department>;
  constructor(seed: Department[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(department: Department) {
    this.store.upsert(department);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryDepartmentHazardRepository implements DepartmentHazardRepository {
  private store: InMemoryStore<DepartmentHazard>;
  constructor(seed: DepartmentHazard[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  save(item: DepartmentHazard) {
    this.store.upsert(item);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryLabItemRepository implements LabItemRepository {
  private store: InMemoryStore<LabItem>;
  constructor(seed: LabItem[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(item: LabItem) {
    this.store.upsert(item);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryLabGroupRepository implements LabGroupRepository {
  private store: InMemoryStore<LabGroup>;
  constructor(seed: LabGroup[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(group: LabGroup) {
    this.store.upsert(group);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryCheckupTypeRepository implements CheckupTypeRepository {
  private store: InMemoryStore<CheckupTypeItem>;
  constructor(seed: CheckupTypeItem[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(item: CheckupTypeItem) {
    this.store.upsert(item);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryHealthCheckupRepository implements HealthCheckupRepository {
  private store: InMemoryStore<HealthCheckup>;
  constructor(seed: HealthCheckup[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() {
    return Promise.resolve(this.store.all());
  }
  listByEmployee(employeeId: string) {
    return Promise.resolve(this.store.all().filter((c) => c.employeeId === employeeId));
  }
  getById(id: Id) {
    return Promise.resolve(this.store.byId(id));
  }
  save(checkup: HealthCheckup) {
    this.store.upsert(checkup);
    return Promise.resolve();
  }
  remove(id: Id) {
    this.store.remove(id);
    return Promise.resolve();
  }
}

export class InMemoryAccountRepository implements IAccountRepository {
  private store: InMemoryStore<Account>;
  constructor(seed: Account[] = []) {
    this.store = new InMemoryStore(seed);
  }
  findByEmployeeId(id: string) {
    return Promise.resolve(this.store.all().find((a) => a.employeeId === id) ?? null);
  }
  findByEmployeeNumber(num: string) {
    return Promise.resolve(this.store.all().find((a) => a.employeeNumber === num) ?? null);
  }
  findManagerAccount() {
    return Promise.resolve(this.store.all().find((a) => a.role === 'manager') ?? null);
  }
  save(a: Account) {
    this.store.upsert(a);
    return Promise.resolve();
  }
  list() {
    return Promise.resolve(this.store.all());
  }
}

export class InMemoryWorkplaceMeasurementRepository implements WorkplaceMeasurementRepository {
  private store: InMemoryStore<WorkplaceMeasurement>;
  constructor(seed: WorkplaceMeasurement[] = []) {
    this.store = new InMemoryStore(seed);
  }
  list() { return Promise.resolve(this.store.all()); }
  save(m: WorkplaceMeasurement) { this.store.upsert(m); return Promise.resolve(); }
  remove(id: string) { this.store.remove(id); return Promise.resolve(); }
}

export class InMemoryMeasurementRoundRepository implements MeasurementRoundRepository {
  private store: InMemoryStore<MeasurementRound>;
  constructor(seed: MeasurementRound[] = []) { this.store = new InMemoryStore(seed); }
  list() { return Promise.resolve(this.store.all()); }
  getById(id: string) { return Promise.resolve(this.store.byId(id)); }
  save(r: MeasurementRound) { this.store.upsert(r); return Promise.resolve(); }
  remove(id: string) { this.store.remove(id); return Promise.resolve(); }
}

export class InMemoryMeasurementDocumentRepository implements MeasurementDocumentRepository {
  private store: InMemoryStore<MeasurementDocument>;
  constructor(seed: MeasurementDocument[] = []) { this.store = new InMemoryStore(seed); }
  listByRound(roundId: string) {
    return Promise.resolve(this.store.all().filter((d) => d.roundId === roundId));
  }
  getById(id: string) { return Promise.resolve(this.store.byId(id)); }
  save(doc: MeasurementDocument) { this.store.upsert(doc); return Promise.resolve(); }
  remove(id: string) { this.store.remove(id); return Promise.resolve(); }
  removeByRound(roundId: string) {
    this.store.all().filter((d) => d.roundId === roundId).forEach((d) => this.store.remove(d.id));
    return Promise.resolve();
  }
}

export class InMemoryFileStore implements FileStore {
  private files = new Map<string, ArrayBuffer>();
  async save(id: string, data: ArrayBuffer) { this.files.set(id, data); }
  async load(id: string) { return this.files.get(id) ?? null; }
  async remove(id: string) { this.files.delete(id); }
  async removeMany(ids: string[]) { ids.forEach((id) => this.files.delete(id)); }
}
