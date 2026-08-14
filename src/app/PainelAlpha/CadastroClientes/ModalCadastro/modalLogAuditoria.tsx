"use client";
import { useState } from 'react';
import { fmtDateTime } from "@/lib/format-date";
import { X, History, User, RotateCcw, ShieldAlert, Clock, Undo2 } from "lucide-react";
import { reverterCampoHistorico, type ClienteCS } from '@/actions/Clientes';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CsNpsModal3DShell } from "../CsNpsMotion";

type HistoricoAlteracaoCliente = ClienteCS["historicoAlteracoes"][number];

interface ModalLogAuditoriaProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteCS | null;
  aoSalvar?: () => void | Promise<void>;
}

/** Formata o valor de uma linha de histórico para exibição — detecta string ISO de data e converte para pt-BR, senão mostra o texto como está, "---" se vazio/null. */
function formatarValorHistorico(valor: string | null): string {
  if (!valor) return "---";
  const regexISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (regexISO.test(valor)) {
    const data = new Date(valor);
    return !isNaN(data.getTime()) ? data.toLocaleDateString('pt-BR') : valor;
  }
  return valor;
}

/** `campoNome` → `CAMPO NOME` — mesma formatação usada antes da reescrita. */
function formatarNomeCampo(campo: string): string {
  return campo.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
}

/** Agrupa a lista PLANA de histórico (1 linha por campo alterado) por `loteId`, preservando a ordem de chegada dos grupos (dados já vêm ordenados por `criadoEm: 'desc'` do backend). */
function agruparPorLote(historico: HistoricoAlteracaoCliente[]): Array<{ loteId: string; linhas: HistoricoAlteracaoCliente[] }> {
  const mapa: Record<string, HistoricoAlteracaoCliente[]> = {};
  const ordemLotes: string[] = [];

  for (const linha of historico) {
    if (!mapa[linha.loteId]) {
      mapa[linha.loteId] = [];
      ordemLotes.push(linha.loteId);
    }
    mapa[linha.loteId].push(linha);
  }

  return ordemLotes.map((loteId) => ({ loteId, linhas: mapa[loteId] }));
}

export default function ModalLogAuditoria({ isOpen, onClose, cliente, aoSalvar }: ModalLogAuditoriaProps) {
  const router = useRouter();
  const [linhaParaReverter, setLinhaParaReverter] = useState<HistoricoAlteracaoCliente | null>(null);
  const [revertendoId, setRevertendoId] = useState<string | null>(null);

  const handleConfirmarReversao = async () => {
    if (!linhaParaReverter) return;

    // Fase 3.6 do Cliente Master (2026-08-14): o histórico mesclado tem 2 origens —
    // HistoricoAlteracaoCliente (cadastral, tem `clienteId`) e ClienteServicoHistorico
    // (negócio, tem `clienteServicoId`) — o tipo determina qual endpoint reverter.
    const tipo = "clienteServicoId" in linhaParaReverter ? "servico" : "cliente";

    setRevertendoId(linhaParaReverter.id);
    try {
      const res = await reverterCampoHistorico(linhaParaReverter.id, tipo);

      if (res.success) {
        toast.success("Campo revertido com sucesso!");
        setLinhaParaReverter(null);
        onClose();
        if (aoSalvar) await aoSalvar();
        router.refresh();
      } else {
        toast.error("Erro: " + (res.error ?? "falha desconhecida"));
      }
    } catch {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setRevertendoId(null);
    }
  };

  if (!isOpen || !cliente) return null;

  const grupos = agruparPorLote(cliente.historicoAlteracoes);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">

      <CsNpsModal3DShell className="bg-[#0b1220] border border-white/10 w-full max-w-3xl rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden">

        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <History className="text-indigo-400" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">
                Histórico de <span className="text-indigo-500">Auditoria</span>
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                {cliente.razaoSocial}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar histórico de auditoria"
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white"
          >
            <X size={28} />
          </button>
        </div>

        <div className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar space-y-6 bg-slate-950/20">
          {grupos.length > 0 ? (
            grupos.map(({ loteId, linhas }) => {
              const primeiraLinha = linhas[0];
              const ehReversao = linhas.every((l) => l.acao === "REVERSAO");

              return (
                <div
                  key={loteId}
                  className={`relative group p-6 bg-slate-900/40 border rounded-[2rem] transition-all duration-500 ${
                    ehReversao
                      ? "border-amber-500/20 hover:border-amber-500/40"
                      : "border-white/5 hover:border-indigo-500/40"
                  }`}
                >

                  <div className={`absolute left-0 top-8 bottom-8 w-[2px] transition-colors ${
                    ehReversao
                      ? "bg-amber-500/30 group-hover:bg-amber-500"
                      : "bg-indigo-500/30 group-hover:bg-indigo-500"
                  }`} />

                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                        ehReversao ? "text-amber-400" : "text-indigo-400"
                      }`}>
                        <Clock size={12} /> {fmtDateTime(primeiraLinha.criadoEm)}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-white uppercase italic">
                        <User size={14} className="text-slate-600" /> {primeiraLinha.nomeUsuarioNaEpoca}
                      </div>
                    </div>
                    {ehReversao && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                        <Undo2 size={12} /> Reversão
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {linhas.map((linha) => {
                      const estaRevertendo = revertendoId === linha.id;

                      return (
                        <div key={linha.id} className="bg-slate-950/80 border border-white/5 rounded-2xl overflow-hidden shadow-inner">

                          <div className="px-5 py-2.5 bg-indigo-500/[0.03] border-b border-white/5 flex justify-between items-center">
                            <span className="text-[9px] font-black text-indigo-400/80 uppercase tracking-[0.3em] italic">
                              {formatarNomeCampo(linha.campo)}
                            </span>
                            <button
                              onClick={() => setLinhaParaReverter(linha)}
                              disabled={estaRevertendo}
                              aria-label={`Reverter alteração do campo ${formatarNomeCampo(linha.campo)}`}
                              className="group/btn flex items-center gap-2 px-4 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <RotateCcw size={12} className="group-hover/btn:rotate-[-120deg] transition-transform duration-500" />
                              {estaRevertendo ? "Revertendo..." : "Reverter"}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 divide-x divide-white/5">

                            <div className="p-4 space-y-1.5 bg-rose-500/[0.01]">
                              <p className="text-[7px] font-black text-rose-500/40 uppercase tracking-[0.2em]">De:</p>
                              <p className="text-[11px] font-medium text-slate-400 break-words leading-relaxed italic">
                                {formatarValorHistorico(linha.valorAnterior)}
                              </p>
                            </div>

                            <div className="p-4 space-y-1.5 bg-emerald-500/[0.01]">
                              <p className="text-[7px] font-black text-emerald-500/40 uppercase tracking-[0.2em]">Para:</p>
                              <p className="text-[11px] font-bold text-emerald-400 break-words leading-relaxed">
                                {formatarValorHistorico(linha.valorNovo)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-slate-900/50 rounded-full border border-white/5">
                <History size={40} className="text-slate-800" />
              </div>
              <p className="text-[10px] text-slate-700 uppercase font-black tracking-[0.5em] italic">
                Linha do tempo vazia
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-6 bg-slate-900/40 border-t border-white/5 text-center">
          <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest flex items-center justify-center gap-2">
            Sistema de Auditoria Alpha Comex • Imutável
          </p>
        </div>
      </CsNpsModal3DShell>

      <AlertDialog open={!!linhaParaReverter} onOpenChange={(open) => !open && setLinhaParaReverter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="text-rose-500" size={20} aria-hidden="true" />
              Reverter alteração?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O campo <strong>{linhaParaReverter && formatarNomeCampo(linhaParaReverter.campo)}</strong> voltará para{" "}
              <strong>{linhaParaReverter && formatarValorHistorico(linhaParaReverter.valorAnterior)}</strong> (valor atual:{" "}
              {linhaParaReverter && formatarValorHistorico(linhaParaReverter.valorNovo)}). Esta ação cria um novo registro
              de auditoria e não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarReversao} className="bg-rose-600 hover:bg-rose-500 text-white">
              Reverter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
