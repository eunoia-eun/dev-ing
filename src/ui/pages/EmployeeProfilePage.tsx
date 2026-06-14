import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FOLLOW_UP_ACTION_LABEL,
  FOLLOW_UP_ACTIONS,
  HEALTH_GRADE_LABEL,
  WORK_FITNESS_LABEL,
  followUpLabels,
  gradeTone,
  isBuiltinCheckupType,
  isBuiltinLabItem,
  resolveCheckupTypeName,
  type CheckupType,
  type CheckupTypeItem,
  type FollowUpAction,
  type HealthCheckup,
  type HealthGrade,
  type LabItem,
  type LabResult,
  type WorkFitness,
} from '@domain/checkup/HealthCheckup';
import { buildLabTrend, defaultLabRange } from '@domain/checkup/labTrend';
import { isCurrentAssignment, type Assignment } from '@domain/employee/Assignment';
import type { DepartmentHazardView } from '@domain/hazard/DepartmentHazard';
import type { ExposureAssessment } from '@domain/hazard/ExposureAssessment';
import type { HazardCategoryCode } from '@domain/hazard/HazardousSubstance';
import type { EmployeeHealthProfile } from '@application/usecases/EmployeeProfileService';
import type { ChangeAssignmentResult } from '@application/usecases/AssignmentService';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Modal, Spinner } from '../components/ui';
import { ExposureStatusBadge } from '../components/StatusBadge';
import { EmployeePicker } from '../components/EmployeePicker';
import { EmployeeModal } from '../components/EmployeeModal';
import { LineChart, type LinePoint } from '../components/LineChart';
import { describeDaysUntil, formatDate, formatDateTime } from '../format';

export function EmployeeProfilePage() {
  const { profile, employees, labItems, checkupTypes, assignments, departments } = useServices();
  const { id } = useParams();
  const navigate = useNavigate();
  const selectedId = id ?? '';

  const emp = useAsync(() => employees.list(), []);
  const cat = useAsync(() => labItems.list(), []); // 검사 항목 카탈로그(전체)
  const types = useAsync(() => checkupTypes.list(), []); // 검진 종류 카탈로그
  const deptList = useAsync(() => departments.list(), []); // 부서 목록(인적사항 수정용)
  const prof = useAsync(
    () => (selectedId ? profile.getProfile(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  const assign = useAsync(
    () => (selectedId ? assignments.getTimeline(selectedId) : Promise.resolve([])),
    [selectedId],
  );

  const [modal, setModal] = useState<{ open: boolean; editing: HealthCheckup | null }>({
    open: false,
    editing: null,
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <Link className="btn btn--ghost btn--sm" to="/employees">
          ← 부서 명부
        </Link>
        <div className="grow" style={{ maxWidth: 360 }}>
          <EmployeePicker
            employees={emp.data ?? []}
            value={selectedId}
            onChange={(v) => navigate(v ? `/employees/${v}` : '/employees')}
            placeholder="다른 임직원 선택 (이름·사번 검색)"
          />
        </div>
      </div>

      {!selectedId ? (
        <EmptyState icon="🧑‍⚕️">임직원을 선택하면 통합 건강 프로필이 표시돼요.</EmptyState>
      ) : prof.loading ? (
        <Spinner />
      ) : prof.error ? (
        <ErrorAlert message={prof.error} />
      ) : prof.data ? (
        <ProfileView
          profile={prof.data}
          assignments={assign.data ?? []}
          labItems={cat.data ?? []}
          checkupTypes={types.data ?? []}
          departments={(deptList.data ?? []).map((d) => d.name)}
          onAddCheckup={() => setModal({ open: true, editing: null })}
          onEditCheckup={(c) => setModal({ open: true, editing: c })}
          onReload={() => {
            prof.reload();
            assign.reload();
            emp.reload();
          }}
        />
      ) : null}

      {modal.open && selectedId && (
        <CheckupModal
          employeeId={selectedId}
          editing={modal.editing}
          labItems={cat.data ?? []}
          checkupTypes={types.data ?? []}
          onLabItemsChanged={cat.reload}
          onCheckupTypesChanged={types.reload}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={() => {
            setModal({ open: false, editing: null });
            prof.reload();
          }}
        />
      )}
    </div>
  );
}

function ProfileView({
  profile,
  assignments,
  labItems,
  checkupTypes,
  departments,
  onAddCheckup,
  onEditCheckup,
  onReload,
}: {
  profile: EmployeeHealthProfile;
  assignments: Assignment[];
  labItems: LabItem[];
  checkupTypes: CheckupTypeItem[];
  departments: string[];
  onAddCheckup: () => void;
  onEditCheckup: (c: HealthCheckup) => void;
  onReload: () => void;
}) {
  const { checkup, hazard } = useServices();
  const { employee: e, exposures, recentVisits, recentSymptoms, recentMedications, checkups, latestCheckup } = profile;
  // exposureAdd: null=닫힘, 문자열=새 노출의 기본 시작일(배치 시작일/오늘)
  const [exposureAdd, setExposureAdd] = useState<string | null>(null);
  const [assignChange, setAssignChange] = useState(false);
  const [editPersonal, setEditPersonal] = useState(false);
  // 배치 묶음 펼침/접힘 — 기본: 모두 펼침(부서·노출 변경 이력을 한눈에 확인). 사용자가 누른 항목만 접음.
  const [toggledAssign, setToggledAssign] = useState<Set<string>>(new Set());
  const isAssignExpanded = (a: Assignment) => !toggledAssign.has(a.id);
  const toggleAssign = (id: string) =>
    setToggledAssign((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 배치 기간별로 노출을 묶는다(노출 시작일이 배치 기간에 들어가면 그 배치 소속). 최신 배치 먼저.
  const sortedAssignments = [...assignments].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const assignmentIdOf = (startDate: string): string | null => {
    for (const a of assignments) {
      const inRange = startDate >= a.startDate && (isCurrentAssignment(a) || startDate <= (a.endDate ?? ''));
      if (inRange) return a.id;
    }
    return null;
  };
  const exposuresByAssignment = new Map<string, ExposureAssessment[]>();
  for (const ex of exposures) {
    const key = assignmentIdOf(ex.record.startDate) ?? '__none__';
    const list = exposuresByAssignment.get(key) ?? [];
    list.push(ex);
    exposuresByAssignment.set(key, list);
  }
  const unmatched = exposuresByAssignment.get('__none__') ?? [];

  // 부서별 유해인자 매핑(카탈로그) — 현재 배치 부서의 '표준 유해인자'를 프로필에서 바로 등록
  const deptHazAsync = useAsync(() => hazard.getDepartmentHazards(), []);
  const deptHazByDept = useMemo(() => {
    const m = new Map<string, DepartmentHazardView[]>();
    for (const dh of deptHazAsync.data ?? []) {
      const arr = m.get(dh.department) ?? [];
      arr.push(dh);
      m.set(dh.department, arr);
    }
    return m;
  }, [deptHazAsync.data]);
  // 이미 진행 중 노출로 등록된 유해인자 키
  const activeExposureKeys = new Set(
    exposures
      .filter((ex) => ex.status !== 'ended')
      .map((ex) => `${ex.record.categoryCode}-${ex.record.substanceNo}`),
  );

  async function registerStandardHazard(startDate: string, h: DepartmentHazardView) {
    await hazard.addExposure({
      employeeId: e.id,
      ref: { categoryCode: h.categoryCode, substanceNo: h.substanceNo },
      startDate,
    });
    onReload();
  }
  async function registerMissingStandard(startDate: string, missing: DepartmentHazardView[]) {
    for (const h of missing) {
      await hazard.addExposure({
        employeeId: e.id,
        ref: { categoryCode: h.categoryCode, substanceNo: h.substanceNo },
        startDate,
      });
    }
    onReload();
  }

  /** 현재 배치 부서의 '표준 유해인자' 칩 행 — 등록됨(✓)/미등록(＋등록) */
  function standardHazardRow(a: Assignment) {
    const std = deptHazByDept.get(a.department) ?? [];
    if (std.length === 0) return null;
    const missing = std.filter((h) => !activeExposureKeys.has(`${h.categoryCode}-${h.substanceNo}`));
    return (
      <tr>
        <td colSpan={6} style={{ paddingLeft: 20 }}>
          <div className="row row--wrap" style={{ gap: 6, alignItems: 'center' }}>
            <span className="muted small">부서 표준 유해인자:</span>
            {std.map((h) => {
              const key = `${h.categoryCode}-${h.substanceNo}`;
              return activeExposureKeys.has(key) ? (
                <span key={key} className="badge badge--muted">
                  ✓ {h.substanceName}
                </span>
              ) : (
                <button
                  key={key}
                  className="btn btn--ghost btn--sm"
                  title="이 배치 시작일로 노출 등록"
                  onClick={() => registerStandardHazard(a.startDate, h)}
                >
                  ＋ {h.substanceName}
                </button>
              );
            })}
            {missing.length > 0 && (
              <button className="btn btn--sm" onClick={() => registerMissingStandard(a.startDate, missing)}>
                미등록 {missing.length}건 일괄 등록
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function exposureRow(a: ExposureAssessment) {
    const r = a.record;
    const ended = a.status === 'ended';
    const period = `${formatDate(r.startDate)} ~ ${r.endDate ? formatDate(r.endDate) : '현재'}`;
    return (
      <tr key={r.id} style={ended ? { opacity: 0.6 } : undefined}>
        <td style={{ paddingLeft: 20 }}>
          <strong>{r.substanceName}</strong>
        </td>
        <td className="small">{period}</td>
        <td className="small">{r.lastExamDate ? formatDate(r.lastExamDate) : '미실시'}</td>
        <td className="small">
          {ended ? (
            <span className="muted">—</span>
          ) : (
            <>
              {formatDate(a.nextExamDueDate)}
              <div className="muted small">{describeDaysUntil(a.daysUntilDue)}</div>
            </>
          )}
        </td>
        <td>
          <ExposureStatusBadge status={a.status} />
        </td>
        <td className="num">
          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
            {!ended && (
              <>
                <button className="btn btn--sm" onClick={() => recordExam(r.id)}>
                  검진 기록
                </button>
                <button className="btn btn--sm" onClick={() => endExposure(r.id, r.substanceName)}>
                  노출 종료
                </button>
              </>
            )}
            <button className="btn btn--danger btn--sm" onClick={() => removeExposure(r.id, r.substanceName)}>
              삭제
            </button>
          </div>
        </td>
      </tr>
    );
  }

  async function endExposure(id: string, name: string) {
    const date = prompt(`'${name}' 노출 종료일을 입력하세요 (YYYY-MM-DD)`, todayISO());
    if (!date) return;
    await hazard.endExposure(id, date);
    onReload();
  }

  async function removeCheckup(c: HealthCheckup) {
    if (!confirm(`${formatDate(c.examDate)} ${resolveCheckupTypeName(c.type, checkupTypes)} 기록을 삭제할까요?`))
      return;
    await checkup.remove(c.id);
    onReload();
  }

  async function recordExam(id: string) {
    const date = prompt('특수건강진단 실시일을 입력하세요 (YYYY-MM-DD)', todayISO());
    if (!date) return;
    await hazard.recordExam(id, date);
    onReload();
  }

  async function removeExposure(id: string, name: string) {
    if (!confirm(`'${name}' 노출 기록을 삭제할까요?`)) return;
    await hazard.removeExposure(id);
    onReload();
  }

  return (
    <div className="stack">
      {/* 헤더 */}
      <Card>
        <div className="row spread row--wrap" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22 }}>{e.name}</h2>
            <div className="muted">
              {e.department}
              {e.position ? ` · ${e.position}` : ''} · 사번 {e.employeeNumber}
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              담당 업무: <strong>{e.jobTitle}</strong> · 입사일 {formatDate(e.hireDate)}
              {e.birthDate ? ` · ${formatDate(e.birthDate)}` : ''}
              {e.gender ? ` · ${e.gender === 'M' ? '남' : '여'}` : ''}
              {e.phone ? ` · ${e.phone}` : ''}
            </div>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            {latestCheckup && (
              <div style={{ textAlign: 'right' }}>
                <div className="muted small">최근 판정 ({formatDate(latestCheckup.examDate)})</div>
                <span className={`badge badge--${gradeTone(latestCheckup.grade)}`} style={{ fontSize: 13 }}>
                  {HEALTH_GRADE_LABEL[latestCheckup.grade]}
                </span>
              </div>
            )}
            <button className="btn btn--sm" onClick={() => setEditPersonal(true)}>
              인적사항 수정
            </button>
          </div>
        </div>
      </Card>

      {/* 배치 · 유해물질 노출 통합 이력 */}
      <Card
        title="배치 · 유해물질 노출 이력"
        bodyClassName=""
        actions={
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn--sm" onClick={() => setAssignChange(true)}>
              발령/배치 변경
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => setExposureAdd(todayISO())}>
              ＋ 노출 등록
            </button>
          </div>
        }
      >
        {assignments.length === 0 && exposures.length === 0 ? (
          <div className="empty">
            <span className="ico">🗂️</span>배치·노출 이력이 없어요.
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>유해인자</th>
                  <th>노출 기간</th>
                  <th>최근 검진</th>
                  <th>다음 예정</th>
                  <th>상태</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedAssignments.map((a) => {
                  const list = exposuresByAssignment.get(a.id) ?? [];
                  const expanded = isAssignExpanded(a);
                  return (
                    <Fragment key={a.id}>
                      <tr className="group-row">
                        <td colSpan={6}>
                          <div className="row spread row--wrap" style={{ gap: 8, alignItems: 'center' }}>
                            <span
                              onClick={() => toggleAssign(a.id)}
                              style={{ cursor: 'pointer', userSelect: 'none' }}
                              title={expanded ? '접기' : '펼치기'}
                            >
                              <span style={{ marginRight: 6, color: 'var(--text-muted)' }}>
                                {expanded ? '▾' : '▸'}
                              </span>
                              <strong>{a.department}</strong> · {a.jobTitle}
                              <span className="muted small">
                                {' '}
                                · {formatDate(a.startDate)} ~{' '}
                                {isCurrentAssignment(a) ? '현재' : formatDate(a.endDate)}
                              </span>
                              {isCurrentAssignment(a) && (
                                <span className="badge badge--ok" style={{ marginLeft: 6 }}>
                                  현재
                                </span>
                              )}
                              {a.note && <span className="muted small"> · {a.note}</span>}
                              {!expanded && (
                                <span className="muted small"> · 노출 {list.length}건</span>
                              )}
                            </span>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setExposureAdd(a.startDate)}
                            >
                              ＋ 이 배치에 노출
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <>
                          {list.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="muted small" style={{ paddingLeft: 20 }}>
                                이 배치 기간의 노출 기록 없음
                              </td>
                            </tr>
                          ) : (
                            list.map((ex) => exposureRow(ex))
                          )}
                          {isCurrentAssignment(a) && standardHazardRow(a)}
                        </>
                      )}
                    </Fragment>
                  );
                })}
                {unmatched.length > 0 && (
                  <Fragment>
                    <tr className="group-row">
                      <td colSpan={6}>
                        <span className="muted">배치 기간과 매칭되지 않은 노출</span>
                      </td>
                    </tr>
                    {unmatched.map((ex) => exposureRow(ex))}
                  </Fragment>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 최근 증상 / 수령 약물 */}
      <Card title="최근 불편 증상 · 수령 약물 · 조치">
          <div className="field" style={{ marginBottom: 10 }}>
            <label>최근 증상</label>
            <div className="row row--wrap" style={{ gap: 6 }}>
              {recentSymptoms.length === 0 ? (
                <span className="muted small">기록 없음</span>
              ) : (
                recentSymptoms.map((s) => (
                  <span key={s} className="badge badge--warning">
                    {s}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>최근 수령 약물</label>
            <div className="row row--wrap" style={{ gap: 6 }}>
              {recentMedications.length === 0 ? (
                <span className="muted small">기록 없음</span>
              ) : (
                recentMedications.map((m) => (
                  <span key={m} className="badge badge--muted">
                    {m}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>최근 방문 ({recentVisits.length})</label>
            {recentVisits.length === 0 ? (
              <span className="muted small">방문 기록 없음</span>
            ) : (
              <ul className="list-reset stack" style={{ gap: 6 }}>
                {recentVisits.map((v) => (
                  <li key={v.id} className="small">
                    <span className="muted">{formatDateTime(v.visitedAt)}</span> · {v.symptoms.join(', ')}
                    {v.action ? ` → ${v.action}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

      {/* 건강검진 결과 (사후관리소견) */}
      <Card
        title="건강검진 결과 (사후관리소견)"
        actions={
          <button className="btn btn--primary btn--sm" onClick={onAddCheckup}>
            ＋ 검진 추가
          </button>
        }
        bodyClassName=""
      >
        {checkups.length === 0 ? (
          <div className="empty">
            <span className="ico">🩺</span>건강검진 기록이 없어요.
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>검진일</th>
                  <th>종류</th>
                  <th>판정</th>
                  <th>적합여부</th>
                  <th>사후관리</th>
                  <th>소견 / 다음검진</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {checkups.map((c) => (
                  <tr key={c.id}>
                    <td className="small">{formatDate(c.examDate)}</td>
                    <td className="small">
                      {resolveCheckupTypeName(c.type, checkupTypes)}
                      {c.targetHazards && c.targetHazards.length > 0 && (
                        <div className="muted small">{c.targetHazards.join(', ')}</div>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge--${gradeTone(c.grade)}`}>{HEALTH_GRADE_LABEL[c.grade]}</span>
                    </td>
                    <td className="small">{c.workFitness ? WORK_FITNESS_LABEL[c.workFitness] : '-'}</td>
                    <td className="small">{followUpLabels(c.followUpActions)}</td>
                    <td className="small">
                      {c.opinion ?? '-'}
                      {c.nextExamDate && (
                        <div className="muted small">다음 검진 {formatDate(c.nextExamDate)}</div>
                      )}
                    </td>
                    <td className="num">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn btn--sm" onClick={() => onEditCheckup(c)}>
                          수정
                        </button>
                        <button className="btn btn--danger btn--sm" onClick={() => removeCheckup(c)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 검사 수치 추이 (맨 아래) */}
      <LabTrendCard checkups={checkups} labItems={labItems} checkupTypes={checkupTypes} />

      {exposureAdd !== null && (
        <AddExposureModal
          employeeId={e.id}
          defaultStartDate={exposureAdd}
          onClose={() => setExposureAdd(null)}
          onSaved={() => {
            setExposureAdd(null);
            onReload();
          }}
        />
      )}

      {assignChange && (
        <ChangeAssignmentModal
          employeeId={e.id}
          currentDepartment={e.department}
          currentJobTitle={e.jobTitle}
          onClose={() => setAssignChange(false)}
          onDone={() => {
            setAssignChange(false);
            onReload();
          }}
        />
      )}

      {editPersonal && (
        <EmployeeModal
          departments={departments}
          defaultDept={e.department}
          editing={e}
          onClose={() => setEditPersonal(false)}
          onSaved={() => {
            setEditPersonal(false);
            onReload();
          }}
        />
      )}
    </div>
  );
}

/**
 * 발령/배치 변경 모달 (2단계)
 *  1) 새 부서·업무·변경일 입력 → 변경 실행(이전 배치·노출 자동 종료)
 *  2) 새 부서 유해인자 제안을 골라 노출 일괄 등록
 */
function ChangeAssignmentModal({
  employeeId,
  currentDepartment,
  currentJobTitle,
  onClose,
  onDone,
}: {
  employeeId: string;
  currentDepartment: string;
  currentJobTitle: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { assignments, departments, hazard } = useServices();
  const deptList = useAsync(() => departments.list(), []);
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 2단계 상태
  const [result, setResult] = useState<ChangeAssignmentResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function applyChange() {
    if (!department.trim() || !jobTitle.trim()) return setError('새 부서와 담당 업무를 입력하세요.');
    if (!effectiveDate) return setError('변경(발령)일을 입력하세요.');
    setBusy(true);
    setError(null);
    try {
      const r = await assignments.changeAssignment({
        employeeId,
        department,
        jobTitle,
        effectiveDate,
        note,
      });
      // 제안 전체를 기본 선택
      setPicked(new Set(r.suggestions.map((s) => `${s.categoryCode}-${s.substanceNo}`)));
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function registerSelected() {
    if (!result) return;
    setBusy(true);
    try {
      for (const s of result.suggestions) {
        if (!picked.has(`${s.categoryCode}-${s.substanceNo}`)) continue;
        await hazard.addExposure({
          employeeId,
          ref: { categoryCode: s.categoryCode, substanceNo: s.substanceNo },
          startDate: effectiveDate,
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── 2단계: 새 노출 제안 ──
  if (result) {
    return (
      <Modal
        title="배치 변경 완료 · 새 노출 등록"
        onClose={onDone}
        footer={
          <>
            <button className="btn" onClick={onDone} disabled={busy}>
              건너뛰기
            </button>
            <button className="btn btn--primary" onClick={registerSelected} disabled={busy}>
              선택 노출 등록
            </button>
          </>
        }
      >
        {error && <ErrorAlert message={error} />}
        <div className="alert alert--info">
          진행 중 노출 <strong>{result.endedExposures}건</strong>을 {formatDate(effectiveDate)} 전날로 종료하고,{' '}
          <strong>{department}</strong> 배치를 시작했어요.
        </div>
        {result.suggestions.length === 0 ? (
          <div className="muted small">
            {department}에 매핑된 유해인자가 없어요. (유해인자 카탈로그 → 부서별 유해인자에서 먼저 묶어두면
            다음부터 자동으로 제안돼요.)
          </div>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 6 }}>
              <label>새 부서 유해인자 — 등록할 항목 선택</label>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {result.suggestions.map((s) => {
                const key = `${s.categoryCode}-${s.substanceNo}`;
                return (
                  <label key={key} className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={picked.has(key)} onChange={() => toggle(key)} />
                    <span>
                      <strong>{s.substanceName}</strong>
                      {s.process && <span className="muted small"> · {s.process}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              선택한 유해인자는 {formatDate(effectiveDate)}부터 노출 시작으로 등록돼요.
            </div>
          </>
        )}
      </Modal>
    );
  }

  // ── 1단계: 변경 입력 ──
  return (
    <Modal
      title="발령/배치 변경"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn--primary" onClick={applyChange} disabled={busy}>
            변경
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="alert alert--info">
        현재: <strong>{currentDepartment}</strong> · {currentJobTitle}
        <div className="muted small">
          변경하면 이전 배치와 진행 중 노출이 변경일 전날로 자동 종료되고, 새 부서 유해인자를 제안해요.
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>새 부서 *</label>
          <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">선택하세요</option>
            {(deptList.data ?? []).map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>변경(발령)일 *</label>
          <input
            className="input"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>새 담당 업무 *</label>
        <input
          className="input"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="예: 시약 분석"
        />
      </div>
      <div className="field">
        <label>비고</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 부서 이동 발령" />
      </div>
    </Modal>
  );
}

function AddExposureModal({
  employeeId,
  defaultStartDate,
  onClose,
  onSaved,
}: {
  employeeId: string;
  defaultStartDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { hazard } = useServices();
  const catalog = useMemo(() => hazard.getCatalog(), [hazard]);
  const [categoryCode, setCategoryCode] = useState<HazardCategoryCode>(catalog.categories[0].code);
  const [substanceNo, setSubstanceNo] = useState<number>(catalog.categories[0].substances[0].no);
  const [startDate, setStartDate] = useState(defaultStartDate || todayISO());
  const [lastExamDate, setLastExamDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const category = catalog.categories.find((c) => c.code === categoryCode)!;

  async function submit() {
    if (!startDate) {
      setError('배치(노출 시작)일을 입력하세요.');
      return;
    }
    try {
      await hazard.addExposure({
        employeeId,
        ref: { categoryCode, substanceNo },
        startDate,
        lastExamDate: lastExamDate || undefined,
        note: note || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title="유해인자 노출 등록"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" onClick={submit}>
            등록
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="field">
        <label>유해인자 분류</label>
        <select
          className="select"
          value={categoryCode}
          onChange={(e) => {
            const code = e.target.value as HazardCategoryCode;
            setCategoryCode(code);
            const first = catalog.categories.find((c) => c.code === code)!.substances[0];
            setSubstanceNo(first.no);
          }}
        >
          {catalog.categories.map((c) => (
            <option key={c.code} value={c.code}>
              [{c.group}] {c.name} ({c.substances.length})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>유해인자(물질)</label>
        <select className="select" value={substanceNo} onChange={(e) => setSubstanceNo(Number(e.target.value))}>
          {category.substances.map((s) => (
            <option key={s.no} value={s.no}>
              {s.nameKo}
              {s.cas ? ` (${s.cas})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="alert alert--info">
        검진 주기 기준: 배치 후 최초 <strong>{category.firstExamMonths}개월</strong>, 이후 주기{' '}
        <strong>{category.cycleMonths}개월</strong> (별표 23 분류별 기본값)
      </div>
      <div className="form-row">
        <div className="field">
          <label>배치(노출 시작)일 *</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>최근 특수검진일 (있으면)</label>
          <input className="input" type="date" value={lastExamDate} onChange={(e) => setLastExamDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>비고</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 도장 부스 작업" />
      </div>
    </Modal>
  );
}

function formatYearMonth(iso: string): string {
  return iso.slice(0, 7).replace('-', '.');
}

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 검사 수치 추이 — 검사항목(행) × 검진일(열, 시간순) + 조회기간 */
function LabTrendCard({
  checkups,
  labItems,
  checkupTypes,
}: {
  checkups: HealthCheckup[];
  labItems: LabItem[];
  checkupTypes: CheckupTypeItem[];
}) {
  const thisYear = new Date().getFullYear();
  const fallback = defaultLabRange(thisYear);
  const [start, setStart] = useState(fallback.start);
  const [end, setEnd] = useState(fallback.end);
  const [view, setView] = useState<'table' | 'graph'>('table');
  const [graphCode, setGraphCode] = useState('');
  const trend = useMemo(
    () => buildLabTrend(checkups, { start, end }, labItems),
    [checkups, start, end, labItems],
  );

  // 그래프 대상 행(숫자 값이 하나라도 있는 항목)
  const numericRows = trend.rows.filter((r) =>
    r.cells.some((c) => c.value != null && !Number.isNaN(Number(c.value))),
  );
  const selectedRow = numericRows.find((r) => r.code === graphCode) ?? numericRows[0];
  const points: LinePoint[] = selectedRow
    ? trend.columns.map((col, i) => {
        const raw = selectedRow.cells[i]?.value;
        const num = raw != null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        return { label: formatYearMonth(col.examDate), value: num };
      })
    : [];

  return (
    <Card
      title="검사 수치 추이"
      bodyClassName=""
      actions={
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 0 }}>
            <button
              className={`chip-toggle${view === 'table' ? ' active' : ''}`}
              onClick={() => setView('table')}
            >
              표
            </button>
            <button
              className={`chip-toggle${view === 'graph' ? ' active' : ''}`}
              onClick={() => setView('graph')}
            >
              그래프
            </button>
          </div>
          <input className="input lab-range" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="muted">~</span>
          <input className="input lab-range" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button
            className="btn btn--sm"
            onClick={() => {
              setStart(fallback.start);
              setEnd(fallback.end);
            }}
          >
            최근 5년
          </button>
        </div>
      }
    >
      {trend.columns.length === 0 ? (
        <div className="empty">
          <span className="ico">📈</span>해당 기간에 검사 수치 기록이 없어요.
        </div>
      ) : view === 'graph' ? (
        <div className="card__body">
          {numericRows.length === 0 ? (
            <div className="muted small">그래프로 표시할 수치 항목이 없어요.</div>
          ) : (
            <>
              <div className="toolbar">
                <select
                  className="select"
                  style={{ maxWidth: 240 }}
                  value={selectedRow?.code ?? ''}
                  onChange={(e) => setGraphCode(e.target.value)}
                >
                  {numericRows.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                      {r.unit ? ` (${r.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <LineChart
                points={points}
                unit={selectedRow?.unit}
                refLow={selectedRow?.def?.refLow}
                refHigh={selectedRow?.def?.refHigh}
              />
              <div className="muted small" style={{ marginTop: 6 }}>
                초록 음영은 정상범위, 빨간 점은 범위를 벗어난 값이에요.
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="table-wrap" style={{ border: 'none' }}>
          <table className="table lab-trend">
            <thead>
              <tr>
                <th className="lab-trend__item">검사항목</th>
                {trend.columns.map((c) => (
                  <th key={c.checkupId} className="num">
                    {formatYearMonth(c.examDate)}
                    <div className="muted small">
                      {resolveCheckupTypeName(c.type, checkupTypes).replace('건강진단', '')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.rows.map((row) => (
                <tr key={row.code}>
                  <th className="lab-trend__item">
                    {row.name}
                    {row.unit ? <span className="muted small"> {row.unit}</span> : null}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className={`num${cell.abnormal ? ' lab-abn' : ''}`}>
                      {cell.value ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface CheckupForm {
  type: CheckupType;
  examDate: string;
  institution: string;
  targetHazards: string;
  grade: HealthGrade;
  workFitness: '' | WorkFitness;
  followUpActions: FollowUpAction[];
  opinion: string;
  nextExamDate: string;
  managedBy: string;
  /** 검사 코드 → 입력값 */
  labValues: Record<string, string>;
}

function CheckupModal({
  employeeId,
  editing,
  labItems,
  checkupTypes,
  onLabItemsChanged,
  onCheckupTypesChanged,
  onClose,
  onSaved,
}: {
  employeeId: string;
  editing: HealthCheckup | null;
  labItems: LabItem[];
  checkupTypes: CheckupTypeItem[];
  onLabItemsChanged: () => void;
  onCheckupTypesChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { checkup } = useServices();
  const [manageOpen, setManageOpen] = useState(false);
  const [typeManageOpen, setTypeManageOpen] = useState(false);

  // 폼에는 '활성' 검사 항목만 입력칸으로 보여주고, 그 외(제외·삭제·특수지표) 값은 보존한다.
  const enabledItems = labItems.filter((i) => i.enabled);
  const groups = [...new Set(enabledItems.map((i) => i.group))];
  const extraLabs = (editing?.labResults ?? []).filter(
    (r) => !enabledItems.some((i) => i.code === r.code),
  );

  const [form, setForm] = useState<CheckupForm>(() => ({
    type: editing?.type ?? 'general',
    examDate: editing?.examDate ?? '',
    institution: editing?.institution ?? '',
    targetHazards: editing?.targetHazards?.join(', ') ?? '',
    grade: editing?.grade ?? 'A',
    workFitness: editing?.workFitness ?? '',
    followUpActions: editing?.followUpActions ?? [],
    opinion: editing?.opinion ?? '',
    nextExamDate: editing?.nextExamDate ?? '',
    managedBy: editing?.managedBy ?? '보건관리자',
    labValues: Object.fromEntries((editing?.labResults ?? []).map((r) => [r.code, r.value])),
  }));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CheckupForm>(k: K, v: CheckupForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLab = (code: string, value: string) =>
    setForm((f) => ({ ...f, labValues: { ...f.labValues, [code]: value } }));

  function toggleAction(a: FollowUpAction) {
    setForm((f) => ({
      ...f,
      followUpActions: f.followUpActions.includes(a)
        ? f.followUpActions.filter((x) => x !== a)
        : [...f.followUpActions, a],
    }));
  }

  async function submit() {
    if (!form.examDate) {
      setError('검진일을 입력하세요.');
      return;
    }
    const labResults: LabResult[] = [
      ...enabledItems
        .filter((d) => (form.labValues[d.code] ?? '').trim() !== '')
        .map((d) => ({
          code: d.code,
          name: d.name,
          value: form.labValues[d.code].trim(),
          unit: d.unit,
        })),
      ...extraLabs,
    ];
    const input = {
      employeeId,
      type: form.type,
      examDate: form.examDate,
      institution: form.institution || undefined,
      targetHazards: form.targetHazards
        ? form.targetHazards.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      grade: form.grade,
      workFitness: form.workFitness || undefined,
      followUpActions: form.followUpActions.length ? form.followUpActions : undefined,
      opinion: form.opinion || undefined,
      nextExamDate: form.nextExamDate || undefined,
      labResults: labResults.length ? labResults : undefined,
      managedBy: form.managedBy || undefined,
    };
    try {
      if (editing) await checkup.update(editing.id, input);
      else await checkup.add(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
    <Modal
      title={editing ? '건강검진 기록 수정' : '건강검진 기록 추가'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" onClick={submit}>
            저장
          </button>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="form-row">
        <div className="field">
          <div className="row spread" style={{ marginBottom: 4 }}>
            <label style={{ margin: 0 }}>검진 종류</label>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTypeManageOpen(true)}>
              ⚙ 종류 관리
            </button>
          </div>
          <select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {checkupTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>검진일 *</label>
          <input className="input" type="date" value={form.examDate} onChange={(e) => set('examDate', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>검진기관</label>
        <input className="input" value={form.institution} onChange={(e) => set('institution', e.target.value)} />
      </div>
      <div className="field">
        <label>대상 유해인자 (특수·배치전, 쉼표 구분)</label>
        <input className="input" value={form.targetHazards} onChange={(e) => set('targetHazards', e.target.value)} placeholder="예: 톨루엔, 크실렌" />
      </div>
      <div className="form-row">
        <div className="field">
          <label>건강관리구분(판정)</label>
          <select className="select" value={form.grade} onChange={(e) => set('grade', e.target.value as HealthGrade)}>
            {Object.entries(HEALTH_GRADE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>업무수행 적합여부</label>
          <select
            className="select"
            value={form.workFitness}
            onChange={(e) => set('workFitness', e.target.value as CheckupForm['workFitness'])}
          >
            <option value="">선택 안 함</option>
            {Object.entries(WORK_FITNESS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>사후관리 조치 (복수 선택)</label>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {FOLLOW_UP_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={`chip-toggle${form.followUpActions.includes(a) ? ' active' : ''}`}
              onClick={() => toggleAction(a)}
            >
              {FOLLOW_UP_ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="row spread" style={{ marginBottom: 4 }}>
          <label style={{ margin: 0 }}>검사 수치</label>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setManageOpen(true)}>
            ⚙ 검사 항목 관리
          </button>
        </div>
        {groups.map((group) => (
          <div key={group} style={{ marginBottom: 10 }}>
            <div className="muted small" style={{ marginBottom: 4 }}>
              {group}
            </div>
            <div className="lab-input-grid">
              {enabledItems
                .filter((i) => i.group === group)
                .map((item) => (
                  <label key={item.code} className="lab-input">
                    <span>
                      {item.name}
                      {item.unit ? ` (${item.unit})` : ''}
                    </span>
                    <input
                      className="input"
                      value={form.labValues[item.code] ?? ''}
                      onChange={(e) => setLab(item.code, e.target.value)}
                    />
                  </label>
                ))}
            </div>
          </div>
        ))}
        {extraLabs.length > 0 && (
          <div className="muted small">
            기타 항목(보존): {extraLabs.map((r) => `${r.name} ${r.value}${r.unit ?? ''}`).join(', ')}
          </div>
        )}
      </div>

      <div className="field">
        <label>사후관리 소견 / 의사 소견</label>
        <textarea className="textarea" value={form.opinion} onChange={(e) => set('opinion', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="field">
          <label>다음 검진(추적) 예정일</label>
          <input className="input" type="date" value={form.nextExamDate} onChange={(e) => set('nextExamDate', e.target.value)} />
        </div>
        <div className="field">
          <label>작성자</label>
          <input className="input" value={form.managedBy} onChange={(e) => set('managedBy', e.target.value)} />
        </div>
      </div>
    </Modal>
    {manageOpen && (
      <LabItemManagerModal
        labItems={labItems}
        onClose={() => setManageOpen(false)}
        onChanged={onLabItemsChanged}
      />
    )}
    {typeManageOpen && (
      <CheckupTypeManagerModal
        checkupTypes={checkupTypes}
        onClose={() => setTypeManageOpen(false)}
        onChanged={onCheckupTypesChanged}
      />
    )}
    </>
  );
}

/** 검진 종류 관리 — 추가 / 삭제(기본 종류·사용 중 종류는 삭제 불가) */
function CheckupTypeManagerModal({
  checkupTypes,
  onClose,
  onChanged,
}: {
  checkupTypes: CheckupTypeItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { checkupTypes: service } = useServices();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title="검진 종류 관리"
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          완료
        </button>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="table-wrap" style={{ marginBottom: 14 }}>
        <table className="table">
          <tbody>
            {checkupTypes.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.name}</strong>
                  {isBuiltinCheckupType(t.id) && <span className="muted small"> (기본)</span>}
                </td>
                <td className="num">
                  {!isBuiltinCheckupType(t.id) && (
                    <button className="btn btn--danger btn--sm" onClick={() => run(() => service.remove(t.id))}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 검진 종류 (예: 임시건강진단, 채용검진)"
        />
        <button
          className="btn btn--primary"
          onClick={() =>
            run(async () => {
              await service.create(name);
              setName('');
            })
          }
        >
          추가
        </button>
      </div>
    </Modal>
  );
}

/** 검사 항목 카탈로그 관리 — 추가 / 제외(포함) / 삭제 */
function LabItemManagerModal({
  labItems,
  onClose,
  onChanged,
}: {
  labItems: LabItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { labItems: service, labGroups: groupService } = useServices();
  const groupsAsync = useAsync(() => groupService.list(), []);
  const groupList = groupsAsync.data ?? [];

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [unit, setUnit] = useState('');
  const [refLow, setRefLow] = useState('');
  const [refHigh, setRefHigh] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleDrop(targetId: string) {
    const src = dragId;
    setDragId(null);
    setOverId(null);
    if (!src || src === targetId) return;
    const ids = labItems.map((i) => i.id);
    const from = ids.indexOf(src);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, src);
    run(() => service.reorder(ids));
  }
  async function groupRun(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      groupsAsync.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const selectedGroup = group || groupList[0]?.name || '';

  async function addItem() {
    if (!name.trim()) {
      setError('검사 항목명을 입력하세요.');
      return;
    }
    await run(async () => {
      await service.create({
        name,
        group: selectedGroup || '기타',
        unit: unit || undefined,
        refLow: refLow ? Number(refLow) : undefined,
        refHigh: refHigh ? Number(refHigh) : undefined,
      });
      setName('');
      setUnit('');
      setRefLow('');
      setRefHigh('');
    });
  }

  return (
    <Modal
      title="검사 항목 관리"
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          완료
        </button>
      }
    >
      {error && <ErrorAlert message={error} />}
      <div className="alert alert--info">
        ⠿ 손잡이를 잡고 <strong>드래그</strong>해 순서를 바꾸고, 체크 해제로 입력 폼에서{' '}
        <strong>제외</strong>(기록 보존). 직접 추가한 항목만 삭제할 수 있어요.
      </div>

      <div className="table-wrap" style={{ maxHeight: 280, marginBottom: 16 }}>
        <table className="table">
          <tbody>
            {labItems.map((item) => (
              <tr
                key={item.id}
                draggable
                onDragStart={(e) => {
                  setDragId(item.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', item.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overId !== item.id) setOverId(item.id);
                }}
                onDrop={() => handleDrop(item.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={overId === item.id && dragId && dragId !== item.id ? 'lab-drag-over' : ''}
                style={{ opacity: dragId === item.id ? 0.4 : 1 }}
              >
                <td style={{ width: 22 }}>
                  <span className="lab-grip" title="드래그하여 순서 변경">
                    ⠿
                  </span>
                </td>
                <td style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => run(() => service.setEnabled(item.id, e.target.checked))}
                  />
                </td>
                <td>
                  <strong>{item.name}</strong>
                  {item.unit ? <span className="muted small"> ({item.unit})</span> : null}
                  <span className="muted small"> · {item.group}</span>
                </td>
                <td className="num">
                  {!isBuiltinLabItem(item.id) && (
                    <button className="btn btn--danger btn--sm" onClick={() => run(() => service.remove(item.id))}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 검사 그룹 관리 */}
      <div className="card__title" style={{ marginBottom: 8 }}>검사 그룹</div>
      <div className="row row--wrap" style={{ gap: 6, marginBottom: 8 }}>
        {groupList.map((g) => (
          <span key={g.id} className="badge badge--muted">
            {g.name}
            <button
              className="btn btn--ghost btn--sm"
              style={{ padding: '0 2px' }}
              title="그룹 삭제"
              onClick={() => groupRun(() => groupService.remove(g.id))}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <input
          className="input grow"
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          placeholder="새 그룹 (예: 청각, 생물학적 지표)"
        />
        <button
          className="btn btn--sm"
          onClick={() =>
            groupRun(async () => {
              await groupService.create(newGroup);
              setNewGroup('');
            })
          }
        >
          그룹 추가
        </button>
      </div>

      <div className="card__title" style={{ marginBottom: 8 }}>＋ 새 검사 항목 추가</div>
      <div className="form-row">
        <div className="field">
          <label>항목명 *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 청력 6kHz, 소변 마뇨산" />
        </div>
        <div className="field">
          <label>그룹</label>
          <select className="select" value={selectedGroup} onChange={(e) => setGroup(e.target.value)}>
            {groupList.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
            {groupList.length === 0 && <option value="기타">기타</option>}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>단위</label>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="예: dB, mg/dL" />
        </div>
        <div className="field">
          <label>정상 하한 / 상한</label>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="number" value={refLow} onChange={(e) => setRefLow(e.target.value)} placeholder="하한" />
            <input className="input" type="number" value={refHigh} onChange={(e) => setRefHigh(e.target.value)} placeholder="상한" />
          </div>
        </div>
      </div>
      <button className="btn btn--primary" onClick={addItem}>
        항목 추가
      </button>
    </Modal>
  );
}
