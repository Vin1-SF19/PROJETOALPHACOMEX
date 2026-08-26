"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ListTodo, Plus, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { CriarTarefaParceiro, ConcluirTarefaParceiro, ExcluirTarefaParceiro, type ListarTarefasParceiro } from "@/actions/parceiros-tarefas";

type Tarefa = Awaited<ReturnType<typeof ListarTarefasParceiro>>["tarefas"][number];

const PRIORIDADE_COR: Record<string, string> = {
  BAIXA: "text-slate-400 border-slate-500/40 bg-slate-500/10",
  NORMAL: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  ALTA: "text-red-300 border-red-500/40 bg-red-500/10",
};

export default function ParceiroTarefasSection({
  parceiroId,
  tarefasIniciais,
  podeEditar,
  podeExcluir,
  accent,
  cardCls,
}: {
  parceiroId: number;
  tarefasIniciais: Tarefa[];
  podeEditar: boolean;
  podeExcluir: boolean;
  accent: string;
  cardCls: string;
}) {
  const [tarefas, setTarefas] = useState(tarefasIniciais);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [criando, setCriando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  async function criar() {
    if (!novoTitulo.trim()) return;
    setCriando(true);
    const r = await CriarTarefaParceiro({ parceiroId, titulo: novoTitulo.trim(), prioridade: "NORMAL" });
    setCriando(false);
    if (!r.success) { toast.error(r.error); return; }
    setTarefas((prev) => [{ ...r.tarefa, responsavel: null }, ...prev]);
    setNovoTitulo("");
    toast.success("Tarefa criada");
  }

  async function concluir(id: string) {
    setProcessandoId(id);
    const r = await ConcluirTarefaParceiro(id);
    setProcessandoId(null);
    if (!r.success) { toast.error(r.error); return; }
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, status: "CONCLUIDA", concluidaEm: new Date() } : t)));
  }

  async function excluir(id: string) {
    setProcessandoId(id);
    const r = await ExcluirTarefaParceiro(id);
    setProcessandoId(null);
    if (!r.success) { toast.error(r.error); return; }
    setTarefas((prev) => prev.filter((t) => t.id !== id));
  }

  const pendentes = tarefas.filter((t) => t.status === "PENDENTE");
  const concluidas = tarefas.filter((t) => t.status === "CONCLUIDA");

  return (
    <div className={cardCls}>
      <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: `rgb(${accent})` }}>
        <ListTodo size={13} /> Tarefas
      </p>

      {podeEditar && (
        <div className="flex items-center gap-2">
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void criar()}
            placeholder="Nova tarefa..."
            className="flex-1 h-9 rounded-xl px-3 text-[12px] outline-none text-slate-200"
            style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={() => void criar()}
            disabled={criando || !novoTitulo.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-white disabled:opacity-50 shrink-0"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      )}

      {tarefas.length === 0 ? (
        <p className="text-[11px] text-slate-500">Nenhuma tarefa registrada.</p>
      ) : (
        <div className="space-y-2">
          {[...pendentes, ...concluidas].map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.03)", opacity: t.status === "CONCLUIDA" ? 0.5 : 1 }}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] font-bold text-slate-200 ${t.status === "CONCLUIDA" ? "line-through" : ""}`}>{t.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest ${PRIORIDADE_COR[t.prioridade] ?? PRIORIDADE_COR.NORMAL}`}>
                    {t.prioridade}
                  </span>
                  {t.origemAutomatica && <span className="text-[9px] text-slate-500">automática</span>}
                  {t.prazo && <span className="text-[9px] text-slate-500">prazo: {new Date(t.prazo).toLocaleDateString("pt-BR")}</span>}
                  {t.responsavel && <span className="text-[9px] text-slate-500">{t.responsavel.nome}</span>}
                </div>
              </div>
              {podeEditar && t.status === "PENDENTE" && (
                <button onClick={() => void concluir(t.id)} disabled={processandoId === t.id} className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-400 shrink-0 disabled:opacity-50" style={{ background: "rgba(16,185,129,0.1)" }} title="Concluir">
                  <CheckCircle2 size={14} />
                </button>
              )}
              {podeExcluir && (
                <button onClick={() => void excluir(t.id)} disabled={processandoId === t.id} className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 shrink-0 disabled:opacity-50" style={{ background: "rgba(239,68,68,0.1)" }} title="Excluir">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
