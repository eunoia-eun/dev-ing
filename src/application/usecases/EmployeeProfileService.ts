import type { Employee, EmployeeId } from '@domain/employee/Employee';
import type { ExposureAssessment } from '@domain/hazard/ExposureAssessment';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { HealthCheckup } from '@domain/checkup/HealthCheckup';
import type { EmployeeService } from './EmployeeService';
import type { SymptomService } from './SymptomService';
import type { HazardExposureService } from './HazardExposureService';
import type { HealthCheckupService } from './HealthCheckupService';

/** 임직원 한 명의 건강관리 현황 통합 프로필 */
export interface EmployeeHealthProfile {
  employee: Employee;
  /** 유해물질 노출 이력 + 특수검진 도래 상태 */
  exposures: ExposureAssessment[];
  /** 최근 방문 기록(증상·수령약물·조치) */
  recentVisits: SymptomVisit[];
  /** 최근 불편 증상(중복 제거) */
  recentSymptoms: string[];
  /** 최근 수령 약물(중복 제거) */
  recentMedications: string[];
  /** 건강검진 결과(사후관리소견) 최신순 */
  checkups: HealthCheckup[];
  latestCheckup?: HealthCheckup;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

/**
 * 여러 서비스를 조합해 임직원별 건강 프로필을 만든다.
 * (집계 전용 — 상태를 갖지 않는다)
 */
export class EmployeeProfileService {
  constructor(
    private readonly employees: EmployeeService,
    private readonly symptoms: SymptomService,
    private readonly hazard: HazardExposureService,
    private readonly checkups: HealthCheckupService,
  ) {}

  async getProfile(employeeId: EmployeeId): Promise<EmployeeHealthProfile> {
    const [employee, visits, exposures, checkups] = await Promise.all([
      this.employees.getById(employeeId),
      this.symptoms.listVisitsByEmployee(employeeId),
      this.hazard.getEmployeeAssessments(employeeId),
      this.checkups.listByEmployee(employeeId),
    ]);
    if (!employee) throw new Error('임직원을 찾을 수 없어요.');

    return {
      employee,
      exposures,
      recentVisits: visits.slice(0, 5),
      recentSymptoms: dedupe(visits.flatMap((v) => v.symptoms)).slice(0, 12),
      recentMedications: dedupe(
        visits.flatMap((v) => v.dispensedMedicines.map((d) => d.medicineName)),
      ).slice(0, 12),
      checkups,
      latestCheckup: checkups[0],
    };
  }
}
