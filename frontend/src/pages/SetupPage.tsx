import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderArchive } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { api, ApiError } from '../api/client';
import { toast } from 'sonner';

export function SetupPage() {
  const navigate = useNavigate();
  const { setUser, setNeedsSetup } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const user = await api.post<{ id: number; username: string; email: string; role: 'admin' | 'operator' | 'viewer'; is_active: boolean; allowed_system_users: string[] }>(
        '/setup',
        { username: form.username, email: form.email, password: form.password },
      );
      setUser(user);
      setNeedsSetup(false);
      toast.success('Admin account created');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        toast.error('Setup already completed');
        navigate('/login', { replace: true });
      } else {
        toast.error('Setup failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-col items-center gap-2">
          <FolderArchive className="h-10 w-10 text-cyan-500" />
          <h1 className="text-xl font-bold">Welcome to BCK Manager</h1>
          <p className="text-sm text-slate-400">Create your admin account to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
          >
            {loading ? 'Creating…' : 'Create admin account'}
          </button>
        </form>
      </div>
    </div>
  );
}
