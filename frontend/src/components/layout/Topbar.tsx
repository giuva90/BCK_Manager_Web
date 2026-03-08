import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { api } from '../../api/client';

export function Topbar() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { isFleetMode, selectedServerId, setSelectedServer } = useServerStore();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  }

  return (
    <header className="h-14 flex-shrink-0 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {isFleetMode && (
          <select
            value={selectedServerId ?? ''}
            onChange={(e) => setSelectedServer(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-800 border border-slate-700 text-sm rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">Local server</option>
            {/* Fleet servers loaded from queries */}
          </select>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </header>
  );
}
