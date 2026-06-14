import { useState } from 'react';
import type { AccountRole } from '@domain/auth/Account';
import { useAuth } from '../AuthContext';
import { Octopus } from '../components/Octopus';

export function LoginPage() {
  const { login } = useAuth();
  const [role, setRole] = useState<AccountRole>('employee');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeNumber.trim() || !password) {
      setError('사번과 비밀번호를 모두 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await login(employeeNumber.trim(), password, role);
    if (!result.success) {
      setError(result.reason ?? '로그인에 실패했습니다.');
      setBusy(false);
    }
  }

  return (
    <div className="emp-select-screen" style={{ gap: 0 }}>
      {/* 로고 */}
      <div style={{ marginBottom: 8 }}>
        <Octopus mood="happy" size={110} className="emp-octopus" />
      </div>
      <h1
        style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 22,
          fontWeight: 900,
          margin: '0 0 4px',
        }}
      >
        사업장 건강관리 포털
      </h1>
      <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 28px' }}>
        사번과 비밀번호로 로그인하세요
      </p>

      {/* 모드 토글 */}
      <div
        style={{
          display: 'flex',
          background: '#f3f4f6',
          borderRadius: 12,
          padding: 4,
          marginBottom: 20,
          width: '100%',
          maxWidth: 340,
        }}
      >
        {(['employee', 'manager'] as AccountRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setError(null);
              setEmployeeNumber('');
              setPassword('');
            }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13.5,
              transition: 'all 0.15s',
              background: role === r ? '#fff' : 'transparent',
              color: role === r ? '#2563eb' : '#9ca3af',
              boxShadow: role === r ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {r === 'employee' ? '🐙 임직원' : '⚕ 보건관리자'}
          </button>
        ))}
      </div>

      {/* 로그인 폼 */}
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div className="field" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>사번</label>
          <input
            className="input"
            type="text"
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            placeholder={role === 'manager' ? '관리자 사번' : '사번 입력'}
            autoComplete="username"
            autoFocus
            style={{ borderRadius: 12 }}
          />
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>비밀번호</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
            style={{ borderRadius: 12 }}
          />
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#b91c1c',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '13px 0',
            fontWeight: 800,
            fontSize: 15,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.7 : 1,
            marginTop: 4,
          }}
        >
          {busy ? '로그인 중...' : '로그인'}
        </button>
      </form>

      {/* 임직원 초기 비밀번호 안내 */}
      {role === 'employee' && (
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            background: '#eff6ff',
            borderRadius: 12,
            maxWidth: 340,
            width: '100%',
            fontSize: 12.5,
            color: '#6b7280',
            lineHeight: 1.7,
          }}
        >
          💡 <strong>임직원</strong> 초기 비밀번호는{' '}
          <strong style={{ color: '#1d4ed8' }}>생년월일 8자리(YYYYMMDD)</strong>입니다.
          <br />
          예) 1990년 3월 22일 →{' '}
          <code style={{ background: '#dbeafe', borderRadius: 4, padding: '1px 4px' }}>19900322</code>
        </div>
      )}
    </div>
  );
}
