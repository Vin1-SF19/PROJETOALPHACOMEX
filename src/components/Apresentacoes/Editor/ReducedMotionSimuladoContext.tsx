"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { Accessibility } from "lucide-react";

const ReducedMotionSimuladoContext = createContext<boolean>(false);

/**
 * Fase 09 — Seção 26 do prompt original: "existe, no editor, uma forma de o usuário VER/testar
 * como a apresentação se comporta com 'Reduzir animações' ativo, sem precisar mudar a
 * preferência do sistema operacional". `prefers-reduced-motion` já é respeitado desde a Fase 02
 * (`useReducedMotion()` do Framer Motion, direto do SO) em `TransicaoSlide.tsx` — usado
 * exclusivamente pelo Modo Apresentação e pelo player exportado, NUNCA pelo Editor.
 *
 * Por isso este Provider/hook NÃO troca nenhum uso existente de `useReducedMotion()` —
 * `TransicaoSlide.tsx` e `RenderComponente.tsx`/`AnimacaoWrapper` (compartilhados com o player
 * exportado) continuam 100% fiéis ao SO real, sem risco de o `.html` exportado herdar uma
 * simulação do Editor por engano. `useReducedMotionEditor()` é para uso NOVO, restrito a
 * componentes que só existem dentro da árvore do Editor (ex: `PreviewMiniatura.tsx`).
 */
export function ReducedMotionSimuladoProvider({ children }: { children: ReactNode }) {
  const [simulado, setSimulado] = useState(false);
  return (
    <ReducedMotionSimuladoContext.Provider value={simulado}>
      <ReducedMotionSimuladoSetterContext.Provider value={setSimulado}>{children}</ReducedMotionSimuladoSetterContext.Provider>
    </ReducedMotionSimuladoContext.Provider>
  );
}

const ReducedMotionSimuladoSetterContext = createContext<(valor: boolean) => void>(() => {});

/** true se o toggle do Editor estiver ativo OU se o SO real já pedir reduced motion. */
export function useReducedMotionEditor(): boolean {
  const simulado = useContext(ReducedMotionSimuladoContext);
  const reduzidoPeloSo = useReducedMotion();
  return simulado || Boolean(reduzidoPeloSo);
}

export function ToggleReducedMotionSimulado() {
  const simulado = useContext(ReducedMotionSimuladoContext);
  const setSimulado = useContext(ReducedMotionSimuladoSetterContext);

  return (
    <button
      type="button"
      onClick={() => setSimulado(!simulado)}
      aria-pressed={simulado}
      aria-label={simulado ? "Desativar simulação de reduzir animações" : "Simular reduzir animações"}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
        simulado
          ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-200"
          : "border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-white"
      }`}
    >
      <Accessibility size={13} aria-hidden="true" />
      {simulado ? "Reduzir animações: ativo" : "Simular reduzir animações"}
    </button>
  );
}
