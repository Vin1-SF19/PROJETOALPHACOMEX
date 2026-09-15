import {
  CAMPOS_DESTINO_MESCLAGEM_SET,
  LIMITE_COLUNAS_MESCLAGEM,
  criarMapeamentoInicial,
} from "./catalogo";
import { mapearCamposAutomaticos, mesclarPlanilhas } from "./mesclador";
import { sugerirCamposComFallbackLocal } from "./mapeamento-ia";
import {
  ErroMesclagem, lerRegistrosDelimitados, parseCsvTexto, registrosDelimitadosParaLinhas,
  validarExtensaoMesclagem, validarTamanhoArquivo,
} from "./parsing";
import type {
  CampoMapeamento, ColunaPlanilha, InspecaoPlanilha, LinhaPlanilha,
  PreviaMesclagem, SugestaoMapeamento,
} from "./tipos";
import { mapeamentoEntradaSchema } from "./schemas";
import { inspecionarEntradaXlsx, lerLinhasEntradaXlsx } from "./input-adapter";

export const LIMITE_LINHAS_PREVIA = 100;

export async function inspecionarArquivoMesclagem(arquivo: File): Promise<InspecaoPlanilha> {
  validarTamanhoArquivo(arquivo);
  const extensao = validarExtensaoMesclagem(arquivo.name);
  const buffer = await arquivo.arrayBuffer();
  if (extensao === ".csv" || extensao === ".tsv") {
    return parseCsvTexto(new TextDecoder("utf-8").decode(buffer), arquivo.name, extensao);
  }
  return inspecionarEntradaXlsx(buffer, arquivo.name, extensao);
}

async function lerLinhasArquivo(arquivo: File, inspecao: InspecaoPlanilha, nomeAba: string): Promise<LinhaPlanilha[]> {
  if (inspecao.extensao === ".csv" || inspecao.extensao === ".tsv") {
    if (nomeAba !== "Dados") throw new ErroMesclagem(`Aba ausente: ${nomeAba}`, "MISSING_SHEET", 422);
    const texto = new TextDecoder("utf-8").decode(await arquivo.arrayBuffer());
    const registros = lerRegistrosDelimitados(texto, inspecao.extensao);
    if (registros.length < 2) throw new ErroMesclagem("O arquivo precisa de cabeçalho e ao menos uma linha", "EMPTY_WORKBOOK", 422);
    return registrosDelimitadosParaLinhas(registros);
  }
  return lerLinhasEntradaXlsx(await arquivo.arrayBuffer(), nomeAba);
}

function resolverAba(inspecao: InspecaoPlanilha, solicitada: string | undefined): { nome: string; colunas: ColunaPlanilha[] } {
  const nome = solicitada ?? inspecao.abas[0]?.nome;
  const aba = inspecao.abas.find((item) => item.nome === nome);
  if (!aba) throw new ErroMesclagem(`Aba ausente: ${nome ?? ""}`, "MISSING_SHEET", 422);
  if (aba.colunas.length > LIMITE_COLUNAS_MESCLAGEM || aba.colunas.some((coluna) => coluna.numero > LIMITE_COLUNAS_MESCLAGEM)) {
    throw new ErroMesclagem(`A aba ${aba.nome} excede o limite de ${LIMITE_COLUNAS_MESCLAGEM} colunas`, "TOO_MANY_COLUMNS", 413);
  }
  return aba;
}

function resolverColunaCnpj(aba: { colunas: ColunaPlanilha[] }, solicitada: number | undefined, sugerida: number | undefined): number {
  const numero = solicitada ?? sugerida;
  if (!numero || !aba.colunas.some((coluna) => coluna.numero === numero)) {
    throw new ErroMesclagem("Selecione uma coluna de CNPJ válida", "INVALID_CNPJ_COLUMN", 422);
  }
  return numero;
}

function validarNumeroOrigem(valor: unknown, colunas: ColunaPlanilha[], destino: string): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (!Number.isSafeInteger(valor) || !colunas.some((coluna) => coluna.numero === valor)) {
    throw new ErroMesclagem(`Coluna de origem inválida para ${destino}`, "INVALID_MAPPING_COLUMN", 422);
  }
  return valor as number;
}

/** Valida a allowlist e deriva nomes/índices da principal no servidor. */
export function validarMapeamentoMesclagem(
  bruto: unknown,
  colunasComplementar: ColunaPlanilha[],
  colunasPrincipal: ColunaPlanilha[],
): CampoMapeamento[] {
  if (
    colunasComplementar.length > LIMITE_COLUNAS_MESCLAGEM ||
    colunasPrincipal.length > LIMITE_COLUNAS_MESCLAGEM ||
    [...colunasComplementar, ...colunasPrincipal].some((coluna) => coluna.numero > LIMITE_COLUNAS_MESCLAGEM)
  ) {
    throw new ErroMesclagem(`O limite é de ${LIMITE_COLUNAS_MESCLAGEM} colunas por arquivo`, "TOO_MANY_COLUMNS", 413);
  }
  const validacao = mapeamentoEntradaSchema.safeParse(bruto);
  if (!validacao.success) throw new ErroMesclagem("Mapeamento inválido", "INVALID_MAPPING", 422);
  const recebidos = new Map<string, Record<string, unknown>>();
  for (const item of validacao.data) {
    const campo = item as Record<string, unknown>;
    const destino = typeof campo.destino === "string" ? campo.destino : "";
    if (!CAMPOS_DESTINO_MESCLAGEM_SET.has(destino) || recebidos.has(destino)) {
      throw new ErroMesclagem("Destino de mapeamento inválido ou duplicado", "INVALID_MAPPING_DESTINATION", 422);
    }
    recebidos.set(destino, campo);
  }

  const base = criarMapeamentoInicial();
  const mapaPrincipal = mapearCamposAutomaticos(base, colunasPrincipal);
  return base.map((padrao) => {
    const recebido = recebidos.get(padrao.destino);
    const principal = mapaPrincipal.find((item) => item.destino === padrao.destino);
    if (!recebido) {
      return { ...padrao, origemPrincipal: principal?.origem ?? null, origemPrincipalNome: principal?.origemNome ?? null };
    }
    const origem = validarNumeroOrigem(recebido.origem, colunasComplementar, padrao.destino);
    const coluna = colunasComplementar.find((item) => item.numero === origem);
    return {
      ...padrao,
      origem,
      origemNome: coluna?.nome ?? null,
      automatico: recebido.automatico === true && recebido.manual !== true,
      manual: recebido.manual === true,
      origemPrincipal: principal?.origem ?? null,
      origemPrincipalNome: principal?.origemNome ?? null,
    };
  });
}

export async function sugerirMapeamentoMesclagem(params: {
  colunasPrincipal: ColunaPlanilha[];
  colunasComplementar: ColunaPlanilha[];
  mapeamento?: unknown;
}): Promise<SugestaoMapeamento> {
  const entrada = Array.isArray(params.mapeamento)
    ? params.mapeamento.map((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) return item;
        const campo = item as Record<string, unknown>;
        return campo.manual === true
          ? campo
          : { ...campo, origem: null, origemNome: null, automatico: false };
      })
    : criarMapeamentoInicial();
  const validado = validarMapeamentoMesclagem(
    entrada, params.colunasComplementar, params.colunasPrincipal,
  );
  return sugerirCamposComFallbackLocal(
    mapearCamposAutomaticos(validado, params.colunasComplementar), params.colunasComplementar,
  );
}

export async function processarMesclagem(params: {
  principal: File;
  complementar: File;
  abaPrincipal?: string;
  abaComplementar?: string;
  colunaCnpjPrincipal?: number;
  colunaCnpjComplementar?: number;
  mapeamento?: unknown;
}): Promise<PreviaMesclagem> {
  const [principal, complementar] = await Promise.all([
    inspecionarArquivoMesclagem(params.principal), inspecionarArquivoMesclagem(params.complementar),
  ]);
  const abaPrincipal = resolverAba(principal, params.abaPrincipal);
  const abaComplementar = resolverAba(complementar, params.abaComplementar);
  const colunaCnpjPrincipal = resolverColunaCnpj(abaPrincipal, params.colunaCnpjPrincipal, principal.colunasCnpjSugeridas[0]);
  const colunaCnpjComplementar = resolverColunaCnpj(abaComplementar, params.colunaCnpjComplementar, complementar.colunasCnpjSugeridas[0]);
  const [linhasPrincipal, linhasComplementar] = await Promise.all([
    lerLinhasArquivo(params.principal, principal, abaPrincipal.nome),
    lerLinhasArquivo(params.complementar, complementar, abaComplementar.nome),
  ]);

  let mapeamento = validarMapeamentoMesclagem(
    params.mapeamento ?? criarMapeamentoInicial(), abaComplementar.colunas, abaPrincipal.colunas,
  );
  if (params.mapeamento === undefined) {
    mapeamento = (await sugerirMapeamentoMesclagem({
      colunasPrincipal: abaPrincipal.colunas, colunasComplementar: abaComplementar.colunas, mapeamento,
    })).mapeamento;
  }
  const resultado = mesclarPlanilhas({
    principal: linhasPrincipal, complementar: linhasComplementar,
    colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento,
  });
  return {
    principal, complementar, abaPrincipal: abaPrincipal.nome, abaComplementar: abaComplementar.nome,
    colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento, resultado,
  };
}

export async function criarPreviaMesclagem(params: Parameters<typeof processarMesclagem>[0]): Promise<PreviaMesclagem> {
  return compactarPreviaMesclagem(await processarMesclagem(params));
}

function compactarPreviaMesclagem(previa: PreviaMesclagem): PreviaMesclagem {
  return { ...previa, resultado: { ...previa.resultado, linhas: previa.resultado.linhas.slice(0, LIMITE_LINHAS_PREVIA) } };
}
