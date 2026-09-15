import { z } from "zod";

export const EXTENSOES_MESCLAGEM = [".xlsx", ".xlsm", ".xls", ".xlsb", ".ods", ".csv", ".tsv"] as const;
export type ExtensaoMesclagem = (typeof EXTENSOES_MESCLAGEM)[number];

/** Limites estruturais canônicos, aplicados a todos os formatos e APIs. */
export const LIMITE_COLUNAS_MESCLAGEM = 200;
export const LIMITE_CELULAS_MESCLAGEM = 2_000_000;

/** Catálogo único de colunas produzidas pela Mesclagem. Seguro para client e server. */
export const CAMPOS_DESTINO_MESCLAGEM = [
  "Data Opção Simples",
  "Capital Social",
  "CPF_SOCIO",
  "NOME_SOCIO",
  "DDD1",
  "FONE1",
  "FG_WHATSAPP1",
  "DDD2",
  "FONE2",
  "FG_WHATSAPP2",
  "DDD3",
  "FONE3",
  "FG_WHATSAPP3",
  "DDD4",
  "FONE4",
  "FG_WHATSAPP4",
  "DDD5",
  "FONE5",
  "FG_WHATSAPP5",
  "EMAIL_SOCIO",
  "CNPJ",
  "Contribuinte",
  "Situação da Habilitação",
  "Data da Situação",
  "Submodalidade",
  "Razão Social",
  "Nome Fantasia",
  "Município",
  "UF",
  "Data de Constituição",
  "Regime Tributário",
] as const;

export type CampoDestinoMesclagem = (typeof CAMPOS_DESTINO_MESCLAGEM)[number];

export const campoDestinoMesclagemSchema = z.enum(CAMPOS_DESTINO_MESCLAGEM);
export const CAMPOS_DESTINO_MESCLAGEM_SET: ReadonlySet<string> = new Set(CAMPOS_DESTINO_MESCLAGEM);
export const CAMPOS_DATA_MESCLAGEM_SET: ReadonlySet<string> = new Set([
  "Data Opção Simples",
  "Data da Situação",
  "Data de Constituição",
]);

export function criarMapeamentoInicial() {
  return CAMPOS_DESTINO_MESCLAGEM.map((destino) => ({
    destino,
    origem: null,
    origemNome: null,
    automatico: false,
  }));
}
