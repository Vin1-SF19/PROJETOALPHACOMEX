"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { marcarOnboardingBlueprintVisto } from "@/actions/BlueprintOnboarding";

interface PassoOnboarding {
  seletor: string;
  titulo: string;
  descricao: string;
}

const PASSOS: PassoOnboarding[] = [
  { seletor: '[data-onboarding="novo-sistema"]', titulo: "Crie um novo sistema", descricao: "Clique aqui para registrar uma ideia — mesmo incompleta. Você completa os detalhes depois." },
  { seletor: '[data-onboarding="filtros"]', titulo: "Busque e filtre", descricao: "Encontre projetos por nome ou prioridade rapidamente." },
  { seletor: '[data-onboarding="kanban"]', titulo: "Acompanhe pelo Kanban", descricao: "Arraste os cards entre as colunas conforme o projeto avança — de ideia até concluído." },
];

interface BlueprintOnboardingProps {
  accent: string;
  onFechar: () => void;
}

export function BlueprintOnboarding({ accent, onFechar }: BlueprintOnboardingProps) {
  const [passo, setPasso] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = document.querySelector(PASSOS[passo].seletor);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza posição do spotlight com o layout real do DOM, não há fonte de estado React equivalente
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [passo]);

  async function finalizar(naoMostrarNovamente: boolean) {
    if (naoMostrarNovamente) await marcarOnboardingBlueprintVisto();
    onFechar();
  }

  const ultimoPasso = passo === PASSOS.length - 1;
  const atual = PASSOS[passo];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={() => finalizar(true)} />

      {rect && (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.7), 0 0 0 2px rgba(${accent},0.6)`,
          }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={passo}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="absolute w-72 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl"
          style={
            rect
              ? { left: Math.min(rect.left, window.innerWidth - 300), top: Math.min(rect.bottom + 12, window.innerHeight - 180) }
              : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
          }
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white">{atual.titulo}</p>
            <button onClick={() => finalizar(true)} className="text-slate-500 hover:text-white shrink-0">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{atual.descricao}</p>

          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1">
              {PASSOS.map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-colors"
                  style={{ background: i === passo ? `rgb(${accent})` : "rgba(255,255,255,0.15)" }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {passo > 0 && (
                <button onClick={() => setPasso((p) => p - 1)} className="text-xs text-slate-400 hover:text-white px-2 py-1">
                  Voltar
                </button>
              )}
              <button
                onClick={() => (ultimoPasso ? finalizar(true) : setPasso((p) => p + 1))}
                className="text-xs font-medium text-white px-3 py-1.5 rounded-lg"
                style={{ background: `rgba(${accent},0.9)` }}
              >
                {ultimoPasso ? "Concluir" : "Avançar"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
