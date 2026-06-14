import { useState } from 'react';
import { type ProgramStatus } from '@domain/program/HealthProgram';
import { useServices } from '../../ServicesContext';
import { useAsync } from '../../hooks/useAsync';
import { Octopus } from '../../components/Octopus';
import { ErrorAlert } from '../../components/ui';
import { formatDate } from '../../format';
import { useEmployeeId } from './EmployeeLayout';

const CATEGORY_ICON: Record<string, string> = {
  운동: '🏋️', 체력: '💪', 금연: '🚭', 금주: '🍃',
  영양: '🥗', 식이: '🥗', 스트레스: '🧘', 정신: '💆',
  검진: '🩺', 건강: '🌿',
};
function categoryIcon(cat: string): string {
  for (const [key, ico] of Object.entries(CATEGORY_ICON)) {
    if (cat.includes(key)) return ico;
  }
  return '📋';
}

const STATUS_BADGE: Record<ProgramStatus, { label: string; bg: string; color: string }> = {
  recruiting: { label: '모집 중',   bg: '#dcfce7', color: '#15803d' },
  closed:     { label: '모집 마감', bg: '#fee2e2', color: '#b91c1c' },
  ongoing:    { label: '진행 중',   bg: '#dbeafe', color: '#1d4ed8' },
};
const ENROLL_BADGE = {
  applied:    { label: '📝 신청',   bg: '#fef9c3', color: '#a16207' },
  enrolled:   { label: '✅ 확정',   bg: '#dcfce7', color: '#15803d' },
  waitlisted: { label: '⏳ 대기',   bg: '#fef9c3', color: '#a16207' },
  completed:  { label: '🏅 수료',   bg: '#dbeafe', color: '#1d4ed8' },
  cancelled:  { label: '취소됨',    bg: '#f3f4f6', color: '#6b7280' },
};

export function EmployeeProgramPage() {
  const meId = useEmployeeId();
  const { program } = useServices();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState<string | null>(null); // programId or enrollmentId being processed

  const summaries  = useAsync(() => program.getAllSummaries(), []);
  const myEnrolls  = useAsync(
    () => program.listEnrollmentsByEmployee(meId),
    [meId],
  );

  const enrollByProgramId = new Map(
    (myEnrolls.data ?? [])
      .filter((e) => e.status !== 'cancelled')
      .map((e) => [e.programId, e]),
  );

  async function applyProgram(programId: string) {
    setBusy(programId);
    setError(null);
    try {
      await program.apply(programId, meId);
      summaries.reload();
      myEnrolls.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function cancelProgram(enrollmentId: string) {
    setBusy(enrollmentId);
    setError(null);
    try {
      await program.cancel(enrollmentId);
      summaries.reload();
      myEnrolls.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (summaries.loading || myEnrolls.loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <Octopus mood="neutral" size={90} className="emp-octopus" />
        <div style={{ color: '#2563eb', marginTop: 14, fontWeight: 700, fontSize: 13.5 }}>불러오는 중...</div>
      </div>
    );
  }

  const list = summaries.data ?? [];
  const open     = list.filter((s) => s.program.status === 'recruiting');
  const ongoing  = list.filter((s) => s.program.status === 'ongoing');
  const others   = list.filter((s) => !['recruiting', 'ongoing'].includes(s.program.status));

  if (list.length === 0) {
    return (
      <div>
        <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 16px', fontWeight: 900 }}>🏃 건강프로그램</h2>
        <div style={{ textAlign: 'center', padding: 16 }}>
          <Octopus mood="happy" size={90} className="emp-octopus" />
        </div>
        <div className="emp-card" style={{ textAlign: 'center', padding: '20px 16px', marginTop: 8 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏃</div>
          <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: 5 }}>운영 중인 프로그램이 없어요</div>
          <div style={{ color: '#9ca3af', fontSize: 12.5 }}>보건관리자가 프로그램을 등록하면 여기서 확인하고 신청할 수 있어요.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 12px', fontWeight: 900 }}>🏃 건강프로그램</h2>

      {error && <ErrorAlert message={error} />}

      {open.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title">📣 모집 중 프로그램</div>
          {open.map(({ program: p, summary }) => {
            const enrollment = enrollByProgramId.get(p.id);
            const badge = enrollment ? ENROLL_BADGE[enrollment.status] : null;
            const isBusy = busy === p.id || (enrollment && busy === enrollment.id);
            return (
              <ProgramRow
                key={p.id}
                program={p}
                summary={summary}
                badge={badge}
                isBusy={!!isBusy}
                canApply={!enrollment}
                canCancel={!!enrollment && enrollment.status !== 'completed'}
                onApply={() => applyProgram(p.id)}
                onCancel={() => enrollment && cancelProgram(enrollment.id)}
              />
            );
          })}
        </div>
      )}

      {ongoing.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title">▶ 진행 중 프로그램</div>
          {ongoing.map(({ program: p, summary }) => {
            const enrollment = enrollByProgramId.get(p.id);
            const badge = enrollment ? ENROLL_BADGE[enrollment.status] : null;
            return (
              <ProgramRow
                key={p.id}
                program={p}
                summary={summary}
                badge={badge}
                isBusy={false}
                canApply={false}
                canCancel={false}
                onApply={() => {}}
                onCancel={() => {}}
              />
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <div className="emp-card" style={{ opacity: 0.75 }}>
          <div className="emp-card__title" style={{ color: '#9ca3af' }}>종료된 프로그램</div>
          {others.map(({ program: p, summary }) => {
            const enrollment = enrollByProgramId.get(p.id);
            const badge = enrollment ? ENROLL_BADGE[enrollment.status] : null;
            return (
              <ProgramRow
                key={p.id}
                program={p}
                summary={summary}
                badge={badge}
                isBusy={false}
                canApply={false}
                canCancel={false}
                onApply={() => {}}
                onCancel={() => {}}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgramRow({
  program: p,
  summary,
  badge,
  isBusy,
  canApply,
  canCancel,
  onApply,
  onCancel,
}: {
  program: { id: string; title: string; category: string; status: ProgramStatus; capacity: number; startDate?: string; endDate?: string };
  summary: { fillRate: number; occupied: number };
  badge: { label: string; bg: string; color: string } | null;
  isBusy: boolean;
  canApply: boolean;
  canCancel: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const statusInfo = STATUS_BADGE[p.status];
  const ico = categoryIcon(p.category);
  const fillPct = summary.fillRate;

  return (
    <div className="emp-prog-row">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{ico}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
            <strong style={{ fontSize: 13.5, color: '#1f2937' }}>{p.title}</strong>
            <span style={{ fontSize: 10.5, background: statusInfo.bg, color: statusInfo.color, borderRadius: 999, padding: '2px 7px', fontWeight: 700 }}>
              {statusInfo.label}
            </span>
            {badge && (
              <span style={{ fontSize: 10.5, background: badge.bg, color: badge.color, borderRadius: 999, padding: '2px 7px', fontWeight: 700 }}>
                {badge.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
            {p.category}
            {p.startDate && ` · ${formatDate(p.startDate)}${p.endDate ? ` ~ ${formatDate(p.endDate)}` : ''}`}
          </div>
          {/* 충원률 바 */}
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>
              <span>충원 {summary.occupied}/{p.capacity}명</span>
              <span>{fillPct}%</span>
            </div>
            <div style={{ height: 5, background: '#dbeafe', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(fillPct, 100)}%`, background: fillPct >= 100 ? '#ef4444' : '#2563eb', borderRadius: 999 }} />
            </div>
          </div>
        </div>
      </div>
      {(canApply || canCancel) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 6 }}>
          {canCancel && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: '#6b7280' }}
              disabled={isBusy}
              onClick={onCancel}
            >
              신청 취소
            </button>
          )}
          {canApply && (
            <button
              className="btn btn--primary btn--sm"
              style={{ borderRadius: 999 }}
              disabled={isBusy}
              onClick={onApply}
            >
              {isBusy ? '처리 중...' : '신청하기'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
