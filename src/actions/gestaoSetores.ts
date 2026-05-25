"use server";

import db from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

const SETOR_BASE = "DESVINCULADO";

const SETORES_PROTEGIDOS = [
  { nome: "Admin",            protegido: true,  isBase: false },
  { nome: "CEO",              protegido: true,  isBase: false },
  { nome: "DESVINCULADO",     protegido: true,  isBase: true  },
  { nome: "OPERACIONAL",      protegido: false, isBase: false },
  { nome: "COMERCIAL",        protegido: false, isBase: false },
  { nome: "Lider Comercial",  protegido: false, isBase: false },
  { nome: "RECURSOS HUMANOS", protegido: false, isBase: false },
  { nome: "FINANCEIRO",       protegido: false, isBase: false },
  { nome: "JURÍDICO",         protegido: false, isBase: false },
  { nome: "PARCEIRO",         protegido: false, isBase: false },
  { nome: "Serviços Gerais",  protegido: false, isBase: false },
];

const CARGOS_BASE = ["DESVINCULADO"];

async function ensureSetorBase() {
  for (const s of SETORES_PROTEGIDOS) {
    await db.setor.upsert({
      where: { nome: s.nome },
      update: {},
      create: { nome: s.nome, protegido: s.protegido, isBase: s.isBase },
    });
  }
}

async function ensureCargoBase() {
  for (const c of CARGOS_BASE) {
    await db.cargoColaborador.upsert({
      where: { nome: c },
      update: {},
      create: { nome: c },
    });
  }
}

export async function getSetoresComContagem() {
  await ensureSetorBase();

  const setores = await db.setor.findMany({
    where: { ativo: true },
    orderBy: [{ protegido: "desc" }, { nome: "asc" }],
  });

  const contagens = await db.usuarios.groupBy({
    by: ["role"],
    _count: { id: true },
  });

  const contagemMap = Object.fromEntries(
    contagens.map(c => [c.role, c._count.id])
  );

  return setores.map(s => ({
    ...s,
    totalUsuarios: contagemMap[s.nome] ?? 0,
  }));
}

export async function getCargosComContagem() {
  await ensureCargoBase();

  const cargos = await db.cargoColaborador.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  const contagens = await db.usuarios.groupBy({
    by: ["cargo"],
    _count: { id: true },
  });

  const contagemMap = Object.fromEntries(
    contagens.filter(c => c.cargo).map(c => [c.cargo!, c._count.id])
  );

  return cargos.map(c => ({
    ...c,
    totalUsuarios: contagemMap[c.nome] ?? 0,
  }));
}

export async function criarSetor(nome: string) {
  await requireAdmin();

  const nomeTrim = nome.trim().toUpperCase();
  if (!nomeTrim) return { success: false, message: "Nome inválido" };

  const existe = await db.setor.findUnique({ where: { nome: nomeTrim } });
  if (existe) return { success: false, message: "Setor já existe" };

  await db.setor.create({ data: { nome: nomeTrim } });
  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return { success: true, message: "Setor criado" };
}

export async function excluirSetor(id: number) {
  await requireAdmin();

  const setor = await db.setor.findUnique({ where: { id } });
  if (!setor) return { success: false, message: "Setor não encontrado" };
  if (setor.protegido) return { success: false, message: "Setor protegido não pode ser excluído" };

  await ensureSetorBase();

  const usuariosNoSetor = await db.usuarios.count({ where: { role: setor.nome } });
  if (usuariosNoSetor > 0) {
    await db.usuarios.updateMany({
      where: { role: setor.nome },
      data: { role: SETOR_BASE },
    });
  }

  await db.setor.delete({ where: { id } });

  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return {
    success: true,
    message: usuariosNoSetor > 0
      ? `Setor excluído. ${usuariosNoSetor} usuário(s) movido(s) para DESVINCULADO.`
      : "Setor excluído.",
  };
}

export async function criarCargo(nome: string) {
  await requireAdmin();

  const nomeTrim = nome.trim().toUpperCase();
  if (!nomeTrim) return { success: false, message: "Nome inválido" };

  const existe = await db.cargoColaborador.findUnique({ where: { nome: nomeTrim } });
  if (existe) return { success: false, message: "Cargo já existe" };

  await db.cargoColaborador.create({ data: { nome: nomeTrim } });
  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return { success: true, message: "Cargo criado" };
}

export async function excluirCargo(id: number) {
  await requireAdmin();

  const cargo = await db.cargoColaborador.findUnique({ where: { id } });
  if (!cargo) return { success: false, message: "Cargo não encontrado" };
  if (cargo.nome === "DESVINCULADO") return { success: false, message: "Cargo base não pode ser excluído" };

  const usuariosComCargo = await db.usuarios.count({ where: { cargo: cargo.nome } });
  if (usuariosComCargo > 0) {
    await db.usuarios.updateMany({
      where: { cargo: cargo.nome },
      data: { cargo: "DESVINCULADO" },
    });
  }

  await db.cargoColaborador.delete({ where: { id } });

  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return {
    success: true,
    message: usuariosComCargo > 0
      ? `Cargo excluído. ${usuariosComCargo} usuário(s) movido(s) para DESVINCULADO.`
      : "Cargo excluído.",
  };
}

export async function getSetoresParaSelect() {
  await ensureSetorBase();
  const setores = await db.setor.findMany({
    where: { ativo: true },
    orderBy: [{ protegido: "desc" }, { nome: "asc" }],
    select: { nome: true },
  });
  return setores.map(s => s.nome);
}

export async function getCargosParaSelect() {
  await ensureCargoBase();
  const cargos = await db.cargoColaborador.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { nome: true },
  });
  return cargos.map(c => c.nome);
}
