import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Network, Wifi, WifiOff, Server, Key, TestTube,
} from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface ServerInfo {
  id: number;
  name: string;
  hostname: string;
  connection_type: 'agent' | 'ssh';
  is_online: boolean;
  ssh_user?: string;
  ssh_port?: number;
}

export function FleetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showToken, setShowToken] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery<ServerInfo[]>({
    queryKey: ['servers'],
    queryFn: () => api.get('/fleet/servers'),
  });

  const deleteServer = useMutation({
    mutationFn: (id: number) => api.delete(`/fleet/servers/${id}`),
    onSuccess: () => {
      toast.success('Server removed');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const testServer = useMutation({
    mutationFn: (id: number) => api.post<{ success: boolean; message: string }>(`/fleet/servers/${id}/test`),
    onSuccess: (data) => {
      if (data.success) toast.success('Connection OK');
      else toast.error(data.message || 'Connection failed');
    },
  });

  const generateToken = useMutation({
    mutationFn: () => api.post<{ token: string }>('/fleet/token/generate'),
    onSuccess: (data) => setShowToken(data.token),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fleet Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => generateToken.mutate()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors"
          >
            <Key className="h-4 w-4" />
            Generate Token
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>
      </div>

      {/* Token display */}
      {showToken && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-400 mb-2">Agent Token (shown once):</p>
          <code className="block p-2 bg-slate-800 rounded text-xs font-mono break-all">{showToken}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(showToken); toast.success('Copied'); }}
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
          >
            Copy to clipboard
          </button>
        </div>
      )}

      {/* Server grid */}
      {servers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Network className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p>No servers in fleet.</p>
          <p className="text-sm mt-1">Add a server or deploy an agent to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((server) => (
            <div
              key={server.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors cursor-pointer"
              onClick={() => navigate(`/fleet/${server.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-slate-400" />
                  <div>
                    <h3 className="font-semibold">{server.name}</h3>
                    <p className="text-xs text-slate-400">{server.hostname}</p>
                  </div>
                </div>
                {server.is_online ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : (
                  <WifiOff className="h-4 w-4 text-slate-500" />
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                <span className="px-2 py-0.5 rounded bg-slate-800 uppercase">{server.connection_type}</span>
                {server.connection_type === 'ssh' && (
                  <span>{server.ssh_user}@{server.hostname}:{server.ssh_port || 22}</span>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={(e) => { e.stopPropagation(); testServer.mutate(server.id); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <TestTube className="h-3 w-3" /> Test
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove "${server.name}" from fleet?`)) deleteServer.mutate(server.id);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-red-900/50 text-red-400 transition-colors ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ServerCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function ServerCreateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    hostname: '',
    connection_type: 'ssh' as 'agent' | 'ssh',
    ssh_user: 'root',
    ssh_port: 22,
    ssh_key_path: '',
    bck_manager_path: '/opt/bck_manager',
    config_path: '/opt/bck_manager/config.yaml',
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/fleet/servers', form);
      toast.success('Server added');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      onClose();
    } catch {
      toast.error('Failed to add server');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Add Server</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="production-db"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Hostname / IP</label>
            <input
              type="text"
              required
              value={form.hostname}
              onChange={(e) => setForm((p) => ({ ...p, hostname: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Connection Type</label>
            <select
              value={form.connection_type}
              onChange={(e) => setForm((p) => ({ ...p, connection_type: e.target.value as 'agent' | 'ssh' }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ssh">SSH</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          {form.connection_type === 'ssh' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">SSH User</label>
                  <input
                    type="text"
                    value={form.ssh_user}
                    onChange={(e) => setForm((p) => ({ ...p, ssh_user: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">SSH Port</label>
                  <input
                    type="number"
                    value={form.ssh_port}
                    onChange={(e) => setForm((p) => ({ ...p, ssh_port: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">SSH Key Path</label>
                <input
                  type="text"
                  value={form.ssh_key_path}
                  onChange={(e) => setForm((p) => ({ ...p, ssh_key_path: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="~/.ssh/id_rsa"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">BCK Manager Path</label>
            <input
              type="text"
              value={form.bck_manager_path}
              onChange={(e) => setForm((p) => ({ ...p, bck_manager_path: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
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
              {submitting ? 'Adding…' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
