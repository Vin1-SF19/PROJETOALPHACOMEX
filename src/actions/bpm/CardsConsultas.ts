"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { normalizarCNPJ } from "@/lib/format-cnpj";
import { exigirAcessoModuloBpm, exigirAcessoBpmPipeline, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";

/** Busca leve de empresa por razão social/nome fantasia/CNPJ para o seletor do modal de novo card. */
export async function BuscarEmpresasBpm(termo: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoModuloBpm(Number(session.user.id));
    const termoSeguro = termo.trim().slice(0, 120);
    if (termoSeguro.length < 2) return { success: true, data: [] };

    const empresas = await db.cliente.findMany({
      where: {
        OR: [
          { razaoSocial: { contains: termoSeguro } },
          { nomeFantasia: { contains: termoSeguro } },
          { cnpj: { contains: normalizarCNPJ(termoSeguro) || termoSeguro } },
        ],
      },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
      take: 20,
      orderBy: { razaoSocial: "asc" },
    });

    return { success: true, data: empresas };
  } catch (error) {
    console.error("[BuscarEmpresasBpm]", error);
    return { success: false, error: "Erro ao buscar empresas", data: [] };
  }
}

/** Lista somente usuários ativos e elegíveis como responsáveis no pipeline. */
export async function ListarUsuariosResponsavelBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    if (!pipelineId?.trim()) {
      return { success: false, error: "Pipeline inválido", data: [] };
    }
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));
    const candidatos = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    const elegibilidades = await Promise.all(
      candidatos.map((usuario) =>
        usuarioElegivelResponsavelBpm(pipelineId, usuario.id),
      ),
    );
    const usuarios = candidatos.filter((_, indice) => elegibilidades[indice]);

    return { success: true, data: usuarios };
  } catch (error) {
    console.error("[ListarUsuariosResponsavelBpm]", error);
    return { success: false, error: "Erro ao buscar usuários", data: [] };
  }
}
