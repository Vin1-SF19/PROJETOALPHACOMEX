import {
  ErroRegra, LIMITES_REGRAS, type CampoReferencia, type CondicaoFolha,
  type ContextoAvaliacao, type GrupoCondicao, type RegraBpm,
  type ResultadoAvaliacao, type TabelaDecisao, type TipoValor, type ValorRegra,
} from "./types";
import { campoReferenciaSchema, regraBpmSchema } from "./schemas";

export function resolverCampo(ref: CampoReferencia, contexto: ContextoAvaliacao): unknown {
  if (ref.fonte === "campo_dinamico") return contexto.camposDinamicos?.[ref.campo];
  return contexto[ref.fonte]?.[ref.campo];
}

export type ValorCoercido =
  | { tipo: "nulo" }
  | { tipo: "texto"; valor: string }
  | { tipo: "numero"; valor: number }
  | { tipo: "booleano"; valor: boolean }
  | { tipo: "lista"; valor: unknown[] }
  | { tipo: "data"; valor: number };

function dataDeterministica(valor: unknown): number | null {
  if (valor instanceof Date) return Number.isFinite(valor.getTime()) ? valor.getTime() : null;
  if (typeof valor === "number" && Number.isFinite(valor)) return Number.isFinite(new Date(valor).getTime()) ? valor : null;
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const instante = Date.parse(`${texto}T00:00:00.000Z`);
    return new Date(instante).toISOString().startsWith(texto) ? instante : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(texto)) return null;
  const instante = Date.parse(texto);
  return Number.isFinite(instante) ? instante : null;
}

export function coercarValor(valor: unknown, tipoEsperado: TipoValor): ValorCoercido {
  if (valor === undefined || valor === null) return { tipo: "nulo" };
  if (tipoEsperado === "nulo") return { tipo: "nulo" };
  if (tipoEsperado === "texto") {
    if (typeof valor === "string") return { tipo: "texto", valor };
    if (typeof valor === "number" && Number.isFinite(valor) || typeof valor === "boolean") return { tipo: "texto", valor: String(valor) };
    return { tipo: "nulo" };
  }
  if (tipoEsperado === "numero") {
    if (typeof valor === "number" && Number.isFinite(valor)) return { tipo: "numero", valor };
    if (typeof valor === "string" && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(valor.trim())) return { tipo: "numero", valor: Number(valor) };
    return { tipo: "nulo" };
  }
  if (tipoEsperado === "booleano") {
    if (typeof valor === "boolean") return { tipo: "booleano", valor };
    if (typeof valor === "string") {
      const normalizado = valor.trim().toLocaleLowerCase("pt-BR");
      if (["true", "1", "sim"].includes(normalizado)) return { tipo: "booleano", valor: true };
      if (["false", "0", "nao", "não"].includes(normalizado)) return { tipo: "booleano", valor: false };
    }
    return { tipo: "nulo" };
  }
  if (tipoEsperado === "lista") return Array.isArray(valor) ? { tipo: "lista", valor } : { tipo: "nulo" };
  const instante = dataDeterministica(valor);
  return instante === null ? { tipo: "nulo" } : { tipo: "data", valor: instante };
}

function inferirTipo(valor: unknown): TipoValor {
  if (valor === null || valor === undefined) return "nulo";
  if (Array.isArray(valor)) return "lista";
  if (valor instanceof Date) return "data";
  if (typeof valor === "number") return "numero";
  if (typeof valor === "boolean") return "booleano";
  return "texto";
}
function vazio(valor: unknown): boolean {
  return valor === undefined || valor === null || typeof valor === "string" && valor.trim() === "" || Array.isArray(valor) && valor.length === 0;
}
function exigirCoercao(valor: unknown, tipo: TipoValor, papel: string): ValorCoercido {
  const coerced = coercarValor(valor, tipo);
  if (coerced.tipo === "nulo" && tipo !== "nulo") throw new ErroRegra(`${papel} incompatível com o tipo ${tipo}`, "TIPO_INCOMPATIVEL");
  return coerced;
}
function iguais(a: ValorCoercido, b: ValorCoercido): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === "nulo") return true;
  if (a.tipo === "lista" && b.tipo === "lista") return JSON.stringify(a.valor) === JSON.stringify(b.valor);
  if (a.tipo === "texto" && b.tipo === "texto") return a.valor === b.valor;
  if (a.tipo === "numero" && b.tipo === "numero") return a.valor === b.valor;
  if (a.tipo === "booleano" && b.tipo === "booleano") return a.valor === b.valor;
  return a.tipo === "data" && b.tipo === "data" && a.valor === b.valor;
}
function comparar(a: ValorCoercido, b: ValorCoercido): number {
  if (a.tipo === "numero" && b.tipo === "numero" || a.tipo === "data" && b.tipo === "data") return a.valor - b.valor;
  throw new ErroRegra("Operador de ordem exige números ou datas compatíveis", "TIPO_INCOMPATIVEL");
}

export function avaliarCondicao(condicao: CondicaoFolha, contexto: ContextoAvaliacao): boolean {
  const bruto = resolverCampo(condicao.campo, contexto);
  if (condicao.operador === "vazio") return vazio(bruto);
  if (condicao.operador === "preenchido") return !vazio(bruto);
  if (bruto === undefined) throw new ErroRegra(`Campo inexistente: ${condicao.campo.fonte}:${condicao.campo.campo}`, "CAMPO_INEXISTENTE");

  const tipo: TipoValor = condicao.operador === "dataAntes" || condicao.operador === "dataDepois" ? "data" : condicao.tipoEsperado ?? inferirTipo(bruto);
  const atual = exigirCoercao(bruto, tipo, "Valor do campo");

  if (condicao.operador === "contem" || condicao.operador === "naoContem") {
    let contem = false;
    if (atual.tipo === "texto") contem = atual.valor.toLocaleLowerCase("pt-BR").includes(String(condicao.valor).toLocaleLowerCase("pt-BR"));
    else if (atual.tipo === "lista") contem = atual.valor.some((item) => item === condicao.valor);
    else throw new ErroRegra("Operador contém exige texto ou lista", "TIPO_INCOMPATIVEL");
    return condicao.operador === "contem" ? contem : !contem;
  }
  if (condicao.operador === "estaEm" || condicao.operador === "naoEstaEm") {
    if (!Array.isArray(condicao.valor)) throw new ErroRegra("Operador está em exige lista", "TIPO_INCOMPATIVEL");
    const encontrado = condicao.valor.some((item) => iguais(atual, exigirCoercao(item, tipo, "Item da lista")));
    return condicao.operador === "estaEm" ? encontrado : !encontrado;
  }
  const esperado = exigirCoercao(condicao.valor, tipo, "Valor de comparação");

  switch (condicao.operador) {
    case "igual": return iguais(atual, esperado);
    case "diferente": return !iguais(atual, esperado);
    case "maior": return comparar(atual, esperado) > 0;
    case "menor": return comparar(atual, esperado) < 0;
    case "maiorOuIgual": return comparar(atual, esperado) >= 0;
    case "menorOuIgual": return comparar(atual, esperado) <= 0;
    case "dataAntes": return comparar(atual, esperado) < 0;
    case "dataDepois": return comparar(atual, esperado) > 0;
    default: throw new ErroRegra("Operador inválido", "OPERADOR_INVALIDO");
  }
}

function folha(item: CondicaoFolha | GrupoCondicao): item is CondicaoFolha { return "tipo" in item; }
export function avaliarGrupo(grupo: GrupoCondicao, contexto: ContextoAvaliacao): boolean {
  if (grupo.condicoes.length === 0) throw new ErroRegra("Grupo vazio", "GRUPO_VAZIO");
  const avaliar = (item: CondicaoFolha | GrupoCondicao) => folha(item) ? avaliarCondicao(item, contexto) : avaliarGrupo(item, contexto);
  return grupo.operador === "AND" ? grupo.condicoes.every(avaliar) : grupo.condicoes.some(avaliar);
}

function estatisticas(item: CondicaoFolha | GrupoCondicao, nivel = 0): { folhas: number; profundidade: number } {
  if (folha(item)) return { folhas: 1, profundidade: nivel };
  return item.condicoes.reduce((total, filho) => {
    const atual = estatisticas(filho, nivel + 1);
    return { folhas: total.folhas + atual.folhas, profundidade: Math.max(total.profundidade, atual.profundidade) };
  }, { folhas: 0, profundidade: nivel });
}
export function validarLimites(grupo: GrupoCondicao): void {
  const { folhas, profundidade } = estatisticas(grupo);
  if (profundidade > LIMITES_REGRAS.profundidadeMaxima) throw new ErroRegra("Profundidade máxima excedida", "PROFUNDIDADE_EXCEDIDA");
  if (folhas > LIMITES_REGRAS.condicoesMaximas) throw new ErroRegra("Quantidade máxima de condições excedida", "CONDICOES_EXCEDIDAS");
  const visitar = (item: CondicaoFolha | GrupoCondicao): void => {
    if (folha(item)) {
      if (Array.isArray(item.valor) && item.valor.length > LIMITES_REGRAS.listaMaxima) throw new ErroRegra("Tamanho máximo de lista excedido", "LISTA_EXCEDIDA");
      return;
    }
    item.condicoes.forEach(visitar);
  };
  visitar(grupo);
}

type Token = { tipo: "numero"; valor: number } | { tipo: "campo"; valor: CampoReferencia } | { tipo: "operador"; valor: "+" | "-" | "*" | "/" } | { tipo: "abre" } | { tipo: "fecha" };
function tokenizarFormula(expressao: string): Token[] {
  const tokens: Token[] = [];
  let posicao = 0;
  while (posicao < expressao.length) {
    const restante = expressao.slice(posicao);
    const espacos = restante.match(/^\s+/)?.[0];
    if (espacos) { posicao += espacos.length; continue; }
    const referencia = restante.match(/^\{\{([a-z_]+):([^{}]+)\}\}/);
    if (referencia) {
      const parsed = campoReferenciaSchema.safeParse({ fonte: referencia[1], campo: referencia[2] });
      if (!parsed.success) throw new ErroRegra(`Referência de fórmula não permitida: ${referencia[0]}`, "FORMULA_CAMPO_INVALIDO");
      tokens.push({ tipo: "campo", valor: parsed.data }); posicao += referencia[0].length; continue;
    }
    const numero = restante.match(/^(?:\d+\.?\d*|\.\d+)/)?.[0];
    if (numero) { tokens.push({ tipo: "numero", valor: Number(numero) }); posicao += numero.length; continue; }
    const caractere = restante[0];
    if (caractere === "+" || caractere === "-" || caractere === "*" || caractere === "/") tokens.push({ tipo: "operador", valor: caractere });
    else if (caractere === "(") tokens.push({ tipo: "abre" });
    else if (caractere === ")") tokens.push({ tipo: "fecha" });
    else throw new ErroRegra(`Caractere inválido na fórmula: ${caractere}`, "FORMULA_CARACTERE_INVALIDO");
    posicao++;
  }
  if (tokens.length > LIMITES_REGRAS.formulaTokensMaximos) throw new ErroRegra("Complexidade máxima da fórmula excedida", "FORMULA_EXCEDIDA");
  return tokens;
}
export function avaliarFormula(expressao: string, contexto: ContextoAvaliacao): number {
  if (expressao.length > LIMITES_REGRAS.formulaCaracteresMaximos) throw new ErroRegra("Tamanho máximo da fórmula excedido", "FORMULA_EXCEDIDA");
  const tokens = tokenizarFormula(expressao);
  let indice = 0;
  const proximo = () => tokens[indice];
  const consumir = () => { const token = tokens[indice++]; if (!token) throw new ErroRegra("Fórmula incompleta", "FORMULA_INCOMPLETA"); return token; };
  const expressaoInterna = (nivel = 0): number => {
    if (nivel > LIMITES_REGRAS.formulaProfundidadeMaxima) throw new ErroRegra("Profundidade máxima da fórmula excedida", "FORMULA_EXCEDIDA");
    const fator = (): number => {
      const token = consumir();
      if (token.tipo === "numero") return token.valor;
      if (token.tipo === "campo") {
        const valor = exigirCoercao(resolverCampo(token.valor, contexto), "numero", `Campo ${token.valor.fonte}:${token.valor.campo}`);
        if (valor.tipo !== "numero") throw new ErroRegra("Campo não numérico", "FORMULA_CAMPO_NAO_NUMERICO");
        return valor.valor;
      }
      if (token.tipo === "operador" && token.valor === "-") return -fator();
      if (token.tipo === "abre") {
        const valor = expressaoInterna(nivel + 1);
        if (consumir().tipo !== "fecha") throw new ErroRegra("Parênteses inválidos", "FORMULA_PARENTESES");
        return valor;
      }
      throw new ErroRegra("Token inválido na fórmula", "FORMULA_TOKEN_INVALIDO");
    };
    const termo = (): number => {
      let valor = fator();
      while (true) {
        const atual = proximo();
        if (atual?.tipo !== "operador" || atual.valor !== "*" && atual.valor !== "/") break;
        const operador = consumir(); const direito = fator();
        if (operador.tipo !== "operador") throw new ErroRegra("Operador inválido", "FORMULA_TOKEN_INVALIDO");
        if (operador.valor === "/" && direito === 0) throw new ErroRegra("Divisão por zero", "FORMULA_DIVISAO_ZERO");
        valor = operador.valor === "*" ? valor * direito : valor / direito;
      }
      return valor;
    };
    let valor = termo();
    while (true) {
      const atual = proximo();
      if (atual?.tipo !== "operador" || atual.valor !== "+" && atual.valor !== "-") break;
      const operador = consumir(); const direito = termo();
      if (operador.tipo !== "operador") throw new ErroRegra("Operador inválido", "FORMULA_TOKEN_INVALIDO");
      valor = operador.valor === "+" ? valor + direito : valor - direito;
    }
    return valor;
  };
  const resultado = expressaoInterna();
  if (indice !== tokens.length || !Number.isFinite(resultado)) throw new ErroRegra("Fórmula inválida", "FORMULA_TOKENS_RESTANTES");
  return resultado;
}

export function avaliarTabelaDecisao(tabela: TabelaDecisao, contexto: ContextoAvaliacao): ValorRegra {
  if (tabela.linhas.length > LIMITES_REGRAS.tabelaDecisaoLinhasMaximas) throw new ErroRegra("Tabela de decisão excede o limite", "TABELA_EXCEDIDA");
  for (const linha of tabela.linhas) { validarLimites(linha.condicao); if (avaliarGrupo(linha.condicao, contexto)) return linha.resultado; }
  return tabela.padrao ?? null;
}
function chave(ref: CampoReferencia): string { return `${ref.fonte}:${ref.campo}`; }
function numeroCampo(ref: CampoReferencia, contexto: ContextoAvaliacao): number {
  const valor = exigirCoercao(resolverCampo(ref, contexto), "numero", `Campo ${chave(ref)}`);
  if (valor.tipo !== "numero") throw new ErroRegra("Campo não numérico", "TIPO_INCOMPATIVEL");
  return valor.valor;
}
function erroSeguro(erro: unknown): ResultadoAvaliacao {
  const item = erro instanceof ErroRegra ? { codigo: erro.codigo, mensagem: erro.message } : { codigo: "ERRO_CONFIGURACAO", mensagem: "Configuração de regra inválida" };
  return { permitida: false, aplicada: true, motivo: `Erro na regra: ${item.mensagem}`, erros: [item] };
}

export function avaliarRegra(regra: RegraBpm, contexto: ContextoAvaliacao): ResultadoAvaliacao {
  if (!regra.ativa) return { permitida: true, aplicada: false };
  try {
    const validacao = regraBpmSchema.safeParse(regra);
    if (!validacao.success) throw new ErroRegra(validacao.error.issues[0]?.message ?? "Regra inválida", "REGRA_INVALIDA");
    validarLimites(regra.condicao);
    if (!avaliarGrupo(regra.condicao, contexto)) return { permitida: true, aplicada: false };
    const resultado = regra.resultado;
    if (resultado.tipo === "campo_obrigatorio") {
      const faltantes = resultado.campos.filter((campo) => vazio(resolverCampo(campo, contexto)));
      return faltantes.length === 0 ? { permitida: true, aplicada: true } : { permitida: false, aplicada: true, motivo: resultado.mensagem ?? "Campos obrigatórios não preenchidos", obrigatorios: faltantes };
    }
    if (resultado.tipo === "bloqueio_movimentacao") return { permitida: false, aplicada: true, motivo: resultado.mensagem };
    if (resultado.tipo === "mensagem_validacao") return { permitida: false, aplicada: true, motivo: resultado.mensagem, mensagens: [resultado.mensagem] };
    if (resultado.tipo === "formula_segura") return { permitida: true, aplicada: true, calculos: { [chave(resultado.campoDestino)]: avaliarFormula(resultado.expressao, contexto) } };
    if (resultado.tipo === "calculo") {
      const operandos = resultado.operandos.map((campo) => numeroCampo(campo, contexto));
      let valor = operandos[0];
      for (const operando of operandos.slice(1)) {
        if (resultado.operacao === "soma") valor += operando;
        else if (resultado.operacao === "subtracao") valor -= operando;
        else if (resultado.operacao === "multiplicacao") valor *= operando;
        else { if (operando === 0) throw new ErroRegra("Divisão por zero", "CALCULO_DIVISAO_ZERO"); valor /= operando; }
      }
      return { permitida: true, aplicada: true, calculos: { [chave(resultado.campoDestino)]: valor } };
    }
    if (resultado.tipo === "tabela_decisao") return { permitida: true, aplicada: true, resultados: { [chave(resultado.campoDestino)]: avaliarTabelaDecisao(resultado.tabela, contexto) } };
    return resultado.campoDestino
      ? { permitida: true, aplicada: true, resultados: { [chave(resultado.campoDestino)]: resultado.valor } }
      : { permitida: true, aplicada: true, mensagens: [String(resultado.valor)] };
  } catch (erro) { return erroSeguro(erro); }
}

export function avaliarRegras(regras: RegraBpm[], contexto: ContextoAvaliacao): ResultadoAvaliacao {
  const final: ResultadoAvaliacao = { permitida: true, aplicada: false };
  for (const regra of [...regras].sort((a, b) => a.prioridade - b.prioridade || a.id.localeCompare(b.id))) {
    const atual = avaliarRegra(regra, contexto);
    final.aplicada ||= atual.aplicada;
    if (!atual.permitida) return atual;
    if (atual.mensagens) final.mensagens = [...(final.mensagens ?? []), ...atual.mensagens];
    if (atual.calculos) final.calculos = { ...(final.calculos ?? {}), ...atual.calculos };
    if (atual.resultados) final.resultados = { ...(final.resultados ?? {}), ...atual.resultados };
  }
  return final;
}
