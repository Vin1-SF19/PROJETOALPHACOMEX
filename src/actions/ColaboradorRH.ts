"use server";

import { z } from "zod";
import { auth } from "../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hashSync } from "bcryptjs";

// ─── Role helpers ─────────────────────────────────────────────────────────────

function isAdminOrCeo(role: string) {
  return role === "Admin" || role === "CEO";
}

function isRHOrAbove(role: string) {
  return ["Admin", "CEO", "RECURSOS HUMANOS", "FINANCEIRO"].includes(role);
}

async function requireRHOrAbove() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autorizado");
  const userId = Number((session.user as { id?: string }).id);
  const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
  const role = dbUser?.role ?? "";
  if (!isRHOrAbove(role)) throw new Error("Sem permissão");
  return { userId, role };
}

// ─── Cargos ───────────────────────────────────────────────────────────────────

export async function getCargos() {
  try {
    const cargos = await db.cargoColaborador.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    return { success: true as const, cargos };
  } catch {
    return { success: false as const, error: "Erro ao buscar cargos" };
  }
}

export async function createCargo(nome: string) {
  await requireRHOrAbove();
  const parsed = z.string().min(2).max(80).safeParse(nome.trim());
  if (!parsed.success) return { success: false as const, error: "Nome inválido" };

  try {
    const cargo = await db.cargoColaborador.upsert({
      where: { nome: parsed.data },
      update: { ativo: true },
      create: { nome: parsed.data },
    });
    return { success: true as const, cargo };
  } catch {
    return { success: false as const, error: "Erro ao criar cargo" };
  }
}

// ─── Modalidades ──────────────────────────────────────────────────────────────

export async function getModalidades() {
  try {
    const modalidades = await db.modalidadeContrato.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    return { success: true as const, modalidades };
  } catch {
    return { success: false as const, error: "Erro ao buscar modalidades" };
  }
}

export async function createModalidade(nome: string) {
  await requireRHOrAbove();
  const parsed = z.string().min(2).max(80).safeParse(nome.trim());
  if (!parsed.success) return { success: false as const, error: "Nome inválido" };

  try {
    const modalidade = await db.modalidadeContrato.upsert({
      where: { nome: parsed.data },
      update: { ativo: true },
      create: { nome: parsed.data },
    });
    return { success: true as const, modalidade };
  } catch {
    return { success: false as const, error: "Erro ao criar modalidade" };
  }
}

// ─── Colaborador completo ─────────────────────────────────────────────────────

export async function getColaboradorCompleto(usuarioId: number) {
  await requireRHOrAbove();

  try {
    const usuario = await db.usuarios.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        usuario: true,
        email: true,
        role: true,
        imagemUrl: true,
        cargo: true,
        status: true,
        data_contratacao: true,
        cpf: true,
        data_nascimento: true,
        telefone: true,
        telefone_corporativo: true,
        contato_emerg_1_nome: true,
        contato_emerg_1_tel: true,
        contato_emerg_2_nome: true,
        contato_emerg_2_tel: true,
        observacoes_internas: true,
        contratosColaborador: {
          orderBy: { createdAt: "desc" },
        },
        checklistDocumental: true,
      },
    });

    if (!usuario) return { success: false as const, error: "Usuário não encontrado" };

    return { success: true as const, usuario };
  } catch {
    return { success: false as const, error: "Erro ao buscar dados" };
  }
}

// ─── Atualizar dados pessoais ─────────────────────────────────────────────────

const UpdateDadosSchema = z.object({
  nome: z.string().min(1),
  usuario: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  cargo: z.string().optional(),
  status: z.string().optional(),
  data_contratacao: z.string().optional(),
  cpf: z.string().optional(),
  data_nascimento: z.string().optional(),
  telefone: z.string().optional(),
  telefone_corporativo: z.string().optional(),
  contato_emerg_1_nome: z.string().optional(),
  contato_emerg_1_tel: z.string().optional(),
  contato_emerg_2_nome: z.string().optional(),
  contato_emerg_2_tel: z.string().optional(),
  observacoes_internas: z.string().optional(),
  imagemUrl: z.string().optional(),
});

export async function updateColaboradorDados(usuarioId: number, raw: unknown) {
  const { role: currentRole } = await requireRHOrAbove();

  const parsed = UpdateDadosSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  const d = parsed.data;

  // Financeiro não pode alterar role
  if (!isAdminOrCeo(currentRole) && currentRole !== "RECURSOS HUMANOS") {
    d.role = (await db.usuarios.findUnique({ where: { id: usuarioId }, select: { role: true } }))?.role ?? d.role;
  }

  try {
    await db.usuarios.update({
      where: { id: usuarioId },
      data: {
        nome: d.nome,
        usuario: d.usuario,
        email: d.email,
        role: d.role,
        cargo: d.cargo ?? null,
        status: d.status ?? "ATIVO",
        data_contratacao: d.data_contratacao ?? null,
        cpf: d.cpf ?? null,
        data_nascimento: d.data_nascimento ?? null,
        telefone: d.telefone ?? null,
        telefone_corporativo: d.telefone_corporativo ?? null,
        contato_emerg_1_nome: d.contato_emerg_1_nome ?? null,
        contato_emerg_1_tel: d.contato_emerg_1_tel ?? null,
        contato_emerg_2_nome: d.contato_emerg_2_nome ?? null,
        contato_emerg_2_tel: d.contato_emerg_2_tel ?? null,
        observacoes_internas: d.observacoes_internas ?? null,
        ...(d.imagemUrl ? { imagemUrl: d.imagemUrl } : {}),
      },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Erro ao atualizar dados" };
  }
}

// ─── Contratos ────────────────────────────────────────────────────────────────

const CreateContratoSchema = z.object({
  tipo: z.enum(["EXPERIENCIA", "EFETIVO"]),
  modalidade: z.string().min(1),
  dataInicio: z.string().min(1),
  observacoes: z.string().optional(),
  contratoUrl: z.string().optional(),
});

export async function criarContratoColaborador(usuarioId: number, raw: unknown) {
  await requireRHOrAbove();

  const parsed = CreateContratoSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const dataInicio = new Date(d.dataInicio);

  // Experiência: +45 dias
  let dataFim: Date | null = null;
  if (d.tipo === "EXPERIENCIA") {
    dataFim = new Date(dataInicio);
    dataFim.setDate(dataFim.getDate() + 45);
  }

  try {
    const contrato = await db.contratoColaborador.create({
      data: {
        usuarioId,
        tipo: d.tipo,
        modalidade: d.modalidade,
        dataInicio,
        dataFim,
        status: d.tipo === "EXPERIENCIA" ? "EXPERIENCIA" : "EFETIVADO",
        contratoUrl: d.contratoUrl ?? null,
        observacoes: d.observacoes ?? null,
      },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const, contrato };
  } catch {
    return { success: false as const, error: "Erro ao criar contrato" };
  }
}

export async function renovarContratoColaborador(contratoId: string) {
  await requireRHOrAbove();

  try {
    const contrato = await db.contratoColaborador.findUnique({ where: { id: contratoId } });
    if (!contrato) return { success: false as const, error: "Contrato não encontrado" };
    if (!["EXPERIENCIA", "RENOVADA"].includes(contrato.status)) {
      return { success: false as const, error: "Contrato não pode ser renovado neste status" };
    }

    const novaDataFim = new Date(contrato.dataFim ?? contrato.dataInicio);
    novaDataFim.setDate(novaDataFim.getDate() + 45);

    const atualizado = await db.contratoColaborador.update({
      where: { id: contratoId },
      data: {
        dataFim: novaDataFim,
        renovacaoNumero: contrato.renovacaoNumero + 1,
        status: "RENOVADA",
      },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const, contrato: atualizado };
  } catch {
    return { success: false as const, error: "Erro ao renovar contrato" };
  }
}

export async function efetivarColaborador(contratoId: string) {
  await requireRHOrAbove();

  try {
    const contrato = await db.contratoColaborador.findUnique({ where: { id: contratoId } });
    if (!contrato) return { success: false as const, error: "Contrato não encontrado" };

    const atualizado = await db.contratoColaborador.update({
      where: { id: contratoId },
      data: { status: "EFETIVADO", dataFim: null },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const, contrato: atualizado };
  } catch {
    return { success: false as const, error: "Erro ao efetivar colaborador" };
  }
}

export async function desligarColaborador(contratoId: string) {
  await requireRHOrAbove();

  try {
    const atualizado = await db.contratoColaborador.update({
      where: { id: contratoId },
      data: { status: "DESLIGADO" },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const, contrato: atualizado };
  } catch {
    return { success: false as const, error: "Erro ao desligar colaborador" };
  }
}

export async function atualizarContratoUrl(contratoId: string, url: string) {
  await requireRHOrAbove();
  try {
    await db.contratoColaborador.update({
      where: { id: contratoId },
      data: { contratoUrl: url },
    });
    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Erro ao salvar URL" };
  }
}

// ─── Checklist ────────────────────────────────────────────────────────────────

const ChecklistSchema = z.object({
  carteiraTrabalho: z.boolean(),
  pis: z.boolean(),
  identidade: z.boolean(),
  cpfDoc: z.boolean(),
  cnh: z.boolean(),
  tituloEleitor: z.boolean(),
  reservista: z.boolean(),
  comprovanteResidencia: z.boolean(),
  certidao: z.boolean(),
  foto3x4: z.boolean(),
  exameAdmissional: z.boolean(),
  escolaridade: z.boolean(),
});

export async function saveChecklist(usuarioId: number, raw: unknown) {
  await requireRHOrAbove();

  const parsed = ChecklistSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };

  try {
    await db.checklistDocumental.upsert({
      where: { usuarioId },
      update: { ...parsed.data },
      create: { usuarioId, ...parsed.data },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Erro ao salvar checklist" };
  }
}

// ─── Contratos vencendo em breve (alertas) ────────────────────────────────────

export async function getContratosVencendo() {
  await requireRHOrAbove();

  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 7);

  try {
    const contratos = await db.contratoColaborador.findMany({
      where: {
        status: { in: ["EXPERIENCIA", "RENOVADA"] },
        dataFim: { gte: hoje, lte: limite },
      },
      include: {
        usuario: { select: { id: true, nome: true, imagemUrl: true, cargo: true } },
      },
      orderBy: { dataFim: "asc" },
    });

    return { success: true as const, contratos };
  } catch {
    return { success: false as const, error: "Erro ao buscar contratos" };
  }
}

// ─── Alterar senha (Admin only) ───────────────────────────────────────────────

export async function alterarSenhaAdmin(usuarioId: number, novaSenha: string) {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Não autorizado" };

  const userId = Number((session.user as { id?: string }).id);
  const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
  if (dbUser?.role !== "Admin") return { success: false as const, error: "Sem permissão" };

  if (!novaSenha || novaSenha.length < 6) {
    return { success: false as const, error: "Senha deve ter ao menos 6 caracteres" };
  }

  try {
    await db.usuarios.update({
      where: { id: usuarioId },
      data: { senha: hashSync(novaSenha, 10) },
    });
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Erro ao alterar senha" };
  }
}

// ─── Seed modalidades iniciais ─────────────────────────────────────────────────

export async function seedModalidadesIniciais() {
  const { role } = await requireRHOrAbove();
  if (!isAdminOrCeo(role)) return;

  const iniciais = ["CLT", "PJ", "Parceiro", "Freelancer", "Estágio", "Outro"];
  for (const nome of iniciais) {
    await db.modalidadeContrato.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }
}
