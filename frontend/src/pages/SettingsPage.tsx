import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface SystemConfig {
  settings?: {
    temp_dir?: string;
    log_file?: string;
    compression?: string;
    concurrent_uploads?: number;
  };
  s3_endpoints?: Array<{
    name: string;
    url: string;
    access_key: string;
    secret_key: string;
    region?: string;
  }>;
  encryption?: {
    enabled: boolean;
    passphrase: string;
  };
  notifications?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    from_address?: string;
  };
}

interface UpdateInfo {
  available: boolean;
  current: string;
  latest?: string;
  release_url?: string;
  release_notes?: string;
  published_at?: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<SystemConfig>({
    queryKey: ['system-config'],
    queryFn: () => api.get('/system/config'),
  });

  const { data: updateInfo } = useQuery<UpdateInfo>({
    queryKey: ['update-check'],
    queryFn: () => api.get('/system/update/check'),
    staleTime: 300_000,
  });

  const [form, setForm] = useState<SystemConfig>({});

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const saveSettings = useMutation({
    mutationFn: (data: SystemConfig) => api.put('/system/settings', data),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  function handleSettingChange(field: string, value: unknown) {
    setForm((prev) => ({
      ...prev,
      settings: { ...prev.settings, [field]: value },
    }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings.mutate(form);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Update Banner */}
      {updateInfo?.available && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-cyan-400">Update Available</p>
            <p className="text-sm text-slate-400">
              v{updateInfo.current} → v{updateInfo.latest}
            </p>
          </div>
          <a
            href={updateInfo.release_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
          >
            View Release
          </a>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <Section title="General">
          <Field
            label="Temp Directory"
            value={form.settings?.temp_dir}
            onChange={(v) => handleSettingChange('temp_dir', v)}
            placeholder="/tmp/bck_manager"
          />
          <Field
            label="Log File"
            value={form.settings?.log_file}
            onChange={(v) => handleSettingChange('log_file', v)}
            placeholder="/var/log/bck_manager.log"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Compression</label>
            <select
              value={form.settings?.compression || 'gz'}
              onChange={(e) => handleSettingChange('compression', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="gz">gzip</option>
              <option value="bz2">bzip2</option>
              <option value="xz">xz</option>
              <option value="zst">zstd</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Concurrent Uploads</label>
            <input
              type="number"
              min={1}
              max={16}
              value={form.settings?.concurrent_uploads ?? 4}
              onChange={(e) => handleSettingChange('concurrent_uploads', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </Section>

        {/* Notifications / SMTP */}
        <Section title="SMTP Notifications">
          <Field
            label="SMTP Host"
            value={form.notifications?.smtp_host}
            onChange={(v) => setForm((p) => ({ ...p, notifications: { ...p.notifications, smtp_host: v } }))}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">SMTP Port</label>
            <input
              type="number"
              value={form.notifications?.smtp_port ?? 587}
              onChange={(e) => setForm((p) => ({ ...p, notifications: { ...p.notifications, smtp_port: parseInt(e.target.value) } }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <Field
            label="SMTP User"
            value={form.notifications?.smtp_user}
            onChange={(v) => setForm((p) => ({ ...p, notifications: { ...p.notifications, smtp_user: v } }))}
          />
          <Field
            label="SMTP Password"
            value={form.notifications?.smtp_password}
            onChange={(v) => setForm((p) => ({ ...p, notifications: { ...p.notifications, smtp_password: v } }))}
            type="password"
          />
          <Field
            label="From Address"
            value={form.notifications?.from_address}
            onChange={(v) => setForm((p) => ({ ...p, notifications: { ...p.notifications, from_address: v } }))}
            type="email"
          />
        </Section>

        <button
          type="submit"
          disabled={saveSettings.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
        >
          {saveSettings.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveSettings.isPending ? 'Saving…' : 'Save Settings'}
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
  type = 'text',
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
}
