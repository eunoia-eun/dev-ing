import {
  gradeCategory,
  HEALTH_GRADE_LABEL,
  type GradeCategory,
  type HealthGrade,
} from '@domain/checkup/HealthCheckup';
import {
  assessExposure,
  type ExposureStatus,
} from '@domain/hazard/ExposureAssessment';
import { findCategory, type HazardCategoryCode } from '@domain/hazard/HazardousSubstance';
import { summarizeParticipation, type ProgramStatus } from '@domain/program/HealthProgram';
import {
  AGE_BUCKETS,
  ageBucketOf,
  dimensionGroupOrder,
  dimensionKeyOf,
  type AgeBucket,
  type StatDimension,
} from '@domain/stats/Demographics';
import {
  buildMonthlyMatrix,
  monthKey,
  monthsBetween,
  type MonthlyMatrix,
} from '@domain/stats/Statistics';
import type { ISODate } from '@domain/shared/types';
import type { EmployeeRepository } from '../ports/EmployeeRepository';
import type { HealthCheckupRepository } from '../ports/HealthCheckupRepository';
import type { SymptomVisitRepository } from '../ports/SymptomRepository';
import type { InventoryMovementRepository } from '../ports/InventoryMovementRepository';
import type { ExposureRepository, HazardCatalogProvider } from '../ports/HazardRepository';
import type { EnrollmentRepository, ProgramRepository } from '../ports/ProgramRepository';
import type { Clock } from '../ports/system';

export interface CheckupGroupRow extends Record<GradeCategory, number> {
  group: string;
  total: number;
  /** 판정 등급별 인원 (A·C1·C2·CN·D1·D2·R) */
  byGrade: Record<HealthGrade, number>;
}

export interface ManagedEmployee {
  employeeId: string;
  name: string;
  department: string;
  group: string;
  grade: HealthGrade;
  category: GradeCategory;
  examDate: ISODate;
}

export interface CheckupFindingStats {
  year: number | null;
  /** 검진 받은 임직원 수(기준: 차원과 무관) */
  examined: number;
  /** 활성 임직원 중 (해당 기준) 검진 기록 없는 수 */
  notExamined: number;
  byCategory: Record<GradeCategory, number>;
  byGrade: Record<HealthGrade, number>;
  rows: CheckupGroupRow[];
  /** 관리대상자(요관찰·유소견·재검) 명단 — 심각도순 */
  managed: ManagedEmployee[];
}

/** 직업병 관련 소견(C1·D1·D2) 관리대상자 1건 */
export interface OccupationalSubject {
  employeeId: string;
  name: string;
  department: string;
  checkupType: string;
  examDate: ISODate;
  grade: HealthGrade;
  gradeLabel: string;
  opinion?: string;
  activeExposureCount: number;
}

export interface MonthlyActivityStats {
  dimension: StatDimension;
  months: string[];
  /** 상담/내원 건수 */
  visits: MonthlyMatrix;
  /** 약 반출 수량 */
  dispense: MonthlyMatrix;
}

export interface ExposureGroupRow {
  group: string;
  /** 진행 중 노출이 있는 임직원 수 */
  exposed: number;
  /** 그중 특수검진 기한 초과/임박/여유 인원(가장 위급한 상태 기준) */
  overdue: number;
  dueSoon: number;
  ok: number;
}
export interface ExposureCategoryRow {
  categoryCode: HazardCategoryCode;
  categoryName: string;
  employees: number;
  records: number;
}
export interface ExposureStats {
  totalExposed: number;
  overdue: number;
  dueSoon: number;
  rows: ExposureGroupRow[];
  byCategory: ExposureCategoryRow[];
}

export interface ProgramRow {
  programId: string;
  title: string;
  category: string;
  status: ProgramStatus;
  capacity: number;
  occupied: number;
  enrolled: number;
  waitlisted: number;
  completed: number;
  fillRate: number;
  averageAttendanceRate: number | null;
}
export interface ParticipationGroupRow {
  group: string;
  employees: number;
  participants: number;
  rate: number;
}
export interface ProgramStats {
  programs: ProgramRow[];
  participation: ParticipationGroupRow[];
  totalEmployees: number;
  totalParticipants: number;
  overallRate: number;
}

export interface SymptomOption {
  symptom: string;
  count: number;
}

export interface WorkforceSummary {
  total: number;
  gender: { male: number; female: number; unknown: number };
  age: Record<AgeBucket, number>;
  nationality: { domestic: number; foreign: number };
}

const ALL_GRADES: HealthGrade[] = ['A', 'C1', 'C2', 'CN', 'D1', 'D2', 'R'];
const CATEGORY_SEVERITY: Record<GradeCategory, number> = {
  finding: 0,
  recheck: 1,
  watch: 2,
  normal: 3,
};

/**
 * 통계 — 검진 유소견 현황 / 월별 상담·내원·약 반출 현황.
 * 부서별·연령별·성별 차원으로 집계한다(도메인 순수 함수 + 저장소 조합).
 */
export class StatisticsService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly checkups: HealthCheckupRepository,
    private readonly visits: SymptomVisitRepository,
    private readonly movements: InventoryMovementRepository,
    private readonly exposures: ExposureRepository,
    private readonly catalog: HazardCatalogProvider,
    private readonly programs: ProgramRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly clock: Clock,
  ) {}

  /** 인구 현황 — 성별·나이대·국적(외국인) 인원 (활성 임직원 기준) */
  async getWorkforceSummary(): Promise<WorkforceSummary> {
    const today = this.clock.today();
    const active = (await this.employees.list()).filter((e) => e.active);
    const gender = { male: 0, female: 0, unknown: 0 };
    const age = Object.fromEntries(AGE_BUCKETS.map((b) => [b, 0])) as Record<AgeBucket, number>;
    const nationality = { domestic: 0, foreign: 0 };
    for (const e of active) {
      if (e.gender === 'M') gender.male += 1;
      else if (e.gender === 'F') gender.female += 1;
      else gender.unknown += 1;
      age[ageBucketOf(e.birthDate, today)] += 1;
      if (e.isForeign) nationality.foreign += 1;
      else nationality.domestic += 1;
    }
    return { total: active.length, gender, age, nationality };
  }

  /** 검진 기록이 있는 연도 목록(최신순) */
  async getCheckupYears(): Promise<number[]> {
    const checkups = await this.checkups.list();
    const years = new Set<number>();
    for (const c of checkups) {
      const y = Number(c.examDate.slice(0, 4));
      if (y) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }

  /**
   * 검진 유소견 현황. year를 주면 그 해의 최근 검진, 없으면 임직원별 전체 최근 검진 기준.
   */
  async getCheckupFindings(
    dimension: StatDimension,
    year?: number,
  ): Promise<CheckupFindingStats> {
    const today = this.clock.today();
    const [allEmployees, checkups] = await Promise.all([
      this.employees.list(),
      this.checkups.list(),
    ]);
    const active = allEmployees.filter((e) => e.active);

    const byCategory: Record<GradeCategory, number> = { normal: 0, watch: 0, finding: 0, recheck: 0 };
    const byGrade = Object.fromEntries(ALL_GRADES.map((g) => [g, 0])) as Record<HealthGrade, number>;
    const rowMap = new Map<string, CheckupGroupRow>();
    const managed: ManagedEmployee[] = [];
    let examined = 0;

    const groupOrder = dimensionGroupOrder(
      dimension,
      uniqueSorted(active.map((e) => e.department)),
    );
    const emptyGrades = (): Record<HealthGrade, number> =>
      Object.fromEntries(ALL_GRADES.map((g) => [g, 0])) as Record<HealthGrade, number>;
    const ensureRow = (group: string): CheckupGroupRow => {
      let row = rowMap.get(group);
      if (!row) {
        row = { group, total: 0, normal: 0, watch: 0, finding: 0, recheck: 0, byGrade: emptyGrades() };
        rowMap.set(group, row);
      }
      return row;
    };

    for (const employee of active) {
      const latest = latestCheckup(checkups, employee.id, year);
      if (!latest) continue;
      examined += 1;
      const category = gradeCategory(latest.grade);
      const group = dimensionKeyOf(employee, dimension, today);

      byCategory[category] += 1;
      byGrade[latest.grade] += 1;
      const row = ensureRow(group);
      row.total += 1;
      row[category] += 1;
      row.byGrade[latest.grade] += 1;

      if (category !== 'normal') {
        managed.push({
          employeeId: employee.id,
          name: employee.name,
          department: employee.department,
          group,
          grade: latest.grade,
          category,
          examDate: latest.examDate,
        });
      }
    }

    const rows = orderGroups([...rowMap.keys()], groupOrder).map((g) => rowMap.get(g)!);
    managed.sort(
      (a, b) =>
        CATEGORY_SEVERITY[a.category] - CATEGORY_SEVERITY[b.category] ||
        a.department.localeCompare(b.department) ||
        a.name.localeCompare(b.name),
    );

    return {
      year: year ?? null,
      examined,
      notExamined: active.length - examined,
      byCategory,
      byGrade,
      rows,
      managed,
    };
  }

  /** 월별 상담·내원 건수 + 약 반출 수량 (월 × 차원그룹) */
  async getMonthlyActivity(
    dimension: StatDimension,
    startMonth: string,
    endMonth: string,
  ): Promise<MonthlyActivityStats> {
    const today = this.clock.today();
    const months = monthsBetween(startMonth, endMonth);
    const [allEmployees, visits, movements] = await Promise.all([
      this.employees.list(),
      this.visits.list(),
      this.movements.list(),
    ]);
    const empById = new Map(allEmployees.map((e) => [e.id, e] as const));
    const groupOf = (id?: string): string => {
      const e = id ? empById.get(id) : undefined;
      return e ? dimensionKeyOf(e, dimension, today) : '미상';
    };
    const groupOrder = dimensionGroupOrder(
      dimension,
      uniqueSorted(allEmployees.map((e) => e.department)),
    );

    const visitEvents = visits.map((v) => ({
      month: monthKey(v.visitedAt),
      group: groupOf(v.employeeId),
      value: 1,
    }));
    const dispenseEvents = movements
      .filter((m) => m.type === 'out')
      .map((m) => ({
        month: monthKey(m.at),
        group: m.employeeId ? groupOf(m.employeeId) : '기타',
        value: m.quantity,
      }));

    return {
      dimension,
      months,
      visits: buildMonthlyMatrix(visitEvents, months, groupOrder),
      dispense: buildMonthlyMatrix(dispenseEvents, months, groupOrder),
    };
  }

  /** 유해인자 노출자 통계 — 진행 중 노출 기준. 차원별 인원 + 특수검진 상태 + 분류별 노출 인원 */
  async getExposureStats(dimension: StatDimension): Promise<ExposureStats> {
    const today = this.clock.today();
    const catalog = this.catalog.getCatalog();
    const [allEmployees, exposures] = await Promise.all([
      this.employees.list(),
      this.exposures.list(),
    ]);
    const empById = new Map(allEmployees.map((e) => [e.id, e] as const));
    const active = exposures.filter((x) => !x.endDate);

    // 임직원별 가장 위급한 상태
    const worstByEmp = new Map<string, ExposureStatus>();
    // 분류별 집계
    const catAgg = new Map<HazardCategoryCode, { employees: Set<string>; records: number }>();

    for (const x of active) {
      const code = x.categoryCode as HazardCategoryCode;
      const category = findCategory(catalog, code);
      if (!category) continue;
      const status = assessExposure(x, category, today).status;
      const prev = worstByEmp.get(x.employeeId);
      worstByEmp.set(x.employeeId, worst(prev, status));

      const agg = catAgg.get(code) ?? { employees: new Set<string>(), records: 0 };
      agg.employees.add(x.employeeId);
      agg.records += 1;
      catAgg.set(code, agg);
    }

    const groupOrder = dimensionGroupOrder(
      dimension,
      uniqueSorted(allEmployees.filter((e) => e.active).map((e) => e.department)),
    );
    const rowMap = new Map<string, ExposureGroupRow>();
    let overdue = 0;
    let dueSoon = 0;
    for (const [empId, status] of worstByEmp) {
      const emp = empById.get(empId);
      if (!emp) continue;
      const group = dimensionKeyOf(emp, dimension, today);
      const row =
        rowMap.get(group) ?? { group, exposed: 0, overdue: 0, dueSoon: 0, ok: 0 };
      row.exposed += 1;
      if (status === 'overdue') {
        row.overdue += 1;
        overdue += 1;
      } else if (status === 'due-soon') {
        row.dueSoon += 1;
        dueSoon += 1;
      } else {
        row.ok += 1;
      }
      rowMap.set(group, row);
    }

    const byCategory: ExposureCategoryRow[] = [...catAgg.entries()]
      .map(([code, agg]) => ({
        categoryCode: code,
        categoryName: findCategory(catalog, code)?.name ?? code,
        employees: agg.employees.size,
        records: agg.records,
      }))
      .sort((a, b) => b.employees - a.employees);

    return {
      totalExposed: worstByEmp.size,
      overdue,
      dueSoon,
      rows: orderGroups([...rowMap.keys()], groupOrder).map((g) => rowMap.get(g)!),
      byCategory,
    };
  }

  /** 프로그램 참여율 통계 — 프로그램별 충원·참여 + 차원별 참여율 */
  async getProgramStats(dimension: StatDimension): Promise<ProgramStats> {
    const today = this.clock.today();
    const [allEmployees, programs, enrollments] = await Promise.all([
      this.employees.list(),
      this.programs.list(),
      this.enrollments.list(),
    ]);
    const active = allEmployees.filter((e) => e.active);

    const byProgram = new Map<string, typeof enrollments>();
    for (const e of enrollments) {
      const list = byProgram.get(e.programId) ?? [];
      list.push(e);
      byProgram.set(e.programId, list);
    }
    const programRows: ProgramRow[] = programs.map((p) => {
      const s = summarizeParticipation(p, byProgram.get(p.id) ?? []);
      return {
        programId: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        capacity: s.capacity,
        occupied: s.occupied,
        enrolled: s.enrolled,
        waitlisted: s.waitlisted,
        completed: s.completed,
        fillRate: s.fillRate,
        averageAttendanceRate: s.averageAttendanceRate,
      };
    });

    // 참여자 = 취소가 아닌 등록이 1건 이상 있는 임직원
    const participantIds = new Set<string>();
    for (const e of enrollments) {
      if (e.status !== 'cancelled') participantIds.add(e.employeeId);
    }

    const groupOrder = dimensionGroupOrder(dimension, uniqueSorted(active.map((e) => e.department)));
    const partMap = new Map<string, { employees: number; participants: number }>();
    for (const emp of active) {
      const group = dimensionKeyOf(emp, dimension, today);
      const row = partMap.get(group) ?? { employees: 0, participants: 0 };
      row.employees += 1;
      if (participantIds.has(emp.id)) row.participants += 1;
      partMap.set(group, row);
    }
    const participation: ParticipationGroupRow[] = orderGroups(
      [...partMap.keys()],
      groupOrder,
    ).map((g) => {
      const r = partMap.get(g)!;
      return {
        group: g,
        employees: r.employees,
        participants: r.participants,
        rate: r.employees === 0 ? 0 : Math.round((r.participants / r.employees) * 100),
      };
    });

    const totalParticipants = active.filter((e) => participantIds.has(e.id)).length;
    return {
      programs: programRows,
      participation,
      totalEmployees: active.length,
      totalParticipants,
      overallRate: active.length === 0 ? 0 : Math.round((totalParticipants / active.length) * 100),
    };
  }

  /** 기록된 증상 목록(빈도 많은 순) — 증상 추이 선택용 */
  /**
   * 조회 기간 내 C1·D1·D2 소견을 받은 임직원 목록.
   * 같은 임직원이 기간 내 여러 검진을 받은 경우 가장 최근 검진 1건만 반환.
   */
  async getOccupationalSubjects(from: ISODate, to: ISODate): Promise<OccupationalSubject[]> {
    const GRADES: HealthGrade[] = ['C1', 'D1', 'D2'];
    const [allEmployees, allCheckups, allExposures] = await Promise.all([
      this.employees.list(),
      this.checkups.list(),
      this.exposures.list(),
    ]);
    const empById = new Map(allEmployees.map((e) => [e.id, e]));

    // 기간 내 C1/D1/D2 검진만 추림
    const filtered = allCheckups.filter(
      (c) => GRADES.includes(c.grade) && c.examDate >= from && c.examDate <= to,
    );

    // 임직원별 가장 최근 검진 1건
    const latestByEmp = new Map<string, typeof filtered[number]>();
    for (const c of filtered) {
      const prev = latestByEmp.get(c.employeeId);
      if (!prev || c.examDate > prev.examDate) latestByEmp.set(c.employeeId, c);
    }

    // 진행 중 노출 수 집계
    const activeByEmp = new Map<string, number>();
    for (const exp of allExposures) {
      if (!exp.endDate) activeByEmp.set(exp.employeeId, (activeByEmp.get(exp.employeeId) ?? 0) + 1);
    }

    return [...latestByEmp.values()]
      .map((c) => {
        const emp = empById.get(c.employeeId);
        return {
          employeeId: c.employeeId,
          name: emp?.name ?? '(퇴직)',
          department: emp?.department ?? '-',
          checkupType: c.type,
          examDate: c.examDate,
          grade: c.grade,
          gradeLabel: HEALTH_GRADE_LABEL[c.grade],
          opinion: c.opinion,
          activeExposureCount: activeByEmp.get(c.employeeId) ?? 0,
        };
      })
      .sort((a, b) => b.examDate.localeCompare(a.examDate));
  }

  async getSymptomOptions(): Promise<SymptomOption[]> {
    const visits = await this.visits.list();
    const count = new Map<string, number>();
    for (const v of visits) for (const s of v.symptoms) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()]
      .map(([symptom, c]) => ({ symptom, count: c }))
      .sort((a, b) => b.count - a.count || a.symptom.localeCompare(b.symptom));
  }

  /** 특정 증상의 월별 발생 추이 (월 × 차원그룹, 방문 건수) */
  async getSymptomTrend(
    symptom: string,
    startMonth: string,
    endMonth: string,
    dimension: StatDimension,
  ): Promise<MonthlyMatrix> {
    const today = this.clock.today();
    const months = monthsBetween(startMonth, endMonth);
    const [allEmployees, visits] = await Promise.all([this.employees.list(), this.visits.list()]);
    const empById = new Map(allEmployees.map((e) => [e.id, e] as const));
    const groupOf = (id?: string): string => {
      const e = id ? empById.get(id) : undefined;
      return e ? dimensionKeyOf(e, dimension, today) : '미상';
    };
    const groupOrder = dimensionGroupOrder(dimension, uniqueSorted(allEmployees.map((e) => e.department)));

    const events = visits
      .filter((v) => v.symptoms.includes(symptom))
      .map((v) => ({ month: monthKey(v.visitedAt), group: groupOf(v.employeeId), value: 1 }));
    return buildMonthlyMatrix(events, months, groupOrder);
  }
}

const STATUS_RANK: Record<ExposureStatus, number> = { overdue: 0, 'due-soon': 1, ok: 2, ended: 3 };
/** 더 위급한(낮은 rank) 상태를 반환 */
function worst(a: ExposureStatus | undefined, b: ExposureStatus): ExposureStatus {
  if (!a) return b;
  return STATUS_RANK[b] < STATUS_RANK[a] ? b : a;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function orderGroups(seen: string[], order: string[]): string[] {
  const out = order.filter((g) => seen.includes(g));
  for (const g of [...seen].sort()) if (!out.includes(g)) out.push(g);
  return out;
}

/** 임직원의 최근 검진(연도 지정 시 그 해 안에서) */
function latestCheckup(
  checkups: { employeeId: string; examDate: ISODate; grade: HealthGrade }[],
  employeeId: string,
  year?: number,
): { examDate: ISODate; grade: HealthGrade } | null {
  let best: { examDate: ISODate; grade: HealthGrade } | null = null;
  for (const c of checkups) {
    if (c.employeeId !== employeeId) continue;
    if (year != null && Number(c.examDate.slice(0, 4)) !== year) continue;
    if (!best || c.examDate > best.examDate) best = { examDate: c.examDate, grade: c.grade };
  }
  return best;
}
