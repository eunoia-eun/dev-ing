import { useEffect, useMemo, useRef, useState } from 'react';
import type { Employee } from '@domain/employee/Employee';

function label(e: Employee): string {
  return `${e.name} · ${e.department}${e.position ? ` ${e.position}` : ''} (${e.employeeNumber})`;
}

/**
 * 임직원 선택 — 이름·사번·부서로 검색 가능한 콤보박스.
 */
export function EmployeePicker({
  employees,
  value,
  onChange,
  placeholder = '임직원 선택',
  allowEmpty = false,
}: {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = employees.find((e) => e.id === value) ?? null;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.name} ${e.employeeNumber} ${e.department} ${e.position ?? ''} ${e.jobTitle}`
        .toLowerCase()
        .includes(q),
    );
  }, [employees, query]);

  function select(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="combo" ref={ref}>
      <input
        className="input combo__input"
        value={open ? query : selected ? label(selected) : ''}
        placeholder={placeholder}
        onFocusCapture={() => {
          setOpen(true);
          setQuery('');
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className="combo__list">
          {allowEmpty && (
            <li>
              <button type="button" className="combo__item" onClick={() => select('')}>
                {placeholder}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="combo__empty">검색 결과가 없어요.</li>
          ) : (
            filtered.slice(0, 50).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`combo__item${e.id === value ? ' is-selected' : ''}`}
                  onClick={() => select(e.id)}
                >
                  <strong>{e.name}</strong>{' '}
                  <span className="muted small">
                    {e.department}
                    {e.position ? ` ${e.position}` : ''} · 사번 {e.employeeNumber}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
