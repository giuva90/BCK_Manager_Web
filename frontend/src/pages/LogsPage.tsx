import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Wifi, WifiOff, ArrowDown } from 'lucide-react';
import { api } from '../api/client';

type LogSource = 'web' | 'bck';

export function LogsPage() {
  const containerRef = useRef<HTMLPreElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [source, setSource] = useState<LogSource>('web');

  // Initial tail — refetch when source changes
  const { data: initialLogs } = useQuery<{ lines: string[]; count: number }>({
    queryKey: ['logs-tail-full', source],
    queryFn: () => api.get(`/logs/tail?lines=200&source=${source}`),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (initialLogs) {
      setLines(initialLogs.lines);
    }
  }, [initialLogs]);

  // Clear lines when switching source
  useEffect(() => {
    setLines([]);
  }, [source]);

  // WebSocket live stream — reconnect when source changes
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/api/v1/logs/stream?source=${source}`);

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log_line') {
          setLines((prev) => {
            const next = [...prev, msg.data];
            return next.length > 5000 ? next.slice(-5000) : next;
          });
        }
      } catch {
        setLines((prev) => {
          const next = [...prev, event.data];
          return next.length > 5000 ? next.slice(-5000) : next;
        });
      }
    };

    return () => ws.close();
  }, [source]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Logs</h1>
          <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
            <button
              onClick={() => setSource('web')}
              className={`px-3 py-1 transition-colors ${
                source === 'web' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Web App
            </button>
            <button
              onClick={() => setSource('bck')}
              className={`px-3 py-1 transition-colors ${
                source === 'bck' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              BCK Manager
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {wsConnected ? (
              <><Wifi className="h-4 w-4 text-green-400" /><span className="text-green-400">Live</span></>
            ) : (
              <><WifiOff className="h-4 w-4 text-slate-500" /><span className="text-slate-500">Disconnected</span></>
            )}
          </div>
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (containerRef.current) {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              <ArrowDown className="h-3 w-3" /> Scroll to bottom
            </button>
          )}
        </div>
      </div>

      <pre
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto whitespace-pre-wrap"
      >
        {lines.length === 0
          ? wsConnected
            ? 'Connected — waiting for new log lines…'
            : 'Log stream disconnected. Waiting to reconnect…'
          : lines.join('\n')}
      </pre>
    </div>
  );
}
