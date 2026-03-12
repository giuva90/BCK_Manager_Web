import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, File, Folder, Lock, ChevronRight, Trash2, HardDrive } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

interface S3Object {
  key: string;
  size: number;
  last_modified: string;
  is_folder: boolean;
  is_encrypted: boolean;
}

interface Bucket {
  name: string;
  creation_date: string;
}

interface Endpoint {
  name: string;
  endpoint_url: string;
  region: string;
}

export function StorageExplorerPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canDownload = user?.role === 'admin' || user?.role === 'operator';
  const canDelete = user?.role === 'admin';

  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [selectedBucket, setSelectedBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: endpoints = [] } = useQuery<Endpoint[]>({
    queryKey: ['system-endpoints'],
    queryFn: () => api.get('/system/endpoints'),
  });

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<Bucket[]>({
    queryKey: ['buckets', selectedEndpoint],
    queryFn: () => api.get(`/storage/buckets?endpoint=${encodeURIComponent(selectedEndpoint)}`),
    enabled: !!selectedEndpoint,
  });

  const { data: objects = [], isLoading } = useQuery<S3Object[]>({
    queryKey: ['storage-browse', selectedEndpoint, selectedBucket, prefix],
    queryFn: () =>
      api.get(
        `/storage/browse?endpoint=${encodeURIComponent(selectedEndpoint)}&bucket=${encodeURIComponent(selectedBucket)}&prefix=${encodeURIComponent(prefix)}`,
      ),
    enabled: !!selectedEndpoint && !!selectedBucket,
  });

  const deleteObject = useMutation({
    mutationFn: (key: string) =>
      api.delete(
        `/storage/object?endpoint=${encodeURIComponent(selectedEndpoint)}&bucket=${encodeURIComponent(selectedBucket)}&key=${encodeURIComponent(key)}`,
      ),
    onSuccess: () => {
      toast.success('Object deleted');
      queryClient.invalidateQueries({ queryKey: ['storage-browse', selectedEndpoint, selectedBucket, prefix] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete object'),
  });

  const breadcrumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  function navigateFolder(key: string) {
    setPrefix(key);
  }

  function navigateBreadcrumb(index: number) {
    setPrefix(breadcrumbs.slice(0, index + 1).join('/') + '/');
  }

  async function handleDownload(key: string, isEncrypted: boolean) {
    try {
      const params = new URLSearchParams({
        endpoint: selectedEndpoint,
        bucket: selectedBucket,
        key,
      });
      if (isEncrypted) params.append('decrypt', 'true');
      const response = await fetch(`/api/v1/storage/download?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = key.split('/').pop() || 'download';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Storage Explorer</h1>

      {/* Endpoint & Bucket selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 font-medium">S3 Endpoint</label>
          <select
            value={selectedEndpoint}
            onChange={(e) => {
              setSelectedEndpoint(e.target.value);
              setSelectedBucket('');
              setPrefix('');
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[220px]"
          >
            <option value="">Select an endpoint…</option>
            {endpoints.map((ep) => (
              <option key={ep.name} value={ep.name}>
                {ep.name} — {ep.endpoint_url}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 font-medium">Bucket</label>
          <select
            value={selectedBucket}
            onChange={(e) => {
              setSelectedBucket(e.target.value);
              setPrefix('');
            }}
            disabled={!selectedEndpoint}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[220px] disabled:opacity-50"
          >
            <option value="">{bucketsLoading ? 'Loading…' : 'Select a bucket…'}</option>
            {buckets.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {!selectedEndpoint && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <HardDrive className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Select an S3 endpoint to start browsing</p>
        </div>
      )}

      {/* Breadcrumbs */}
      {selectedBucket && (
        <div className="flex items-center gap-1 text-sm text-slate-400 flex-wrap">
          <button onClick={() => setPrefix('')} className="hover:text-cyan-400 transition-colors">
            {selectedBucket}
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => navigateBreadcrumb(i)} className="hover:text-cyan-400 transition-colors">
                {crumb}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Object table */}
      {selectedBucket && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-28">Size</th>
                <th className="px-4 py-3 font-medium w-44">Modified</th>
                {(canDownload || canDelete) && (
                  <th className="px-4 py-3 font-medium w-24">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canDownload || canDelete ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : objects.length === 0 ? (
                <tr>
                  <td colSpan={canDownload || canDelete ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                    No objects found.
                  </td>
                </tr>
              ) : (
                objects.map((obj) => (
                  <tr key={obj.key} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      {obj.is_folder ? (
                        <button
                          onClick={() => navigateFolder(obj.key)}
                          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                        >
                          <Folder className="h-4 w-4" />
                          {obj.key.split('/').filter(Boolean).pop()}/
                        </button>
                      ) : (
                        <span className="flex items-center gap-2">
                          {obj.is_encrypted ? (
                            <Lock className="h-4 w-4 text-amber-400" />
                          ) : (
                            <File className="h-4 w-4 text-slate-400" />
                          )}
                          {obj.key.split('/').pop()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{obj.is_folder ? '—' : formatSize(obj.size)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {obj.last_modified ? new Date(obj.last_modified).toLocaleString() : '—'}
                    </td>
                    {(canDownload || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!obj.is_folder && canDownload && (
                            <button
                              onClick={() => handleDownload(obj.key, obj.is_encrypted)}
                              className="p-1 rounded hover:bg-slate-700 transition-colors"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          {!obj.is_folder && canDelete && (
                            <button
                              onClick={() => setDeleteTarget(obj.key)}
                              className="p-1 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-red-400">Delete Object</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to permanently delete{' '}
              <span className="font-mono text-white break-all">{deleteTarget.split('/').pop()}</span>?
            </p>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteObject.mutate(deleteTarget)}
                disabled={deleteObject.isPending}
                className="px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50"
              >
                {deleteObject.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
