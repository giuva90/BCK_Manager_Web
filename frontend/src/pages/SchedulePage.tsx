import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Clock } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface CronJob {
  id: number;
  label: string;
  job_name: string;
  cron_expression: string;
  enabled: boolean;
  created_by: string;
  next_runs?: string[];
}

interface Job {
  name: string;
  type: string;
}

export function SchedulePage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: cronJobs = [], isLoading } = useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: () => api.get('/cron'),
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs'),
  });

  const toggleCron = useMutation({
    mutationFn: (cron: CronJob) =>
      api.patch(`/cron/${cron.id}`, { enabled: !cron.enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
  });

  const deleteCron = useMutation({
    mutationFn: (id: number) => api.delete(`/cron/${id}`),
    onSuccess: () => {
      toast.success('Schedule deleted');
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      {cronJobs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Clock className="h-10 w-10 mx-auto mb-3 text-slate-600" />
          <p>No schedules configured.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Cron</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.map((cron) => (
                <tr key={cron.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{cron.label}</td>
                  <td className="px-4 py-3 text-slate-400">{cron.job_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{cron.cron_expression}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleCron.mutate(cron)}>
                      {cron.enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-slate-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm('Delete this schedule?')) deleteCron.mutate(cron.id); }}
                      className="p-1 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CronCreateModal jobs={jobs} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CronCreateModal({ jobs, onClose }: { jobs: Job[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [jobName, setJobName] = useState('');
  const [cron, setCron] = useState('0 2 * * *');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/cron', { label, job_name: jobName, cron_expression: cron, enabled: true });
      toast.success('Schedule created');
      queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      onClose();
    } catch {
      toast.error('Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  }

  // Common presets
  const presets = [
    { label: 'Daily 2 AM', value: '0 2 * * *' },
    { label: 'Every 6h', value: '0 */6 * * *' },
    { label: 'Weekly Sun', value: '0 3 * * 0' },
    { label: 'Monthly 1st', value: '0 4 1 * *' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">New Schedule</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Label</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Nightly backup"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Job</label>
            <select
              required
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Select a job…</option>
              {jobs.map((j) => (
                <option key={j.name} value={j.name}>{j.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cron Expression</label>
            <input
              type="text"
              required
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCron(p.value)}
                  className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
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
