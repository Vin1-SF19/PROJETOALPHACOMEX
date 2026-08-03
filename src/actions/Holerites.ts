"use server";

import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import type { Session } from "next-auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Roles com acesso de gestão ────────────────────────────────────────────────

const ROLES_GESTAO = ["FINANCEIRO", "RECURSOS HUMANOS"] as const;

function podeGestao(role: string): boolean {
  return isAdminRole(role) || (ROLES_GESTAO as readonly string[]).includes(role);
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function gerarCompetencia(mes: number, ano: number): string {
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${nomes[mes - 1]}/${ano}`;
}

function sessionUser(session: Session | null) {
  return session?.user as { id: string; role: string; nome?: string } | undefined;
}

// ─── getMeusHolerites ──────────────────────────────────────────────────────────

export async function getMeusHolerites(ano?: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const userId = Number(user.id);
  const anoFiltro = ano || new Date().getFullYear();

  try {
    const holerites = await db.holerite.findMany({
      where: { colaboradorId: userId, ano: anoFiltro },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
      include: { uploadedBy: { select: { nome: true } } },
    });
    return { success: true as const, data: holerites };
  } catch (e) {
    const err = e as Error;
    console.error("[getMeusHolerites]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── getHoleritesGeral ─────────────────────────────────────────────────────────

const filtrosSchema = z.object({
  ano: z.number().int().optional(),
  mes: z.number().int().min(1).max(12).optional(),
  status: z.enum(["PENDENTE", "VALIDADO", "REJEITADO"]).optional(),
  busca: z.string().max(100).optional(),
});

export async function getHoleritesGeral(filtros: z.infer<typeof filtrosSchema> = {}) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };
  if (!podeGestao(user.role)) return { success: false as const, error: "Acesso negado" };

  const parsed = filtrosSchema.safeParse(filtros);
  if (!parsed.success) return { success: false as const, error: "Filtros inválidos" };

  const { ano, mes, status, busca } = parsed.data;

  try {
    const holerites = await db.holerite.findMany({
      where: {
        ...(ano && { ano }),
        ...(mes && { mes }),
        ...(status && { status }),
        ...(busca && { colaborador: { nome: { contains: busca } } }),
      },
      include: {
        colaborador: { select: { id: true, nome: true, imagemUrl: true, cargo: true } },
        uploadedBy: { select: { nome: true } },
      },
      orderBy: [{ ano: "desc" }, { mes: "desc" }, { colaboradorId: "asc" }],
    });
    return { success: true as const, data: holerites };
  } catch (e) {
    const err = e as Error;
    console.error("[getHoleritesGeral]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── getEstatisticasHolerites ──────────────────────────────────────────────────

export async function getEstatisticasHolerites(ano: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };
  if (!podeGestao(user.role)) return { success: false as const, error: "Acesso negado" };

  const anoSchema = z.number().int().min(2020).max(2099);
  if (!anoSchema.safeParse(ano).success) return { success: false as const, error: "Ano inválido" };

  try {
    const [total, pendentes, validados, rejeitados] = await Promise.all([
      db.holerite.count({ where: { ano } }),
      db.holerite.count({ where: { ano, status: "PENDENTE" } }),
      db.holerite.count({ where: { ano, status: "VALIDADO" } }),
      db.holerite.count({ where: { ano, status: "REJEITADO" } }),
    ]);
    return { success: true as const, data: { total, pendentes, validados, rejeitados } };
  } catch (e) {
    const err = e as Error;
    console.error("[getEstatisticasHolerites]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── getColaboradoresSemHolerite ───────────────────────────────────────────────

export async function getColaboradoresSemHolerite(mes: number, ano: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };
  if (!podeGestao(user.role)) return { success: false as const, error: "Acesso negado" };

  const inputSchema = z.object({
    mes: z.number().int().min(1).max(12),
    ano: z.number().int().min(2020).max(2099),
  });
  if (!inputSchema.safeParse({ mes, ano }).success) return { success: false as const, error: "Dados inválidos" };

  try {
    const [todosAtivos, comHolerite] = await Promise.all([
      db.usuarios.findMany({
        where: { status: "ATIVO" },
        select: { id: true, nome: true, cargo: true, imagemUrl: true },
      }),
      db.holerite.findMany({
        where: { mes, ano },
        select: { colaboradorId: true },
      }),
    ]);

    const idsComHolerite = new Set(comHolerite.map((h) => h.colaboradorId));
    const semHolerite = todosAtivos.filter((c) => !idsComHolerite.has(c.id));

    return { success: true as const, data: semHolerite };
  } catch (e) {
    const err = e as Error;
    console.error("[getColaboradoresSemHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── uploadHolerite ────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  colaboradorId: z.number().int().positive(),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2099),
  arquivoUrl: z.string().url(),
  arquivoNome: z.string().min(1).max(255),
  arquivoTamanho: z.number().int().positive().max(10 * 1024 * 1024),
  assinado: z.boolean(),
  observacao: z.string().max(1000).optional(),
});

export async function uploadHolerite(data: z.infer<typeof uploadSchema>) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const userId = Number(user.id);
  const isAdmin = isAdminRole(user.role);

  // Colaborador só pode fazer upload dos próprios holerites
  if (!isAdmin && data.colaboradorId !== userId) {
    return { success: false as const, error: "Você só pode enviar seus próprios holerites" };
  }

  const parsed = uploadSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: "Dados inválidos", details: parsed.error.flatten() };
  }

  const { colaboradorId, mes, ano, arquivoUrl, arquivoNome, arquivoTamanho, assinado, observacao } =
    parsed.data;

  try {
    // Verificar duplicata (@@unique garante, mas dar mensagem clara)
    const existente = await db.holerite.findUnique({
      where: { colaboradorId_mes_ano: { colaboradorId, mes, ano } },
      select: { id: true },
    });

    if (existente) {
      return {
        success: false as const,
        error: `Já existe um holerite enviado para ${gerarCompetencia(mes, ano)}. Para reenviar, contate o financeiro.`,
      };
    }

    const holerite = await db.holerite.create({
      data: {
        colaboradorId,
        mes,
        ano,
        competencia: gerarCompetencia(mes, ano),
        arquivoUrl,
        arquivoNome,
        arquivoTamanho,
        assinado,
        assinadoEm: assinado ? new Date() : null,
        status: "PENDENTE",
        uploadedById: userId,
        observacao,
      },
    });

    revalidatePath("/PainelAlpha/Holerites");
    return { success: true as const, data: holerite };
  } catch (e) {
    const err = e as Error;
    console.error("[uploadHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── validarHolerite ───────────────────────────────────────────────────────────

export async function validarHolerite(id: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const role = user.role;
  if (!podeGestao(role)) {
    return { success: false as const, error: "Acesso negado" };
  }

  if (!z.number().int().positive().safeParse(id).success) {
    return { success: false as const, error: "ID inválido" };
  }

  try {
    await db.holerite.update({
      where: { id },
      data: {
        status: "VALIDADO",
        validadoPor: Number(user.id),
        validadoEm: new Date(),
        motivoRejeicao: null,
      },
    });
    revalidatePath("/PainelAlpha/Holerites");
    return { success: true as const };
  } catch (e) {
    const err = e as Error;
    console.error("[validarHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── rejeitarHolerite ──────────────────────────────────────────────────────────

const rejeicaoSchema = z.object({
  id: z.number().int().positive(),
  motivo: z.string().min(5, "Motivo deve ter ao menos 5 caracteres").max(500),
});

export async function rejeitarHolerite(id: number, motivo: string) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const role = user.role;
  if (!podeGestao(role)) {
    return { success: false as const, error: "Acesso negado" };
  }

  const parsed = rejeicaoSchema.safeParse({ id, motivo });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message || "Dados inválidos" };
  }

  try {
    await db.holerite.update({
      where: { id: parsed.data.id },
      data: {
        status: "REJEITADO",
        validadoPor: Number(user.id),
        validadoEm: new Date(),
        motivoRejeicao: parsed.data.motivo,
      },
    });
    revalidatePath("/PainelAlpha/Holerites");
    return { success: true as const };
  } catch (e) {
    const err = e as Error;
    console.error("[rejeitarHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── deletarHolerite (Admin apenas) ───────────────────────────────────────────

export async function deletarHolerite(id: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  if (!isAdminRole(user.role)) {
    return { success: false as const, error: "Apenas administradores podem deletar holerites" };
  }

  if (!z.number().int().positive().safeParse(id).success) {
    return { success: false as const, error: "ID inválido" };
  }

  try {
    const holerite = await db.holerite.findUnique({
      where: { id },
      select: { id: true, colaboradorId: true, mes: true, ano: true },
    });
    if (!holerite) return { success: false as const, error: "Holerite não encontrado" };

    // Log sem PII: apenas IDs e competência
    console.log(
      `[deletarHolerite] adminId=${user.id} holeriteId=${id} colaboradorId=${holerite.colaboradorId} ${holerite.mes}/${holerite.ano}`,
    );

    await db.holerite.delete({ where: { id } });

    revalidatePath("/PainelAlpha/Holerites");
    return { success: true as const };
  } catch (e) {
    const err = e as Error;
    console.error("[deletarHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── substituirHolerite ────────────────────────────────────────────────────────

const substituirSchema = z.object({
  arquivoUrl: z.string().url(),
  arquivoNome: z.string().min(1).max(255),
  arquivoTamanho: z.number().int().positive().max(10 * 1024 * 1024),
  assinado: z.boolean(),
  observacao: z.string().max(1000).optional(),
});

export async function substituirHolerite(id: number, data: z.infer<typeof substituirSchema>) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const userId = Number(user.id);

  if (!z.number().int().positive().safeParse(id).success) {
    return { success: false as const, error: "ID inválido" };
  }

  const holerite = await db.holerite.findUnique({
    where: { id },
    select: { colaboradorId: true, status: true },
  });
  if (!holerite) return { success: false as const, error: "Holerite não encontrado" };

  if (!podeGestao(user.role) && holerite.colaboradorId !== userId) {
    return { success: false as const, error: "Sem permissão" };
  }

  if (holerite.status !== "REJEITADO") {
    return { success: false as const, error: "Só é possível substituir holerites rejeitados" };
  }

  const parsed = substituirSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  try {
    const atualizado = await db.holerite.update({
      where: { id },
      data: {
        arquivoUrl: d.arquivoUrl,
        arquivoNome: d.arquivoNome,
        arquivoTamanho: d.arquivoTamanho,
        assinado: d.assinado,
        assinadoEm: d.assinado ? new Date() : null,
        observacao: d.observacao ?? null,
        status: "PENDENTE",
        motivoRejeicao: null,
        validadoPor: null,
        validadoEm: null,
        uploadedAt: new Date(),
        uploadedById: userId,
      },
    });
    revalidatePath("/PainelAlpha/Holerites");
    return { success: true as const, data: atualizado };
  } catch (e) {
    const err = e as Error;
    console.error("[substituirHolerite]", err.message);
    return { success: false as const, error: err.message };
  }
}

// ─── getHoleriteById ───────────────────────────────────────────────────────────

export async function getHoleriteById(id: number) {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id) return { success: false as const, error: "Não autorizado" };

  const userId = Number(user.id);
  const podeTudo = podeGestao(user.role);

  if (!z.number().int().positive().safeParse(id).success) {
    return { success: false as const, error: "ID inválido" };
  }

  try {
    const holerite = await db.holerite.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, imagemUrl: true, cargo: true } },
        uploadedBy: { select: { nome: true } },
      },
    });

    if (!holerite) return { success: false as const, error: "Holerite não encontrado" };

    // Ownership check — colaborador comum só vê o seu
    if (!podeTudo && holerite.colaboradorId !== userId) {
      return { success: false as const, error: "Acesso negado" };
    }

    // Nunca expor arquivoUrl direto para colaborador comum
    const dado = podeTudo
      ? holerite
      : { ...holerite, arquivoUrl: "[PROTEGIDO — use /api/holerites/{id}/download]" };

    return { success: true as const, data: dado };
  } catch (e) {
    const err = e as Error;
    console.error("[getHoleriteById]", err.message);
    return { success: false as const, error: err.message };
  }
}
