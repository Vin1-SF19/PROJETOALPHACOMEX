"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { compareSync } from "bcryptjs";
import { auth } from "../../auth";
import {
  criarProjetoSchema,
  atualizarProjetoSchema,
  moverProjetoSchema,
  paginacaoProjetosSchema,
  excluirProjetosSchema,
  BLUEPRINT_STATUS,
} from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint, isAdminRole } from "@/lib/blueprint/ownership";
import { podeAlterarPremioBlueprint } from "@/lib/blueprint/premio";

const ROTA_BASE = "/PainelAlpha/AlphaBlueprint";

function gerarCodigoProjeto(): string {
  const ano = new Date().getFullYear();
  const sufixo = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BP-${ano}-${sufixo}`;
}

async function registrarAtividade(params: {
  projectId: string;
  userId: number;
  action: string;
  entityType: string;
  entityId?: string;
  previousValueJson?: string;
  newValueJson?: string;
  metadataJson?: string;
}) {
  await db.blueprintActivity.create({
    data: {
      projectId: params.projectId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValueJson: params.previousValueJson,
      newValueJson: params.newValueJson,
      metadataJson: params.metadataJson,
    },
  });
}

export async function ListarProjetosBlueprint(params?: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const userId = Number(session.user.id);
    const parsed = paginacaoProjetosSchema.safeParse(params ?? {});
    if (!parsed.success) return { success: false, error: "Parâmetros inválidos", data: [] };

    const { page, pageSize, busca, status, priority, setor, responsavelId, incluirArquivados } = parsed.data;

    const acessoWhere = isAdminRole(session.user.role)
      ? {}
      : {
          OR: [
            { requesterId: userId },
            { ownerId: userId },
            { developerId: userId },
            { createdById: userId },
            { members: { some: { userId } } },
          ],
        };

    const filtros: Record<string, unknown>[] = [acessoWhere];
    if (!incluirArquivados) filtros.push({ status: { not: "ARQUIVADO" } });
    if (status) filtros.push({ status });
    if (priority) filtros.push({ priority });
    if (setor) filtros.push({ setor });
    if (responsavelId) filtros.push({ OR: [{ ownerId: responsavelId }, { developerId: responsavelId }] });
    if (busca) {
      filtros.push({
        OR: [
          { title: { contains: busca } },
          { summary: { contains: busca } },
          { code: { contains: busca } },
        ],
      });
    }

    const where = { AND: filtros };

    const [dados, total] = await Promise.all([
      db.blueprintProject.findMany({
        where,
        select: {
          id: true, code: true, title: true, summary: true, status: true,
          priority: true, progress: true, setor: true, coverUrl: true, icon: true,
          tagsJson: true, premioCents: true, dueDate: true, updatedAt: true,
          requester: { select: { id: true, nome: true } },
          owner: { select: { id: true, nome: true } },
          developer: { select: { id: true, nome: true } },
          _count: { select: { files: true, requirements: true, questions: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.blueprintProject.count({ where }),
    ]);

    const idsComPerguntasAbertas = await db.blueprintQuestion.groupBy({
      by: ["projectId"],
      where: { projectId: { in: dados.map((d) => d.id) }, status: "ABERTA" },
      _count: { _all: true },
    });
    const mapaPerguntasAbertas = new Map(idsComPerguntasAbertas.map((p) => [p.projectId, p._count._all]));

    const dadosComPendencias = dados.map((p) => ({
      ...p,
      perguntasAbertas: mapaPerguntasAbertas.get(p.id) ?? 0,
    }));

    return {
      success: true,
      data: dadosComPendencias,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  } catch (error) {
    console.error("[ListarProjetosBlueprint]", error);
    return { success: false, error: "Erro ao buscar projetos", data: [] };
  }
}

export async function CriarProjetoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarProjetoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const { membrosIds, relatedProjectId: _relatedProjectId, ...campos } = parsed.data;
    void _relatedProjectId; // vínculo entre projetos fica para a Camada 2 (relação não modelada no MVP)

    const solicitanteExiste = await db.usuarios.findUnique({ where: { id: campos.requesterId }, select: { id: true } });
    if (!solicitanteExiste) return { success: false, error: "Solicitante inválido" };

    const projeto = await db.$transaction(async (tx) => {
      const novoProjeto = await tx.blueprintProject.create({
        data: {
          code: gerarCodigoProjeto(),
          title: campos.title,
          summary: campos.summary,
          problem: campos.problem,
          setor: campos.setor,
          requesterId: campos.requesterId,
          ownerId: campos.ownerId,
          developerId: campos.developerId,
          priority: campos.priority,
          dueDate: campos.dueDate,
          status: campos.status,
          premioCents: campos.premioCents,
          tagsJson: campos.tags ? JSON.stringify(campos.tags) : null,
          createdById: userId,
        },
      });

      await tx.blueprintMember.create({
        data: { projectId: novoProjeto.id, userId, role: "PROPRIETARIO", addedById: userId },
      });

      if (membrosIds?.length) {
        const idsUnicos = Array.from(new Set(membrosIds)).filter((id) => id !== userId);
        if (idsUnicos.length) {
          await tx.blueprintMember.createMany({
            data: idsUnicos.map((id) => ({ projectId: novoProjeto.id, userId: id, role: "EDITOR", addedById: userId })),
          });
        }
      }

      await tx.blueprintActivity.create({
        data: {
          projectId: novoProjeto.id,
          userId,
          action: "CRIACAO",
          entityType: "PROJETO",
          newValueJson: JSON.stringify({
            title: campos.title,
            status: campos.status,
            premioCents: campos.premioCents ?? null,
          }),
        },
      });

      return novoProjeto;
    });

    revalidatePath(ROTA_BASE);
    return { success: true, data: projeto };
  } catch (error) {
    console.error("[CriarProjetoBlueprint]", error);
    return { success: false, error: "Erro ao criar projeto" };
  }
}

export async function ObterProjetoBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const projeto = await db.blueprintProject.findUnique({
      where: { id: projectId },
      include: {
        requester: { select: { id: true, nome: true } },
        owner: { select: { id: true, nome: true } },
        developer: { select: { id: true, nome: true } },
        createdBy: { select: { id: true, nome: true } },
        members: { include: { usuario: { select: { id: true, nome: true, imagemUrl: true } } } },
        _count: { select: { files: true, requirements: true, questions: true, comments: true, documents: true, boards: true } },
      },
    });

    if (!projeto) return { success: false, error: "Projeto não encontrado" };
    return { success: true, data: projeto };
  } catch (error) {
    console.error("[ObterProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar projeto";
    return { success: false, error: msg };
  }
}

export async function AtualizarProjetoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = atualizarProjetoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, tags, ...campos } = parsed.data;
    const alterandoPremio = Object.prototype.hasOwnProperty.call(campos, "premioCents");

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarDadosGerais");

    const anterior = await db.blueprintProject.findUnique({ where: { id: projectId } });
    if (!anterior) return { success: false, error: "Projeto não encontrado" };

    if (alterandoPremio && !podeAlterarPremioBlueprint(anterior.createdById, userId)) {
      return { success: false, error: "Apenas o criador do projeto pode alterar o prêmio" };
    }

    const atualizado = await db.$transaction(async (tx) => {
      const projeto = await tx.blueprintProject.update({
        where: { id: projectId },
        data: {
          ...campos,
          tagsJson: tags ? JSON.stringify(tags) : undefined,
          updatedById: userId,
        },
      });

      await tx.blueprintActivity.create({
        data: {
          projectId,
          userId,
          action: "ATUALIZACAO",
          entityType: "PROJETO",
          previousValueJson: JSON.stringify({
            title: anterior.title,
            priority: anterior.priority,
            premioCents: anterior.premioCents,
          }),
          newValueJson: JSON.stringify({
            title: projeto.title,
            priority: projeto.priority,
            premioCents: projeto.premioCents,
          }),
        },
      });

      return projeto;
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/${projectId}`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[AtualizarProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao atualizar projeto";
    return { success: false, error: msg };
  }
}

const TRANSICOES_VALIDAS: Record<string, string[]> = {
  IDEA: ["PRONTO_ESPECIFICACAO", "ARQUIVADO"],
  PRONTO_ESPECIFICACAO: ["EM_ESPECIFICACAO", "IDEA", "ARQUIVADO"],
  EM_ESPECIFICACAO: ["PRONTO_DESENVOLVIMENTO", "PRONTO_ESPECIFICACAO", "ARQUIVADO"],
  PRONTO_DESENVOLVIMENTO: ["EM_DESENVOLVIMENTO", "EM_ESPECIFICACAO", "ARQUIVADO"],
  EM_DESENVOLVIMENTO: ["EM_REVISAO", "PRONTO_DESENVOLVIMENTO", "ARQUIVADO"],
  EM_REVISAO: ["CONCLUIDO", "EM_DESENVOLVIMENTO", "ARQUIVADO"],
  CONCLUIDO: ["ARQUIVADO", "EM_REVISAO"],
  ARQUIVADO: [...BLUEPRINT_STATUS.filter((s) => s !== "ARQUIVADO")],
};

export async function MoverProjetoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = moverProjetoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, novoStatus, justificativa } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "alterarStatus");

    const projeto = await db.blueprintProject.findUnique({ where: { id: projectId }, select: { status: true } });
    if (!projeto) return { success: false, error: "Projeto não encontrado" };

    if (projeto.status === novoStatus) {
      return { success: true };
    }

    const permitidas = TRANSICOES_VALIDAS[projeto.status] ?? [];
    if (!permitidas.includes(novoStatus)) {
      return { success: false, error: `Transição de "${projeto.status}" para "${novoStatus}" não é permitida` };
    }

    await db.$transaction(async (tx) => {
      await tx.blueprintProject.update({
        where: { id: projectId },
        data: { status: novoStatus, updatedById: userId },
      });

      await tx.blueprintActivity.create({
        data: {
          projectId,
          userId,
          action: "MOVER_ETAPA",
          entityType: "PROJETO",
          previousValueJson: JSON.stringify({ status: projeto.status }),
          newValueJson: JSON.stringify({ status: novoStatus }),
          metadataJson: justificativa ? JSON.stringify({ justificativa }) : undefined,
        },
      });
    });

    revalidatePath(ROTA_BASE);
    return { success: true };
  } catch (error) {
    console.error("[MoverProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao mover projeto";
    return { success: false, error: msg };
  }
}

export async function ArquivarProjetoBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "arquivar");

    await db.$transaction(async (tx) => {
      await tx.blueprintProject.update({
        where: { id: projectId },
        data: { status: "ARQUIVADO", archivedAt: new Date(), updatedById: userId },
      });
      await registrarAtividade({ projectId, userId, action: "ARQUIVAMENTO", entityType: "PROJETO" });
    });

    revalidatePath(ROTA_BASE);
    return { success: true };
  } catch (error) {
    console.error("[ArquivarProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao arquivar projeto";
    return { success: false, error: msg };
  }
}

export async function RestaurarProjetoBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "arquivar");

    await db.$transaction(async (tx) => {
      await tx.blueprintProject.update({
        where: { id: projectId },
        data: { status: "IDEA", archivedAt: null, updatedById: userId },
      });
      await registrarAtividade({ projectId, userId, action: "RESTAURACAO", entityType: "PROJETO" });
    });

    revalidatePath(ROTA_BASE);
    return { success: true };
  } catch (error) {
    console.error("[RestaurarProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao restaurar projeto";
    return { success: false, error: msg };
  }
}

/**
 * Exclusão DEFINITIVA (hard delete) de projetos do Alpha Blueprint — apaga em cascata
 * documentos, canvas, arquivos (metadados), requisitos, perguntas, comentários, membros
 * e atividades (ver onDelete: Cascade em schema.prisma). Restrita a Admin/CEO GLOBAL
 * (isAdminRole na sessão) — não é a mesma coisa que a ação "excluir" da matriz de roles
 * por projeto (PERMISSOES_POR_ROLE), que é para o Proprietário do projeto e não se aplica
 * aqui. Exige a senha do próprio usuário autenticado (nunca do dono do projeto).
 */
export async function ExcluirProjetosBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    if (!isAdminRole(session.user.role)) {
      return { success: false, error: "Apenas Admin ou CEO podem excluir projetos definitivamente" };
    }

    const parsed = excluirProjetosSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: "Dados inválidos" };
    const { projectIds, senha } = parsed.data;

    const usuarioBanco = await db.usuarios.findUnique({ where: { id: userId }, select: { senha: true } });
    if (!usuarioBanco) return { success: false, error: "Usuário não encontrado" };

    const senhaCorreta = compareSync(senha, usuarioBanco.senha);
    if (!senhaCorreta) return { success: false, error: "Senha incorreta" };

    const projetos = await db.blueprintProject.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true, code: true },
    });
    if (projetos.length === 0) return { success: false, error: "Nenhum projeto encontrado" };

    const idsEncontrados = projetos.map((p) => p.id);

    // Registrar atividade não faz sentido aqui: BlueprintActivity é apagada em cascata
    // junto com o próprio BlueprintProject na mesma operação — a auditoria desta ação
    // vive só no log de servidor abaixo, fora das tabelas que estão sendo excluídas.
    await db.blueprintProject.deleteMany({ where: { id: { in: idsEncontrados } } });

    console.log(
      `[ExcluirProjetosBlueprint] userId=${userId} excluiu definitivamente: ${projetos.map((p) => `${p.code} (${p.id})`).join(", ")}`,
    );

    revalidatePath(ROTA_BASE);
    return { success: true, data: { excluidos: idsEncontrados.length } };
  } catch (error) {
    console.error("[ExcluirProjetosBlueprint]", error);
    return { success: false, error: "Erro ao excluir projetos" };
  }
}

export async function ListarAtividadeBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const atividades = await db.blueprintActivity.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const usuarioIds = Array.from(new Set(atividades.map((a) => a.userId)));
    const usuariosMap = new Map(
      (await db.usuarios.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]),
    );

    return {
      success: true,
      data: atividades.map((a) => ({ ...a, nomeUsuario: usuariosMap.get(a.userId) ?? "Usuário" })),
    };
  } catch (error) {
    console.error("[ListarAtividadeBlueprint]", error);
    return { success: false, error: "Erro ao buscar atividade", data: [] };
  }
}

export async function DuplicarProjetoBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const original = await db.blueprintProject.findUnique({ where: { id: projectId } });
    if (!original) return { success: false, error: "Projeto não encontrado" };

    const copia = await db.$transaction(async (tx) => {
      const novo = await tx.blueprintProject.create({
        data: {
          code: gerarCodigoProjeto(),
          title: `${original.title} (cópia)`,
          summary: original.summary,
          problem: original.problem,
          objective: original.objective,
          setor: original.setor,
          requesterId: original.requesterId,
          priority: original.priority,
          status: "IDEA",
          tagsJson: original.tagsJson,
          createdById: userId,
        },
      });

      await tx.blueprintMember.create({
        data: { projectId: novo.id, userId, role: "PROPRIETARIO", addedById: userId },
      });

      await tx.blueprintActivity.create({
        data: { projectId: novo.id, userId, action: "CRIACAO", entityType: "PROJETO", metadataJson: JSON.stringify({ duplicadoDe: projectId }) },
      });

      return novo;
    });

    revalidatePath(ROTA_BASE);
    return { success: true, data: copia };
  } catch (error) {
    console.error("[DuplicarProjetoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao duplicar projeto";
    return { success: false, error: msg };
  }
}
