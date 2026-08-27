"use client";

import { useCallback, useEffect, useState } from "react";
import { TimelineEvent, TimelineResponse } from "@/lib/timeline/types";

interface UseClientTimelineResult {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
  modules: string[];
  total: number;
  refetch: () => void;
}

export function useClientTimeline(clientId: number | null): UseClientTimelineResult {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (clientId === null) return;

    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia o fetch da timeline ao trocar de cliente/attempt
    setLoading(true);
    setError(null);

    fetch(`/api/painel-alpha/clientes/${clientId}/timeline`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar timeline do cliente.");
        return res.json() as Promise<TimelineResponse>;
      })
      .then((data) => {
        setEvents(data.events);
        setModules(data.modules);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Erro desconhecido ao carregar timeline.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [clientId, attempt]);

  const refetch = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { events, loading, error, modules, total, refetch };
}
