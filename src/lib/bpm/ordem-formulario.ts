import type { SecaoFormulario } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace";

export function itensFormulario(secoes: SecaoFormulario[]) {
  return secoes.flatMap((secao, s) => secao.componentes.map((componente, c) => ({
    componente, secao: s, indice: c,
    id: componente.id ?? componente.clientId ?? componente.campoId ?? `${secao.chave}:${componente.chave}`,
  })));
}

// Arrays are the publication contract: keep empty sections and all metadata.
export function moverItemFormulario(secoes: SecaoFormulario[], origem: string, destino: string) {
  const itens = itensFormulario(secoes);
  const de = itens.findIndex((item) => item.id === origem);
  const para = itens.findIndex((item) => item.id === destino);
  if (de < 0 || para < 0 || de === para) return { secoes };
  const a = itens[de], b = itens[para];
  if (a.secao !== b.secao) {
    const componentes = secoes[b.secao].componentes;
    if (componentes.some((item) => item.chave === a.componente.chave))
      return { secoes, erro: "Já existe uma chave igual na seção de destino. Renomeie a chave antes de mover." };
    if (componentes.length >= 100)
      return { secoes, erro: "A seção de destino atingiu 100 componentes. Remova um item antes de mover." };
  }
  const copia = secoes.map((secao) => ({ ...secao, componentes: [...secao.componentes] }));
  const [item] = copia[a.secao].componentes.splice(a.indice, 1);
  const indice = copia[b.secao].componentes.indexOf(b.componente) + (de < para ? 1 : 0);
  copia[b.secao].componentes.splice(indice, 0, { ...item, clientId: item.clientId ?? origem });
  return { secoes: copia };
}
