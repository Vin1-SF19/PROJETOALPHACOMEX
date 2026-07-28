/**
 * Resolve o vínculo (CLT/PJ) vigente de um colaborador NA DATA de um evento específico.
 *
 * Fonte: ContratoColaborador (já existe no schema, prisma/schema.prisma) — `usuarioId`,
 * `tipo`, `dataInicio`, `dataFim`. Confirmado pelo usuário (Fase 01) que `tipo` já contém
 * literalmente "CLT"/"PJ" quando populado, mas a tabela está VAZIA em produção hoje (0
 * linhas, achado do Vault na Fase 02) — não há dado real para validar isso ainda. Por
 * isso este resolvedor NUNCA confia cegamente: normaliza (trim + uppercase) e valida que
 * o resultado é exatamente "CLT" ou "PJ", tratando qualquer outro valor como divergência
 * explícita — nunca lança exceção, nunca assume um padrão silencioso.
 *
 * Não depende do Prisma Client gerado (pendência técnica: `npx prisma generate` falhou
 * com EPERM na Fase 02/04, arquivo do query engine travado por outro processo Node no
 * Windows) — usa um tipo próprio `ContratoColaboradorRecord` em vez de importar do
 * @prisma/client. Resolver o EPERM antes da Fase 06 (adapters), que vai precisar do
 * client real para consultar o banco.
 */

export type Vinculo = "CLT" | "PJ";

export interface ContratoColaboradorRecord {
  id: string;
  usuarioId: number;
  tipo: string;
  dataInicio: Date;
  dataFim: Date | null;
}

export type VinculoResolutionResult =
  | { status: "RESOLVIDO"; vinculo: Vinculo; contratoId: string }
  | { status: "SEM_VINCULO_VIGENTE"; motivo: string }
  | { status: "TIPO_NAO_RECONHECIDO"; motivo: string; valorOriginal: string; contratoId: string }
  | { status: "MULTIPLOS_VINCULOS_VIGENTES"; motivo: string; contratoIds: string[] };

function normalizarTipo(tipo: string): string {
  return tipo.trim().toUpperCase();
}

function estaVigenteNaData(contrato: ContratoColaboradorRecord, data: Date): boolean {
  const inicioOk = contrato.dataInicio.getTime() <= data.getTime();
  const fimOk = contrato.dataFim === null || contrato.dataFim.getTime() >= data.getTime();
  return inicioOk && fimOk;
}

/**
 * Resolve o vínculo vigente de um colaborador (usuarioId) numa data específica, a partir
 * de todos os seus registros de ContratoColaborador. Trata explicitamente os casos: sem
 * vínculo vigente na data; tipo não reconhecido (após normalização, não é "CLT" nem "PJ");
 * múltiplos vínculos vigentes simultâneos (dado inconsistente — não escolhe um sozinho).
 */
export function resolverVinculoNaData(
  contratos: ContratoColaboradorRecord[],
  usuarioId: number,
  data: Date,
): VinculoResolutionResult {
  const doColaborador = contratos.filter((c) => c.usuarioId === usuarioId);
  const vigentes = doColaborador.filter((c) => estaVigenteNaData(c, data));

  if (vigentes.length === 0) {
    return {
      status: "SEM_VINCULO_VIGENTE",
      motivo: `Nenhum registro de ContratoColaborador vigente para o usuário ${usuarioId} na data informada.`,
    };
  }

  if (vigentes.length > 1) {
    return {
      status: "MULTIPLOS_VINCULOS_VIGENTES",
      motivo: `${vigentes.length} registros de ContratoColaborador vigentes simultaneamente para o usuário ${usuarioId} — dado inconsistente, requer correção manual.`,
      contratoIds: vigentes.map((c) => c.id),
    };
  }

  const contrato = vigentes[0];
  const tipoNormalizado = normalizarTipo(contrato.tipo);

  if (tipoNormalizado !== "CLT" && tipoNormalizado !== "PJ") {
    return {
      status: "TIPO_NAO_RECONHECIDO",
      motivo: `ContratoColaborador.tipo = "${contrato.tipo}" não normaliza para "CLT" nem "PJ".`,
      valorOriginal: contrato.tipo,
      contratoId: contrato.id,
    };
  }

  return { status: "RESOLVIDO", vinculo: tipoNormalizado, contratoId: contrato.id };
}
