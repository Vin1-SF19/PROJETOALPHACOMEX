"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole, isSameRole } from "@/lib/roles";

// Mesmo gate de `src/app/PainelAlpha/cadastro/page.tsx` — só quem gerencia
// equipe pode ver o status de leitura de documentos de outros colaboradores.
const ROLES_GESTAO_EQUIPE = ["RECURSOS HUMANOS", "FINANCEIRO", "Lider Comercial"];

export async function confirmarLeituraDocumento(documentoId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    if (!Number.isFinite(documentoId) || documentoId <= 0) {
      return { success: false, error: "Documento inválido" };
    }

    const usuarioId = Number(session.user.id);

    await db.confirmacaoLeituraDocumento.upsert({
      where: { documentoId_usuarioId: { documentoId, usuarioId } },
      update: { confirmadoEm: new Date() },
      create: { documentoId, usuarioId, confirmadoEm: new Date() },
    });

    revalidatePath("/PainelAlpha/DocsAlpha");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO CONFIRMAR LEITURA:", error.message);
    return { success: false, error: "Erro ao confirmar leitura." };
  }
}

export interface StatusLeituraUsuario {
  usuarioId: number;
  regimentoInternoLido: boolean;
  totalDocumentosSetor: number;
  documentosLidosSetor: number;
  todosDocumentosSetorLidos: boolean;
}

export async function buscarStatusLeituraEquipe(): Promise<
  { success: true; data: Record<number, StatusLeituraUsuario> } | { success: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const usuarioIdSolicitante = Number(session.user.id);
    const roleSolicitante = (session.user as { role?: string }).role ?? "";
    if (!isAdminRole(roleSolicitante) && !ROLES_GESTAO_EQUIPE.includes(roleSolicitante)) {
      const permissoes = await getPermissoesEfetivas(usuarioIdSolicitante);
      if (!permissoes.includes("cadastro")) {
        return { success: false, error: "Não autorizado" };
      }
    }

    const [usuarios, documentos, confirmacoes] = await Promise.all([
      db.usuarios.findMany({ where: { status: "ATIVO" }, select: { id: true, role: true } }),
      db.documentos.findMany({ where: { status: "ATIVO" }, select: { id: true, titulo: true, setor: true } }),
      db.confirmacaoLeituraDocumento.findMany({ select: { documentoId: true, usuarioId: true } }),
    ]);

    const confirmadoPor = new Map<number, Set<number>>();
    for (const c of confirmacoes) {
      if (!confirmadoPor.has(c.usuarioId)) confirmadoPor.set(c.usuarioId, new Set());
      confirmadoPor.get(c.usuarioId)!.add(c.documentoId);
    }

    const documentosRegimentoInterno = documentos.filter((d) =>
      d.titulo.toUpperCase().includes("REGIMENTO INTERNO")
    );

    const resultado: Record<number, StatusLeituraUsuario> = {};

    for (const usuario of usuarios) {
      const setorUsuario = usuario.role;
      const documentosDoSetor = documentos.filter(
        (d) => isSameRole(d.setor, setorUsuario)
      );
      const lidosPeloUsuario = confirmadoPor.get(usuario.id) ?? new Set<number>();

      const documentosLidosSetor = documentosDoSetor.filter((d) => lidosPeloUsuario.has(d.id)).length;
      const regimentoInternoLido =
        documentosRegimentoInterno.length > 0 &&
        documentosRegimentoInterno.every((d) => lidosPeloUsuario.has(d.id));

      resultado[usuario.id] = {
        usuarioId: usuario.id,
        regimentoInternoLido,
        totalDocumentosSetor: documentosDoSetor.length,
        documentosLidosSetor,
        todosDocumentosSetorLidos:
          documentosDoSetor.length > 0 && documentosLidosSetor === documentosDoSetor.length,
      };
    }

    return { success: true, data: resultado };
  } catch (error: any) {
    console.error("ERRO AO BUSCAR STATUS DE LEITURA:", error.message);
    return { success: false, error: "Erro ao buscar status de leitura." };
  }
}
