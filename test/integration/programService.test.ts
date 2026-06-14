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

describe('ProgramService 추가/삭제/기간조회', () => {
  it('createProgram으로 새 프로그램을 추가한다', async () => {
    const { services, repos } = buildTestServices({});
    const created = await services.program.createProgram({
      title: '새 프로그램',
      description: '설명',
      category: '영양',
      capacity: 5,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      status: 'recruiting',
    });
    expect(created.id).toBeTruthy();
    const all = await repos.programs.list();
    expect(all.find((p) => p.id === created.id)?.title).toBe('새 프로그램');
  });

  it('updateProgram으로 모집 중인 프로그램의 정보를 수정한다', async () => {
    const { services, repos } = buildTestServices({
      programs: [aProgram({ id: 'p1', status: 'recruiting' })],
    });

    const updated = await services.program.updateProgram('p1', {
      title: '수정된 제목',
      description: '수정된 설명',
      category: '영양',
      capacity: 10,
      startDate: '2026-02-01',
      endDate: '2026-03-31',
      status: 'ongoing',
    });

    expect(updated.title).toBe('수정된 제목');
    const saved = await repos.programs.getById('p1');
    expect(saved).toEqual(updated);
  });

  it('종료된 프로그램은 updateProgram으로 수정할 수 없다', async () => {
    const { services } = buildTestServices({
      programs: [aProgram({ id: 'p1', status: 'closed' })],
    });

    await expect(
      services.program.updateProgram('p1', {
        title: '수정 시도',
        description: '',
        category: '영양',
        capacity: 10,
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        status: 'closed',
      }),
    ).rejects.toThrow();
  });

  it('removeProgram은 프로그램과 신청 기록을 함께 삭제한다', async () => {
    const { services, repos } = buildTestServices({
      programs: [aProgram({ id: 'p1', capacity: 2 })],
    });
    await services.program.apply('p1', 'emp-1');

    await services.program.removeProgram('p1');

    expect(await repos.programs.getById('p1')).toBeNull();
    expect(await repos.enrollments.listByProgram('p1')).toHaveLength(0);
  });

  it('getAllSummaries(range)는 운영기간이 겹치는 프로그램만 반환한다', async () => {
    const { services } = buildTestServices({
      programs: [
        aProgram({ id: 'p-this-year', startDate: '2026-06-01', endDate: '2026-08-31' }),
        aProgram({ id: 'p-last-year', startDate: '2025-01-01', endDate: '2025-12-31' }),
      ],
    });

    const result = await services.program.getAllSummaries({ start: '2026-01-01', end: '2026-12-31' });

    expect(result.map((r) => r.program.id)).toEqual(['p-this-year']);
  });

  it('getAllSummaries()는 range 없으면 전체를 반환한다', async () => {
    const { services } = buildTestServices({
      programs: [
        aProgram({ id: 'p-this-year', startDate: '2026-06-01', endDate: '2026-08-31' }),
        aProgram({ id: 'p-last-year', startDate: '2025-01-01', endDate: '2025-12-31' }),
      ],
    });

    const result = await services.program.getAllSummaries();

    expect(result.map((r) => r.program.id).sort()).toEqual(['p-last-year', 'p-this-year']);
  });
});
