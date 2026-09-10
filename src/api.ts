// DERZEN - Frontend API client.
//
// Thin wrapper around the local FastAPI backend. The base URL comes from the
// Vite env var VITE_API_BASE (default http://localhost:8000). Every call throws
// on a non-OK response so callers can show real error states.

const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const body = await resp.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<T>;
}

export interface SystemStatus {
  emergency_stop: boolean;
  ai_available: boolean;
  ai_models: string[];
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  allowed_base: string;
}

export interface RunLogEntry {
  time: string;
  step: string;
  status: 'success' | 'error' | 'running';
  duration: string;
  details: string;
}

export interface RunReport {
  pipeline: string;
  started: string;
  total_seconds: number;
  steps: number;
  status: string;
  log: RunLogEntry[];
}

export interface FileEntry {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  items: number | null;
}

export interface DiskUsage {
  total: string;
  used: string;
  free: string;
  usage_percent: number;
}

export const api = {
  status: () => request<SystemStatus>('/api/status'),
  emergencyStop: () =>
    request<{ stopped: boolean }>('/api/emergency-stop', { method: 'POST' }),
  emergencyReset: () =>
    request<{ stopped: boolean }>('/api/emergency-stop/reset', { method: 'POST' }),

  listPipelines: () => request<any[]>('/api/pipelines'),
  savePipeline: (pipeline: any) =>
    request<any>('/api/pipelines', {
      method: 'POST',
      body: JSON.stringify(pipeline),
    }),
  deletePipeline: (id: string) =>
    request<{ deleted: boolean }>('/api/pipelines/' + id, { method: 'DELETE' }),
  runPipeline: (pipeline: any) =>
    request<RunReport>('/api/pipelines/run', {
      method: 'POST',
      body: JSON.stringify(pipeline),
    }),
  runSaved: (id: string) =>
    request<RunReport>('/api/pipelines/' + id + '/run', { method: 'POST' }),
  generatePipeline: (prompt: string) =>
    request<any>('/api/pipelines/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  schedulerJobs: () => request<any[]>('/api/scheduler/jobs'),

  listFiles: (directory = '') =>
    request<{ directory: string; entries: FileEntry[]; disk: DiskUsage }>(
      '/api/files/list?directory=' + encodeURIComponent(directory),
    ),
};
