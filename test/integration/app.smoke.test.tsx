import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@ui/App';
import { ServicesProvider } from '@ui/ServicesContext';
import type { AuthSession } from '@ui/AuthContext';

/**
 * 앱 전체 스모크 테스트.
 * 실제 합성 루트(createAppServices) + localStorage(jsdom) + 시드 데이터로
 * 라우팅·컨텍스트·서비스 배선이 한 번에 동작하는지 확인한다.
 */

/** 테스트마다 관리자 세션을 localStorage에 미리 주입 */
function seedManagerSession() {
  const session: AuthSession = {
    accountId: 'test-acc',
    role: 'manager',
    employeeId: null,
    employeeName: null,
    employeeNumber: 'admin',
  };
  localStorage.setItem('whm:session', JSON.stringify(session));
}

/** 테스트마다 임직원(emp-1) 세션을 localStorage에 미리 주입 */
function seedEmployeeSession() {
  const session: AuthSession = {
    accountId: 'test-acc-emp',
    role: 'employee',
    employeeId: 'emp-1',
    employeeName: '김철수',
    employeeNumber: '2018-0101',
  };
  localStorage.setItem('whm:session', JSON.stringify(session));
}

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ServicesProvider>
        <App />
      </ServicesProvider>
    </MemoryRouter>,
  );
}

describe('App 스모크', () => {
  beforeEach(() => {
    seedManagerSession();
  });

  it('대시보드가 시드 데이터 요약과 함께 렌더된다', async () => {
    renderApp('/');
    // 상단 타이틀
    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
    // 비동기 로딩 후 통계 카드 라벨 / 고유한 섹션 제목
    expect(await screen.findByText('특수검진 기한 초과')).toBeInTheDocument();
    expect(await screen.findByText('특수검진 도래 임직원')).toBeInTheDocument();
    expect(await screen.findByText('최근 보건실 방문')).toBeInTheDocument();
  });

  it('상담일지 메뉴(증상)를 보여준다(상비약 분리)', async () => {
    renderApp('/symptom');
    expect(await screen.findByText('＋ 상담 기록')).toBeInTheDocument();
  });

  it('상비약 메뉴는 재고·입고와 입출고 대장을 보여준다', async () => {
    renderApp('/medicine');
    expect(await screen.findByText('상비약 재고 · 입고(반입)')).toBeInTheDocument();
    expect(await screen.findByText('입출고 대장')).toBeInTheDocument();
    // 분류별 그룹(시드 약품의 분류명)
    expect(await screen.findByText(/진통·해열제/)).toBeInTheDocument();
  });

  it('통계 메뉴에서 검진 유소견·월별 현황 카드를 보여준다', async () => {
    renderApp('/stats');
    expect(await screen.findByText('검진 유소견 현황')).toBeInTheDocument();
    expect(await screen.findByText('월별 약 반출 현황')).toBeInTheDocument();
  });

  it('유해인자 카탈로그 메뉴에서 분류를 클릭하면 물질 목록이 보인다', async () => {
    renderApp('/catalog');
    // 1단계: 분류 카드 → '유기화합물' 클릭
    const cat = await screen.findByText('유기화합물');
    await userEvent.click(cat);
    // 2단계: 물질 목록에 '벤젠' 등장
    expect(await screen.findByText('벤젠')).toBeInTheDocument();
  });

  it('임직원 명부에서 부서를 선택하면 소속 임직원이 보인다', async () => {
    renderApp('/employees');
    // 1단계: 부서 목록에서 '생산1팀' 클릭
    await userEvent.click(await screen.findByText('생산1팀'));
    // 2단계: 해당 부서 임직원(김철수) 등장
    expect(await screen.findByText('김철수')).toBeInTheDocument();
  });

  it('건강 프로필 페이지가 임직원의 통합 현황(노출·검진)을 렌더한다', async () => {
    renderApp('/employees/emp-1');
    expect(await screen.findByText(/유해물질 노출 이력/)).toBeInTheDocument();
    expect(await screen.findByText('건강검진 결과 (사후관리소견)')).toBeInTheDocument();
    // 노출 등록 버튼(유해물질 노출 메뉴 통합)
    expect(await screen.findByText('＋ 노출 등록')).toBeInTheDocument();
    // 시드 검진 판정(C1)이 렌더된다 (헤더 뱃지 + 표에 등장)
    expect((await screen.findAllByText('C1 (직업병 요관찰)')).length).toBeGreaterThan(0);
    // 검사 수치 추이 매트릭스(검사항목 행)
    expect(await screen.findByText('검사 수치 추이')).toBeInTheDocument();
    expect(await screen.findByText('공복혈당')).toBeInTheDocument();
  });
});

describe('App 스모크 (임직원)', () => {
  beforeEach(() => {
    seedEmployeeSession();
  });

  it('내 유해인자에서 진행 중 노출을 클릭하면 카탈로그 상세(노출기준 등)로 연결되고, 되돌아갈 수 있다', async () => {
    renderApp('/hazards');

    expect(await screen.findByText('진행 중 노출 (2종)')).toBeInTheDocument();
    await userEvent.click(await screen.findByText('톨루엔'));

    // 카탈로그 상세(HazardSubstanceDetail) — 영문명/CAS, 분류 뱃지, 노출기준
    expect(await screen.findByText(/Toluene/)).toBeInTheDocument();
    expect(await screen.findByText(/CAS 108-88-3/)).toBeInTheDocument();
    expect(await screen.findByText('[화학적 인자] 유기화합물')).toBeInTheDocument();
    expect(await screen.findByText('50 ppm')).toBeInTheDocument();

    // 뒤로가기 → 다시 진행 중 노출 목록
    await userEvent.click(await screen.findByText('← 내 유해인자'));
    expect(await screen.findByText('진행 중 노출 (2종)')).toBeInTheDocument();
  });
});
