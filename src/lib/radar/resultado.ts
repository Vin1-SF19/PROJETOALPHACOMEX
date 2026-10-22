/** Ausência na publicação CSV não confirma a situação cadastral do RADAR. */
export function radarAusenteNaPublicacao(dados: Record<string, unknown>) {
  return dados.code === "NOT_FOUND" || (typeof dados.situacao === "string"
    && /^NÃO CONSTA(?: NO ARQUIVO CONSULTADO)?$/i.test(dados.situacao.trim()));
}

export function radarConfirmado(dados: Record<string, unknown> | null | undefined) {
  return !!dados && !radarAusenteNaPublicacao(dados) && !dados.error && !dados.code
    && typeof dados.situacao === "string" && dados.situacao.trim() !== ""
    && !["NÃO VERIFICADO NA PUBLICAÇÃO CSV", "CONSULTA CSV INDISPONÍVEL", "NÃO INFORMADO", "ERRO NA CONSULTA", "N/A", "N/D"]
      .includes(dados.situacao.trim().toLocaleUpperCase("pt-BR"));
}
