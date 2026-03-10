import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Folder, FolderOpen, ChevronRight, X, Check } from 'lucide-react';

interface FsEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number | null;
}

interface BrowseResult {
  path: string;
  entries: FsEntry[];
}

interface FilePickerProps {
  value: string;
  onChange: (path: string) => void;
  serverId?: number;
  placeholder?: string;
}

export function FilePicker({ value, onChange, serverId, placeholder = '/path/to/backup' }: FilePickerProps) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('/');
  const [selectedPath, setSelectedPath] = useState('');

  function handleOpen() {
    const startPath = value || '/';
    setSelectedPath(startPath);
    setBrowsePath(startPath);
    setOpen(true);
  }

  function handleConfirm(path: string) {
    onChange(path);
    setOpen(false);
  }

  return (
    <>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-md text-sm transition-colors whitespace-nowrap"
        >
          <FolderOpen className="h-4 w-4" />
          Browse
        </button>
      </div>

      {open && (
        <FilePickerModal
          browsePath={browsePath}
          selectedPath={selectedPath}
          serverId={serverId}
          onNavigate={setBrowsePath}
          onSelect={setSelectedPath}
          onConfirm={handleConfirm}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FilePickerModal({
  browsePath,
  selectedPath,
  serverId,
  onNavigate,
  onSelect,
  onConfirm,
  onClose,
}: {
  browsePath: string;
  selectedPath: string;
  serverId?: number;
  onNavigate: (path: string) => void;
  onSelect: (path: string) => void;
  onConfirm: (path: string) => void;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<BrowseResult>({
    queryKey: ['fs-browse', browsePath, serverId],
    queryFn: () =>
      api.get(
        `/filesystem/browse?path=${encodeURIComponent(browsePath)}${serverId ? `&server_id=${serverId}` : ''}`,
      ),
  });

  /* Build breadcrumb segments from path (handles both / and \ separators) */
  const normalised = (browsePath || '/').replace(/\\/g, '/');
  const segments = normalised.split('/').filter(Boolean);

  function segmentPath(idx: number) {
    return '/' + segments.slice(0, idx + 1).join('/');
  }

  /* Current selected label shown at the bottom */
  const displaySelected = selectedPath || browsePath;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl flex flex-col"
        style={{ height: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <h3 className="font-semibold text-sm">Browse Filesystem</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 text-sm overflow-x-auto flex-shrink-0 min-w-0">
          <button
            onClick={() => onNavigate('/')}
            className="text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
          >
            /
          </button>
          {segments.map((seg, idx) => (
            <span key={idx} className="flex items-center gap-1 min-w-0">
              <ChevronRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
              <button
                onClick={() => onNavigate(segmentPath(idx))}
                className="text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-cyan-500 mr-2" />
              Loading…
            </div>
          )}
          {isError && (
            <div className="flex items-center justify-center h-24 text-red-400 text-sm">
              Permission denied or path not found.
            </div>
          )}
          {data?.entries.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
              Empty directory
            </div>
          )}
          {data?.entries.map((entry) => (
            <div
              key={entry.path}
              onClick={() => {
                if (entry.is_directory) {
                  onNavigate(entry.path);
                } else {
                  onSelect(entry.path);
                }
              }}
              onDoubleClick={() => {
                if (!entry.is_directory) {
                  onConfirm(entry.path);
                }
              }}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded cursor-pointer hover:bg-slate-800 transition-colors text-sm ${
                entry.path === selectedPath ? 'bg-slate-700/70 ring-1 ring-cyan-600/50' : ''
              }`}
            >
              <Folder
                className={`h-4 w-4 flex-shrink-0 ${
                  entry.is_directory ? 'text-amber-400' : 'text-slate-500'
                }`}
              />
              <span className={entry.is_directory ? 'text-slate-100' : 'text-slate-300 font-mono text-xs'}>
                {entry.name}
              </span>
              {!entry.is_directory && entry.size != null && (
                <span className="ml-auto text-xs text-slate-500 flex-shrink-0">
                  {formatSize(entry.size)}
                </span>
              )}
              {entry.is_directory && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-600 ml-auto flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Footer: selected path + actions */}
        <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 mb-0.5">Selected path</p>
            <p className="text-xs font-mono text-slate-200 truncate">{displaySelected || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 flex-shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(displaySelected)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm transition-colors flex-shrink-0"
          >
            <Check className="h-4 w-4" />
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
