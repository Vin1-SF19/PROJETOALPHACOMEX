"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Star, CalendarClock, Target, AlertTriangle } from "lucide-react";
import {
  DndContext, type DragEndEvent, DragOverlay, type DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTema } from "@/lib/temas";
import {
  MoverEstagioParceiro,
  RegistrarProximaAcaoParceiro,
  ReativarParceiro,
  ListarParceirosParaKanban,
  type CardKanbanParceiro,
} from "@/actions/parceiros-desenvolvimento";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean; podeAprovar: boolean };
type Card = CardKanbanParceiro;

// Mesma paleta cíclica já usada no Kanban de Aquisição (AquisicaoParceirosClient.tsx).
const CORES_ETAPA = ["94,234,212", "147,197,253", "196,181,253", "253,224,71", "251,191,36", "52,211,153"];

const ESTAGIOS_PRODUTIVOS: { estagio: Card["estagioDesenvolvimento"]; label: string }[] = [
  { estagio: "NOVO", label: "Novo Parceiro" },
  { estagio: "EM_ATIVACAO", label: "Em Ativação" },
  { estagio: "ATIVADO_SEM_INDICACAO", label: "Ativado sem Indicação" },
  { estagio: "PRIMEIRA_INDICACAO", label: "Primeira Indicação" },
  { estagio: "ATIVO", label: "Parceiro Ativo" },
  { estagio: "RECORRENTE", label: "Parceiro Recorrente" },
];

// Estados especiais (fora da sequência linear) têm cor semântica própria — mesmo espírito das
// "saídas laterais" no Kanban de Aquisição.
const ESTAGIOS_ESPECIAIS: { estagio: Card["estagioDesenvolvimento"]; label: string; cor: string }[] = [
  { estagio: "INATIVO", label: "Inativo", cor: "148,163,184" }, // slate — encerrado, aguarda reativação
  { estagio: "EM_REATIVACAO", label: "Em Reativação", cor: "251,191,36" }, // âmbar — transitório, voltando
];

const PARTICULAS_FUNDO = [
  { x: 12, y: 20, duracao: 5.8, delay: 0 },
  { x: 88, y: 16, duracao: 6.2, delay: 0.5 },
  { x: 20, y: 68, duracao: 5.6, delay: 1.1 },
  { x: 92, y: 60, duracao: 6.6, delay: 0.2 },
] as const;

function PotencialBadge({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-[10px] text-slate-500">Sem score</span>;
  return (
    <div className="flex items-center gap-0.5" title={`Potencial de recorrência: ${valor}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={11} className={i < valor ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
      ))}
    </div>
  );
}

function KanbanColuna({
  label,
  cor,
  itens,
  onAbrirCard,
  tracejada = false,
}: {
  label: string;
  cor: string;
  itens: Card[];
  onAbrirCard: (card: Card) => void;
  tracejada?: boolean;
}) {
  return (
    <div className="shrink-0 w-[280px] h-full flex flex-col rounded-2xl overflow-hidden" style={{ background: "rgba(8,11,20,0.55)", border: `1px solid rgba(${cor},0.22)`, boxShadow: `0 0 0 1px rgba(0,0,0,0.2), 0 12px 30px -18px rgba(${cor},0.35)` }}>
      <div className="shrink-0 flex items-center justify-between px-3.5 py-3 border-b" style={{ borderColor: `rgba(${cor},0.18)`, background: `rgba(${cor},0.06)` }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `rgb(${cor})`, boxShadow: `0 0 8px rgba(${cor},0.7)` }} />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-200 truncate">{label}</span>
        </div>
        <span className="text-[10px] font-bold shrink-0 rounded-full px-2 py-0.5" style={{ background: `rgba(${cor},0.18)`, color: `rgb(${cor})` }}>
          {itens.length}
        </span>
      </div>
      <div
        className={`flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 rounded-b-2xl ${tracejada ? "border-dashed" : ""}`}
        style={tracejada ? { border: `1px dashed rgba(${cor},0.12)`, borderTop: "none" } : undefined}
      >
        {itens.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[10px] text-slate-600">Vazio</p>
          </div>
        ) : (
          itens.map((card) => (
            <button
              key={card.parceiroId}
              onClick={() => onAbrirCard(card)}
              className="w-full text-left rounded-xl p-3 transition-all hover:brightness-125 hover:-translate-y-0.5"
              style={{ background: "rgba(15,23,42,0.75)", border: `1px solid rgba(${cor},0.22)` }}
            >
              <p className="text-[12.5px] font-bold text-slate-200 truncate">{card.nome}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Target size={10} /> {card.totalIndicacoes} indicação(ões)</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <PotencialBadge valor={card.potencialRecorrencia} />
                {card.followUpVencido ? (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold">
                    <AlertTriangle size={11} /> Vencido
                  </span>
                ) : card.proximaAcaoEm ? (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <CalendarClock size={11} /> {new Date(card.proximaAcaoEm).toLocaleDateString("pt-BR")}
                  </span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanRelacionamentoParceiros({
  temaName,
  permissao,
  itensIniciais,
}: {
  temaName: string;
  permissao: Permissao;
  itensIniciais: Card[];
}) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const podeEditar = permissao.isAdmin || permissao.podeEditar;
  const reduceMotion = useReducedMotion();
  const [itens, setItens] = useState<Card[]>(itensIniciais);
  const [cardFoco, setCardFoco] = useState<Card | null>(null);
  const [isPending, startTransition] = useTransition();

  async function recarregar() {
    const r = await ListarParceirosParaKanban();
    if (r.success) setItens(r.itens);
  }

  const colunasProdutivas = useMemo(() => {
    return ESTAGIOS_PRODUTIVOS.map((col, i) => ({ ...col, cor: CORES_ETAPA[i % CORES_ETAPA.length], itens: itens.filter((c) => c.estagioDesenvolvimento === col.estagio) }));
  }, [itens]);

  const colunasEspeciais = useMemo(() => {
    return ESTAGIOS_ESPECIAIS.map((col) => ({ ...col, itens: itens.filter((c) => c.estagioDesenvolvimento === col.estagio) }));
  }, [itens]);

  return (
    <main className="relative h-screen w-full flex flex-col overflow-hidden" style={{ background: "#05070d" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {!reduceMotion && (
          <div className="absolute inset-0 opacity-60">
            <AnimatedShaderBackground />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "rgba(5,7,13,0.72)" }} />
        <motion.div
          className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
          style={{ background: `rgba(${accent},0.14)`, filter: "blur(140px)" }}
          animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        {!reduceMotion && PARTICULAS_FUNDO.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: `rgba(${accent},0.5)`, boxShadow: `0 0 8px rgba(${accent},0.5)` }}
            animate={{ y: [0, -14, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: p.duracao, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      <header className="relative z-10 shrink-0 px-6 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(5,7,13,0.4)", backdropFilter: "blur(8px)" }}>
        <Link href="/PainelAlpha/Parceiros" className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-black text-slate-100">Relacionamento de Parceiros</h1>
          <p className="text-[11px] text-slate-500">Ciclo de vida pós-cadastro — {itens.length} parceiros ativos</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 min-h-0 p-6 flex gap-4 overflow-x-auto overflow-y-hidden">
        {colunasProdutivas.map((col) => (
          <KanbanColuna key={col.estagio} label={col.label} cor={col.cor} itens={col.itens} onAbrirCard={setCardFoco} />
        ))}

        <div className="shrink-0 flex flex-col items-center justify-center px-1" aria-hidden>
          <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 py-2 [writing-mode:vertical-rl]">Especiais</span>
          <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
        </div>

        {colunasEspeciais.map((col) => (
          <KanbanColuna key={col.estagio} label={col.label} cor={col.cor} itens={col.itens} onAbrirCard={setCardFoco} tracejada />
        ))}
      </div>

      {cardFoco && (
        <CardDetalheDialog
          card={cardFoco}
          accent={accent}
          podeEditar={podeEditar}
          onClose={() => setCardFoco(null)}
          onAtualizado={() => {
            setCardFoco(null);
            startTransition(() => void recarregar());
          }}
        />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 text-[11px] text-slate-500 px-3 py-1.5 rounded-full" style={{ background: "rgba(15,23,42,0.9)" }}>
          Atualizando...
        </div>
      )}
    </main>
  );
}

const TODOS_ESTAGIOS = [...ESTAGIOS_PRODUTIVOS, ...ESTAGIOS_ESPECIAIS];

function CardDetalheDialog({
  card,
  accent,
  podeEditar,
  onClose,
  onAtualizado,
}: {
  card: Card;
  accent: string;
  podeEditar: boolean;
  onClose: () => void;
  onAtualizado: () => void;
}) {
  const [estagioDestino, setEstagioDestino] = useState(card.estagioDesenvolvimento);
  const [proximaAcaoData, setProximaAcaoData] = useState("");
  const [proximaAcaoDesc, setProximaAcaoDesc] = useState("");
  const [salvando, setSalvando] = useState(false);

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` };

  async function mover() {
    if (estagioDestino === card.estagioDesenvolvimento) return;
    setSalvando(true);
    const r = await MoverEstagioParceiro({ parceiroId: card.parceiroId, estagioDestino });
    setSalvando(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Estágio atualizado");
    onAtualizado();
  }

  async function reativar() {
    setSalvando(true);
    const r = await ReativarParceiro(card.parceiroId);
    setSalvando(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Parceiro movido para reativação");
    onAtualizado();
  }

  async function salvarProximaAcao() {
    if (!proximaAcaoData || !proximaAcaoDesc.trim()) { toast.error("Preencha data e descrição"); return; }
    setSalvando(true);
    const r = await RegistrarProximaAcaoParceiro({ parceiroId: card.parceiroId, proximaAcaoEm: proximaAcaoData, proximaAcaoDescricao: proximaAcaoDesc.trim() });
    setSalvando(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Próxima ação registrada");
    onAtualizado();
  }

  const inicial = card.nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] bg-[#020617] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="px-6 sm:px-8 pt-2 pb-5 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-sm font-black text-slate-100"
              style={{
                background: `linear-gradient(135deg, rgba(${accent},0.35), rgba(${accent},0.08))`,
                boxShadow: `0 8px 24px -8px rgba(${accent},0.5)`,
              }}
            >
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl font-black text-white tracking-tight truncate">{card.nome}</SheetTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                <span>Indicações: {card.totalIndicacoes}</span>
                <span className="text-slate-700">·</span>
                <span>Dias sem indicação: {card.diasSemIndicacao ?? "Nunca indicou"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-6 sm:px-8 pb-8 max-w-2xl">
          {podeEditar && (
            <>
              {card.estagioDesenvolvimento === "INATIVO" ? (
                <section className="space-y-2 p-3 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Parceiro inativo</p>
                  <button onClick={() => void reativar()} disabled={salvando} className="w-full h-10 rounded-xl text-[11px] font-black uppercase tracking-widest text-black" style={{ background: "rgb(251,191,36)" }}>
                    Iniciar reativação
                  </button>
                </section>
              ) : (
                <section className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mover estágio</p>
                  <div className="flex gap-2">
                    <Select value={estagioDestino} onValueChange={(v) => setEstagioDestino(v as Card["estagioDesenvolvimento"])}>
                      <SelectTrigger className={inputCls} style={inputStyle}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TODOS_ESTAGIOS.filter((e) => e.estagio !== "INATIVO").map((e) => <SelectItem key={e.estagio} value={e.estagio}>{e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button onClick={() => void mover()} disabled={salvando} className="h-10 px-4 rounded-xl text-[11px] font-bold text-black shrink-0" style={{ background: `rgba(${accent},1)` }}>
                      Mover
                    </button>
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Próxima ação</p>
                <div className="grid grid-cols-[130px_1fr] gap-2">
                  <input type="date" value={proximaAcaoData} onChange={(e) => setProximaAcaoData(e.target.value)} className={inputCls} style={inputStyle} />
                  <input value={proximaAcaoDesc} onChange={(e) => setProximaAcaoDesc(e.target.value)} placeholder="Ex: Ligação, WhatsApp..." className={inputCls} style={inputStyle} />
                </div>
                <button onClick={() => void salvarProximaAcao()} disabled={salvando} className="h-9 px-4 rounded-xl text-[11px] font-bold text-black" style={{ background: `rgba(${accent},1)` }}>Registrar</button>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
