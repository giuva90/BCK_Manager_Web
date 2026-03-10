import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Pencil, Trash2, Plug, Shield } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface SystemConfig {
  settings?: {
    temp_dir?: string;
    log_file?: string;
    compression?: string;
    concurrent_uploads?: number;
  };
  notifications?: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    from_address?: string;
  };
}

interface S3Endpoint {
  name: string;
  endpoint_url: string;
  region: string;
  access_key: string;
  secret_key: string;
}

interface EncryptionKey {
  name: string;
  passphrase: string;
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
  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<S3Endpoint | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [editingKey, setEditingKey] = useState<EncryptionKey | null>(null);

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

      {/* S3 Endpoints */}
      <S3EndpointsSection
        onAdd={() => { setEditingEndpoint(null); setShowEndpointModal(true); }}
        onEdit={(ep) => { setEditingEndpoint(ep); setShowEndpointModal(true); }}
      />

      {/* Encryption Keys */}
      <EncryptionKeysSection
        onAdd={() => { setEditingKey(null); setShowKeyModal(true); }}
        onEdit={(k) => { setEditingKey(k); setShowKeyModal(true); }}
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <Section title="General">
          <Field            label="Temp Directory"
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

      {showEndpointModal && (
        <EndpointModal
          endpoint={editingEndpoint}
          onClose={() => { setShowEndpointModal(false); setEditingEndpoint(null); }}
        />
      )}

      {showKeyModal && (
        <EncryptionKeyModal
          encKey={editingKey}
          onClose={() => { setShowKeyModal(false); setEditingKey(null); }}
        />
      )}
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

// ---------------------------------------------------------------------------
// S3 Endpoints section + modal
// ---------------------------------------------------------------------------

function S3EndpointsSection({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (ep: S3Endpoint) => void;
}) {
  const queryClient = useQueryClient();

  const { data: endpoints = [], isLoading } = useQuery<S3Endpoint[]>({
    queryKey: ['system-endpoints'],
    queryFn: () => api.get('/system/endpoints'),
  });

  const deleteEndpoint = useMutation({
    mutationFn: (name: string) => api.delete(`/system/endpoints/${encodeURIComponent(name)}`),
    onSuccess: (_, name) => {
      toast.success(`Endpoint "${name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['system-endpoints'] });
    },
    onError: () => toast.error('Failed to delete endpoint'),
  });

  const testEndpoint = useMutation({
    mutationFn: (name: string) => api.post<{ success: boolean }>('/storage/test', { endpoint_name: name }),
    onSuccess: (data, name) => {
      if (data.success) toast.success(`Endpoint "${name}" is reachable`);
      else toast.error(`Endpoint "${name}" is not reachable`);
    },
    onError: (_, name) => toast.error(`Test failed for "${name}"`),
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">S3 Endpoints</h3>
          <p className="text-xs text-slate-400 mt-0.5">Local config · {_CONFIG_LABEL}</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-md text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Endpoint
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : endpoints.length === 0 ? (
        <p className="text-sm text-slate-400">No S3 endpoints configured. Add one to start creating backup jobs.</p>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div
              key={ep.name}
              className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{ep.name}</p>
                <p className="text-xs text-slate-400 truncate">{ep.endpoint_url}</p>
                {ep.region && <p className="text-xs text-slate-500">Region: {ep.region}</p>}
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <button
                  onClick={() => testEndpoint.mutate(ep.name)}
                  disabled={testEndpoint.isPending}
                  className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors"
                  title="Test connection"
                >
                  <Plug className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onEdit(ep)}
                  className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete endpoint "${ep.name}"?`)) deleteEndpoint.mutate(ep.name);
                  }}
                  className="p-1.5 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The section needs access to settings for the config path label — show a static hint
const _CONFIG_LABEL = 'config.yaml (local)';

// ---------------------------------------------------------------------------
// Encryption Keys section + modal
// ---------------------------------------------------------------------------

function EncryptionKeysSection({
  onAdd,
  onEdit,
}: {
  onAdd: () => void;
  onEdit: (k: EncryptionKey) => void;
}) {
  const queryClient = useQueryClient();

  const { data: keys = [], isLoading } = useQuery<EncryptionKey[]>({
    queryKey: ['encryption-keys'],
    queryFn: () => api.get('/system/encryption-keys'),
  });

  const deleteKey = useMutation({
    mutationFn: (name: string) => api.delete(`/system/encryption-keys/${encodeURIComponent(name)}`),
    onSuccess: (_, name) => {
      toast.success(`Encryption key "${name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['encryption-keys'] });
    },
    onError: () => toast.error('Failed to delete encryption key'),
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" />
          <div>
            <h3 className="font-semibold">Encryption Keys</h3>
            <p className="text-xs text-slate-400 mt-0.5">Named passphrases for backup encryption · {_CONFIG_LABEL}</p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-md text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Key
        </button>
      </div>

      <p className="text-xs text-amber-400/80 mb-3">
        These passphrases are the ONLY way to decrypt your backups. Store them securely.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-400">No encryption keys configured. Add one to enable backup encryption.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.name}
              className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-lg"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{k.name}</p>
                <p className="text-xs text-slate-500 font-mono">{k.passphrase}</p>
              </div>
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <button
                  onClick={() => onEdit(k)}
                  className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete encryption key "${k.name}"? Backups encrypted with this key will NOT be decryptable without the passphrase.`)) deleteKey.mutate(k.name);
                  }}
                  className="p-1.5 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EncryptionKeyModal({
  encKey,
  onClose,
}: {
  encKey: EncryptionKey | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!encKey;
  const MASK = '••••••••';

  const [form, setForm] = useState({
    name: encKey?.name ?? '',
    passphrase: encKey?.passphrase ?? '',
  });
  const [submitting, setSubmitting] = useState(false);

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, string> = {};
        if (form.passphrase !== MASK) payload.passphrase = form.passphrase;
        await api.put(`/system/encryption-keys/${encodeURIComponent(encKey!.name)}`, payload);
        toast.success(`Encryption key "${encKey!.name}" updated`);
      } else {
        await api.post('/system/encryption-keys', form);
        toast.success(`Encryption key "${form.name}" created`);
      }
      queryClient.invalidateQueries({ queryKey: ['encryption-keys'] });
      onClose();
    } catch {
      toast.error(isEdit ? 'Failed to update key' : 'Failed to create key');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit' : 'Add'} Encryption Key</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Key Name</label>
            <input
              type="text"
              required
              disabled={isEdit}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              placeholder="production-key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Passphrase {isEdit && <span className="text-slate-500 font-normal">(leave masked to keep current)</span>}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={form.passphrase}
              onChange={(e) => set('passphrase', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Enter a strong passphrase"
            />
            <p className="text-xs text-amber-400/70 mt-1">This passphrase is used to derive the AES-256-GCM encryption key.</p>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EndpointModal({
  endpoint,
  onClose,
}: {
  endpoint: S3Endpoint | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!endpoint;
  const MASK = '••••••••';

  const [form, setForm] = useState({
    name: endpoint?.name ?? '',
    endpoint_url: endpoint?.endpoint_url ?? '',
    region: endpoint?.region ?? '',
    access_key: endpoint?.access_key ?? '',
    secret_key: endpoint?.secret_key ?? '',
  });
  const [submitting, setSubmitting] = useState(false);

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        const payload: Record<string, string> = {
          endpoint_url: form.endpoint_url,
          region: form.region,
        };
        if (form.access_key !== MASK) payload.access_key = form.access_key;
        if (form.secret_key !== MASK) payload.secret_key = form.secret_key;
        await api.put(`/system/endpoints/${encodeURIComponent(endpoint!.name)}`, payload);
        toast.success(`Endpoint "${endpoint!.name}" updated`);
      } else {
        await api.post('/system/endpoints', form);
        toast.success(`Endpoint "${form.name}" created`);
      }
      queryClient.invalidateQueries({ queryKey: ['system-endpoints'] });
      onClose();
    } catch {
      toast.error(isEdit ? 'Failed to update endpoint' : 'Failed to create endpoint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit' : 'Add'} S3 Endpoint</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              required
              disabled={isEdit}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              placeholder="ovh-gra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Endpoint URL</label>
            <input
              type="url"
              required
              value={form.endpoint_url}
              onChange={(e) => set('endpoint_url', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="https://s3.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Region</label>
            <input
              type="text"
              value={form.region}
              onChange={(e) => set('region', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="gra"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Access Key {isEdit && <span className="text-slate-500 font-normal">(leave masked to keep current)</span>}
            </label>
            <input
              type="text"
              required={!isEdit}
              value={form.access_key}
              onChange={(e) => set('access_key', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="ACCESS_KEY"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Secret Key {isEdit && <span className="text-slate-500 font-normal">(leave masked to keep current)</span>}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={form.secret_key}
              onChange={(e) => set('secret_key', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="SECRET_KEY"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
