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

import { StaticHazardCatalogProvider } from '@infrastructure/seed/hazardCatalog';
import { StaticHazardHealthProvider } from '@infrastructure/seed/hazardHealthDetails';
import { SystemClock } from '@infrastructure/system/SystemClock';
import { UuidIdGenerator } from '@infrastructure/system/UuidIdGenerator';
import { WebCryptoHasher } from '@infrastructure/system/WebCryptoHasher';
import { LocalStorageAccountRepository } from '@infrastructure/repositories/LocalStorageAccountRepository';
import {
  LocalAssignmentRepository,
  LocalWorkplaceMeasurementRepository,
  LocalDepartmentRepository,
  LocalDepartmentHazardRepository,
  LocalLabItemRepository,
  LocalLabGroupRepository,
  LocalCheckupTypeRepository,
  LocalEmployeeRepository,
  LocalEnrollmentRepository,
  LocalExposureRepository,
  LocalHealthCheckupRepository,
  LocalMedicineRepository,
  LocalProgramRepository,
  LocalSymptomVisitRepository,
  LocalInventoryMovementRepository,
} from '@infrastructure/repositories/localStorageRepositories';

/**
 * 애플리케이션이 화면에 노출하는 서비스 묶음.
 * UI는 이 인터페이스에만 의존하고, 어떤 저장소/시계를 쓰는지는 모른다.
 */
export interface AppServices {
  auth: AuthService;
  employees: EmployeeService;
  hazard: HazardExposureService;
  symptom: SymptomService;
  program: ProgramService;
  checkup: HealthCheckupService;
  profile: EmployeeProfileService;
  assignments: AssignmentService;
  departments: DepartmentService;
  labItems: LabItemService;
  labGroups: LabGroupService;
  checkupTypes: CheckupTypeService;
  statistics: StatisticsService;
  measurement: WorkplaceMeasurementService;
}

/**
 * 합성 루트 — 의존성을 한곳에서 조립한다.
 * 저장소를 실제 백엔드로 바꾸려면 여기서 주입하는 구현만 교체하면 된다.
 */
export function createAppServices(): AppServices {
  const clock = new SystemClock();
  const ids = new UuidIdGenerator();

  const employeeRepo = new LocalEmployeeRepository();
  const assignmentRepo = new LocalAssignmentRepository();
  const exposureRepo = new LocalExposureRepository();
  const medicineRepo = new LocalMedicineRepository();
  const visitRepo = new LocalSymptomVisitRepository();
  const programRepo = new LocalProgramRepository();
  const enrollmentRepo = new LocalEnrollmentRepository();
  const movementRepo = new LocalInventoryMovementRepository();
  const checkupRepo = new LocalHealthCheckupRepository();
  const departmentRepo = new LocalDepartmentRepository();
  const departmentHazardRepo = new LocalDepartmentHazardRepository();
  const labItemRepo = new LocalLabItemRepository();
  const labGroupRepo = new LocalLabGroupRepository();
  const checkupTypeRepo = new LocalCheckupTypeRepository();
  const catalogProvider = new StaticHazardCatalogProvider();
  const healthProvider = new StaticHazardHealthProvider();
  const accountRepo = new LocalStorageAccountRepository();
  const hasher = new WebCryptoHasher();
  const workMeasurementRepo = new LocalWorkplaceMeasurementRepository();

  const employees = new EmployeeService(employeeRepo, ids);
  const symptom = new SymptomService(visitRepo, medicineRepo, movementRepo, clock, ids);
  const hazard = new HazardExposureService(
    catalogProvider,
    exposureRepo,
    employeeRepo,
    clock,
    ids,
    healthProvider,
    departmentHazardRepo,
  );
  const checkup = new HealthCheckupService(checkupRepo, ids);

  return {
    auth: new AuthService(accountRepo, employeeRepo, hasher, ids),
    employees,
    hazard,
    symptom,
    program: new ProgramService(programRepo, enrollmentRepo, clock, ids),
    checkup,
    profile: new EmployeeProfileService(employees, symptom, hazard, checkup),
    assignments: new AssignmentService(
      assignmentRepo,
      employeeRepo,
      exposureRepo,
      departmentHazardRepo,
      clock,
      ids,
    ),
    departments: new DepartmentService(departmentRepo, employeeRepo, ids),
    labItems: new LabItemService(labItemRepo, ids),
    labGroups: new LabGroupService(labGroupRepo, labItemRepo, ids),
    checkupTypes: new CheckupTypeService(checkupTypeRepo, checkupRepo, ids),
    statistics: new StatisticsService(
      employeeRepo,
      checkupRepo,
      visitRepo,
      movementRepo,
      exposureRepo,
      catalogProvider,
      programRepo,
      enrollmentRepo,
      clock,
    ),
    measurement: new WorkplaceMeasurementService(workMeasurementRepo, ids),
  };
}
