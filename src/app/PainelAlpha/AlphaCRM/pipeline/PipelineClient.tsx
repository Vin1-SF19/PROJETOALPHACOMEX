"use client";

import { useState, useTransition } from "react";
import { fmtDate } from "@/lib/format-date";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, MoreHorizontal, DollarSign, Calendar, Trash2, Edit3, X, CheckCircle,
} from "lucide-react";
import { moverOportunidade, criarOportunidade, excluirOportunidade, atualizarOportunidade } from "@/actions/CRM";
import type { TemaAlpha } from "@/lib/temas";
import type { EtapaKanban } from "@/actions/CRM";

// ─── Config de etapas ────────────────────────────────────────────────────────

const ETAPAS: { id: EtapaKanban; label: string; cor: string }[] = [
  { id: "PROSPECCAO",     label: "Prospecção",       cor: "94,234,212" },
  { id: "QUALIFICACAO",   label: "Qualificação",      cor: "147,197,253" },
  { id: "REUNIAO",        label: "Reunião Marcada",   cor: "196,181,253" },
  { id: "PROPOSTA",       label: "Proposta Enviada",  cor: "253,224,71"  },
  { id: "NEGOCIACAO",     label: "Negociação",        cor: "251,191,36"  },
  { id: "FECHADO_GANHO",  label: "Fechado ✓",         cor: "52,211,153"  },
  { id: "FECHADO_PERDIDO",label: "Perdido",            cor: "248,113,113" },
];

function fmtBRL(v?: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({
  op, accent, onEdit, onDelete,
}: {
  op: any; accent: string; onEdit: (op: any) => void; onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: op.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const [menu, setMenu] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-slate-800/80 border border-white/5 rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-white/10 transition-colors select-none"
    >
      <div className="flex items-start justify-between gap-2" {...attributes} {...listeners}>
        <p className="text-sm font-semibold text-white leading-tight">{op.titulo}</p>
        <div className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenu(p => !p); }}
            onPointerDown={e => e.stopPropagation()}
            className="p-0.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <div className="absolute right-0 top-6 z-20 bg-slate-900 border border-white/10 rounded-xl shadow-xl w-36 overflow-hidden">
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setMenu(false); onEdit(op); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
              ><Edit3 size={12} /> Editar</button>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setMenu(false); onDelete(op.id); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
              ><Trash2 size={12} /> Excluir</button>
            </div>
          )}
        </div>
      </div>

      {(op.empresa || op.cliente?.razaoSocial) && (
        <p className="text-[11px] text-slate-400 leading-tight">{op.empresa || op.cliente?.razaoSocial}</p>
      )}

      <div className="flex items-center justify-between pt-0.5">
        {op.valor ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <DollarSign size={11} />{fmtBRL(op.valor)}
          </span>
        ) : <span />}
        <div className="flex items-center gap-2">
          {op.atividades?.length > 0 && (
            <span className="text-[10px] text-amber-400 font-medium">{op.atividades.length} pendente(s)</span>
          )}
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white"
            style={{ background: `rgba(${accent},0.5)` }}
            title={op.responsavel?.nome}
          >
            {op.responsavel?.nome?.[0]?.toUpperCase() || "?"}
          </span>
        </div>
      </div>

      {op.dataFechamento && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Calendar size={10} />
          {fmtDate(op.dataFechamento)}
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  etapa, cards, accent, onAdd, onEdit, onDelete,
}: {
  etapa: typeof ETAPAS[0]; cards: any[]; accent: string;
  onAdd: (etapa: EtapaKanban) => void; onEdit: (op: any) => void; onDelete: (id: number) => void;
}) {
  const valor = cards.reduce((sum, c) => sum + (c.valor || 0), 0);

  return (
    <div className="flex flex-col min-w-[220px] max-w-[220px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: `rgb(${etapa.cor})` }} />
          <span className="text-xs font-bold text-white">{etapa.label}</span>
          <span
            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `rgba(${etapa.cor},0.2)`, color: `rgb(${etapa.cor})` }}
          >{cards.length}</span>
        </div>
        <button
          onClick={() => onAdd(etapa.id)}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        ><Plus size={13} /></button>
      </div>

      {valor > 0 && (
        <p className="text-[10px] text-emerald-400 font-semibold mb-2 px-1">{fmtBRL(valor)}</p>
      )}

      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div
          className="flex-1 rounded-2xl p-2 space-y-2 min-h-[60px] border border-dashed border-white/5"
          style={{ background: `rgba(${etapa.cor},0.03)` }}
        >
          {cards.map(op => (
            <KanbanCard key={op.id} op={op} accent={accent} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Modal helpers (top-level so they don't get recreated on every render) ────

const modalInputCls = "w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

// ─── Modal Editar ─────────────────────────────────────────────────────────────

function ModalOportunidade({
  op, accent, onClose,
}: {
  op: any; accent: string; onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    titulo: op?.titulo || "",
    empresa: op?.empresa || "",
    valor: op?.valor?.toString() || "",
    etapa: op?.etapa || "PROSPECCAO",
    probabilidade: op?.probabilidade?.toString() || "50",
    descricao: op?.descricao || "",
    dataFechamento: op?.dataFechamento?.split("T")[0] || "",
    perdaMotivo: op?.perdaMotivo || "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSalvar() {
    if (!form.titulo.trim()) return;
    setSaving(true);
    if (op?.id) {
      await atualizarOportunidade(op.id, {
        titulo: form.titulo,
        empresa: form.empresa || undefined,
        valor: form.valor ? Number(form.valor) : null,
        etapa: form.etapa as EtapaKanban,
        probabilidade: Number(form.probabilidade),
        descricao: form.descricao || undefined,
        dataFechamento: form.dataFechamento || undefined,
        perdaMotivo: form.perdaMotivo || undefined,
      });
    } else {
      await criarOportunidade({
        titulo: form.titulo,
        empresa: form.empresa || undefined,
        valor: form.valor ? Number(form.valor) : undefined,
        etapa: form.etapa as EtapaKanban,
        probabilidade: Number(form.probabilidade),
        descricao: form.descricao || undefined,
        dataFechamento: form.dataFechamento || undefined,
      });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-bold text-white">{op?.id ? "Editar Oportunidade" : "Nova Oportunidade"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <FieldRow label="Título *"><input autoFocus className={modalInputCls} placeholder="Nome da oportunidade" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Empresa"><input className={modalInputCls} placeholder="Nome da empresa" value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} /></FieldRow>
            <FieldRow label="Valor (R$)"><input className={modalInputCls} type="number" placeholder="0" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Etapa">
              <select className={modalInputCls} value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value }))}>
                {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Probabilidade (%)"><input className={modalInputCls} type="number" min={0} max={100} value={form.probabilidade} onChange={e => setForm(p => ({ ...p, probabilidade: e.target.value }))} /></FieldRow>
          </div>
          <FieldRow label="Data de Fechamento"><input className={modalInputCls} type="date" value={form.dataFechamento} onChange={e => setForm(p => ({ ...p, dataFechamento: e.target.value }))} /></FieldRow>
          <FieldRow label="Descrição"><textarea className={`${modalInputCls} h-20 resize-none`} placeholder="Detalhes da oportunidade..." value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></FieldRow>
          {(form.etapa === "FECHADO_PERDIDO") && (
            <FieldRow label="Motivo da perda"><input className={modalInputCls} placeholder="Por que perdemos?" value={form.perdaMotivo} onChange={e => setForm(p => ({ ...p, perdaMotivo: e.target.value }))} /></FieldRow>
          )}
        </div>
        <div className="flex gap-2 p-5 border-t border-white/5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={saving || !form.titulo.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `rgba(${accent},0.85)` }}
          >{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Board ───────────────────────────────────────────────────────────

interface Props {
  oportunidades: any[];
  visual: TemaAlpha;
  session: any;
}

export default function PipelineClient({ oportunidades: initialOps, visual, session }: Props) {
  const accent = visual.accent;
  const [ops, setOps] = useState<any[]>(initialOps);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [modalOp, setModalOp] = useState<any | null>(null);
  const [novaEtapa, setNovaEtapa] = useState<EtapaKanban | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getByEtapa = (etapa: EtapaKanban) => ops.filter(o => o.etapa === etapa);

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(Number(active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeOp = ops.find(o => o.id === active.id);
    if (!activeOp) return;

    const overEtapa = ETAPAS.find(e => e.id === over.id)?.id;
    const overOp = ops.find(o => o.id === over.id);
    const targetEtapa = overEtapa || overOp?.etapa;

    if (targetEtapa && targetEtapa !== activeOp.etapa) {
      setOps(prev =>
        prev.map(o => o.id === activeOp.id ? { ...o, etapa: targetEtapa } : o)
      );
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const activeOp = ops.find(o => o.id === active.id);
    if (!activeOp) return;

    const overEtapa = ETAPAS.find(e => e.id === over.id)?.id;
    const overOp = ops.find(o => o.id === over.id);
    const finalEtapa = (overEtapa || overOp?.etapa) as EtapaKanban;

    if (finalEtapa && finalEtapa !== initialOps.find(o => o.id === activeOp.id)?.etapa) {
      startTransition(() => {
        moverOportunidade(activeOp.id, finalEtapa);
      });
    }
  }

  async function handleDelete(id: number) {
    setOps(prev => prev.filter(o => o.id !== id));
    await excluirOportunidade(id);
  }

  const activeOp = ops.find(o => o.id === activeId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <h1 className="text-xl font-black text-white">Pipeline</h1>
        <button
          onClick={() => setModalOp({})}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: `rgba(${accent},0.85)` }}
        >
          <Plus size={15} /> Nova Oportunidade
        </button>
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          <div className="flex gap-4 h-full min-w-max">
            {ETAPAS.map(etapa => (
              <KanbanColumn
                key={etapa.id}
                etapa={etapa}
                cards={getByEtapa(etapa.id)}
                accent={accent}
                onAdd={() => { setNovaEtapa(etapa.id); setModalOp({ etapa: etapa.id }); }}
                onEdit={setModalOp}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeOp && (
            <div className="bg-slate-800 border border-white/20 rounded-xl p-3 shadow-2xl w-[220px] rotate-2 opacity-90">
              <p className="text-sm font-semibold text-white">{activeOp.titulo}</p>
              {activeOp.empresa && <p className="text-xs text-slate-400">{activeOp.empresa}</p>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Modal */}
      {modalOp !== null && (
        <ModalOportunidade
          op={modalOp}
          accent={accent}
          onClose={() => { setModalOp(null); setNovaEtapa(null); }}
        />
      )}
    </div>
  );
}
