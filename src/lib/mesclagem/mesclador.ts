import { classificarCnpj } from "./cnpj";
import { CAMPOS_DATA_MESCLAGEM_SET } from "./catalogo";
import { formatarDataMesclagem } from "./data";
import { ErroMesclagem, valorCnpjDaLinha } from "./parsing";
import type { CampoMapeamento, DiagnosticoCnpj, LinhaMesclada, LinhaPlanilha, ResultadoMesclagem, ResumoMesclagem } from "./tipos";

export function diagnosticarCnjs(linhas: LinhaPlanilha[], colunaCnpj: number): DiagnosticoCnpj {
  const validos = new Set<string>();
  const invalidos: string[] = [];
  let duplicados = 0;
  let vazios = 0;
  let total = 0;

  for (const linha of linhas) {
    total += 1;
    const resultado = classificarCnpj(valorCnpjDaLinha(linha, colunaCnpj));
    if (resultado.status === "vazio") {
      vazios += 1;
      continue;
    }
    if (resultado.status === "invalido") {
      invalidos.push(resultado.cnpj ?? "");
      continue;
    }
    if (validos.has(resultado.cnpj)) duplicados += 1;
    validos.add(resultado.cnpj);
  }

  return {
    status: invalidos.length === 0 && vazios === 0 ? "valido" : invalidos.length > 0 ? "invalido" : "vazio",
    total,
    validos: validos.size,
    invalidos: invalidos.length,
    vazios,
    duplicados,
    exemplosInvalidos: invalidos.slice(0, 5),
  };
}

export { mapearCamposAutomaticos, normalizarCabecalho } from "./mapeamento-deterministico";

export const LIMITE_LINHAS_RESULTADO_MESCLAGEM = 100_000;
export const LIMITE_MULTIPLICIDADE_CNPJ_MESCLAGEM = 1_000;

export function mesclarPlanilhas(params: {
  principal: LinhaPlanilha[];
  complementar: LinhaPlanilha[];
  colunaCnpjPrincipal: number;
  colunaCnpjComplementar: number;
  mapeamento: CampoMapeamento[];
}): ResultadoMesclagem {
  const indice = new Map<string, LinhaPlanilha[]>();
  for (const linha of params.complementar) {
    const resultado = classificarCnpj(valorCnpjDaLinha(linha, params.colunaCnpjComplementar));
    if (resultado.status !== "valido") continue;
    const existentes = indice.get(resultado.cnpj) ?? [];
    if (existentes.length >= LIMITE_MULTIPLICIDADE_CNPJ_MESCLAGEM) {
      throw new ErroMesclagem(
        `Um CNPJ excede o limite de ${LIMITE_MULTIPLICIDADE_CNPJ_MESCLAGEM.toLocaleString("pt-BR")} correspondências`,
        "CNPJ_MULTIPLICITY_TOO_HIGH",
        413,
      );
    }
    existentes.push(linha);
    indice.set(resultado.cnpj, existentes);
  }

  const linhas: LinhaMesclada[] = [];
  let comMatch = 0;
  let semMatch = 0;
  let linhasComplementares = 0;

  let totalExpandido = 0;
  for (const principal of params.principal) {
    const classificado = classificarCnpj(valorCnpjDaLinha(principal, params.colunaCnpjPrincipal));
    const quantidade = classificado.status === "valido" ? (indice.get(classificado.cnpj)?.length ?? 0) : 0;
    const incremento = Math.max(1, quantidade);
    if (incremento > LIMITE_LINHAS_RESULTADO_MESCLAGEM - totalExpandido) {
      throw new ErroMesclagem(
        `A expansão 1:N excede o limite de ${LIMITE_LINHAS_RESULTADO_MESCLAGEM.toLocaleString("pt-BR")} linhas`,
        "MERGE_RESULT_TOO_LARGE",
        413,
      );
    }
    totalExpandido += incremento;
  }

  for (const principal of params.principal) {
    const resultadoPrincipal = classificarCnpj(valorCnpjDaLinha(principal, params.colunaCnpjPrincipal));
    const correspondentes = resultadoPrincipal.status === "valido" ? (indice.get(resultadoPrincipal.cnpj) ?? []) : [];
    if (correspondentes.length === 0) semMatch += 1;

    if (correspondentes.length === 0) {
      comMatch += 0;
      linhas.push({
        id: `principal:${principal.numero}`,
        cnpj: resultadoPrincipal.status === "valido" ? resultadoPrincipal.cnpj : null,
        origemPrincipal: principal.numero,
        origemComplementar: null,
        valores: valoresDaLinha(principal, null, params.mapeamento),
      });
      continue;
    }

    comMatch += 1;
    correspondentes.forEach((complementar, indiceComplementar) => {
      linhasComplementares += 1;
      linhas.push({
        id: `principal:${principal.numero}:complementar:${complementar.numero}:${indiceComplementar}`,
        cnpj: resultadoPrincipal.cnpj,
        origemPrincipal: principal.numero,
        origemComplementar: complementar.numero,
        valores: valoresDaLinha(principal, complementar, params.mapeamento),
      });
    });
  }

  const diagnostico = diagnosticarCnjs(params.principal, params.colunaCnpjPrincipal);
  const resumo: ResumoMesclagem = {
    totalLinhas: linhas.length,
    comMatch,
    semMatch,
    linhasComplementares,
    cnpj: diagnostico,
  };

  return { resumo, linhas };
}

function valoresDaLinha(
  principal: LinhaPlanilha,
  complementar: LinhaPlanilha | null,
  mapeamento: CampoMapeamento[],
): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of mapeamento) {
    if (campo.manual && campo.origem === null) {
      valores[campo.destino] = "";
      continue;
    }
    const valorComplementar = campo.origem === null ? "" : complementar?.valores[campo.origem];
    const valorPrincipal = campo.origemPrincipal === null || campo.origemPrincipal === undefined
      ? ""
      : principal.valores[campo.origemPrincipal] ?? "";
    const valor = valorComplementar?.trim() ? valorComplementar : valorPrincipal;
    valores[campo.destino] = CAMPOS_DATA_MESCLAGEM_SET.has(campo.destino)
      ? formatarDataMesclagem(valor)
      : valor;
  }
  return valores;
}
