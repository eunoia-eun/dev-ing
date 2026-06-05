import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { aCheckup, aSymptomVisit, anEmployee, anExposureRecord } from '@test/harness/builders';

describe('HealthCheckupService', () => {
  it('추가하고 최신 검진일 순으로 조회한다', async () => {
    const { services } = buildTestServices({ employees: [anEmployee({ id: 'emp-1' })] });
    await services.checkup.add({ employeeId: 'emp-1', type: 'general', examDate: '2025-01-01', grade: 'A' });
    await services.checkup.add({ employeeId: 'emp-1', type: 'special', examDate: '2026-01-01', grade: 'C1' });
    const list = await services.checkup.listByEmployee('emp-1');
    expect(list.map((c) => c.examDate)).toEqual(['2026-01-01', '2025-01-01']);
  });

  it('수정한다', async () => {
    const { services } = buildTestServices({
      checkups: [aCheckup({ id: 'c1', employeeId: 'emp-1', grade: 'A' })],
    });
    const u = await services.checkup.update('c1', {
      employeeId: 'emp-1',
      type: 'special',
      examDate: '2026-02-02',
      grade: 'D1',
      followUpActions: ['occdisease_referral'],
    });
    expect(u.grade).toBe('D1');
    expect(u.followUpActions).toEqual(['occdisease_referral']);
  });
});

describe('EmployeeProfileService', () => {
  it('임직원의 노출·증상·약물·검진을 한 프로필로 통합한다', async () => {
    const { services } = buildTestServices({
      employees: [anEmployee({ id: 'emp-1', name: '김철수' })],
      exposures: [anExposureRecord({ id: 'x1', employeeId: 'emp-1', substanceName: '톨루엔' })],
      visits: [
        aSymptomVisit({
          id: 'v1',
          employeeId: 'emp-1',
          symptoms: ['두통'],
          dispensedMedicines: [{ medicineId: 'm1', medicineName: '타이레놀', quantity: 2, unit: '정' }],
        }),
      ],
      checkups: [aCheckup({ id: 'c1', employeeId: 'emp-1', grade: 'C1', examDate: '2026-05-20' })],
    });
    const p = await services.profile.getProfile('emp-1');
    expect(p.employee.name).toBe('김철수');
    expect(p.exposures).toHaveLength(1);
    expect(p.recentSymptoms).toContain('두통');
    expect(p.recentMedications).toContain('타이레놀');
    expect(p.latestCheckup?.grade).toBe('C1');
  });

  it('존재하지 않는 임직원은 예외', async () => {
    const { services } = buildTestServices();
    await expect(services.profile.getProfile('nope')).rejects.toThrow();
  });
});
