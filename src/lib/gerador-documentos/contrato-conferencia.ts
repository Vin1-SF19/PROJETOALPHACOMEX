import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";
import { renderizarConteudo } from "@/lib/gerador-documentos/render";

type Valores = Record<string, string | number | boolean | null | undefined>;

export function valoresContratoParaConferencia(definicoes: VariavelTemplate[], valores: Valores) {
  return Object.fromEntries(definicoes.map((definicao) => [
    definicao.nome,
    String(valores[definicao.nome] ?? "").trim() || `PENDENTE DE CONFERÊNCIA: ${definicao.label}`,
  ]));
}

/** Preserva cláusulas editadas pelo usuário ou pela IA ao completar variáveis. */
export function clausulasAtualizaveisContrato(params: {
  definicoes: VariavelTemplate[];
  anteriores: Valores;
  novos: Valores;
  clausulas: Array<{ id: string; conteudo: string; conteudoOriginal: string; reescritoPorIA: boolean }>;
}) {
  const antes = valoresContratoParaConferencia(params.definicoes, params.anteriores);
  const depois = valoresContratoParaConferencia(params.definicoes, params.novos);
  return params.clausulas.flatMap((clausula) => {
    if (clausula.reescritoPorIA || clausula.conteudo !== renderizarConteudo(clausula.conteudoOriginal, params.definicoes, antes)) return [];
    return [{ id: clausula.id, conteudo: renderizarConteudo(clausula.conteudoOriginal, params.definicoes, depois) }];
  });
}
