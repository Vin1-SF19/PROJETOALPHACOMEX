import type { Prisma } from "@prisma/client";

type ConfigVersionClient = Pick<Prisma.TransactionClient, "bpmPipeline">;

/**
 * Invalida workspaces administrativos abertos antes de uma publicação
 * alternativa. Deve participar da mesma transação da alteração de configuração.
 */
export async function avancarConfigVersionBpm(
  tx: ConfigVersionClient,
  pipelineId: string,
): Promise<number> {
  const pipeline = await tx.bpmPipeline.update({
    where: { id: pipelineId },
    data: { configVersion: { increment: 1 } },
    select: { configVersion: true },
  });
  return pipeline.configVersion;
}
