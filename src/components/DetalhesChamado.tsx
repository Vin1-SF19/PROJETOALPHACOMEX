"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format-date";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { assumirChamado } from "@/actions/chamados";
import {
  Clock, User, MessageSquare, Calendar,
  CheckCircle2, Tag, Eye, FileText,
} from "lucide-react";
import { toast } from "sonner";
import ModalProtocolo from "./ModalProtocolo";
import { NotesContextButton } from "@/components/Notas/Contexto/NotesContextButton";

type Solicitante = {
  nome: string;
  usuario: string;
  telefone?: string | null;
  telefone_corporativo?: string | null;
};

type ChamadoDetalhes = {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  status: string;
  prioridade: string;
  solucao: string | null;
  causa?: string | null;
  mensagemFinal?: string | null;
  usuarioId?: number;
  tecnicoId?: number | null;
  createdAt: Date | string;
  solicitante: Solicitante;
};

type Template = {
  id: number;
  nome: string;
  categoria: string;
  template: string;
  ativo: boolean;
};

type Props = {
  chamado: ChamadoDetalhes;
  isAdmin: boolean;
  templates?: Template[];
};

const prioridadeConfig: Record<string, { label: string; class: string }> = {
  URGENTE: { label: "Urgente", class: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  ALTA: { label: "Alta", class: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  MEDIA: { label: "Média", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  BAIXA: { label: "Baixa", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

function tempoAberto(data: Date | string): string {
  const diff = Date.now() - new Date(data).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "menos de 1h";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function DetalhesChamado({ chamado, isAdmin, templates = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [modalProtocolo, setModalProtocolo] = useState(false);
  const [tecnicoId, setTecnicoId] = useState(chamado.tecnicoId ?? null);

  const handleAssumir = async () => {
    setCarregando(true);
    try {
      const res = await assumirChamado(chamado.id);
      if (res.success && res.chamado) {
        setTecnicoId(res.chamado.tecnicoId);
        toast.success("Chamado assumido com sucesso");
      } else {
        toast.error(res.error || "Erro ao assumir chamado");
      }
    } catch {
      toast.error("Erro ao assumir chamado");
    } finally {
      setCarregando(false);
    }
  };

  const prio = prioridadeConfig[chamado.prioridade] ?? prioridadeConfig.MEDIA;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="sm"
        className="cursor-pointer text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 font-black text-xs uppercase tracking-widest gap-2"
      >
        <Eye size={14} />
        Detalhes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[1.5rem] border-blue-500/10 bg-[#080e1a] p-0 text-white sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] sm:max-w-4xl sm:rounded-[2rem] lg:max-w-5xl 2xl:max-w-6xl">

          {/* Header */}
          <div className="shrink-0 border-b border-white/5 bg-gradient-to-b from-blue-600/5 to-transparent p-4 pr-12 sm:p-6 sm:pr-14 lg:p-8 lg:pr-16">
            <DialogHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <DialogTitle className="mb-1 break-words text-xl font-black uppercase leading-tight tracking-tighter sm:text-2xl">
                    {chamado.titulo}
                  </DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500">
                    <Calendar size={13} />
                    {fmtDateTime(chamado.createdAt)}
                    <span className="text-slate-700">•</span>
                    <Clock size={13} />
                    <span>Aberto há {tempoAberto(chamado.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
                  <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-black">
                    #{chamado.id}
                  </span>
                  <span className={`px-3 py-1 rounded-lg border text-xs font-black ${prio.class}`}>
                    {prio.label}
                  </span>
                  <NotesContextButton
                    moduleKey="chamados"
                    entityType="chamado"
                    entityId={String(chamado.id)}
                    displayName={chamado.titulo}
                    internalPath="/PainelAlpha/Chamados"
                  />
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
            {/* Info grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex gap-3 p-4 rounded-2xl bg-white/3 border border-white/5">
                <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/20 flex-shrink-0">
                  <User className="text-blue-400 w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Solicitante</p>
                  <p className="break-words font-bold text-white text-sm">{chamado.solicitante?.nome}</p>
                  <p className="break-all text-[10px] text-slate-500 font-bold">@{chamado.solicitante?.usuario}</p>
                </div>
              </div>

              <div className="flex gap-3 p-4 rounded-2xl bg-white/3 border border-white/5">
                <div className="p-2 rounded-xl bg-purple-600/15 border border-purple-500/20 flex-shrink-0">
                  <Tag className="text-purple-400 w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Categoria</p>
                  <p className="break-words font-bold text-white text-sm">{chamado.categoria}</p>
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare size={14} className="text-blue-400" />
                Ocorrência Relatada
              </h4>
              <div className="whitespace-pre-wrap break-words p-5 rounded-2xl bg-slate-900/40 border border-white/5 text-slate-300 text-sm leading-relaxed">
                {chamado.descricao}
              </div>
            </div>

            {/* Solução cadastrada */}
            {chamado.solucao && (
              <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <h4 className="text-emerald-400 text-[10px] font-black uppercase flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Solução Aplicada
                  {chamado.mensagemFinal && (
                    <span className="ml-auto px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[8px] font-black normal-case">
                      Com protocolo
                    </span>
                  )}
                </h4>
                <p className="whitespace-pre-wrap break-words text-emerald-100/80 text-sm leading-relaxed">{chamado.solucao}</p>
                {chamado.causa && (
                  <div className="pt-2 border-t border-emerald-500/10">
                    <p className="text-[9px] text-emerald-600 font-black uppercase mb-1">Causa identificada:</p>
                    <p className="whitespace-pre-wrap break-words text-emerald-200/60 text-sm">{chamado.causa}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ações do admin */}
            {isAdmin && chamado.status !== "CONCLUIDO" && (
              <div className="pt-5 border-t border-white/5 space-y-2">
                {tecnicoId == null ? (
                  <Button
                    onClick={handleAssumir}
                    disabled={carregando}
                    aria-busy={carregando}
                    className="w-full cursor-pointer bg-blue-600 hover:bg-blue-500 text-white h-12 font-black rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-40"
                  >
                    <User className="mr-2 w-4 h-4" />
                    {carregando ? "Assumindo..." : "Assumir Chamado"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => { setOpen(false); setModalProtocolo(true); }}
                    className="w-full cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white h-12 font-black rounded-xl shadow-lg shadow-emerald-900/20"
                  >
                    <FileText className="mr-2 w-4 h-4" />
                    Finalizar com Protocolo
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de protocolo completo */}
      {modalProtocolo && (
        <ModalProtocolo
          open={modalProtocolo}
          onClose={() => setModalProtocolo(false)}
          chamado={chamado}
          templates={templates}
        />
      )}
    </>
  );
}
