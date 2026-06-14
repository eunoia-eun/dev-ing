import { useState } from 'react';
import type { Employee, Gender } from '@domain/employee/Employee';
import { useServices } from '../ServicesContext';
import { ErrorAlert, Modal } from './ui';

interface EmpForm {
  employeeNumber: string;
  name: string;
  department: string;
  position: string;
  jobTitle: string;
  hireDate: string;
  birthDate: string;
  gender: '' | Gender;
  phone: string;
  /** 'domestic' = 내국인(기본) | 'foreign' = 외국인 */
  nationality: 'domestic' | 'foreign';
}

/** 임직원 추가/수정 모달. `editing`을 주면 수정, 없으면 추가. */
export function EmployeeModal({
  departments,
  defaultDept,
  editing,
  onClose,
  onSaved,
}: {
  departments: string[];
  defaultDept: string;
  editing?: Employee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { employees } = useServices();
  const [form, setForm] = useState<EmpForm>({
    employeeNumber: editing?.employeeNumber ?? '',
    name: editing?.name ?? '',
    department: editing?.department ?? defaultDept ?? departments[0] ?? '',
    position: editing?.position ?? '',
    jobTitle: editing?.jobTitle ?? '',
    hireDate: editing?.hireDate ?? '',
    birthDate: editing?.birthDate ?? '',
    gender: editing?.gender ?? '',
    phone: editing?.phone ?? '',
    nationality: editing?.isForeign ? 'foreign' : 'domestic',
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EmpForm>(k: K, v: EmpForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name || !form.department || !form.jobTitle || !form.hireDate) {
      setError('이름·부서·담당업무·입사일은 필수입니다.');
      return;
    }
    try {
      if (editing) {
        await employees.update({
          ...editing,
          employeeNumber: form.employeeNumber || '-',
          name: form.name,
          department: form.department,
          position: form.position || undefined,
          jobTitle: form.jobTitle,
          hireDate: form.hireDate,
          birthDate: form.birthDate || undefined,
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          isForeign: form.nationality === 'foreign',
        });
      } else {
        await employees.create({
          employeeNumber: form.employeeNumber || '-',
          name: form.name,
          department: form.department,
          position: form.position || undefined,
          jobTitle: form.jobTitle,
          hireDate: form.hireDate,
          birthDate: form.birthDate || undefined,
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          isForeign: form.nationality === 'foreign',
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal
      title={editing ? '임직원 정보 수정' : '임직원 추가'}
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
          <label>사번</label>
          <input className="input" value={form.employeeNumber} onChange={(e) => set('employeeNumber', e.target.value)} />
        </div>
        <div className="field">
          <label>이름 *</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>부서 *</label>
          <select className="select" value={form.department} onChange={(e) => set('department', e.target.value)}>
            {departments.length === 0 && <option value="">부서 없음</option>}
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>직급</label>
          <input className="input" value={form.position} onChange={(e) => set('position', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>담당 업무 * (유해인자 노출 판단 근거)</label>
        <input className="input" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
      </div>
      <div className="form-row">
        <div className="field">
          <label>입사일 *</label>
          <input className="input" type="date" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} />
        </div>
        <div className="field">
          <label>생년월일 (나이대 통계용)</label>
          <input className="input" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>성별</label>
          <select className="select" value={form.gender} onChange={(e) => set('gender', e.target.value as EmpForm['gender'])}>
            <option value="">선택 안 함</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </div>
        <div className="field">
          <label>국적</label>
          <select
            className="select"
            value={form.nationality}
            onChange={(e) => set('nationality', e.target.value as EmpForm['nationality'])}
          >
            <option value="domestic">내국인</option>
            <option value="foreign">외국인</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>연락처</label>
        <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="010-0000-0000" />
      </div>
    </Modal>
  );
}
