import db from "@/lib/prisma";
import { resolverVinculoNaData } from "../vinculo-resolver";
import type { ContratoColaboradorRecord, VinculoResolutionResult } from "../vinculo-resolver";

/**
 * Adapter somente-leitura de colaboradores: `usuarios` + `ContratoColaborador` (vigência
 * de vínculo) + `CargoColaborador` (com as 4 colunas de comissão da Fase 02) + `Setor`.
 */

export interface CollaboratorSnapshot {
  usuarioId: number;
  nome: string;
  cargoNome: string | null;
  cargoId: number | null;
  setorId: number | null;
  setorNome: string | null;
  naturezaRecebimento: string | null;
  permiteMultiplosOcupantes: boolean | null;
  vinculoResolution: VinculoResolutionResult;
}

export async function buscarColaboradorNaData(usuarioId: number, data: Date): Promise<CollaboratorSnapshot | null> {
  const usuario = await db.usuarios.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, cargo: true },
  });

  if (!usuario) return null;

  const contratos = await db.contratoColaborador.findMany({
    where: { usuarioId },
    select: { id: true, usuarioId: true, tipo: true, dataInicio: true, dataFim: true },
  });

  const vinculoResolution = resolverVinculoNaData(contratos as ContratoColaboradorRecord[], usuarioId, data);

  const cargoRow = usuario.cargo
    ? await db.cargoColaborador.findUnique({
        where: { nome: usuario.cargo },
        select: { id: true, nome: true, setorId: true, naturezaRecebimento: true, permiteMultiplosOcupantes: true },
      })
    : null;

  const setorRow = cargoRow?.setorId
    ? await db.setor.findUnique({ where: { id: cargoRow.setorId }, select: { id: true, nome: true } })
    : null;

  return {
    usuarioId: usuario.id,
    nome: usuario.nome,
    cargoNome: usuario.cargo,
    cargoId: cargoRow?.id ?? null,
    setorId: setorRow?.id ?? null,
    setorNome: setorRow?.nome ?? null,
    naturezaRecebimento: cargoRow?.naturezaRecebimento ?? null,
    permiteMultiplosOcupantes: cargoRow?.permiteMultiplosOcupantes ?? null,
    vinculoResolution,
  };
}
