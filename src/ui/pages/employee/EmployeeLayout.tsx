import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { Octopus } from '../../components/Octopus';

const TABS = [
  { to: '/',          label: '홈',        icon: '🏠', exact: true  },
  { to: '/hazards',   label: '내 유해인자', icon: '⚗️',  exact: false },
  { to: '/health',    label: '건강정보',   icon: '🩺',  exact: false },
  { to: '/programs',  label: '건강프로그램', icon: '🏃', exact: false },
] as const;

export function EmployeeLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="emp-root">
      {/* 상단 바 */}
      <header className="emp-topbar">
        <div className="emp-topbar__brand">
          <span style={{ fontSize: 18 }}>🐙</span>
          건강 포털
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1d4ed8' }}>
            {session?.employeeName ?? ''}님
          </span>
          <button
            className="btn btn--ghost btn--sm"
            style={{ fontSize: 11, color: '#94a3b8' }}
            onClick={() => navigate('/settings')}
          >
            설정
          </button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ fontSize: 11, color: '#93c5fd' }}
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="emp-content">
        <Outlet />
      </main>

      {/* 하단 내비게이션 */}
      <nav className="emp-bottomnav">
        {TABS.map((tab) => {
          const active = tab.exact ? loc.pathname === tab.to : loc.pathname.startsWith(tab.to);
          return (
            <button
              key={tab.to}
              className={`emp-tab${active ? ' active' : ''}`}
              onClick={() => navigate(tab.to)}
            >
              <span className="tab-ico">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// 임직원 페이지 공통: auth에서 employeeId를 꺼내는 훅
export function useEmployeeId(): string {
  const { session } = useAuth();
  if (!session?.employeeId) throw new Error('임직원 세션이 없습니다.');
  return session.employeeId;
}

// Octopus re-export for convenience
export { Octopus };
