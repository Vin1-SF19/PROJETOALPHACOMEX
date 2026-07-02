// Tributos incidentes sobre a Receita Bruta do contrato (regime da empresa Alpha Comex).
export const TRIBUTOS = {
  irpj: 4.8,
  adicionalIrpj: 3.2,
  csll: 2.88,
  pis: 0.65,
  cofins: 3.0,
  iss: 5.0,
} as const;

export const TOTAL_TRIBUTOS_PCT = 19.53; // soma dos tributos acima
