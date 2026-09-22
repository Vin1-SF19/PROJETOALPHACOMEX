import { AlertTriangle, Building2, CalendarClock, ClipboardList, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CardKanbanComposicao, CardKanbanNativeKey } from "@/lib/bpm/card-kanban";
import { CARD_KANBAN_NATIVE_ESTRUTURAIS, elementoCardKanbanChaveEstavel } from "@/lib/bpm/card-kanban";

/**
 * `ok`: valor presente e íntegro. `vazio`: fonte consultada, sem valor (ex.:
 * nenhum telefone cadastrado) — distinto de zero numérico, que é `ok` com
 * valor "0". `indisponivel`: elemento configurável, mas a projeção desta
 * entrega ainda não alimenta o dado (ver File List/limitações conhecidas) —
 * renderiza nada, nunca um erro visível ao operador.
 */
export interface CardKanbanValorCampo {
  status: "ok" | "vazio" | "indisponivel";
  valor?: string;
}

export interface CardKanbanValores {
  nativos: Partial<Record<CardKanbanNativeKey, CardKanbanValorCampo>>;
  campos: Record<string, CardKanbanValorCampo>;
  camposLabel: Record<string, string>;
}

const ICONE_NATIVO: Partial<Record<CardKanbanNativeKey, typeof Building2>> = {
  EMPRESA_NOME: Building2,
  CNPJ: Building2,
  TELEFONE: Phone,
  CHECKLIST: ClipboardList,
  CADENCIA: CalendarClock,
  PENDENCIAS: AlertTriangle,
};

function Badge({
  icone: Icone,
  label,
  valor,
  tom = "neutro",
}: {
  icone?: typeof Building2;
  label: string;
  valor: string;
  tom?: "neutro" | "atencao" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
        tom === "atencao" && "border-amber-500/40 bg-amber-500/15 text-amber-200",
        tom === "ok" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
        tom === "neutro" && "border-white/10 bg-white/[0.05] text-slate-300",
      )}
      title={`${label}: ${valor}`}
    >
      {Icone && <Icone size={11} aria-hidden="true" />}
      {valor}
    </span>
  );
}

/**
 * Renderer compartilhado entre o preview do editor e o card fechado do board
 * (AC-07). Composição vazia ou ausente não renderiza nada além do shell do
 * card, que é responsabilidade do consumidor (AC-06).
 */
export function CardKanbanRenderer({
  composicao,
  valores,
}: {
  composicao: CardKanbanComposicao;
  valores: CardKanbanValores;
}) {
  const itens = composicao.flatMap((elemento) => {
    if (elemento.kind === "NATIVE") {
      // Elementos estruturais (ex.: o widget de agendamento de reunião) têm
      // apresentação própria e são renderizados pelo consumidor — nunca como
      // badge de texto genérico aqui.
      if ((CARD_KANBAN_NATIVE_ESTRUTURAIS as readonly string[]).includes(elemento.key)) return [];
      const dado = valores.nativos[elemento.key];
      if (!dado || dado.status !== "ok" || !dado.valor) return [];
      const definicaoLabel: Partial<Record<CardKanbanNativeKey, string>> = {
        EMPRESA_NOME: "Empresa",
        CNPJ: "CNPJ",
        TELEFONE: "Telefone",
        CHECKLIST: "Procedimento",
        CADENCIA: "Cadência",
        PENDENCIAS: "Pendências",
      };
      return [
        {
          chave: elementoCardKanbanChaveEstavel(elemento),
          label: definicaoLabel[elemento.key] ?? "Campo",
          valor: dado.valor,
          icone: ICONE_NATIVO[elemento.key],
          tom: (elemento.key === "PENDENCIAS" ? "atencao" : "neutro") as "atencao" | "neutro",
        },
      ];
    }
    const dado = valores.campos[elemento.campoId];
    if (!dado || dado.status !== "ok" || !dado.valor) return [];
    return [
      {
        chave: elementoCardKanbanChaveEstavel(elemento),
        label: valores.camposLabel[elemento.campoId] ?? "Campo",
        valor: dado.valor,
        icone: undefined,
        tom: "neutro" as const,
      },
    ];
  });

  if (itens.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="card-kanban-composicao">
      {itens.map((item) => (
        <Badge key={item.chave} icone={item.icone} label={item.label} valor={item.valor} tom={item.tom} />
      ))}
    </div>
  );
}
