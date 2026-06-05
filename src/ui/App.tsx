import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SymptomPage } from './pages/SymptomPage';
import { MedicinePage } from './pages/MedicinePage';
import { ProgramPage } from './pages/ProgramPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeProfilePage } from './pages/EmployeeProfilePage';

/** 구 /profile/:id → /employees/:id 리다이렉트 */
function ProfileRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/employees/${id}` : '/employees'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        {/* 유해물질 노출 메뉴는 건강 프로필로 통합됨 */}
        <Route path="hazard" element={<Navigate to="/profile" replace />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="symptom" element={<SymptomPage />} />
        <Route path="medicine" element={<MedicinePage />} />
        <Route path="program" element={<ProgramPage />} />
        <Route path="stats" element={<StatisticsPage />} />
        {/* 건강 동영상 메뉴 제거됨 */}
        {/* 명부 + 건강 프로필 통합: 목록은 /employees, 개인 프로필은 /employees/:id */}
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        {/* 기존 경로 호환 */}
        <Route path="profile" element={<Navigate to="/employees" replace />} />
        <Route path="profile/:id" element={<ProfileRedirect />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
