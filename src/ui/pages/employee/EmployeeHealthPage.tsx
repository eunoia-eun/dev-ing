import { useState } from 'react';
import { gradeCategory, HEALTH_GRADE_LABEL } from '@domain/checkup/HealthCheckup';
import { SEVERITY_LABEL, type Severity } from '@domain/symptom/Symptom';
import { useServices } from '../../ServicesContext';
import { useAsync } from '../../hooks/useAsync';
import { Octopus } from '../../components/Octopus';
import { ErrorAlert, Modal } from '../../components/ui';
import { formatDate } from '../../format';
import { useEmployeeId } from './EmployeeLayout';

const COMMON_SYMPTOMS = [
  '두통', '어지럼증', '소화불량', '복통', '메스꺼움', '구토',
  '피로', '근육통', '요통', '기침', '발열', '눈 피로',
  '피부 발진', '코막힘', '목 통증', '손 저림',
];

export function EmployeeHealthPage() {
  const meId = useEmployeeId();
  const { profile } = useServices();
  const [addOpen, setAddOpen] = useState(false);

  const prof = useAsync(
    () => profile.getProfile(meId),
    [meId],
  );

  if (prof.loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <Octopus mood="neutral" size={90} className="emp-octopus" />
        <div style={{ color: '#2563eb', marginTop: 14, fontWeight: 700, fontSize: 13.5 }}>불러오는 중...</div>
      </div>
    );
  }

  const data       = prof.data;
  const checkups   = data?.checkups ?? [];
  const visits     = data?.recentVisits ?? [];
  const exposures  = data?.exposures ?? [];

  return (
    <div>
      <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 12px', fontWeight: 900 }}>🩺 내 건강정보</h2>

      {/* 건강검진 결과 */}
      <div className="emp-card">
        <div className="emp-card__title">최근 건강검진 결과</div>
        {checkups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#9ca3af', fontSize: 12.5 }}>
            <span style={{ fontSize: 30, display: 'block', marginBottom: 6 }}>📋</span>
            건강검진 기록이 없어요
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checkups.slice(0, 4).map((c) => {
              const cat = gradeCategory(c.grade);
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', gap: 12, alignItems: 'center' }}
                >
                  <div className={`emp-grade-card emp-grade-card--${cat}`} style={{ padding: '8px 12px', minWidth: 52, flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{c.grade}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1f2937' }}>
                      {HEALTH_GRADE_LABEL[c.grade]}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9ca3af' }}>{formatDate(c.examDate)}</div>
                    {c.opinion && (
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 3, lineHeight: 1.5 }}>
                        {c.opinion}
                      </div>
                    )}
                    {c.nextExamDate && (
                      <div style={{ fontSize: 11.5, color: '#2563eb', marginTop: 3 }}>
                        다음 검진 예정: {formatDate(c.nextExamDate)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {checkups.length > 4 && (
              <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center' }}>
                외 {checkups.length - 4}건 더 있음
              </div>
            )}
          </div>
        )}
      </div>

      {/* 증상 기재 */}
      <div className="emp-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="emp-card__title" style={{ marginBottom: 0 }}>증상 기재</div>
          <button
            className="btn btn--primary btn--sm"
            style={{ borderRadius: 999 }}
            onClick={() => setAddOpen(true)}
          >
            ＋ 증상 기재
          </button>
        </div>

        {visits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '10px 0', color: '#9ca3af', fontSize: 12.5 }}>
            기록된 증상이 없어요
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visits.slice(0, 6).map((v) => (
              <div key={v.id} style={{ background: '#eff6ff', borderRadius: 11, padding: '10px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                  {v.symptoms.map((s) => (
                    <span key={s} className="emp-symptom-chip">{s}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(v.visitedAt).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                  {v.action ? ` · ${v.action}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <SymptomRecordModal
          employeeId={meId}
          exposures={exposures}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            prof.reload();
          }}
        />
      )}
    </div>
  );
}

/* ── 증상 기재 모달 ── */
function SymptomRecordModal({
  employeeId,
  exposures,
  onClose,
  onSaved,
}: {
  employeeId: string;
  exposures: { record: { substanceName: string }; status: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { symptom: svc, hazard } = useServices();
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom]     = useState('');
  const [notes, setNotes]       = useState('');
  const [severity, setSeverity] = useState<Severity>('mild');
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  function toggleSymptom(s: string) {
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function submit() {
    const allSymptoms = [
      ...selected,
      ...custom.split(',').map((s) => s.trim()).filter(Boolean),
    ];
    if (allSymptoms.length === 0) {
      setError('증상을 하나 이상 선택하거나 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 노출 유해인자와 증상 교차 확인
      const activeExposures = exposures.filter((ex) => ex.status !== 'ended');
      let hazardFindings = undefined;
      if (activeExposures.length > 0) {
        const checks = await hazard.checkSymptomRelations(employeeId, allSymptoms);
        const hits = checks.filter((c) => c.matchedSymptoms.length > 0);
        if (hits.length > 0) {
          hazardFindings = hits.map((c) => ({
            substanceName: c.substanceName,
            matchedSymptoms: c.matchedSymptoms,
            targetOrgans: c.targetOrgans,
          }));
        }
      }

      await svc.recordVisit({
        employeeId,
        symptoms: allSymptoms,
        symptomNote: notes || undefined,
        severity,
        dispenses: [],
        managedBy: '본인 기재',
        hazardFindings,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title="증상 기재"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn btn--primary" onClick={submit} disabled={busy}>기재하기</button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      <div className="field">
        <label>증상 선택 (여러 개 가능)</label>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {COMMON_SYMPTOMS.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip-toggle${selected.includes(s) ? ' active' : ''}`}
              onClick={() => toggleSymptom(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>직접 입력 (쉼표로 구분)</label>
        <input
          className="input"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="예: 손목 통증, 눈 따가움"
        />
      </div>

      <div className="field">
        <label>증상 정도</label>
        <div className="row" style={{ gap: 8 }}>
          {(['mild', 'moderate', 'severe'] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip-toggle${severity === s ? ' active' : ''}`}
              onClick={() => setSeverity(s)}
            >
              {SEVERITY_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>메모 (선택)</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="증상에 대한 추가 설명을 적어주세요"
          style={{ minHeight: 72 }}
        />
      </div>

      <div className="alert alert--info" style={{ marginBottom: 0 }}>
        💡 기재한 내용은 보건관리자가 확인해요. 유해인자 노출과 연관성이 발견되면 함께 기록됩니다.
      </div>
    </Modal>
  );
}
