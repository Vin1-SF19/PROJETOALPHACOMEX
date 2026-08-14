import db from "@/lib/prisma";

/**
 * Adapter somente-leitura de `BusinessProcess` — complemento operacional ao evento de
 * êxito (tentativas, deferimento na 1ª tentativa, analista auxiliar/auditor/diretor).
 * NÃO é fonte da data do êxito em si (essa vem de `ClienteServico.dataExito`, ver
 * exito-detector.ts) — é o complemento que `ClienteServico` não tem.
 * Fase 3.7 do Cliente Master (2026-08-14): busca por `clienteServicoId` (correlação por
 * serviço contratado, mesmo padrão de `CommissionEvent`) — model está vazio em produção
 * hoje (feature nunca ativada), migração de schema só, sem backfill de dado.
 */

export interface BusinessProcessSnapshot {
  id: string;
  clienteServicoId: number | null;
  analistaResponsavelId: number;
  analistaAuxiliarId: number | null;
  auditorId: number | null;
  diretorId: number | null;
  tentativas: number;
  deferidoPrimeiraTentativa: boolean;
  status: string;
}

export async function buscarProcessoPorClienteId(clienteServicoId: number): Promise<BusinessProcessSnapshot | null> {
  const processo = await db.businessProcess.findFirst({
    where: { clienteServicoId },
    select: {
      id: true,
      clienteServicoId: true,
      analistaResponsavelId: true,
      analistaAuxiliarId: true,
      auditorId: true,
      diretorId: true,
      tentativas: true,
      deferidoPrimeiraTentativa: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return processo;
}
