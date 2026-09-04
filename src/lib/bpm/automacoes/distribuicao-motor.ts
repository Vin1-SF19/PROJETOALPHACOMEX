import type { GrupoCondicao } from "@/lib/bpm/regras/types";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import type { ContextoAvaliacao } from "@/lib/bpm/regras/types";

export type EstrategiaDistribuicao =
  | "RESPONSAVEL_FIXO"
  | "ROUND_ROBIN"
  | "MENOR_CARGA";

export type CandidatoDistribuicao = {
  id: number;
  nome: string;
  ativo: boolean;
  elegivel: boolean;
  cargaCards: number;
  cargaTarefas: number;
  motivoExclusao?: string;
};

export type ResultadoSelecaoDistribuicao = {
  aplicado: boolean;
  selecionadoId: number | null;
  candidatos: CandidatoDistribuicao[];
  motivo: string;
};

export function condicaoDistribuicaoAtendida(
  condicao: GrupoCondicao | null | undefined,
  contexto: ContextoAvaliacao,
): boolean {
  return condicao ? avaliarGrupo(condicao, contexto) : true;
}

export function selecionarResponsavelDistribuicao(params: {
  estrategia: EstrategiaDistribuicao;
  candidatos: CandidatoDistribuicao[];
  responsavelFixoId?: number | null;
  cursor?: number;
}): ResultadoSelecaoDistribuicao {
  const elegiveis = params.candidatos
    .filter((candidato) => candidato.ativo && candidato.elegivel)
    .sort((a, b) => a.id - b.id);

  if (elegiveis.length === 0) {
    return {
      aplicado: false,
      selecionadoId: null,
      candidatos: params.candidatos,
      motivo: "Nenhum candidato elegível no momento",
    };
  }

  if (params.estrategia === "RESPONSAVEL_FIXO") {
    const fixo = elegiveis.find((item) => item.id === params.responsavelFixoId);
    return fixo
      ? {
          aplicado: true,
          selecionadoId: fixo.id,
          candidatos: params.candidatos,
          motivo: `Responsável fixo selecionado: ${fixo.nome}`,
        }
      : {
          aplicado: false,
          selecionadoId: null,
          candidatos: params.candidatos,
          motivo: "Responsável fixo indisponível ou sem permissão",
        };
  }

  if (params.estrategia === "ROUND_ROBIN") {
    const indice = Math.max(0, params.cursor ?? 0) % elegiveis.length;
    const selecionado = elegiveis[indice];
    return {
      aplicado: true,
      selecionadoId: selecionado.id,
      candidatos: params.candidatos,
      motivo: `Round-robin: posição ${indice + 1} de ${elegiveis.length}`,
    };
  }

  const selecionado = [...elegiveis].sort((a, b) => {
    const cargaA = a.cargaCards + a.cargaTarefas;
    const cargaB = b.cargaCards + b.cargaTarefas;
    return cargaA - cargaB || a.id - b.id;
  })[0];
  return {
    aplicado: true,
    selecionadoId: selecionado.id,
    candidatos: params.candidatos,
    motivo: `Menor carga atual: ${selecionado.cargaCards} card(s) e ${selecionado.cargaTarefas} tarefa(s) pendente(s)`,
  };
}
