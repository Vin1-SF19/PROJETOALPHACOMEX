"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { cnpjEhValido, formatCNPJ, normalizarCNPJ } from "@/lib/format-cnpj";
import { exigirAcessoModuloBpm, exigirAcessoBpmPipeline, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import { consultarEGuardarCnpjLead } from "@/lib/bpm/consulta-cnpj-lead";

/** Enriquece o CNPJ no cadastro de Novo Lead; não altera o layout do modal. */
export async function ConsultarDadosCnpjNovoLeadBpm(pipelineId: string, cnpj: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const cnpjLimpo = normalizarCNPJ(cnpj);
    if (!cnpjEhValido(cnpjLimpo)) return { success: false as const, error: "CNPJ inválido" };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));
    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId }, select: { ativo: true, nome: true },
    });
    if (!pipeline?.ativo || !pipelineEhRevisaoRadar(pipeline.nome)) {
      return { success: false as const, error: "Pipeline de cadastro inválido" };
    }
    return { success: true as const, data: await consultarEGuardarCnpjLead(cnpjLimpo) };
  } catch (error) {
    console.error("[ConsultarDadosCnpjNovoLeadBpm]", error instanceof Error ? error.name : "unknown");
    return { success: false as const, error: "Não foi possível consultar os dados da empresa" };
  }
}

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

/** Seleciona automaticamente uma empresa já cadastrada quando o CNPJ é completo. */
export async function BuscarEmpresaPorCnpjBpm(cnpj: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: null };
    await exigirAcessoModuloBpm(Number(session.user.id));
    if (cnpj.replace(/\D/g, "").length !== 14) {
      return { success: false, error: "CNPJ inválido", data: null };
    }
    const cnpjNormalizado = normalizarCNPJ(cnpj);
    const cnpjFormatado = formatCNPJ(cnpjNormalizado);
    const empresa = await db.cliente.findFirst({
      where: { cnpj: { in: [cnpjNormalizado, cnpjFormatado].filter((valor): valor is string => Boolean(valor)) } },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, uf: true, municipio: true },
    });
    return { success: true, data: empresa };
  } catch (error) {
    console.error("[BuscarEmpresaPorCnpjBpm]", error);
    return { success: false, error: "Não foi possível consultar o cadastro interno", data: null };
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
