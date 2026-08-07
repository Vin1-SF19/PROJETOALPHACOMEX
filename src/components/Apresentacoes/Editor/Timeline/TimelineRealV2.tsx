import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Copy, ClipboardPaste, Trash2, Group, Ungroup, ZoomIn, ZoomOut } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import { BarraAnimacaoV2 } from "./BarraAnimacaoV2";
import { PlayerControlsTimeline } from "./PlayerControlsTimeline";
import { resolverOrdemExecucao, calcularDelaysEfetivos, resolucaoOrdemEhErro } from "@/lib/apresentacoes/animacao/gatilhos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

const PIXELS_POR_SEGUNDO_BASE = 80;
const MAX_TEMPO = 5;

/** Estado de copiar/colar em memória do módulo — não usa clipboard do SO (Fase 04, item 3). */
let areaTransferencia: ElementAnimation[] = [];

/**
 * Timeline visual do NOVO modelo (Fase 04 — Seção 11 do prompt original). Componente
 * PARALELO a `TimelineReal.tsx` (Onda 3, acoplado ao formato antigo) — nunca o substitui,
 * mesma decisão de coexistência das Fases 02/03.
 */
export function TimelineRealV2() {
  const [aberto, setAberto] = useState(true);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);

  const animacaoConfig = useEditorStore((s) => s.animacaoConfig);
  const componentes = useEditorStore((s) => s.componentes);
  const componenteSelecionadoId = useEditorStore((s) => s.componenteSelecionadoId);
  const removerAnimacaoElemento = useEditorStore((s) => s.removerAnimacaoElemento);
  const adicionarAnimacaoElemento = useEditorStore((s) => s.adicionarAnimacaoElemento);
  const agruparAnimacoes = useEditorStore((s) => s.agruparAnimacoes);
  const desagruparAnimacoes = useEditorStore((s) => s.desagruparAnimacoes);

  const animacoes = useMemo(() => animacaoConfig?.timeline?.animations ?? [], [animacaoConfig?.timeline?.animations]);
  const pixelsPorSegundo = PIXELS_POR_SEGUNDO_BASE * zoom;
  const larguraRegua = MAX_TEMPO * pixelsPorSegundo;

  const delaysPorId = useMemo(() => {
    const resolucao = resolverOrdemExecucao(animacoes);
    if (resolucaoOrdemEhErro(resolucao)) return new Map<string, number>();
    return calcularDelaysEfetivos(resolucao.ordenadas);
  }, [animacoes]);

  const porElemento = useMemo(() => {
    const grupos = new Map<string, ElementAnimation[]>();
    for (const anim of animacoes) {
      const lista = grupos.get(anim.elementId) ?? [];
      lista.push(anim);
      grupos.set(anim.elementId, lista);
    }
    return grupos;
  }, [animacoes]);

  function nomeComponente(id: string): string {
    return componentes.find((c) => c.id === id)?.tipo ?? id;
  }

  function alternarSelecao(id: string, event: React.MouseEvent) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (novo.has(id)) novo.delete(id);
        else novo.add(id);
      } else {
        novo.clear();
        novo.add(id);
      }
      return novo;
    });
  }

  function duplicarSelecionadas() {
    for (const anim of animacoes) {
      if (selecionadas.has(anim.id)) {
        adicionarAnimacaoElemento({ ...anim, id: `anim-${crypto.randomUUID()}` });
      }
    }
  }

  function excluirSelecionadas() {
    for (const id of selecionadas) removerAnimacaoElemento(id);
    setSelecionadas(new Set());
  }

  function copiarSelecionadas() {
    areaTransferencia = animacoes.filter((a) => selecionadas.has(a.id));
  }

  function colarNoSelecionado() {
    if (!componenteSelecionadoId) return;
    for (const anim of areaTransferencia) {
      adicionarAnimacaoElemento({ ...anim, id: `anim-${crypto.randomUUID()}`, elementId: componenteSelecionadoId });
    }
  }

  function agrupar() {
    if (selecionadas.size < 2) return;
    agruparAnimacoes(Array.from(selecionadas));
  }

  const grupos = animacaoConfig?.timeline?.groups ?? [];

  return (
    <div className="shrink-0 border-t border-white/5 bg-slate-950/80">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white"
        aria-expanded={aberto}
      >
        Timeline Alpha Motion ({animacoes.length})
        {aberto ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronUp size={12} aria-hidden="true" />}
      </button>

      {aberto && (
        <>
          <div className="flex items-center gap-1 border-b border-white/5 px-4 py-1.5">
            <button
              onClick={() => setModoAvancado((v) => !v)}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              {modoAvancado ? "Modo: Avançada" : "Modo: Simplificada"}
            </button>
            {modoAvancado && (
              <div role="toolbar" aria-label="Ações da timeline" className="flex items-center gap-1 border-l border-white/10 pl-2">
                <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Diminuir zoom" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white">
                  <ZoomOut size={12} aria-hidden="true" />
                </button>
                <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Aumentar zoom" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white">
                  <ZoomIn size={12} aria-hidden="true" />
                </button>
                <button onClick={copiarSelecionadas} disabled={selecionadas.size === 0} aria-label="Copiar selecionadas" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30">
                  <Copy size={12} aria-hidden="true" />
                </button>
                <button onClick={colarNoSelecionado} disabled={!componenteSelecionadoId || areaTransferencia.length === 0} aria-label="Colar no componente selecionado" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30">
                  <ClipboardPaste size={12} aria-hidden="true" />
                </button>
                <button onClick={duplicarSelecionadas} disabled={selecionadas.size === 0} aria-label="Duplicar selecionadas" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30">
                  Duplicar
                </button>
                <button onClick={excluirSelecionadas} disabled={selecionadas.size === 0} aria-label="Excluir selecionadas" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30">
                  <Trash2 size={12} aria-hidden="true" />
                </button>
                <button onClick={agrupar} disabled={selecionadas.size < 2} aria-label="Agrupar selecionadas" className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30">
                  <Group size={12} aria-hidden="true" />
                </button>
                {grupos.map((g) => (
                  <button key={g.id} onClick={() => desagruparAnimacoes(g.id)} aria-label={`Desagrupar ${g.nome ?? g.id}`} className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white">
                    <Ungroup size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-48 overflow-auto px-4 pb-3">
            {animacoes.length === 0 ? (
              <p className="pt-2 text-xs text-slate-600">Nenhuma animação configurada neste slide ainda.</p>
            ) : (
              <div className="flex flex-col gap-1.5 pt-2">
                <div className="flex gap-2">
                  <div className="w-28 shrink-0" />
                  <div
                    role="slider"
                    aria-label="Posição do cursor de reprodução"
                    aria-valuenow={cursor}
                    aria-valuemin={0}
                    aria-valuemax={MAX_TEMPO}
                    tabIndex={0}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setCursor(Math.max(0, Math.min(MAX_TEMPO, (e.clientX - rect.left) / pixelsPorSegundo)));
                    }}
                    className="relative h-4 cursor-pointer border-b border-white/10"
                    style={{ width: larguraRegua }}
                  >
                    {Array.from({ length: MAX_TEMPO + 1 }).map((_, i) => (
                      <span key={i} className="absolute top-0 text-[9px] text-slate-600" style={{ left: i * pixelsPorSegundo }}>
                        {i}s
                      </span>
                    ))}
                    <div className="absolute top-0 h-full w-px bg-indigo-400" style={{ left: cursor * pixelsPorSegundo }} />
                  </div>
                </div>

                {Array.from(porElemento.entries()).map(([elementId, animsDoElemento]) => (
                  <div key={elementId} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate rounded-lg border border-white/5 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400">
                      {nomeComponente(elementId)}
                    </span>
                    <div className="relative h-6" style={{ width: larguraRegua }}>
                      {animsDoElemento.map((anim) => (
                        <BarraAnimacaoV2
                          key={anim.id}
                          animacao={anim}
                          delayEfetivo={delaysPorId.get(anim.id) ?? anim.delay}
                          pixelsPorSegundo={pixelsPorSegundo}
                          maxTempo={MAX_TEMPO}
                          selecionada={selecionadas.has(anim.id)}
                          onSelecionar={(e) => alternarSelecao(anim.id, e)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {animacoes.length > 0 && (
            <PlayerControlsTimeline animacoes={animacoes} duracaoTotal={MAX_TEMPO} cursor={cursor} onCursorChange={setCursor} />
          )}
        </>
      )}
    </div>
  );
}
