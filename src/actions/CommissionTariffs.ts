"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { verificarAcessoCategoria, type CategoriaPermissao } from "@/lib/commissions/permissions";

async function exigirAcesso(categoria: CategoriaPermissao) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Não autenticado" };

  const role = (session.user as { role?: string }).role ?? "";
  const resultado = await verificarAcessoCategoria(Number(session.user.id), role, categoria);
  if (!resultado.ok) return { ok: false as const, error: resultado.error ?? "Sem permissão" };

  return { ok: true as const, userId: resultado.userId! };
}

const criarTarifarioSchema = z.object({
  servico: z.string().min(1),
  valorCents: z.number().int().nonnegative(),
  dataInicial: z.coerce.date(),
  dataFinal: z.coerce.date().optional(),
  formasPagamentoJson: z.string().min(1),
  descontoPadraoPercentual: z.number().min(0).max(1).optional(),
  condicoesJson: z.string().optional(),
});

/**
 * Cria um tarifário. Efeito colateral esperado (não requer alteração no detector da Fase
 * 12): assim que existir um `TariffVersion` vigente para um serviço+data, a checagem
 * "SERVICO_SEM_TARIFARIO" do `divergence-detector.ts` para de disparar automaticamente
 * (ela já consulta `TariffVersion` vigente na data do evento) — comportamento correto por
 * construção, não uma integração nova a implementar.
 */
export async function CriarTarifario(input: z.infer<typeof criarTarifarioSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const tarifario = await db.tariffVersion.create({ data: parsed.data });
    return { success: true, data: tarifario } as const;
  } catch (error) {
    console.error("[CriarTarifario]", error);
    return { success: false, error: "Erro interno ao criar tarifário" } as const;
  }
}

const listarTarifariosSchema = z.object({ servico: z.string().optional() });

export async function ListarTarifarios(input?: z.infer<typeof listarTarifariosSchema>) {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = listarTarifariosSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const tarifarios = await db.tariffVersion.findMany({
      where: parsed.data.servico ? { servico: parsed.data.servico } : undefined,
      orderBy: { dataInicial: "desc" },
    });
    return { success: true, data: tarifarios } as const;
  } catch (error) {
    console.error("[ListarTarifarios]", error);
    return { success: false, error: "Erro interno ao listar tarifários" } as const;
  }
}

const atualizarTarifarioSchema = z.object({
  id: z.string().min(1),
  valorCents: z.number().int().nonnegative().optional(),
  dataFinal: z.coerce.date().nullable().optional(),
  formasPagamentoJson: z.string().optional(),
  descontoPadraoPercentual: z.number().min(0).max(1).nullable().optional(),
  condicoesJson: z.string().nullable().optional(),
});

export async function AtualizarTarifario(input: z.infer<typeof atualizarTarifarioSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = atualizarTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  const { id, ...data } = parsed.data;

  try {
    const existente = await db.tariffVersion.findUnique({ where: { id } });
    if (!existente) return { success: false, error: "Tarifário não encontrado" } as const;

    const atualizado = await db.tariffVersion.update({ where: { id }, data });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarTarifario]", error);
    return { success: false, error: "Erro interno ao atualizar tarifário" } as const;
  }
}

export interface ServicoComTarifarioRow {
  id: number;
  nome: string;
  ativo: boolean;
  temTarifarioVigente: boolean;
}

/**
 * Catálogo somente-leitura da aba "Serviços" — distinto de "Tarifários" (que cadastra o
 * PREÇO por serviço/data). Aqui é só o catálogo de nomes de serviço (`ServicosComerciais`,
 * do módulo Metas), cruzado com `TariffVersion` para indicar quais já têm tarifário
 * cadastrado (ajuda a identificar serviços sem preço, que geram divergência
 * SERVICO_SEM_TARIFARIO na sincronização).
 */
export async function ListarServicosComTarifario() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const servicos = await db.servicosComerciais.findMany({ orderBy: { nome: "asc" } });
    const tarifarios = await db.tariffVersion.findMany({ select: { servico: true } });
    const servicosComTarifario = new Set(tarifarios.map((t) => t.servico));

    const data: ServicoComTarifarioRow[] = servicos.map((s) => ({
      id: s.id,
      nome: s.nome,
      ativo: s.ativo,
      temTarifarioVigente: servicosComTarifario.has(s.nome),
    }));

    return { success: true, data } as const;
  } catch (error) {
    console.error("[ListarServicosComTarifario]", error);
    return { success: false, error: "Erro interno ao listar serviços" } as const;
  }
}
