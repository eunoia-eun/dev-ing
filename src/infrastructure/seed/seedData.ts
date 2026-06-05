import type { Employee } from '@domain/employee/Employee';
import type { Assignment } from '@domain/employee/Assignment';
import type { Department } from '@domain/department/Department';
import type { InventoryMovement } from '@domain/inventory/InventoryMovement';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';
import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';
import type { Medicine } from '@domain/symptom/Medicine';
import type { SymptomVisit } from '@domain/symptom/Symptom';
import type { Enrollment, HealthProgram } from '@domain/program/HealthProgram';
import {
  DEFAULT_CHECKUP_TYPES,
  DEFAULT_LAB_GROUPS,
  DEFAULT_LAB_ITEMS,
  type CheckupTypeItem,
  type HealthCheckup,
  type LabGroup,
  type LabItem,
  type LabResult,
} from '@domain/checkup/HealthCheckup';

/** 검사 항목 카탈로그 시드 (기본 항목을 enabled 상태로, 순서 부여) */
export const seedLabItems: LabItem[] = DEFAULT_LAB_ITEMS.map((d, i) => ({
  ...d,
  id: d.code,
  enabled: true,
  order: i,
}));

export const seedLabGroups: LabGroup[] = DEFAULT_LAB_GROUPS.map((name, i) => ({
  id: `grp_${i}`,
  name,
  order: i,
}));

export const seedCheckupTypes: CheckupTypeItem[] = DEFAULT_CHECKUP_TYPES.map((t) => ({ ...t }));

/** 시드 작성 편의: { 코드: 값 } → LabResult[] (이름·단위는 카탈로그에서) */
function lab(pairs: Record<string, string | number>): LabResult[] {
  return Object.entries(pairs).map(([code, value]) => {
    const def = DEFAULT_LAB_ITEMS.find((d) => d.code === code);
    return { code, name: def?.name ?? code, value: String(value), unit: def?.unit };
  });
}

/**
 * 최초 실행 시 채워지는 예시 데이터.
 * 저장소(localStorage)가 비어 있을 때만 사용된다. (infrastructure/repositories/LocalStorageStore)
 * 실제 운영 시에는 이 시드를 비우거나 실제 명부로 교체하면 된다.
 */

export const seedDepartments: Department[] = [
  { id: 'dept-1', name: '생산1팀', note: '도장·조립 공정' },
  { id: 'dept-2', name: '품질관리팀' },
  { id: 'dept-3', name: '용접반' },
  { id: 'dept-4', name: '운영지원팀' },
  { id: 'dept-5', name: '설비보전팀' },
  { id: 'dept-6', name: '연구소' },
];

export const seedEmployees: Employee[] = [
  { id: 'emp-1', employeeNumber: '2018-0101', name: '김철수', department: '생산1팀', position: '반장', jobTitle: '스프레이 도장', hireDate: '2018-03-02', birthDate: '1978-05-10', gender: 'M', phone: '010-1111-0001', active: true },
  { id: 'emp-2', employeeNumber: '2020-0203', name: '이영희', department: '품질관리팀', position: '주임', jobTitle: '시약 분석', hireDate: '2020-04-01', birthDate: '1990-03-22', gender: 'F', phone: '010-1111-0002', active: true },
  { id: 'emp-3', employeeNumber: '2015-0707', name: '박민준', department: '용접반', position: '기사', jobTitle: '아크 용접', hireDate: '2015-07-07', birthDate: '1969-11-02', gender: 'M', phone: '010-1111-0003', isForeign: true, active: true },
  { id: 'emp-4', employeeNumber: '2021-0305', name: '정수진', department: '운영지원팀', position: '사원', jobTitle: '야간 설비 모니터링', hireDate: '2021-03-05', birthDate: '1995-07-18', gender: 'F', phone: '010-1111-0004', active: true },
  { id: 'emp-5', employeeNumber: '2019-1102', name: '최동훈', department: '설비보전팀', position: '대리', jobTitle: '설비 정비(소음·진동)', hireDate: '2019-11-02', birthDate: '1972-01-30', gender: 'M', phone: '010-1111-0005', active: true },
  { id: 'emp-6', employeeNumber: '2022-0801', name: '한지민', department: '연구소', position: '연구원', jobTitle: '유기용제 실험', hireDate: '2022-08-01', birthDate: '2000-09-09', gender: 'F', phone: '010-1111-0006', active: true },
];

// 분류별 기본 주기(별표 23 일반 기준): 화학 first6/cycle12, 분진 first12/cycle24, 물리 first12/cycle24, 야간 first12/cycle12
// department·jobTitle = 노출 당시 부서·업무 스냅샷(임직원 현재 값과 일치시켜 둠)
export const seedExposures: ExposureRecord[] = [
  { id: 'exp-1', employeeId: 'emp-1', categoryCode: 'CHEM_ORGANIC', substanceNo: 91, substanceName: '톨루엔', startDate: '2018-03-02', lastExamDate: '2025-05-20', department: '생산1팀', jobTitle: '스프레이 도장', note: '도장 부스 작업' },
  { id: 'exp-2', employeeId: 'emp-1', categoryCode: 'CHEM_ORGANIC', substanceNo: 85, substanceName: '크실렌', startDate: '2018-03-02', lastExamDate: '2025-11-15', department: '생산1팀', jobTitle: '스프레이 도장' },
  { id: 'exp-3', employeeId: 'emp-2', categoryCode: 'CHEM_ORGANIC', substanceNo: 26, substanceName: '메탄올', startDate: '2020-04-01', lastExamDate: '2025-12-10', department: '품질관리팀', jobTitle: '시약 분석' },
  { id: 'exp-4', employeeId: 'emp-2', categoryCode: 'CHEM_ACID_ALKALI', substanceNo: 8, substanceName: '황산', startDate: '2020-04-01', lastExamDate: '2025-06-01', department: '품질관리팀', jobTitle: '시약 분석' },
  { id: 'exp-5', employeeId: 'emp-3', categoryCode: 'DUST', substanceNo: 5, substanceName: '용접 흄', startDate: '2015-07-07', lastExamDate: '2024-09-01', department: '용접반', jobTitle: '아크 용접' },
  { id: 'exp-6', employeeId: 'emp-3', categoryCode: 'CHEM_METAL', substanceNo: 4, substanceName: '망간 및 그 무기화합물', startDate: '2015-07-07', lastExamDate: '2025-06-15', department: '용접반', jobTitle: '아크 용접' },
  { id: 'exp-7', employeeId: 'emp-4', categoryCode: 'NIGHT_WORK', substanceNo: 1, substanceName: '야간작업(밤 12시~오전 5시 월 4회 이상)', startDate: '2021-03-05', lastExamDate: '2025-05-30', department: '운영지원팀', jobTitle: '야간 설비 모니터링' },
  { id: 'exp-8', employeeId: 'emp-5', categoryCode: 'PHYSICAL', substanceNo: 1, substanceName: '소음', startDate: '2019-11-02', lastExamDate: '2024-12-01', department: '설비보전팀', jobTitle: '설비 정비(소음·진동)' },
  { id: 'exp-9', employeeId: 'emp-5', categoryCode: 'PHYSICAL', substanceNo: 2, substanceName: '진동(진동작업)', startDate: '2019-11-02', lastExamDate: '2024-12-01', department: '설비보전팀', jobTitle: '설비 정비(소음·진동)' },
  { id: 'exp-10', employeeId: 'emp-6', categoryCode: 'CHEM_ORGANIC', substanceNo: 106, substanceName: 'n-헥산', startDate: '2025-12-10', department: '연구소', jobTitle: '유기용제 실험', note: '배치 후 최초 특수검진 예정' },
  { id: 'exp-11', employeeId: 'emp-6', categoryCode: 'CHEM_ORGANIC', substanceNo: 18, substanceName: '디클로로메탄', startDate: '2022-08-01', lastExamDate: '2025-08-20', department: '연구소', jobTitle: '유기용제 실험' },
];

/** 배치(발령) 이력 시드 — 각 임직원 입사일부터 현재까지의 진행 중 배치 1건 */
export const seedAssignments: Assignment[] = [
  { id: 'asg-1', employeeId: 'emp-1', department: '생산1팀', jobTitle: '스프레이 도장', startDate: '2018-03-02' },
  { id: 'asg-2', employeeId: 'emp-2', department: '품질관리팀', jobTitle: '시약 분석', startDate: '2020-04-01' },
  { id: 'asg-3', employeeId: 'emp-3', department: '용접반', jobTitle: '아크 용접', startDate: '2015-07-07' },
  { id: 'asg-4', employeeId: 'emp-4', department: '운영지원팀', jobTitle: '야간 설비 모니터링', startDate: '2021-03-05' },
  { id: 'asg-5', employeeId: 'emp-5', department: '설비보전팀', jobTitle: '설비 정비(소음·진동)', startDate: '2019-11-02' },
  { id: 'asg-6', employeeId: 'emp-6', department: '연구소', jobTitle: '유기용제 실험', startDate: '2022-08-01' },
];

/** 부서(공정)에서 다루는 유해인자 — 직접 매핑 시드. 위 임직원 노출과 대체로 일치시켜 둠 */
export const seedDepartmentHazards: DepartmentHazard[] = [
  { id: 'dh-1', department: '생산1팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 91, substanceName: '톨루엔', process: '스프레이 도장 부스' },
  { id: 'dh-2', department: '생산1팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 85, substanceName: '크실렌', process: '스프레이 도장 부스' },
  { id: 'dh-3', department: '품질관리팀', categoryCode: 'CHEM_ORGANIC', substanceNo: 26, substanceName: '메탄올', process: '시약 분석' },
  { id: 'dh-4', department: '품질관리팀', categoryCode: 'CHEM_ACID_ALKALI', substanceNo: 8, substanceName: '황산', process: '시약 분석·전처리' },
  { id: 'dh-5', department: '용접반', categoryCode: 'DUST', substanceNo: 5, substanceName: '용접 흄', process: '아크 용접' },
  { id: 'dh-6', department: '용접반', categoryCode: 'CHEM_METAL', substanceNo: 4, substanceName: '망간 및 그 무기화합물', process: '아크 용접' },
  { id: 'dh-7', department: '운영지원팀', categoryCode: 'NIGHT_WORK', substanceNo: 1, substanceName: '야간작업(밤 12시~오전 5시 월 4회 이상)', process: '야간 설비 모니터링' },
  { id: 'dh-8', department: '설비보전팀', categoryCode: 'PHYSICAL', substanceNo: 1, substanceName: '소음', process: '설비 정비' },
  { id: 'dh-9', department: '설비보전팀', categoryCode: 'PHYSICAL', substanceNo: 2, substanceName: '진동(진동작업)', process: '설비 정비' },
  { id: 'dh-10', department: '연구소', categoryCode: 'CHEM_ORGANIC', substanceNo: 106, substanceName: 'n-헥산', process: '유기용제 실험' },
  { id: 'dh-11', department: '연구소', categoryCode: 'CHEM_ORGANIC', substanceNo: 18, substanceName: '디클로로메탄', process: '유기용제 실험' },
];

export const seedMedicines: Medicine[] = [
  { id: 'med-1', name: '타이레놀정 500mg', category: '진통·해열제', unit: '정', stock: 48, lowStockThreshold: 10 },
  { id: 'med-2', name: '베아제정', category: '소화제', unit: '정', stock: 8, lowStockThreshold: 10 },
  { id: 'med-3', name: '판콜에이내복액', category: '감기약', unit: '병', stock: 20, lowStockThreshold: 5 },
  { id: 'med-4', name: '마데카솔 연고', category: '외용제', unit: '개', stock: 6, lowStockThreshold: 3 },
  { id: 'med-5', name: '대일밴드', category: '위생용품', unit: '매', stock: 120, lowStockThreshold: 20 },
  { id: 'med-6', name: '겔포스엠', category: '제산제', unit: '포', stock: 14, lowStockThreshold: 10 },
  { id: 'med-7', name: '인공눈물(point)', category: '외용제', unit: '개', stock: 4, lowStockThreshold: 5 },
];

export const seedVisits: SymptomVisit[] = [
  { id: 'vis-1', employeeId: 'emp-1', visitedAt: '2026-05-28T10:15:00.000Z', symptoms: ['두통'], symptomNote: '도장 작업 후 두통 호소', severity: 'mild', bodyTemperature: 36.7, dispensedMedicines: [{ medicineId: 'med-1', medicineName: '타이레놀정 500mg', quantity: 2, unit: '정' }], action: '휴식 후 복귀', managedBy: '보건관리자', hazardFindings: [{ substanceName: '톨루엔', matchedSymptoms: ['두통'], targetOrgans: ['신경계', '호흡기계'] }], log: [{ at: '2026-05-28T10:15:00.000Z', action: 'created', by: '보건관리자' }] },
  { id: 'vis-2', employeeId: 'emp-2', visitedAt: '2026-05-30T14:00:00.000Z', symptoms: ['소화불량', '속쓰림'], severity: 'mild', dispensedMedicines: [{ medicineId: 'med-6', medicineName: '겔포스엠', quantity: 1, unit: '포' }], action: '경과 관찰', managedBy: '보건관리자', log: [{ at: '2026-05-30T14:00:00.000Z', action: 'created', by: '보건관리자' }] },
  { id: 'vis-3', employeeId: 'emp-4', visitedAt: '2026-06-01T07:30:00.000Z', symptoms: ['어지러움', '피로'], symptomNote: '야간근무 후 어지럼증', severity: 'moderate', bodyTemperature: 36.9, bloodPressure: { systolic: 145, diastolic: 95 }, dispensedMedicines: [], action: '안정 취함, 혈압 재측정 권고', managedBy: '보건관리자', log: [{ at: '2026-06-01T07:30:00.000Z', action: 'created', by: '보건관리자' }] },
  { id: 'vis-4', employeeId: 'emp-3', visitedAt: '2026-06-02T09:00:00.000Z', symptoms: ['열상(손가락)'], symptomNote: '작업 중 경미한 베임', severity: 'mild', dispensedMedicines: [{ medicineId: 'med-4', medicineName: '마데카솔 연고', quantity: 1, unit: '개' }, { medicineId: 'med-5', medicineName: '대일밴드', quantity: 2, unit: '매' }], action: '소독·드레싱 후 복귀', managedBy: '보건관리자', log: [{ at: '2026-06-02T09:00:00.000Z', action: 'created', by: '보건관리자' }] },
];

export const seedMovements: InventoryMovement[] = [
  // 초기 입고(반입)
  { id: 'mov-1', at: '2026-05-01T09:00:00.000Z', medicineId: 'med-1', medicineName: '타이레놀정 500mg', unit: '정', type: 'in', quantity: 50, reason: '정기 구매', managedBy: '보건관리자' },
  { id: 'mov-2', at: '2026-05-01T09:00:00.000Z', medicineId: 'med-6', medicineName: '겔포스엠', unit: '포', type: 'in', quantity: 15, reason: '정기 구매', managedBy: '보건관리자' },
  { id: 'mov-3', at: '2026-05-01T09:05:00.000Z', medicineId: 'med-4', medicineName: '마데카솔 연고', unit: '개', type: 'in', quantity: 7, reason: '정기 구매', managedBy: '보건관리자' },
  { id: 'mov-4', at: '2026-05-01T09:05:00.000Z', medicineId: 'med-5', medicineName: '대일밴드', unit: '매', type: 'in', quantity: 120, reason: '정기 구매', managedBy: '보건관리자' },
  // 반출(내원 수령) — 시드 방문 기록과 일치
  { id: 'mov-5', at: '2026-05-28T10:15:00.000Z', medicineId: 'med-1', medicineName: '타이레놀정 500mg', unit: '정', type: 'out', quantity: 2, reason: '내원 수령', employeeId: 'emp-1', managedBy: '보건관리자' },
  { id: 'mov-6', at: '2026-05-30T14:00:00.000Z', medicineId: 'med-6', medicineName: '겔포스엠', unit: '포', type: 'out', quantity: 1, reason: '내원 수령', employeeId: 'emp-2', managedBy: '보건관리자' },
  { id: 'mov-7', at: '2026-06-02T09:00:00.000Z', medicineId: 'med-4', medicineName: '마데카솔 연고', unit: '개', type: 'out', quantity: 1, reason: '내원 수령', employeeId: 'emp-3', managedBy: '보건관리자' },
  { id: 'mov-8', at: '2026-06-02T09:00:00.000Z', medicineId: 'med-5', medicineName: '대일밴드', unit: '매', type: 'out', quantity: 2, reason: '내원 수령', employeeId: 'emp-3', managedBy: '보건관리자' },
];

export const seedPrograms: HealthProgram[] = [
  { id: 'prog-1', title: '금연 클리닉', description: '6주 금연 프로그램 — 상담 및 보조제 지원', category: '금연', capacity: 10, startDate: '2026-05-01', endDate: '2026-07-31', status: 'ongoing' },
  { id: 'prog-2', title: '점심시간 스트레칭', description: '근골격계 질환 예방을 위한 10분 스트레칭', category: '운동', capacity: 20, startDate: '2026-06-01', endDate: '2026-08-31', status: 'recruiting' },
  { id: 'prog-3', title: '스트레스 관리 워크숍', description: '마음챙김 기반 스트레스 완화 4주 과정', category: '스트레스', capacity: 15, startDate: '2026-04-01', endDate: '2026-04-30', status: 'closed' },
  { id: 'prog-4', title: '고혈압 식이 관리', description: '저염식 중심 영양 상담 프로그램', category: '영양', capacity: 8, startDate: '2026-06-15', endDate: '2026-09-15', status: 'recruiting' },
];

export const seedEnrollments: Enrollment[] = [
  { id: 'enr-1', programId: 'prog-1', employeeId: 'emp-1', status: 'enrolled', appliedAt: '2026-04-25', attendanceRate: 80 },
  { id: 'enr-2', programId: 'prog-1', employeeId: 'emp-3', status: 'enrolled', appliedAt: '2026-04-26', attendanceRate: 60 },
  { id: 'enr-3', programId: 'prog-2', employeeId: 'emp-4', status: 'enrolled', appliedAt: '2026-05-29' },
  { id: 'enr-4', programId: 'prog-2', employeeId: 'emp-5', status: 'enrolled', appliedAt: '2026-05-30' },
  { id: 'enr-5', programId: 'prog-3', employeeId: 'emp-2', status: 'completed', appliedAt: '2026-03-28', attendanceRate: 100 },
  { id: 'enr-6', programId: 'prog-3', employeeId: 'emp-6', status: 'completed', appliedAt: '2026-03-29', attendanceRate: 90 },
  { id: 'enr-7', programId: 'prog-4', employeeId: 'emp-2', status: 'enrolled', appliedAt: '2026-06-01' },
];

export const seedCheckups: HealthCheckup[] = [
  // emp-1 김철수 — 5개년 추이(혈당·간수치·콜레스테롤 점진 상승)
  { id: 'chk-7', employeeId: 'emp-1', type: 'general', examDate: '2022-11-05', institution: '○○건강검진센터', grade: 'A', workFitness: 'fit', managedBy: '보건관리자', labResults: lab({ height: 175, weight: 71, bmi: 23.2, waist: 84, sbp: 118, dbp: 76, glucose: 92, tchol: 182, hdl: 52, ldl: 110, tg: 120, ast: 24, alt: 22, ggt: 28, hb: 15.3 }) },
  { id: 'chk-8', employeeId: 'emp-1', type: 'general', examDate: '2023-11-08', institution: '○○건강검진센터', grade: 'A', workFitness: 'fit', managedBy: '보건관리자', labResults: lab({ weight: 72.5, bmi: 23.5, waist: 85, sbp: 122, dbp: 79, glucose: 96, tchol: 193, hdl: 50, ldl: 122, tg: 140, ast: 27, alt: 26, ggt: 34, hb: 15.2 }) },
  { id: 'chk-2', employeeId: 'emp-1', type: 'general', examDate: '2024-11-10', institution: '○○건강검진센터', grade: 'C2', followUpActions: ['lifestyle'], opinion: '경계성 공복혈당. 식이·운동 관리 권고.', managedBy: '보건관리자', labResults: lab({ weight: 74, bmi: 24.2, waist: 88, sbp: 126, dbp: 82, glucose: 101, tchol: 205, hdl: 48, ldl: 131, tg: 165, ast: 30, alt: 33, ggt: 42, hb: 15.1 }) },
  { id: 'chk-1', employeeId: 'emp-1', type: 'special', examDate: '2025-05-20', institution: '○○대학교병원 직업환경의학과', targetHazards: ['톨루엔', '크실렌'], grade: 'C1', workFitness: 'conditional', followUpActions: ['follow_up_test', 'ppe', 'health_education'], opinion: '유기용제 취급 작업. 보호구 착용 철저, 6개월 후 추적검사 권고.', nextExamDate: '2025-11-20', managedBy: '보건관리자', labResults: [...lab({ sbp: 128, dbp: 84, glucose: 104, ggt: 50, ast: 32, alt: 35 }), { code: 'hippuric', name: '소변 마뇨산(톨루엔)', value: '0.9', unit: 'g/g cr' }] },
  // 그 외 임직원
  { id: 'chk-3', employeeId: 'emp-2', type: 'general', examDate: '2025-12-10', institution: '○○건강검진센터', grade: 'C2', followUpActions: ['lifestyle', 'follow_up_test'], opinion: '경계성 고지혈증. 식이·운동 관리 및 추적검사.', nextExamDate: '2026-06-10', managedBy: '보건관리자', labResults: lab({ height: 162, weight: 58, bmi: 22.1, sbp: 124, dbp: 80, glucose: 98, tchol: 245, hdl: 38, ldl: 165, tg: 210, ast: 28, alt: 31, ggt: 26, hb: 13.2 }) },
  { id: 'chk-4', employeeId: 'emp-3', type: 'special', examDate: '2024-09-01', institution: '○○대학교병원 직업환경의학과', targetHazards: ['용접 흄', '망간 및 그 무기화합물'], grade: 'A', workFitness: 'fit', managedBy: '보건관리자', labResults: lab({ sbp: 120, dbp: 78, glucose: 90, ast: 26, alt: 24 }) },
  { id: 'chk-5', employeeId: 'emp-4', type: 'special', examDate: '2025-05-30', institution: '○○산업보건협회', targetHazards: ['야간작업'], grade: 'C2', workFitness: 'conditional', followUpActions: ['lifestyle', 'health_education'], opinion: '야간작업 관련 수면장애 주의. 수면위생 교육 시행.', nextExamDate: '2026-05-30', managedBy: '보건관리자', labResults: lab({ sbp: 130, dbp: 85, glucose: 99, tchol: 198, hb: 12.8 }) },
  { id: 'chk-6', employeeId: 'emp-6', type: 'pre_placement', examDate: '2022-08-01', institution: '○○대학교병원 직업환경의학과', targetHazards: ['n-헥산', '디클로로메탄'], grade: 'A', workFitness: 'fit', opinion: '배치 전 검진. 적합.', managedBy: '보건관리자' },
];

