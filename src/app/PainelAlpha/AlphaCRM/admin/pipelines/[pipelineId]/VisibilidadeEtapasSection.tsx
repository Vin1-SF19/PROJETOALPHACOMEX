"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Save, ShieldCheck } from "lucide-react";

import {
  ListarConfiguracaoVisibilidadePipelineBpm,
  SalvarVisibilidadeEtapaBpm,
} from "@/actions/bpm/VisibilidadeEtapas";

type Etapa = { id: string; nome: string; ordem: number };
type Perfil = { perfil: string; nome: string };
type EstadoRegra = { podeVer: boolean; podeAgir: boolean };
type RegrasPorEtapa = Record<string, Record<string, EstadoRegra>>;

function mensagemErro(error: unknown, fallback: string): string {
  return typeof error === "string" ? error : fallback;
}

export function VisibilidadeEtapasSection({
  pipelineId,
  etapas,
  accent,
}: {
  pipelineId: string;
  etapas: Etapa[];
  accent: string;
}) {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [regras, setRegras] = useState<RegrasPorEtapa>({});
  const [carregando, setCarregando] = useState(true);
  const [salvandoEtapa, setSalvandoEtapa] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucessoEtapa, setSucessoEtapa] = useState<string | null>(null);
  const etapasKey = etapas.map((etapa) => etapa.id).join(",");

  const carregar = useCallback(async () => {
    const result = await ListarConfiguracaoVisibilidadePipelineBpm(pipelineId);
    if (!result.success || !result.data) {
      setErro(mensagemErro(result.error, "Erro ao carregar visibilidade"));
      setCarregando(false);
      return;
    }

    setPerfis(result.data.perfis);
    setRegras(
      Object.fromEntries(
        result.data.etapas.map((etapa) => [
          etapa.id,
          Object.fromEntries(
            etapa.visibilidades.map((regra) => [
              regra.perfil,
              { podeVer: regra.podeVer, podeAgir: regra.podeAgir },
            ]),
          ),
        ]),
      ),
    );
    setCarregando(false);
  }, [pipelineId]);

  useEffect(() => {
    // A Server Action sempre resolve de forma assíncrona; o estado só é
    // atualizado depois da resposta, não durante a execução do effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar, etapasKey]);

  function alterarRegra(
    etapaId: string,
    perfil: string,
    campo: keyof EstadoRegra,
    valor: boolean,
  ) {
    setSucessoEtapa(null);
    setRegras((atuais) => {
      const anterior = atuais[etapaId]?.[perfil] ?? {
        podeVer: false,
        podeAgir: false,
      };
      const proxima = {
        ...anterior,
        [campo]: valor,
        ...(campo === "podeVer" && !valor ? { podeAgir: false } : {}),
        ...(campo === "podeAgir" && valor ? { podeVer: true } : {}),
      };
      return {
        ...atuais,
        [etapaId]: { ...atuais[etapaId], [perfil]: proxima },
      };
    });
  }

  async function salvar(etapaId: string) {
    setSalvandoEtapa(etapaId);
    setErro(null);
    setSucessoEtapa(null);
    const regrasEtapa = regras[etapaId] ?? {};
    const result = await SalvarVisibilidadeEtapaBpm({
      etapaId,
      regras: perfis.flatMap(({ perfil }) => {
        const regra = regrasEtapa[perfil];
        return regra?.podeVer ? [{ perfil, ...regra }] : [];
      }),
    });
    setSalvandoEtapa(null);
    if (!result.success || !result.data) {
      setErro(mensagemErro(result.error, "Erro ao salvar visibilidade"));
      return;
    }
    setRegras((atuais) => ({
      ...atuais,
      [etapaId]: Object.fromEntries(
        result.data.map((regra) => [
          regra.perfil,
          { podeVer: regra.podeVer, podeAgir: regra.podeAgir },
        ]),
      ),
    }));
    setSucessoEtapa(etapaId);
  }

  return (
    <section className="space-y-3" aria-labelledby="visibilidade-etapas-titulo">
      <div>
        <h2
          id="visibilidade-etapas-titulo"
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white"
        >
          <ShieldCheck size={16} className="text-cyan-300" />
          Visibilidade por coluna
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Defina quais perfis podem ver e agir sobre cards em cada etapa do CRM/BPM.
          Sem perfil marcado, a etapa permanece sem restrição. Admin, CEO e TI sempre têm acesso.
        </p>
      </div>

      {erro && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-300" role="alert">
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => {
              setCarregando(true);
              setErro(null);
              void carregar();
            }}
            className="font-semibold underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-800/40 px-4 py-5 text-sm text-slate-400" role="status">
          <Loader2 size={16} className="animate-spin" /> Carregando perfis e regras…
        </div>
      ) : perfis.length === 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Nenhum perfil não administrativo ativo foi encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {etapas.map((etapa) => {
            const regrasEtapa = regras[etapa.id] ?? {};
            const selecionados = Object.values(regrasEtapa).filter(
              (regra) => regra.podeVer,
            ).length;
            const salvando = salvandoEtapa === etapa.id;
            return (
              <details key={etapa.id} className="group rounded-xl border border-white/5 bg-slate-800/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-white">
                  <span className="font-semibold">{etapa.nome}</span>
                  <span className={selecionados > 0 ? "text-cyan-300" : "text-emerald-300"}>
                    {selecionados > 0
                      ? `${selecionados} perfil${selecionados === 1 ? "" : "is"} autorizado${selecionados === 1 ? "" : "s"}`
                      : "Sem restrição"}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-white/5 px-4 py-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="pb-2 font-medium">Perfil</th>
                          <th className="pb-2 text-center font-medium">Pode visualizar</th>
                          <th className="pb-2 text-center font-medium">Pode agir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {perfis.map(({ perfil, nome }) => {
                          const regra = regrasEtapa[perfil] ?? {
                            podeVer: false,
                            podeAgir: false,
                          };
                          return (
                            <tr key={perfil}>
                              <td className="py-2 font-medium text-slate-200">{nome}</td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={regra.podeVer}
                                  onChange={(event) => alterarRegra(etapa.id, perfil, "podeVer", event.target.checked)}
                                  aria-label={`${nome} pode visualizar cards em ${etapa.nome}`}
                                  className="size-4 accent-cyan-400"
                                />
                              </td>
                              <td className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={regra.podeAgir}
                                  disabled={!regra.podeVer}
                                  onChange={(event) => alterarRegra(etapa.id, perfil, "podeAgir", event.target.checked)}
                                  aria-label={`${nome} pode agir em cards de ${etapa.nome}`}
                                  className="size-4 accent-cyan-400 disabled:opacity-40"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Eye size={13} /> Perfis não marcados não verão cards quando houver restrição.
                    </span>
                    <button
                      type="button"
                      onClick={() => void salvar(etapa.id)}
                      disabled={salvando}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: `rgba(${accent},0.85)` }}
                    >
                      {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {salvando ? "Salvando…" : "Salvar etapa"}
                    </button>
                  </div>
                  {sucessoEtapa === etapa.id && (
                    <p className="text-xs text-emerald-300" role="status">Configuração salva.</p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
