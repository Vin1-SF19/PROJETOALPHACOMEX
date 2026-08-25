"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (clientId === null) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/painel-alpha/clientes/${clientId}/timeline`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error("Falha ao carregar timeline do cliente.");
      }

      const data: TimelineResponse = await res.json();
      setEvents(data.events);
      setModules(data.modules);
      setTotal(data.total);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Erro desconhecido ao carregar timeline.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [clientId]);

  useEffect(() => {
    fetchTimeline();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchTimeline, attempt]);

  const refetch = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { events, loading, error, modules, total, refetch };
}
