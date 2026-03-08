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
      try {
        const user = await api.get<AuthUser>('/auth/me');
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) {
          setUser(null);
          // Check if setup is needed
          try {
            await api.get('/system/status');
          } catch (e: unknown) {
            if (e instanceof Error && 'status' in e && (e as { status: number }).status === 412) {
              setNeedsSetup(true);
            }
          }
        }
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
