import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { auth } from "../../../auth";

const MODULO_PERMISSION = "geradorDocumentos";

export interface ContextoGeradorDocumentos {
  userId: number;
  role: string | null;
  isAdmin: boolean;
}

/** Resolve userId/role da sessão atual — fonte única para as actions do módulo (gerador-documentos.ts, empresas-contratadas.ts). */
export async function getSessaoGeradorDocumentos() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role ?? null;
  return { userId, role };
}

/**
 * Fonte única de acesso ao módulo: permissão `geradorDocumentos` (ou bypass
 * admin/CEO/TI, mesmo padrão do resto do painel). Nunca confia em role/permissão
 * vinda do cliente — resolve sempre do banco a partir do userId da sessão.
 */
export async function exigirAcessoModulo(
  userId: number,
  role: string | null,
): Promise<ContextoGeradorDocumentos> {
  const isAdmin = isAdminRole(role);
  if (!isAdmin) {
    const permissoes = await getPermissoesEfetivas(userId);
    if (!permissoes.includes(MODULO_PERMISSION)) {
      throw new Error("Não autorizado");
    }
  }
  return { userId, role, isAdmin };
}

/**
 * Ownership de um DocumentoTemplate: dono (criadoPorId) ou admin. Nunca expõe
 * se o template existe ou não a quem não tem acesso ao módulo — sempre chamar
 * exigirAcessoModulo antes.
 */
export async function exigirOwnershipTemplate(
  templateId: string,
  ctx: ContextoGeradorDocumentos,
) {
  const template = await db.documentoTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, criadoPorId: true, status: true },
  });
  if (!template) throw new Error("Template não encontrado");
  if (!ctx.isAdmin && template.criadoPorId !== ctx.userId) {
    throw new Error("Não autorizado");
  }
  return template;
}

/**
 * Ownership de um DocumentoGerado: dono (criadoPorId) ou admin. É a checagem
 * que protege a tela de conferência — tokenAcesso sozinho NUNCA autoriza
 * (decisão 2026-08-28, objetivo original exige link não-público).
 */
export async function exigirOwnershipDocumento(
  documentoId: string,
  ctx: ContextoGeradorDocumentos,
) {
  const documento = await db.documentoGerado.findUnique({
    where: { id: documentoId },
    select: { id: true, criadoPorId: true, status: true, templateId: true },
  });
  if (!documento) throw new Error("Documento não encontrado");
  if (!ctx.isAdmin && documento.criadoPorId !== ctx.userId) {
    throw new Error("Não autorizado");
  }
  return documento;
}

export async function exigirOwnershipDocumentoPorToken(
  tokenAcesso: string,
  ctx: ContextoGeradorDocumentos,
) {
  const documento = await db.documentoGerado.findUnique({
    where: { tokenAcesso },
    select: { id: true, criadoPorId: true, status: true, templateId: true },
  });
  if (!documento) throw new Error("Documento não encontrado");
  if (!ctx.isAdmin && documento.criadoPorId !== ctx.userId) {
    throw new Error("Não autorizado");
  }
  return documento;
}
