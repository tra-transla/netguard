export const API_URL = '/api';

export async function fetchTargets(): Promise<any[]> {
  const res = await fetch(`${API_URL}/targets`);
  if (!res.ok) throw new Error(`Failed to fetch targets (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Invalid response format");
  return res.json();
}

export async function addTarget(target: string, type: string): Promise<any> {
  const res = await fetch(`${API_URL}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, type }),
  });
  if (!res.ok) {
    let msg = `Failed to add target (${res.status})`;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Invalid response format");
  return res.json();
}

export async function deleteTarget(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/targets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete target (${res.status})`);
  return res.json();
}

export async function fetchLogs(limit = 1000): Promise<any[]> {
  const res = await fetch(`${API_URL}/logs?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("Invalid response format");
  return res.json();
}
