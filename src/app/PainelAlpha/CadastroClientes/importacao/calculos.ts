import type {
  LinhaImportacaoPreview,
  LinhaSalvarImportacao,
  StatusLinhaImportacao,
  TipoImportacao,
  TotaisImportacao,
} from "@/lib/cs-nps/importacao-tipos";

export type SelecoesDestino = Record<string, number>;

export function obterClienteIdLinha(
  linha: LinhaImportacaoPreview,
  selecoes: SelecoesDestino,
): number | null {
  return selecoes[linha.id] ?? linha.clienteIdSugerido;
}

export function obterStatusLinha(
  linha: LinhaImportacaoPreview,
  selecoes: SelecoesDestino,
): StatusLinhaImportacao {
  if (linha.status === "invalida") return "invalida";
  if (obterClienteIdLinha(linha, selecoes) !== null) return "valida";
  return "ambigua";
}

export function calcularTotais(
  linhas: LinhaImportacaoPreview[],
  selecoes: SelecoesDestino,
): TotaisImportacao {
  const porTipo: Record<TipoImportacao, number> = { socios: 0, cs: 0, feedbacks: 0 };
  let validas = 0;
  let ambiguas = 0;
  let invalidas = 0;

  for (const linha of linhas) {
    porTipo[linha.tipo] += 1;
    const status = obterStatusLinha(linha, selecoes);
    if (status === "valida") validas += 1;
    if (status === "ambigua") ambiguas += 1;
    if (status === "invalida") invalidas += 1;
  }

  return { total: linhas.length, validas, ambiguas, invalidas, porTipo };
}

export function construirLinhasSalvar(
  linhas: LinhaImportacaoPreview[],
  selecoes: SelecoesDestino,
): LinhaSalvarImportacao[] {
  return linhas.flatMap((linha) => {
    const clienteId = obterClienteIdLinha(linha, selecoes);
    if (clienteId === null || obterStatusLinha(linha, selecoes) !== "valida") return [];
    return [{
      id: linha.id,
      tipo: linha.tipo,
      aba: linha.aba,
      numeroLinha: linha.numeroLinha,
      identificador: linha.identificador,
      dados: linha.dados,
      clienteId,
    }];
  });
}

