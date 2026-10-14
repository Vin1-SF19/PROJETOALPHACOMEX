import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { normalizeRole } from "@/lib/roles";
import { filtroVinculoCardBpm } from "@/lib/bpm/visibilidade-card";
import { lerConfiguracaoVisaoEquipe, type OpcaoSetorEquipe } from "@/lib/bpm/visao-equipe";

type Cliente = Pick<typeof db, "bpmPipeline" | "setor" | "usuarios">;
/** Apenas calcula concessões de leitura; o chamador ainda exige módulo, pipeline e coluna. */
export async function carregarEscopoLeituraBpm(userId: number, admin: boolean, pipelineId?: string, configJson?: string | null, client: Cliente = db, incluirOpcoes = false) {
  if (admin && !incluirOpcoes) return { where: {} as Prisma.BpmCardWhereInput, usuarioIds: [] as number[], setores: [] as OpcaoSetorEquipe[] };
  const pipelines = pipelineId && configJson !== undefined ? [{ id: pipelineId, visualizacaoConfigJson: configJson }] : await client.bpmPipeline.findMany({
    where: pipelineId ? { id: pipelineId } : undefined, select: { id: true, visualizacaoConfigJson: true },
  });
  const regras = pipelines.map((p) => ({ pipelineId: p.id, setorIds: lerConfiguracaoVisaoEquipe(p.visualizacaoConfigJson).supervisores.find((s) => s.usuarioId === userId)?.setorIds ?? [] }));
  const setorIds = [...new Set(regras.flatMap((r) => r.setorIds))];
  const setores = admin || setorIds.length ? await client.setor.findMany({ where: { ativo: true, ...(admin ? {} : { id: { in: setorIds } }) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }) : [];
  const usuarios = setores.length ? await client.usuarios.findMany({ select: { id: true, role: true } }) : [];
  const opcoes: OpcaoSetorEquipe[] = setores.map((s) => ({ ...s, usuarioIds: usuarios.filter((u) => normalizeRole(u.role) === normalizeRole(s.nome)).map((u) => u.id) }));
  const ids = [...new Set(opcoes.flatMap((s) => s.usuarioIds))];
  const where: Prisma.BpmCardWhereInput = admin ? {} : !ids.length ? filtroVinculoCardBpm(userId, false) : pipelineId ? filtroVinculoCardBpm(userId, false, ids) : {
    AND: [{ OR: [filtroVinculoCardBpm(userId, false), ...regras.filter((r) => r.setorIds.length).map((r) => ({ pipelineId: r.pipelineId, ...filtroVinculoCardBpm(userId, false, opcoes.filter((s) => r.setorIds.includes(s.id)).flatMap((s) => s.usuarioIds)) }))] }],
  };
  return { where, usuarioIds: ids, setores: opcoes };
}
