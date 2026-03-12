import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Filter, ChevronLeft, ChevronRight, X, Server } from 'lucide-react';
import { api } from '../api/client';

interface JobExecution {
  id: number;
  job_name: string;
  server_id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  triggered_by: string;
  error: string | null;
  uploaded_files: number;
  uploaded_size: number;
  bucket: string;
  prefix: string;
  encrypted: boolean;
  result_json: string | null;
}

interface ExecutionList {
  items: JobExecution[];
  total: number;
  page: number;
  page_size: number;
}

interface Job {
  name: string;
}

interface FleetServer {
  id: number;
  name: string;
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobFilter, setJobFilter] = useState(searchParams.get('job_name') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [serverFilter, setServerFilter] = useState(searchParams.get('server_id') || '');
  const [triggeredByFilter, setTriggeredByFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selectedExecution, setSelectedExecution] = useState<JobExecution | null>(null);

  // Load job names for filter dropdown
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs'),
  });

  // Load fleet servers for filter dropdown
  const { data: servers = [] } = useQuery<FleetServer[]>({
    queryKey: ['servers'],
    queryFn: () => api.get('/fleet/servers'),
  });

  // Build query string
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  if (jobFilter) params.set('job_name', jobFilter);
  if (statusFilter) params.set('status', statusFilter);
  if (serverFilter) params.set('server_id', serverFilter);
  if (triggeredByFilter) params.set('triggered_by', triggeredByFilter);
  if (fromDate) params.set('from_date', new Date(fromDate).toISOString());
  if (toDate) params.set('to_date', new Date(toDate).toISOString());

  const { data, isLoading } = useQuery<ExecutionList>({
    queryKey: ['history', jobFilter, statusFilter, serverFilter, triggeredByFilter, fromDate, toDate, page],
    queryFn: () => api.get(`/history?${params.toString()}`),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  function clearFilters() {
    setJobFilter('');
    setStatusFilter('');
    setServerFilter('');
    setTriggeredByFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
    setSearchParams({});
  }

  const hasFilters = jobFilter || statusFilter || serverFilter || triggeredByFilter || fromDate || toDate;

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function serverName(sid: number): string {
    if (sid === 0) return 'Local';
    const s = servers.find((sv) => sv.id === sid);
    return s?.name ?? `Server #${sid}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Execution History</h1>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filters</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <select
            value={jobFilter}
            onChange={(e) => { setJobFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.name} value={j.name}>{j.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={serverFilter}
            onChange={(e) => { setServerFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All servers</option>
            <option value="0">Local</option>
            {servers.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Triggered by…"
            value={triggeredByFilter}
            onChange={(e) => { setTriggeredByFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            title="From date"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            title="To date"
          />
        </div>
      </div>

      {/* Results table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-400">
              <th className="px-4 py-3 font-medium w-10"></th>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Server</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium w-24">Duration</th>
              <th className="px-4 py-3 font-medium">Triggered by</th>
              <th className="px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {hasFilters ? 'No executions match the current filters.' : 'No executions recorded yet.'}
                </td>
              </tr>
            ) : (
              items.map((exec) => (
                <tr
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                    exec.status === 'failed'
                      ? 'hover:bg-red-900/10 bg-red-900/5'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="px-4 py-3">
                    {exec.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{exec.job_name}</td>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {serverName(exec.server_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(exec.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(exec.duration_seconds)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{exec.triggered_by}</td>
                  <td className="px-4 py-3 text-red-400 truncate max-w-xs">{exec.error || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedExecution && (
        <ExecutionDetail execution={selectedExecution} serverName={serverName} formatSize={formatSize} formatDuration={formatDuration} onClose={() => setSelectedExecution(null)} />
      )}
    </div>
  );
}


function ExecutionDetail({
  execution,
  serverName,
  formatSize,
  formatDuration,
  onClose,
}: {
  execution: JobExecution;
  serverName: (sid: number) => string;
  formatSize: (bytes: number) => string;
  formatDuration: (s: number | null) => string;
  onClose: () => void;
}) {
  let parsedResult: Record<string, unknown> | null = null;
  if (execution.result_json) {
    try { parsedResult = JSON.parse(execution.result_json); } catch { /* ignore */ }
  }

  const uploadedFiles = parsedResult?.uploaded_files;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {execution.status === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            {execution.job_name}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <span className="text-slate-400">Status</span>
            <p className={execution.status === 'success' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
              {execution.status}
            </p>
          </div>
          <div>
            <span className="text-slate-400">Server</span>
            <p>{serverName(execution.server_id)}</p>
          </div>
          <div>
            <span className="text-slate-400">Started</span>
            <p>{new Date(execution.started_at).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-400">Finished</span>
            <p>{execution.finished_at ? new Date(execution.finished_at).toLocaleString() : '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Duration</span>
            <p>{formatDuration(execution.duration_seconds)}</p>
          </div>
          <div>
            <span className="text-slate-400">Triggered by</span>
            <p>{execution.triggered_by}</p>
          </div>
          <div>
            <span className="text-slate-400">Bucket</span>
            <p className="font-mono text-xs">{execution.bucket || '—'}{execution.prefix ? `/${execution.prefix}` : ''}</p>
          </div>
          <div>
            <span className="text-slate-400">Encrypted</span>
            <p>{execution.encrypted ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <span className="text-slate-400">Files uploaded</span>
            <p>{execution.uploaded_files}</p>
          </div>
          <div>
            <span className="text-slate-400">Total size</span>
            <p>{formatSize(execution.uploaded_size)}</p>
          </div>
        </div>

        {execution.error && (
          <div className="bg-red-900/20 border border-red-800 rounded-md p-3">
            <p className="text-sm font-medium text-red-400 mb-1">Error</p>
            <p className="text-sm text-red-300 whitespace-pre-wrap">{execution.error}</p>
          </div>
        )}

        {Array.isArray(uploadedFiles) && uploadedFiles.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">Uploaded Files</p>
            <div className="bg-slate-800 rounded-md divide-y divide-slate-700">
              {(uploadedFiles as Array<{ s3_key?: string; size?: number; encrypted?: boolean }>).map((f, i) => (
                <div key={i} className="px-3 py-2 text-xs flex items-center justify-between">
                  <span className="font-mono truncate">{f.s3_key ?? '—'}</span>
                  <span className="text-slate-400 ml-2 whitespace-nowrap">{formatSize(f.size ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
