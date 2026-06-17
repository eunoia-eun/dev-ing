import type { Employee } from '@domain/employee/Employee';
import type { Assignment } from '@domain/employee/Assignment';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';
import type { Medicine } from '@domain/symptom/Medicine';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { Enrollment, HealthProgram } from '@domain/program/HealthProgram';
import type { CheckupTypeItem, HealthCheckup, LabGroup, LabItem } from '@domain/checkup/HealthCheckup';
import type { Department } from '@domain/department/Department';
import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';
import type { InventoryMovement } from '@domain/inventory/InventoryMovement';
import type { WorkplaceMeasurement } from '@domain/measurement/WorkplaceMeasurement';
import type { ISODate } from '@domain/shared/types';

import { EmployeeService } from '@application/usecases/EmployeeService';
import { AssignmentService } from '@application/usecases/AssignmentService';
import { HazardExposureService } from '@application/usecases/HazardExposureService';
import { SymptomService } from '@application/usecases/SymptomService';
import { ProgramService } from '@application/usecases/ProgramService';
import { HealthCheckupService } from '@application/usecases/HealthCheckupService';
import { EmployeeProfileService } from '@application/usecases/EmployeeProfileService';
import { DepartmentService } from '@application/usecases/DepartmentService';
import { LabItemService } from '@application/usecases/LabItemService';
import { LabGroupService } from '@application/usecases/LabGroupService';
import { CheckupTypeService } from '@application/usecases/CheckupTypeService';
import { StatisticsService } from '@application/usecases/StatisticsService';
import { AuthService } from '@application/usecases/AuthService';
import { WorkplaceMeasurementService } from '@application/usecases/WorkplaceMeasurementService';
import type { IPasswordHasher } from '@application/ports/IPasswordHasher';
import type { AppServices } from '@composition/container';
import { StaticHazardCatalogProvider } from '@infrastructure/seed/hazardCatalog';
import { StaticHazardHealthProvider } from '@infrastructure/seed/hazardHealthDetails';

import { FixedClock, SeqIdGenerator } from './fakes';
import {
  InMemoryAccountRepository,
  InMemoryWorkplaceMeasurementRepository,
  InMemoryMeasurementRoundRepository,
  InMemoryMeasurementDocumentRepository,
  InMemoryFileStore,
  InMemoryAssignmentRepository,
  InMemoryDepartmentRepository,
  InMemoryDepartmentHazardRepository,
  InMemoryLabItemRepository,
  InMemoryLabGroupRepository,
  InMemoryCheckupTypeRepository,
  InMemoryEmployeeRepository,
  InMemoryEnrollmentRepository,
  InMemoryExposureRepository,
  InMemoryHealthCheckupRepository,
  InMemoryMedicineRepository,
  InMemoryProgramRepository,
  InMemorySymptomVisitRepository,
  InMemoryInventoryMovementRepository,
} from './inMemoryRepositories';

/** 테스트용 평문 해셔 — crypto.subtle 없이 동작 */
class PlainTextHasher implements IPasswordHasher {
  async hash(pw: string) {
    return `plain:${pw}`;
  }
  async verify(pw: string, hashed: string) {
    return hashed === `plain:${pw}`;
  }
}

export interface SeedInput {
  employees?: Employee[];
  assignments?: Assignment[];
  exposures?: ExposureRecord[];
  medicines?: Medicine[];
  visits?: SymptomVisit[];
  programs?: HealthProgram[];
  enrollments?: Enrollment[];
  checkups?: HealthCheckup[];
  departments?: Department[];
  labItems?: LabItem[];
  labGroups?: LabGroup[];
  checkupTypes?: CheckupTypeItem[];
  movements?: InventoryMovement[];
  departmentHazards?: DepartmentHazard[];
  workMeasurements?: WorkplaceMeasurement[];
}

export interface TestRepos {
  employees: InMemoryEmployeeRepository;
  assignments: InMemoryAssignmentRepository;
  exposures: InMemoryExposureRepository;
  medicines: InMemoryMedicineRepository;
  visits: InMemorySymptomVisitRepository;
  programs: InMemoryProgramRepository;
  enrollments: InMemoryEnrollmentRepository;
  checkups: InMemoryHealthCheckupRepository;
  departments: InMemoryDepartmentRepository;
  labItems: InMemoryLabItemRepository;
  labGroups: InMemoryLabGroupRepository;
  checkupTypes: InMemoryCheckupTypeRepository;
  movements: InMemoryInventoryMovementRepository;
  departmentHazards: InMemoryDepartmentHazardRepository;
  workMeasurements: InMemoryWorkplaceMeasurementRepository;
}

export interface TestContext {
  services: AppServices;
  repos: TestRepos;
  clock: FixedClock;
  ids: SeqIdGenerator;
}

/**
 * 테스트용 합성 루트 — 실제 createAppServices와 동일한 구조를,
 * 인메모리 저장소 + 고정 시계 + 순번 ID로 갈아끼운 버전.
 * 이것이 "테스트 하네스"의 중심이다.
 */
export function buildTestServices(
  seed: SeedInput = {},
  options: { today?: ISODate } = {},
): TestContext {
  const clock = new FixedClock(options.today ?? '2026-06-02');
  const ids = new SeqIdGenerator();

  const repos: TestRepos = {
    employees: new InMemoryEmployeeRepository(seed.employees),
    assignments: new InMemoryAssignmentRepository(seed.assignments),
    exposures: new InMemoryExposureRepository(seed.exposures),
    medicines: new InMemoryMedicineRepository(seed.medicines),
    visits: new InMemorySymptomVisitRepository(seed.visits),
    programs: new InMemoryProgramRepository(seed.programs),
    enrollments: new InMemoryEnrollmentRepository(seed.enrollments),
    checkups: new InMemoryHealthCheckupRepository(seed.checkups),
    departments: new InMemoryDepartmentRepository(seed.departments),
    labItems: new InMemoryLabItemRepository(seed.labItems),
    labGroups: new InMemoryLabGroupRepository(seed.labGroups),
    checkupTypes: new InMemoryCheckupTypeRepository(seed.checkupTypes),
    movements: new InMemoryInventoryMovementRepository(seed.movements),
    departmentHazards: new InMemoryDepartmentHazardRepository(seed.departmentHazards),
    workMeasurements: new InMemoryWorkplaceMeasurementRepository(seed.workMeasurements),
  };
  const catalogProvider = new StaticHazardCatalogProvider();
  const healthProvider = new StaticHazardHealthProvider();

  const employeeService = new EmployeeService(repos.employees, ids);
  const symptomService = new SymptomService(repos.visits, repos.medicines, repos.movements, clock, ids);
  const hazardService = new HazardExposureService(
    catalogProvider,
    repos.exposures,
    repos.employees,
    clock,
    ids,
    healthProvider,
    repos.departmentHazards,
  );
  const checkupService = new HealthCheckupService(repos.checkups, ids);

  const services: AppServices = {
    auth: new AuthService(new InMemoryAccountRepository(), repos.employees, new PlainTextHasher(), ids),
    employees: employeeService,
    hazard: hazardService,
    symptom: symptomService,
    program: new ProgramService(repos.programs, repos.enrollments, clock, ids),
    checkup: checkupService,
    profile: new EmployeeProfileService(employeeService, symptomService, hazardService, checkupService),
    assignments: new AssignmentService(
      repos.assignments,
      repos.employees,
      repos.exposures,
      repos.departmentHazards,
      clock,
      ids,
    ),
    departments: new DepartmentService(repos.departments, repos.employees, ids),
    labItems: new LabItemService(repos.labItems, ids),
    labGroups: new LabGroupService(repos.labGroups, repos.labItems, ids),
    checkupTypes: new CheckupTypeService(repos.checkupTypes, repos.checkups, ids),
    statistics: new StatisticsService(
      repos.employees,
      repos.checkups,
      repos.visits,
      repos.movements,
      repos.exposures,
      catalogProvider,
      repos.programs,
      repos.enrollments,
      clock,
    ),
    measurement: new WorkplaceMeasurementService(
      repos.workMeasurements,
      new InMemoryMeasurementRoundRepository(),
      new InMemoryMeasurementDocumentRepository(),
      new InMemoryFileStore(),
      ids,
      clock,
    ),
  };

  return { services, repos, clock, ids };
}
