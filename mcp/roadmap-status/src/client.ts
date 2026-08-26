const BASE_URL = process.env.ROADMAP_MCP_BASE_URL;
const TOKEN = process.env.ROADMAP_MCP_TOKEN;

if (!BASE_URL) {
  throw new Error("ROADMAP_MCP_BASE_URL não definida (ex: https://painel.exemplo.com/api/roadmap/production).");
}
if (!TOKEN) {
  throw new Error("ROADMAP_MCP_TOKEN não definida — gere uma API key em RoadmapApiKey.");
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class RoadmapApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !body?.success) {
      const message = body?.error ?? `Erro HTTP ${response.status}`;
      const code = body?.code ?? "UNKNOWN_ERROR";
      throw new Error(`[${code}] ${message}`);
    }
    return body.data as T;
  }

  listQueue(filter: { status?: string; moduleKey?: string; assignee?: string }) {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.moduleKey) params.set("moduleKey", filter.moduleKey);
    if (filter.assignee) params.set("assignee", filter.assignee);
    const query = params.toString();
    return this.request(`/queue${query ? `?${query}` : ""}`);
  }

  getRun(runId: string) {
    return this.request(`/runs/${encodeURIComponent(runId)}`);
  }

  updateStatus(runId: string, status: string, resultSummary?: string, errorCode?: string) {
    return this.request(`/runs/${encodeURIComponent(runId)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, resultSummary, errorCode }),
    });
  }

  approve(runId: string) {
    return this.request(`/runs/${encodeURIComponent(runId)}/approve`, { method: "POST" });
  }

  createEvent(runId: string, kind: string, content: string) {
    return this.request(`/runs/${encodeURIComponent(runId)}/events`, {
      method: "POST",
      body: JSON.stringify({ kind, content }),
    });
  }

  listEvents(runId: string, limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return this.request(`/runs/${encodeURIComponent(runId)}/events${query ? `?${query}` : ""}`);
  }

  createRun(objectiveId: string, phaseNumber: number, assignee: string) {
    return this.request(`/objectives/${encodeURIComponent(objectiveId)}/runs`, {
      method: "POST",
      body: JSON.stringify({ phaseNumber, assignee }),
    });
  }

  setCompletionReport(objectiveId: string, reportMarkdown: string) {
    return this.request(`/objectives/${encodeURIComponent(objectiveId)}/completion-report`, {
      method: "POST",
      body: JSON.stringify({ reportMarkdown }),
    });
  }
}

export const roadmapApiClient = new RoadmapApiClient(BASE_URL, TOKEN);
