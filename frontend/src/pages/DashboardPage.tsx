import { useQuery, useMutation } from '@tanstack/react-query';
import { Play, FolderArchive, Clock, HardDrive, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface JobStatus {
  name: string;
  enabled: boolean;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

interface SystemStatus {
  version: string;
  uptime_seconds: number;
  total_jobs: number;
  enabled_jobs: number;
}

export function DashboardPage() {
  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: () => api.get('/system/status'),
  });

  const { data: jobs = [] } = useQuery<JobStatus[]>({
    queryKey: ['run-status'],
    queryFn: () => api.get('/run/status'),
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery<string>({
    queryKey: ['logs-tail'],
    queryFn: () => api.get('/logs/tail?lines=15'),
    refetchInterval: 10000,
  });

  const runAll = useMutation({
    mutationFn: () => api.post('/run/all'),
    onSuccess: () => toast.success('All jobs started'),
    onError: () => toast.error('Failed to start jobs'),
  });

  const runJob = useMutation({
    mutationFn: (name: string) => api.post(`/run/job/${encodeURIComponent(name)}`),
    onSuccess: (_, name) => toast.success(`Job "${name}" started`),
    onError: (_, name) => toast.error(`Failed to start "${name}"`),
  });

  const runningJobs = jobs.filter((j) => j.status === 'running');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => runAll.mutate()}
          disabled={runAll.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
        >
          <Play className="h-4 w-4" />
          Run all jobs
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderArchive} label="Total Jobs" value={status?.total_jobs ?? '—'} />
        <StatCard icon={CheckCircle2} label="Enabled" value={status?.enabled_jobs ?? '—'} color="text-green-400" />
        <StatCard icon={Clock} label="Running" value={runningJobs.length} color="text-blue-400" />
        <StatCard icon={HardDrive} label="Version" value={status?.version ?? '—'} />
      </div>

      {/* Job Status Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Job Status</h2>
        {jobs.length === 0 ? (
          <p className="text-slate-400 text-sm">No jobs configured.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {jobs.map((job) => (
              <div
                key={job.name}
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{job.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={job.status} />
                    {!job.enabled && (
                      <span className="text-xs text-slate-500">disabled</span>
                    )}
                  </div>
                  {job.error && (
                    <p className="text-xs text-red-400 mt-1 truncate">{job.error}</p>
                  )}
                </div>
                <button
                  onClick={() => runJob.mutate(job.name)}
                  disabled={job.status === 'running' || !job.enabled}
                  className="ml-3 p-2 rounded-md hover:bg-slate-800 disabled:opacity-30 transition-colors"
                  title="Run job"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Logs</h2>
        <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto max-h-64 whitespace-pre-wrap">
          {logs || 'No log data available.'}
        </pre>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-cyan-400',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: 'bg-slate-700 text-slate-300',
    running: 'bg-blue-500/20 text-blue-400',
    success: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${styles[status] || styles.idle}`}>
      {status === 'error' && <AlertCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}
