import { useState, useRef, useEffect } from 'react';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorAlert } from '../components/ui';
import type { ExceedanceStatus, WorkplaceMeasurement } from '@domain/measurement/WorkplaceMeasurement';
import type { HazardCategory, HazardCategoryCode, HazardSubstance } from '@domain/hazard/HazardousSubstance';

// ─── 상태 뱃지 ──────────────────────────────────────────────
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

// ─── 유해인자 검색 피커 ──────────────────────────────────────
interface SubstancePick {
  code: string;
  name: string;
  limitTwa?: string;
  limitStel?: string;
}

function SubstancePicker({
  value,
  onSelect,
}: {
  value: SubstancePick | null;
  onSelect: (pick: SubstancePick) => void;
}) {
  const { hazard } = useServices();
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<Array<{ category: HazardCategory; substance: HazardSubstance }>>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.name !== undefined) setQuery(value.name);
  }, [value?.name]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleQuery(q: string) {
    setQuery(q);
    if (q.length >= 2) {
      const res = hazard.searchCatalog(q).slice(0, 10);
      setResults(res);
      setOpen(res.length > 0);
    } else {
      setResults([]);
      setOpen(false);
    }
  }

  async function handleSelect(cat: HazardCategory, sub: HazardSubstance) {
    const code = `${cat.code}-${sub.no}`;
    const detail = await hazard.getHealthDetail({ categoryCode: cat.code, substanceNo: sub.no });
    const limitTwa = detail?.exposureLimitKr?.twa;
    const limitStel = detail?.exposureLimitKr?.stel;
    onSelect({ code, name: sub.nameKo, limitTwa, limitStel });
    setQuery(sub.nameKo);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={(e) => handleQuery(e.target.value)}
        placeholder="유해인자 이름 검색 (2자 이상)"
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {results.map(({ category, substance }) => (
            <button
              key={`${category.code}-${substance.no}`}
              type="button"
              onMouseDown={() => handleSelect(category, substance)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontWeight: 700 }}>{substance.nameKo}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: '#9ca3af' }}>{category.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────
const EMPTY_FORM = {
  measureDate: new Date().toISOString().slice(0, 10),
  department: '',
  twa: '',
  stel: '',
  unit: '',
  limitTwa: '',
  limitStel: '',
  note: '',
};

export function WorkplaceMeasurementPage() {
  const { measurement, departments, hazard } = useServices();

  const [filterDept, setFilterDept] = useState('');
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((n) => n + 1);

  const deptList = useAsync(() => departments.list(), []);
  const allDeptHazards = useAsync(() => hazard.getDepartmentHazards(), []);
  const results = useAsync(() => measurement.list(filterDept || undefined), [filterDept, reload]);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pick, setPick] = useState<SubstancePick | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function openModal() {
    setForm(EMPTY_FORM);
    setPick(null);
    setSaveError(null);
    setShowModal(true);
  }

  async function handleChipSelect(categoryCode: HazardCategoryCode, substanceNo: number, substanceName: string) {
    const code = `${categoryCode}-${substanceNo}`;
    const detail = await hazard.getHealthDetail({ categoryCode, substanceNo });
    handleSubstanceSelect({
      code,
      name: substanceName,
      limitTwa: detail?.exposureLimitKr?.twa,
      limitStel: detail?.exposureLimitKr?.stel,
    });
  }

  function handleSubstanceSelect(p: SubstancePick) {
    setPick(p);
    const rawUnit = p.limitTwa ?? p.limitStel ?? '';
    const unitMatch = rawUnit.replace(/^C\s+/i, '').match(/[\d.]+\s*(.+)/);
    const unit = unitMatch
      ? unitMatch[1].trim().replace('㎎/㎥', 'mg/m³').replace('㎍/㎥', 'µg/m³').replace('㎎', 'mg')
      : '';
    setForm(prev => ({ ...prev, unit, limitTwa: p.limitTwa ?? '', limitStel: p.limitStel ?? '' }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) { setSaveError('유해인자를 선택해 주세요.'); return; }
    if (!form.unit.trim()) { setSaveError('단위를 입력해 주세요.'); return; }
    setSaveError(null);
    setSaving(true);
    try {
      const dto: Omit<WorkplaceMeasurement, 'id'> = {
        measureDate: form.measureDate,
        department: form.department.trim(),
        substanceCode: pick.code,
        substanceName: pick.name,
        twa: form.twa !== '' ? parseFloat(form.twa) : undefined,
        stel: form.stel !== '' ? parseFloat(form.stel) : undefined,
        unit: form.unit.trim(),
        limitTwa: form.limitTwa.trim() || undefined,
        limitStel: form.limitStel.trim() || undefined,
        note: form.note.trim() || undefined,
      };
      await measurement.add(dto);
      setShowModal(false);
      refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('이 측정 결과를 삭제할까요?')) return;
    await measurement.remove(id);
    refresh();
  }

  const depts = deptList.data ?? [];

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* 필터 + 등록 버튼 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="input"
          style={{ width: 160 }}
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="">전체 부서</option>
          {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <button className="btn btn--primary" onClick={openModal} style={{ marginLeft: 'auto' }}>
          ＋ 측정결과 등록
        </button>
      </div>

      {/* 요약 뱃지 */}
      <SummaryBar results={results.data ?? []} />

      {/* 측정 결과 테이블 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {results.loading ? (
          <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>불러오는 중...</div>
        ) : (results.data ?? []).length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            등록된 작업환경측정 결과가 없어요.
            <br />
            <span style={{ fontSize: 12 }}>유해인자별 TWA·STEL 측정값을 등록하면 법적 노출기준 초과 여부를 자동으로 확인해요.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['측정일', '부서', '유해인자', 'TWA 실측/기준', 'STEL 실측/기준', '판정', '비고', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(results.data ?? []).map(({ measurement: m, twaStatus, stelStatus, overallStatus }) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{m.measureDate}</td>
                    <td style={{ padding: '10px 12px' }}>{m.department}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.substanceName}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <ValueCell measured={m.twa} limit={m.limitTwa} unit={m.unit} status={twaStatus} />
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <ValueCell measured={m.stel} limit={m.limitStel} unit={m.unit} status={stelStatus} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge status={overallStatus} />
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{m.note ?? ''}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button className="btn btn--ghost btn--sm" style={{ color: '#ef4444', fontSize: 11 }} onClick={() => handleRemove(m.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>작업환경측정 결과 등록</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>측정일 *</label>
                <input className="input" type="date" value={form.measureDate} onChange={(e) => setForm({ ...form, measureDate: e.target.value })} required />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>부서(공정) *</label>
                <input
                  className="input"
                  list="dept-list"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="부서명 입력 또는 선택"
                  required
                />
                <datalist id="dept-list">
                  {depts.map((d) => <option key={d.id} value={d.name} />)}
                </datalist>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>유해인자 *</label>
                {/* 부서 등록 유해인자 칩 */}
                {(() => {
                  const chips = (allDeptHazards.data ?? []).filter((dh) => dh.department === form.department);
                  if (!form.department || chips.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 6, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>이 부서의 등록 유해인자</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {chips.map((dh) => {
                          const code = `${dh.categoryCode}-${dh.substanceNo}`;
                          const selected = pick?.code === code;
                          return (
                            <button
                              key={dh.id}
                              type="button"
                              onClick={() => handleChipSelect(dh.categoryCode, dh.substanceNo, dh.substanceName)}
                              style={{
                                fontSize: 12, padding: '3px 10px', borderRadius: 20,
                                border: `1px solid ${selected ? '#2563eb' : '#d1d5db'}`,
                                background: selected ? '#eff6ff' : '#fff',
                                color: selected ? '#2563eb' : '#374151',
                                cursor: 'pointer', fontWeight: 500, transition: 'all .15s',
                              }}
                            >
                              {dh.substanceName}
                              {dh.process && <span style={{ color: '#9ca3af', marginLeft: 4, fontSize: 11 }}>({dh.process})</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>목록에 없으면 아래에서 검색해 주세요.</div>
                    </div>
                  );
                })()}
                {/* 전체 카탈로그 검색 */}
                <SubstancePicker value={pick} onSelect={handleSubstanceSelect} />
                {pick && !pick.limitTwa && !pick.limitStel && (
                  <div style={{ marginTop: 4, fontSize: 11.5, color: '#d97706' }}>
                    ⚠ 이 물질의 기준 정보가 없어요. 단위와 기준값을 직접 입력해 주세요.
                  </div>
                )}
                {pick?.limitTwa && (
                  <div style={{ marginTop: 4, fontSize: 11.5, color: '#2563eb' }}>
                    ✓ 법적 노출기준이 자동으로 채워졌어요. 필요하면 수정할 수 있어요.
                  </div>
                )}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>단위 *</label>
                <input
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="예) ppm, mg/m³, dB(A), m/s²"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>TWA 기준</label>
                  <input
                    className="input"
                    value={form.limitTwa}
                    onChange={(e) => setForm({ ...form, limitTwa: e.target.value })}
                    placeholder="예) 300 ppm"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>STEL 기준</label>
                  <input
                    className="input"
                    value={form.limitStel}
                    onChange={(e) => setForm({ ...form, limitStel: e.target.value })}
                    placeholder="선택"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>TWA 측정값 {form.unit ? `(${form.unit})` : ''}</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min="0"
                    value={form.twa}
                    onChange={(e) => setForm({ ...form, twa: e.target.value })}
                    placeholder="예) 150"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>STEL 측정값 {form.unit ? `(${form.unit})` : ''}</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min="0"
                    value={form.stel}
                    onChange={(e) => setForm({ ...form, stel: e.target.value })}
                    placeholder="선택"
                  />
                </div>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>비고</label>
                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="측정 조건, 특이사항 등" />
              </div>

              {saveError && <ErrorAlert message={saveError} />}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? '등록 중...' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 요약 바 ─────────────────────────────────────────────────
function SummaryBar({ results }: { results: Array<{ overallStatus: ExceedanceStatus }> }) {
  if (results.length === 0) return null;
  const exceeded = results.filter((r) => r.overallStatus === 'exceeded').length;
  const warning = results.filter((r) => r.overallStatus === 'warning').length;
  const normal = results.filter((r) => r.overallStatus === 'normal').length;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <Chip label={`🔴 초과 ${exceeded}건`} color="#dc2626" bg="#fee2e2" />
      <Chip label={`🟡 주의 ${warning}건`} color="#d97706" bg="#fef3c7" />
      <Chip label={`🟢 정상 ${normal}건`} color="#16a34a" bg="#dcfce7" />
      <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>총 {results.length}건</span>
    </div>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20, color, background: bg }}>{label}</span>
  );
}

// ─── 측정값/기준 셀 ───────────────────────────────────────────
function ValueCell({ measured, limit, unit, status }: {
  measured: number | undefined;
  limit: string | undefined;
  unit: string;
  status: ExceedanceStatus;
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
