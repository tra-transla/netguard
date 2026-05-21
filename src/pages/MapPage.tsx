import { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { fetchLogs, fetchTargets } from "../api";
import { Link } from "react-router";
import { Wifi } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function MapPage() {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [live,    setLive]    = useState(true);

  useEffect(() => {
    Promise.all([fetchLogs(), fetchTargets()])
      .then(([l, t]) => { setLogs(l); setTargets(t); setLoading(false); })
      .catch((err) => {
        console.error(err);
        setError("Failed to connect to backend API.");
        setLoading(false);
      });
  }, []);

  // SSE
  useEffect(() => {
    if (!live) return;
    const es = new EventSource("/api/logs/stream");
    es.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "new_log") {
        setLogs((prev) => [...prev, parsed.data]);
      }
    };
    return () => es.close();
  }, [live]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center min-h-[500px]">
        <div className="text-red-400 mb-4 bg-red-500/10 p-4 rounded-full">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">API Error</h2>
        <p className="text-slate-400 max-w-md">{error}</p>
      </div>
    );
  }

  // Aggregate logs by sourceIp, keeping geo from the last log for that IP
  const markerMap = new Map<string, { sourceIp: string; lat: number; lng: number; count: number; country: string; city: string; targetNames: Set<string> }>();

  logs.forEach((log) => {
    if (log.lat == null || log.lng == null) return;
    const key = log.sourceIp;
    const targetInfo = targets.find(t => t.id === log.targetId);
    const targetName = targetInfo ? targetInfo.target : (log.target || "Unknown");

    if (markerMap.has(key)) {
      const m = markerMap.get(key)!;
      m.count++;
      m.targetNames.add(targetName);
    } else {
      markerMap.set(key, {
        sourceIp: log.sourceIp,
        lat: log.lat,
        lng: log.lng,
        count: 1,
        country: log.country || "Unknown",
        city: log.city || "",
        targetNames: new Set([targetName]),
      });
    }
  });

  const markers = Array.from(markerMap.values());

  return (
    <div className="space-y-6 flex flex-col w-full mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Access Map</h1>
          <p className="text-slate-500 mt-1">
            Geographic distribution of real incoming traffic.
            {markers.length > 0 && <span className="ml-2 text-blue-400">{markers.length} unique IPs</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLive(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              live ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"
            }`}
          >
            <Wifi className="w-3 h-3" />
            {live ? "Live" : "Paused"}
          </button>
          <Link to="/dashboard" className="text-sm font-medium text-blue-400 hover:text-blue-300">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden min-h-[500px] flex flex-col items-center justify-center">
        {tooltip && (
          <div className="absolute top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10 border border-slate-700 max-w-xs">
            {tooltip}
          </div>
        )}

        {logs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="bg-slate-800/80 rounded-xl px-6 py-4 text-sm text-slate-400 text-center border border-slate-700">
              No real traffic data yet.<br />
              <Link to="/admin" className="text-blue-400 hover:underline pointer-events-auto">
                Add a target &amp; embed a snippet →
              </Link>
            </div>
          </div>
        )}

        <ComposableMap
          projectionConfig={{ scale: 140 }}
          width={800} height={400}
          className="w-full h-full object-contain"
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#334155"
                  stroke="#0F172A"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover:   { outline: "none", fill: "#475569" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((marker, idx) => {
            const r = Math.min(3 + Math.sqrt(marker.count) * 1.5, 14);
            return (
              <Marker
                key={idx}
                coordinates={[marker.lng, marker.lat]}
                onMouseEnter={() => {
                  const targets = Array.from(marker.targetNames).join(", ");
                  const loc = [marker.city, marker.country].filter(Boolean).join(", ");
                  setTooltip(`IP: ${marker.sourceIp}  |  ${marker.count} hit${marker.count !== 1 ? "s" : ""}  |  ${loc}  |  Target: ${targets}`);
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle r={r} fill="#3B82F6" opacity={0.75} stroke="#fff" strokeWidth={0.8} />
                {marker.count > 2 && (
                  <circle r={r} fill="none" stroke="#2563EB" strokeWidth={1.5} className="animate-ping" opacity={0.4} />
                )}
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {/* Legend / Summary */}
      {markers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Hits",    value: logs.length },
            { label: "Unique IPs",    value: markers.length },
            { label: "Countries",     value: new Set(markers.map(m => m.country)).size },
            { label: "Targets",       value: targets.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
