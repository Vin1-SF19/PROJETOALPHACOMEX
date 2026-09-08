export type EtapaPublicacao = {
  id: string;
  ordem: number;
  ativo: boolean;
  ehInicial: boolean;
  ehFinal: boolean;
};

export type TransicaoPublicacao = {
  id: string;
  etapaOrigemId: string;
  etapaDestinoId: string;
  permitida: boolean;
  origem: "MANUAL" | "AUTOMACAO" | "AMBOS";
};

export type CampoPublicacao = { id: string; ativo: boolean };

export type CampoAtualPublicacao = CampoPublicacao & {
  nome: string;
  tipo: string;
  fonteEntidade: string | null;
  fonteAtributo: string | null;
  opcoesJson: string | null;
  opcoes: Array<{ ativo: boolean }>;
};

export type SnapshotPublicacao = {
  etapas: EtapaPublicacao[];
  transicoes: TransicaoPublicacao[];
  campos: CampoPublicacao[];
};

function mesmosIds(atuais: readonly { id: string }[], recebidos: readonly { id: string }[]): boolean {
  if (atuais.length !== recebidos.length) return false;
  const ids = new Set(recebidos.map(({ id }) => id));
  return ids.size === recebidos.length && atuais.every(({ id }) => ids.has(id));
}

function possuiCatalogoLegado(valor: string | null): boolean {
  if (!valor) return false;
  try {
    const opcoes = JSON.parse(valor);
    return Array.isArray(opcoes) && opcoes.length > 0;
  } catch {
    return false;
  }
}

export function validarSnapshotPublicacao(params: {
  atual: { etapas: EtapaPublicacao[]; transicoes: TransicaoPublicacao[]; campos: CampoAtualPublicacao[] };
  proposto: SnapshotPublicacao;
}): string[] {
  const erros: string[] = [];
  if (!mesmosIds(params.atual.etapas, params.proposto.etapas)) erros.push("O rascunho não contém o conjunto atual completo de etapas.");
  if (!mesmosIds(params.atual.transicoes, params.proposto.transicoes)) erros.push("O rascunho não contém o conjunto atual completo de transições.");
  if (!mesmosIds(params.atual.campos, params.proposto.campos)) erros.push("O rascunho não contém o conjunto atual completo de campos.");
  if (erros.length) return erros;

  const etapasAtivas = params.proposto.etapas.filter((etapa) => etapa.ativo);
  const idsAtivos = new Set(etapasAtivas.map((etapa) => etapa.id));
  const iniciais = etapasAtivas.filter((etapa) => etapa.ehInicial);
  if (iniciais.length !== 1) erros.push("A publicação exige exatamente uma etapa inicial ativa.");
  if (!etapasAtivas.some((etapa) => etapa.ehFinal)) erros.push("A publicação exige ao menos uma etapa final ativa.");

  const ordens = etapasAtivas.map((etapa) => etapa.ordem);
  if (new Set(ordens).size !== ordens.length) erros.push("Etapas ativas não podem compartilhar a mesma ordem.");

  const pares = new Set<string>();
  for (const transicao of params.proposto.transicoes) {
    const atual = params.atual.transicoes.find((item) => item.id === transicao.id)!;
    if (atual.etapaOrigemId !== transicao.etapaOrigemId || atual.etapaDestinoId !== transicao.etapaDestinoId) {
      erros.push("A origem ou destino de uma transição não pode ser alterado pelo rascunho.");
      break;
    }
    const par = `${transicao.etapaOrigemId}:${transicao.etapaDestinoId}`;
    if (pares.has(par)) erros.push("O rascunho contém transição duplicada.");
    pares.add(par);
    if (transicao.permitida && (!idsAtivos.has(transicao.etapaOrigemId) || !idsAtivos.has(transicao.etapaDestinoId))) {
      erros.push("Transições permitidas só podem conectar etapas ativas.");
    }
  }

  if (iniciais.length === 1) {
    const visitadas = new Set([iniciais[0].id]);
    const fila = [iniciais[0].id];
    while (fila.length) {
      const origemId = fila.shift()!;
      for (const transicao of params.proposto.transicoes) {
        if (!transicao.permitida || transicao.etapaOrigemId !== origemId || !idsAtivos.has(transicao.etapaDestinoId) || visitadas.has(transicao.etapaDestinoId)) continue;
        visitadas.add(transicao.etapaDestinoId);
        fila.push(transicao.etapaDestinoId);
      }
    }
    if (etapasAtivas.some((etapa) => !visitadas.has(etapa.id))) erros.push("Todas as etapas ativas precisam ser alcançáveis a partir da etapa inicial.");
  }

  for (const campoProposto of params.proposto.campos) {
    if (!campoProposto.ativo) continue;
    const campo = params.atual.campos.find((item) => item.id === campoProposto.id)!;
    if (!["selecao", "multiselecao"].includes(campo.tipo.toLocaleLowerCase("pt-BR"))) continue;
    const possuiFonte = Boolean(campo.fonteEntidade && campo.fonteAtributo);
    const possuiCatalogo = campo.opcoes.some((opcao) => opcao.ativo) || possuiCatalogoLegado(campo.opcoesJson);
    if (!possuiFonte && !possuiCatalogo) erros.push(`O campo de seleção “${campo.nome}” precisa de fonte, catálogo ou deve ficar inativo.`);
  }

  return [...new Set(erros)];
}

export function resumirAlteracoesPublicacao(params: {
  atual: { etapas: EtapaPublicacao[]; transicoes: TransicaoPublicacao[]; campos: CampoAtualPublicacao[] };
  proposto: SnapshotPublicacao;
}) {
  const mudouEtapa = params.proposto.etapas.filter((item) => {
    const atual = params.atual.etapas.find((valor) => valor.id === item.id)!;
    return item.ordem !== atual.ordem || item.ativo !== atual.ativo || item.ehInicial !== atual.ehInicial || item.ehFinal !== atual.ehFinal;
  });
  const mudouTransicao = params.proposto.transicoes.filter((item) => {
    const atual = params.atual.transicoes.find((valor) => valor.id === item.id)!;
    return item.permitida !== atual.permitida || item.origem !== atual.origem;
  });
  const mudouCampo = params.proposto.campos.filter((item) => params.atual.campos.find((valor) => valor.id === item.id)!.ativo !== item.ativo);
  return {
    etapas: mudouEtapa.map(({ id }) => id),
    transicoes: mudouTransicao.map(({ id }) => id),
    campos: mudouCampo.map(({ id }) => id),
    total: mudouEtapa.length + mudouTransicao.length + mudouCampo.length,
  };
}
