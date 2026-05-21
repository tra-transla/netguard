import { useState, useEffect } from "react";
import { fetchTargets, addTarget, deleteTarget } from "../api";
import { Plus, Trash2, Globe, ShieldCheck, Copy, Check, Code2, ExternalLink } from "lucide-react";

function getBaseUrl() {
  return window.location.origin;
}

type SnippetType = "pixel" | "js" | "url";

function SnippetBox({ targetId, targetName }: { targetId: string; targetName: string }) {
  const [copied, setCopied] = useState<SnippetType | null>(null);
  const [activeTab, setActiveTab] = useState<SnippetType>("pixel");

  const base = getBaseUrl();
  const pixelUrl = `${base}/track/${targetId}`;
  const jsUrl    = `${base}/track/${targetId}/js`;

  const snippets: Record<SnippetType, string> = {
    pixel: `<!-- Tracking pixel for "${targetName}" -->\n<img src="${pixelUrl}" width="1" height="1" style="position:absolute;top:-9999px;left:-9999px" alt="" />`,
    js:    `<!-- JS tracker for "${targetName}" -->\n<script src="${jsUrl}" async defer></script>`,
    url:   pixelUrl,
  };

  const copy = async (type: SnippetType) => {
    await navigator.clipboard.writeText(snippets[type]);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabClass = (t: SnippetType) =>
    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
      activeTab === t
        ? "bg-blue-600 text-white"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
    }`;

  return (
    <div className="mt-3 bg-slate-950 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800 bg-slate-900/80">
        <Code2 className="w-3.5 h-3.5 text-slate-500 mr-1" />
        <button className={tabClass("pixel")} onClick={() => setActiveTab("pixel")}>IMG Pixel</button>
        <button className={tabClass("js")}    onClick={() => setActiveTab("js")}>JS Snippet</button>
        <button className={tabClass("url")}   onClick={() => setActiveTab("url")}>Raw URL</button>
        <div className="flex-1" />
        <button
          onClick={() => copy(activeTab)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors"
        >
          {copied === activeTab ? (
            <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
          ) : (
            <><Copy className="w-3 h-3" /><span>Copy</span></>
          )}
        </button>
        <a
          href={pixelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 p-1 text-slate-500 hover:text-blue-400 transition-colors"
          title="Test URL in browser"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      {/* Code */}
      <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {snippets[activeTab]}
      </pre>
    </div>
  );
}

export default function AdminSettings() {
  const [targets, setTargets]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [newTarget, setNewTarget]   = useState("");
  const [newType, setNewType]       = useState("domain");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => { loadTargets(); }, []);

  const loadTargets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTargets();
      setTargets(data);
    } catch (e: any) {
      setError(e.message || "Failed to load targets");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addTarget(newTarget.trim(), newType);
      setNewTarget("");
      await loadTargets();
    } catch (err: any) {
      setError(err.message || "Failed to add target");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this target and all its logs?")) return;
    try {
      await deleteTarget(id);
      if (expanded === id) setExpanded(null);
      await loadTargets();
    } catch (err: any) {
      setError(err.message || "Failed to delete target");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Admin Settings</h1>
        <p className="text-slate-500 mt-1">
          Manage tracked targets. Each target gets a unique tracking URL — embed the snippet on any
          website or email to capture real visitor data.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Add Target */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-medium text-slate-200 mb-6">Add New Target</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="e.g., example.com or 192.168.1.1"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 placeholder-slate-500"
              required
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none font-medium"
            >
              <option value="domain">Domain Name</option>
              <option value="ip">IP Address</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70"
          >
            {isSubmitting ? "Adding…" : <><Plus className="w-5 h-5" /> Add Target</>}
          </button>
        </form>
      </section>

      {/* Target List */}
      <section className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-medium text-slate-200">
            Monitored Targets ({targets.length})
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Click a target to reveal its embed snippets.
          </p>
        </div>

        <div className="divide-y divide-slate-800/80">
          {targets.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No targets yet. Add one above to get started.
            </div>
          ) : (
            targets.map((t) => (
              <div key={t.id} className="transition-colors">
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/40 cursor-pointer select-none"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  {/* Type badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium shrink-0 ${
                      t.type === "domain"
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}
                  >
                    {t.type === "domain" ? (
                      <Globe className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    {t.type === "domain" ? "Domain" : "IP"}
                  </span>

                  {/* Target value */}
                  <span className="font-mono text-sm text-slate-200 flex-1 truncate">
                    {t.target}
                  </span>

                  {/* Added date */}
                  <span className="text-slate-500 text-xs shrink-0 hidden sm:block">
                    Added {new Date(t.addedAt).toLocaleDateString()}
                  </span>

                  {/* Snippet toggle */}
                  <span className="text-xs text-blue-400 hover:text-blue-300 shrink-0 flex items-center gap-1">
                    <Code2 className="w-3.5 h-3.5" />
                    {expanded === t.id ? "Hide" : "Snippet"}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800 shrink-0"
                    title="Remove target"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Snippet panel */}
                {expanded === t.id && (
                  <div className="px-6 pb-6">
                    <p className="text-slate-400 text-xs mb-2">
                      Paste one of the snippets below into your website&nbsp;HTML. 
                      Every real visitor who loads it will be recorded — no simulated data.
                    </p>
                    <SnippetBox targetId={t.id} targetName={t.target} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
