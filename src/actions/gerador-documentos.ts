"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import { OnyxError } from "@/lib/onyx/client";
import {
  exigirAcessoModulo,
  exigirOwnershipTemplate,
  exigirOwnershipDocumento,
} from "@/lib/gerador-documentos/ownership";
import {
  CriarTemplateSchema,
  AtualizarTemplateSchema,
  CriarClasulaSchema,
  AtualizarClasulaSchema,
  ReordenarClasulasSchema,
  GerarDocumentoSchema,
  ReescreverClasulaSchema,
  EditarClasulaGeradaSchema,
  VariavelTemplateSchema,
  type VariavelTemplate,
} from "@/lib/gerador-documentos/schemas";
import { renderizarConteudo, validarVariaveisObrigatorias } from "@/lib/gerador-documentos/render";
import { reescreverClasulaViaIA } from "@/lib/gerador-documentos/onyx";

const ROTA_BASE = "/PainelAlpha/GeradorDocumentos";

async function getSessao() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role ?? null;
  return { userId, role };
}

function parseVariaveisJson(json: unknown): VariavelTemplate[] {
  const parsed = z.array(VariavelTemplateSchema).safeParse(json);
  return parsed.success ? parsed.data : [];
}

function mensagemErro(error: unknown): string {
  if (error instanceof OnyxError) return error.message;
  if (error instanceof z.ZodError) return "Dados inválidos";
  if (error instanceof Error) {
    if (["Não autenticado", "Não autorizado", "Template não encontrado", "Documento não encontrado"].includes(error.message)) {
      return error.message;
    }
  }
  return "Não foi possível concluir a operação";
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function ListarTemplatesDocumentos() {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const where = ctx.isAdmin ? {} : { criadoPorId: userId };
    const templates = await db.documentoTemplate.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        categoria: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { clausulas: true, documentos: true } },
      },
    });

    return { success: true as const, data: templates };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

export async function ObterTemplateDocumento(templateId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipTemplate(templateId, ctx);

    const template = await db.documentoTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { clausulas: { orderBy: { ordem: "asc" } } },
    });

    return {
      success: true as const,
      data: { ...template, variaveis: parseVariaveisJson(template.variaveisJson) },
    };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function CriarTemplateDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = CriarTemplateSchema.parse(payload);

    const nomesVariaveis = new Set(input.variaveis.map((v) => v.nome));
    if (nomesVariaveis.size !== input.variaveis.length) {
      return { success: false as const, error: "Nomes de variáveis duplicados" };
    }

    const template = await db.$transaction(async (tx) => {
      const criado = await tx.documentoTemplate.create({
        data: {
          titulo: input.titulo,
          descricao: input.descricao,
          categoria: input.categoria,
          variaveisJson: JSON.stringify(input.variaveis),
          criadoPorId: ctx.userId,
        },
      });
      await tx.documentoClasula.createMany({
        data: input.clausulas.map((c, ordem) => ({
          templateId: criado.id,
          ordem,
          titulo: c.titulo,
          conteudo: c.conteudo,
          tipo: c.tipo,
          editavel: c.editavel,
        })),
      });
      return criado;
    });

    revalidatePath(ROTA_BASE);
    return { success: true as const, templateId: template.id };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function AtualizarTemplateDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = AtualizarTemplateSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    if (input.variaveis) {
      const nomesVariaveis = new Set(input.variaveis.map((v) => v.nome));
      if (nomesVariaveis.size !== input.variaveis.length) {
        return { success: false as const, error: "Nomes de variáveis duplicados" };
      }
    }

    await db.documentoTemplate.update({
      where: { id: input.templateId },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(input.variaveis !== undefined ? { variaveisJson: JSON.stringify(input.variaveis) } : {}),
      },
    });

    revalidatePath(ROTA_BASE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ArquivarTemplateDocumento(templateId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipTemplate(templateId, ctx);

    await db.documentoTemplate.update({ where: { id: templateId }, data: { status: "ARQUIVADO" } });
    revalidatePath(ROTA_BASE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

// ─── Cláusulas de template ──────────────────────────────────────────────────

export async function CriarClasulaTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = CriarClasulaSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    const total = await db.documentoClasula.count({ where: { templateId: input.templateId } });
    if (total >= 200) {
      return { success: false as const, error: "Limite de 200 cláusulas por template atingido" };
    }

    const clasula = await db.documentoClasula.create({
      data: {
        templateId: input.templateId,
        ordem: input.ordem,
        titulo: input.titulo,
        conteudo: input.conteudo,
        tipo: input.tipo,
        editavel: input.editavel,
      },
    });

    revalidatePath(`${ROTA_BASE}/${input.templateId}`);
    return { success: true as const, data: clasula };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function AtualizarClasulaTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = AtualizarClasulaSchema.parse(payload);

    const clasula = await db.documentoClasula.findUnique({
      where: { id: input.clasulaId },
      select: { templateId: true },
    });
    if (!clasula) return { success: false as const, error: "Cláusula não encontrada" };
    await exigirOwnershipTemplate(clasula.templateId, ctx);

    await db.documentoClasula.update({
      where: { id: input.clasulaId },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.conteudo !== undefined ? { conteudo: input.conteudo } : {}),
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.editavel !== undefined ? { editavel: input.editavel } : {}),
      },
    });

    revalidatePath(`${ROTA_BASE}/${clasula.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function RemoverClasulaTemplate(clasulaId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const clasula = await db.documentoClasula.findUnique({
      where: { id: clasulaId },
      select: { templateId: true },
    });
    if (!clasula) return { success: false as const, error: "Cláusula não encontrada" };
    await exigirOwnershipTemplate(clasula.templateId, ctx);

    await db.documentoClasula.delete({ where: { id: clasulaId } });
    revalidatePath(`${ROTA_BASE}/${clasula.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ReordenarClasulasTemplate(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = ReordenarClasulasSchema.parse(payload);
    await exigirOwnershipTemplate(input.templateId, ctx);

    const clausulasExistentes = await db.documentoClasula.findMany({
      where: { templateId: input.templateId },
      select: { id: true },
    });
    const idsExistentes = new Set(clausulasExistentes.map((c) => c.id));
    if (input.ordem.length !== idsExistentes.size || !input.ordem.every((id) => idsExistentes.has(id))) {
      return { success: false as const, error: "Lista de ordenação não corresponde às cláusulas do template" };
    }

    // Offset temporário evita colidir com a constraint @@unique([templateId, ordem])
    // durante a reordenação (mesmo padrão de shift usado no Roadmap Alpha).
    await db.$transaction([
      ...input.ordem.map((id, i) =>
        db.documentoClasula.update({ where: { id }, data: { ordem: i + 1_000_000 } }),
      ),
      ...input.ordem.map((id, i) => db.documentoClasula.update({ where: { id }, data: { ordem: i } })),
    ]);

    revalidatePath(`${ROTA_BASE}/${input.templateId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

// ─── Geração de documento ───────────────────────────────────────────────────

export async function GerarDocumento(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = GerarDocumentoSchema.parse(payload);

    const template = await db.documentoTemplate.findUnique({
      where: { id: input.templateId },
      include: { clausulas: { orderBy: { ordem: "asc" } } },
    });
    if (!template) return { success: false as const, error: "Template não encontrado" };
    if (!ctx.isAdmin && template.criadoPorId !== ctx.userId) {
      return { success: false as const, error: "Não autorizado" };
    }
    if (template.status === "ARQUIVADO") {
      return { success: false as const, error: "Este template está arquivado" };
    }

    const variaveisTemplate = parseVariaveisJson(template.variaveisJson);
    const faltando = validarVariaveisObrigatorias(variaveisTemplate, input.variaveis);
    if (faltando.length > 0) {
      return { success: false as const, error: `Variáveis obrigatórias ausentes: ${faltando.join(", ")}` };
    }

    const tokenAcesso = randomUUID();
    const documento = await db.$transaction(async (tx) => {
      const criado = await tx.documentoGerado.create({
        data: {
          templateId: template.id,
          titulo: input.titulo,
          variaveisJson: JSON.stringify(input.variaveis),
          tokenAcesso,
          criadoPorId: ctx.userId,
          status: "CONFERENCIA",
        },
      });
      await tx.documentoClasulaGerada.createMany({
        data: template.clausulas.map((c) => ({
          documentoId: criado.id,
          ordem: c.ordem,
          titulo: c.titulo,
          conteudo: renderizarConteudo(c.conteudo, variaveisTemplate, input.variaveis),
          conteudoOriginal: c.conteudo,
        })),
      });
      return criado;
    });

    revalidatePath(ROTA_BASE);
    return {
      success: true as const,
      documentoId: documento.id,
      urlConferencia: `${ROTA_BASE}/conferencia/${documento.tokenAcesso}`,
    };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ListarDocumentosGerados() {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const where = ctx.isAdmin ? {} : { criadoPorId: userId };
    const documentos = await db.documentoGerado.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        titulo: true,
        status: true,
        tokenAcesso: true,
        criadoEm: true,
        finalizadoEm: true,
        template: { select: { id: true, titulo: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    });

    return { success: true as const, data: documentos };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

// ─── Conferência ─────────────────────────────────────────────────────────────

export async function ObterDocumentoConferencia(tokenAcesso: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);

    const documento = await db.documentoGerado.findUnique({
      where: { tokenAcesso },
      include: { clausulas: { orderBy: { ordem: "asc" } }, template: { select: { titulo: true } } },
    });
    if (!documento) return { success: false as const, error: "Documento não encontrado" };
    if (!ctx.isAdmin && documento.criadoPorId !== ctx.userId) {
      return { success: false as const, error: "Não autorizado" };
    }

    return { success: true as const, data: documento };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function EditarClasulaGerada(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = EditarClasulaGeradaSchema.parse(payload);
    await exigirOwnershipDocumento(input.documentoId, ctx);

    await db.documentoClasulaGerada.updateMany({
      where: { id: input.clasulaId, documentoId: input.documentoId },
      data: { conteudo: input.conteudo },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ReescreverClasulaComIA(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    const input = ReescreverClasulaSchema.parse(payload);
    const documento = await exigirOwnershipDocumento(input.documentoId, ctx);

    const [clasula, todasClausulas] = await Promise.all([
      db.documentoClasulaGerada.findUnique({ where: { id: input.clasulaId } }),
      db.documentoClasulaGerada.findMany({
        where: { documentoId: documento.id },
        orderBy: { ordem: "asc" },
        select: { titulo: true, conteudo: true },
      }),
    ]);
    if (!clasula || clasula.documentoId !== documento.id) {
      return { success: false as const, error: "Cláusula não encontrada" };
    }

    const contextoContrato = todasClausulas.map((c) => `${c.titulo}\n${c.conteudo}`).join("\n\n");
    const userToken = await getUserOnyxToken(ctx.userId);

    const novoTexto = await reescreverClasulaViaIA({
      contextoContrato,
      tituloClasula: clasula.titulo,
      textoAtual: clasula.conteudo,
      instrucao: input.instrucao,
      userToken,
    });

    await db.documentoClasulaGerada.update({
      where: { id: clasula.id },
      data: { conteudo: novoTexto, reescritoPorIA: true, instrucaoIA: input.instrucao },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const, conteudo: novoTexto };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function FinalizarDocumento(documentoId: string) {
  try {
    const { userId, role } = await getSessao();
    const ctx = await exigirAcessoModulo(userId, role);
    await exigirOwnershipDocumento(documentoId, ctx);

    await db.documentoGerado.update({
      where: { id: documentoId },
      data: { status: "FINALIZADO", finalizadoEm: new Date() },
    });

    revalidatePath(`${ROTA_BASE}/conferencia`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}
