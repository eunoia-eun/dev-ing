import { useMemo } from 'react';
import { gradeCategory, HEALTH_GRADE_LABEL } from '@domain/checkup/HealthCheckup';
import { byUrgency, type ExposureAssessment } from '@domain/hazard/ExposureAssessment';
import { computeHealthNotice } from '@domain/employee/HealthNotice';
import { useServices } from '../../ServicesContext';
import { useAsync } from '../../hooks/useAsync';
import { Octopus, type OctopusMood } from '../../components/Octopus';
import { describeDaysUntil, formatDate } from '../../format';
import { useEmployeeId } from './EmployeeLayout';

export function EmployeeHomePage() {
  const meId = useEmployeeId();
  const { profile, program } = useServices();

  const prof = useAsync(
    () => profile.getProfile(meId),
    [meId],
  );
  const enr = useAsync(
    () => program.listEnrollmentsByEmployee(meId),
    [meId],
  );

  const data = prof.data;
  const activeExposures = (data?.exposures ?? []).filter((ex) => ex.status !== 'ended');
  const overdueList  = activeExposures.filter((ex) => ex.status === 'overdue');
  const dueSoonList  = activeExposures.filter((ex) => ex.status === 'due-soon');
  const scheduleList = useMemo(() => [...activeExposures].sort(byUrgency), [activeExposures]);

  const notice = useMemo(
    () =>
      computeHealthNotice({
        activeExposures,
        latestCheckup: data?.latestCheckup,
        enrollmentStatuses: (enr.data ?? []).map((e) => e.status),
      }),
    [activeExposures, data?.latestCheckup, enr.data],
  );

  const mood: OctopusMood = useMemo(() => {
    if (!data) return 'neutral';
    if (notice.stamps.some((s) => s.level === 'help')) return 'worried';
    if (notice.stamps.some((s) => s.level === 'warn')) return 'neutral';
    return 'happy';
  }, [data, notice.stamps]);

  if (prof.loading) return <OctopusLoading />;

  const e = data?.employee;
  const latestCheckup = data?.latestCheckup;
  const recentVisits  = data?.recentVisits ?? [];

  return (
    <div>
      {/* 인사 */}
      <div style={{ textAlign: 'center', marginBottom: 14, paddingTop: 4 }}>
        <Octopus mood={mood} size={76} className="emp-octopus" />
        <h2 style={{ color: '#111827', fontSize: 17, margin: '8px 0 4px', fontWeight: 900, letterSpacing: -0.5 }}>
          안녕하세요, <span style={{ color: '#2563eb' }}>{e?.name}</span>님!
        </h2>
        <p style={{ color: '#9ca3af', margin: 0, fontSize: 12.5 }}>
          {e?.department} · {e?.jobTitle}
        </p>
      </div>

      {/* 건강 알림장 */}
      <div className="emp-card">
        <div className="emp-card__title" style={{ textAlign: 'center' }}>🐙 오늘의 건강 알림장</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notice.stamps.map((s) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                background: '#eff6ff',
                borderRadius: 12,
                padding: '10px 14px',
                border: '1px solid #dbeafe',
              }}
            >
              <span style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>
                {s.icon} {s.label}
              </span>
              <span className={`emp-stamp emp-stamp--${s.level}`}>
                {s.text} {s.emoji}
              </span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#2563eb', fontWeight: 800 }}>
          {notice.message}
        </div>
      </div>

      {/* 특수검진 상태 요약 */}
      {activeExposures.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title">⚗️ 특수검진 현황</div>

          {overdueList.length > 0 ? (
            <div className="emp-alert emp-alert--danger">
              🚨 검진 기한 초과 {overdueList.length}건 — 보건실에 문의하세요
            </div>
          ) : dueSoonList.length > 0 ? (
            <div className="emp-alert emp-alert--warn">
              ⏰ 검진 임박 {dueSoonList.length}건이 있어요
            </div>
          ) : (
            <div className="emp-alert emp-alert--ok">
              ✅ 모든 특수검진이 정상 주기예요
            </div>
          )}

          {/* 다음 특수검진 예상 일정 */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scheduleList.map((ex) => (
              <div
                key={ex.record.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}
              >
                <span style={{ color: '#374151', fontWeight: 700 }}>{ex.record.substanceName}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span className={ddayClass(ex.status)}>
                    📅 {formatDate(ex.nextExamDueDate)}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>{describeDaysUntil(ex.daysUntilDue)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 10 }}>
            노출 유해인자 {activeExposures.length}종 — 자세히는 '내 유해인자' 탭
          </div>
        </div>
      )}

      {/* 최근 검진 결과 */}
      {latestCheckup ? (
        <div className="emp-card">
          <div className="emp-card__title">🩺 최근 건강검진</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
              className={`emp-grade-card emp-grade-card--${gradeCategory(latestCheckup.grade)}`}
              style={{ padding: '8px 12px', minWidth: 52, flexShrink: 0 }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{latestCheckup.grade}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1f2937' }}>
                {HEALTH_GRADE_LABEL[latestCheckup.grade]}
              </div>
              <div style={{ fontSize: 11.5, color: '#9ca3af' }}>{formatDate(latestCheckup.examDate)} 검진 기준</div>
              {latestCheckup.opinion && (
                <div style={{ fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 1.5 }}>
                  {latestCheckup.opinion}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        activeExposures.length === 0 && (
          <div className="emp-card" style={{ textAlign: 'center', padding: '24px 18px' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
            <div style={{ color: '#1d4ed8', fontWeight: 800, marginBottom: 5 }}>건강 기록이 없어요</div>
            <div style={{ color: '#9ca3af', fontSize: 12.5 }}>
              보건관리자가 기록을 등록하면 여기서 확인할 수 있어요.
            </div>
          </div>
        )
      )}

      {/* 최근 방문 */}
      {recentVisits.length > 0 && (
        <div className="emp-card">
          <div className="emp-card__title">📋 최근 보건실 방문</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentVisits.slice(0, 3).map((v) => (
              <div key={v.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                  {v.symptoms.map((s) => (
                    <span key={s} className="emp-symptom-chip">{s}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: '#9ca3af' }}>
                  {new Date(v.visitedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {v.action ? ` · ${v.action}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ddayClass(status: ExposureAssessment['status']): string {
  if (status === 'overdue') return 'emp-dday emp-dday--overdue';
  if (status === 'due-soon') return 'emp-dday emp-dday--soon';
  return 'emp-dday emp-dday--ok';
}

function OctopusLoading() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 60 }}>
      <Octopus mood="neutral" size={90} className="emp-octopus" />
      <div style={{ color: '#2563eb', marginTop: 14, fontWeight: 700, fontSize: 13.5 }}>
        불러오는 중...
      </div>
    </div>
  );
}
