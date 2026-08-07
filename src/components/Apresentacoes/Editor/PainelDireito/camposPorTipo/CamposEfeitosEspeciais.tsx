import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { TIPO_COUNTER, type TipoCounter } from "@/lib/apresentacoes/animacao/counter";
import { TIPO_COLOR_FILL, type TipoColorFill } from "@/lib/apresentacoes/animacao/color-fill";
import { SENTIDO_BORDER_DRAW, INICIO_BORDER_DRAW } from "@/lib/apresentacoes/animacao/border-draw";

const TIPOS_COUNTER_SET: readonly string[] = TIPO_COUNTER;

const LABEL_COLOR_FILL: Record<TipoColorFill, string> = {
  "left-to-right": "Esquerda → Direita",
  "right-to-left": "Direita → Esquerda",
  "top-to-bottom": "Cima → Baixo",
  "bottom-to-top": "Baixo → Cima",
  "center-out": "Centro → Fora",
  radial: "Radial",
  diagonal: "Diagonal",
};

interface CamposEfeitosEspeciaisProps {
  animacao: ElementAnimation;
  onChange: (patch: Partial<ElementAnimation>) => void;
}

function atualizarCustomProperty(animacao: ElementAnimation, onChange: CamposEfeitosEspeciaisProps["onChange"], chave: string, valor: unknown) {
  onChange({ customProperties: { ...animacao.customProperties, [chave]: valor } });
}

/** Fase 07 — campos condicionais de Counter/Color Fill/Border Draw/Dim Others/Focus Element, extraídos de `AnimacaoItemForm.tsx` para caber no limite de 300 linhas. */
export function CamposEfeitosEspeciais({ animacao, onChange }: CamposEfeitosEspeciaisProps) {
  const props = animacao.customProperties ?? {};
  const set = (chave: string, valor: unknown) => atualizarCustomProperty(animacao, onChange, chave, valor);

  if (TIPOS_COUNTER_SET.includes(animacao.type)) {
    const tipo = animacao.type as TipoCounter;
    return (
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={`counter-inicial-${animacao.id}`} className="text-[10px] text-slate-500">Valor inicial</label>
            <input id={`counter-inicial-${animacao.id}`} type="number" value={typeof props.valorInicial === "number" ? props.valorInicial : 0} onChange={(e) => set("valorInicial", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`counter-final-${animacao.id}`} className="text-[10px] text-slate-500">Valor final</label>
            <input id={`counter-final-${animacao.id}`} type="number" value={typeof props.valorFinal === "number" ? props.valorFinal : 100} onChange={(e) => set("valorFinal", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
        </div>
        {tipo === "decimal-counter" && (
          <div className="space-y-1">
            <label htmlFor={`counter-casas-${animacao.id}`} className="text-[10px] text-slate-500">Casas decimais</label>
            <input id={`counter-casas-${animacao.id}`} type="number" min={0} max={4} value={typeof props.casasDecimais === "number" ? props.casasDecimais : 2} onChange={(e) => set("casasDecimais", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={`counter-prefixo-${animacao.id}`} className="text-[10px] text-slate-500">Prefixo</label>
            <input id={`counter-prefixo-${animacao.id}`} type="text" value={typeof props.prefixo === "string" ? props.prefixo : ""} onChange={(e) => set("prefixo", e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`counter-sufixo-${animacao.id}`} className="text-[10px] text-slate-500">Sufixo</label>
            <input id={`counter-sufixo-${animacao.id}`} type="text" value={typeof props.sufixo === "string" ? props.sufixo : ""} onChange={(e) => set("sufixo", e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
        </div>
      </div>
    );
  }

  if (animacao.type === "color-fill") {
    return (
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div className="space-y-1">
          <label htmlFor={`colorfill-direcao-${animacao.id}`} className="text-[10px] text-slate-500">Direção</label>
          <select id={`colorfill-direcao-${animacao.id}`} value={typeof props.direcao === "string" ? props.direcao : "left-to-right"} onChange={(e) => set("direcao", e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500">
            {TIPO_COLOR_FILL.map((tipo) => (
              <option key={tipo} value={tipo}>{LABEL_COLOR_FILL[tipo]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`colorfill-cor-${animacao.id}`} className="text-[10px] text-slate-500">Cor</label>
          <input id={`colorfill-cor-${animacao.id}`} type="color" value={typeof props.cor === "string" ? props.cor : "#6366f1"} onChange={(e) => set("cor", e.target.value)} className="h-8 w-full cursor-pointer rounded-md border border-white/10 bg-slate-950" />
        </div>
      </div>
    );
  }

  if (animacao.type === "border-draw") {
    const borderDraw = (props.borderDraw ?? {}) as Record<string, unknown>;
    const setBorderDraw = (chave: string, valor: unknown) => set("borderDraw", { ...borderDraw, [chave]: valor });
    return (
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={`border-sentido-${animacao.id}`} className="text-[10px] text-slate-500">Sentido</label>
            <select id={`border-sentido-${animacao.id}`} value={typeof borderDraw.sentido === "string" ? borderDraw.sentido : "horario"} onChange={(e) => setBorderDraw("sentido", e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500">
              {SENTIDO_BORDER_DRAW.map((s) => (
                <option key={s} value={s}>{s === "horario" ? "Horário" : "Anti-horário"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={`border-inicio-${animacao.id}`} className="text-[10px] text-slate-500">Início</label>
            <select id={`border-inicio-${animacao.id}`} value={typeof borderDraw.inicio === "string" ? borderDraw.inicio : "topo"} onChange={(e) => setBorderDraw("inicio", e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500">
              {INICIO_BORDER_DRAW.map((i) => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor={`border-espessura-${animacao.id}`} className="text-[10px] text-slate-500">Espessura (px)</label>
            <input id={`border-espessura-${animacao.id}`} type="number" min={1} max={20} value={typeof borderDraw.espessura === "number" ? borderDraw.espessura : 2} onChange={(e) => setBorderDraw("espessura", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor={`border-cor-${animacao.id}`} className="text-[10px] text-slate-500">Cor</label>
            <input id={`border-cor-${animacao.id}`} type="color" value={typeof borderDraw.cor === "string" ? borderDraw.cor : "#6366f1"} onChange={(e) => setBorderDraw("cor", e.target.value)} className="h-8 w-full cursor-pointer rounded-md border border-white/10 bg-slate-950" />
          </div>
        </div>
      </div>
    );
  }

  if (animacao.type === "dim-others") {
    return (
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div className="space-y-1">
          <label htmlFor={`dim-nivel-${animacao.id}`} className="text-[10px] text-slate-500">Nível de escurecimento (0 a 1)</label>
          <input id={`dim-nivel-${animacao.id}`} type="number" min={0} max={1} step={0.1} value={typeof props.nivelEscurecimento === "number" ? props.nivelEscurecimento : 0.6} onChange={(e) => set("nivelEscurecimento", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <label className="flex items-center gap-2 text-[10px] text-slate-500">
          <input type="checkbox" checked={props.aplicarBlur === true} onChange={(e) => set("aplicarBlur", e.target.checked)} className="cursor-pointer" />
          Aplicar blur leve nos demais elementos
        </label>
      </div>
    );
  }

  if (animacao.type === "focus-element") {
    return (
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div className="space-y-1">
          <label htmlFor={`focus-escala-${animacao.id}`} className="text-[10px] text-slate-500">Escala de destaque</label>
          <input id={`focus-escala-${animacao.id}`} type="number" min={1} max={2} step={0.02} value={typeof props.escala === "number" ? props.escala : 1.08} onChange={(e) => set("escala", Number(e.target.value))} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[10px] text-slate-500">
            <input type="checkbox" checked={props.brilho !== false} onChange={(e) => set("brilho", e.target.checked)} className="cursor-pointer" />
            Brilho
          </label>
          <label className="flex items-center gap-2 text-[10px] text-slate-500">
            <input type="checkbox" checked={props.sombra !== false} onChange={(e) => set("sombra", e.target.checked)} className="cursor-pointer" />
            Sombra
          </label>
        </div>
      </div>
    );
  }

  return null;
}
