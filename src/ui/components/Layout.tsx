import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  title: string;
  sub: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: '대시보드', icon: '🏠', title: '대시보드', sub: '전체 건강관리 현황 요약', end: true },
  { to: '/employees', label: '건강명부', icon: '🧑‍⚕️', title: '건강명부', sub: '부서별 명부 · 임직원을 선택하면 건강 프로필(노출·증상·검진·검사수치)' },
  { to: '/symptom', label: '상담일지', icon: '🩺', title: '상담일지', sub: '보건실 상담·방문 기록 · 기간/임직원/부서별 조회 · 증상↔노출 유해인자 점검' },
  { to: '/medicine', label: '상비약', icon: '💊', title: '상비약 반출입', sub: '분류별 재고·입고(반입) · 입출고 대장(구간 조회·엑셀)' },
  { to: '/program', label: '건강프로그램', icon: '🏃', title: '건강프로그램 신청·참여 현황', sub: '프로그램 모집·신청·참여율 관리' },
  { to: '/stats', label: '통계', icon: '📊', title: '통계', sub: '검진 유소견 현황 · 월별 상담/내원·약 반출 (부서·연령·성별)' },
  { to: '/catalog', label: '유해인자 카탈로그', icon: '📚', title: '유해인자 카탈로그', sub: '별표22 유해인자별 건강장해 + 우리 회사 사용·부서별 유해인자 조회' },
];

export function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const active =
    NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to))) ?? NAV[0];

  return (
    <div className="app">
      <header className="topnav">
        <div className="topnav__brand">
          <span className="logo">⚕</span>
          <span>사업장 건강관리</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            ⚕ {session?.employeeNumber}
          </span>
          <button
            className="btn btn--sm btn--ghost"
            style={{ color: '#6b7280', fontSize: 12 }}
            onClick={() => navigate('/settings')}
          >
            계정 설정
          </button>
          <button
            className="btn btn--sm btn--ghost"
            style={{ color: '#ef4444', fontSize: 12 }}
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="mainmenu">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `topnav-link${isActive ? ' active' : ''}`}
          >
            <span className="ico">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <header className="topbar">
        <div>
          <h1>{active.title}</h1>
          <div className="sub">{active.sub}</div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="appfoot">
        모든 데이터는 안전하게 보호되고, 로그인하면 어떤 기기에서든 같은 정보를 볼 수 있어요.
      </footer>
    </div>
  );
}
