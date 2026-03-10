import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import type { AuthUser } from '../../store/authStore';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, needsSetup, setUser, setNeedsSetup } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Check if first-run setup is required before attempting auth.
      // This endpoint is public so it never returns 401 and cannot
      // trigger the API client's automatic redirect to /login.
      try {
        const status = await api.get<{ needs_setup: boolean }>('/setup');
        if (!cancelled && status.needs_setup) {
          setNeedsSetup(true);
          setLoading(false);
          return;
        }
      } catch {
        // If the setup-status endpoint is unreachable fall through to
        // the normal auth check; the error will surface there instead.
      }

      // Setup is complete — verify the current user session.
      try {
        const user = await api.get<AuthUser>('/auth/me');
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [setUser, setNeedsSetup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    );
  }

  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return <>{children}</>;
}
