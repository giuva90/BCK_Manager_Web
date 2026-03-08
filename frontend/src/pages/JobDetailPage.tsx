import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface JobDetail {
  name: string;
  type: string;
  enabled: boolean;
  s3_endpoint_url: string;
  s3_bucket: string;
  s3_access_key: string;
  s3_secret_key: string;
  prefix: string;
  sources: string[];
  encryption?: { enabled: boolean; passphrase: string };
  retention?: { daily: number; weekly: number; monthly: number };
  notifications?: { on_success: boolean; on_failure: boolean; email: string };
  compression: string;
}

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
    setForm((prev) => ({ ...prev, [field]: value }));
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
          <p className="text-sm text-slate-400 uppercase">{job.type}</p>
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
          <Field label="Endpoint URL" value={form.s3_endpoint_url} onChange={(v) => handleChange('s3_endpoint_url', v)} />
          <Field label="Bucket" value={form.s3_bucket} onChange={(v) => handleChange('s3_bucket', v)} />
          <Field label="Access Key" value={form.s3_access_key} onChange={(v) => handleChange('s3_access_key', v)} />
          <Field label="Secret Key" value={form.s3_secret_key} onChange={(v) => handleChange('s3_secret_key', v)} type="password" />
          <Field label="Prefix" value={form.prefix} onChange={(v) => handleChange('prefix', v)} />
        </Section>

        {/* Sources */}
        <Section title="Sources">
          <div className="space-y-2">
            {(form.sources || []).map((src, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={src}
                  onChange={(e) => {
                    const next = [...(form.sources || [])];
                    next[i] = e.target.value;
                    handleChange('sources', next);
                  }}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => handleChange('sources', (form.sources || []).filter((_, j) => j !== i))}
                  className="px-2 py-2 text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => handleChange('sources', [...(form.sources || []), ''])}
              className="text-sm text-cyan-400 hover:text-cyan-300"
            >
              + Add source
            </button>
          </div>
        </Section>

        {/* Compression */}
        <Section title="Options">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Compression</label>
            <select
              value={form.compression || 'gz'}
              onChange={(e) => handleChange('compression', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="gz">gzip</option>
              <option value="bz2">bzip2</option>
              <option value="xz">xz</option>
              <option value="zst">zstd</option>
              <option value="none">None</option>
            </select>
          </div>
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
