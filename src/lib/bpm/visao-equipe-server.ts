import { resolverNivelAcessoPipeline } from "@/lib/bpm/acesso-pipeline";
import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isSameRole } from "@/lib/roles";
import { listarUsuariosComAcessoCrmBpm } from "@/lib/bpm/ownership";
import type { OpcaoSetorEquipe } from "@/lib/bpm/visao-equipe";

type Cliente = Pick<typeof db, "bpmPipeline" | "usuarios" | "setorPermissao" | "usuarioPermissaoOverride">;

/**
 * Leitura é compartilhada no pipeline. Cada chamador exige módulo, pipeline e
 * coluna antes de aplicar este escopo; filtros pessoais são apenas seleção do quadro.
 */
export async function carregarEscopoLeituraBpm(
  _userId: number, _admin: boolean, pipelineId?: string, _configJson?: string | null,
  client: Cliente = db, incluirOpcoes = false,
) {
  const where: Prisma.BpmCardWhereInput = {};
  const vazio = { where, usuarioIds: [] as number[], setores: [] as OpcaoSetorEquipe[], responsaveis: [] as { id: number; nome: string }[] };
  if (!incluirOpcoes || !pipelineId) return vazio;

  const pipeline = await client.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: { visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } },
  });
  if (!pipeline) return vazio;
  const usuarios = await listarUsuariosComAcessoCrmBpm(client);
  const setores = pipeline.setores.map(({ setor }) => setor);
  const elegiveis = usuarios.filter((usuario) => resolverNivelAcessoPipeline({
    usuarioId: usuario.id, role: usuario.role, setoresPipeline: setores,
    visualizacaoConfigJson: pipeline.visualizacaoConfigJson,
  }) !== null);
  const opcoes = setores.map((setor) => ({ ...setor,
    usuarioIds: elegiveis.filter((usuario) => isSameRole(usuario.role, setor.nome)).map((usuario) => usuario.id),
  }));
  return { where, usuarioIds: elegiveis.map((usuario) => usuario.id), setores: opcoes,
    responsaveis: elegiveis.map(({ id, nome }) => ({ id, nome })) };
}
