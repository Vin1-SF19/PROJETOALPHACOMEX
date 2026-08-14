"use client";

import { useState } from "react";
import { Bell, CheckCircle2, ClipboardCheck, Mail, MessageCircle, Phone, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CriarTarefaBpm, ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";
import { fmtDateTime } from "@/lib/format-date";
import { BPM_TAREFA_TIPOS, obterConfigTipoTarefa, type BpmTarefaTipo } from "@/lib/bpm/tarefas-tipo";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Tarefa = CardDetalhe["tarefas"][number];

interface Props {
  cardId: string;
  responsavelId: number | null;
  tarefas: Tarefa[];
  accent: string;
  podeEditar: boolean;
  onAtualizado: () => void;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-white/25";

function IconeTipo({ tipo, size = 15 }: { tipo: string; size?: number }) {
  if (tipo === "CHECKLIST") return <ClipboardCheck size={size} />;
  if (tipo === "LIGACAO") return <Phone size={size} />;
  if (tipo === "WHATSAPP") return <MessageCircle size={size} />;
  if (tipo === "EMAIL") return <Mail size={size} />;
  return <Bell size={size} />;
}

export function PainelTarefasPorTipo({ cardId, responsavelId, tarefas, accent, podeEditar, onAtualizado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<BpmTarefaTipo>("TAREFA");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailDestino, setEmailDestino] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [itensChecklist, setItensChecklist] = useState("");
  const [prazo, setPrazo] = useState("");
  const [alertaEm, setAlertaEm] = useState("");
  const [salvando, setSalvando] = useState(false);

  function limparFormulario() {
    setTitulo(""); setDescricao(""); setContato(""); setTelefone(""); setEmailDestino("");
    setMensagem(""); setItensChecklist(""); setPrazo(""); setAlertaEm("");
  }

  async function salvar() {
    if (!prazo || !alertaEm) {
      toast.error("Informe prazo e alerta.");
      return;
    }
    setSalvando(true);
    const resultado = await CriarTarefaBpm({
      cardId,
      tipo,
      titulo: titulo.trim() || undefined,
      descricao: descricao.trim() || undefined,
      contato: contato.trim() || undefined,
      telefone: telefone.trim() || undefined,
      emailDestino: emailDestino.trim() || undefined,
      mensagem: mensagem.trim() || undefined,
      checklistItens: tipo === "CHECKLIST"
        ? itensChecklist.split("\n").map((item) => item.trim()).filter(Boolean)
        : undefined,
      responsavelId: responsavelId ?? undefined,
      prazo: new Date(prazo),
      alertaEm: new Date(alertaEm),
    });
    setSalvando(false);
    if (!resultado.success) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível criar a tarefa.");
      return;
    }
    toast.success(`${obterConfigTipoTarefa(tipo).label} criada.`);
    limparFormulario();
    setAberto(false);
    onAtualizado();
  }

  return (
    <div className="mt-2 space-y-2">
      {tarefas.map((tarefa) => {
        const config = obterConfigTipoTarefa(tarefa.tipo);
        const alertaAtivo = tarefa.status === "PENDENTE" && Boolean(tarefa.alertaDisparadoEm);
        return (
          <div key={tarefa.id} className={`rounded-xl border px-3 py-2.5 ${alertaAtivo ? "border-amber-400/35 bg-amber-400/[0.07]" : "border-white/5 bg-white/[0.03]"}`}>
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => void ConcluirTarefaBpm({ tarefaId: tarefa.id }).then((res) => res.success ? onAtualizado() : toast.error(typeof res.error === "string" ? res.error : "Erro ao concluir tarefa"))} disabled={!podeEditar || tarefa.status === "CONCLUIDA"} className="mt-0.5 text-slate-500 disabled:cursor-not-allowed">
                <CheckCircle2 size={16} className={tarefa.status === "CONCLUIDA" ? "text-emerald-400" : ""} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300"><IconeTipo tipo={tarefa.tipo} size={11} />{config.label}</span>
                  {alertaAtivo && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300"><Bell size={11} /> Alerta ativo</span>}
                </div>
                <p className={`mt-1 text-sm ${tarefa.status === "CONCLUIDA" ? "text-slate-500 line-through" : "text-white"}`}>{tarefa.titulo}</p>
                <p className="mt-1 text-[11px] text-slate-500">Prazo: {fmtDateTime(tarefa.prazo)}</p>
                <p className="text-[11px] text-slate-600">Alerta: {fmtDateTime(tarefa.alertaEm)}</p>
              </div>
            </div>
          </div>
        );
      })}

      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)} disabled={!podeEditar} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-xs font-bold text-slate-300 transition hover:border-white/30 hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50">
          <Plus size={14} /> Criar tarefa por tipo
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-white">Nova tarefa</p><button type="button" onClick={() => { setAberto(false); limparFormulario(); }} className="text-slate-500 hover:text-white"><X size={15} /></button></div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {BPM_TAREFA_TIPOS.map((opcao) => (
              <button key={opcao} type="button" onClick={() => setTipo(opcao)} className={`rounded-xl border px-2 py-2 text-left text-[11px] font-semibold transition ${tipo === opcao ? "border-white/30 bg-white/10 text-white" : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]"}`}>
                <span className="flex items-center gap-1.5"><IconeTipo tipo={opcao} size={13} />{obterConfigTipoTarefa(opcao).label}</span>
              </button>
            ))}
          </div>

          {tipo === "CHECKLIST" && <><input className={inputCls} placeholder="Título do checklist" value={titulo} onChange={(e) => setTitulo(e.target.value)} /><textarea className={`${inputCls} min-h-24 resize-none`} placeholder="Um item por linha" value={itensChecklist} onChange={(e) => setItensChecklist(e.target.value)} /></>}
          {tipo === "LIGACAO" && <><input className={inputCls} placeholder="Contato (opcional)" value={contato} onChange={(e) => setContato(e.target.value)} /><input className={inputCls} placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} /><textarea className={`${inputCls} min-h-20 resize-none`} placeholder="Objetivo da ligação" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></>}
          {tipo === "WHATSAPP" && <><input className={inputCls} placeholder="Contato" value={contato} onChange={(e) => setContato(e.target.value)} /><textarea className={`${inputCls} min-h-24 resize-none`} placeholder="Mensagem a enviar" value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></>}
          {tipo === "EMAIL" && <><input className={inputCls} type="email" placeholder="E-mail do destinatário" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} /><input className={inputCls} placeholder="Assunto" value={titulo} onChange={(e) => setTitulo(e.target.value)} /><textarea className={`${inputCls} min-h-24 resize-none`} placeholder="Mensagem do e-mail" value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></>}
          {tipo === "TAREFA" && <><input className={inputCls} placeholder="Título da tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} /><textarea className={`${inputCls} min-h-20 resize-none`} placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></>}
          {tipo === "LEMBRETE_RAPIDO" && <><input className={inputCls} placeholder="Do que você precisa lembrar?" value={titulo} onChange={(e) => setTitulo(e.target.value)} /><textarea className={`${inputCls} min-h-20 resize-none`} placeholder="Contexto opcional" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></>}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-[11px] font-medium text-slate-400">Prazo<input required type="datetime-local" className={`${inputCls} mt-1`} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label><label className="text-[11px] font-medium text-slate-400">Alerta<input required type="datetime-local" className={`${inputCls} mt-1`} value={alertaEm} onChange={(e) => setAlertaEm(e.target.value)} /></label></div>
          <button type="button" onClick={() => void salvar()} disabled={salvando} className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: `rgb(${accent})` }}>{salvando ? "Criando..." : `Criar ${obterConfigTipoTarefa(tipo).label}`}</button>
        </div>
      )}
    </div>
  );
}
