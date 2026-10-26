"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "next-auth";
import { SessionContext, type SessionContextValue } from "next-auth/react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { consultarSessao } from "@/lib/auth/cliente-sessao";
import { sessaoEstaIndisponivel, sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { encerrarSessaoConfirmada, sessaoConfirmaEncerramento } from "@/lib/auth/navegacao-sessao";

interface RecuperacaoSessao {
  indisponivel: boolean;
  verificando: boolean;
  confirmar: () => Promise<Session | null>;
  sinalizarIndisponibilidade: () => void;
  iniciarConfirmacao: () => void;
}
const RecuperacaoContext = createContext<RecuperacaoSessao | null>(null);

export function useRecuperacaoSessao() {
  const context = useContext(RecuperacaoContext);
  if (!context) throw new Error("Recuperação de sessão requer SessionProvider");
  return context;
}

/** Uses Auth.js' public context; all snapshots still come from its real endpoint. */
export function SessionProvider({ session, children }: { session: Session | null; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><SessaoBridge session={session}>{children}</SessaoBridge></QueryClientProvider>;
}

function SessaoBridge({ session, children }: { session: Session | null; children: ReactNode }) {
  const client = useQueryClient();
  const [snapshot, setSnapshot] = useState(sessaoPermiteOperacao(session) || sessaoEstaIndisponivel(session) ? session : null);
  const [indisponivel, setIndisponivel] = useState(sessaoEstaIndisponivel(session));
  const teveSessao = useRef(sessaoPermiteOperacao(session) || sessaoEstaIndisponivel(session));
  const active = useRef(true);
  const generation = useRef(0);
  const falhasRecuperacao = useRef(0);
  const updateController = useRef<AbortController | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const iniciarConfirmacao = useCallback(() => {
    generation.current++;
    updateController.current?.abort();
    void client.cancelQueries({ queryKey: ["alpha-sessao-publica"] });
  }, [client]);
  const sinalizarIndisponibilidade = useCallback(() => {
    setIndisponivel(true);
    setSnapshot(previous => ({ expires: previous?.expires ?? "", estadoAcesso: "INDISPONIVEL", acessoBloqueado: false } as Session));
  }, []);

  const publicar = useCallback((next: Session | null) => {
    if (!active.current) return;
    setSnapshot(sessaoPermiteOperacao(next) || sessaoEstaIndisponivel(next) ? next : null);
    setIndisponivel(sessaoEstaIndisponivel(next));
    if (sessaoPermiteOperacao(next)) teveSessao.current = true;
    if (sessaoConfirmaEncerramento(next, teveSessao.current)) void encerrarSessaoConfirmada();
  }, []);

  const query = useQuery({
    queryKey: ["alpha-sessao-publica"],
    queryFn: async ({ signal }) => {
      const attempt = generation.current;
      try {
        const next = await consultarSessao(signal);
        falhasRecuperacao.current = sessaoEstaIndisponivel(next) ? falhasRecuperacao.current + 1 : 0;
        if (attempt === generation.current) publicar(next);
        return next;
      } catch (error) {
        falhasRecuperacao.current++;
        if (!signal.aborted && attempt === generation.current && active.current) sinalizarIndisponibilidade();
        throw error;
      }
    },
    // Healthy sessions still revalidate/roll the cookie on focus/reconnect.
    // Seed only the SSR snapshot to avoid an extra GET during initial hydration.
    initialData: sessaoEstaIndisponivel(session) ? undefined : sessaoPermiteOperacao(session) ? session : null,
    refetchOnMount: false,
    // Avoid a second automatic fetch when a manual login changes enabled from
    // false to true. Anonymous/revoked sessions have no automatic triggers.
    enabled: true,
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: () => indisponivel || sessaoPermiteOperacao(snapshot),
    refetchOnReconnect: () => indisponivel || sessaoPermiteOperacao(snapshot),
    refetchInterval: () => indisponivel ? Math.min(30_000, 5_000 * 2 ** Math.min(falhasRecuperacao.current, 3)) : false,
    refetchIntervalInBackground: false,
    gcTime: 0,
  });

  const { refetch } = query;
  const confirmar = useCallback(async () => {
    const result = await refetch({ cancelRefetch: false });
    if (result.error) throw result.error;
    return result.data ?? null;
  }, [refetch]);

  const update = useCallback(async (data?: unknown) => {
    if (data === undefined) {
      const attempt = generation.current;
      const next = await confirmar();
      // Credentials are written by the Server Action. Like native update(),
      // notify other tabs after this explicit confirmation, never on a poll.
      if (active.current && attempt === generation.current && sessaoPermiteOperacao(next)) {
        channel.current?.postMessage({ event: "session", data: { trigger: "getSession" } });
      }
      return next;
    }
    // A new preference update supersedes only the previous update, never replays it.
    updateController.current?.abort();
    const controller = new AbortController();
    updateController.current = controller;
    const attempt = ++generation.current;
    try {
      const next = await consultarSessao(controller.signal, data);
      if (!controller.signal.aborted && attempt === generation.current) {
        publicar(next);
        if (sessaoPermiteOperacao(next)) channel.current?.postMessage({ event: "session", data: { trigger: "getSession" } });
      }
      return next;
    } catch (error) {
      if (!controller.signal.aborted && attempt === generation.current && active.current) sinalizarIndisponibilidade();
      throw error;
    } finally {
      if (updateController.current === controller) updateController.current = null;
    }
  }, [confirmar, publicar, sinalizarIndisponibilidade]);

  useEffect(() => {
    active.current = true;
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("next-auth");
      channel.current.onmessage = () => { void confirmar().catch(() => undefined); };
    }
    return () => {
      active.current = false;
      // This is an async generation counter, not a DOM ref. Invalidate all late work.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      updateController.current?.abort();
      channel.current?.close();
    };
  }, [confirmar]);

  const context = useMemo<SessionContextValue>(() => snapshot
    ? { data: snapshot, status: "authenticated", update }
    : { data: null, status: "unauthenticated", update }, [snapshot, update]);
  const recovery = useMemo(() => ({ indisponivel, verificando: query.isFetching, confirmar, sinalizarIndisponibilidade, iniciarConfirmacao }), [indisponivel, query.isFetching, confirmar, sinalizarIndisponibilidade, iniciarConfirmacao]);
  return <SessionContext.Provider value={context}><RecuperacaoContext.Provider value={recovery}>{children}</RecuperacaoContext.Provider></SessionContext.Provider>;
}
