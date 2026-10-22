import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import {
  exigirEscritaChecklist,
  exigirEmpresaChecklist,
  exigirLeituraChecklist,
  type Tx,
} from "./acesso";
import { fail, hashPayload } from "./result";
import type { AtorChecklist } from "./types";
export type CommandContext = {
  empresaId: string;
  expectedRevision: number;
  mutationId: string;
};
export async function replay(
  tx: Tx,
  ator: AtorChecklist,
  mutationId: string,
  payload: unknown,
) {
  const prior = await tx.checklistEvento.findUnique({ where: { mutationId } });
  if (!prior) return null;
  if (
    prior.payloadHash !== hashPayload(payload) ||
    prior.atorTipo !== ator.kind ||
    prior.atorUsuarioId !== (ator.kind === "INTERNO" ? ator.id : null) ||
    prior.atorContaId !== (ator.kind === "PORTAL" ? ator.id : null)
  )
    fail("CONFLICT", "Esta intenção já foi utilizada com outros dados.");
  return prior;
}
export async function registrarEvento(
  tx: Tx,
  ator: AtorChecklist,
  c: {
    mutationId: string;
    payload: unknown;
    agregadoTipo: string;
    agregadoId: string;
    revision: number;
    tipo: string;
    empresaId?: string;
    dados?: Prisma.InputJsonValue;
    resultado?: Prisma.InputJsonValue;
    notificar?: boolean;
  },
) {
  const event = await tx.checklistEvento.create({
    data: {
      mutationId: c.mutationId,
      payloadHash: hashPayload(c.payload),
      agregadoTipo: c.agregadoTipo,
      agregadoId: c.agregadoId,
      revision: c.revision,
      tipo: c.tipo,
      empresaId: c.empresaId,
      atorTipo: ator.kind,
      atorUsuarioId: ator.kind === "INTERNO" ? ator.id : null,
      atorContaId: ator.kind === "PORTAL" ? ator.id : null,
      dados: c.dados,
      resultado: c.resultado,
    },
  });
  if (ator.kind === "INTERNO")
    await tx.auditoria.create({
      data: {
        userId: ator.id,
        acao: c.tipo,
        checklistEventoId: event.id,
        detalhes: JSON.stringify({
          eventoId: event.id,
          agregadoId: c.agregadoId,
          revision: c.revision,
        }),
      },
    });
  if (c.notificar && c.empresaId) {
    const e = await tx.operacionalClientes.findUniqueOrThrow({
      where: { id: c.empresaId },
      select: { clienteOperacionalId: true },
    });
    await tx.notificacaoCliente.create({
      data: {
        eventoId: event.id,
        clienteId: e.clienteOperacionalId,
        tipo: c.tipo,
        titulo: "Atualização no checklist",
        empresaId: c.empresaId,
      },
    });
  }
  return event;
}
export async function executarAtendimento(
  ator: AtorChecklist,
  c: CommandContext,
  payload: unknown,
  tipo: string,
  change: (
    tx: Tx,
    empresa: Awaited<ReturnType<typeof exigirEmpresaChecklist>>,
  ) => Promise<{ changed: boolean; dados?: Prisma.InputJsonValue }>,
  portal = false,
) {
  return db.$transaction(
    async (tx) => {
      const empresa = portal
        ? await exigirEmpresaChecklist(tx, ator, c.empresaId)
        : await exigirEscritaChecklist(tx, ator, c.empresaId);
      const prior = await replay(tx, ator, c.mutationId, payload);
      if (prior)
        return {
          empresaId: empresa.id,
          revision: empresa.revision,
          replayed: true,
        };
      if (empresa.revision !== c.expectedRevision)
        fail("CONFLICT", "O atendimento mudou. Recarregue antes de salvar.");
      const changed = await change(tx, empresa);
      if (!changed.changed)
        return {
          empresaId: empresa.id,
          revision: empresa.revision,
          replayed: false,
        };
      const cas = await tx.operacionalClientes.updateMany({
        where: { id: empresa.id, revision: c.expectedRevision },
        data: { revision: { increment: 1 } },
      });
      if (cas.count !== 1)
        fail("CONFLICT", "O atendimento mudou. Recarregue antes de salvar.");
      await registrarEvento(tx, ator, {
        mutationId: c.mutationId,
        payload,
        agregadoTipo: "ATENDIMENTO",
        agregadoId: empresa.id,
        revision: c.expectedRevision + 1,
        tipo,
        empresaId: empresa.id,
        dados: changed.dados,
        resultado: { empresaId: empresa.id },
        notificar: ator.kind === "INTERNO",
      });
      return {
        empresaId: empresa.id,
        revision: c.expectedRevision + 1,
        replayed: false,
      };
    },
    { timeout: 15000 },
  );
}
export async function revalidarAtor(ator: AtorChecklist, tx: Tx) {
  return exigirLeituraChecklist(ator, tx);
}
