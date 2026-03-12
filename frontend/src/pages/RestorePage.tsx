import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

interface Job {
  name: string;
  mode: string;
  enabled: boolean;
}

interface BackupEntry {
  key: string;
  size: number;
  last_modified: string;
}

export function RestorePage() {
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedBackup, setSelectedBackup] = useState('');
  const [restoreMode, setRestoreMode] = useState<'new' | 'replace'>('new');
  const [targetVolume, setTargetVolume] = useState('');

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs'),
  });

  const { data: backups = [], isLoading: backupsLoading } = useQuery<BackupEntry[]>({
    queryKey: ['restore-list', selectedJob],
    queryFn: () => api.get(`/restore/${encodeURIComponent(selectedJob)}/list`),
    enabled: !!selectedJob,
  });

  const restoreFile = useMutation({
    mutationFn: () =>
      api.post(`/restore/${encodeURIComponent(selectedJob)}/file`, {
        s3_key: selectedBackup,
      }),
    onSuccess: () => toast.success('Restore completed'),
    onError: (err: unknown) => {
      const msg = (err as { detail?: string })?.detail;
      toast.error(msg ? `Restore failed: ${msg}` : 'Restore failed');
    },
  });

  const restoreVolume = useMutation({
    mutationFn: () =>
      api.post(`/restore/${encodeURIComponent(selectedJob)}/volume`, {
        s3_key: selectedBackup,
        mode: restoreMode,
        ...(restoreMode === 'new' && targetVolume ? { target_volume: targetVolume } : {}),
      }),
    onSuccess: () => toast.success('Volume restore completed'),
    onError: (err: unknown) => {
      const msg = (err as { detail?: string })?.detail;
      toast.error(msg ? `Volume restore failed: ${msg}` : 'Volume restore failed');
    },
  });

  const selectedJobData = jobs.find((j) => j.name === selectedJob);
  const isVolume = selectedJobData?.mode === 'volume';

  function handleRestore() {
    if (!selectedBackup) {
      toast.error('Select a backup first');
      return;
    }
    if (isVolume) {
      restoreVolume.mutate();
    } else {
      restoreFile.mutate();
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Restore</h1>

      {/* Job selector */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Select Job</label>
        <select
          value={selectedJob}
          onChange={(e) => { setSelectedJob(e.target.value); setSelectedBackup(''); }}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Choose a job…</option>
          {jobs.map((j) => (
            <option key={j.name} value={j.name}>
              {j.name} ({j.mode})
            </option>
          ))}
        </select>
      </div>

      {/* Backup list */}
      {selectedJob && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Available Backups</label>
          {backupsLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="text-sm text-slate-400">No backups found for this job.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {backups.map((b) => (
                <label
                  key={b.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedBackup === b.key
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="backup"
                    value={b.key}
                    checked={selectedBackup === b.key}
                    onChange={() => setSelectedBackup(b.key)}
                    className="text-cyan-500 focus:ring-cyan-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono truncate">{b.key.split('/').pop()}</p>
                    <p className="text-xs text-slate-400">
                      {formatSize(b.size)} · {new Date(b.last_modified).toLocaleString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Volume mode selector */}
      {isVolume && selectedBackup && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Restore Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="new"
                checked={restoreMode === 'new'}
                onChange={() => setRestoreMode('new')}
                className="text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm">New volume</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-sm">Replace existing</span>
            </label>
          </div>
          {restoreMode === 'new' && (
            <div className="mt-3">
              <label className="block text-xs text-slate-400 mb-1">
                Target volume name <span className="text-slate-500">(leave blank to use <code className="font-mono">&lt;job_volume&gt;_restored</code>)</span>
              </label>
              <input
                type="text"
                value={targetVolume}
                onChange={(e) => setTargetVolume(e.target.value)}
                placeholder="my_volume_restored"
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}
          {restoreMode === 'replace' && (
            <div className="flex items-center gap-2 mt-2 text-amber-400 text-xs">
              <AlertTriangle className="h-4 w-4" />
              This will overwrite the existing volume data.
            </div>
          )}
        </div>
      )}

      {/* Restore button */}
      {selectedBackup && (
        <button
          onClick={handleRestore}
          disabled={restoreFile.isPending || restoreVolume.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          {restoreFile.isPending || restoreVolume.isPending ? 'Restoring…' : 'Restore'}
        </button>
      )}
    </div>
  );
}
