import React, { useState, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { fetchLogs } from '../api';
import { Link } from 'react-router';

export default function AccessLogsList() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await fetchLogs();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch logs", error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();

    const evtSource = new EventSource('/api/logs/stream');
    evtSource.onmessage = (event) => {
      const parsedData = JSON.parse(event.data);
      if (parsedData.type === 'new_log') {
        setLogs((prevLogs) => [parsedData.data, ...prevLogs].slice(0, 1000));
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds()}`;
  };

  return (
    <div className="w-full h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-slate-900 rounded-lg shadow-sm border border-slate-800 overflow-hidden">
      <div className="flex items-center gap-4 p-4 border-b border-slate-800 shrink-0">
        <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-100">
          <Shield className="w-5 h-5 text-blue-500" />
          Access Detailed Logs
        </h1>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-auto w-full">
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap text-slate-300">
          <thead className="text-xs text-slate-400 bg-slate-800/50 sticky top-0 z-10 shadow-[0_1px_0_0_#1e293b]">
            <tr>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">target</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">source_ip</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">timestamp</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">method</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">path</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">country</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-r border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">lat</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
              <th scope="col" className="px-4 py-2 font-mono font-medium border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">lng</span>
                  <span className="ml-auto text-[10px] cursor-pointer">↕</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500">Loading logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500">No logs found</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/50 text-[13px] text-slate-300 font-mono transition-colors">
                  <td className="px-4 py-2 border-r border-slate-800/50">{log.target || 'Unknown'}</td>
                  <td className="px-4 py-2 border-r border-slate-800/50 text-blue-400">{log.sourceIp}</td>
                  <td className="px-4 py-2 border-r border-slate-800/50 text-slate-400">{formatDate(log.timestamp)}</td>
                  <td className="px-4 py-2 border-r border-slate-800/50">
                     <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-sans ${
                        log.method === 'GET' ? 'bg-blue-500/10 text-blue-400' :
                        log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400' :
                        log.method === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                     }`}>
                       {log.method}
                     </span>
                  </td>
                  <td className="px-4 py-2 border-r border-slate-800/50 truncate max-w-[200px]" title={log.path}>{log.path}</td>
                  <td className="px-4 py-2 border-r border-slate-800/50 font-sans">{log.country}</td>
                  <td className="px-4 py-2 border-r border-slate-800/50 text-slate-400">{log.lat}</td>
                  <td className="px-4 py-2 text-slate-400">{log.lng}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
