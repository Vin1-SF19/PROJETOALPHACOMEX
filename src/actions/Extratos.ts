"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { extratoInputSchema } from "@/lib/validations/extrato";

const EXTRATOS_INCLUDE = {
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

export async function ListarExtratos(params?: { page?: number; pageSize?: number; busca?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20;
    const busca = params?.busca?.trim();

    const where = busca
      ? {
          OR: [
            { razaoSocial: { contains: busca } },
            { cnpj: { contains: busca.replace(/\D/g, "") } },
            { analistaResponsavel: { contains: busca } },
          ],
        }
      : {};

    const [dados, total] = await Promise.all([
      db.extratos.findMany({
        where,
        include: EXTRATOS_INCLUDE,
        orderBy: { razaoSocial: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.extratos.count({ where }),
    ]);

    return {
      success: true,
      data: dados,
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

export async function ExtratosClientes(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const nomeUsuario = session.user.nome || "Usuário Alpha";

    const parsed = extratoInputSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten().fieldErrors };
    }
    const input = parsed.data;

    await db.extratos.upsert({
      where: { cnpj: input.cnpj },
      update: {
        razaoSocial: input.razaoSocial.toUpperCase(),
        nomeFantasia: input.nomeFantasia?.toUpperCase() || null,
        uf: input.uf || null,
        municipio: input.municipio || null,
        regimeTributario: input.regimeTributario || null,
        updatedAt: new Date(),
      },
      create: {
        cnpj: input.cnpj,
        razaoSocial: input.razaoSocial.toUpperCase(),
        nomeFantasia: input.nomeFantasia?.toUpperCase() || null,
        dataConstituicao: input.dataConstituicao || null,
        uf: input.uf || null,
        municipio: input.municipio || null,
        regimeTributario: input.regimeTributario || null,
        criadoPorNome: nomeUsuario,
      },
    });

    revalidatePath("/PainelAlpha/ExtratosBancarios");
    return { success: true };
  } catch (error) {
    console.error("[ExtratosClientes]", error);
    return { success: false, error: "Erro ao salvar cliente." };
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

    return { success: true, data: empresa };
  } catch (error) {
    console.error("[BuscarEmpresaPorId]", error);
    return { success: false, error: "Erro interno ao buscar dados." };
  }
}
