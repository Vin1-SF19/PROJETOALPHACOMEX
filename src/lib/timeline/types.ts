export interface TimelineEvent {
  id: string;
  timestamp: string; // ISO 8601
  module: string;
  moduleLabel: string;
  title: string;
  description?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  modules: string[];
}
