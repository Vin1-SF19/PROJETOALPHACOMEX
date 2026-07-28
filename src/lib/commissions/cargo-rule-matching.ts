import { SEED_RULES } from "./seed-rules";
import type { CommissionRuleVersionData } from "./types";

/**
 * Mapeia `ruleId` das seed rules (Fase 04) para o nome de cargo correspondente
 * (`CargoColaborador.nome`). Necessário porque as seed rules não têm `cargoId` real
 * (os 8 cargos do prompt ainda não existem em produção, ver relatório do Vault na Fase
 * 02) — o casamento é feito pelo NOME do cargo até a Fase 14 popular `CargoColaborador`
 * com IDs reais e as seeds passarem a referenciar `cargoId` diretamente.
 *
 * Extraído de `entry-generator.ts` (Fase 07) para ser compartilhado com o simulador de
 * regras (Fase 11) — nunca duplicar esta lógica entre os dois consumidores.
 */
const PREFIXO_RULE_ID_PARA_CARGO: Record<string, string> = {
  closer: "Closer",
  "coordenadora-comercial": "Coordenadora Comercial",
  "diretora-comercial": "Diretora Comercial",
  "analista-ii": "Analista II",
  "analista-senior": "Analista Sênior",
  "analista-auxiliar": "Analista Auxiliar",
  "auditor-contabil": "Auditor Contábil",
  "diretor-operacional": "Diretor Operacional",
};

export function normalizarNomeCargo(nome: string): string {
  return nome.trim().toLowerCase();
}

export function ruleIdPertenceAoCargo(ruleId: string, cargoNome: string): boolean {
  const cargoNormalizado = normalizarNomeCargo(cargoNome);
  for (const [prefixo, nomeCargoDaRegra] of Object.entries(PREFIXO_RULE_ID_PARA_CARGO)) {
    if (ruleId.startsWith(prefixo) && normalizarNomeCargo(nomeCargoDaRegra) === cargoNormalizado) {
      return true;
    }
  }
  return false;
}

/** Regras seed candidatas para um cargo (por nome) e eventType, com cargoId opcional já embutido. */
export function regrasSeedDoCargo(cargoNome: string, eventType: string, cargoId: number | null = null): CommissionRuleVersionData[] {
  return SEED_RULES.filter((r) => r.eventType === eventType && ruleIdPertenceAoCargo(r.ruleId, cargoNome)).map(
    (r) => ({ ...r, cargoId }) as CommissionRuleVersionData,
  );
}

/** Lista os nomes de cargo conhecidos pelas seed rules — útil para simulador/configurações. */
export function cargosConhecidosPelasSeedRules(): string[] {
  return Array.from(new Set(Object.values(PREFIXO_RULE_ID_PARA_CARGO)));
}
