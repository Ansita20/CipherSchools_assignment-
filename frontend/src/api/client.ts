const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface HealthResponse {
  status: string;
  env: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`health check failed: ${res.status}`);
  }
  return res.json();
}
