import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Play, Shield } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { SearchableSelect, type SelectOption } from '../components/SearchableSelect';
import { FilePicker } from '../components/FilePicker';

interface JobDetail {
  name: string;
  mode: string;
  enabled: boolean;
  s3_endpoint: string;
  bucket: string;
  prefix: string;
  source_path?: string;
  volume_name?: string;
  pre_command?: string;
  post_command?: string;
  encryption?: { enabled: boolean; passphrase?: string; key_name?: string; algorithm?: string };
  retention?: { mode?: string; days?: number; daily_keep?: number; monthly_keep?: number };
  notifications?: { additional_recipients?: string[]; exclusive_recipients?: string[] };
}

interface EncryptionKey { name: string; passphrase: string }
interface Endpoint { name: string; endpoint_url: string; region: string }
interface DockerVolume {
  Name: string;
  Driver: string;
  containers: Array<{ id: string; name: string; state: string; image: string }>;
}
interface Bucket { Name: string }

export function JobDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery<JobDetail>({
    queryKey: ['job', name],
    queryFn: () => api.get(`/jobs/${encodeURIComponent(name!)}`),
    enabled: !!name,
  });

  const [form, setForm] = useState<Partial<JobDetail>>({});

  useEffect(() => {
    if (job) setForm(job);
  }, [job]);

  /* Supporting data */
  const { data: endpoints = [], isLoading: epLoading } = useQuery<Endpoint[]>({
    queryKey: ['system-endpoints'],
    queryFn: () => api.get('/system/endpoints'),
  });

  const currentEndpoint = form.s3_endpoint ?? '';

  const { data: buckets = [], isLoading: bucketsLoading, isError: bucketsError } = useQuery<Bucket[]>({
    queryKey: ['buckets', currentEndpoint],
    queryFn: () => api.get(`/storage/buckets?endpoint=${encodeURIComponent(currentEndpoint)}`),
    enabled: !!currentEndpoint,
    retry: false,
  });

  const isVolume = form.mode === 'volume';

  const { data: volumes = [], isLoading: volsLoading } = useQuery<DockerVolume[]>({
    queryKey: ['volumes-rich'],
    queryFn: () => api.get('/filesystem/volumes-rich'),
    enabled: isVolume,
    retry: false,
  });

  const { data: encKeys = [] } = useQuery<EncryptionKey[]>({
    queryKey: ['encryption-keys'],
    queryFn: () => api.get('/system/encryption-keys'),
  });

  /* Build options */
  const endpointOptions: SelectOption[] = endpoints.map((ep) => ({
    value: ep.name,
    label: ep.name,
    sublabel: `${ep.endpoint_url}${ep.region ? ` · ${ep.region}` : ''}`,
  }));

  const bucketOptions: SelectOption[] = buckets.map((b) => ({ value: b.Name, label: b.Name }));

  const encKeyOptions: SelectOption[] = encKeys.map((k) => ({
    value: k.name,
    label: k.name,
  }));

  const volumeOptions: SelectOption[] = volumes.map((v) => {
    const names = v.containers.map((c) => c.name).filter(Boolean);
    const running = v.containers.filter((c) => c.state === 'running').length;
    return {
      value: v.Name,
      label: v.Name,
      sublabel: names.length ? names.join(', ') : 'No containers attached',
      badge: v.containers.length ? (running > 0 ? 'running' : 'stopped') : undefined,
    };
  });

  const updateJob = useMutation({
    mutationFn: (data: Partial<JobDetail>) =>
      api.put(`/jobs/${encodeURIComponent(name!)}`, data),
    onSuccess: () => {
      toast.success('Job updated');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', name] });
    },
    onError: () => toast.error('Failed to update job'),
  });

  const runJob = useMutation({
    mutationFn: () => api.post(`/run/job/${encodeURIComponent(name!)}`),
    onSuccess: () => toast.success(`Job "${name}" started`),
  });

  function handleChange(field: string, value: unknown) {
    if (field === 's3_endpoint') {
      setForm((prev) => ({ ...prev, s3_endpoint: value as string, bucket: '' }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateJob.mutate(form);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  if (!job) {
    return <div className="text-center py-12 text-slate-400">Job not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/jobs')} className="p-2 rounded-md hover:bg-slate-800 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{job.name}</h1>
          <p className="text-sm text-slate-400 uppercase">{job.mode}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => runJob.mutate()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors"
          >
            <Play className="h-4 w-4" /> Run now
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* S3 Section */}
        <Section title="S3 Configuration">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              S3 Endpoint
              {!epLoading && endpoints.length === 0 && (
                <span className="ml-2 text-xs text-amber-400">No endpoints — add one in Settings</span>
              )}
            </label>
            <SearchableSelect
              options={endpointOptions}
              value={form.s3_endpoint ?? ''}
              onChange={(v) => handleChange('s3_endpoint', v)}
              placeholder="Select endpoint…"
              loading={epLoading}
              emptyMessage="No S3 endpoints configured"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Bucket
              {currentEndpoint && bucketsError && (
                <span className="ml-2 text-xs text-amber-400">Could not load buckets — type manually</span>
              )}
            </label>
            <SearchableSelect
              options={bucketOptions}
              value={form.bucket ?? ''}
              onChange={(v) => handleChange('bucket', v)}
              placeholder={currentEndpoint ? 'Select or type bucket…' : 'Select an endpoint first'}
              loading={bucketsLoading}
              disabled={!currentEndpoint}
              allowManual={!!bucketsError}
              emptyMessage="No buckets found"
            />
          </div>
          <Field label="Prefix" value={form.prefix} onChange={(v) => handleChange('prefix', v)} />
        </Section>

        {/* Source */}
        <Section title="Source">
          {isVolume ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Docker Volume</label>
              <SearchableSelect
                options={volumeOptions}
                value={form.volume_name ?? ''}
                onChange={(v) => handleChange('volume_name', v)}
                placeholder="Select volume…"
                loading={volsLoading}
                emptyMessage="No Docker volumes found"
              />
              {form.volume_name && (() => {
                const vol = volumes.find((v) => v.Name === form.volume_name);
                if (!vol || vol.containers.length === 0) return null;
                return (
                  <div className="mt-2 p-2 bg-slate-800/50 border border-slate-700 rounded-md space-y-1">
                    {vol.containers.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-slate-500'}`} />
                        <span className="text-slate-200 font-medium">{c.name}</span>
                        <span className="text-slate-400">{c.image}</span>
                        <span className={`ml-auto ${c.state === 'running' ? 'text-green-400' : 'text-slate-400'}`}>{c.state}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Source Path</label>
              <FilePicker
                value={form.source_path ?? ''}
                onChange={(v) => handleChange('source_path', v)}
              />
            </div>
          )}
          <Field label="Pre-command" value={form.pre_command} onChange={(v) => handleChange('pre_command', v)} />
          <Field label="Post-command" value={form.post_command} onChange={(v) => handleChange('post_command', v)} />
        </Section>

        {/* Options */}
        <Section title="Options">
          <div className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled ?? true}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="enabled" className="text-sm text-slate-300">Enabled</label>
          </div>
        </Section>

        {/* Encryption */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-amber-400" />
            <h3 className="font-semibold">Encryption</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enc-enabled"
                checked={form.encryption?.enabled ?? false}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  encryption: { ...p.encryption, enabled: e.target.checked },
                }))}
                className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="enc-enabled" className="text-sm text-slate-300">Enable encryption (AES-256-GCM)</label>
            </div>

            {form.encryption?.enabled && (
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
                    value={form.encryption?.key_name ?? ''}
                    onChange={(v) => setForm((p) => ({
                      ...p,
                      encryption: { ...p.encryption, enabled: true, key_name: v, passphrase: undefined },
                    }))}
                    placeholder="Select named key…"
                    emptyMessage="No encryption keys configured"
                  />
                  <p className="text-xs text-slate-500 mt-1">Select a named key from Settings, or leave empty to use an inline passphrase below.</p>
                </div>

                {!form.encryption?.key_name && (
                  <Field
                    label="Inline Passphrase"
                    value={form.encryption?.passphrase}
                    onChange={(v) => setForm((p) => ({
                      ...p,
                      encryption: { ...p.encryption, enabled: true, passphrase: v, key_name: undefined },
                    }))}
                    type="password"
                  />
                )}
              </>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={updateJob.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          {updateJob.isPending ? 'Saving…' : 'Save Changes'}
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
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
    </div>
  );
}
