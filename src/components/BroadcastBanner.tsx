"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { consultarJsonPainel, ConsultaPainelIndisponivel, janelaPrincipal } from "@/lib/painel-polling";
import { useSession } from "next-auth/react";
import { AlertTriangle, X } from "lucide-react";
import { isAdminRole } from "@/lib/roles";

type Aviso = { id: string | number; tipo: "warning" | "error" | "info"; mensagem: string };

export default function BroadcastBanner() {
  const { data: session, status } = useSession();
  const identity = sessaoPermiteOperacao(session) ? session?.user?.id : null;

  const state = useRef({ identity, failures: 0, next: 0 });
  const query = useQuery({
    queryKey: ["alpha-broadcast", identity],
    enabled: status === "authenticated" && !!identity && janelaPrincipal() && !isAdminRole(session?.user?.role),
    retry: false,
    refetchIntervalInBackground: true,
    refetchInterval: () => Math.max(1000, state.current.next - Date.now(), typeof document !== "undefined" && document.hidden ? 60_000 : 15_000),
    queryFn: async ({ signal }) => {
      if (state.current.identity !== identity) state.current = { identity, failures: 0, next: 0 };
      if (Date.now() < state.current.next) throw new ConsultaPainelIndisponivel();
      try {
        const data = await consultarJsonPainel("/api/broadcast", signal);
        signal.throwIfAborted();
        state.current.failures = 0;
        state.current.next = 0;
        if (data && typeof data === "object" && "id" in data &&
            (typeof data.id === "string" || typeof data.id === "number") &&
            "mensagem" in data && typeof data.mensagem === "string" &&
            "tipo" in data && (data.tipo === "warning" || data.tipo === "error" || data.tipo === "info")) {
          return { id: data.id, mensagem: data.mensagem, tipo: data.tipo } satisfies Aviso;
        }
        return null;
      } catch (error) {
        if (!signal.aborted) {
          state.current.failures++;
          state.current.next = Date.now() + Math.max(
            Math.min(300_000, 30_000 * 2 ** Math.min(4, state.current.failures - 1)),
            error instanceof ConsultaPainelIndisponivel ? error.retryAfterMs : 0,
          );
        }
        throw error;
      }
    },
  });
  if (!identity || !query.data || isAdminRole(session?.user?.role)) return null;
  return <AvisoBroadcast key={`${identity}:${query.data.id}`} aviso={query.data} />;
}

function AvisoBroadcast({ aviso }: { aviso: Aviso }) {
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisivel(false), 180_000);
    return () => clearTimeout(timer);
  }, []);
  if (!visivel) return null;
  const estilos: Record<Aviso["tipo"], string> = {
    warning: "bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-amber-500/20",
    error: "bg-red-500/10 border-red-500/50 text-red-500 shadow-red-500/20",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-500 shadow-blue-500/20"
  };

  return (
    <div className={`w-full border-b backdrop-blur-md p-3 relative z-50 animate-in slide-in-from-top duration-700 ${estilos[aviso.tipo] || estilos.warning}`}>
      <div className="max-w-[1800px] mx-auto flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] italic">
        <AlertTriangle size={16} className="animate-pulse" />
        <span className="text-center">{aviso.mensagem}</span>
        <button aria-label="Fechar aviso" onClick={() => setVisivel(false)} className="absolute right-6 cursor-pointer opacity-40 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
