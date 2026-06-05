import { useState } from 'react';
import type { Employee } from '@domain/employee/Employee';
import type { HealthProgram, ParticipationSummary } from '@domain/program/HealthProgram';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, ErrorAlert, ProgressBar, Spinner } from '../components/ui';
import { EnrollmentStatusBadge, ProgramStatusBadge } from '../components/StatusBadge';
import { EmployeePicker } from '../components/EmployeePicker';
import { formatDate } from '../format';

export function ProgramPage() {
  const { program, employees } = useServices();
  const summaries = useAsync(() => program.getAllSummaries(), []);
  const emp = useAsync(() => employees.list(), []);

  if (summaries.loading || emp.loading) return <Spinner />;
  if (summaries.error) return <ErrorAlert message={summaries.error} />;

  return (
    <div className="grid grid--2">
      {summaries.data!.map(({ program: p, summary }) => (
        <ProgramCard
          key={p.id}
          program={p}
          summary={summary}
          employees={emp.data ?? []}
          onChanged={summaries.reload}
        />
      ))}
    </div>
  );
}

function ProgramCard({
  program: p,
  summary,
  employees,
  onChanged,
}: {
  program: HealthProgram;
  summary: ParticipationSummary;
  employees: Employee[];
  onChanged: () => void;
}) {
  const { program: programService } = useServices();
  const enrollments = useAsync(() => programService.listEnrollmentsByProgram(p.id), [p.id]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? '(알 수 없음)';

  function refresh() {
    enrollments.reload();
    onChanged();
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy('busy');
    try {
      await fn();
      setBusy(null);
      refresh();
    } catch (e) {
      setBusy(e instanceof Error ? e.message : String(e));
    }
  }

  const enrolledIds = new Set(
    (enrollments.data ?? []).filter((e) => e.status !== 'cancelled').map((e) => e.employeeId),
  );
  const candidates = employees.filter((e) => !enrolledIds.has(e.id));

  return (
    <Card
      title={
        <span className="row" style={{ gap: 8 }}>
          {p.title} <ProgramStatusBadge status={p.status} />
        </span>
      }
    >
      <div className="muted small">{p.description}</div>
      <div className="row spread small" style={{ marginTop: 12 }}>
        <span className="badge badge--muted">{p.category}</span>
        <span className="muted">
          {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
        </span>
      </div>

      <div style={{ margin: '14px 0' }}>
        <div className="row spread small">
          <span>
            정원 {summary.occupied}/{p.capacity}명 · 충원율 {summary.fillRate}%
          </span>
          <span className="muted">
            대기 {summary.waitlisted} · 수료 {summary.completed}
            {summary.averageAttendanceRate !== null && ` · 평균참여 ${summary.averageAttendanceRate}%`}
          </span>
        </div>
        <ProgressBar percent={summary.fillRate} />
      </div>

      {p.status !== 'closed' && (
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <div className="grow">
            <EmployeePicker
              employees={candidates}
              value={pick}
              onChange={setPick}
              placeholder="신청할 임직원 선택"
            />
          </div>
          <button
            className="btn btn--primary btn--sm"
            disabled={!pick || busy === 'busy'}
            onClick={() =>
              run(async () => {
                await programService.apply(p.id, pick);
                setPick('');
              })
            }
          >
            신청
          </button>
        </div>
      )}

      {busy && busy !== 'busy' && <ErrorAlert message={busy} />}

      {enrollments.loading ? (
        <Spinner />
      ) : (enrollments.data?.length ?? 0) === 0 ? (
        <div className="muted small">아직 신청자가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>임직원</th>
                <th>상태</th>
                <th>참여율</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.data!.map((en) => (
                <tr key={en.id}>
                  <td>{nameOf(en.employeeId)}</td>
                  <td>
                    <EnrollmentStatusBadge status={en.status} />
                  </td>
                  <td className="num">{en.attendanceRate != null ? `${en.attendanceRate}%` : '-'}</td>
                  <td className="num">
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {en.status !== 'cancelled' && en.status !== 'completed' && (
                        <>
                          <button
                            className="btn btn--sm"
                            onClick={() => {
                              const v = prompt('참여율(%)을 입력하세요 (0-100)', String(en.attendanceRate ?? 0));
                              if (v == null) return;
                              const n = Number(v);
                              if (Number.isNaN(n)) return;
                              run(() => programService.setAttendanceRate(en.id, n));
                            }}
                          >
                            참여율
                          </button>
                          <button className="btn btn--sm" onClick={() => run(() => programService.markCompleted(en.id))}>
                            수료
                          </button>
                          <button className="btn btn--danger btn--sm" onClick={() => run(() => programService.cancel(en.id))}>
                            취소
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
