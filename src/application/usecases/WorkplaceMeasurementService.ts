import type { WorkplaceMeasurement, MeasurementAssessment } from '@domain/measurement/WorkplaceMeasurement';
import { assessMeasurement } from '@domain/measurement/WorkplaceMeasurement';
import type { WorkplaceMeasurementRepository } from '@application/ports/WorkplaceMeasurementRepository';
import type { IdGenerator } from '@application/ports/system';

export class WorkplaceMeasurementService {
  constructor(
    private readonly repo: WorkplaceMeasurementRepository,
    private readonly ids: IdGenerator,
  ) {}

  async add(dto: Omit<WorkplaceMeasurement, 'id'>): Promise<WorkplaceMeasurement> {
    if (!dto.department.trim()) throw new Error('부서를 입력해 주세요.');
    if (!dto.substanceCode) throw new Error('유해인자를 선택해 주세요.');
    if (dto.twa === undefined && dto.stel === undefined) {
      throw new Error('TWA 또는 STEL 측정값을 하나 이상 입력해 주세요.');
    }
    const m: WorkplaceMeasurement = { ...dto, id: this.ids.next() };
    await this.repo.save(m);
    return m;
  }

  async list(department?: string): Promise<MeasurementAssessment[]> {
    const all = await this.repo.list();
    const filtered = department ? all.filter((m) => m.department === department) : all;
    filtered.sort((a, b) => b.measureDate.localeCompare(a.measureDate));
    return filtered.map(assessMeasurement);
  }

  async remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }

  /** 부서별 최신 측정 결과 요약 (대시보드·보고용) */
  async getSummaryByDepartment(): Promise<
    Array<{ department: string; exceeded: number; warning: number; total: number }>
  > {
    const all = await this.list();
    const map = new Map<string, { exceeded: number; warning: number; total: number }>();
    for (const a of all) {
      const dept = a.measurement.department;
      const entry = map.get(dept) ?? { exceeded: 0, warning: 0, total: 0 };
      entry.total++;
      if (a.overallStatus === 'exceeded') entry.exceeded++;
      else if (a.overallStatus === 'warning') entry.warning++;
      map.set(dept, entry);
    }
    return Array.from(map.entries())
      .map(([department, stats]) => ({ department, ...stats }))
      .sort((a, b) => b.exceeded - a.exceeded || b.warning - a.warning);
  }
}
