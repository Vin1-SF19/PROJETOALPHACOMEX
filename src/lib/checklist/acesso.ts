import type { Prisma } from "@prisma/client";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { isAdminRole, isSameRole, normalizeRole, Roles } from "@/lib/roles";
import { fail } from "./result";
import type { AtorChecklist, CapacidadesChecklist } from "./types";
export type Tx = Prisma.TransactionClient;
export const operacionalElegivel = (role: string) =>
  ["OPERACIONAL", "ANALISTAOPERACIONAL"].includes(normalizeRole(role));
export const liderOperacional = (role: string) =>
  normalizeRole(role) === "LIDEROPERACIONAL";
const gestorModelosChecklist = (role: string) =>
  liderOperacional(role) || isSameRole(role, Roles.TI);
export async function obterAtorChecklist(): Promise<AtorChecklist> {
  const session = await auth();
  if (!session?.user?.id) fail("UNAUTHENTICATED", "Entre novamente.");
  const user = await db.usuarios.findUnique({
    where: { id: Number(session.user.id) },
    select: { id: true, authSessionVersion: true },
  });
  if (!user) fail("UNAUTHENTICATED", "Entre novamente.");
  const ator: AtorChecklist = {
    kind: "INTERNO",
    id: user.id,
    sessionVersion: user.authSessionVersion,
  };
  await exigirLeituraChecklist(ator);
  return ator;
}
export async function exigirLeituraChecklist(ator: AtorChecklist, tx: Tx = db) {
  if (ator.kind === "PORTAL") {
    const conta = await tx.clienteOperacional.findUnique({
      where: { id: ator.id },
      select: { id: true, authSessionVersion: true },
    });
    if (!conta || conta.authSessionVersion !== ator.sessionVersion)
      fail("UNAUTHENTICATED", "Entre novamente.");
    return { id: 0, role: "PORTAL", nome: "", imagemUrl: null };
  }
  const user = await tx.usuarios.findUnique({
    where: { id: ator.id },
    select: {
      id: true,
      role: true,
      status: true,
      nome: true,
      imagemUrl: true,
      permissoes: true,
      authSessionVersion: true,
    },
  });
  if (
    !user ||
    user.status !== "ATIVO" ||
    user.authSessionVersion !== ator.sessionVersion
  )
    fail("UNAUTHENTICATED", "Entre novamente.");
  let allowed = isAdminRole(user.role);
  if (!allowed) {
    const setores = await tx.setorPermissao.findMany({
      where: { setor: user.role },
      select: { modulo: true },
    });
    const mods = new Set(
      setores.length
        ? setores.map((s) => s.modulo)
        : (user.permissoes ?? "").split(","),
    );
    for (const o of await tx.usuarioPermissaoOverride.findMany({
      where: { usuarioId: user.id },
      select: { modulo: true, acao: true },
    })) {
      if (o.acao === "ADD") mods.add(o.modulo);
      else mods.delete(o.modulo);
    }
    allowed = mods.has("checkList");
  }
  if (!allowed) fail("FORBIDDEN", "Sem acesso ao CheckList.");
  return user;
}
export async function exigirLiderChecklist(ator: AtorChecklist, tx: Tx = db) {
  const user = await exigirLeituraChecklist(ator, tx);
  if (ator.kind !== "INTERNO" || !liderOperacional(user.role))
    fail("FORBIDDEN", "Apenas Líder Operacional pode realizar esta operação.");
  return user;
}
export async function exigirGestorModelosChecklist(
  ator: AtorChecklist,
  tx: Tx = db,
) {
  const user = await exigirLeituraChecklist(ator, tx);
  if (ator.kind !== "INTERNO" || !gestorModelosChecklist(user.role))
    fail("FORBIDDEN", "Apenas TI ou Líder Operacional pode gerir modelos.");
  return user;
}
export async function exigirEmpresaChecklist(
  tx: Tx,
  ator: AtorChecklist,
  empresaId: string,
) {
  await exigirLeituraChecklist(ator, tx);
  const empresa = await tx.operacionalClientes.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      analistaId: true,
      clienteId: true,
      clienteOperacionalId: true,
      revision: true,
      tipo: true,
    },
  });
  if (!empresa) fail("NOT_FOUND", "Atendimento não encontrado.");
  if (ator.kind === "PORTAL" && empresa.clienteOperacionalId !== ator.id)
    fail("FORBIDDEN", "Sem acesso ao atendimento.");
  return empresa;
}
export async function exigirEscritaChecklist(
  tx: Tx,
  ator: AtorChecklist,
  empresaId: string,
) {
  const empresa = await exigirEmpresaChecklist(tx, ator, empresaId);
  const user = await exigirLeituraChecklist(ator, tx);
  if (
    ator.kind !== "INTERNO" ||
    (!liderOperacional(user.role) && empresa.analistaId !== ator.id)
  )
    fail(
      "FORBIDDEN",
      "Somente o analista responsável ou Líder Operacional pode editar.",
    );
  return empresa;
}
export function capacidadesParaAtor(
  ator: AtorChecklist,
  role: string,
  empresa: { analistaId: number | null },
): CapacidadesChecklist {
  const leader = ator.kind === "INTERNO" && liderOperacional(role),
    own = ator.kind === "INTERNO" && empresa.analistaId === ator.id;
  return {
    canRead: true,
    canEdit: leader || own,
    canCreateOwn:
      ator.kind === "INTERNO" && (operacionalElegivel(role) || leader),
    canAssignOwner: leader,
    canManageModels: ator.kind === "INTERNO" && gestorModelosChecklist(role),
    canManagePortalAccess: leader || own,
    canLinkCrm: leader || own,
  };
}
export async function obterCapacidadesChecklist(
  ator: AtorChecklist,
  empresa: { analistaId: number | null },
  tx: Tx = db,
): Promise<CapacidadesChecklist> {
  const u = await exigirLeituraChecklist(ator, tx);
  return capacidadesParaAtor(ator, u.role, empresa);
}
export async function exigirAnalistaElegivel(tx: Tx, id: number) {
  const u = await tx.usuarios.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  });
  if (!u || u.status !== "ATIVO" || !operacionalElegivel(u.role))
    fail("VALIDATION", "Selecione um analista operacional ativo.");
  return u;
}
