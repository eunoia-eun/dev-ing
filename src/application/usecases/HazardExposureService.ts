import type { Employee, EmployeeId } from '@domain/employee/Employee';
import {
  assessExposure,
  byUrgency,
  type ExposureAssessment,
  type ExposureRecord,
} from '@domain/hazard/ExposureAssessment';
import {
  findCategory,
  findSubstance,
  searchSubstances,
  type HazardCatalog,
  type HazardCategoryCode,
  type HazardHealthDetail,
  type SubstanceRef,
} from '@domain/hazard/HazardousSubstance';
import {
  checkSymptomHazardRelation,
  type SymptomHazardCheck,
} from '@domain/hazard/symptomMatching';
import type {
  DepartmentHazard,
  DepartmentHazardView,
} from '@domain/hazard/DepartmentHazard';
import type { ISODate } from '@domain/shared/types';
import type { EmployeeRepository } from '../ports/EmployeeRepository';
import type { DepartmentHazardRepository } from '../ports/DepartmentHazardRepository';
import type {
  ExposureRepository,
  HazardCatalogProvider,
  HazardHealthDetailProvider,
} from '../ports/HazardRepository';
import type { Clock, IdGenerator } from '../ports/system';

export interface AddExposureInput {
  employeeId: EmployeeId;
  ref: SubstanceRef;
  startDate: ISODate;
  endDate?: ISODate;
  /** 노출 당시 부서·업무 (생략 시 임직원 현재 값으로 스냅샷) */
  department?: string;
  jobTitle?: string;
  lastExamDate?: ISODate;
  note?: string;
}

/** 노출 + 검진 상태 + 대상 임직원을 묶은 관리자 대시보드용 항목 */
export interface ExposureOverviewItem {
  employee: Employee;
  assessment: ExposureAssessment;
}

export interface ExposureOverview {
  overdueCount: number;
  dueSoonCount: number;
  okCount: number;
  /** 조치가 필요한(초과/임박) 항목을 위급도 순으로 */
  attentionItems: ExposureOverviewItem[];
}

/** 우리 회사가 실제 사용(노출)하는 유해인자 1건 — 노출 기록에서 도출 */
export interface HazardUsageItem {
  categoryCode: HazardCategoryCode;
  substanceNo: number;
  substanceName: string;
  /** 노출 부서 목록 */
  departments: string[];
  /** 노출 임직원 수 */
  employeeCount: number;
}

/**
 * 메뉴 1. 유해물질 노출 확인.
 * [별표 22] 카탈로그를 기준으로 임직원의 노출/특수검진 도래를 관리한다.
 */
export class HazardExposureService {
  constructor(
    private readonly catalogProvider: HazardCatalogProvider,
    private readonly exposures: ExposureRepository,
    private readonly employees: EmployeeRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly healthProvider: HazardHealthDetailProvider,
    private readonly deptHazards: DepartmentHazardRepository,
  ) {}

  getCatalog(): HazardCatalog {
    return this.catalogProvider.getCatalog();
  }

  searchCatalog(query: string) {
    return searchSubstances(this.getCatalog(), query);
  }

  /**
   * 우리 회사가 실제 사용(노출)하는 유해인자 목록.
   * 임직원 노출 기록 + 부서를 묶어 도출한다(노출 임직원 많은 순).
   */
  async getHazardUsage(): Promise<HazardUsageItem[]> {
    const [records, employees] = await Promise.all([
      this.exposures.list(),
      this.employees.list(),
    ]);
    const deptOf = new Map(employees.map((e) => [e.id, e.department]));
    const byKey = new Map<
      string,
      {
        categoryCode: HazardCategoryCode;
        substanceNo: number;
        substanceName: string;
        depts: Set<string>;
        emps: Set<string>;
      }
    >();
    for (const r of records) {
      if (r.endDate) continue; // 종료된 노출은 '현재 사용'에서 제외
      const key = `${r.categoryCode}-${r.substanceNo}`;
      const entry =
        byKey.get(key) ??
        {
          categoryCode: r.categoryCode as HazardCategoryCode,
          substanceNo: r.substanceNo,
          substanceName: r.substanceName,
          depts: new Set<string>(),
          emps: new Set<string>(),
        };
      const dept = deptOf.get(r.employeeId);
      if (dept) entry.depts.add(dept);
      entry.emps.add(r.employeeId);
      byKey.set(key, entry);
    }
    return [...byKey.values()]
      .map((e) => ({
        categoryCode: e.categoryCode,
        substanceNo: e.substanceNo,
        substanceName: e.substanceName,
        departments: [...e.depts].sort(),
        employeeCount: e.emps.size,
      }))
      .sort((a, b) => b.employeeCount - a.employeeCount);
  }

  // ── 부서↔유해인자 직접 매핑 (공정별 유해인자) ──────────────────────────

  /** 부서별 유해인자 매핑 + 적용 현황(부서 인원 / 노출 등록 인원) */
  async getDepartmentHazards(): Promise<DepartmentHazardView[]> {
    const [mappings, employees, exposures] = await Promise.all([
      this.deptHazards.list(),
      this.employees.list(),
      this.exposures.list(),
    ]);
    return mappings
      .map((m) => {
        const deptEmployees = employees.filter((e) => e.department === m.department);
        const appliedEmployees = deptEmployees
          .filter((e) =>
            exposures.some(
              (x) =>
                x.employeeId === e.id &&
                x.categoryCode === m.categoryCode &&
                x.substanceNo === m.substanceNo &&
                !x.endDate, // 진행 중 노출만 '적용'으로 집계
            ),
          )
          .map((e) => ({ id: e.id, name: e.name }));
        return {
          ...m,
          employeeCount: deptEmployees.length,
          appliedCount: appliedEmployees.length,
          appliedEmployees,
        };
      })
      .sort(
        (a, b) =>
          a.department.localeCompare(b.department) ||
          a.substanceName.localeCompare(b.substanceName),
      );
  }

  /** 부서에 유해인자를 직접 묶는다(카탈로그에서 물질명을 채움, 중복 차단) */
  async linkDepartmentHazard(input: {
    department: string;
    ref: SubstanceRef;
    process?: string;
  }): Promise<DepartmentHazard> {
    const department = input.department.trim();
    if (!department) throw new Error('부서를 선택하세요.');
    const found = findSubstance(this.getCatalog(), input.ref);
    if (!found) throw new Error('카탈로그에서 해당 유해인자를 찾을 수 없습니다.');

    const existing = await this.deptHazards.list();
    const dup = existing.some(
      (m) =>
        m.department === department &&
        m.categoryCode === input.ref.categoryCode &&
        m.substanceNo === input.ref.substanceNo,
    );
    if (dup) throw new Error('이미 이 부서에 묶인 유해인자입니다.');

    const mapping: DepartmentHazard = {
      id: this.ids.next(),
      department,
      categoryCode: input.ref.categoryCode,
      substanceNo: input.ref.substanceNo,
      substanceName: found.substance.nameKo,
      process: input.process?.trim() || undefined,
    };
    await this.deptHazards.save(mapping);
    return mapping;
  }

  /** 부서↔유해인자 매핑 해제 */
  async unlinkDepartmentHazard(id: string): Promise<void> {
    await this.deptHazards.remove(id);
  }

  /**
   * 한 매핑을 그 부서 임직원 전체에게 노출로 일괄 등록한다.
   * 이미 같은 유해인자 노출이 있는 임직원은 건너뛴다(중복 방지).
   * @returns 새로 등록한 인원/건너뛴 인원/대상 인원
   */
  async applyDepartmentHazardToEmployees(
    deptHazardId: string,
    startDate?: ISODate,
  ): Promise<{ created: number; skipped: number; total: number }> {
    const mappings = await this.deptHazards.list();
    const mapping = mappings.find((m) => m.id === deptHazardId);
    if (!mapping) throw new Error('부서 유해인자 매핑을 찾을 수 없습니다.');

    const employees = (await this.employees.list()).filter(
      (e) => e.department === mapping.department,
    );
    const start = startDate ?? this.clock.today();

    let created = 0;
    let skipped = 0;
    for (const employee of employees) {
      const records = await this.exposures.listByEmployee(employee.id);
      const already = records.some(
        (x) => x.categoryCode === mapping.categoryCode && x.substanceNo === mapping.substanceNo,
      );
      if (already) {
        skipped += 1;
        continue;
      }
      await this.exposures.save({
        id: this.ids.next(),
        employeeId: employee.id,
        categoryCode: mapping.categoryCode,
        substanceNo: mapping.substanceNo,
        substanceName: mapping.substanceName,
        startDate: start,
        note: `부서 유해인자 일괄 적용(${mapping.department})`,
      });
      created += 1;
    }
    return { created, skipped, total: employees.length };
  }

  /** 유해인자별 건강장해 상세 (지연 로딩) */
  getHealthDetail(ref: SubstanceRef): Promise<HazardHealthDetail | null> {
    return this.healthProvider.getDetail(ref);
  }

  /**
   * 임직원이 노출된 유해인자의 건강장해와 입력 증상의 관련성을 점검한다.
   * 노출 물질 전체를 반환하되, 관련 가능성이 있는 증상은 matchedSymptoms에 담는다(참고용).
   */
  async checkSymptomRelations(
    employeeId: EmployeeId,
    symptoms: string[],
  ): Promise<SymptomHazardCheck[]> {
    const records = await this.exposures.listByEmployee(employeeId);
    if (records.length === 0) return [];
    const exposed = await Promise.all(
      records.map(async (r) => {
        const detail = await this.healthProvider.getDetail({
          categoryCode: r.categoryCode as HazardCategoryCode,
          substanceNo: r.substanceNo,
        });
        return {
          substanceName: r.substanceName,
          categoryCode: r.categoryCode as HazardCategoryCode,
          substanceNo: r.substanceNo,
          healthEffects: detail?.healthEffects,
          targetOrgans: detail?.targetOrgans ?? [],
        };
      }),
    );
    return checkSymptomHazardRelation(symptoms, exposed);
  }

  /** 한 임직원의 모든 노출에 대한 검진 상태(위급도 순) */
  async getEmployeeAssessments(employeeId: EmployeeId): Promise<ExposureAssessment[]> {
    const catalog = this.getCatalog();
    const today = this.clock.today();
    const records = await this.exposures.listByEmployee(employeeId);
    return this.toAssessments(records, catalog, today);
  }

  async addExposure(input: AddExposureInput): Promise<ExposureRecord> {
    const catalog = this.getCatalog();
    const found = findSubstance(catalog, input.ref);
    if (!found) {
      throw new Error('카탈로그에서 해당 유해인자를 찾을 수 없습니다.');
    }
    // 노출 당시 부서·업무를 스냅샷(생략 시 임직원 현재 값)
    const employee = await this.employees.getById(input.employeeId);
    const record: ExposureRecord = {
      id: this.ids.next(),
      employeeId: input.employeeId,
      categoryCode: input.ref.categoryCode,
      substanceNo: input.ref.substanceNo,
      substanceName: found.substance.nameKo,
      startDate: input.startDate,
      endDate: input.endDate,
      department: input.department ?? employee?.department,
      jobTitle: input.jobTitle ?? employee?.jobTitle,
      lastExamDate: input.lastExamDate,
      note: input.note,
    };
    await this.exposures.save(record);
    return record;
  }

  /** 노출 종료(과거 이력으로 보존) — 업무 변경 등으로 더 이상 노출되지 않을 때 */
  async endExposure(exposureId: string, endDate: ISODate): Promise<ExposureRecord> {
    const record = await this.exposures.getById(exposureId);
    if (!record) throw new Error('노출 기록을 찾을 수 없습니다.');
    const updated: ExposureRecord = { ...record, endDate };
    await this.exposures.save(updated);
    return updated;
  }

  /** 특수건강진단 실시 기록 — 최근 검진일을 갱신해 다음 주기를 다시 계산하게 한다 */
  async recordExam(exposureId: string, examDate: ISODate): Promise<ExposureRecord> {
    const record = await this.exposures.getById(exposureId);
    if (!record) throw new Error('노출 기록을 찾을 수 없습니다.');
    const updated: ExposureRecord = { ...record, lastExamDate: examDate };
    await this.exposures.save(updated);
    return updated;
  }

  async removeExposure(exposureId: string): Promise<void> {
    await this.exposures.remove(exposureId);
  }

  /** 전 직원 대상 검진 도래 현황(대시보드/메뉴 상단 요약) */
  async getOverview(): Promise<ExposureOverview> {
    const catalog = this.getCatalog();
    const today = this.clock.today();
    const [records, employees] = await Promise.all([
      this.exposures.list(),
      this.employees.list(),
    ]);
    const empById = new Map(employees.map((e) => [e.id, e]));

    let overdueCount = 0;
    let dueSoonCount = 0;
    let okCount = 0;
    const attentionItems: ExposureOverviewItem[] = [];

    for (const assessment of this.toAssessments(records, catalog, today)) {
      // 종료된 노출은 검진 도래 집계에서 제외(이력으로만 보존)
      if (assessment.status === 'ended') continue;
      if (assessment.status === 'overdue') overdueCount += 1;
      else if (assessment.status === 'due-soon') dueSoonCount += 1;
      else okCount += 1;

      if (assessment.status !== 'ok') {
        const employee = empById.get(assessment.record.employeeId);
        if (employee) attentionItems.push({ employee, assessment });
      }
    }

    attentionItems.sort((a, b) => byUrgency(a.assessment, b.assessment));
    return { overdueCount, dueSoonCount, okCount, attentionItems };
  }

  private toAssessments(
    records: ExposureRecord[],
    catalog: HazardCatalog,
    today: ISODate,
  ): ExposureAssessment[] {
    const out: ExposureAssessment[] = [];
    for (const record of records) {
      const category = findCategory(catalog, record.categoryCode as HazardCategoryCode);
      if (!category) continue;
      out.push(assessExposure(record, category, today));
    }
    out.sort(byUrgency);
    return out;
  }
}
