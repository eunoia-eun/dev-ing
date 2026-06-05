import { describe, expect, it } from 'vitest';
import { buildTestServices } from '@test/harness/buildTestServices';
import { aProgram } from '@test/harness/builders';

describe('ProgramService 신청/대기/승급', () => {
  it('정원이 차면 자동으로 대기(waitlisted)가 된다', async () => {
    const { services } = buildTestServices({ programs: [aProgram({ id: 'p1', capacity: 1 })] });
    const first = await services.program.apply('p1', 'emp-1');
    const second = await services.program.apply('p1', 'emp-2');
    expect(first.status).toBe('enrolled');
    expect(second.status).toBe('waitlisted');
  });

  it('중복 신청은 예외', async () => {
    const { services } = buildTestServices({ programs: [aProgram({ id: 'p1', capacity: 5 })] });
    await services.program.apply('p1', 'emp-1');
    await expect(services.program.apply('p1', 'emp-1')).rejects.toThrow();
  });

  it('확정자가 취소하면 가장 먼저 신청한 대기자가 확정으로 승급된다', async () => {
    const { services, repos } = buildTestServices({
      programs: [aProgram({ id: 'p1', capacity: 1 })],
    });
    const first = await services.program.apply('p1', 'emp-1'); // enrolled
    const second = await services.program.apply('p1', 'emp-2'); // waitlisted

    await services.program.cancel(first.id);

    const enrollments = await repos.enrollments.listByProgram('p1');
    const e1 = enrollments.find((e) => e.id === first.id);
    const e2 = enrollments.find((e) => e.id === second.id);
    expect(e1?.status).toBe('cancelled');
    expect(e2?.status).toBe('enrolled'); // 승급됨
  });

  it('종료된 프로그램에는 신청할 수 없다', async () => {
    const { services } = buildTestServices({
      programs: [aProgram({ id: 'p1', status: 'closed' })],
    });
    await expect(services.program.apply('p1', 'emp-1')).rejects.toThrow();
  });

  it('참여 현황 요약(충원율) 계산', async () => {
    const { services } = buildTestServices({ programs: [aProgram({ id: 'p1', capacity: 2 })] });
    await services.program.apply('p1', 'emp-1');
    await services.program.apply('p1', 'emp-2');
    const summary = await services.program.getParticipationSummary('p1');
    expect(summary.occupied).toBe(2);
    expect(summary.fillRate).toBe(100);
  });
});
