import type { radar_fiscal } from "@prisma/client";

// Campos em camelCase são aceitos por registros legados importados no radar.
export type RadarFiscalItem = radar_fiscal & {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  situacao?: string | null;
  abertura?: string | null;
  capitalSocial?: string | null;
  regimeReceita?: string | null;
  regimeEA?: string | null;
  dataOpcao?: string | null;
  exclusao_simples?: string | null;
  historicoRegime?: string | null;
  cnaes_secundarios?: string | null;
};
