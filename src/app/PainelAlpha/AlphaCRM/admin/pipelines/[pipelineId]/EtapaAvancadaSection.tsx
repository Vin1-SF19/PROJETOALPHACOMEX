"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import {
  DefinirEtapaInicialBpm,
  DefinirEtapasFinaisBpm,
} from "@/actions/bpm/Etapas";
import {
  CriarSubStatusBpm,
  AtualizarSubStatusBpm,
  AtivarDesativarSubStatusBpm,
} from "@/actions/bpm/SubStatus";
import {
  CriarTransicaoEtapaBpm,
  AtualizarTransicaoEtapaBpm,
} from "@/actions/bpm/Transicoes";

export type EtapaAvancada = {
  id: string;
  nome: string;
  ehInicial: boolean;
  ehFinal: boolean;
};

export type SubStatusBpm = {
  id: string;
  etapaId: string;
  nome: string;
  cor: string | null;
  ordem: number;
  ativo: boolean;
};

export type TransicaoBpm = {
  id: string;
  etapaOrigemId: string;
  etapaDestinoId: string;
  permitida: boolean;
  origem: "MANUAL" | "AUTOMACAO" | "AMBOS";
};

const ORIGENS: { value: TransicaoBpm["origem"]; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTOMACAO", label: "Automação" },
  { value: "AMBOS", label: "Ambos" },
];

const inputCls = "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

function mensagemErro(error: unknown, fallback: string): string {
  return typeof error === "string" ? error : fallback;
}

interface Props {
  pipelineId: string;
  etapa: EtapaAvancada;
  todasEtapas: EtapaAvancada[];
  subStatus: SubStatusBpm[];
  transicoes: TransicaoBpm[];
  accent: string;
  onEtapasAtualizadas: (patch: Record<string, Partial<EtapaAvancada>>) => void;
  onSubStatusAtualizado: (subStatus: SubStatusBpm) => void;
  onTransicaoAtualizada: (transicao: TransicaoBpm) => void;
}

export function EtapaAvancadaSection({
  pipelineId,
  etapa,
  todasEtapas,
  subStatus,
  transicoes,
  accent,
  onEtapasAtualizadas,
  onSubStatusAtualizado,
  onTransicaoAtualizada,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [novoSubStatusNome, setNovoSubStatusNome] = useState("");
  const [novoSubStatusCor, setNovoSubStatusCor] = useState("#64748b");
  const [criandoSubStatus, setCriandoSubStatus] = useState(false);

  async function handleDefinirInicial() {
    const res = await DefinirEtapaInicialBpm({ pipelineId, etapaId: etapa.id });
    if (res.success) {
      const patch: Record<string, Partial<EtapaAvancada>> = { [etapa.id]: { ehInicial: true } };
      for (const e of todasEtapas) {
        if (e.id !== etapa.id && e.ehInicial) patch[e.id] = { ehInicial: false };
      }
      onEtapasAtualizadas(patch);
      toast.success(`"${etapa.nome}" definida como etapa inicial`);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao definir etapa inicial"));
    }
  }

  async function handleToggleFinal(marcar: boolean) {
    const idsAtuais = todasEtapas.filter((e) => (e.id === etapa.id ? marcar : e.ehFinal)).map((e) => e.id);
    const res = await DefinirEtapasFinaisBpm({ pipelineId, etapaIds: idsAtuais });
    if (res.success) {
      onEtapasAtualizadas({ [etapa.id]: { ehFinal: marcar } });
      toast.success(marcar ? `"${etapa.nome}" marcada como etapa final` : `"${etapa.nome}" removida das etapas finais`);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao definir etapas finais"));
    }
  }

  async function handleCriarSubStatus() {
    if (!novoSubStatusNome.trim()) return;
    setCriandoSubStatus(true);
    const res = await CriarSubStatusBpm({
      etapaId: etapa.id,
      nome: novoSubStatusNome.trim(),
      cor: novoSubStatusCor,
      ordem: subStatus.length,
    });
    setCriandoSubStatus(false);
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
      setNovoSubStatusNome("");
      toast.success("Substatus criado");
    } else {
      toast.error(mensagemErro(res.error, "Erro ao criar substatus"));
    }
  }

  async function handleToggleSubStatusAtivo(sub: SubStatusBpm, ativo: boolean) {
    const res = await AtivarDesativarSubStatusBpm({ subStatusId: sub.id, ativo });
    if (res.success && "data" in res && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar substatus"));
    }
  }

  async function handleRenomearSubStatus(sub: SubStatusBpm, nome: string) {
    if (!nome.trim() || nome === sub.nome) return;
    const res = await AtualizarSubStatusBpm({ subStatusId: sub.id, nome: nome.trim() });
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao renomear substatus"));
    }
  }

  async function handleAlterarCorSubStatus(sub: SubStatusBpm, cor: string) {
    const res = await AtualizarSubStatusBpm({ subStatusId: sub.id, cor });
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar cor do substatus"));
    }
  }

  function transicaoPara(destinoId: string) {
    return transicoes.find((t) => t.etapaOrigemId === etapa.id && t.etapaDestinoId === destinoId) ?? null;
  }

  async function handleToggleTransicao(destinoId: string, permitida: boolean) {
    const existente = transicaoPara(destinoId);
    const res = existente
      ? await AtualizarTransicaoEtapaBpm({ transicaoId: existente.id, permitida })
      : await CriarTransicaoEtapaBpm({
          pipelineId,
          etapaOrigemId: etapa.id,
          etapaDestinoId: destinoId,
          permitida,
          origem: "AMBOS",
        });
    if (res.success && res.data) {
      onTransicaoAtualizada(res.data as TransicaoBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar transição"));
    }
  }

  async function handleAlterarOrigemTransicao(destinoId: string, origem: TransicaoBpm["origem"]) {
    const existente = transicaoPara(destinoId);
    const res = existente
      ? await AtualizarTransicaoEtapaBpm({ transicaoId: existente.id, origem })
      : await CriarTransicaoEtapaBpm({
          pipelineId,
          etapaOrigemId: etapa.id,
          etapaDestinoId: destinoId,
          permitida: true,
          origem,
        });
    if (res.success && res.data) {
      onTransicaoAtualizada(res.data as TransicaoBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar origem da transição"));
    }
  }

  const outrasEtapas = todasEtapas.filter((e) => e.id !== etapa.id);

  return (
    <details
      className="group rounded-xl border border-white/5 bg-slate-800/40"
      open={aberto}
      onToggle={(e) => setAberto((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-slate-300">
        <span className="font-semibold">Configurações avançadas — {etapa.nome}</span>
        <span className="flex items-center gap-1.5">
          {etapa.ehInicial && (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Inicial</span>
          )}
          {etapa.ehFinal && (
            <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">Final</span>
          )}
        </span>
      </summary>

      <div className="space-y-4 border-t border-white/5 px-3 py-3">
        {/* Etapa inicial / final */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            <input
              type="radio"
              name={`etapa-inicial-${pipelineId}`}
              checked={etapa.ehInicial}
              onChange={() => void handleDefinirInicial()}
              aria-label={`Definir ${etapa.nome} como etapa inicial`}
            />
            Etapa inicial
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={etapa.ehFinal}
              onChange={(e) => void handleToggleFinal(e.target.checked)}
              aria-label={`Marcar ${etapa.nome} como etapa final`}
            />
            Etapa final
          </label>
        </div>

        {/* Substatus */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Substatus</p>
          {subStatus.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhum substatus cadastrado nesta etapa.</p>
          ) : (
            <div className="space-y-1.5">
              {subStatus.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2 py-1.5">
                  <input
                    type="color"
                    value={sub.cor ?? "#64748b"}
                    onChange={(e) => void handleAlterarCorSubStatus(sub, e.target.value)}
                    aria-label={`Cor do substatus ${sub.nome}`}
                    className="w-6 h-6 rounded border border-white/10 bg-transparent p-0"
                  />
                  <input
                    className={`${inputCls} flex-1`}
                    defaultValue={sub.nome}
                    onBlur={(e) => void handleRenomearSubStatus(sub, e.target.value)}
                    aria-label={`Nome do substatus ${sub.nome}`}
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={sub.ativo}
                      onChange={(e) => void handleToggleSubStatusAtivo(sub, e.target.checked)}
                      aria-label={`Ativar/desativar substatus ${sub.nome}`}
                    />
                    Ativo
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={novoSubStatusCor}
              onChange={(e) => setNovoSubStatusCor(e.target.value)}
              aria-label="Cor do novo substatus"
              className="w-6 h-6 rounded border border-white/10 bg-transparent p-0"
            />
            <input
              className={`${inputCls} flex-1`}
              placeholder="Nome do novo substatus"
              value={novoSubStatusNome}
              onChange={(e) => setNovoSubStatusNome(e.target.value)}
            />
            <button
              onClick={() => void handleCriarSubStatus()}
              disabled={criandoSubStatus || !novoSubStatusNome.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: `rgba(${accent},0.85)` }}
            >
              {criandoSubStatus ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Transições permitidas */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Transições permitidas a partir de &quot;{etapa.nome}&quot;
          </p>
          {outrasEtapas.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhuma outra etapa neste pipeline.</p>
          ) : (
            <div className="space-y-1.5">
              {outrasEtapas.map((destino) => {
                const transicao = transicaoPara(destino.id);
                const permitida = transicao ? transicao.permitida : true;
                const origemAtual = transicao?.origem ?? "AMBOS";
                return (
                  <div key={destino.id} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2 py-1.5">
                    <label className="flex flex-1 items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={permitida}
                        onChange={(e) => void handleToggleTransicao(destino.id, e.target.checked)}
                        aria-label={`Permitir mover de ${etapa.nome} para ${destino.nome}`}
                      />
                      {destino.nome}
                    </label>
                    <select
                      className={inputCls}
                      value={origemAtual}
                      disabled={!permitida}
                      onChange={(e) => void handleAlterarOrigemTransicao(destino.id, e.target.value as TransicaoBpm["origem"])}
                      aria-label={`Origem permitida para mover de ${etapa.nome} para ${destino.nome}`}
                    >
                      {ORIGENS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-slate-600">
            Sem uma regra explícita, a transição é permitida por padrão. Desmarcar cria um bloqueio explícito.
          </p>
        </div>
      </div>
    </details>
  );
}
