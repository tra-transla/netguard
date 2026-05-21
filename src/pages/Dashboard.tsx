import { useState, useEffect, useMemo } from "react";
import { fetchTargets, fetchLogs } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { Share2, HelpCircle, Wifi } from "lucide-react";
import { Link } from "react-router";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COLORS = ["#F97316","#3B82F6","#22C55E","#EAB308","#06B6D4","#EF4444","#8B5CF6","#F43F5E"];

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-500/10 text-blue-400",
  POST:   "bg-emerald-500/10 text-emerald-400",
  DELETE: "bg-red-500/10 text-red-400",
  PUT:    "bg-amber-500/10 text-amber-400",
  PATCH:  "bg-purple-500/10 text-purple-400",
};

export default function Dashboard() {
  const [targets, setTargets] = useState<any[]>([]);
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [live,    setLive]    = useState(true);

  // initial load
  useEffect(() => {
    Promise.all([fetchTargets(), fetchLogs()])
      .then(([t, l]) => { setTargets(t); setLogs(l); setLoading(false); })
      .catch((err) => {
        console.error(err);
        setError("Failed to connect to backend API.");
        setLoading(false);
      });
  }, []);

  // SSE live updates
  useEffect(() => {
    if (!live) return;
    const es = new EventSource("/api/logs/stream");
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "new_log") {
        setLogs((prev) => [parsed.data, ...prev]);
      }
    };
    return () => es.close();
  }, [live]);

  const stats = useMemo(() => {
    const targetCounts:  Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const pathCounts:    Record<string, number> = {};
    const timeCounts:    Record<string, number> = {};
    const ips = new Set<string>();

    logs.forEach((log) => {
      targetCounts[log.targetId] = (targetCounts[log.targetId] || 0) + 1;
      countryCounts[log.country || "Unknown"] = (countryCounts[log.country || "Unknown"] || 0) + 1;
      pathCounts[log.path] = (pathCounts[log.path] || 0) + 1;
      ips.add(log.sourceIp);

      const key = new Date(log.timestamp).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
      });
      timeCounts[key] = (timeCounts[key] || 0) + 1;
    });

    const accessesByTarget = targets
      .map((t) => ({ name: t.target, accesses: targetCounts[t.id] || 0 }))
      .sort((a, b) => b.accesses - a.accesses);

    const accessesByCountry = Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const viewsByPath = Object.entries(pathCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Build daily activity: last 30 days
    const activityOverTime: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      activityOverTime.push({ date: k, count: timeCounts[k] || 0 });
    }

    return { accessesByTarget, accessesByCountry, viewsByPath, activityOverTime, uniqueIPs: ips.size };
  }, [targets, logs]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="text-red-400 mb-4 bg-red-500/10 p-4 rounded-full">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Backend API Error</h2>
        <p className="text-slate-400 max-w-md">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium">
          Try Again
        </button>
      </div>
    );
  }

  const { accessesByTarget, accessesByCountry, viewsByPath, activityOverTime, uniqueIPs } = stats;

  return (
    <div className="space-y-6 w-full mx-auto text-sm text-slate-300 pb-10">

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mt-2 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px]">
            ALL
          </div>
          <span className="font-semibold text-lg text-slate-100">Real Traffic Reports</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <Link to="/map"   className="text-xs font-medium hover:text-blue-400 transition-colors">Access Map</Link>
          <Link to="/admin" className="text-xs font-medium hover:text-blue-400 transition-colors">Admin Panel</Link>
          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Live toggle */}
          <button
            onClick={() => setLive(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              live ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"
            }`}
          >
            <Wifi className="w-3 h-3" />
            {live ? "Live" : "Paused"}
          </button>

          <Share2   className="w-4 h-4 cursor-pointer" />
          <HelpCircle className="w-4 h-4 cursor-pointer" />
        </div>
      </div>

      {/* No data hint */}
      {logs.length === 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-sm text-slate-400">
          <strong className="text-slate-200">No tracking data yet.</strong>{" "}
          Go to{" "}
          <Link to="/admin" className="text-blue-400 hover:underline">Admin Settings</Link>{" "}
          → click a target → copy the embed snippet → paste it into your website or email.
          Real hits will appear here automatically.
        </div>
      )}

      {/* ── Row 1 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">

        {/* Accesses by Target */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Accesses by Target</h3>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-2 border-b border-slate-800 pb-2 uppercase">
            <span className="w-[40%]">Target</span>
            <span>Accesses</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {accessesByTarget.length === 0 ? (
              <p className="text-slate-600 text-xs pt-4">No data yet.</p>
            ) : accessesByTarget.slice(0, 8).map((item, idx) => {
              const maxA = accessesByTarget[0]?.accesses || 1;
              const w = Math.max((item.accesses / maxA) * 100, 5);
              return (
                <div key={idx} className="flex items-center gap-3 text-xs w-full">
                  <span className="truncate w-[40%] text-slate-300" title={item.name}>{item.name}</span>
                  <div className="flex-1 h-6 relative bg-slate-800/30 rounded">
                    <div
                      className="absolute top-0 left-0 h-full rounded flex items-center px-2 text-white font-medium text-[11px] overflow-hidden whitespace-nowrap"
                      style={{ width: `${Math.max(w, 14)}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                    >
                      {item.accesses}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-blue-400 font-medium text-xs text-right">
            <Link to="/logs">View logs →</Link>
          </div>
        </div>

        {/* Accesses by Country */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Accesses by Country</h3>
          </div>
          <div className="flex flex-col h-full relative">
            <div className="flex flex-1 mt-1">
              <div className="w-1/2 relative flex items-center justify-center overflow-hidden">
                <ComposableMap
                  projectionConfig={{ scale: 140, center: [0, 20] }}
                  width={400} height={400}
                  style={{ width: "100%", height: "auto" }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const isHighlighted = accessesByCountry.some(c => c.name === geo.properties.name);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isHighlighted ? "#3B82F6" : "#334155"}
                            stroke="#0F172A" strokeWidth={0.5}
                            style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#60A5FA" }, pressed: { outline: "none" } }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              </div>
              <div className="w-1/2 flex flex-col gap-3 pl-3 pt-2 overflow-y-auto">
                {accessesByCountry.length === 0 ? (
                  <p className="text-slate-600 text-xs">No data yet.</p>
                ) : accessesByCountry.slice(0, 7).map((c, idx) => (
                  <div key={idx} className="flex justify-between text-xs border-b border-slate-800 pb-1">
                    <span className="truncate pr-2">{c.name}</span>
                    <span className="font-medium text-slate-400">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 text-blue-400 font-medium text-xs text-right">
            <Link to="/map">View map →</Link>
          </div>
        </div>

        {/* Activity over time */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Activity (last 30 days)</h3>
          </div>
          <div className="flex-1 w-full min-h-0 pl-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityOverTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#64748B" }} dy={8}
                  interval={Math.floor(activityOverTime.length / 5)} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748B" }} dx={-8} />
                <Tooltip
                  contentStyle={{ fontSize: "12px", borderRadius: "8px", backgroundColor: "#1E293B", border: "1px solid #334155", color: "#F8FAFC" }}
                  itemStyle={{ color: "#E2E8F0" }}
                  cursor={{ fill: "#334155", opacity: 0.4 }}
                />
                <Bar dataKey="count" name="Hits" fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col">
          <h3 className="font-medium text-slate-100 mb-4">Key Metrics</h3>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-3 border-b border-slate-800 pb-2 uppercase">
            <span>Metric</span><span>Value</span>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { label: "Total Hits",       value: logs.length },
              { label: "Unique IPs",       value: uniqueIPs },
              { label: "Tracked Targets",  value: targets.length },
              { label: "Countries",        value: accessesByCountry.length },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span>{label}</span>
                <span className="font-semibold text-slate-200">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 text-blue-400 font-medium text-xs text-right">
            <Link to="/logs" className="hover:underline">View logs →</Link>
          </div>
        </div>
      </div>

      {/* ── Row 2 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">

        {/* Recent Logs */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm flex flex-col h-[350px] lg:col-span-2 overflow-hidden">
          <div className="p-5 border-b border-slate-800 shrink-0 flex justify-between items-center">
            <h3 className="font-medium text-slate-100">Recent Real Hits</h3>
            {live && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs whitespace-nowrap text-slate-300">
              <thead className="bg-slate-800/90 text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Timestamp</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Country</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-sans">No hits recorded yet.</td></tr>
                ) : logs.slice(0, 8).map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2 truncate max-w-[120px]" title={log.target}>{log.target || '–'}</td>
                    <td className="px-4 py-2 text-blue-400">{log.sourceIp}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-sans ${METHOD_COLORS[log.method] || "bg-slate-700 text-slate-300"}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-2">{log.country || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-800 text-blue-400 font-medium text-xs text-right shrink-0">
            <Link to="/logs" className="hover:underline">View all logs →</Link>
          </div>
        </div>

        {/* Views by Path */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 h-[350px] flex flex-col">
          <h3 className="font-medium text-slate-100 mb-4">Hits by Path</h3>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-2 border-b border-slate-800 pb-2 uppercase">
            <span>Path</span><span>Hits</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {viewsByPath.length === 0 ? (
              <p className="text-slate-600 text-xs pt-2">No data yet.</p>
            ) : viewsByPath.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-xs w-full">
                <span className="truncate w-[60%] text-slate-300" title={item.name}>{item.name}</span>
                <span className="flex-1 text-right font-medium text-slate-400">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Target Distribution */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <h3 className="font-medium text-slate-100 mb-4">Target Distribution</h3>
          <div className="flex-1 w-full min-h-[200px]">
            {accessesByTarget.filter(t => t.accesses > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accessesByTarget.filter(t => t.accesses > 0)}
                    cx="50%" cy="50%"
                    innerRadius={0} outerRadius={70}
                    paddingAngle={1} dataKey="accesses"
                    labelLine={{ stroke: "#475569", strokeWidth: 1 }}
                    label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 1.35;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return percent > 0.04 ? (
                        <text x={x} y={y} fill="#cbd5e1" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize="10px" fontWeight={500}>
                          <tspan x={x} dy="-0.5em">{name}</tspan>
                          <tspan x={x} dy="1.2em" fill="#94a3b8">{(percent * 100).toFixed(0)}%</tspan>
                        </text>
                      ) : null;
                    }}
                  >
                    {accessesByTarget.filter(t => t.accesses > 0).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: "12px", borderRadius: "8px", backgroundColor: "#1E293B", border: "1px solid #334155", color: "#F8FAFC" }}
                    itemStyle={{ color: "#F8FAFC" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center px-4">
                No accesses recorded yet.<br />
                <Link to="/admin" className="text-blue-400 hover:underline mt-2 inline-block">Add a target →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
