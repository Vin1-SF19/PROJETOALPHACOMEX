// Regra global aplicada ao system prompt de TODOS os agentes Onyx (existentes e
// novos). Fica invisível para o usuário no editor (é removida na carga e
// reanexada ao salvar), garantindo exatamente uma cópia.

export const GLOBAL_RULE_MARKER = "##REGRA_GLOBAL##";

export const GLOBAL_AGENT_RULE =
  `\n\n${GLOBAL_RULE_MARKER}\n` +
  `Nunca utilize "—" (travessão) nas respostas; opte por outras pontuações ` +
  `(vírgula, ponto, dois-pontos ou parênteses).`;

/** Remove a regra global do prompt (para exibir só o texto do usuário). */
export function stripGlobalRule(prompt: string | null | undefined): string {
  return (prompt ?? "").split(GLOBAL_RULE_MARKER)[0].trimEnd();
}

/** Garante a regra global no fim do prompt, exatamente uma vez. */
export function applyGlobalRule(prompt: string | null | undefined): string {
  return stripGlobalRule(prompt) + GLOBAL_AGENT_RULE;
}
