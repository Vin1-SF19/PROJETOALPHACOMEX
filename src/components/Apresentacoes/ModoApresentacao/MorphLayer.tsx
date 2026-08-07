"use client";

import { LayoutGroup, motion } from "framer-motion";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import { encontrarParesCompartilhados } from "@/lib/apresentacoes/morph/deteccao";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";

interface MorphLayerProps {
  componentesAtual: ComponenteSlide[];
  componentesProximo: ComponenteSlide[] | null;
  canvas: CanvasConfig;
  duracao?: number;
  pausado?: boolean;
}

/**
 * Fase 06 (Alpha Motion) — Morph / Elemento Compartilhado via `layoutId` nativo do Framer
 * Motion (decisão registrada em `.bibble/memory/decisions.md`, 2026-08-06: NÃO é FLIP manual
 * com clone de DOM/`getBoundingClientRect`, que não tem nenhum precedente no projeto).
 *
 * O QUE ESTE COMPONENTE FAZ: dados os componentes de dois slides, identifica pares com o
 * mesmo `sharedElementId` (via `encontrarParesCompartilhados`, Echo) e aplica `layoutId`
 * nos elegíveis (texto/imagem/card/icone/botao) — o Framer Motion mede e anima a transição
 * de posição/tamanho/opacidade automaticamente. Pares inelegíveis (tipo incompatível, vídeo,
 * 3D, grid) e elementos sem par caem em crossfade simples — nunca travam, nunca erro visível.
 *
 * LIMITAÇÃO HONESTA DESTA FASE: `SlideApresentacaoLayer.tsx` (Modo Apresentação real) hoje
 * desmonta o slide anterior antes de montar o próximo (`AnimatePresence mode="wait"`) — não
 * há, em NENHUM lugar do projeto atual, um ponto onde dois slides consecutivos ficam
 * montados na mesma árvore React ao mesmo tempo (a única exceção, Container Alpha, usa
 * `clip-path` calculado, não montagem dupla real). Para o `layoutId` funcionar de verdade
 * entre slides, os DOIS precisam estar montados simultaneamente na mesma `LayoutGroup`.
 * Reestruturar `SlideApresentacaoLayer.tsx` para permitir isso é um risco maior do que cabe
 * nesta fase (quebraria Container Alpha e as demais transições já funcionando). Este
 * componente é entregue como MOTOR CORRETO E TESTÁVEL isoladamente — a conexão completa ao
 * fluxo real do Modo Apresentação fica como próximo passo, não escondida como "pronta".
 */
export function MorphLayer({ componentesAtual, componentesProximo, canvas, duracao = 0.6, pausado = false }: MorphLayerProps) {
  const resultado = encontrarParesCompartilhados(componentesAtual, componentesProximo ?? []);
  // Sem próximo slide, ou sharedElementId duplicado detectado — fallback total, nunca trava (Seção 29).
  const semMorphPossivel = componentesProximo === null || resultado.erros.length > 0;

  const idsEmParMorph = new Set(
    semMorphPossivel ? [] : resultado.pares.filter((p) => !p.necessitaFallback).map((p) => p.origem.sharedElementId!),
  );

  const transitionMorph = pausado ? { duration: 0.01 } : { duration: duracao, ease: [0.45, 0, 0.2, 1] as const };

  return (
    <LayoutGroup id="morph-slide">
      <div style={{ position: "relative", width: canvas.width, height: canvas.height }}>
        {componentesAtual.map((componente) => {
          const participaDoMorph = Boolean(!semMorphPossivel && componente.sharedElementId && idsEmParMorph.has(componente.sharedElementId));
          return (
            <motion.div
              key={componente.id}
              layoutId={participaDoMorph ? `morph-${componente.sharedElementId}` : undefined}
              layout={participaDoMorph}
              transition={participaDoMorph ? transitionMorph : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={stylePosicaoAbsoluta(componente)}
            >
              <RenderComponente componente={componente} modo="apresentacao" pausado={pausado} />
            </motion.div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
