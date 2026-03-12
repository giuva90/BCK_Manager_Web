import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/layout/AuthGuard';
import { RoleGuard } from './components/layout/RoleGuard';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { StorageExplorerPage } from './pages/StorageExplorerPage';
import { RestorePage } from './pages/RestorePage';
import { SchedulePage } from './pages/SchedulePage';
import { LogsPage } from './pages/LogsPage';
import { TerminalPage } from './pages/TerminalPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { FleetPage } from './pages/FleetPage';
import { ServerDetailPage } from './pages/ServerDetailPage';

export const router = createBrowserRouter([
  {
    path: '/setup',
    element: <SetupPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: (
      <AuthGuard>
        <AppShell>
          <Outlet />
        </AppShell>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:name', element: <JobDetailPage /> },
      { path: 'storage', element: <StorageExplorerPage /> },
      { path: 'restore', element: <RoleGuard allowedRoles={['admin', 'operator']}><RestorePage /></RoleGuard> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'terminal', element: <RoleGuard allowedRoles={['admin', 'operator']}><TerminalPage /></RoleGuard> },
      { path: 'settings', element: <RoleGuard allowedRoles={['admin']}><SettingsPage /></RoleGuard> },
      { path: 'users', element: <RoleGuard allowedRoles={['admin']}><UsersPage /></RoleGuard> },
      { path: 'fleet', element: <RoleGuard allowedRoles={['admin']}><FleetPage /></RoleGuard> },
      { path: 'fleet/:id', element: <RoleGuard allowedRoles={['admin']}><ServerDetailPage /></RoleGuard> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
