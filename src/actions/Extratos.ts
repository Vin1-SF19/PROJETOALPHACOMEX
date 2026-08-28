"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { vincularEmpresaExtratoSchema } from "@/lib/validations/extrato";
import { criarFiltrosPesquisaExtratos } from "@/lib/extrato/pesquisa-extratos";

const EXTRATOS_INCLUDE = {
  cliente: {
    select: {
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      dataConstituicao: true,
      municipio: true,
      uf: true,
      regimeTributario: true,
    },
  },
  periodos: {
    include: {
      bancos: {
        include: {
          transacoes: true,
        },
      },
    },
  },
} as const;

/**
 * Achata `Extratos` + `Cliente` no mesmo shape que os componentes já esperavam
 * (campos cadastrais direto no objeto, ex: `empresa.razaoSocial`) — Fase 3.3 do
 * Cliente Master: os campos migraram para `Cliente`, mas a UI não precisa mudar.
 */
function achatarExtrato<T extends { cliente: { cnpj: string | null; razaoSocial: string; nomeFantasia: string | null; dataConstituicao: string | null; municipio: string | null; uf: string | null; regimeTributario: string | null } }>(
  extrato: T,
) {
  const { cliente, ...resto } = extrato;
  return { ...resto, ...cliente };
}

export async function ListarExtratos(params?: { page?: number; pageSize?: number; busca?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;
    const where = criarFiltrosPesquisaExtratos(params?.busca);

    const [dados, total] = await Promise.all([
      db.extratos.findMany({
        where,
        include: EXTRATOS_INCLUDE,
        orderBy: { cliente: { razaoSocial: "asc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.extratos.count({ where }),
    ]);

    return {
      success: true,
      data: dados.map(achatarExtrato),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      error: null,
    };
  } catch (error) {
    console.error("[ListarExtratos]", error);
    return { success: false, data: [], error: "Erro ao buscar no banco" };
  }
}

/** Vincula uma empresa ao módulo de Extratos, criando seu cadastro mestre quando necessário. */
export async function ExtratosClientes(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const nomeUsuario = session.user.nome || "Usuário Alpha";

    const parsed = vincularEmpresaExtratoSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const cnpjNormalizado = parsed.data.cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const cliente = await db.cliente.upsert({
      where: { cnpj: cnpjNormalizado },
      update: {},
      create: {
        cnpj: cnpjNormalizado,
        razaoSocial: parsed.data.razaoSocial,
        nomeFantasia: parsed.data.nomeFantasia || null,
        dataConstituicao: parsed.data.dataConstituicao || null,
        municipio: parsed.data.municipio || null,
        uf: parsed.data.uf || null,
        regimeTributario: parsed.data.regimeTributario || null,
      },
      select: { id: true },
    });

    await db.extratos.upsert({
      where: { clienteId: cliente.id },
      update: {},
      create: {
        clienteId: cliente.id,
        criadoPorNome: nomeUsuario,
      },
    });

    revalidatePath("/PainelAlpha/ExtratosBancarios");
    return { success: true };
  } catch (error) {
    console.error("[ExtratosClientes]", error);
    return { success: false, error: "Erro ao vincular empresa." };
  }
}

export async function BuscarEmpresaPorId(id: string | number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const idNumerico = Number(id);
    if (isNaN(idNumerico)) {
      return { success: false, error: "ID da empresa é inválido." };
    }

    const empresa = await db.extratos.findUnique({
      where: { id: idNumerico },
      include: {
        cliente: {
          select: {
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
            dataConstituicao: true,
            municipio: true,
            uf: true,
            regimeTributario: true,
          },
        },
        periodos: {
          include: {
            bancos: {
              include: {
                transacoes: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!empresa) {
      return { success: false, error: "Empresa não encontrada no banco de dados." };
    }

    return { success: true, data: achatarExtrato(empresa) };
  } catch (error) {
    console.error("[BuscarEmpresaPorId]", error);
    return { success: false, error: "Erro interno ao buscar dados." };
  }
}
