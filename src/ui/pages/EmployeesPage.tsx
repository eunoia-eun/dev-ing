import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Employee } from '@domain/employee/Employee';
import type { Department } from '@domain/department/Department';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorAlert, Modal, Spinner } from '../components/ui';
import { EmployeeModal } from '../components/EmployeeModal';
import { formatDate } from '../format';

export function EmployeesPage() {
  const { employees, departments } = useServices();
  const depts = useAsync(() => departments.listWithCounts(), []);
  const emps = useAsync(() => employees.list(), []);

  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [deptModal, setDeptModal] = useState<{ open: boolean; editing: Department | null }>({
    open: false,
    editing: null,
  });
  const [empModalDept, setEmpModalDept] = useState<string | null>(null); // 임직원 추가 모달(소속 부서)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null); // 수정 모달

  function reload() {
    depts.reload();
    emps.reload();
  }

  async function removeDept(d: Department) {
    if (!confirm(`'${d.name}' 부서를 삭제할까요?`)) return;
    try {
      await departments.remove(d.id);
      if (selectedDept === d.name) setSelectedDept(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function deactivate(id: string, name: string) {
    if (!confirm(`'${name}' 님을 관리 대상에서 제외할까요? (기록은 보존돼요)`)) return;
    await employees.deactivate(id);
    reload();
  }

  const deptList = depts.data ?? [];
  const totalEmployees = deptList.reduce((s, d) => s + d.employeeCount, 0);
  const selected = selectedDept ? deptList.find((d) => d.department.name === selectedDept) : null;
  const deptEmployees = (emps.data ?? []).filter((e) => e.department === selectedDept);

  return (
    <div className="stack">
      {depts.error && <ErrorAlert message={depts.error} />}

      {depts.loading || emps.loading ? (
        <Spinner />
      ) : !selectedDept ? (
        /* ===== 1단계: 부서 목록 ===== */
        <>
          <div className="toolbar">
            <div className="grow muted small">
              부서 {deptList.length}개 · 임직원 {totalEmployees}명
            </div>
            <button className="btn btn--primary" onClick={() => setDeptModal({ open: true, editing: null })}>
              ＋ 부서 추가
            </button>
          </div>

          {deptList.length === 0 ? (
            <EmptyState icon="🏢">등록된 부서가 없어요. 부서를 추가해 보세요.</EmptyState>
          ) : (
            <Card bodyClassName="">
              <ul className="list-reset">
                {deptList.map(({ department: d, employeeCount }) => (
                  <li key={d.id} className="catalog-row" style={{ cursor: 'default' }}>
                    <button
                      className="row"
                      style={{ gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', flex: 1 }}
                      onClick={() => setSelectedDept(d.name)}
                    >
                      <strong>{d.name}</strong>
                      <span className="badge badge--muted">{employeeCount}명</span>
                      {d.note && <span className="muted small">{d.note}</span>}
                    </button>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn--sm" onClick={() => setSelectedDept(d.name)}>
                        보기 ›
                      </button>
                      <button className="btn btn--sm" onClick={() => setDeptModal({ open: true, editing: d })}>
                        수정
                      </button>
                      <button className="btn btn--danger btn--sm" onClick={() => removeDept(d)}>
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : (
        /* ===== 2단계: 선택한 부서의 임직원 ===== */
        <>
          <div className="row small" style={{ gap: 6, color: 'var(--text-muted)' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedDept(null)}>
              ← 부서 목록
            </button>
            <span>›</span>
            <strong style={{ color: 'var(--text)' }}>{selectedDept}</strong>
          </div>

          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                {selectedDept}
                <span className="badge badge--muted">{deptEmployees.length}명</span>
                {selected?.department.note && (
                  <span className="muted small">{selected.department.note}</span>
                )}
              </span>
            }
            actions={
              <div className="row" style={{ gap: 6 }}>
                {selected && (
                  <button
                    className="btn btn--sm"
                    onClick={() => setDeptModal({ open: true, editing: selected.department })}
                  >
                    부서 수정
                  </button>
                )}
                <button className="btn btn--primary btn--sm" onClick={() => setEmpModalDept(selectedDept)}>
                  ＋ 임직원 추가
                </button>
              </div>
            }
            bodyClassName=""
          >
            {deptEmployees.length === 0 ? (
              <div className="empty">
                <span className="ico">👥</span>이 부서에 등록된 임직원이 없어요.
              </div>
            ) : (
              <div className="table-wrap" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>사번</th>
                      <th>이름</th>
                      <th>성별</th>
                      <th>생년월일</th>
                      <th>직급</th>
                      <th>담당 업무</th>
                      <th>입사일</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptEmployees.map((e) => (
                      <tr key={e.id}>
                        <td className="muted">{e.employeeNumber}</td>
                        <td>
                          <Link to={`/employees/${e.id}`}>
                            <strong>{e.name}</strong>
                          </Link>
                        </td>
                        <td>{e.gender === 'M' ? '남' : e.gender === 'F' ? '여' : '-'}</td>
                        <td>{e.birthDate ? formatDate(e.birthDate) : '-'}</td>
                        <td>{e.position ?? '-'}</td>
                        <td>{e.jobTitle}</td>
                        <td>{formatDate(e.hireDate)}</td>
                        <td className="num">
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <Link className="btn btn--sm" to={`/employees/${e.id}`}>
                              건강 프로필
                            </Link>
                            <button className="btn btn--sm" onClick={() => setEditingEmp(e)}>
                              수정
                            </button>
                            <button className="btn btn--danger btn--sm" onClick={() => deactivate(e.id, e.name)}>
                              제외
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
        </>
      )}

      {deptModal.open && (
        <DepartmentModal
          editing={deptModal.editing}
          onClose={() => setDeptModal({ open: false, editing: null })}
          onSaved={(saved) => {
            // 상세 화면에서 수정 중 이름이 바뀌면 선택값도 갱신
            if (deptModal.editing && selectedDept === deptModal.editing.name) setSelectedDept(saved.name);
            setDeptModal({ open: false, editing: null });
            reload();
          }}
        />
      )}

      {empModalDept !== null && (
        <EmployeeModal
          departments={deptList.map((d) => d.department.name)}
          defaultDept={empModalDept}
          onClose={() => setEmpModalDept(null)}
          onSaved={() => {
            setEmpModalDept(null);
            reload();
          }}
        />
      )}

      {editingEmp && (
        <EmployeeModal
          departments={deptList.map((d) => d.department.name)}
          defaultDept={editingEmp.department}
          editing={editingEmp}
          onClose={() => setEditingEmp(null)}
          onSaved={() => {
            setEditingEmp(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function DepartmentModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Department | null;
  onClose: () => void;
  onSaved: (saved: Department) => void;
}) {
  const { departments } = useServices();
  const [name, setName] = useState(editing?.name ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      const saved = editing
        ? await departments.update(editing.id, name, note)
        : await departments.create(name, note);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={editing ? '부서 수정' : '부서 추가'}
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
      {editing && (
        <div className="alert alert--info">
          부서명을 바꾸면 소속 임직원의 부서도 함께 바뀌어요.
        </div>
      )}
      <div className="field">
        <label>부서명 *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>비고</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 도장·조립 공정" />
      </div>
    </Modal>
  );
}
