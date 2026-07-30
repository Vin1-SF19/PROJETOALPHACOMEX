"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { feriadosNacionais } from "@/lib/commissions/holidays-seed";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

/**
 * Feriados NACIONAIS já são gerados deterministicamente por `feriadosNacionais()`
 * (holidays-seed.ts) — nunca cadastrados aqui. Esta action cobre só ESTADUAL/MUNICIPAL,
 * que ficaram conscientemente de fora do seed (seção 39 do prompt original: não inventar
 * quais municípios/estados importam para o cálculo).
 */
const criarFeriadoSchema = z
  .object({
    data: z.coerce.date(),
    nome: z.string().min(1),
    escopo: z.enum(["ESTADUAL", "MUNICIPAL"]),
    uf: z.string().length(2).optional(),
    municipio: z.string().min(1).optional(),
  })
  .refine((data) => data.escopo !== "ESTADUAL" || !!data.uf, { message: "UF é obrigatória para feriado estadual", path: ["uf"] })
  .refine((data) => data.escopo !== "MUNICIPAL" || (!!data.uf && !!data.municipio), {
    message: "UF e município são obrigatórios para feriado municipal",
    path: ["municipio"],
  });

export async function CriarFeriado(input: z.infer<typeof criarFeriadoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarFeriadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const feriado = await db.holiday.create({ data: parsed.data });
    return { success: true, data: feriado } as const;
  } catch (error) {
    console.error("[CriarFeriado]", error);
    return { success: false, error: "Erro interno ao criar feriado" } as const;
  }
}

const listarFeriadosSchema = z.object({
  escopo: z.enum(["NACIONAL", "ESTADUAL", "MUNICIPAL"]).optional(),
  ano: z.number().int(),
});

export interface FeriadoExibicao {
  id: string | null;
  data: string;
  nome: string;
  escopo: string;
  uf: string | null;
  municipio: string | null;
}

/**
 * NACIONAL nunca é persistido no banco — é calculado em memória por `feriadosNacionais()`
 * (determinístico, sem seed real). ESTADUAL/MUNICIPAL vêm de `Holiday` (cadastro manual
 * nesta tela). `ano` é obrigatório para poder calcular os nacionais do período certo.
 */
export async function ListarFeriados(input: z.infer<typeof listarFeriadosSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarFeriadosSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const { escopo, ano } = parsed.data;
    const resultado: FeriadoExibicao[] = [];

    if (!escopo || escopo === "NACIONAL") {
      for (const f of feriadosNacionais(ano)) {
        resultado.push({ id: null, data: f.data, nome: f.nome, escopo: "NACIONAL", uf: null, municipio: null });
      }
    }

    if (!escopo || escopo === "ESTADUAL" || escopo === "MUNICIPAL") {
      const persistidos = await db.holiday.findMany({
        where: {
          escopo: escopo ?? { in: ["ESTADUAL", "MUNICIPAL"] },
          data: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) },
        },
        orderBy: { data: "asc" },
      });
      for (const f of persistidos) {
        resultado.push({
          id: f.id,
          data: f.data.toISOString().slice(0, 10),
          nome: f.nome,
          escopo: f.escopo,
          uf: f.uf,
          municipio: f.municipio,
        });
      }
    }

    resultado.sort((a, b) => a.data.localeCompare(b.data));

    return { success: true, data: resultado } as const;
  } catch (error) {
    console.error("[ListarFeriados]", error);
    return { success: false, error: "Erro interno ao listar feriados" } as const;
  }
}

const excluirFeriadoSchema = z.object({ id: z.string().min(1) });

export async function ExcluirFeriado(input: z.infer<typeof excluirFeriadoSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = excluirFeriadoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const feriado = await db.holiday.findUnique({ where: { id: parsed.data.id } });
    if (!feriado) return { success: false, error: "Feriado não encontrado" } as const;

    if (feriado.escopo === "NACIONAL") {
      return { success: false, error: "Feriados nacionais são gerados automaticamente e não podem ser excluídos aqui." } as const;
    }

    await db.holiday.delete({ where: { id: parsed.data.id } });
    return { success: true } as const;
  } catch (error) {
    console.error("[ExcluirFeriado]", error);
    return { success: false, error: "Erro interno ao excluir feriado" } as const;
  }
}
