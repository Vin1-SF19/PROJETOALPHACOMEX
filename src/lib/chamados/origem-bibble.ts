export const MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE = "[Aberto via Bibble]";

export type OrigemBibbleDaDescricao = {
  abertoViaBibble: boolean;
  descricaoLimpa: string;
};

const MARCADOR_ESCAPADO = MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE.replace(
  /[.*+?^${}()|[\]\\]/g,
  "\\$&",
);
const MARCADOR_NO_TOPO = new RegExp(`^\\s*${MARCADOR_ESCAPADO}\\s*`);

/**
 * Mantém o marcador de origem como metadado textual compatível com chamados
 * já persistidos, sem permitir que ele seja duplicado por tentativas repetidas.
 */
export function marcarDescricaoComoAbertaViaBibble(descricao: string): string {
  const descricaoLimpa = descricao
    .replaceAll(MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE, "")
    .trim();

  return descricaoLimpa
    ? `${MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE}\n\n${descricaoLimpa}`
    : MARCADOR_CHAMADO_ABERTO_VIA_BIBBLE;
}

/**
 * Interpreta o marcador somente quando ele está no início (aceitando espaços
 * e quebras de linha antes dele) e devolve a ocorrência pronta para exibição.
 */
export function separarOrigemBibbleDaDescricao(
  descricao: string | null | undefined,
): OrigemBibbleDaDescricao {
  let descricaoLimpa = descricao ?? "";
  let abertoViaBibble = false;

  while (MARCADOR_NO_TOPO.test(descricaoLimpa)) {
    abertoViaBibble = true;
    descricaoLimpa = descricaoLimpa.replace(MARCADOR_NO_TOPO, "");
  }

  return {
    abertoViaBibble,
    descricaoLimpa: descricaoLimpa.trim(),
  };
}
