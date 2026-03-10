import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, TestTube, Wifi, WifiOff, Server } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface ServerDetail {
  id: number;
  name: string;
  hostname: string;
  connection_type: 'agent' | 'ssh' | 'local';
  is_online: boolean;
  ssh_user?: string;
  ssh_port?: number;
  ssh_key_path?: string;
  bck_manager_path: string;
  config_path: string;
  terminal_users: string[];
}

export function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: server, isLoading } = useQuery<ServerDetail>({
    queryKey: ['server', id],
    queryFn: () => api.get(`/fleet/servers/${id}`),
    enabled: !!id,
  });

  const [form, setForm] = useState<Partial<ServerDetail>>({});

  useEffect(() => {
    if (server) setForm(server);
  }, [server]);

  const updateServer = useMutation({
    mutationFn: (data: Partial<ServerDetail>) =>
      api.patch(`/fleet/servers/${id}`, data),
    onSuccess: () => {
      toast.success('Server updated');
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['server', id] });
    },
    onError: () => toast.error('Failed to update server'),
  });

  const testServer = useMutation({
    mutationFn: () => api.post<{ success: boolean; message: string }>(`/fleet/servers/${id}/test`),
    onSuccess: (data) => {
      if (data.success) toast.success('Connection OK');
      else toast.error(data.message || 'Connection failed');
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateServer.mutate(form);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  if (!server) {
    return <div className="text-center py-12 text-slate-400">Server not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/fleet')} className="p-2 rounded-md hover:bg-slate-800 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold">{server.name}</h1>
            <p className="text-sm text-slate-400">{server.hostname}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {server.is_online ? (
            <span className="flex items-center gap-1.5 text-green-400 text-sm"><Wifi className="h-4 w-4" /> Online</span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500 text-sm"><WifiOff className="h-4 w-4" /> Offline</span>
          )}
          <button
            onClick={() => testServer.mutate()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors"
          >
            <TestTube className="h-4 w-4" /> Test
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section title="General">
          <Field label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          <Field label="Hostname" value={form.hostname} onChange={(v) => setForm((p) => ({ ...p, hostname: v }))} />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Connection Type</label>
            <select
              value={form.connection_type}
              onChange={(e) => setForm((p) => ({ ...p, connection_type: e.target.value as 'agent' | 'ssh' | 'local' }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ssh">SSH</option>
              <option value="agent">Agent</option>
              <option value="local">Local (this hub)</option>
            </select>
          </div>
        </Section>

        {form.connection_type === 'ssh' && (
          <Section title="SSH Configuration">
            <div className="grid grid-cols-2 gap-3">
              <Field label="SSH User" value={form.ssh_user} onChange={(v) => setForm((p) => ({ ...p, ssh_user: v }))} />
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">SSH Port</label>
                <input
                  type="number"
                  value={form.ssh_port ?? 22}
                  onChange={(e) => setForm((p) => ({ ...p, ssh_port: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <Field label="SSH Key Path" value={form.ssh_key_path} onChange={(v) => setForm((p) => ({ ...p, ssh_key_path: v }))} />
          </Section>
        )}

        <Section title="Paths">
          <Field label="BCK Manager Path" value={form.bck_manager_path} onChange={(v) => setForm((p) => ({ ...p, bck_manager_path: v }))} />
          <Field label="Config Path" value={form.config_path} onChange={(v) => setForm((p) => ({ ...p, config_path: v }))} />
        </Section>

        <Section title="Terminal">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Allowed Terminal Users</label>
            <input
              type="text"
              value={form.terminal_users?.join(', ') ?? ''}
              onChange={(e) => setForm((p) => ({
                ...p,
                terminal_users: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="root, deploy (comma separated)"
            />
          </div>
        </Section>

        <button
          type="submit"
          disabled={updateServer.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          {updateServer.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
}
