import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, FolderArchive, Clock, HardDrive, AlertCircle, CheckCircle2, XCircle, Activity } from 'lucide-react';
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
  mode: string;
  uptime_seconds: number;
  hostname: string;
  python_version: string;
  bck_manager_path: string;
}

interface RecentExecution {
  id: number;
  job_name: string;
  server_id: number;
  status: string;
  started_at: string;
  duration_seconds: number | null;
  error: string | null;
}

interface HistoryStats {
  total_24h: number;
  success_24h: number;
  failed_24h: number;
  total_7d: number;
  success_7d: number;
  failed_7d: number;
  recent: RecentExecution[];
}

export function DashboardPage() {
  const navigate = useNavigate();

  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['system-status'],
    queryFn: () => api.get('/system/status'),
  });

  const { data: jobs = [] } = useQuery<JobStatus[]>({
    queryKey: ['run-status'],
    queryFn: () => api.get('/run/status'),
    refetchInterval: 5000,
  });

  const { data: logs } = useQuery<{ lines: string[]; count: number }>({
    queryKey: ['logs-tail'],
    queryFn: () => api.get('/logs/tail?lines=15&source=web'),
    refetchInterval: 10000,
  });

  const { data: historyStats } = useQuery<HistoryStats>({
    queryKey: ['history-stats'],
    queryFn: () => api.get('/history/stats'),
    refetchInterval: 15000,
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
  const totalJobs = jobs.length;
  const enabledJobs = jobs.filter((j) => j.enabled).length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FolderArchive} label="Total Jobs" value={totalJobs} />
        <StatCard icon={CheckCircle2} label="Enabled" value={enabledJobs} color="text-green-400" />
        <StatCard icon={Clock} label="Running" value={runningJobs.length} color="text-blue-400" />
        <StatCard
          icon={Activity}
          label="Last 24h"
          value={historyStats ? `${historyStats.success_24h} ✓ / ${historyStats.failed_24h} ✗` : '—'}
          color={historyStats && historyStats.failed_24h > 0 ? 'text-red-400' : 'text-green-400'}
        />
        <StatCard icon={HardDrive} label="Version" value={status?.version ?? '—'} />
      </div>

      {/* Recent Executions */}
      {historyStats && historyStats.recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Executions</h2>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-4 py-2 font-medium w-8"></th>
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium w-20">Duration</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {historyStats.recent.map((exec) => (
                  <tr
                    key={exec.id}
                    onClick={() => navigate(`/history?job_name=${encodeURIComponent(exec.job_name)}`)}
                    className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                      exec.status === 'failed' ? 'bg-red-900/5 hover:bg-red-900/10' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-2">
                      {exec.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">{exec.job_name}</td>
                    <td className="px-4 py-2 text-slate-400">{new Date(exec.started_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {exec.duration_seconds != null
                        ? exec.duration_seconds < 60
                          ? `${exec.duration_seconds.toFixed(1)}s`
                          : `${Math.floor(exec.duration_seconds / 60)}m ${Math.round(exec.duration_seconds % 60)}s`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-red-400 truncate max-w-xs">{exec.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Logs</h2>
        <pre className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto max-h-64 whitespace-pre-wrap">
          {logs?.lines.join('\n') || 'No log data available.'}
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
