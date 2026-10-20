import {
  CANAL_INDICACAO_CLIENTE, CANAL_INDICACAO_PARCEIRO,
  LABEL_INDICACAO_CLIENTE, LABEL_INDICACAO_PARCEIRO,
} from "@/lib/comercial/parceiro-nao-cadastrado";
import { CANAL_PROSPECCAO_ATIVA } from "@/lib/comercial/prospeccao-ativa";

/** Catálogo compartilhado por CRM, Metas e cadastro de clientes. */
export const ORIGENS_LEAD_PADRAO = [
  "Tráfego Pago (Meta - Instagram)",
  "Tráfego Pago (Google)",
  CANAL_INDICACAO_PARCEIRO,
  CANAL_INDICACAO_CLIENTE,
  "Evento",
  "China",
  "Discadora",
  "Prospecção ativa (Log Comex)",
  "WhatsApp",
  "Instagram",
  "Orgânico",
  CANAL_PROSPECCAO_ATIVA,
  "Outro",
] as const;

export const CANAIS_AQUISICAO = ORIGENS_LEAD_PADRAO.map((value) => ({
  value,
  label: value === CANAL_INDICACAO_PARCEIRO ? LABEL_INDICACAO_PARCEIRO
    : value === CANAL_INDICACAO_CLIENTE ? LABEL_INDICACAO_CLIENTE : value,
}));
