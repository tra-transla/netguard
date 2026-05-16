import { useState, useEffect, useMemo } from 'react';
import { fetchTargets, fetchLogs } from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Activity, Globe, ShieldCheck, Users, Search, Plus, MoreVertical, Share2, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router';

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

    const evtSource = new EventSource('/api/logs/stream');
    evtSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "new_log") {
         setLogs(prev => [...prev, parsed.data]);
      }
    };

    return () => {
      evtSource.close();
    };
  }, []);

  const { accessesByTarget, accessesByCountry, activityOverTime, viewsByPath, accessesByMethod, uniqueIPs } = useMemo(() => {
    if (!logs.length) return { accessesByTarget: [], accessesByCountry: [], activityOverTime: [], viewsByPath: [], accessesByMethod: [], uniqueIPs: 0 };

    const targetCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};
    const ips = new Set<string>();
    
    // For time series: group by day (last 7 days for simplicity in this visualization)
    const timeCounts: Record<string, number> = {};

    const now = new Date();
    
    logs.forEach(log => {
      targetCounts[log.targetId] = (targetCounts[log.targetId] || 0) + 1;
      countryCounts[log.country || 'Unknown'] = (countryCounts[log.country || 'Unknown'] || 0) + 1;
      pathCounts[log.path] = (pathCounts[log.path] || 0) + 1;
      methodCounts[log.method] = (methodCounts[log.method] || 0) + 1;
      ips.add(log.sourceIp);

      const logDate = new Date(log.timestamp);
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        const dayKey = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        timeCounts[dayKey] = (timeCounts[dayKey] || 0) + 1;
      }
    });

    const accessesByTarget = targets.map(t => ({
      name: t.target,
      accesses: targetCounts[t.id] || 0,
    })).sort((a, b) => b.accesses - a.accesses);

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

    // Ensure chronological order for time series roughly
    const activityOverTime = Object.entries(timeCounts).map(([date, count]) => ({ date, count })).reverse();

    return { accessesByTarget, accessesByCountry, activityOverTime, viewsByPath, accessesByMethod, uniqueIPs: ips.size };
  }, [targets, logs]);


  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto text-sm text-gray-700 pb-10">
      
      {/* Top Bar matching GA look */}
      <div className="flex items-center justify-between border-b pb-4 mt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"><span className="text-[10px]">ALL</span></div>
             <span className="font-semibold text-lg text-gray-800">Reports snapshot</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-500">
           <Link to="/map" className="text-xs font-medium hover:text-blue-600 transition-colors">Access Map</Link>
           <Link to="/admin" className="text-xs font-medium hover:text-blue-600 transition-colors">Admin Panel</Link>
           <div className="w-px h-4 bg-gray-300 mx-1"></div>
           <span className="text-xs">Last 28 days</span>
           <div className="border rounded px-3 py-1.5 flex items-center shadow-sm bg-white cursor-pointer hover:bg-gray-50">
              Jun 23 - Jul 20, 2025 <span className="ml-2">▼</span>
           </div>
           <Share2 className="w-4 h-4 ml-2 cursor-pointer" />
           <HelpCircle className="w-4 h-4 cursor-pointer" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        
        {/* Card 1: Accesses by Target (like Sessions by medium) */}
        <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">Accesses by Target</h3>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-gray-400 tracking-wider mb-2 border-b pb-2 uppercase">
             <span>Target</span>
             <span>Accesses</span>
          </div>
          <div className="flex-1 w-full overflow-y-auto mt-2 space-y-4 pr-2">
            {accessesByTarget.slice(0, 6).map((item, idx) => {
              const maxAccesses = accessesByTarget[0]?.accesses || 1;
              const widthPercent = Math.max((item.accesses / maxAccesses) * 100, 1);
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="truncate w-3/4 text-gray-700">{item.name}</span>
                    <span className="font-medium text-gray-600">{item.accesses}</span>
                  </div>
                  <div className="w-full h-[3px] bg-transparent relative">
                    <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-r-full" style={{ width: `${widthPercent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-blue-600 font-medium text-xs text-right cursor-pointer hover:underline">
            View targets →
          </div>
        </div>

        {/* Card 2: Active Users by Country (Map) */}
        <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col h-[350px] col-span-1 md:col-span-1">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">Accesses by Country</h3>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
          </div>
          <div className="flex flex-col h-full relative">
             <div className="flex justify-between text-[11px] font-semibold text-gray-400 tracking-wider mb-2 border-b pb-2 uppercase w-1/2 absolute right-0 top-0 z-10 bg-white">
                <span>Country</span>
                <span>Accesses</span>
             </div>
             
             <div className="flex flex-1 mt-6">
                <div className="w-1/2 h-full -ml-8 mt-4 relative z-0">
                  <ComposableMap projectionConfig={{ scale: 120, center: [0, 20] }} width={200} height={150}>
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const isHighlighted = accessesByCountry.some(c => c.name === geo.properties.name);
                          return (
                            <Geography 
                              key={geo.rsmKey} 
                              geography={geo} 
                              fill={isHighlighted ? "#2563EB" : "#E5E7EB"} 
                              stroke="#FFFFFF"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: "none" },
                                hover: { outline: "none", fill: "#3B82F6" },
                                pressed: { outline: "none" },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ComposableMap>
                </div>
                <div className="w-1/2 flex flex-col justify-start pl-4 gap-3 relative z-10 pt-2 bg-gradient-to-r from-transparent to-white via-white">
                   {accessesByCountry.slice(0, 6).map((country, idx) => (
                      <div key={idx} className="flex justify-between text-xs border-b border-gray-100 pb-1">
                        <span className="truncate pr-2">{country.name}</span>
                        <span className="font-medium text-gray-600">{country.count}</span>
                      </div>
                   ))}
                </div>
             </div>
          </div>
          <div className="mt-4 text-blue-600 font-medium text-xs text-right cursor-pointer hover:underline relative z-10">
            <Link to="/map">View countries →</Link>
          </div>
        </div>

        {/* Card 3: User activity over time (Line Chart) */}
        <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col h-[350px]">
           <div className="flex justify-between items-center mb-6">
            <h3 className="font-medium text-gray-800">Activity over time</h3>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
          </div>
          <div className="flex-1 w-full min-h-0 pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityOverTime} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dx={-10} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: '#2563EB' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        
        {/* Card 4: Views by Page title and screen class (Lists) */}
        <div className="bg-white rounded-lg border shadow-sm p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">Views by Path</h3>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
          </div>
          
          <div className="flex justify-between text-[11px] font-semibold text-gray-400 tracking-wider mb-3 border-b pb-2 uppercase">
             <span>Path</span>
             <span>Views</span>
          </div>
           <div className="space-y-4">
             {viewsByPath.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs items-center">
                  <span className="truncate w-3/4">{item.name}</span>
                  <span className="font-medium text-gray-600">{item.count}</span>
                </div>
             ))}
           </div>
           <div className="mt-6 text-blue-600 font-medium text-xs text-right cursor-pointer hover:underline">
            View paths →
          </div>
        </div>

        {/* Card 5: Method breakdown */}
        <div className="bg-white rounded-lg border shadow-sm p-5">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-800">Accesses by Method</h3>
            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-gray-400 tracking-wider mb-3 border-b pb-2 uppercase">
             <span>Method</span>
             <span>Count</span>
          </div>
           <div className="space-y-4 relative">
             {accessesByMethod.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs items-center border-b border-gray-50 pb-2">
                  <span className="truncate">{item.name}</span>
                  <span className="font-medium text-gray-600">{item.count}</span>
                </div>
             ))}
           </div>
           <div className="mt-6 text-blue-600 font-medium text-xs text-right cursor-pointer hover:underline">
            View methods →
          </div>
        </div>

        {/* Card 6: Unique IPs */}
        <div className="bg-white rounded-lg border shadow-sm p-5 flex flex-col justify-between">
           <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-800">Key metrics</h3>
              <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">✔ ▼</span>
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-gray-400 tracking-wider mb-3 border-b pb-2 uppercase">
              <span>Metric</span>
              <span>Value</span>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs border-b border-gray-50 pb-2">
                 <span>Total Accesses</span>
                 <span className="font-medium">{logs.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-gray-50 pb-2">
                 <span>Unique IPs</span>
                 <span className="font-medium">{uniqueIPs}</span>
              </div>
               <div className="flex justify-between items-center text-xs border-b border-gray-50 pb-2">
                 <span>Tracked Targets</span>
                 <span className="font-medium">{targets.length}</span>
              </div>
            </div>
          </div>
           <div className="mt-6 text-blue-600 font-medium text-xs text-right cursor-pointer hover:underline">
            View details →
          </div>
        </div>

      </div>
    </div>
  );
}
