"use server";

import { auth } from "../../auth";
import { z } from "zod";
import db from "@/lib/prisma";
import { normalizarNomeServico, SERVICOS_COMERCIAIS_PADRAO } from "@/lib/comercial/servicos";
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
 * O valor principal usado pelo motor vem dos honorários brutos do contrato. Este cadastro
 * funciona como referência administrativa e não é requisito para o evento ser válido.
 */
export async function CriarTarifario(input: z.infer<typeof criarTarifarioSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = criarTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    if (parsed.data.dataFinal && parsed.data.dataFinal < parsed.data.dataInicial) {
      return { success: false, error: "A data final não pode ser anterior ao início da vigência" } as const;
    }

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
  servico: z.string().min(1).optional(),
  valorCents: z.number().int().nonnegative().optional(),
  dataInicial: z.coerce.date().optional(),
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

    const proximaDataInicial = data.dataInicial ?? existente.dataInicial;
    const proximaDataFinal = data.dataFinal === undefined ? existente.dataFinal : data.dataFinal;
    if (proximaDataFinal && proximaDataFinal < proximaDataInicial) {
      return { success: false, error: "A data final não pode ser anterior ao início da vigência" } as const;
    }

    const atualizado = await db.tariffVersion.update({ where: { id }, data });
    return { success: true, data: atualizado } as const;
  } catch (error) {
    console.error("[AtualizarTarifario]", error);
    return { success: false, error: "Erro interno ao atualizar tarifário" } as const;
  }
}

const excluirTarifarioSchema = z.object({ id: z.string().min(1) });

export async function ExcluirTarifario(input: z.infer<typeof excluirTarifarioSchema>) {
  const acesso = await exigirAcesso("CONFIGURAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  const parsed = excluirTarifarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", details: parsed.error.flatten() } as const;
  }

  try {
    const existente = await db.tariffVersion.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
    if (!existente) return { success: false, error: "Tarifário não encontrado" } as const;

    await db.tariffVersion.delete({ where: { id: parsed.data.id } });
    return { success: true } as const;
  } catch (error) {
    console.error("[ExcluirTarifario]", error);
    return { success: false, error: "Erro interno ao excluir tarifário" } as const;
  }
}

export interface ServicoComTarifarioRow {
  id: string;
  nome: string;
  ativo: boolean;
  temTarifarioVigente: boolean;
  origem: "PADRAO" | "CADASTRADO";
}

/**
 * Catálogo somente-leitura da aba "Serviços" — distinto de "Tarifários" (que cadastra o
 * PREÇO por serviço/data). Aqui é só o catálogo de nomes de serviço (`ServicosComerciais`,
 * do módulo Metas), cruzado com `TariffVersion` para indicar quais já têm tarifário
 * cadastrado como referência, sem bloquear eventos que já possuem honorários brutos.
 */
export async function ListarServicosComTarifario() {
  const acesso = await exigirAcesso("VISUALIZAR");
  if (!acesso.ok) return { success: false, error: acesso.error } as const;

  try {
    const servicos = await db.servicosComerciais.findMany({ orderBy: { nome: "asc" } });
    const tarifarios = await db.tariffVersion.findMany({ select: { servico: true } });
    const servicosComTarifario = new Set(tarifarios.map((tarifario) => normalizarNomeServico(tarifario.servico)));
    const catalogo = new Map<string, ServicoComTarifarioRow>();

    for (const nome of SERVICOS_COMERCIAIS_PADRAO) {
      const chave = normalizarNomeServico(nome);
      catalogo.set(chave, {
        id: `padrao:${chave}`,
        nome,
        ativo: true,
        temTarifarioVigente: servicosComTarifario.has(chave),
        origem: "PADRAO",
      });
    }

    for (const servico of servicos) {
      const chave = normalizarNomeServico(servico.nome);
      catalogo.set(chave, {
        id: `cadastrado:${servico.id}`,
        nome: servico.nome,
        ativo: servico.ativo,
        temTarifarioVigente: servicosComTarifario.has(chave),
        origem: "CADASTRADO",
      });
    }

    const data = [...catalogo.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return { success: true, data } as const;
  } catch (error) {
    console.error("[ListarServicosComTarifario]", error);
    return { success: false, error: "Erro interno ao listar serviços" } as const;
  }
}
