import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Wifi, WifiOff } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [serverId, setServerId] = useState('');
  const [systemUser, setSystemUser] = useState('root');

  function connect() {
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Clean up previous terminal
    if (terminalRef.current) {
      terminalRef.current.dispose();
    }

    const term = new Terminal({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#06b6d4',
        selectionBackground: '#334155',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    if (termRef.current) {
      term.open(termRef.current);
      fitAddon.fit();
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({ system_user: systemUser });
    if (serverId) params.append('server_id', serverId);
    const cols = term.cols;
    const rows = term.rows;
    params.append('cols', String(cols));
    params.append('rows', String(rows));

    const ws = new WebSocket(`${proto}//${window.location.host}/api/v1/terminal/connect?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      term.writeln('\x1b[32mConnected.\x1b[0m');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      setConnected(false);
      term.writeln('\r\n\x1b[31mDisconnected.\x1b[0m');
    };

    ws.onerror = () => {
      setConnected(false);
      term.writeln('\r\n\x1b[31mConnection error.\x1b[0m');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
  }

  // Handle window resize
  useEffect(() => {
    function handleResize() {
      fitAddonRef.current?.fit();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      terminalRef.current?.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Terminal</h1>
        <div className="flex items-center gap-2 text-sm">
          {connected ? (
            <><Wifi className="h-4 w-4 text-green-400" /><span className="text-green-400">Connected</span></>
          ) : (
            <><WifiOff className="h-4 w-4 text-slate-500" /><span className="text-slate-500">Disconnected</span></>
          )}
        </div>
      </div>

      {/* Connection controls */}
      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Server</label>
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">Local</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">User</label>
          <input
            type="text"
            value={systemUser}
            onChange={(e) => setSystemUser(e.target.value)}
            className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={connect}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-sm font-medium transition-colors"
        >
          <TerminalIcon className="h-4 w-4" />
          {connected ? 'Reconnect' : 'Connect'}
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={termRef}
        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden min-h-[300px]"
      />
    </div>
  );
}
