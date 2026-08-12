import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

export const NOME_ETAPA_EM_TRATATIVA = "Em Tratativa";
export const PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP =
  "Anotações sobre o último follow-up";
export const ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP =
  "anotacoes-ultimo-follow-up";

const ETAPAS_EXIGEM_PROXIMO_CONTATO = [
  NOME_ETAPA_EM_TRATATIVA,
  "Sem Viabilidade",
].map(normalizarNomeEtapa);

export type TipoPerguntaFollowUp = "texto" | "selecao" | "booleano";

export type PerguntaFollowUpSnapshot = {
  id: string;
  pergunta: string;
  tipo: TipoPerguntaFollowUp;
  opcoes: string[];
  obrigatoria: boolean;
  ordem: number;
};

export type RespostaFollowUp = string | boolean;
export type RespostasFollowUp = Record<string, RespostaFollowUp>;

export type PerguntaFollowUpConfigurada = {
  id: string;
  pergunta: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatoria: boolean;
  ordem: number;
};

export type EstadoFollowUp = "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";

function normalizarPergunta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function validarTipoPergunta(tipo: string): TipoPerguntaFollowUp {
  if (tipo === "texto" || tipo === "selecao" || tipo === "booleano") {
    return tipo;
  }
  throw new Error(`Tipo de pergunta de follow-up inválido: ${tipo}`);
}

function lerOpcoesPergunta(
  tipo: TipoPerguntaFollowUp,
  opcoesJson: string | null,
): string[] {
  if (tipo !== "selecao") return [];
  if (!opcoesJson) {
    throw new Error("Pergunta de seleção sem opções configuradas");
  }

  let opcoes: unknown;
  try {
    opcoes = JSON.parse(opcoesJson);
  } catch {
    throw new Error("Opções do checklist de follow-up estão inválidas");
  }

  if (
    !Array.isArray(opcoes)
    || opcoes.length === 0
    || !opcoes.every((opcao) => typeof opcao === "string" && opcao.trim().length > 0)
  ) {
    throw new Error("Opções do checklist de follow-up estão inválidas");
  }

  return Array.from(new Set(opcoes.map((opcao) => opcao.trim())));
}

export function montarSnapshotPerguntasFollowUp(
  configuradas: PerguntaFollowUpConfigurada[],
): PerguntaFollowUpSnapshot[] {
  const fallback: PerguntaFollowUpSnapshot = {
    id: ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP,
    pergunta: PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP,
    tipo: "texto",
    opcoes: [],
    obrigatoria: true,
    ordem: 0,
  };
  const perguntaFallbackNormalizada = normalizarPergunta(fallback.pergunta);

  const adicionais = [...configuradas]
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
    .filter(
      (pergunta) => normalizarPergunta(pergunta.pergunta) !== perguntaFallbackNormalizada,
    )
    .map((pergunta, index): PerguntaFollowUpSnapshot => {
      const tipo = validarTipoPergunta(pergunta.tipo);
      return {
        id: pergunta.id,
        pergunta: pergunta.pergunta.trim(),
        tipo,
        opcoes: lerOpcoesPergunta(tipo, pergunta.opcoesJson),
        obrigatoria: pergunta.obrigatoria,
        ordem: index + 1,
      };
    });

  return [fallback, ...adicionais];
}

export function lerSnapshotPerguntasFollowUp(
  valor: string,
): PerguntaFollowUpSnapshot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(valor);
  } catch {
    throw new Error("O snapshot do checklist de follow-up está inválido");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("O snapshot do checklist de follow-up está inválido");
  }

  return parsed.map((item): PerguntaFollowUpSnapshot => {
    if (!item || typeof item !== "object") {
      throw new Error("O snapshot do checklist de follow-up está inválido");
    }
    const pergunta = item as Record<string, unknown>;
    if (
      typeof pergunta.id !== "string"
      || typeof pergunta.pergunta !== "string"
      || typeof pergunta.tipo !== "string"
      || typeof pergunta.obrigatoria !== "boolean"
      || typeof pergunta.ordem !== "number"
      || !Array.isArray(pergunta.opcoes)
      || !pergunta.opcoes.every((opcao) => typeof opcao === "string")
    ) {
      throw new Error("O snapshot do checklist de follow-up está inválido");
    }
    return {
      id: pergunta.id,
      pergunta: pergunta.pergunta,
      tipo: validarTipoPergunta(pergunta.tipo),
      opcoes: pergunta.opcoes,
      obrigatoria: pergunta.obrigatoria,
      ordem: pergunta.ordem,
    };
  });
}

export function lerRespostasFollowUp(valor: string): RespostasFollowUp {
  let parsed: unknown;
  try {
    parsed = JSON.parse(valor);
  } catch {
    throw new Error("As respostas do checklist de follow-up estão inválidas");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("As respostas do checklist de follow-up estão inválidas");
  }
  const respostas: RespostasFollowUp = {};
  for (const [id, resposta] of Object.entries(parsed)) {
    if (typeof resposta !== "string" && typeof resposta !== "boolean") {
      throw new Error("As respostas do checklist de follow-up estão inválidas");
    }
    respostas[id] = resposta;
  }
  return respostas;
}

export function validarRespostasFollowUp(
  perguntas: PerguntaFollowUpSnapshot[],
  respostas: RespostasFollowUp,
): { respostas: RespostasFollowUp; pendencias: string[] } {
  const idsConhecidos = new Set(perguntas.map((pergunta) => pergunta.id));
  const idsDesconhecidos = Object.keys(respostas).filter((id) => !idsConhecidos.has(id));
  if (idsDesconhecidos.length > 0) {
    throw new Error("O checklist contém respostas para perguntas desconhecidas");
  }

  const respostasValidadas: RespostasFollowUp = {};
  const pendencias: string[] = [];

  for (const pergunta of perguntas) {
    const resposta = respostas[pergunta.id];

    if (resposta === undefined) {
      if (pergunta.obrigatoria) pendencias.push(pergunta.pergunta);
      continue;
    }

    if (pergunta.tipo === "booleano") {
      if (typeof resposta !== "boolean") {
        throw new Error(`A resposta de "${pergunta.pergunta}" deve ser booleana`);
      }
      respostasValidadas[pergunta.id] = resposta;
      continue;
    }

    if (typeof resposta !== "string") {
      throw new Error(`A resposta de "${pergunta.pergunta}" deve ser texto`);
    }

    const valor = resposta.trim();
    if (pergunta.tipo === "selecao" && valor && !pergunta.opcoes.includes(valor)) {
      throw new Error(`A resposta de "${pergunta.pergunta}" não é uma opção válida`);
    }
    if (pergunta.obrigatoria && !valor) pendencias.push(pergunta.pergunta);
    respostasValidadas[pergunta.id] = valor;
  }

  return { respostas: respostasValidadas, pendencias };
}

export function obterEstadoFollowUp(
  checklist: { completo: boolean } | null | undefined,
): EstadoFollowUp {
  if (!checklist) return "NAO_INICIADO";
  return checklist.completo ? "CONCLUIDO" : "EM_ANDAMENTO";
}

export function etapaEhEmTratativa(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_EM_TRATATIVA);
}

export function obterErroProximoContatoParaEntrada(params: {
  etapaDestinoNome: string;
  proximoContatoEm: Date | string | null | undefined;
}): string | null {
  if (
    !ETAPAS_EXIGEM_PROXIMO_CONTATO.includes(
      normalizarNomeEtapa(params.etapaDestinoNome),
    )
  ) {
    return null;
  }

  if (params.proximoContatoEm) {
    const data = params.proximoContatoEm instanceof Date
      ? params.proximoContatoEm
      : new Date(params.proximoContatoEm);
    if (!Number.isNaN(data.getTime())) return null;
  }

  return `Não é possível avançar para "${params.etapaDestinoNome}": o campo "Próximo Contato" precisa estar preenchido.`;
}

export function obterErroChecklistParaSaidaEmTratativa(params: {
  etapaOrigemNome: string;
  ultimoChecklist: { completo: boolean } | null | undefined;
}): string | null {
  if (!etapaEhEmTratativa(params.etapaOrigemNome)) return null;
  if (!params.ultimoChecklist || params.ultimoChecklist.completo) return null;

  return "Não é possível sair de Em Tratativa: conclua as anotações e o checklist do último follow-up.";
}
