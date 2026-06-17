import { useState } from 'react';
import {
  HEALTH_GRADE_LABEL,
  followUpLabels,
  gradeTone,
  resolveCheckupTypeName,
} from '@domain/checkup/HealthCheckup';
import { SEVERITY_LABEL, type Severity } from '@domain/symptom/Symptom';
import { useServices } from '../../ServicesContext';
import { useAsync } from '../../hooks/useAsync';
import { Octopus } from '../../components/Octopus';
import { ErrorAlert, Modal } from '../../components/ui';
import { LabTrendCard } from '../../components/LabTrendCard';
import { formatDate } from '../../format';
import { useEmployeeId } from './EmployeeLayout';

const COMMON_SYMPTOMS = [
  '두통', '어지럼증', '소화불량', '복통', '메스꺼움', '구토',
  '피로', '근육통', '요통', '기침', '발열', '눈 피로',
  '피부 발진', '코막힘', '목 통증', '손 저림',
];

export function EmployeeHealthPage() {
  const meId = useEmployeeId();
  const { profile, labItems, checkupTypes } = useServices();
  const [addOpen, setAddOpen] = useState(false);

  const prof = useAsync(() => profile.getProfile(meId), [meId]);
  const labCat = useAsync(() => labItems.list(), []);
  const types = useAsync(() => checkupTypes.list(), []);

  if (prof.loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        <Octopus mood="neutral" size={90} className="emp-octopus" />
        <div style={{ color: '#2563eb', marginTop: 14, fontWeight: 700, fontSize: 13.5 }}>불러오는 중...</div>
      </div>
    );
  }

  const data      = prof.data;
  const checkups  = data?.checkups ?? [];
  const visits    = data?.recentVisits ?? [];
  const exposures = data?.exposures ?? [];
  const typeList  = types.data ?? [];

  return (
    <div>
      <h2 style={{ color: '#111827', fontSize: 16, margin: '0 0 12px', fontWeight: 900 }}>🩺 내 건강정보</h2>

      {/* 건강검진 결과 */}
      <div className="emp-card">
        <div className="emp-card__title">건강검진 결과</div>
        {checkups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#9ca3af', fontSize: 12.5 }}>
            <span style={{ fontSize: 30, display: 'block', marginBottom: 6 }}>📋</span>
            건강검진 기록이 없어요
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>검진일</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>종류</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>판정</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>사후관리</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>소견 / 다음 검진</th>
                </tr>
              </thead>
              <tbody>
                {checkups.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 8px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {formatDate(c.examDate)}
                    </td>
                    <td style={{ padding: '8px 8px', color: '#374151' }}>
                      {resolveCheckupTypeName(c.type, typeList)}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <span className={`badge badge--${gradeTone(c.grade)}`} style={{ fontSize: 12 }}>
                        {HEALTH_GRADE_LABEL[c.grade]}
                      </span>
                    </td>
                    <td style={{ padding: '8px 8px', color: '#374151' }}>
                      {c.followUpActions && c.followUpActions.length > 0
                        ? followUpLabels(c.followUpActions)
                        : <span style={{ color: '#9ca3af' }}>-</span>}
                    </td>
                    <td style={{ padding: '8px 8px', color: '#374151' }}>
                      {c.opinion ?? ''}
                      {c.nextExamDate && (
                        <div style={{ fontSize: 11.5, color: '#2563eb', marginTop: 2 }}>
                          다음 검진 {formatDate(c.nextExamDate)}
                        </div>
                      )}
                      {!c.opinion && !c.nextExamDate && <span style={{ color: '#9ca3af' }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 검사 수치 추이 (5개년 기본값) */}
      {checkups.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <LabTrendCard
            checkups={checkups}
            labItems={labCat.data ?? []}
            checkupTypes={typeList}
          />
        </div>
      )}

      {/* 증상 기재 */}
      <div className="emp-card" style={{ marginTop: 12 }}>
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
        💡 기재한 내용은 보건관리자가 확인해요. 유해인자 노출과 연관성이 발견되면 함께 기록돼요.
      </div>
    </Modal>
  );
}
