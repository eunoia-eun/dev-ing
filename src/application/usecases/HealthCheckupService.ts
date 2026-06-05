import type { EmployeeId } from '@domain/employee/Employee';
import type {
  CheckupType,
  FollowUpAction,
  HealthCheckup,
  HealthGrade,
  LabResult,
  WorkFitness,
} from '@domain/checkup/HealthCheckup';
import { compareDates } from '@domain/shared/date';
import type { Id, ISODate } from '@domain/shared/types';
import type { HealthCheckupRepository } from '../ports/HealthCheckupRepository';
import type { IdGenerator } from '../ports/system';

export interface CheckupInput {
  employeeId: EmployeeId;
  type: CheckupType;
  examDate: ISODate;
  institution?: string;
  targetHazards?: string[];
  grade: HealthGrade;
  workFitness?: WorkFitness;
  followUpActions?: FollowUpAction[];
  opinion?: string;
  nextExamDate?: ISODate;
  labResults?: LabResult[];
  managedBy?: string;
}

/** 건강검진 기록(사후관리소견서) 관리 */
export class HealthCheckupService {
  constructor(
    private readonly checkups: HealthCheckupRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** 최신 검진일 순 */
  async listByEmployee(employeeId: EmployeeId): Promise<HealthCheckup[]> {
    const list = await this.checkups.listByEmployee(employeeId);
    return list.sort((a, b) => compareDates(b.examDate, a.examDate));
  }

  async add(input: CheckupInput): Promise<HealthCheckup> {
    const checkup: HealthCheckup = { id: this.ids.next(), ...input };
    await this.checkups.save(checkup);
    return checkup;
  }

  async update(id: Id, input: CheckupInput): Promise<HealthCheckup> {
    const existing = await this.checkups.getById(id);
    if (!existing) throw new Error('검진 기록을 찾을 수 없습니다.');
    const updated: HealthCheckup = { ...existing, ...input };
    await this.checkups.save(updated);
    return updated;
  }

  async remove(id: Id): Promise<void> {
    await this.checkups.remove(id);
  }
}
