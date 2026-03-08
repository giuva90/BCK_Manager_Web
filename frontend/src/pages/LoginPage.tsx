import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FolderArchive } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api, ApiError } from '../api/client';
import { toast } from 'sonner';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await api.post<{ id: number; username: string; email: string; role: 'admin' | 'operator' | 'viewer'; is_active: boolean; allowed_system_users: string[] }>(
        '/auth/login',
        { username, password },
      );
      setUser(user);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error('Invalid credentials');
      } else {
        toast.error('Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-sm p-8 space-y-6 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-col items-center gap-2">
          <FolderArchive className="h-10 w-10 text-cyan-500" />
          <h1 className="text-xl font-bold">BCK Manager</h1>
          <p className="text-sm text-slate-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
