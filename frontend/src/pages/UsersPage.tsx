import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, Pencil, Shield, ShieldCheck, Eye } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  allowed_system_users: string[];
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });

  const roleIcons: Record<string, React.ElementType> = {
    admin: ShieldCheck,
    operator: Shield,
    viewer: Eye,
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const RoleIcon = roleIcons[user.role] || Eye;
              return (
                <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-slate-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 capitalize">
                      <RoleIcon className="h-4 w-4 text-cyan-400" />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-1 rounded hover:bg-slate-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => { if (confirm(`Delete user "${user.username}"?`)) deleteUser.mutate(user.id); }}
                          className="p-1 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <UserModal onClose={() => setShowCreate(false)} />}
      {editingUser && <UserModal user={editingUser} onClose={() => setEditingUser(null)} />}
    </div>
  );
}

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'viewer' as const,
    is_active: user?.is_active ?? true,
    allowed_system_users: user?.allowed_system_users?.join(', ') || '',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        role: form.role,
        is_active: form.is_active,
        allowed_system_users: form.allowed_system_users.split(',').map((s) => s.trim()).filter(Boolean),
      };
      if (form.password) payload.password = form.password;

      if (user) {
        await api.patch(`/users/${user.id}`, payload);
        toast.success('User updated');
      } else {
        if (!form.password) {
          toast.error('Password is required');
          setSubmitting(false);
          return;
        }
        await api.post('/users', payload);
        toast.success('User created');
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch {
      toast.error(user ? 'Failed to update user' : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{user ? 'Edit User' : 'New User'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password {user && <span className="text-slate-500 font-normal">(leave blank to keep)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin' | 'operator' | 'viewer' }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Allowed System Users</label>
            <input
              type="text"
              value={form.allowed_system_users}
              onChange={(e) => setForm((p) => ({ ...p, allowed_system_users: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="root, deploy (comma separated)"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="active" className="text-sm text-slate-300">Active</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving…' : user ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
