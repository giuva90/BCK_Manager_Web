import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Download, File, Folder, Lock, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

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

export function StorageExplorerPage() {
  const [prefix, setPrefix] = useState('');

  const { data: buckets = [] } = useQuery<Bucket[]>({
    queryKey: ['buckets'],
    queryFn: () => api.get('/storage/buckets'),
  });

  const [selectedBucket, setSelectedBucket] = useState('');

  const { data: objects = [], isLoading } = useQuery<S3Object[]>({
    queryKey: ['storage-browse', selectedBucket, prefix],
    queryFn: () =>
      api.get(`/storage/browse?bucket=${encodeURIComponent(selectedBucket)}&prefix=${encodeURIComponent(prefix)}`),
    enabled: !!selectedBucket,
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
      const params = new URLSearchParams({ bucket: selectedBucket, key });
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

      {/* Bucket selector */}
      <div className="flex items-center gap-4">
        <select
          value={selectedBucket}
          onChange={(e) => { setSelectedBucket(e.target.value); setPrefix(''); }}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Select a bucket…</option>
          {buckets.map((b) => (
            <option key={b.name} value={b.name}>{b.name}</option>
          ))}
        </select>
      </div>

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
                <th className="px-4 py-3 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
              ) : objects.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No objects found.</td></tr>
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
                          {obj.is_encrypted ? <Lock className="h-4 w-4 text-amber-400" /> : <File className="h-4 w-4 text-slate-400" />}
                          {obj.key.split('/').pop()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{obj.is_folder ? '—' : formatSize(obj.size)}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {obj.last_modified ? new Date(obj.last_modified).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!obj.is_folder && (
                        <button
                          onClick={() => handleDownload(obj.key, obj.is_encrypted)}
                          className="p-1 rounded hover:bg-slate-700 transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
