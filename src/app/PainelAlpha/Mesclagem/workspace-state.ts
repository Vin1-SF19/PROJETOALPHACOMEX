import type { AbaPlanilha, CampoMapeamento, InspecaoPlanilha } from "@/lib/mesclagem";

export function mesclarSugestoesPreservandoManuais(
  atual: CampoMapeamento[],
  sugerido: CampoMapeamento[],
): CampoMapeamento[] {
  const atuaisPorDestino = new Map(atual.map((campo) => [campo.destino, campo]));
  return sugerido.map((sugestao) => {
    const existente = atuaisPorDestino.get(sugestao.destino);
    return existente?.manual ? existente : sugestao;
  });
}

function normalizarNomeColuna(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");
}

export function reconciliarOverridesManuais(
  atual: CampoMapeamento[],
  novasColunas: AbaPlanilha["colunas"],
): { mapeamento: CampoMapeamento[]; descartados: string[] } {
  const colunasPorNome = new Map<string, AbaPlanilha["colunas"]>();
  for (const coluna of novasColunas) {
    const nome = normalizarNomeColuna(coluna.nome);
    colunasPorNome.set(nome, [...(colunasPorNome.get(nome) ?? []), coluna]);
  }

  const descartados: string[] = [];
  const mapeamento = atual.map((campo) => {
    if (!campo.manual || campo.origem === null) return campo;
    const candidatas = campo.origemNome ? colunasPorNome.get(normalizarNomeColuna(campo.origemNome)) ?? [] : [];
    if (candidatas.length === 1) {
      return { ...campo, origem: candidatas[0].numero, origemNome: candidatas[0].nome };
    }
    descartados.push(campo.destino);
    return { ...campo, origem: null, origemNome: null, automatico: false, manual: true };
  });
  return { mapeamento, descartados };
}

export function selecionarColunaCnpjDaAba(
  inspecao: InspecaoPlanilha,
  aba: AbaPlanilha,
): number {
  const porNome = aba.colunas.find((coluna) => coluna.nomeNormalizado.includes("cnpj"));
  if (porNome) return porNome.numero;

  const sugeridaValida = inspecao.colunasCnpjSugeridas.find((numero) =>
    aba.colunas.some((coluna) => coluna.numero === numero),
  );
  return sugeridaValida ?? aba.colunas[0]?.numero ?? 1;
}
