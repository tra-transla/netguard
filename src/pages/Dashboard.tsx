import { useState, useEffect, useMemo } from "react";
import { fetchTargets, fetchLogs } from "../api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import {
  Activity,
  Globe,
  ShieldCheck,
  Users,
  Search,
  Plus,
  MoreVertical,
  Share2,
  HelpCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { Link } from "react-router";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function Dashboard() {
  const [targets, setTargets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTargets(), fetchLogs()]).then(([t, l]) => {
      setTargets(t);
      setLogs(l);
      setLoading(false);
    });

    const evtSource = new EventSource("/api/logs/stream");
    evtSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "new_log") {
        setLogs((prev) => [parsed.data, ...prev]);
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const {
    accessesByTarget,
    accessesByCountry,
    activityOverTime,
    viewsByPath,
    accessesByMethod,
    uniqueIPs,
  } = useMemo(() => {
    const targetCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};
    const ips = new Set<string>();

    // For time series: group by day
    const timeCounts: Record<string, number> = {};

    let startDate = new Date();
    if (targets.length > 0) {
      startDate = new Date(
        Math.min(...targets.map((t) => new Date(t.addedAt).getTime())),
      );
    } else if (logs.length > 0) {
      startDate = new Date(
        Math.min(...logs.map((l) => new Date(l.timestamp).getTime())),
      );
    } else {
      // fallback if no targets and no logs
      startDate.setDate(startDate.getDate() - 7);
    }
    startDate.setHours(0, 0, 0, 0);

    const now = new Date();

    logs.forEach((log) => {
      targetCounts[log.targetId] = (targetCounts[log.targetId] || 0) + 1;
      countryCounts[log.country || "Unknown"] =
        (countryCounts[log.country || "Unknown"] || 0) + 1;
      pathCounts[log.path] = (pathCounts[log.path] || 0) + 1;
      methodCounts[log.method] = (methodCounts[log.method] || 0) + 1;
      ips.add(log.sourceIp);

      const logDate = new Date(log.timestamp);
      const dayKey = logDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      timeCounts[dayKey] = (timeCounts[dayKey] || 0) + 1;
    });

    const accessesByTarget = targets
      .map((t) => ({
        name: t.target,
        accesses: targetCounts[t.id] || 0,
      }))
      .sort((a, b) => b.accesses - a.accesses);

    const accessesByCountry = Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const viewsByPath = Object.entries(pathCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    const accessesByMethod = Object.entries(methodCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Generate consecutive dates from startDate to today
    const activityOverTime = [];
    let currentDate = new Date(startDate);
    while (currentDate <= now) {
      const fullKey = currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const displayKey = currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      activityOverTime.push({
        date: displayKey,
        count: timeCounts[fullKey] || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      accessesByTarget,
      accessesByCountry,
      activityOverTime,
      viewsByPath,
      accessesByMethod,
      uniqueIPs: ips.size,
    };
  }, [targets, logs]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full mx-auto text-sm text-slate-300 pb-10">
      {/* Top Bar matching GA look */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs">
              <span className="text-[10px]">ALL</span>
            </div>
            <span className="font-semibold text-lg text-slate-100">
              Reports snapshot
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <Link
            to="/map"
            className="text-xs font-medium hover:text-blue-400 transition-colors"
          >
            Access Map
          </Link>
          <Link
            to="/admin"
            className="text-xs font-medium hover:text-blue-400 transition-colors"
          >
            Admin Panel
          </Link>
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <span className="text-xs">Last 28 days</span>
          <div className="border border-slate-700 rounded px-3 py-1.5 flex items-center shadow-sm bg-slate-800 text-slate-300 cursor-pointer hover:bg-slate-700">
            Jun 23 - Jul 20, 2025 <span className="ml-2">▼</span>
          </div>
          <Share2 className="w-4 h-4 ml-2 cursor-pointer" />
          <HelpCircle className="w-4 h-4 cursor-pointer" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 1: Accesses by Target (like Sessions by medium) */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Accesses by Target</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-2 border-b border-slate-800 pb-2 uppercase">
            <span className="w-[35%]">Target</span>
            <span className="flex-1">Accesses</span>
          </div>
          <div className="flex-1 w-full overflow-y-auto mt-2 space-y-3 pr-2">
            {accessesByTarget.slice(0, 6).map((item, idx) => {
              const maxAccesses = accessesByTarget[0]?.accesses || 1;
              const widthPercent = Math.max(
                (item.accesses / maxAccesses) * 100,
                5,
              );
              const colors = [
                "#F97316",
                "#3B82F6",
                "#22C55E",
                "#EAB308",
                "#06B6D4",
                "#EF4444",
                "#8B5CF6",
                "#F43F5E",
              ];
              const bgColor = colors[idx % colors.length];

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 text-xs w-full"
                >
                  <span
                    className="truncate w-[35%] text-slate-300"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <div className="flex-1 h-6 relative bg-slate-800/30 rounded">
                    <div
                      className="absolute top-0 left-0 h-full rounded flex items-center px-2 text-white font-medium text-[11px] shadow-sm overflow-hidden whitespace-nowrap"
                      style={{
                        width: `${Math.max(widthPercent, 12)}%`,
                        backgroundColor: bgColor,
                      }}
                    >
                      {item.accesses}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-blue-400 font-medium text-xs text-right cursor-pointer hover:underline">
            <Link to="/logs">View targets →</Link>
          </div>
        </div>

        {/* Card 2: Active Users by Country (Map) */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px] col-span-1 md:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Accesses by Country</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>
          <div className="flex flex-col h-full relative">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-2 border-b border-slate-800 pb-2 uppercase w-1/2 absolute right-0 top-0 z-10 bg-slate-900">
              <span>Country</span>
              <span>Accesses</span>
            </div>

            <div className="flex flex-1 mt-4">
              <div className="w-1/2 h-full relative z-0 flex items-center justify-center overflow-hidden">
                <ComposableMap
                  projectionConfig={{ scale: 140, center: [0, 20] }}
                  width={400}
                  height={400}
                  style={{ width: "100%", height: "auto" }}
                >
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const isHighlighted = accessesByCountry.some(
                          (c) => c.name === geo.properties.name,
                        );
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isHighlighted ? "#3B82F6" : "#334155"}
                            stroke="#0F172A"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: "#60A5FA" },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              </div>
              <div className="w-1/2 flex flex-col justify-start pl-4 gap-3 relative z-10 pt-2 bg-gradient-to-r from-transparent to-slate-900 via-slate-900">
                {accessesByCountry.slice(0, 6).map((country, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs border-b border-slate-800 pb-1"
                  >
                    <span className="truncate pr-2">{country.name}</span>
                    <span className="font-medium text-slate-400">
                      {country.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 text-blue-400 font-medium text-xs text-right cursor-pointer hover:underline relative z-10">
            <Link to="/map">View countries →</Link>
          </div>
        </div>

        {/* Card 3: User activity over time (Line Chart) */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-medium text-slate-100">Activity over time</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>
          <div className="flex-1 w-full min-h-0 pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityOverTime}
                margin={{ top: 5, right: 30, left: -20, bottom: 5 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#334155"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: "12px",
                    borderRadius: "8px",
                    backgroundColor: "#1E293B",
                    border: "1px solid #334155",
                    color: "#F8FAFC",
                  }}
                  itemStyle={{ color: "#E2E8F0" }}
                  cursor={{ fill: "#334155", opacity: 0.4 }}
                />
                <Bar
                  dataKey="count"
                  name="Accesses"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 6: Unique IPs */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-slate-100">Key metrics</h3>
              <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
                ✔ ▼
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-3 border-b border-slate-800 pb-2 uppercase">
              <span>Metric</span>
              <span>Value</span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span>Total Accesses</span>
                <span className="font-medium text-slate-300">
                  {logs.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span>Unique IPs</span>
                <span className="font-medium text-slate-300">{uniqueIPs}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                <span>Tracked Targets</span>
                <span className="font-medium text-slate-300">
                  {targets.length}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 text-blue-400 font-medium text-xs text-right cursor-pointer hover:underline">
            View details →
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Card 4: Recent Logs (replaces Views by Path position) */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm flex flex-col h-[350px] lg:col-span-2 overflow-hidden">
          <div className="p-5 border-b border-slate-800 shrink-0 flex justify-between items-center">
            <h3 className="font-medium text-slate-100">Recent Access Logs</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
             <table className="w-full text-left text-xs whitespace-nowrap text-slate-300">
               <thead className="bg-slate-800/90 text-slate-400">
                 <tr>
                   <th className="px-4 py-2 font-medium">Timestamp</th>
                   <th className="px-4 py-2 font-medium">Target</th>
                   <th className="px-4 py-2 font-medium">IP Address</th>
                   <th className="px-4 py-2 font-medium">Method</th>
                   <th className="px-4 py-2 font-medium">Country</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-800/50 font-mono">
                 {logs.slice(0, 6).map((log, idx) => (
                   <tr key={idx} className="hover:bg-slate-800/30">
                     <td className="px-4 py-2 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                     <td className="px-4 py-2 truncate max-w-[120px]" title={log.target}>{log.target || 'Unknown'}</td>
                     <td className="px-4 py-2 text-blue-400">{log.sourceIp}</td>
                     <td className="px-4 py-2">
                       <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-sans ${
                          log.method === 'GET' ? 'bg-blue-500/10 text-blue-400' :
                          log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400' :
                          log.method === 'DELETE' ? 'bg-red-500/10 text-red-400' :
                          'bg-amber-500/10 text-amber-400'
                       }`}>
                         {log.method}
                       </span>
                     </td>
                     <td className="px-4 py-2 truncate max-w-[150px]" title={log.country}>{log.country || 'Unknown'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
          <div className="p-3 border-t border-slate-800 text-blue-400 font-medium text-xs text-right shrink-0 bg-slate-900">
            <Link to="/logs" className="hover:underline">View all logs →</Link>
          </div>
        </div>

        {/* Card 5: Views by Path */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 col-span-1 h-[350px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Views by Path</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>

          <div className="flex justify-between text-[11px] font-semibold text-slate-500 tracking-wider mb-2 border-b border-slate-800 pb-2 uppercase text-left">
            <span>Path</span>
            <span>Views</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {viewsByPath.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 text-xs w-full"
              >
                <span className="truncate w-[60%] text-slate-300" title={item.name}>{item.name}</span>
                <span className="flex-1 text-right font-medium text-slate-400">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 6: Target percentages */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 shadow-sm p-5 flex flex-col col-span-1 h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-slate-100">Target Distribution</h3>
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded text-xs">
              ✔ ▼
            </span>
          </div>
          <div className="flex-1 w-full min-h-[200px]">
            {accessesByTarget.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accessesByTarget}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={70}
                    paddingAngle={1}
                    dataKey="accesses"
                    labelLine={{ stroke: "#475569", strokeWidth: 1 }}
                    label={({
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      percent,
                      name,
                    }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 1.35;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return percent > 0.02 ? (
                        <text
                          x={x}
                          y={y}
                          fill="#cbd5e1"
                          textAnchor={x > cx ? "start" : "end"}
                          dominantBaseline="central"
                          fontSize="10px"
                          fontWeight={500}
                        >
                          <tspan x={x} dy="-0.5em">
                            {name}
                          </tspan>
                          <tspan x={x} dy="1.2em" fill="#94a3b8">
                            {(percent * 100).toFixed(0)}%
                          </tspan>
                        </text>
                      ) : null;
                    }}
                  >
                    {accessesByTarget.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          [
                            "#F97316",
                            "#3B82F6",
                            "#22C55E",
                            "#EAB308",
                            "#06B6D4",
                            "#EF4444",
                            "#8B5CF6",
                            "#F43F5E",
                          ][index % 8]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontSize: "12px",
                      borderRadius: "8px",
                      backgroundColor: "#1E293B",
                      border: "1px solid #334155",
                      color: "#F8FAFC",
                    }}
                    itemStyle={{ color: "#F8FAFC" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
