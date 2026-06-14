import { useState } from 'react';
import { SEVERITY_LABEL, type Severity, type SymptomVisit } from '@domain/symptom/Symptom';
import { relatedOnly } from '@domain/hazard/symptomMatching';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Modal, Spinner } from '../components/ui';
import { SeverityBadge } from '../components/StatusBadge';
import { EmployeePicker } from '../components/EmployeePicker';
import { downloadCsv } from '../csv';
import { daysAgoISO, formatDateTime, todayISO } from '../format';

interface DispenseRow {
  medicineId: string;
  quantity: number;
}

interface VisitForm {
  employeeId: string;
  symptoms: string;
  severity: Severity;
  temperature: string;
  systolic: string;
  diastolic: string;
  action: string;
  managedBy: string;
  note: string;
  dispenses: DispenseRow[];
}

const EMPTY_FORM: VisitForm = {
  employeeId: '',
  symptoms: '',
  severity: 'mild',
  temperature: '',
  systolic: '',
  diastolic: '',
  action: '',
  managedBy: '보건관리자',
  note: '',
  dispenses: [],
};

/** 입력 증상 ↔ 노출 유해인자 관련성 실시간 점검 패널 */
function SymptomHazardPanel({ employeeId, symptoms }: { employeeId: string; symptoms: string[] }) {
  const { hazard } = useServices();
  const key = symptoms.join('|');
  const { data, loading } = useAsync(
    () => (employeeId ? hazard.checkSymptomRelations(employeeId, symptoms) : Promise.resolve([])),
    [employeeId, key],
  );

  if (!employeeId) return null;
  if (loading) return <div className="muted small hazard-check__hint">유해인자 관련성 점검 중…</div>;

  const checks = data ?? [];
  if (checks.length === 0) {
    return <div className="muted small hazard-check__hint">이 임직원은 등록된 노출 유해인자가 없어요.</div>;
  }

  const related = checks.filter((c) => c.matchedSymptoms.length > 0);
  const others = checks.filter((c) => c.matchedSymptoms.length === 0);

  return (
    <div className="hazard-check">
      {related.length > 0 ? (
        <div className="alert alert--danger" style={{ marginBottom: 8 }}>
          ⚠ 노출 유해인자와 <strong>관련 가능성</strong>이 있는 증상이에요. 특수건강진단·추가 평가를
          고려해 보세요.
        </div>
      ) : symptoms.length > 0 ? (
        <div className="muted small" style={{ marginBottom: 8 }}>
          입력한 증상과 노출 유해인자의 직접 관련 소견은 없어요.
        </div>
      ) : (
        <div className="muted small" style={{ marginBottom: 8 }}>
          이 임직원의 노출 유해인자 ({checks.length}건):
        </div>
      )}
      <div className="row row--wrap" style={{ gap: 8 }}>
        {related.map((c) => (
          <div key={`${c.categoryCode}-${c.substanceNo}`} className="hazard-chip hazard-chip--hit">
            <strong>{c.substanceName}</strong>
            <span> · {c.matchedSymptoms.join(', ')}</span>
            {c.targetOrgans.length > 0 && (
              <div className="hazard-chip__organs">표적장기: {c.targetOrgans.join(', ')}</div>
            )}
          </div>
        ))}
        {others.map((c) => (
          <span key={`${c.categoryCode}-${c.substanceNo}`} className="badge badge--muted">
            {c.substanceName}
          </span>
        ))}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        참고용 점검으로, 진단을 대신할 수는 없어요.
      </div>
    </div>
  );
}

export function SymptomPage() {
  const { symptom, employees, hazard } = useServices();
  const [filter, setFilter] = useState('');
  const [start, setStart] = useState(daysAgoISO(90));
  const [end, setEnd] = useState(todayISO());
  const visits = useAsync(
    () => (filter ? symptom.listVisitsByEmployee(filter) : symptom.listVisits()),
    [filter],
  );
  const meds = useAsync(() => symptom.listMedicines(), []);
  const emp = useAsync(() => employees.list(), []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SymptomVisit | null>(null);
  const [form, setForm] = useState<VisitForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const nameOf = (id: string) => emp.data?.find((e) => e.id === id)?.name ?? '(알 수 없음)';
  const deptOf = (id: string) => emp.data?.find((e) => e.id === id)?.department ?? '(미분류)';

  const set = <K extends keyof VisitForm>(k: K, v: VisitForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // 기간 필터(임직원 필터는 서비스에서, 기간은 클라이언트에서)
  const displayedVisits = (visits.data ?? []).filter((v) => {
    const day = v.visitedAt.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });

  // 부서별 중복(2회 이상) 증상
  const deptSymptomMap = new Map<string, Map<string, number>>();
  for (const v of displayedVisits) {
    const dept = deptOf(v.employeeId);
    const m = deptSymptomMap.get(dept) ?? new Map<string, number>();
    for (const s of v.symptoms) m.set(s, (m.get(s) ?? 0) + 1);
    deptSymptomMap.set(dept, m);
  }
  const deptCommon = [...deptSymptomMap.entries()]
    .map(([dept, m]) => ({
      dept,
      common: [...m.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]),
    }))
    .filter((x) => x.common.length > 0)
    .sort((a, b) => a.dept.localeCompare(b.dept));

  function exportVisits() {
    const header = ['일시', '임직원', '부서', '증상', '정도', '체온', '혈압', '수령약품', '조치', '관련 유해인자', '처리자'];
    const rows = displayedVisits.map((v) => [
      formatDateTime(v.visitedAt),
      nameOf(v.employeeId),
      deptOf(v.employeeId),
      v.symptoms.join(', '),
      SEVERITY_LABEL[v.severity],
      v.bodyTemperature != null ? String(v.bodyTemperature) : '',
      v.bloodPressure ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}` : '',
      v.dispensedMedicines.map((d) => `${d.medicineName} ${d.quantity}${d.unit}`).join('; '),
      v.action ?? '',
      (v.hazardFindings ?? []).map((f) => f.substanceName).join('; '),
      v.managedBy,
    ]);
    downloadCsv(`상담일지_${start}_${end}.csv`, [header, ...rows]);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(v: SymptomVisit) {
    setEditing(v);
    setForm({
      employeeId: v.employeeId,
      symptoms: v.symptoms.join(', '),
      severity: v.severity,
      temperature: v.bodyTemperature != null ? String(v.bodyTemperature) : '',
      systolic: v.bloodPressure ? String(v.bloodPressure.systolic) : '',
      diastolic: v.bloodPressure ? String(v.bloodPressure.diastolic) : '',
      action: v.action ?? '',
      managedBy: v.managedBy,
      note: v.symptomNote ?? '',
      dispenses: v.dispensedMedicines.map((d) => ({ medicineId: d.medicineId, quantity: d.quantity })),
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setEditing(null);
  }

  async function submit() {
    if (!form.employeeId) {
      setFormError('임직원을 선택하세요.');
      return;
    }
    const symptoms = form.symptoms.split(',').map((s) => s.trim()).filter(Boolean);
    if (symptoms.length === 0) {
      setFormError('증상을 1개 이상 입력하세요. (쉼표로 구분)');
      return;
    }
    const dispenses = form.dispenses.filter((d) => d.medicineId && d.quantity > 0);
    const hasBp = form.systolic && form.diastolic;
    try {
      // 점검 결과 스냅샷(관련 물질만)을 함께 저장
      const checks = await hazard.checkSymptomRelations(form.employeeId, symptoms);
      const hazardFindings = relatedOnly(checks).map((c) => ({
        substanceName: c.substanceName,
        matchedSymptoms: c.matchedSymptoms,
        targetOrgans: c.targetOrgans,
      }));
      const input = {
        employeeId: form.employeeId,
        symptoms,
        symptomNote: form.note || undefined,
        severity: form.severity,
        bodyTemperature: form.temperature ? Number(form.temperature) : undefined,
        bloodPressure: hasBp
          ? { systolic: Number(form.systolic), diastolic: Number(form.diastolic) }
          : undefined,
        dispenses,
        action: form.action || undefined,
        managedBy: form.managedBy || '보건관리자',
        hazardFindings: hazardFindings.length ? hazardFindings : undefined,
      };
      if (editing) await symptom.updateVisit(editing.id, input);
      else await symptom.recordVisit(input);
      closeModal();
      setForm(EMPTY_FORM);
      setFormError(null);
      visits.reload();
      meds.reload();
    } catch (e) {
      // 재고 부족 등 도메인 예외 메시지를 그대로 노출
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="grow" style={{ maxWidth: 280 }}>
          <EmployeePicker
            employees={emp.data ?? []}
            value={filter}
            onChange={setFilter}
            placeholder="전체 임직원"
            allowEmpty
          />
        </div>
        <input className="input lab-range" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="muted">~</span>
        <input className="input lab-range" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <button className="btn btn--sm" onClick={exportVisits} disabled={displayedVisits.length === 0}>
          ⬇ 엑셀
        </button>
        <button className="btn btn--primary" onClick={openCreate}>
          ＋ 상담 기록
        </button>
      </div>

      {deptCommon.length > 0 && (
        <Card title="부서별 중복 증상 (해당 기간, 2회 이상)">
          <div className="grid grid--2">
            {deptCommon.map(({ dept, common }) => (
              <div key={dept}>
                <div className="row spread small" style={{ marginBottom: 4 }}>
                  <strong>{dept}</strong>
                  <span className="muted">{common.length}종</span>
                </div>
                <div className="row row--wrap" style={{ gap: 6 }}>
                  {common.map(([sym, cnt]) => (
                    <span key={sym} className="badge badge--warning">
                      {sym} <strong>×{cnt}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>
            같은 부서에서 2회 이상 나타난 증상이에요. 공통 작업환경 요인 점검에 참고해 보세요.
          </div>
        </Card>
      )}

      <Card title="상담일지" bodyClassName="">
        {visits.loading ? (
          <Spinner />
        ) : visits.error ? (
          <ErrorAlert message={visits.error} />
        ) : displayedVisits.length === 0 ? (
          <EmptyState icon="🩺">해당 조건의 상담 기록이 없어요.</EmptyState>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>임직원</th>
                  <th>증상</th>
                  <th>정도</th>
                  <th>활력징후</th>
                  <th>수령 약품</th>
                  <th>조치</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayedVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="muted small">
                      {formatDateTime(v.visitedAt)}
                      {v.log && v.log.length > 1 && <div className="badge badge--muted">수정됨</div>}
                    </td>
                    <td>
                      <strong>{nameOf(v.employeeId)}</strong>
                    </td>
                    <td>
                      {v.symptoms.join(', ')}
                      {v.symptomNote && <div className="muted small">{v.symptomNote}</div>}
                      {v.hazardFindings && v.hazardFindings.length > 0 && (
                        <div className="hazard-flag small">
                          ⚠ 관련 유해인자: {v.hazardFindings.map((f) => f.substanceName).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <SeverityBadge severity={v.severity} />
                    </td>
                    <td className="small">
                      {v.bodyTemperature ? `${v.bodyTemperature}℃ ` : ''}
                      {v.bloodPressure
                        ? `${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}`
                        : ''}
                      {!v.bodyTemperature && !v.bloodPressure && '-'}
                    </td>
                    <td className="small">
                      {v.dispensedMedicines.length === 0
                        ? '-'
                        : v.dispensedMedicines
                            .map((d) => `${d.medicineName} ${d.quantity}${d.unit}`)
                            .join(', ')}
                    </td>
                    <td className="small">{v.action ?? '-'}</td>
                    <td className="num">
                      <button className="btn btn--sm" onClick={() => openEdit(v)}>
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <Modal
          title={editing ? '상담 기록 수정' : '상담 기록'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn" onClick={closeModal}>
                취소
              </button>
              <button className="btn btn--primary" onClick={submit}>
                {editing ? '수정 저장' : '저장'}
              </button>
            </>
          }
        >
          {formError && <ErrorAlert message={formError} />}
          <div className="field">
            <label>임직원 *</label>
            <EmployeePicker
              employees={emp.data ?? []}
              value={form.employeeId}
              onChange={(id) => set('employeeId', id)}
            />
          </div>
          <div className="field">
            <label>증상 * (쉼표로 구분, 예: 두통, 발열)</label>
            <input className="input" value={form.symptoms} onChange={(e) => set('symptoms', e.target.value)} />
          </div>
          <SymptomHazardPanel
            employeeId={form.employeeId}
            symptoms={form.symptoms.split(',').map((s) => s.trim()).filter(Boolean)}
          />
          <div className="form-row">
            <div className="field">
              <label>정도</label>
              <select className="select" value={form.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
                <option value="mild">경증</option>
                <option value="moderate">중등도</option>
                <option value="severe">중증</option>
              </select>
            </div>
            <div className="field">
              <label>체온(℃)</label>
              <input className="input" type="number" step="0.1" value={form.temperature} onChange={(e) => set('temperature', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>수축기 혈압</label>
              <input className="input" type="number" value={form.systolic} onChange={(e) => set('systolic', e.target.value)} />
            </div>
            <div className="field">
              <label>이완기 혈압</label>
              <input className="input" type="number" value={form.diastolic} onChange={(e) => set('diastolic', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>상비약 수령</label>
            <div className="stack" style={{ gap: 8 }}>
              {form.dispenses.map((d, i) => (
                <div key={i} className="row" style={{ gap: 8 }}>
                  <select
                    className="select"
                    value={d.medicineId}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.dispenses];
                        next[i] = { ...next[i], medicineId: e.target.value };
                        return { ...f, dispenses: next };
                      })
                    }
                  >
                    <option value="">약품 선택</option>
                    {(meds.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (재고 {m.stock}
                        {m.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    style={{ width: 90 }}
                    value={d.quantity}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = [...f.dispenses];
                        next[i] = { ...next[i], quantity: Number(e.target.value) };
                        return { ...f, dispenses: next };
                      })
                    }
                  />
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, dispenses: f.dispenses.filter((_, j) => j !== i) }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                className="btn btn--sm"
                onClick={() =>
                  setForm((f) => ({ ...f, dispenses: [...f.dispenses, { medicineId: '', quantity: 1 }] }))
                }
              >
                ＋ 약품 추가
              </button>
            </div>
          </div>

          <div className="field">
            <label>증상 상세 메모</label>
            <textarea className="textarea" value={form.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>조치 사항</label>
              <input className="input" value={form.action} onChange={(e) => set('action', e.target.value)} placeholder="예: 휴식 후 복귀" />
            </div>
            <div className="field">
              <label>처리자</label>
              <input className="input" value={form.managedBy} onChange={(e) => set('managedBy', e.target.value)} />
            </div>
          </div>

          {editing?.log && editing.log.length > 0 && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>변경 이력</label>
              <ul className="visit-log">
                {editing.log.map((e, i) => (
                  <li key={i}>
                    <span className="visit-log__time">{formatDateTime(e.at)}</span>
                    <span className={`visit-log__tag visit-log__tag--${e.action}`}>
                      {e.action === 'created' ? '등록' : '수정'}
                    </span>
                    {e.by}
                    {e.note ? ` — ${e.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
