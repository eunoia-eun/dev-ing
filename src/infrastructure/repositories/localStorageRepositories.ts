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
import type { Id } from '@domain/shared/types';

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

import {
  seedAssignments,
  seedCheckups,
  seedCheckupTypes,
  seedDepartments,
  seedDepartmentHazards,
  seedEmployees,
  seedEnrollments,
  seedLabGroups,
  seedLabItems,
  seedExposures,
  seedMedicines,
  seedMovements,
  seedPrograms,
  seedVisits,
} from '../seed/seedData';
import { LocalStorageStore } from './LocalStorageStore';

export class LocalEmployeeRepository implements EmployeeRepository {
  private store = new LocalStorageStore<Employee>('employees', seedEmployees);
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

export class LocalAssignmentRepository implements AssignmentRepository {
  private store = new LocalStorageStore<Assignment>('assignments', seedAssignments);
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

export class LocalExposureRepository implements ExposureRepository {
  private store = new LocalStorageStore<ExposureRecord>('exposures', seedExposures);
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

export class LocalMedicineRepository implements MedicineRepository {
  private store = new LocalStorageStore<Medicine>('medicines', seedMedicines);
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

export class LocalSymptomVisitRepository implements SymptomVisitRepository {
  private store = new LocalStorageStore<SymptomVisit>('visits', seedVisits);
  list() {
    return Promise.resolve(
      this.store.all().sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)),
    );
  }
  listByEmployee(employeeId: EmployeeId) {
    return Promise.resolve(
      this.store
        .all()
        .filter((v) => v.employeeId === employeeId)
        .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)),
    );
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

export class LocalProgramRepository implements ProgramRepository {
  private store = new LocalStorageStore<HealthProgram>('programs', seedPrograms);
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

export class LocalEnrollmentRepository implements EnrollmentRepository {
  private store = new LocalStorageStore<Enrollment>('enrollments', seedEnrollments);
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

export class LocalInventoryMovementRepository implements InventoryMovementRepository {
  private store = new LocalStorageStore<InventoryMovement>('movements', seedMovements);
  list() {
    return Promise.resolve(this.store.all());
  }
  save(movement: InventoryMovement) {
    this.store.upsert(movement);
    return Promise.resolve();
  }
}

export class LocalDepartmentRepository implements DepartmentRepository {
  private store = new LocalStorageStore<Department>('departments', seedDepartments);
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

export class LocalDepartmentHazardRepository implements DepartmentHazardRepository {
  private store = new LocalStorageStore<DepartmentHazard>('deptHazards', seedDepartmentHazards);
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

export class LocalLabItemRepository implements LabItemRepository {
  private store = new LocalStorageStore<LabItem>('labItems', seedLabItems);
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

export class LocalLabGroupRepository implements LabGroupRepository {
  private store = new LocalStorageStore<LabGroup>('labGroups', seedLabGroups);
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

export class LocalCheckupTypeRepository implements CheckupTypeRepository {
  private store = new LocalStorageStore<CheckupTypeItem>('checkupTypes', seedCheckupTypes);
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

export class LocalHealthCheckupRepository implements HealthCheckupRepository {
  private store = new LocalStorageStore<HealthCheckup>('checkups', seedCheckups);
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
