import { useState, useRef, useEffect, useCallback } from 'react';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorAlert } from '../components/ui';
import type { ExceedanceStatus, WorkplaceMeasurement, MeasurementAssessment } from '@domain/measurement/WorkplaceMeasurement';
import type { MeasurementRound, MeasurementDocument } from '@domain/measurement/MeasurementRound';
import { formatFileSize, suggestRoundName } from '@domain/measurement/MeasurementRound';
import type { DepartmentHazard } from '@domain/hazard/DepartmentHazard';
import type { HazardCategory, HazardCategoryCode, HazardSubstance } from '@domain/hazard/HazardousSubstance';

// ── 상태 뱃지 ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<ExceedanceStatus, { label: string; color: string; bg: string }> = {
  exceeded: { label: '🔴 초과', color: '#dc2626', bg: '#fee2e2' },
  warning:  { label: '🟡 주의', color: '#d97706', bg: '#fef3c7' },
  normal:   { label: '🟢 정상', color: '#16a34a', bg: '#dcfce7' },
  unknown:  { label: '⚪ 기준없음', color: '#6b7280', bg: '#f3f4f6' },
};

function StatusBadge({ status }: { status: ExceedanceStatus }) {
  const { label, color, bg } = STATUS_MAP[status];
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color, background: bg, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color, background: bg }}>{label}</span>;
}

function ValueCell({ measured, limit, unit, status }: {
  measured: number | undefined; limit: string | undefined; unit: string; status: ExceedanceStatus;
}) {
  if (measured === undefined) return <span style={{ color: '#d1d5db' }}>-</span>;
  const color = status === 'exceeded' ? '#dc2626' : status === 'warning' ? '#d97706' : '#1f2937';
  return (
    <span style={{ color, fontWeight: status !== 'normal' && status !== 'unknown' ? 700 : 400 }}>
      {measured} {unit}
      {limit && <span style={{ color: '#9ca3af', fontWeight: 400 }}> / {limit}</span>}
    </span>
  );
}

function SummaryChips({ assessments }: { assessments: MeasurementAssessment[] }) {
  if (assessments.length === 0) return <span style={{ fontSize: 12, color: '#9ca3af' }}>측정 결과 없음</span>;
  const exceeded = assessments.filter((a) => a.overallStatus === 'exceeded').length;
  const warning  = assessments.filter((a) => a.overallStatus === 'warning').length;
  const normal   = assessments.filter((a) => a.overallStatus === 'normal').length;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {exceeded > 0 && <Chip label={`🔴 초과 ${exceeded}`} color="#dc2626" bg="#fee2e2" />}
      {warning  > 0 && <Chip label={`🟡 주의 ${warning}`}  color="#d97706" bg="#fef3c7" />}
      {normal   > 0 && <Chip label={`🟢 정상 ${normal}`}   color="#16a34a" bg="#dcfce7" />}
      <span style={{ fontSize: 12, color: '#9ca3af' }}>총 {assessments.length}건</span>
    </div>
  );
}

function fileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('image')) return '🖼';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('doc')) return '📝';
  return '📎';
}

// ── 유해인자 검색 피커 ────────────────────────────────────────────────────
interface SubstancePick { code: string; name: string; limitTwa?: string; limitStel?: string; }

function SubstancePicker({ value, onSelect }: { value: SubstancePick | null; onSelect: (p: SubstancePick) => void }) {
  const { hazard } = useServices();
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Array<{ category: HazardCategory; substance: HazardSubstance }>>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (value?.name !== undefined) setQuery(value.name); }, [value?.name]);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleQuery(q: string) {
    setQuery(q);
    if (q.length >= 2) {
      const res = hazard.searchCatalog(q).slice(0, 10);
      setResults(res);
      setOpen(res.length > 0);
    } else { setResults([]); setOpen(false); }
  }

  async function handleSelect(cat: HazardCategory, sub: HazardSubstance) {
    const code = `${cat.code}-${sub.no}`;
    const detail = await hazard.getHealthDetail({ categoryCode: cat.code, substanceNo: sub.no });
    onSelect({ code, name: sub.nameKo, limitTwa: detail?.exposureLimitKr?.twa, limitStel: detail?.exposureLimitKr?.stel });
    setQuery(sub.nameKo);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="input" value={query} onChange={(e) => handleQuery(e.target.value)} placeholder="유해인자 이름 검색 (2자 이상)" autoComplete="off" />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
          {results.map(({ category, substance }) => (
            <button key={`${category.code}-${substance.no}`} type="button" onMouseDown={() => handleSelect(category, substance)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
              <span style={{ fontWeight: 700 }}>{substance.nameKo}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>{category.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 공용 UI 헬퍼 ──────────────────────────────────────────────────────────
function ModalWrap({ title, onClose, children, maxWidth = 500 }: {
  title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ marginBottom: 0 }}><label>{label}</label>{children}</div>;
}

// ── 측정 회차 등록/수정 모달 ──────────────────────────────────────────────
function RoundModal({
  editing, onSave, onClose,
}: {
  editing: MeasurementRound | null;
  onSave: (dto: Omit<MeasurementRound, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name:      editing?.name      ?? suggestRoundName(today),
    startDate: editing?.startDate ?? today,
    endDate:   editing?.endDate   ?? '',
    agency:    editing?.agency    ?? '',
    note:      editing?.note      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleStartDate(date: string) {
    setForm((f) => ({
      ...f,
      startDate: date,
      name: f.name === suggestRoundName(f.startDate) ? suggestRoundName(date) : f.name,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      await onSave({
        name:      form.name.trim(),
        startDate: form.startDate,
        endDate:   form.endDate || undefined,
        agency:    form.agency.trim() || undefined,
        note:      form.note.trim()   || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <ModalWrap title={editing ? '측정 회차 수정' : '측정 회차 등록'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="회차명 *">
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="예) 2026년 상반기 정기측정" required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="측정 시작일 *">
            <input className="input" type="date" value={form.startDate} onChange={(e) => handleStartDate(e.target.value)} required />
          </Field>
          <Field label="측정 종료일">
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </Field>
        </div>
        <Field label="측정기관명">
          <input className="input" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} placeholder="예) (주)안전환경측정" />
        </Field>
        <Field label="비고">
          <input className="input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="특이사항" />
        </Field>
        {error && <ErrorAlert message={error} />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? '저장 중...' : editing ? '저장' : '등록'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

// ── 측정결과 등록 모달 ────────────────────────────────────────────────────
const EMPTY_MEAS_FORM = {
  measureDate: new Date().toISOString().slice(0, 10),
  department: '', twa: '', stel: '', unit: '', limitTwa: '', limitStel: '', note: '',
};

function MeasurementFormModal({
  roundId, depts, deptHazards, onSave, onClose,
}: {
  roundId: string;
  depts: Array<{ id: string; name: string }>;
  deptHazards: DepartmentHazard[];
  onSave: (dto: Omit<WorkplaceMeasurement, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  const { hazard } = useServices();
  const [form, setForm] = useState(EMPTY_MEAS_FORM);
  const [pick, setPick] = useState<SubstancePick | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChipSelect(categoryCode: HazardCategoryCode, substanceNo: number, substanceName: string) {
    const code = `${categoryCode}-${substanceNo}`;
    const detail = await hazard.getHealthDetail({ categoryCode, substanceNo });
    handleSubstanceSelect({ code, name: substanceName, limitTwa: detail?.exposureLimitKr?.twa, limitStel: detail?.exposureLimitKr?.stel });
  }

  function handleSubstanceSelect(p: SubstancePick) {
    setPick(p);
    const rawUnit = p.limitTwa ?? p.limitStel ?? '';
    const unitMatch = rawUnit.replace(/^C\s+/i, '').match(/[\d.]+\s*(.+)/);
    const unit = unitMatch
      ? unitMatch[1].trim().replace('㎎/㎥', 'mg/m³').replace('㎍/㎥', 'µg/m³').replace('㎎', 'mg')
      : '';
    setForm((f) => ({ ...f, unit, limitTwa: p.limitTwa ?? '', limitStel: p.limitStel ?? '' }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) { setError('유해인자를 선택해 주세요.'); return; }
    if (!form.unit.trim()) { setError('단위를 입력해 주세요.'); return; }
    setError(null); setSaving(true);
    try {
      await onSave({
        roundId,
        measureDate:    form.measureDate,
        department:     form.department.trim(),
        substanceCode:  pick.code,
        substanceName:  pick.name,
        twa:            form.twa  !== '' ? parseFloat(form.twa)  : undefined,
        stel:           form.stel !== '' ? parseFloat(form.stel) : undefined,
        unit:           form.unit.trim(),
        limitTwa:       form.limitTwa.trim()  || undefined,
        limitStel:      form.limitStel.trim() || undefined,
        note:           form.note.trim()      || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const chips = deptHazards.filter((dh) => dh.department === form.department);

  return (
    <ModalWrap title="측정결과 등록" onClose={onClose}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="측정일 *">
          <input className="input" type="date" value={form.measureDate} onChange={(e) => setForm({ ...form, measureDate: e.target.value })} required />
        </Field>
        <Field label="부서(공정) *">
          <input className="input" list="dept-list-mf" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="부서명 입력 또는 선택" required />
          <datalist id="dept-list-mf">{depts.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        </Field>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>유해인자 *</label>
          {chips.length > 0 && (
            <div style={{ marginBottom: 6, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>이 부서의 등록 유해인자</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {chips.map((dh) => {
                  const code = `${dh.categoryCode}-${dh.substanceNo}`;
                  const selected = pick?.code === code;
                  return (
                    <button key={dh.id} type="button"
                      onClick={() => handleChipSelect(dh.categoryCode, dh.substanceNo, dh.substanceName)}
                      style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, border: `1px solid ${selected ? '#2563eb' : '#d1d5db'}`, background: selected ? '#eff6ff' : '#fff', color: selected ? '#2563eb' : '#374151', cursor: 'pointer', fontWeight: 500 }}>
                      {dh.substanceName}{dh.process && <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 11 }}>({dh.process})</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>목록에 없으면 아래에서 검색해 주세요.</div>
            </div>
          )}
          <SubstancePicker value={pick} onSelect={handleSubstanceSelect} />
          {pick && !pick.limitTwa && !pick.limitStel && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: '#d97706' }}>⚠ 이 물질의 기준 정보가 없어요. 단위와 기준값을 직접 입력해 주세요.</div>
          )}
          {pick?.limitTwa && (
            <div style={{ marginTop: 4, fontSize: 11.5, color: '#2563eb' }}>✓ 법적 노출기준이 자동으로 채워졌어요. 필요하면 수정할 수 있어요.</div>
          )}
        </div>
        <Field label="단위 *">
          <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="예) ppm, mg/m³, dB(A), m/s²" required />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="TWA 기준"><input className="input" value={form.limitTwa} onChange={(e) => setForm({ ...form, limitTwa: e.target.value })} placeholder="예) 300 ppm" /></Field>
          <Field label="STEL 기준"><input className="input" value={form.limitStel} onChange={(e) => setForm({ ...form, limitStel: e.target.value })} placeholder="선택" /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label={`TWA 측정값${form.unit ? ` (${form.unit})` : ''}`}>
            <input className="input" type="number" step="any" min="0" value={form.twa} onChange={(e) => setForm({ ...form, twa: e.target.value })} placeholder="예) 150" />
          </Field>
          <Field label={`STEL 측정값${form.unit ? ` (${form.unit})` : ''}`}>
            <input className="input" type="number" step="any" min="0" value={form.stel} onChange={(e) => setForm({ ...form, stel: e.target.value })} placeholder="선택" />
          </Field>
        </div>
        <Field label="비고">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="측정 조건, 특이사항 등" />
        </Field>
        {error && <ErrorAlert message={error} />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? '등록 중...' : '등록'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

// ── 측정 결과 테이블 (공용) ───────────────────────────────────────────────
function MeasurementTable({
  assessments, onRemove,
}: {
  assessments: MeasurementAssessment[];
  onRemove: (id: string) => void;
}) {
  if (assessments.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {['측정일', '부서', '유해인자', 'TWA 실측/기준', 'STEL 실측/기준', '판정', '비고', ''].map((h, i) => (
              <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assessments.map(({ measurement: m, twaStatus, stelStatus, overallStatus }) => (
            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{m.measureDate}</td>
              <td style={{ padding: '8px 10px' }}>{m.department}</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{m.substanceName}</td>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}><ValueCell measured={m.twa}  limit={m.limitTwa}  unit={m.unit} status={twaStatus}  /></td>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}><ValueCell measured={m.stel} limit={m.limitStel} unit={m.unit} status={stelStatus} /></td>
              <td style={{ padding: '8px 10px' }}><StatusBadge status={overallStatus} /></td>
              <td style={{ padding: '8px 10px', color: '#6b7280', fontSize: 12 }}>{m.note ?? ''}</td>
              <td style={{ padding: '8px 10px' }}>
                <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444', fontSize: 11 }} onClick={() => onRemove(m.id)}>삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 측정 회차 카드 ────────────────────────────────────────────────────────
function RoundCard({
  round, measurements, documents, filterDept,
  onMeasurementAdd, onMeasurementRemove,
  onDocUpload, onDocRemove, onDocDownload,
  onEdit, onRemove, depts, deptHazards,
}: {
  round: MeasurementRound;
  measurements: MeasurementAssessment[];
  documents: MeasurementDocument[];
  filterDept: string;
  onMeasurementAdd: (dto: Omit<WorkplaceMeasurement, 'id'>) => Promise<void>;
  onMeasurementRemove: (id: string) => void;
  onDocUpload: (roundId: string, file: File) => Promise<void>;
  onDocRemove: (docId: string) => void;
  onDocDownload: (docId: string) => void;
  onEdit: () => void;
  onRemove: () => void;
  depts: Array<{ id: string; name: string }>;
  deptHazards: DepartmentHazard[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showMeasModal, setShowMeasModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = filterDept
    ? measurements.filter((m) => m.measurement.department === filterDept)
    : measurements;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onDocUpload(round.id, file);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const periodStr = round.endDate
    ? `${round.startDate} ~ ${round.endDate}`
    : `${round.startDate}~`;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      {/* 카드 헤더 */}
      <div
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, borderBottom: expanded ? '1px solid #f3f4f6' : 'none' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 15, marginTop: 2, flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{round.name}</span>
            <SummaryChips assessments={visible} />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
            {periodStr}
            {round.agency && <span style={{ marginLeft: 10 }}>측정기관: {round.agency}</span>}
          </div>
          {round.note && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{round.note}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn--ghost btn--sm" onClick={onEdit}>수정</button>
          <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444' }} onClick={onRemove}>삭제</button>
        </div>
      </div>

      {expanded && (
        <>
          {/* 첨부 서류 */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>📁 첨부 서류</span>
              <button className="btn btn--ghost btn--sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? '업로드 중...' : '＋ 서류 업로드'}
              </button>
              <input
                ref={fileRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.hwp,.hwpx"
                onChange={handleFileChange}
              />
            </div>
            {documents.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>첨부된 서류가 없어요. PDF, Excel, 이미지 등을 업로드할 수 있어요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {documents.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
                    <span style={{ flexShrink: 0 }}>{fileIcon(doc.mimeType)}</span>
                    <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.fileName}>{doc.fileName}</span>
                    {doc.label && <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0 }}>{doc.label}</span>}
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{formatFileSize(doc.fileSize)}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{doc.uploadedAt.slice(0, 10)}</span>
                    <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0 }} onClick={() => onDocDownload(doc.id)}>↓ 다운로드</button>
                    <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '2px 8px', color: '#ef4444', flexShrink: 0 }} onClick={() => onDocRemove(doc.id)}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 측정 결과 */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>📊 측정 결과</span>
              <button className="btn btn--primary btn--sm" onClick={() => setShowMeasModal(true)}>＋ 측정결과 등록</button>
            </div>
            {visible.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {filterDept ? `'${filterDept}' 부서의 측정 결과가 없어요.` : '등록된 측정 결과가 없어요.'}
              </div>
            ) : (
              <MeasurementTable assessments={visible} onRemove={onMeasurementRemove} />
            )}
          </div>
        </>
      )}

      {showMeasModal && (
        <MeasurementFormModal
          roundId={round.id}
          depts={depts}
          deptHazards={deptHazards}
          onSave={async (dto) => { await onMeasurementAdd(dto); setShowMeasModal(false); }}
          onClose={() => setShowMeasModal(false)}
        />
      )}
    </div>
  );
}

// ── 미분류 측정 기록 (roundId 없는 이전 데이터) ───────────────────────────
function UnlinkedSection({ measurements, filterDept, onRemove }: {
  measurements: MeasurementAssessment[];
  filterDept: string;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = filterDept ? measurements.filter((m) => m.measurement.department === filterDept) : measurements;
  if (visible.length === 0) return null;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12, borderColor: '#e5e7eb' }}>
      <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setExpanded((v) => !v)}>
        <span style={{ fontSize: 13 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#6b7280' }}>미분류 측정 기록 ({visible.length}건)</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>— 측정 회차 없이 등록된 이전 데이터</span>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6' }}>
          <MeasurementTable assessments={visible} onRemove={onRemove} />
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────
interface PageData {
  rounds: MeasurementRound[];
  measurementsByRound: Map<string, MeasurementAssessment[]>;
  unlinked: MeasurementAssessment[];
  docsByRound: Map<string, MeasurementDocument[]>;
}

export function WorkplaceMeasurementPage() {
  const { measurement, departments, hazard } = useServices();

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  const deptList = useAsync(() => departments.list(), []);
  const allDeptHazards = useAsync(() => hazard.getDepartmentHazards(), []);

  // 전체 데이터 로딩
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [rounds, allAssessments] = await Promise.all([
          measurement.listRounds(),
          measurement.list(),
        ]);

        const measurementsByRound = new Map<string, MeasurementAssessment[]>();
        const unlinked: MeasurementAssessment[] = [];
        for (const ma of allAssessments) {
          const roundId = ma.measurement.roundId;
          if (!roundId) {
            unlinked.push(ma);
          } else {
            const arr = measurementsByRound.get(roundId) ?? [];
            arr.push(ma);
            measurementsByRound.set(roundId, arr);
          }
        }

        const docsResults = await Promise.all(rounds.map((r) => measurement.listDocuments(r.id)));
        const docsByRound = new Map<string, MeasurementDocument[]>();
        rounds.forEach((r, i) => docsByRound.set(r.id, docsResults[i]));

        if (!cancelled) { setData({ rounds, measurementsByRound, unlinked, docsByRound }); setLoading(false); }
      } catch { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // 이벤트 핸들러
  const [roundModal, setRoundModal] = useState<{ open: boolean; editing: MeasurementRound | null }>({ open: false, editing: null });

  async function handleRoundSave(dto: Omit<MeasurementRound, 'id'>) {
    if (roundModal.editing) {
      await measurement.updateRound(roundModal.editing.id, dto);
    } else {
      await measurement.addRound(dto);
    }
    setRoundModal({ open: false, editing: null });
    refresh();
  }

  async function handleRoundRemove(id: string) {
    const round = data?.rounds.find((r) => r.id === id);
    const measCount = data?.measurementsByRound.get(id)?.length ?? 0;
    const docCount  = data?.docsByRound.get(id)?.length ?? 0;
    const parts = [];
    if (measCount > 0) parts.push(`측정 결과 ${measCount}건`);
    if (docCount  > 0) parts.push(`첨부 서류 ${docCount}건`);
    const detail = parts.length > 0 ? `\n포함된 ${parts.join(', ')}도 함께 삭제됩니다.` : '';
    if (!confirm(`"${round?.name}" 회차를 삭제할까요?${detail}`)) return;
    await measurement.removeRound(id);
    refresh();
  }

  async function handleMeasurementAdd(dto: Omit<WorkplaceMeasurement, 'id'>) {
    await measurement.add(dto);
    refresh();
  }

  function handleMeasurementRemove(id: string) {
    if (!confirm('이 측정 결과를 삭제할까요?')) return;
    measurement.remove(id).then(refresh);
  }

  async function handleDocUpload(roundId: string, file: File) {
    const arrayBuffer = await file.arrayBuffer();
    await measurement.addDocument(roundId, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      data: arrayBuffer,
    });
    refresh();
  }

  function handleDocRemove(docId: string) {
    if (!confirm('이 서류를 삭제할까요?')) return;
    measurement.removeDocument(docId).then(refresh);
  }

  async function handleDocDownload(docId: string) {
    const result = await measurement.loadFile(docId);
    if (!result) { alert('파일을 불러올 수 없어요.'); return; }
    const blob = new Blob([result.data], { type: result.doc.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const depts = deptList.data ?? [];
  const deptHazards = (allDeptHazards.data ?? []) as DepartmentHazard[];
  const isEmpty = !loading && (data?.rounds.length === 0) && (data?.unlinked.length === 0);

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* 상단 필터 + 회차 추가 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 160 }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">전체 부서</option>
          {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <button className="btn btn--primary" style={{ marginLeft: 'auto' }} onClick={() => setRoundModal({ open: true, editing: null })}>
          ＋ 측정 회차 추가
        </button>
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</div>
      ) : isEmpty ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>등록된 작업환경측정 회차가 없어요.</div>
          <div style={{ fontSize: 13 }}>
            위의 <strong>＋ 측정 회차 추가</strong>를 눌러 측정 기간을 먼저 만들고,<br />
            측정 결과와 관련 서류를 등록해 보세요.
          </div>
        </div>
      ) : (
        <>
          {(data?.rounds ?? []).map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              measurements={data?.measurementsByRound.get(round.id) ?? []}
              documents={data?.docsByRound.get(round.id) ?? []}
              filterDept={filterDept}
              onMeasurementAdd={handleMeasurementAdd}
              onMeasurementRemove={handleMeasurementRemove}
              onDocUpload={handleDocUpload}
              onDocRemove={handleDocRemove}
              onDocDownload={handleDocDownload}
              onEdit={() => setRoundModal({ open: true, editing: round })}
              onRemove={() => handleRoundRemove(round.id)}
              depts={depts}
              deptHazards={deptHazards}
            />
          ))}
          <UnlinkedSection
            measurements={data?.unlinked ?? []}
            filterDept={filterDept}
            onRemove={handleMeasurementRemove}
          />
        </>
      )}

      {/* 회차 등록/수정 모달 */}
      {roundModal.open && (
        <RoundModal
          editing={roundModal.editing}
          onSave={handleRoundSave}
          onClose={() => setRoundModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}
