import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AuthGuard } from './components/layout/AuthGuard';
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
      { path: 'restore', element: <RestorePage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'fleet', element: <FleetPage /> },
      { path: 'fleet/:id', element: <ServerDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
