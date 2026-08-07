/**
 * `fast-xml-parser` (modo normal, usado no resto deste módulo) agrupa filhos repetidos pelo
 * nome da tag — `<p:spTree>` com [grpSp, grpSp, sp, sp] no XML original vira 2 arrays
 * SEPARADOS (`spTree["p:grpSp"]` com 2 itens, `spTree["p:sp"]` com 2 itens), perdendo a ordem
 * RELATIVA entre tipos diferentes intercalados. Isso quebra z-index de verdade (confirmado com
 * arquivo real: um slide tinha 14 `<p:grpSp>` seguidos de 52 `<p:sp>` no XML — processar todos
 * os `sp` ANTES dos grupos inverte a profundidade visual) e quebra a SEQUÊNCIA de comandos
 * dentro de `<a:pathLst><a:path>` de um jeito ainda mais grave (moveTo/lnTo/cubicBezTo fora de
 * ordem literalmente desenha uma forma errada, não só posicionada errado).
 *
 * Reescrever pra `preserveOrder: true` exigiria trocar como TODO o resto do módulo lê XML. Em
 * vez disso, este scanner faz uma varredura leve do texto XML CRU (só pras tags que importam
 * pra ordem visual), guardando também os offsets de início/fim de cada nó — permite tanto
 * "zipar" os arrays já parseados na sequência certa (z-index) quanto extrair o XML cru de UM
 * shape específico pra reprocessar seu path com um scanner sequencial dedicado.
 */

export type TagFilhoOrdem = "p:sp" | "p:pic" | "p:grpSp" | "p:graphicFrame" | "p:cxnSp";

export interface NoOrdem {
  tag: TagFilhoOrdem;
  /** Offset (no texto XML cru original) do início da tag de abertura. */
  inicio: number;
  /** Offset logo após a tag de fechamento (ou o próprio fim, se auto-fechada). */
  fim: number;
  filhos: NoOrdem[];
}

const REGEX_TOKEN = /<(\/?)(p:sp|p:pic|p:grpSp|p:graphicFrame|p:cxnSp)\b[^>]*?(\/?)>/g;

/**
 * Constrói a árvore de ordem real a partir do XML cru de 1 slide — devolve a lista de filhos
 * diretos de `<p:spTree>`; cada nó `p:grpSp` já vem com sua PRÓPRIA lista de filhos (recursivo).
 */
export function construirArvoreOrdem(xmlCru: string): NoOrdem[] {
  const raiz: NoOrdem[] = [];
  const pilha: { lista: NoOrdem[]; no: NoOrdem | null }[] = [{ lista: raiz, no: null }];
  REGEX_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = REGEX_TOKEN.exec(xmlCru))) {
    const [textoCompleto, barra, tagBruta, autoFechamento] = match;
    const tag = tagBruta as TagFilhoOrdem;
    const inicioMatch = match.index;
    const fimMatch = inicioMatch + textoCompleto.length;

    if (barra === "/") {
      // Fecha o nível atual — se a pilha só tem a raiz, é uma tag de fechamento sem abertura
      // rastreada (XML incomum ou o regex perdeu algo) — ignora em vez de estourar índice.
      if (pilha.length > 1) {
        const topo = pilha.pop()!;
        if (topo.no) topo.no.fim = fimMatch;
      }
      continue;
    }

    const no: NoOrdem = { tag, inicio: inicioMatch, fim: fimMatch, filhos: [] };
    pilha[pilha.length - 1].lista.push(no);
    if (autoFechamento !== "/") pilha.push({ lista: no.filhos, no });
  }

  return raiz;
}

/** Fatia o XML cru original usando os offsets de um nó — dá o XML completo daquele elemento
 * (incluindo filhos), útil pra reprocessar algo específico (ex.: `<a:pathLst>` de 1 shape) sem
 * depender da árvore já reagrupada por tipo do `fast-xml-parser`. */
export function xmlDoNo(xmlCru: string, no: NoOrdem): string {
  return xmlCru.slice(no.inicio, no.fim);
}

/**
 * Consome a árvore de ordem em paralelo aos arrays já parseados por tipo (via `fast-xml-parser`
 * normal) — pra cada tipo, mantém um índice de quantos já foram "usados", devolvendo sempre o
 * PRÓXIMO item daquele tipo (que preserva ordem DENTRO do mesmo tipo corretamente — só a ordem
 * ENTRE tipos que se perde, e é isso que este módulo repara).
 */
export class ConsumidorPorTipo<T> {
  private indices = new Map<TagFilhoOrdem, number>();

  constructor(private listas: Partial<Record<TagFilhoOrdem, T[]>>) {}

  proximo(tag: TagFilhoOrdem): T | undefined {
    const lista = this.listas[tag];
    if (!lista) return undefined;
    const indiceAtual = this.indices.get(tag) ?? 0;
    this.indices.set(tag, indiceAtual + 1);
    return lista[indiceAtual];
  }
}
