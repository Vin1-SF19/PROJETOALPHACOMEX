"use server";

import db from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { isSameRole } from "@/lib/roles";
import { SETOR_LIDER_COMERCIAL } from "@/lib/setores-catalogo";
import { getCategoriasIniciaisDoSetor } from "@/lib/chamados/categorias-iniciais";
import { normalizarNomeCategoria } from "@/lib/chamados/catalogo";

const SETOR_BASE = "DESVINCULADO";

const SETORES_PROTEGIDOS = [
  { nome: "Admin",            protegido: true,  isBase: false },
  { nome: "CEO",              protegido: true,  isBase: false },
  { nome: "DESVINCULADO",     protegido: true,  isBase: true  },
  { nome: "OPERACIONAL",      protegido: false, isBase: false },
  { nome: "COMERCIAL",        protegido: false, isBase: false },
  { nome: SETOR_LIDER_COMERCIAL, protegido: false, isBase: false },
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

  const criado = await db.$transaction(async (tx) => {
    const existentes = await tx.setor.findMany({ select: { nome: true } });
    if (existentes.some((setor) => isSameRole(setor.nome, nomeTrim))) return false;
    const setor = await tx.setor.create({ data: { nome: nomeTrim } });
    for (const categoria of getCategoriasIniciaisDoSetor(setor.nome)) {
      await tx.chamadoCategoria.create({ data: { ...categoria, setorId: setor.id, nomeNormalizado: normalizarNomeCategoria(categoria.nome) } });
    }
    return true;
  }, { isolationLevel: "Serializable" });
  if (!criado) return { success: false, message: "Já existe um setor com nome equivalente." };
  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return { success: true, message: "Setor criado" };
}

export async function excluirSetor(id: number) {
  await requireAdmin();

  const setor = await db.setor.findUnique({ where: { id } });
  if (!setor) return { success: false, message: "Setor não encontrado" };
  if (isSameRole(setor.nome, "TI")) return { success: false, message: "O setor TI é usado no histórico de chamados e não pode ser excluído." };
  if (setor.protegido) return { success: false, message: "Setor protegido não pode ser excluído" };

  await ensureSetorBase();
  const resultado = await db.$transaction(async (tx) => {
    const atual = await tx.setor.findUnique({ where: { id }, select: { nome: true, protegido: true } });
    if (!atual || atual.protegido || isSameRole(atual.nome, "TI")) return { success: false, message: "Setor protegido ou não encontrado.", total: 0 };
    const vinculados = await tx.chamados.count({ where: { setorDestinoId: id } });
    const categorias = await tx.chamadoCategoria.count({ where: { setorId: id } });
    if (vinculados > 0 || categorias > 0) return { success: false, message: "Este setor possui chamados ou categorias vinculados e não pode ser excluído.", total: 0 };
    const usuariosNoSetor = await tx.usuarios.count({ where: { role: atual.nome } });
    if (usuariosNoSetor > 0) await tx.usuarios.updateMany({
      where: { role: atual.nome }, data: { role: SETOR_BASE, authSessionVersion: { increment: 1 } },
    });
    await tx.setor.delete({ where: { id } });
    return { success: true, message: usuariosNoSetor > 0 ? `Setor excluído. ${usuariosNoSetor} usuário(s) movido(s) para DESVINCULADO.` : "Setor excluído.", total: usuariosNoSetor };
  }, { isolationLevel: "Serializable" });
  if (!resultado.success) return { success: false, message: resultado.message };

  revalidatePath("/PainelAlpha/GestaoSetores");
  revalidatePath("/PainelAlpha/cadastro");

  return { success: true, message: resultado.message };
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
