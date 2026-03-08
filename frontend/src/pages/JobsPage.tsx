import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, ToggleLeft, ToggleRight, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface Job {
  name: string;
  type: string;
  enabled: boolean;
  s3_endpoint_url: string;
  s3_bucket: string;
  prefix: string;
  sources: string[];
  retention?: { daily?: number; weekly?: number; monthly?: number };
}

export function JobsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

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
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Job
        </button>
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
                  <span className="text-xs text-slate-400 uppercase">{job.type}</span>
                </div>
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
              </div>

              <div className="space-y-1 text-sm text-slate-400">
                <p className="truncate">Bucket: {job.s3_bucket}</p>
                <p className="truncate">Prefix: {job.prefix || '/'}</p>
                <p>Sources: {job.sources?.length ?? 0}</p>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={(e) => { e.stopPropagation(); runJob.mutate(job.name); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Play className="h-3 w-3" /> Run
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${encodeURIComponent(job.name)}`); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete job "${job.name}"?`)) deleteJob.mutate(job.name);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-red-900/50 text-red-400 transition-colors ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <JobCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

/* ---- Minimal Create Modal ---- */
function JobCreateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('file');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/jobs', {
        name,
        type,
        enabled: true,
        s3_endpoint_url: '',
        s3_bucket: '',
        s3_access_key: '',
        s3_secret_key: '',
        prefix: name,
        sources: [],
      });
      toast.success(`Job "${name}" created`);
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">New Backup Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Job Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="my-backup"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="file">File</option>
              <option value="docker_volume">Docker Volume</option>
            </select>
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
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
