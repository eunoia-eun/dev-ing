import { useState } from 'react';
import type { Employee } from '@domain/employee/Employee';
import {
  canEditProgram,
  defaultProgramRange,
  PROGRAM_STATUS_LABEL,
  type HealthProgram,
  type ParticipationSummary,
  type ProgramStatus,
} from '@domain/program/HealthProgram';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Modal, ProgressBar, Spinner } from '../components/ui';
import { EnrollmentStatusBadge, ProgramStatusBadge } from '../components/StatusBadge';
import { EmployeePicker } from '../components/EmployeePicker';
import { formatDate } from '../format';

export function ProgramPage() {
  const { program, employees } = useServices();
  const thisYear = new Date().getFullYear();
  const fallback = defaultProgramRange(thisYear);
  const [start, setStart] = useState(fallback.start);
  const [end, setEnd] = useState(fallback.end);
  const [addOpen, setAddOpen] = useState(false);

  const summaries = useAsync(() => program.getAllSummaries({ start, end }), [start, end]);
  const emp = useAsync(() => employees.list(), []);

  if (summaries.loading || emp.loading) return <Spinner />;
  if (summaries.error) return <ErrorAlert message={summaries.error} />;

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="row" style={{ gap: 6 }}>
          <span className="muted small">기간</span>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: 150 }} />
          <span className="muted">~</span>
          <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: 150 }} />
          <button
            className="btn btn--sm"
            onClick={() => {
              setStart(fallback.start);
              setEnd(fallback.end);
            }}
          >
            올해
          </button>
        </div>
        <div className="grow" />
        <button className="btn btn--primary" onClick={() => setAddOpen(true)}>
          ＋ 프로그램 추가
        </button>
      </div>

      {summaries.data!.length === 0 ? (
        <EmptyState icon="🏃">조회 기간에 운영하는 프로그램이 없습니다.</EmptyState>
      ) : (
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
      )}

      {addOpen && (
        <ProgramFormModal
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            summaries.reload();
          }}
        />
      )}
    </div>
  );
}

/** 건강프로그램 추가/수정 모달 — program이 있으면 수정 모드 */
function ProgramFormModal({
  program: editing,
  onClose,
  onSaved,
}: {
  program?: HealthProgram;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { program } = useServices();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [capacity, setCapacity] = useState(String(editing?.capacity ?? 10));
  const [startDate, setStartDate] = useState(editing?.startDate ?? '');
  const [endDate, setEndDate] = useState(editing?.endDate ?? '');
  const [status, setStatus] = useState<ProgramStatus>(editing?.status ?? 'recruiting');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title || !category || !startDate || !endDate) {
      setError('제목·분류·시작일·종료일은 필수입니다.');
      return;
    }
    const cap = Number(capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      setError('정원은 1 이상의 숫자여야 합니다.');
      return;
    }
    setBusy(true);
    setError(null);
    const input = { title, description, category, capacity: cap, startDate, endDate, status };
    try {
      if (editing) {
        await program.updateProgram(editing.id, input);
      } else {
        await program.createProgram(input);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? '건강프로그램 수정' : '건강프로그램 추가'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      <div className="field">
        <label>제목 *</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 금연 클리닉" />
      </div>
      <div className="field">
        <label>설명</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="프로그램 소개" />
      </div>
      <div className="form-row">
        <div className="field">
          <label>분류 *</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 금연, 운동, 영양" />
        </div>
        <div className="field">
          <label>정원 *</label>
          <input className="input" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>시작일 *</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>종료일 *</label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>상태</label>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as ProgramStatus)}>
          {Object.entries(PROGRAM_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </Modal>
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
  const [editing, setEditing] = useState(false);

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

  async function remove() {
    if (!confirm(`'${p.title}' 프로그램을 삭제하시겠습니까? 신청·참여 기록도 함께 삭제됩니다.`)) return;
    await programService.removeProgram(p.id);
    onChanged();
  }

  return (
    <Card
      title={
        <span className="row" style={{ gap: 8 }}>
          {p.title} <ProgramStatusBadge status={p.status} />
        </span>
      }
      actions={
        <div className="row" style={{ gap: 6 }}>
          {canEditProgram(p) && (
            <button className="btn btn--sm" onClick={() => setEditing(true)}>
              수정
            </button>
          )}
          <button className="btn btn--danger btn--sm" onClick={remove}>
            삭제
          </button>
        </div>
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

      {editing && (
        <ProgramFormModal
          program={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}
