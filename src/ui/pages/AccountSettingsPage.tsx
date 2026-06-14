import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useServices } from '../ServicesContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorAlert } from '../components/ui';
import { Octopus } from '../components/Octopus';
import { formatDate } from '../format';

export function AccountSettingsPage() {
  const { session, logout } = useAuth();
  const { auth, employees } = useServices();
  const navigate = useNavigate();

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const isManager = session?.role === 'manager';
  const isEmployee = session?.role === 'employee';

  // 임직원: 내 정보(사번·생년월일·부서·연락처)
  const me = useAsync(
    () => (isEmployee && session?.employeeId ? employees.getById(session.employeeId) : Promise.resolve(null)),
    [isEmployee, session?.employeeId],
  );
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    setPhone(me.data?.phone ?? '');
  }, [me.data]);

  async function handlePhoneChange(e: React.FormEvent) {
    e.preventDefault();
    if (!me.data) return;
    setPhoneError(null);
    setPhoneSuccess(false);
    setPhoneBusy(true);
    try {
      await employees.update({ ...me.data, phone: phone.trim() || undefined });
      setPhoneSuccess(true);
      me.reload();
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhoneBusy(false);
    }
  }

  // 관리자: 임직원 목록 및 계정 현황
  const empList = useAsync(
    () => (isManager ? employees.list() : Promise.resolve([])),
    [isManager],
  );
  const accounts = useAsync(
    () => (isManager ? auth.listAccounts() : Promise.resolve([])),
    [isManager],
  );
  const [resetBusy, setResetBusy] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<{ id: string; msg: string } | null>(null);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setBusy(true);
    try {
      await auth.changePassword(session.accountId, curPw, newPw);
      setPwSuccess(true);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(employeeId: string) {
    setResetBusy(employeeId);
    setResetMsg(null);
    try {
      await auth.resetEmployeePassword(employeeId);
      setResetMsg({ id: employeeId, msg: '생년월일로 초기화되었습니다.' });
      accounts.reload();
    } catch (e) {
      setResetMsg({ id: employeeId, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setResetBusy(null);
    }
  }

  if (!session) return null;

  const accountMap = new Map((accounts.data ?? []).map((a) => [a.employeeId ?? '', a]));

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => navigate(-1)}
          style={{ color: '#6b7280' }}
        >
          ← 돌아가기
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#1f2937' }}>
          계정 설정
        </h2>
      </div>

      {/* 현재 계정 정보 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Octopus mood="neutral" size={48} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1f2937' }}>
              {session.employeeName ?? '관리자'}
            </div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>
              사번: {session.employeeNumber} &nbsp;·&nbsp;
              {session.role === 'manager' ? '⚕ 보건관리자' : '🐙 임직원'}
            </div>
          </div>
        </div>
      </div>

      {/* 임직원: 내 정보(사번·생년월일·부서·연락처) */}
      {isEmployee && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#374151' }}>
            🙋 내 정보
          </h3>
          {me.loading ? (
            <div style={{ color: '#9ca3af', fontSize: 12.5 }}>불러오는 중...</div>
          ) : me.data ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <InfoRow label="사번" value={me.data.employeeNumber} />
                <InfoRow label="부서" value={me.data.department} />
                <InfoRow label="생년월일" value={me.data.birthDate ? formatDate(me.data.birthDate) : '-'} />
              </div>
              <form onSubmit={handlePhoneChange} style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>연락처</label>
                  <input
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>
                <button type="submit" className="btn btn--primary" disabled={phoneBusy}>
                  {phoneBusy ? '저장 중...' : '저장'}
                </button>
              </form>
              {phoneError && (
                <div style={{ marginTop: 8 }}>
                  <ErrorAlert message={phoneError} />
                </div>
              )}
              {phoneSuccess && (
                <div className="alert alert--success" style={{ marginTop: 8 }}>
                  ✅ 연락처가 저장되었습니다.
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* 비밀번호 변경 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#374151' }}>
          🔑 비밀번호 변경
        </h3>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>현재 비밀번호</label>
            <input
              className="input"
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="현재 비밀번호"
              autoComplete="current-password"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>새 비밀번호 (6자 이상)</label>
            <input
              className="input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="새 비밀번호"
              autoComplete="new-password"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>새 비밀번호 확인</label>
            <input
              className="input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="새 비밀번호 다시 입력"
              autoComplete="new-password"
            />
          </div>

          {pwError && <ErrorAlert message={pwError} />}
          {pwSuccess && (
            <div className="alert alert--success">✅ 비밀번호가 변경되었습니다.</div>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy}
            style={{ alignSelf: 'flex-start' }}
          >
            {busy ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>

      {/* 관리자 전용: 임직원 계정 관리 */}
      {isManager && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#374151' }}>
            👥 임직원 계정 관리
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9ca3af' }}>
            비밀번호를 생년월일(YYYYMMDD)로 초기화할 수 있습니다.
          </p>

          {empList.loading ? (
            <div style={{ color: '#9ca3af', fontSize: 12.5 }}>불러오는 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(empList.data ?? [])
                .filter((e) => e.active)
                .map((emp) => {
                  const acc = accountMap.get(emp.id);
                  const hasAccount = !!acc;
                  const isResetting = resetBusy === emp.id;
                  const msg = resetMsg?.id === emp.id ? resetMsg.msg : null;
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f9fafb',
                        borderRadius: 11,
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>
                          {emp.name}
                          <span style={{ marginLeft: 8, fontSize: 10.5, color: '#9ca3af' }}>
                            {emp.employeeNumber} · {emp.department}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: hasAccount ? '#22c55e' : '#d1d5db', marginTop: 2 }}>
                          {hasAccount ? '✓ 계정 있음' : '아직 로그인한 적 없음'}
                        </div>
                        {msg && (
                          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>{msg}</div>
                        )}
                      </div>
                      {hasAccount && (
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap' }}
                          disabled={isResetting}
                          onClick={() => resetPassword(emp.id)}
                        >
                          {isResetting ? '처리 중...' : '비밀번호 초기화'}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* 로그아웃 */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          className="btn btn--ghost"
          style={{ color: '#ef4444', fontSize: 13 }}
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color: '#1f2937', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
