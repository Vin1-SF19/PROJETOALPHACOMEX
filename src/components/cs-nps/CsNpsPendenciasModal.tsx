"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, MessageSquare, Minus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";

import { salvarLogCSPorAlerta } from "@/actions/Clientes";
import { CsNpsModal3DShell } from "@/app/PainelAlpha/CadastroClientes/CsNpsMotion";
import { fmtDate } from "@/lib/format-date";
import type { PendenciaUltimoCs } from "@/lib/cs-nps/alertas-ultimo-cs";
import { useCsNpsNotificacoes } from "@/store/useCsNpsNotificacoes";

type Sentimento = "pos" | "neg" | "na";

function NovoCsModal({
  pendencia,
  onCancelar,
  onSalvo,
}: {
  pendencia: PendenciaUltimoCs;
  onCancelar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const [sentimento, setSentimento] = useState<Sentimento | null>(null);
  const [observacao, setObservacao] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().split("T")[0]);
  const [salvando, setSalvando] = useState(false);
  const relatoValido = observacao.trim().length >= 10 && observacao.trim().length <= 140;

  async function salvar() {
    if (!sentimento || !relatoValido || !data || salvando) {
      toast.error("Informe o sentimento, a data e um relato de 10 a 140 caracteres.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await salvarLogCSPorAlerta(pendencia.clienteServicoId, {
        sentimento,
        observacao: observacao.trim(),
        data_registro: new Date(`${data}T12:00:00`).toISOString(),
      });
      if (!resultado.success) {
        toast.error(resultado.error || "Não foi possível atualizar o CS.");
        return;
      }
      toast.success("CS atualizado com sucesso.");
      await onSalvo();
    } catch {
      toast.error("Falha na conexão ao atualizar o CS.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="novo-cs-alerta-titulo">
      <CsNpsModal3DShell className="relative w-full max-w-lg rounded-[2rem] border border-emerald-500/20 bg-[#0b1220] p-6 shadow-2xl shadow-emerald-950/30">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400">Atualização rápida</p>
            <h2 id="novo-cs-alerta-titulo" className="mt-1 text-xl font-black uppercase tracking-tight text-white">Novo CS</h2>
            <p className="mt-2 text-xs font-semibold text-slate-300">{pendencia.razaoSocial}</p>
            <p className="text-[10px] text-slate-500">{pendencia.servico}</p>
          </div>
          <button type="button" onClick={onCancelar} disabled={salvando} aria-label="Voltar para empresas pendentes" className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 py-5">
          <fieldset>
            <legend className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Sentimento</legend>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["pos", "Positivo", ThumbsUp],
                ["neg", "Negativo", ThumbsDown],
                ["na", "Neutro", Minus],
              ] as const).map(([valor, rotulo, Icone]) => (
                <button key={valor} type="button" onClick={() => setSentimento(valor)} aria-pressed={sentimento === valor} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[9px] font-black uppercase transition-colors ${sentimento === valor ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/5 bg-slate-950/60 text-slate-500 hover:border-white/15"}`}>
                  <Icone className="size-3.5" /> {rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Data do atendimento</span>
            <input type="date" value={data} onChange={(event) => setData(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50" style={{ colorScheme: "dark" }} />
          </label>

          <label className="block space-y-2">
            <span className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
              Relato do atendimento <span className={relatoValido ? "text-emerald-400" : "text-slate-600"}>{observacao.trim().length}/140</span>
            </span>
            <textarea value={observacao} onChange={(event) => setObservacao(event.target.value.slice(0, 140))} rows={4} placeholder="Descreva o contato realizado com o cliente..." className="w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-emerald-500/50" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
          <button type="button" onClick={onCancelar} disabled={salvando} className="rounded-xl bg-slate-900 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-800 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || !sentimento || !relatoValido || !data} className="rounded-xl bg-emerald-600 py-3 text-[9px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
            {salvando ? "Salvando..." : "Salvar CS"}
          </button>
        </div>
      </CsNpsModal3DShell>
    </div>
  );
}

export function CsNpsPendenciasModal({ onReconciliar }: { onReconciliar: () => Promise<void> }) {
  const { pendencias, carregando, erro, modalAberto, fecharModal } = useCsNpsNotificacoes();
  const [selecionada, setSelecionada] = useState<PendenciaUltimoCs | null>(null);

  if (!modalAberto) return null;

  function fechar() {
    setSelecionada(null);
    fecharModal();
  }

  async function concluirAtualizacao() {
    setSelecionada(null);
    await onReconciliar();
  }

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cs-pendencias-titulo">
      <CsNpsModal3DShell className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-rose-500/20 bg-[#080f1d] shadow-2xl shadow-rose-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400"><AlertTriangle className="size-5" /></span>
            <div>
              <h2 id="cs-pendencias-titulo" className="text-lg font-black uppercase tracking-tight text-white">CS para atualizar</h2>
              <p className="mt-1 text-[10px] text-slate-500">Serviços em andamento há 10 dias ou mais sem novo CS.</p>
            </div>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar empresas pendentes" className="rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"><X className="size-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {carregando && pendencias.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs font-bold uppercase tracking-widest text-slate-500"><Clock3 className="size-4 animate-spin" /> Atualizando lista...</div>
          ) : erro ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <AlertTriangle className="size-7 text-rose-400" />
              <p className="text-sm text-slate-300">{erro}</p>
              <button type="button" onClick={() => void onReconciliar()} className="rounded-xl bg-indigo-600 px-4 py-2 text-[9px] font-black uppercase text-white">Tentar novamente</button>
            </div>
          ) : pendencias.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="size-6" /></span>
              <p className="text-sm font-bold text-white">Todos os CS estão atualizados</p>
              <p className="text-xs text-slate-500">Não há empresas na janela de alerta.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendencias.map((pendencia) => (
                <button key={pendencia.clienteServicoId} type="button" onClick={() => setSelecionada(pendencia)} className="group grid w-full gap-3 rounded-2xl border border-white/5 bg-slate-950/55 p-4 text-left transition-all hover:border-rose-500/25 hover:bg-rose-500/[0.04] sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black uppercase text-white group-hover:text-rose-300">{pendencia.razaoSocial}</span>
                    <span className="mt-1 block truncate text-[10px] font-semibold text-indigo-300">{pendencia.servico}</span>
                    <span className="mt-1 block text-[9px] text-slate-600">{pendencia.cnpj || "CNPJ não informado"}</span>
                  </span>
                  <span className="flex items-center gap-3 sm:text-right">
                    <span>
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 sm:justify-end"><CalendarDays className="size-3" /> Último CS</span>
                      <span className="mt-1 block text-xs font-mono text-slate-300">{fmtDate(pendencia.ultimoCsEm)}</span>
                      <span className="block text-[9px] font-bold text-rose-400">há {pendencia.diasSemAtualizacao} dias</span>
                    </span>
                    <MessageSquare className="size-4 text-slate-700 transition-colors group-hover:text-emerald-400" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </CsNpsModal3DShell>

      {selecionada && <NovoCsModal pendencia={selecionada} onCancelar={() => setSelecionada(null)} onSalvo={concluirAtualizacao} />}
    </div>
  );
}
