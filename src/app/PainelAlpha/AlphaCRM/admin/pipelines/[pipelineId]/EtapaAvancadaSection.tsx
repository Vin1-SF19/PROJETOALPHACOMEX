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

const inputCls =
  "bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

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
  const [novoSubStatusNome, setNovoSubStatusNome] = useState("");
  const [novoSubStatusCor, setNovoSubStatusCor] = useState("#64748b");
  const [criandoSubStatus, setCriandoSubStatus] = useState(false);
  const [operacao, setOperacao] = useState<string | null>(null);
  const [nomesRascunho, setNomesRascunho] = useState<Record<string, string>>(
    {},
  );
  const [coresRascunho, setCoresRascunho] = useState<Record<string, string>>(
    {},
  );

  async function handleDefinirInicial() {
    if (operacao) return;
    setOperacao("etapa-inicial");
    const res = await DefinirEtapaInicialBpm({ pipelineId, etapaId: etapa.id });
    if (res.success) {
      const patch: Record<string, Partial<EtapaAvancada>> = {
        [etapa.id]: { ehInicial: true },
      };
      for (const e of todasEtapas) {
        if (e.id !== etapa.id && e.ehInicial)
          patch[e.id] = { ehInicial: false };
      }
      onEtapasAtualizadas(patch);
      toast.success(`"${etapa.nome}" definida como etapa inicial`);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao definir etapa inicial"));
    }
    setOperacao(null);
  }

  async function handleToggleFinal(marcar: boolean) {
    if (operacao) return;
    setOperacao("etapa-final");
    const idsAtuais = todasEtapas
      .filter((e) => (e.id === etapa.id ? marcar : e.ehFinal))
      .map((e) => e.id);
    const res = await DefinirEtapasFinaisBpm({
      pipelineId,
      etapaIds: idsAtuais,
    });
    if (res.success) {
      onEtapasAtualizadas({ [etapa.id]: { ehFinal: marcar } });
      toast.success(
        marcar
          ? `"${etapa.nome}" marcada como etapa final`
          : `"${etapa.nome}" removida das etapas finais`,
      );
    } else {
      toast.error(mensagemErro(res.error, "Erro ao definir etapas finais"));
    }
    setOperacao(null);
  }

  async function handleCriarSubStatus() {
    if (!novoSubStatusNome.trim() || operacao) return;
    setOperacao("criar-substatus");
    setCriandoSubStatus(true);
    const res = await CriarSubStatusBpm({
      etapaId: etapa.id,
      nome: novoSubStatusNome.trim(),
      cor: novoSubStatusCor,
      ordem: subStatus.length,
    });
    setCriandoSubStatus(false);
    setOperacao(null);
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
      setNovoSubStatusNome("");
      toast.success("Substatus criado");
    } else {
      toast.error(mensagemErro(res.error, "Erro ao criar substatus"));
    }
  }

  async function handleToggleSubStatusAtivo(sub: SubStatusBpm, ativo: boolean) {
    if (operacao) return;
    setOperacao(`substatus:${sub.id}`);
    const res = await AtivarDesativarSubStatusBpm({
      subStatusId: sub.id,
      ativo,
    });
    if (res.success && "data" in res && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
    } else {
      toast.error(mensagemErro(res.error, "Erro ao atualizar substatus"));
    }
    setOperacao(null);
  }

  async function handleRenomearSubStatus(sub: SubStatusBpm, nome: string) {
    if (!nome.trim() || nome === sub.nome || operacao) {
      setNomesRascunho((atuais) => ({ ...atuais, [sub.id]: sub.nome }));
      return;
    }
    setOperacao(`substatus:${sub.id}`);
    const res = await AtualizarSubStatusBpm({
      subStatusId: sub.id,
      nome: nome.trim(),
    });
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
      setNomesRascunho((atuais) => ({
        ...atuais,
        [sub.id]: (res.data as SubStatusBpm).nome,
      }));
    } else {
      setNomesRascunho((atuais) => ({ ...atuais, [sub.id]: sub.nome }));
      toast.error(mensagemErro(res.error, "Erro ao renomear substatus"));
    }
    setOperacao(null);
  }

  async function handleAlterarCorSubStatus(sub: SubStatusBpm, cor: string) {
    if (cor === sub.cor || operacao) return;
    setOperacao(`substatus:${sub.id}`);
    const res = await AtualizarSubStatusBpm({ subStatusId: sub.id, cor });
    if (res.success && res.data) {
      onSubStatusAtualizado(res.data as SubStatusBpm);
      setCoresRascunho((atuais) => ({
        ...atuais,
        [sub.id]: (res.data as SubStatusBpm).cor ?? "#64748b",
      }));
    } else {
      setCoresRascunho((atuais) => ({
        ...atuais,
        [sub.id]: sub.cor ?? "#64748b",
      }));
      toast.error(
        mensagemErro(res.error, "Erro ao atualizar cor do substatus"),
      );
    }
    setOperacao(null);
  }

  function transicaoPara(destinoId: string) {
    return (
      transicoes.find(
        (t) => t.etapaOrigemId === etapa.id && t.etapaDestinoId === destinoId,
      ) ?? null
    );
  }

  async function handleToggleTransicao(destinoId: string, permitida: boolean) {
    if (operacao) return;
    setOperacao(`transicao:${destinoId}`);
    const existente = transicaoPara(destinoId);
    const res = existente
      ? await AtualizarTransicaoEtapaBpm({
          transicaoId: existente.id,
          permitida,
        })
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
    setOperacao(null);
  }

  async function handleAlterarOrigemTransicao(
    destinoId: string,
    origem: TransicaoBpm["origem"],
  ) {
    if (operacao) return;
    setOperacao(`transicao:${destinoId}`);
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
      toast.error(
        mensagemErro(res.error, "Erro ao atualizar origem da transição"),
      );
    }
    setOperacao(null);
  }

  const outrasEtapas = todasEtapas.filter((e) => e.id !== etapa.id);

  return (
    <div className="space-y-5">
      {/* Etapa inicial / final */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="radio"
            name={`etapa-inicial-${pipelineId}`}
            checked={etapa.ehInicial}
            disabled={Boolean(operacao)}
            onChange={() => void handleDefinirInicial()}
            aria-label={`Definir ${etapa.nome} como etapa inicial`}
          />
          Etapa inicial
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={etapa.ehFinal}
            disabled={Boolean(operacao)}
            onChange={(e) => void handleToggleFinal(e.target.checked)}
            aria-label={`Marcar ${etapa.nome} como etapa final`}
          />
          Etapa final
        </label>
      </div>

      {/* Substatus */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Substatus
        </p>
        {subStatus.length === 0 ? (
          <p className="text-xs text-slate-600">
            Nenhum substatus cadastrado nesta etapa.
          </p>
        ) : (
          <div className="space-y-1.5">
            {subStatus.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2 py-1.5"
              >
                <input
                  type="color"
                  value={coresRascunho[sub.id] ?? sub.cor ?? "#64748b"}
                  disabled={Boolean(operacao)}
                  onChange={(e) =>
                    setCoresRascunho((atuais) => ({
                      ...atuais,
                      [sub.id]: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    void handleAlterarCorSubStatus(sub, e.target.value)
                  }
                  aria-label={`Cor do substatus ${sub.nome}`}
                  className="w-6 h-6 rounded border border-white/10 bg-transparent p-0"
                />
                <input
                  className={`${inputCls} flex-1`}
                  value={nomesRascunho[sub.id] ?? sub.nome}
                  disabled={Boolean(operacao)}
                  onChange={(e) =>
                    setNomesRascunho((atuais) => ({
                      ...atuais,
                      [sub.id]: e.target.value,
                    }))
                  }
                  onBlur={(e) =>
                    void handleRenomearSubStatus(sub, e.target.value)
                  }
                  aria-label={`Nome do substatus ${sub.nome}`}
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={sub.ativo}
                    disabled={Boolean(operacao)}
                    onChange={(e) =>
                      void handleToggleSubStatusAtivo(sub, e.target.checked)
                    }
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
            disabled={Boolean(operacao)}
            onChange={(e) => setNovoSubStatusCor(e.target.value)}
            aria-label="Cor do novo substatus"
            className="w-6 h-6 rounded border border-white/10 bg-transparent p-0"
          />
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nome do novo substatus"
            value={novoSubStatusNome}
            disabled={Boolean(operacao)}
            onChange={(e) => setNovoSubStatusNome(e.target.value)}
          />
          <button
            onClick={() => void handleCriarSubStatus()}
            disabled={
              Boolean(operacao) || criandoSubStatus || !novoSubStatusNome.trim()
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: `rgba(${accent},0.85)` }}
          >
            {criandoSubStatus ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={13} />
            )}
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
          <p className="text-xs text-slate-600">
            Nenhuma outra etapa neste pipeline.
          </p>
        ) : (
          <div className="space-y-1.5">
            {outrasEtapas.map((destino) => {
              const transicao = transicaoPara(destino.id);
              const permitida = transicao?.permitida === true;
              const origemAtual = transicao?.origem ?? "AMBOS";
              return (
                <div
                  key={destino.id}
                  className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2 py-1.5"
                >
                  <label className="flex flex-1 items-center gap-1.5 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={permitida}
                      disabled={Boolean(operacao)}
                      onChange={(e) =>
                        void handleToggleTransicao(destino.id, e.target.checked)
                      }
                      aria-label={`Permitir mover de ${etapa.nome} para ${destino.nome}`}
                    />
                    {destino.nome}
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
                        !transicao
                          ? "bg-slate-700 text-slate-300"
                          : permitida
                            ? "bg-emerald-400/10 text-emerald-200"
                            : "bg-rose-400/10 text-rose-200"
                      }`}
                    >
                      {!transicao
                        ? "Não configurada"
                        : permitida
                          ? "Permitida"
                          : "Bloqueada"}
                    </span>
                  </label>
                  <select
                    className={inputCls}
                    value={origemAtual}
                    disabled={!permitida || Boolean(operacao)}
                    onChange={(e) =>
                      void handleAlterarOrigemTransicao(
                        destino.id,
                        e.target.value as TransicaoBpm["origem"],
                      )
                    }
                    aria-label={`Origem permitida para mover de ${etapa.nome} para ${destino.nome}`}
                  >
                    {ORIGENS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-slate-600">
          Ausência de regra explícita bloqueia a transição no runtime. Novas
          etapas já nascem com bloqueios explícitos.
        </p>
      </div>
    </div>
  );
}
