import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, ToggleLeft, ToggleRight, Trash2, Pencil, Shield } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { SearchableSelect, type SelectOption } from '../components/SearchableSelect';
import { FilePicker } from '../components/FilePicker';
import { useAuthStore } from '../store/authStore';

interface Job {
  name: string;
  mode: string;
  enabled: boolean;
  s3_endpoint: string;
  bucket: string;
  prefix: string;
  source_path?: string;
  volume_name?: string;
  retention?: { mode?: string; days?: number; daily_keep?: number; monthly_keep?: number };
}

export function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const canRun = user?.role === 'admin' || user?.role === 'operator';

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs'),
  });

  const toggleJob = useMutation({
    mutationFn: (name: string) => api.patch(`/jobs/${encodeURIComponent(name)}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const deleteJob = useMutation({
    mutationFn: (name: string) => api.delete(`/jobs/${encodeURIComponent(name)}`),
    onSuccess: (_, name) => {
      toast.success(`Job "${name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (_, name) => toast.error(`Failed to delete "${name}"`),
  });

  const runJob = useMutation({
    mutationFn: (name: string) => api.post(`/run/job/${encodeURIComponent(name)}`),
    onSuccess: (_, name) => toast.success(`Job "${name}" started`),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backup Jobs</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Job
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>No backup jobs configured yet.</p>
          <p className="text-sm mt-1">Create your first job to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <div
              key={job.name}
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors cursor-pointer"
              onClick={() => navigate(`/jobs/${encodeURIComponent(job.name)}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{job.name}</h3>
                  <span className="text-xs text-slate-400 uppercase">{job.mode}</span>
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleJob.mutate(job.name); }}
                    title={job.enabled ? 'Disable' : 'Enable'}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {job.enabled ? (
                      <ToggleRight className="h-5 w-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-slate-500" />
                    )}
                  </button>
                )}
              </div>

              <div className="space-y-1 text-sm text-slate-400">
                <p className="truncate">Bucket: {job.bucket}</p>
                <p className="truncate">Prefix: {job.prefix || '/'}</p>
                <p>Source: {job.source_path || job.volume_name || '—'}</p>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                {canRun && (
                  <button
                    onClick={(e) => { e.stopPropagation(); runJob.mutate(job.name); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <Play className="h-3 w-3" /> Run
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${encodeURIComponent(job.name)}`); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {isAdmin ? 'Edit' : 'View'}
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete job "${job.name}"?`)) deleteJob.mutate(job.name);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-red-900/50 text-red-400 transition-colors ml-auto"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <JobCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

/* ---- Create Modal ---- */
interface Endpoint {
  name: string;
  endpoint_url: string;
  region: string;
}

interface EncryptionKey { name: string; passphrase: string }

interface Server {
  id: number;
  name: string;
  hostname: string;
}

interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint?: string;
  containers: Array<{ id: string; name: string; state: string; image: string }>;
}

interface Bucket {
  name: string;
}

function JobCreateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    mode: 'folder' as 'folder' | 'files' | 'volume',
    source_path: '',
    volume_name: '',
    s3_endpoint: '',
    bucket: '',
    prefix: '',
    enabled: true,
    enc_enabled: false,
    enc_key_name: '',
    enc_passphrase: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: endpoints = [], isLoading: epLoading } = useQuery<Endpoint[]>({
    queryKey: ['system-endpoints'],
    queryFn: () => api.get('/system/endpoints'),
  });

  const { data: servers = [] } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: () => api.get('/fleet/servers'),
  });

  /* Buckets — loaded when an endpoint is selected */
  const { data: buckets = [], isLoading: bucketsLoading, isError: bucketsError } = useQuery<Bucket[]>({
    queryKey: ['buckets', form.s3_endpoint],
    queryFn: () => api.get(`/storage/buckets?endpoint=${encodeURIComponent(form.s3_endpoint)}`),
    enabled: !!form.s3_endpoint,
    retry: false,
  });

  /* Docker volumes */
  const { data: volumes = [], isLoading: volsLoading } = useQuery<DockerVolume[]>({
    queryKey: ['volumes-rich'],
    queryFn: () => api.get('/filesystem/volumes-rich'),
    enabled: form.mode === 'volume',
    retry: false,
  });

  /* Encryption keys */
  const { data: encKeys = [] } = useQuery<EncryptionKey[]>({
    queryKey: ['encryption-keys'],
    queryFn: () => api.get('/system/encryption-keys'),
  });

  function set(field: string, value: unknown) {
    if (field === 's3_endpoint') {
      setForm((p) => ({ ...p, s3_endpoint: value as string, bucket: '' }));
    } else {
      setForm((p) => ({ ...p, [field]: value }));
    }
  }

  /* Build SearchableSelect options */
  const endpointOptions: SelectOption[] = endpoints.map((ep) => ({
    value: ep.name,
    label: ep.name,
    sublabel: `${ep.endpoint_url}${ep.region ? ` · ${ep.region}` : ''}`,
  }));

  const bucketOptions: SelectOption[] = buckets.map((b) => ({
    value: b.name,
    label: b.name,
  }));

  const volumeOptions: SelectOption[] = volumes.map((v) => {
    const containerNames = v.containers.map((c) => c.name).filter(Boolean);
    const runningCount = v.containers.filter((c) => c.state === 'running').length;
    return {
      value: v.Name,
      label: v.Name,
      sublabel: containerNames.length
        ? containerNames.join(', ')
        : 'No containers attached',
      badge: v.containers.length
        ? runningCount > 0
          ? 'running'
          : 'stopped'
        : undefined,
    };
  });

  const encKeyOptions: SelectOption[] = encKeys.map((k) => ({
    value: k.name,
    label: k.name,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.s3_endpoint) { toast.error('Select an S3 endpoint'); return; }
    if (!form.bucket) { toast.error('Bucket is required'); return; }
    if (form.mode !== 'volume' && !form.source_path) { toast.error('Source path is required'); return; }
    if (form.mode === 'volume' && !form.volume_name) { toast.error('Volume name is required'); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        mode: form.mode,
        s3_endpoint: form.s3_endpoint,
        bucket: form.bucket,
        prefix: form.prefix || form.name,
        enabled: form.enabled,
      };
      if (form.mode === 'volume') {
        payload.volume_name = form.volume_name;
      } else {
        payload.source_path = form.source_path;
      }
      if (form.enc_enabled) {
        payload.encryption = {
          enabled: true,
          ...(form.enc_key_name ? { key_name: form.enc_key_name } : { passphrase: form.enc_passphrase }),
        };
      }
      await api.post('/jobs', payload);
      toast.success(`Job "${form.name}" created`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    } catch {
      toast.error('Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">New Backup Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Job Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="my-backup"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mode</label>
            <select
              value={form.mode}
              onChange={(e) => set('mode', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="folder">Folder — compress entire folder as one archive</option>
              <option value="files">Files — compress each file individually</option>
              <option value="volume">Docker Volume</option>
            </select>
          </div>

          {/* Source: FilePicker or Volume dropdown */}
          {form.mode === 'volume' ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Docker Volume</label>
              <SearchableSelect
                options={volumeOptions}
                value={form.volume_name}
                onChange={(v) => set('volume_name', v)}
                placeholder="Select volume…"
                loading={volsLoading}
                emptyMessage="No Docker volumes found"
              />
              {form.volume_name && (
                (() => {
                  const vol = volumes.find((v) => v.Name === form.volume_name);
                  if (!vol || vol.containers.length === 0) return null;
                  return (
                    <div className="mt-2 p-2 bg-slate-800/50 border border-slate-700 rounded-md space-y-1">
                      {vol.containers.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              c.state === 'running' ? 'bg-green-400' : 'bg-slate-500'
                            }`}
                          />
                          <span className="text-slate-200 font-medium">{c.name}</span>
                          <span className="text-slate-400">{c.image}</span>
                          <span className={`ml-auto ${c.state === 'running' ? 'text-green-400' : 'text-slate-400'}`}>
                            {c.state}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Source Path</label>
              <FilePicker
                value={form.source_path}
                onChange={(v) => set('source_path', v)}
                placeholder={form.mode === 'folder' ? 'C:/MyApp/data' : '/var/data'}
              />
            </div>
          )}

          {/* S3 Endpoint */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              S3 Endpoint
              {!epLoading && endpoints.length === 0 && (
                <span className="ml-2 text-xs text-amber-400">No endpoints — add one in Settings</span>
              )}
            </label>
            <SearchableSelect
              options={endpointOptions}
              value={form.s3_endpoint}
              onChange={(v) => set('s3_endpoint', v)}
              placeholder="Select endpoint…"
              loading={epLoading}
              emptyMessage="No S3 endpoints configured"
            />
          </div>

          {/* Bucket */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bucket
              {form.s3_endpoint && bucketsError && (
                <span className="ml-2 text-xs text-amber-400">Could not load buckets — type manually</span>
              )}
            </label>
            <SearchableSelect
              options={bucketOptions}
              value={form.bucket}
              onChange={(v) => set('bucket', v)}
              placeholder={form.s3_endpoint ? 'Select or type bucket…' : 'Select an endpoint first'}
              loading={bucketsLoading}
              disabled={!form.s3_endpoint}
              allowManual={!!bucketsError}
              emptyMessage="No buckets found"
            />
          </div>

          {/* Prefix */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Prefix (S3 subfolder)</label>
            <input
              type="text"
              value={form.prefix}
              onChange={(e) => set('prefix', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="backups/myapp"
            />
          </div>

          {/* Location info */}
          {servers.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-md text-xs text-slate-400">
              <span className="text-cyan-400">📍</span>
              <span>Local config — to create jobs on remote nodes, use the Fleet server detail page.</span>
            </div>
          )}

          {/* Encryption */}
          <div className="border border-slate-700 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-slate-300">Encryption</span>
              <input
                type="checkbox"
                checked={form.enc_enabled}
                onChange={(e) => set('enc_enabled', e.target.checked)}
                className="ml-auto rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
            </div>
            {form.enc_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Encryption Key
                    {encKeys.length === 0 && (
                      <span className="ml-2 text-xs text-amber-400">No keys — add one in Settings</span>
                    )}
                  </label>
                  <SearchableSelect
                    options={encKeyOptions}
                    value={form.enc_key_name}
                    onChange={(v) => setForm((p) => ({ ...p, enc_key_name: v, enc_passphrase: '' }))}
                    placeholder="Select named key…"
                    emptyMessage="No encryption keys configured"
                  />
                </div>
                {!form.enc_key_name && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Inline Passphrase</label>
                    <input
                      type="password"
                      value={form.enc_passphrase}
                      onChange={(e) => setForm((p) => ({ ...p, enc_passphrase: e.target.value, enc_key_name: '' }))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Enter a strong passphrase"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="job-enabled"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="job-enabled" className="text-sm text-slate-300">Enabled</label>
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
              {submitting ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
