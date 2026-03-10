import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Small secondary line shown below the label */
  sublabel?: string;
  /** Coloured badge (e.g. container state) */
  badge?: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  /** When true the input is shown even when the option list is empty */
  allowManual?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  loading = false,
  disabled = false,
  emptyMessage = 'No options found',
  allowManual = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) =>
        (o.label + ' ' + (o.sublabel ?? '') + ' ' + (o.badge ?? ''))
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : options;

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  /* Manual text input fallback when allowManual=true and list is empty */
  if (allowManual && options.length === 0 && !loading) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
      />
    );
  }

  function badgeClass(badge: string) {
    if (badge === 'running') return 'bg-green-900/60 text-green-400';
    if (badge === 'exited') return 'bg-slate-700 text-slate-400';
    return 'bg-slate-700 text-slate-400';
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
        }}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 text-left gap-2"
      >
        <span className={`truncate ${selected ? 'text-slate-100' : 'text-slate-400'}`}>
          {loading ? 'Loading…' : selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-slate-700 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Option list */}
          <ul className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors ${opt.value === value ? 'bg-slate-700/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm text-slate-100">{opt.label}</span>
                      {opt.sublabel && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{opt.sublabel}</p>
                      )}
                    </div>
                    {opt.badge && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${badgeClass(opt.badge)}`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
