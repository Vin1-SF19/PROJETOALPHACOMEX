/** Identidades da integração opcional de consulta cadastral por CNPJ.
 * A existência, visibilidade e obrigatoriedade dos campos vêm da configuração publicada. */
export const FINANCIAL_FIELD_KEYS = {
  CNPJ: "alpha.cnpj",
  RAZAO_SOCIAL: "alpha.razao.social",
  RUA: "alpha.rua",
  NUMERO: "alpha.numero",
  BAIRRO: "alpha.bairro",
  CEP: "alpha.cep",
  MUNICIPIO: "alpha.municipio",
  ESTADO: "alpha.estado",
} as const;
