import db from "@/lib/prisma";

/**
 * Adapter somente-leitura de `BusinessProcess` — complemento operacional ao evento de
 * êxito (tentativas, deferimento na 1ª tentativa, analista auxiliar/auditor/diretor).
 * NÃO é fonte da data do êxito em si (essa vem de `clientes.dataExito`, ver
 * exito-detector.ts) — é o complemento que `clientes` não tem.
 */

export interface BusinessProcessSnapshot {
  id: string;
  clienteId: number | null;
  analistaResponsavelId: number;
  analistaAuxiliarId: number | null;
  auditorId: number | null;
  diretorId: number | null;
  tentativas: number;
  deferidoPrimeiraTentativa: boolean;
  status: string;
}

export async function buscarProcessoPorClienteId(clienteId: number): Promise<BusinessProcessSnapshot | null> {
  const processo = await db.businessProcess.findFirst({
    where: { clienteId },
    select: {
      id: true,
      clienteId: true,
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
