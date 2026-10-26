"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoaderCircle, WifiOff } from "lucide-react";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { useRecuperacaoSessao } from "./SessaoResilienteProvider";
import { PausaSessaoDialog } from "./PausaSessaoDialog";

function AvisoConexao({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  return <section role="status" aria-live="polite" className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 text-center text-slate-100 shadow-2xl">
    <WifiOff className="mx-auto mb-3 h-7 w-7 text-amber-400" aria-hidden="true" />
    <h2 className="text-lg font-semibold">Conexão temporariamente indisponível</h2>
    <p className="mt-2 text-sm text-slate-400">Estamos tentando reconectar. Suas telas abertas serão mantidas. Aguarde a confirmação antes de salvar alterações.</p>
    <button type="button" data-alpha-session-retry aria-disabled={pending} onClick={() => { if (!pending) onRetry(); }} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 aria-disabled:opacity-60">
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{pending ? "Verificando conexão…" : "Tentar novamente"}
    </button>
  </section>;
}

/** Live content stays mounted/inert: no form reset, frame reload or automatic replay. */
export function SessaoProtegida({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { indisponivel, verificando, confirmar } = useRecuperacaoSessao();
  const bloquear = indisponivel && pathname.startsWith("/PainelAlpha");
  return <>
    <div className="contents" inert={bloquear} aria-hidden={bloquear || undefined}>{children}</div>
    {bloquear && <PausaSessaoDialog onRetry={() => { void confirmar().catch(() => undefined); }}><AvisoConexao pending={verificando} onRetry={() => { void confirmar().catch(() => undefined); }} /></PausaSessaoDialog>}
  </>;
}

/** Only an initial denied SSR tree is refreshed; existing live trees never use this. */
export function SessaoIndisponivel({ onRecovered, automatico = true }: { onRecovered?: () => void; automatico?: boolean }) {
  const router = useRouter();
  const { data } = useSession();
  const { indisponivel, verificando, confirmar, sinalizarIndisponibilidade } = useRecuperacaoSessao();
  const iniciou = useRef(false);
  const tentouAutomatico = useRef(false);
  const viuIndisponibilidade = useRef(false);
  useEffect(() => {
    iniciou.current = true;
    sinalizarIndisponibilidade();
  }, [sinalizarIndisponibilidade]);
  useEffect(() => {
    if (indisponivel) { viuIndisponibilidade.current = true; return; }
    if (!automatico || !viuIndisponibilidade.current || !iniciou.current || !sessaoPermiteOperacao(data) || tentouAutomatico.current) return;
    tentouAutomatico.current = true;
    if (onRecovered) onRecovered(); else router.refresh();
  }, [automatico, data, indisponivel, onRecovered, router]);
  const retry = async () => {
    tentouAutomatico.current = true;
    try {
      const next = await confirmar();
      if (sessaoPermiteOperacao(next)) {
        if (onRecovered) onRecovered(); else router.refresh();
      }
    } catch { /* Keep the recoverable view; never replay writes. */ }
  };
  return <div className="grid min-h-dvh place-items-center bg-slate-950 p-4"><AvisoConexao pending={verificando} onRetry={() => { void retry(); }} /></div>;
}
