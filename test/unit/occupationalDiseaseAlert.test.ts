import { describe, it, expect } from 'vitest';
import { detectOccupationalDiseaseAlerts } from '@domain/hazard/occupationalDiseaseAlert';
import type { HealthCheckup } from '@domain/checkup/HealthCheckup';
import type { ExposureRecord } from '@domain/hazard/ExposureAssessment';

function checkup(partial: Partial<HealthCheckup> & { grade: HealthCheckup['grade']; examDate: string }): HealthCheckup {
  return { id: 'c1', employeeId: 'e1', type: 'general', ...partial } as HealthCheckup;
}

function exposure(partial: Partial<ExposureRecord> = {}): ExposureRecord {
  return {
    id: 'exp1', employeeId: 'e1',
    categoryCode: 'CHEM_METAL', substanceNo: 1,
    substanceName: '납', startDate: '2025-01-01',
    ...partial,
  } as ExposureRecord;
}

describe('detectOccupationalDiseaseAlerts', () => {
  it('검진 없으면 빈 배열', () => {
    expect(detectOccupationalDiseaseAlerts([], [exposure()])).toEqual([]);
  });

  it('활성 노출 없으면 빈 배열', () => {
    expect(detectOccupationalDiseaseAlerts([checkup({ grade: 'D1', examDate: '2026-01-01' })], [])).toEqual([]);
  });

  it('최근 검진 A이면 빈 배열 (정상 판정이 우선)', () => {
    const checks = [
      checkup({ grade: 'D2', examDate: '2025-06-01' }),
      checkup({ grade: 'A',  examDate: '2026-01-01' }),
    ];
    expect(detectOccupationalDiseaseAlerts(checks, [exposure()])).toEqual([]);
  });

  it('최근 검진 D2 + 활성 노출 2건 → 2개 알림', () => {
    const alerts = detectOccupationalDiseaseAlerts(
      [checkup({ grade: 'D2', examDate: '2026-03-01' })],
      [exposure({ id: 'e1', substanceName: '벤젠' }), exposure({ id: 'e2', substanceName: '톨루엔', substanceNo: 2 })],
    );
    expect(alerts).toHaveLength(2);
    expect(alerts[0].grade).toBe('D2');
    expect(alerts[0].checkupDate).toBe('2026-03-01');
    expect(alerts[1].substanceName).toBe('톨루엔');
  });

  it('최근 검진 D1 → grade D1로 알림', () => {
    const [alert] = detectOccupationalDiseaseAlerts(
      [checkup({ grade: 'D1', examDate: '2026-01-01' })],
      [exposure()],
    );
    expect(alert.grade).toBe('D1');
  });

  it('최근 검진 C1 → grade C1로 알림', () => {
    const [alert] = detectOccupationalDiseaseAlerts(
      [checkup({ grade: 'C1', examDate: '2026-01-01' })],
      [exposure()],
    );
    expect(alert.grade).toBe('C1');
  });

  it('opinion이 있으면 알림에 포함', () => {
    const [alert] = detectOccupationalDiseaseAlerts(
      [checkup({ grade: 'D2', examDate: '2026-01-01', opinion: '간기능 이상' })],
      [exposure()],
    );
    expect(alert.opinion).toBe('간기능 이상');
  });

  it('substanceCode는 categoryCode-substanceNo 형식', () => {
    const [alert] = detectOccupationalDiseaseAlerts(
      [checkup({ grade: 'D1', examDate: '2026-01-01' })],
      [exposure({ categoryCode: 'CHEM_METAL', substanceNo: 5 })],
    );
    expect(alert.substanceCode).toBe('CHEM_METAL-5');
  });
});
