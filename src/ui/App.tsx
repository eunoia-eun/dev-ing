import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CatalogPage } from './pages/CatalogPage';
import { SymptomPage } from './pages/SymptomPage';
import { MedicinePage } from './pages/MedicinePage';
import { ProgramPage } from './pages/ProgramPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { EmployeeProfilePage } from './pages/EmployeeProfilePage';
import { EmployeeLayout } from './pages/employee/EmployeeLayout';
import { EmployeeHomePage } from './pages/employee/EmployeeHomePage';
import { EmployeeHazardPage } from './pages/employee/EmployeeHazardPage';
import { EmployeeHealthPage } from './pages/employee/EmployeeHealthPage';
import { EmployeeProgramPage } from './pages/employee/EmployeeProgramPage';
import { LoginPage } from './pages/LoginPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { WorkplaceMeasurementPage } from './pages/WorkplaceMeasurementPage';

function ProfileRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/employees/${id}` : '/employees'} replace />;
}

function AppRoutes() {
  const { session, ready } = useAuth();

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div style={{ color: '#2563eb', fontWeight: 700 }}>로딩 중...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (session.role === 'employee') {
    return (
      <Routes>
        <Route element={<EmployeeLayout />}>
          <Route index element={<EmployeeHomePage />} />
          <Route path="hazards" element={<EmployeeHazardPage />} />
          <Route path="health" element={<EmployeeHealthPage />} />
          <Route path="programs" element={<EmployeeProgramPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // 보건관리자 모드
  return (
    <Routes>
      <Route path="settings" element={<AccountSettingsPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="hazard" element={<Navigate to="/profile" replace />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="measurement" element={<WorkplaceMeasurementPage />} />
        <Route path="symptom" element={<SymptomPage />} />
        <Route path="medicine" element={<MedicinePage />} />
        <Route path="program" element={<ProgramPage />} />
        <Route path="stats" element={<StatisticsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeProfilePage />} />
        <Route path="profile" element={<Navigate to="/employees" replace />} />
        <Route path="profile/:id" element={<ProfileRedirect />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
