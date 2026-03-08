import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderArchive,
  HardDrive,
  RotateCcw,
  Clock,
  FileText,
  Terminal,
  Settings,
  Users,
  Network,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/jobs', icon: FolderArchive, label: 'Jobs' },
  { to: '/storage', icon: HardDrive, label: 'Storage' },
  { to: '/restore', icon: RotateCcw, label: 'Restore' },
  { to: '/schedule', icon: Clock, label: 'Schedule' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/terminal', icon: Terminal, label: 'Terminal' },
];

const adminItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/fleet', icon: Network, label: 'Fleet' },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-slate-800">
        <FolderArchive className="h-6 w-6 text-cyan-500 mr-2" />
        <span className="font-semibold text-sm tracking-wide">BCK Manager</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Admin
              </span>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2 px-2">
          <div className="h-7 w-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
