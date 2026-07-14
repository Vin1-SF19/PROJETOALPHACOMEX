"use server";

import { TipoEmbasamento } from "@prisma/client";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/lib/prisma";
import { SECOES_MODELO, TIPOS_EMBASAMENTO } from "@/lib/checklist/modelos";

const tipoSchema = z.enum(TIPOS_EMBASAMENTO);
const secaoSchema = z.enum(SECOES_MODELO as [string, ...string[]]);

const criarModeloSchema = z.object({
  tipoAtual: tipoSchema,
  codigo: z.string().trim().min(1, "Informe o código").max(60),
  nome: z.string().trim().min(1, "Informe o nome do documento").max(180),
  descricao: z.string().trim().max(1000).nullable(),
  secao: secaoSchema,
  obrigatorio: z.boolean(),
  escopo: z.enum(["ESPECIFICO", "GLOBAL"]),
});

export type ModeloChecklistConfiguracao = {
  id: string;
  tipo: TipoEmbasamento | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  secao: string;
  obrigatorio: boolean;
};

async function exigirSessao() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
}

export async function listarModelosEmbasamento(tipo: TipoEmbasamento): Promise<{
  data?: ModeloChecklistConfiguracao[];
  error?: string;
}> {
  try {
    await exigirSessao();
    const tipoValidado = tipoSchema.parse(tipo);
    const modelos = await db.modeloItemChecklist.findMany({
      where: { OR: [{ tipo: tipoValidado }, { tipo: null }] },
      select: { id: true, tipo: true, codigo: true, nome: true, descricao: true, secao: true, obrigatorio: true },
      orderBy: [{ secao: "asc" }, { createdAt: "asc" }],
      take: 500,
    });
    return { data: modelos };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao carregar os modelos" };
  }
}

export async function obterResumoModelosEmbasamento(): Promise<{
  data?: Record<TipoEmbasamento, number>;
  error?: string;
}> {
  try {
    await exigirSessao();
    const modelos = await db.modeloItemChecklist.findMany({
      select: { tipo: true },
      take: 500,
    });
    const globais = modelos.filter((modelo) => modelo.tipo === null).length;
    const resumo = Object.fromEntries(TIPOS_EMBASAMENTO.map((tipo) => [
      tipo,
      globais + modelos.filter((modelo) => modelo.tipo === tipo).length,
    ])) as Record<TipoEmbasamento, number>;
    return { data: resumo };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao carregar os modelos" };
  }
}

export async function criarModeloEmbasamento(dados: z.infer<typeof criarModeloSchema>) {
  try {
    await exigirSessao();
    const parsed = criarModeloSchema.parse(dados);
    const modelo = await db.modeloItemChecklist.create({
      data: {
        tipo: parsed.escopo === "GLOBAL" ? null : parsed.tipoAtual,
        codigo: parsed.codigo,
        nome: parsed.nome,
        descricao: parsed.descricao || null,
        secao: parsed.secao,
        obrigatorio: parsed.obrigatorio,
      },
      select: { id: true, tipo: true, codigo: true, nome: true, descricao: true, secao: true, obrigatorio: true },
    });
    await db.$transaction(async (tx) => {
      const checklists = await tx.checklist.findMany({
        where: modelo.tipo ? { tipo: modelo.tipo } : {},
        include: { itens: { select: { id: true, codigo: true, modeloItemId: true } } },
      });
      await Promise.all(checklists.map(async (checklist) => {
        const itemExistente = checklist.itens.find((item) => item.modeloItemId === modelo.id || item.codigo === modelo.codigo);
        if (itemExistente?.modeloItemId !== modelo.id && itemExistente) {
          await tx.itemChecklist.update({ where: { id: itemExistente.id }, data: { modeloItemId: modelo.id } });
          return;
        }
        if (!itemExistente) {
          await tx.itemChecklist.create({
            data: {
              checklistId: checklist.id,
              modeloItemId: modelo.id,
              codigo: modelo.codigo,
              secao: modelo.secao,
              descricao: modelo.nome,
              complemento: modelo.descricao,
              obrigatorio: modelo.obrigatorio,
            },
          });
        }
      }));
    });
    revalidatePath("/PainelAlpha/CheckList/Embasamentos");
    revalidatePath(`/PainelAlpha/CheckList/Embasamentos/${parsed.tipoAtual}`);
    return { data: modelo };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao criar o modelo" };
  }
}
