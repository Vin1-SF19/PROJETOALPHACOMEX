import "server-only";

import { del } from "@vercel/blob";
import db from "@/lib/prisma";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";

export const ACAO_LIMPEZA_ANEXO_PENDENTE = "ANEXO_BLOB_LIMPEZA_PENDENTE";
export const ACAO_LIMPEZA_ANEXO_CONCLUIDA = "ANEXO_BLOB_LIMPEZA_CONCLUIDA";
export const ACAO_UPLOAD_ANEXO_SEM_REGISTRO = "ANEXO_UPLOAD_SEM_REGISTRO";

/** O registro pendente nasce na mesma transação que remove o metadado. */
export async function limparBlobAnexoPendente(pendenteId: string): Promise<boolean> {
  const pendente = await db.bpmCardHistorico.findUnique({
    where: { id: pendenteId },
    select: { id: true, cardId: true, acao: true, valorAnteriorJson: true, createdAt: true },
  });
  if (!pendente || (pendente.acao !== ACAO_LIMPEZA_ANEXO_PENDENTE && pendente.acao !== ACAO_UPLOAD_ANEXO_SEM_REGISTRO)) return false;
  if (pendente.acao === ACAO_UPLOAD_ANEXO_SEM_REGISTRO
    && Date.now() - pendente.createdAt.getTime() < 24 * 60 * 60 * 1000) return false;
  const pathname = pendente.valorAnteriorJson && extrairPathnamePrivadoAnexoBpm(pendente.valorAnteriorJson);
  if (!pathname) return false;
  // Um novo anexo com o mesmo pathname jamais deve ser removido pelo retry.
  const aindaReferenciado = await db.bpmCardAnexo.findFirst({
    where: { url: pendente.valorAnteriorJson! }, select: { id: true },
  });
  if (!aindaReferenciado) await del(pathname, { token: process.env.CRM_READ_WRITE_TOKEN });
  await db.bpmCardHistorico.updateMany({
    where: { id: pendente.id, acao: pendente.acao },
    data: { acao: ACAO_LIMPEZA_ANEXO_CONCLUIDA },
  });
  return true;
}

/** Chamado pelo cron; falhas individuais ficam pendentes para o próximo ciclo. */
export async function reconciliarBlobsAnexosBpm(limite = 50) {
  const pendentes = await db.bpmCardHistorico.findMany({
    where: { OR: [
      { acao: ACAO_LIMPEZA_ANEXO_PENDENTE },
      { acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ] },
    select: { id: true }, orderBy: { createdAt: "desc" }, take: limite,
  });
  let concluidos = 0;
  let falhas = 0;
  for (const pendente of pendentes) {
    try {
      if (await limparBlobAnexoPendente(pendente.id)) concluidos += 1;
    } catch (error) {
      falhas += 1;
      console.error("[reconciliarBlobsAnexosBpm]", { pendenteId: pendente.id, error });
    }
  }
  return { examinados: pendentes.length, concluidos, falhas };
}
