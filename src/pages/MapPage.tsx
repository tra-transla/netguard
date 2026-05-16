import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { fetchLogs, fetchTargets } from '../api';
import { Link } from 'react-router';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function MapPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltipContent, setTooltipContent] = useState("");

  useEffect(() => {
    Promise.all([fetchLogs(), fetchTargets()]).then(([l, t]) => {
      setLogs(l);
      setTargets(t);
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Aggregate logs by source IP to avoid overlapping markers
  const markers = logs.reduce((acc, log) => {
    const existing = acc.find((m: any) => m.sourceIp === log.sourceIp);
    const targetInfo = targets.find(t => t.id === log.targetId);
    
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({
        sourceIp: log.sourceIp,
        coordinates: [log.lng, log.lat],
        count: 1,
        targetName: targetInfo ? targetInfo.target : 'Unknown'
      });
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="space-y-6 h-full flex flex-col max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Access Map</h1>
          <p className="text-gray-500 mt-1">Geographic distribution of incoming traffic.</p>
        </div>
        <Link to="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-700">← Back to Dashboard</Link>
      </header>

      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
        {tooltipContent && (
          <div className="absolute top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10 pointer-events-none transition-opacity">
            {tooltipContent}
          </div>
        )}
        
        <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={400} className="w-full h-full object-contain">
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography 
                  key={geo.rsmKey} 
                  geography={geo} 
                  fill="#E5E7EB" 
                  stroke="#FFFFFF"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", fill: "#D1D5DB" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {markers.map((marker, idx) => (
            <Marker 
              key={idx} 
              coordinates={marker.coordinates}
              onMouseEnter={() => {
                setTooltipContent(`IP: ${marker.sourceIp} | Accesses: ${marker.count} | Target: ${marker.targetName}`);
              }}
              onMouseLeave={() => {
                setTooltipContent("");
              }}
            >
              <circle r={Math.min(4 + marker.count, 12)} fill="#3B82F6" opacity={0.7} stroke="#FFFFFF" strokeWidth={1} />
              <circle r={Math.min(4 + marker.count, 12)} fill="none" stroke="#2563EB" strokeWidth={2} className="animate-ping" opacity={0.5} />
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </div>
  );
}
