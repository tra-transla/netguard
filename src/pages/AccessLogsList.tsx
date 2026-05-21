import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ArrowLeft, RefreshCw, Wifi } from 'lucide-react';
import { fetchLogs } from '../api';
import { Link } from 'react-router';

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-500/10 text-blue-400',
  POST:   'bg-emerald-500/10 text-emerald-400',
  DELETE: 'bg-red-500/10 text-red-400',
  PUT:    'bg-amber-500/10 text-amber-400',
  PATCH:  'bg-purple-500/10 text-purple-400',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AccessLogsList() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive]       = useState(true);
  const [filter, setFilter]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // SSE — real-time new hits
  useEffect(() => {
    if (!live) return;
    const es = new EventSource('/api/logs/stream');
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'new_log') {
        setLogs((prev) => [parsed.data, ...prev].slice(0, 2000));
      }
    };
    return () => es.close();
  }, [live]);

  const filtered = filter.trim()
    ? logs.filter(l =>
        (l.sourceIp || '').includes(filter) ||
        (l.target   || '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.country  || '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.city     || '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.referer  || '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.userAgent|| '').toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <div className="w-full h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-slate-900 rounded-lg shadow-sm border border-slate-800 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800 shrink-0 flex-wrap gap-y-2">
        <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-100">
          <Shield className="w-5 h-5 text-blue-500" />
          Real Access Logs
        </h1>

        {/* Live indicator */}
        <button
          onClick={() => setLive(v => !v)}
          className={`ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'
          }`}
        >
          <Wifi className="w-3 h-3" />
          {live ? 'Live' : 'Paused'}
        </button>

        {/* Filter */}
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by IP, target, country, referer…"
          className="ml-auto px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
        />

        {/* Refresh */}
        <button
          onClick={load}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-200"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <span className="text-slate-500 text-xs ml-1">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap text-slate-300">
          <thead className="text-xs text-slate-400 bg-slate-800/60 sticky top-0 z-10 shadow-[0_1px_0_0_#1e293b]">
            <tr>
              {['Timestamp','Target','Source IP','Country / City','Method','Path','Referer','User Agent'].map((col) => (
                <th key={col} className="px-4 py-2 font-medium border-r border-b border-slate-700/50 last:border-r-0">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                    Loading…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500">
                  {logs.length === 0
                    ? 'No logs yet. Embed a tracking snippet from Admin Settings to start capturing real traffic.'
                    : 'No results match your filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/50 text-[12px] text-slate-300 font-mono transition-colors">
                  <td className="px-4 py-2 border-r border-slate-800/50 text-slate-400">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 max-w-[130px] truncate" title={log.target}>
                    {log.target || '–'}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 text-blue-400">
                    {log.sourceIp}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 font-sans">
                    <span className="text-slate-300">{log.country || '–'}</span>
                    {log.city && log.city !== 'Unknown' && (
                      <span className="text-slate-500 ml-1">/ {log.city}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-sans ${
                      METHOD_COLORS[log.method] || 'bg-slate-700 text-slate-300'
                    }`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 max-w-[200px] truncate" title={log.path}>
                    {log.path}
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 max-w-[200px] truncate font-sans text-slate-400" title={log.referer || ''}>
                    {log.referer || '–'}
                  </td>
                  <td className="px-4 py-2 max-w-[250px] truncate font-sans text-slate-500" title={log.userAgent || ''}>
                    {log.userAgent || '–'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
