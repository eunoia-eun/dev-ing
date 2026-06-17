import type { WorkplaceMeasurement, MeasurementAssessment } from '@domain/measurement/WorkplaceMeasurement';
import { assessMeasurement } from '@domain/measurement/WorkplaceMeasurement';
import type { MeasurementRound, MeasurementDocument } from '@domain/measurement/MeasurementRound';
import type { WorkplaceMeasurementRepository } from '@application/ports/WorkplaceMeasurementRepository';
import type {
  MeasurementRoundRepository,
  MeasurementDocumentRepository,
  FileStore,
} from '@application/ports/MeasurementRoundRepository';
import type { IdGenerator, Clock } from '@application/ports/system';

export class WorkplaceMeasurementService {
  constructor(
    private readonly repo: WorkplaceMeasurementRepository,
    private readonly roundRepo: MeasurementRoundRepository,
    private readonly docRepo: MeasurementDocumentRepository,
    private readonly fileStore: FileStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  // ── 측정 결과 ────────────────────────────────────────────────

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

  /** roundId === null → roundId 없는 미분류 측정 */
  async listByRound(roundId: string | null, department?: string): Promise<MeasurementAssessment[]> {
    const all = await this.repo.list();
    const filtered = all.filter((m) => {
      const matchRound = roundId === null ? !m.roundId : m.roundId === roundId;
      const matchDept = !department || m.department === department;
      return matchRound && matchDept;
    });
    filtered.sort((a, b) => b.measureDate.localeCompare(a.measureDate));
    return filtered.map(assessMeasurement);
  }

  async update(id: string, patch: Partial<Omit<WorkplaceMeasurement, 'id'>>): Promise<WorkplaceMeasurement> {
    const all = await this.repo.list();
    const existing = all.find((m) => m.id === id);
    if (!existing) throw new Error('측정 결과를 찾을 수 없어요.');
    const updated: WorkplaceMeasurement = { ...existing, ...patch };
    await this.repo.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }

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

  // ── 측정 회차 ────────────────────────────────────────────────

  async addRound(dto: Omit<MeasurementRound, 'id'>): Promise<MeasurementRound> {
    if (!dto.name.trim()) throw new Error('회차명을 입력해 주세요.');
    if (!dto.startDate) throw new Error('측정 시작일을 입력해 주세요.');
    const round: MeasurementRound = { ...dto, id: this.ids.next() };
    await this.roundRepo.save(round);
    return round;
  }

  async listRounds(): Promise<MeasurementRound[]> {
    const all = await this.roundRepo.list();
    return all.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async updateRound(id: string, patch: Partial<Omit<MeasurementRound, 'id'>>): Promise<MeasurementRound> {
    const existing = await this.roundRepo.getById(id);
    if (!existing) throw new Error('회차를 찾을 수 없어요.');
    const updated: MeasurementRound = { ...existing, ...patch };
    await this.roundRepo.save(updated);
    return updated;
  }

  /** 회차 삭제 — 연결된 측정 결과·서류·파일 모두 함께 삭제 */
  async removeRound(id: string): Promise<void> {
    const measurements = await this.repo.list();
    await Promise.all(
      measurements.filter((m) => m.roundId === id).map((m) => this.repo.remove(m.id)),
    );
    const docs = await this.docRepo.listByRound(id);
    await this.fileStore.removeMany(docs.map((d) => d.id));
    await this.docRepo.removeByRound(id);
    await this.roundRepo.remove(id);
  }

  // ── 첨부 서류 ────────────────────────────────────────────────

  async addDocument(
    roundId: string,
    dto: { fileName: string; fileSize: number; mimeType: string; data: ArrayBuffer; label?: string },
  ): Promise<MeasurementDocument> {
    const id = this.ids.next();
    await this.fileStore.save(id, dto.data);
    const doc: MeasurementDocument = {
      id,
      roundId,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType || 'application/octet-stream',
      uploadedAt: this.clock.now(),
      label: dto.label,
    };
    await this.docRepo.save(doc);
    return doc;
  }

  async listDocuments(roundId: string): Promise<MeasurementDocument[]> {
    const docs = await this.docRepo.listByRound(roundId);
    return docs.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  }

  async removeDocument(docId: string): Promise<void> {
    await this.fileStore.remove(docId);
    await this.docRepo.remove(docId);
  }

  async loadFile(docId: string): Promise<{ data: ArrayBuffer; doc: MeasurementDocument } | null> {
    const doc = await this.docRepo.getById(docId);
    if (!doc) return null;
    const data = await this.fileStore.load(docId);
    if (!data) return null;
    return { data, doc };
  }
}
