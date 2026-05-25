"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { Resend } from "resend";
import { hashSync } from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onboardingTemplateModel = (db as any).onboardingTemplate;

const resend = new Resend(process.env.RESEND_API_KEY);

export type OnboardingTemplate = {
  id: number;
  nome: string;
  setor: string | null;
  mensagem: string;
  ativo: boolean;
  padrao: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const role = session.user.role;
  if (role !== "Admin" && role !== "CEO") throw new Error("Permissão insuficiente");
  return session;
}

export async function listarTemplatesOnboarding(setor?: string): Promise<OnboardingTemplate[]> {
  try {
    const templates = await onboardingTemplateModel.findMany({
      where: {
        ativo: true,
        ...(setor ? { OR: [{ setor }, { setor: null }] } : {}),
      },
      orderBy: [{ padrao: "desc" }, { nome: "asc" }],
    });
    return templates as OnboardingTemplate[];
  } catch {
    return [];
  }
}

export async function listarTodosTemplatesOnboarding(): Promise<OnboardingTemplate[]> {
  try {
    const templates = await onboardingTemplateModel.findMany({
      orderBy: [{ padrao: "desc" }, { nome: "asc" }],
    });
    return templates as OnboardingTemplate[];
  } catch {
    return [];
  }
}

export async function criarTemplateOnboarding(dados: {
  nome: string;
  setor?: string;
  mensagem: string;
  padrao?: boolean;
}) {
  try {
    await requireAdmin();
    if (!dados.nome.trim() || !dados.mensagem.trim()) {
      return { success: false, error: "Nome e mensagem são obrigatórios." };
    }
    if (dados.padrao) {
      await onboardingTemplateModel.updateMany({ data: { padrao: false } });
    }
    const novo = await onboardingTemplateModel.create({
      data: {
        nome: dados.nome.trim(),
        setor: dados.setor?.trim() || null,
        mensagem: dados.mensagem.trim(),
        padrao: dados.padrao ?? false,
      },
    });
    revalidatePath("/PainelAlpha/GestaoOnboarding");
    return { success: true, data: novo as OnboardingTemplate };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao criar template." };
  }
}

export async function atualizarTemplateOnboarding(
  id: number,
  dados: { nome: string; setor?: string; mensagem: string; ativo: boolean; padrao: boolean }
) {
  try {
    await requireAdmin();
    if (dados.padrao) {
      await onboardingTemplateModel.updateMany({
        where: { id: { not: id } },
        data: { padrao: false },
      });
    }
    await onboardingTemplateModel.update({
      where: { id },
      data: {
        nome: dados.nome.trim(),
        setor: dados.setor?.trim() || null,
        mensagem: dados.mensagem.trim(),
        ativo: dados.ativo,
        padrao: dados.padrao,
      },
    });
    revalidatePath("/PainelAlpha/GestaoOnboarding");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao atualizar." };
  }
}

export async function excluirTemplateOnboarding(id: number) {
  try {
    await requireAdmin();
    await onboardingTemplateModel.delete({ where: { id } });
    revalidatePath("/PainelAlpha/GestaoOnboarding");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao excluir." };
  }
}

export async function salvarOnboardingLog(dados: {
  usuarioId: number;
  templateId?: number;
  tipoEnvio: string;
  telefone?: string;
  email?: string;
}) {
  try {
    const session = await auth();
    if (!session) return { success: false, error: "Não autorizado" };

    const criadoPorId = Number(session.user.id);

    await db.$executeRawUnsafe(
      `INSERT INTO onboarding_log (usuarioId, criadoPorId, templateId, tipoEnvio, telefone, email, enviadoEm) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      dados.usuarioId,
      criadoPorId,
      dados.templateId ?? null,
      dados.tipoEnvio,
      dados.telefone ?? null,
      dados.email ?? null,
      new Date().toISOString()
    );

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao salvar log." };
  }
}

export async function enviarEmailOnboarding(dados: {
  usuarioId: number;
  email: string;
  mensagem: string;
  templateId?: number;
}) {
  try {
    const session = await auth();
    if (!session) return { success: false, error: "Não autorizado" };

    const usuarioDb = await db.usuarios.findUnique({
      where: { id: dados.usuarioId },
      select: { nome: true },
    });

    const linhasHtml = dados.mensagem
      .split("\n")
      .map((l) => `<p style="margin:4px 0;font-size:14px;color:#cbd5e1;">${l || "&nbsp;"}</p>`)
      .join("");

    await resend.emails.send({
      from: "Painel Alpha <onboarding@resend.dev>",
      to: dados.email,
      subject: `Bem-vindo ao Painel Alpha, ${usuarioDb?.nome ?? ""}!`,
      html: `
        <div style="font-family:sans-serif;background:#020617;padding:40px;border-radius:20px;max-width:600px;margin:0 auto;">
          <h1 style="color:#6366f1;text-transform:uppercase;font-style:italic;margin-bottom:24px;">
            Painel Alpha
          </h1>
          <div style="background:#0f172a;border-radius:12px;padding:24px;border:1px solid rgba(99,102,241,0.2);">
            ${linhasHtml}
          </div>
          <p style="margin-top:24px;font-size:11px;color:#475569;">
            Este é um e-mail automático gerado pelo sistema Alpha.
          </p>
        </div>
      `,
    });

    await salvarOnboardingLog({
      usuarioId: dados.usuarioId,
      templateId: dados.templateId,
      tipoEnvio: "EMAIL",
      email: dados.email,
    });

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao enviar e-mail." };
  }
}

export async function trocarSenhaObrigatoria(novaSenha: string) {
  try {
    const session = await auth();
    if (!session) return { success: false, error: "Não autorizado" };

    if (novaSenha.length < 6) {
      return { success: false, error: "Senha deve ter no mínimo 6 caracteres." };
    }

    const senhaHash = hashSync(novaSenha, 10);

    await db.$executeRawUnsafe(
      `UPDATE usuarios SET senha = ?, senhaTemporaria = 0, primeiroAcessoEm = ? WHERE id = ?`,
      senhaHash,
      new Date().toISOString(),
      Number(session.user.id)
    );

    revalidatePath("/PainelAlpha");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao alterar senha." };
  }
}
