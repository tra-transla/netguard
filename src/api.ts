export const API_URL = '/api';

export async function fetchTargets() {
  const res = await fetch(`${API_URL}/targets`);
  if (!res.ok) throw new Error('Failed to fetch targets');
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  }
  throw new Error("Invalid response format");
}

export async function addTarget(target: string, type: string) {
  const res = await fetch(`${API_URL}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, type }),
  });
  if (!res.ok) throw new Error('Failed to add target');
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  }
  throw new Error("Invalid response format");
}

export async function deleteTarget(id: string) {
  const res = await fetch(`${API_URL}/targets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete target');
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  }
  throw new Error("Invalid response format");
}

export async function fetchLogs() {
  const res = await fetch(`${API_URL}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return res.json();
  }
  throw new Error("Invalid response format");
}
