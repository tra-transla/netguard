import { useState, useEffect } from 'react';
import { fetchTargets, addTarget, deleteTarget } from '../api';
import { Plus, Trash2, Globe, ShieldCheck } from 'lucide-react';

export default function AdminSettings() {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newTarget, setNewTarget] = useState('');
  const [newType, setNewType] = useState('domain');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    try {
      const data = await fetchTargets();
      setTargets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget) return;
    
    setIsSubmitting(true);
    try {
      await addTarget(newTarget, newType);
      setNewTarget('');
      await loadTargets();
    } catch (error) {
      console.error("Failed to add target", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTarget(id);
      await loadTargets();
    } catch (error) {
      console.error("Failed to delete target", error);
    }
  };

  if (loading) {
     return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Admin Settings</h1>
        <p className="text-gray-500 mt-1">Manage IP addresses and domains being monitored.</p>
      </header>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Add New Target</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="e.g., example.com or 192.168.1.1"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium text-gray-700"
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
            {isSubmitting ? 'Adding...' : <><Plus className="w-5 h-5" /> Add Target</>}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Monitored Targets ({targets.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-sm font-medium text-gray-500">
                <th className="py-3 px-6 font-medium">Type</th>
                <th className="py-3 px-6 font-medium">Target</th>
                <th className="py-3 px-6 font-medium">Added</th>
                <th className="py-3 px-6 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {targets.length > 0 ? targets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
                      t.type === 'domain' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {t.type === 'domain' ? <Globe className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {t.type === 'domain' ? 'Domain' : 'IP'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-sm text-gray-900">
                    {t.target}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {new Date(t.addedAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 focus:opacity-100"
                      title="Remove target"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    No targets are currently being monitored.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
