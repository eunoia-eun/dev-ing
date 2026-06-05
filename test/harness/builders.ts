import type { Employee } from '@domain/employee/Employee';
import type { Assignment } from '@domain/employee/Assignment';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';
import type { Medicine } from '@domain/symptom/Medicine';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { Enrollment, HealthProgram } from '@domain/program/HealthProgram';
import type { HealthCheckup } from '@domain/checkup/HealthCheckup';
import type { Department } from '@domain/department/Department';
import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';

/**
 * 테스트 데이터 빌더.
 * 합리적인 기본값을 주고, 테스트에서 관심 있는 필드만 override 하도록 한다.
 */

export function anEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-test',
    employeeNumber: '0000-0000',
    name: '홍길동',
    department: '테스트팀',
    jobTitle: '테스트 업무',
    hireDate: '2020-01-01',
    active: true,
    ...overrides,
  };
}

export function anExposureRecord(overrides: Partial<ExposureRecord> = {}): ExposureRecord {
  return {
    id: 'exp-test',
    employeeId: 'emp-test',
    categoryCode: 'CHEM_ORGANIC',
    substanceNo: 91, // 톨루엔
    substanceName: '톨루엔',
    startDate: '2020-01-01',
    ...overrides,
  };
}

export function aMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: 'med-test',
    name: '테스트약',
    category: '진통제',
    unit: '정',
    stock: 10,
    lowStockThreshold: 3,
    ...overrides,
  };
}

export function aSymptomVisit(overrides: Partial<SymptomVisit> = {}): SymptomVisit {
  return {
    id: 'vis-test',
    employeeId: 'emp-test',
    visitedAt: '2026-06-02T09:00:00.000Z',
    symptoms: ['두통'],
    severity: 'mild',
    dispensedMedicines: [],
    managedBy: '보건관리자',
    ...overrides,
  };
}

export function aProgram(overrides: Partial<HealthProgram> = {}): HealthProgram {
  return {
    id: 'prog-test',
    title: '테스트 프로그램',
    description: '설명',
    category: '운동',
    capacity: 2,
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    status: 'recruiting',
    ...overrides,
  };
}

export function anEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: 'enr-test',
    programId: 'prog-test',
    employeeId: 'emp-test',
    status: 'enrolled',
    appliedAt: '2026-06-01',
    ...overrides,
  };
}

export function aDepartment(overrides: Partial<Department> = {}): Department {
  return { id: 'dept-test', name: '테스트팀', ...overrides };
}

export function anAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'asg-test',
    employeeId: 'emp-test',
    department: '테스트팀',
    jobTitle: '테스트 업무',
    startDate: '2020-01-01',
    ...overrides,
  };
}

export function aDepartmentHazard(overrides: Partial<DepartmentHazard> = {}): DepartmentHazard {
  return {
    id: 'dh-test',
    department: '테스트팀',
    categoryCode: 'CHEM_ORGANIC',
    substanceNo: 91, // 톨루엔
    substanceName: '톨루엔',
    ...overrides,
  };
}

export function aCheckup(overrides: Partial<HealthCheckup> = {}): HealthCheckup {
  return {
    id: 'chk-test',
    employeeId: 'emp-test',
    type: 'general',
    examDate: '2026-01-15',
    grade: 'A',
    ...overrides,
  };
}
