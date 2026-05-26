"use client";

import { useState } from "react";
import { fmtDate } from "@/lib/format-date";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2, Circle, Phone, Mail, Video, FileText, StickyNote, Trash2 } from "lucide-react";
import { criarAtividade, concluirAtividade, excluirAtividade } from "@/actions/CRM";
import type { TemaAlpha } from "@/lib/temas";
import type { TipoAtividade } from "@/actions/CRM";

const TIPOS: { id: TipoAtividade; label: string; icon: React.ReactNode; cor: string }[] = [
  { id: "LIGACAO",  label: "Ligação",   icon: <Phone size={14} />,     cor: "52,211,153"   },
  { id: "EMAIL",    label: "E-mail",    icon: <Mail size={14} />,      cor: "147,197,253"  },
  { id: "REUNIAO",  label: "Reunião",   icon: <Video size={14} />,     cor: "196,181,253"  },
  { id: "TAREFA",   label: "Tarefa",    icon: <FileText size={14} />,  cor: "253,224,71"   },
  { id: "NOTA",     label: "Nota",      icon: <StickyNote size={14} />,cor: "251,191,36"   },
];

// ─── Top-level helpers (never recreated on parent re-render) ─────────────────

const atividadeInputCls = "w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

function AtivFieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}

function TipoChip({ tipo }: { tipo: string }) {
  const t = TIPOS.find(x => x.id === tipo);
  if (!t) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `rgba(${t.cor},0.15)`, color: `rgb(${t.cor})` }}>
      {t.icon}{t.label}
    </span>
  );
}

function AtivCard({
  a, hoje, onConcluir, onExcluir,
}: {
  a: any; hoje: string;
  onConcluir: (id: number) => void;
  onExcluir: (id: number) => void;
}) {
  const atrasada = !a.concluida && a.dataPrevista && a.dataPrevista < hoje;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${a.concluida ? "bg-slate-900/30 border-white/3 opacity-60" : "bg-slate-900/60 border-white/5 hover:border-white/10"}`}>
      <button onClick={() => !a.concluida && onConcluir(a.id)} className="mt-0.5 shrink-0">
        {a.concluida
          ? <CheckCircle2 size={18} className="text-emerald-500" />
          : <Circle size={18} className="text-slate-500 hover:text-emerald-400 transition-colors" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <TipoChip tipo={a.tipo} />
          {atrasada && <span className="text-[10px] font-bold text-rose-400">⚠ Atrasada</span>}
        </div>
        <p className={`text-sm font-semibold mt-1 ${a.concluida ? "line-through text-slate-500" : "text-white"}`}>{a.titulo}</p>
        {a.descricao && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.descricao}</p>}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {a.oportunidade && (
            <span className="text-[10px] text-slate-500">{a.oportunidade.titulo}</span>
          )}
          {a.dataPrevista && (
            <span className={`text-[10px] font-medium ${atrasada ? "text-rose-400" : a.concluida ? "text-slate-600" : "text-slate-400"}`}>
              {fmtDate(a.dataPrevista)}
            </span>
          )}
          <span className="text-[10px] text-slate-600">{a.autor?.nome}</span>
        </div>
      </div>
      <button onClick={() => onExcluir(a.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AtivSection({
  title, items, cor, hoje, onConcluir, onExcluir,
}: {
  title: string; items: any[]; cor?: string; hoje: string;
  onConcluir: (id: number) => void;
  onExcluir: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: cor || "#94a3b8" }}>{title} ({items.length})</h3>
      {items.map(a => (
        <AtivCard key={a.id} a={a} hoje={hoje} onConcluir={onConcluir} onExcluir={onExcluir} />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function ModalAtividade({ oportunidades, accent, onClose }: { oportunidades: any[]; accent: string; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ tipo: "TAREFA" as TipoAtividade, titulo: "", descricao: "", dataPrevista: "", oportunidadeId: "" });
  const [saving, setSaving] = useState(false);

  async function handleSalvar() {
    if (!form.titulo.trim()) return;
    setSaving(true);
    await criarAtividade({
      tipo: form.tipo,
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      dataPrevista: form.dataPrevista || undefined,
      oportunidadeId: form.oportunidadeId ? Number(form.oportunidadeId) : undefined,
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 className="font-bold text-white">Nova Atividade</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <AtivFieldRow label="Tipo">
            <div className="flex gap-2 flex-wrap">
              {TIPOS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setForm(p => ({ ...p, tipo: t.id }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                  style={form.tipo === t.id
                    ? { background: `rgba(${t.cor},0.2)`, color: `rgb(${t.cor})`, borderColor: `rgba(${t.cor},0.4)` }
                    : { background: "transparent", color: "#94a3b8", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </AtivFieldRow>
          <AtivFieldRow label="Título *"><input autoFocus className={atividadeInputCls} placeholder="O que precisa ser feito?" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></AtivFieldRow>
          <AtivFieldRow label="Descrição"><textarea className={`${atividadeInputCls} h-16 resize-none`} placeholder="Detalhes..." value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></AtivFieldRow>
          <div className="grid grid-cols-2 gap-3">
            <AtivFieldRow label="Data prevista"><input className={atividadeInputCls} type="date" value={form.dataPrevista} onChange={e => setForm(p => ({ ...p, dataPrevista: e.target.value }))} /></AtivFieldRow>
            <AtivFieldRow label="Oportunidade">
              <select className={atividadeInputCls} value={form.oportunidadeId} onChange={e => setForm(p => ({ ...p, oportunidadeId: e.target.value }))}>
                <option value="">Nenhuma</option>
                {oportunidades.map((o: any) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </select>
            </AtivFieldRow>
          </div>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function AtividadesClient({ atividades: initialAts, oportunidades, visual }: { atividades: any[]; oportunidades: any[]; visual: TemaAlpha }) {
  const accent = visual.accent;
  const [atividades, setAtividades] = useState(initialAts);
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "pendentes" | "concluidas">("pendentes");

  const hoje = new Date().toISOString().split("T")[0];

  const filtradas = atividades.filter(a => {
    if (filtro === "pendentes") return !a.concluida;
    if (filtro === "concluidas") return a.concluida;
    return true;
  });

  const pendentes = filtradas.filter(a => !a.concluida);
  const atrasadas = pendentes.filter(a => a.dataPrevista && a.dataPrevista < hoje);
  const hoje_ats = pendentes.filter(a => a.dataPrevista?.startsWith(hoje));
  const futuras = pendentes.filter(a => !a.dataPrevista || a.dataPrevista > hoje);

  async function handleConcluir(id: number) {
    setAtividades(prev => prev.map(a => a.id === id ? { ...a, concluida: true } : a));
    await concluirAtividade(id);
  }

  async function handleExcluir(id: number) {
    setAtividades(prev => prev.filter(a => a.id !== id));
    await excluirAtividade(id);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Atividades</h1>
          <p className="text-sm text-slate-500">{atividades.filter(a => !a.concluida).length} pendente(s)</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: `rgba(${accent},0.85)` }}
        ><Plus size={15} /> Nova Atividade</button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(["pendentes", "todas", "concluidas"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all"
            style={filtro === f
              ? { background: `rgba(${accent},0.15)`, color: `rgb(${accent})`, borderColor: `rgba(${accent},0.3)` }
              : { background: "transparent", color: "#64748b", borderColor: "rgba(255,255,255,0.06)" }}
          >{f}</button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-6">
        {filtro !== "concluidas" ? (
          <>
            <AtivSection title="Atrasadas" items={atrasadas} cor="rgb(248,113,113)" hoje={hoje} onConcluir={handleConcluir} onExcluir={handleExcluir} />
            <AtivSection title="Hoje" items={hoje_ats} cor={`rgb(${accent})`} hoje={hoje} onConcluir={handleConcluir} onExcluir={handleExcluir} />
            <AtivSection title="Próximas" items={futuras} hoje={hoje} onConcluir={handleConcluir} onExcluir={handleExcluir} />
            {pendentes.length === 0 && (
              <p className="text-center text-slate-500 py-12">Nenhuma atividade pendente.</p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {filtradas.filter(a => a.concluida).map(a => (
              <AtivCard key={a.id} a={a} hoje={hoje} onConcluir={handleConcluir} onExcluir={handleExcluir} />
            ))}
            {filtradas.filter(a => a.concluida).length === 0 && (
              <p className="text-center text-slate-500 py-12">Nenhuma atividade concluída ainda.</p>
            )}
          </div>
        )}
      </div>

      {modal && <ModalAtividade oportunidades={oportunidades} accent={accent} onClose={() => setModal(false)} />}
    </div>
  );
}
