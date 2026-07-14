"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";
import { Prisma, TipoEmbasamento, StatusItemChecklist } from "@prisma/client";
import { calcularProgressoItens } from "@/lib/checklist/items";
import { z } from "zod";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type EmpresaComProgresso = {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  status: string;
  embasamento: string;
  tipo: TipoEmbasamento | null;
  progresso: number;
  mesProtocolo: string | null;
  linkGrupo: string | null;
  situacaoRadar: string | null;
  submodalidade: string | null;
  dataSituacao: string | null;
  municipio: string | null;
  uf: string | null;
  regimeTributario: string | null;
  capitalSocial: string | null;
  dataConstituicao: string | null;
  contribuinte: string | null;
  clienteNome: string;
  checklistId: string | null;
  progressoReal: number;
  temChecklist: boolean;
  pastaChecklistId: string | null;
  pastaChecklistNome: string | null;
};

export type PastaChecklistResumo = { id: string; nome: string };

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  return session;
}

// ─── LISTAR EMPRESAS ─────────────────────────────────────────────────────────

export async function getEmpresasChecklist(): Promise<{ data?: EmpresaComProgresso[]; error?: string }> {
  try {
    await requireSession();

    const empresas = await db.operacionalClientes.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { nome: true } },
        pastaChecklist: { select: { id: true, nome: true } },
        checklists: {
          include: {
            itens: { select: { status: true, obrigatorio: true } },
          },
        },
      },
    });

    const data: EmpresaComProgresso[] = empresas.map((e) => {
      const checklist = e.checklists[0] ?? null;
      const progressoReal = checklist
        ? calcularProgressoItens(checklist.itens)
        : e.progresso;

      return {
        id: e.id,
        cnpj: e.cnpj,
        razaoSocial: e.razaoSocial,
        nomeFantasia: e.nomeFantasia,
        status: e.status,
        embasamento: e.embasamento,
        tipo: e.tipo,
        progresso: e.progresso,
        mesProtocolo: e.mesProtocolo,
        linkGrupo: e.linkGrupo,
        situacaoRadar: e.situacaoRadar,
        submodalidade: e.submodalidade,
        dataSituacao: e.dataSituacao,
        municipio: e.municipio,
        uf: e.uf,
        regimeTributario: e.regimeTributario,
        capitalSocial: e.capitalSocial,
        dataConstituicao: e.dataConstituicao,
        contribuinte: e.contribuinte,
        clienteNome: e.cliente.nome,
        checklistId: checklist?.id ?? null,
        progressoReal,
        temChecklist: e.checklists.length > 0,
        pastaChecklistId: e.pastaChecklist?.id ?? null,
        pastaChecklistNome: e.pastaChecklist?.nome ?? null,
      };
    });

    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getPastasChecklist(): Promise<{ data?: PastaChecklistResumo[]; error?: string }> {
  try {
    await requireSession();
    const pastas = await db.pastaChecklist.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    return { data: pastas };
  } catch (err: any) {
    return { error: err.message };
  }
}

const criarPastaChecklistSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da pasta").max(80),
});

export async function criarPastaChecklist(nome: string): Promise<{ data?: PastaChecklistResumo; error?: string }> {
  try {
    await requireSession();
    const parsed = criarPastaChecklistSchema.parse({ nome });
    const pasta = await db.pastaChecklist.upsert({
      where: { nome: parsed.nome },
      update: {},
      create: { nome: parsed.nome },
      select: { id: true, nome: true },
    });
    revalidatePath("/PainelAlpha/CheckList");
    return { data: pasta };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── BUSCAR EMPRESA COM CHECKLIST ────────────────────────────────────────────

export async function getEmpresaChecklist(empresaId: string) {
  try {
    await requireSession();

    const empresa = await db.operacionalClientes.findUnique({
      where: { id: empresaId },
      include: {
        cliente: { select: { nome: true, email: true } },
        checklists: {
          include: {
            itens: {
              include: { documentos: true },
              orderBy: { codigo: "asc" },
            },
          },
        },
      },
    });

    if (!empresa) return { error: "Empresa não encontrada" };

    return { data: empresa };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── CRIAR CHECKLIST (popula itens do template) ──────────────────────────────

const TIPOS_VALIDOS = ["RECEITA_BRUTA_DAS", "RECEITA_BRUTA_CPRB", "INICIO_RETOMADA", "DISPONIBILIDADE_FINANCEIRA"] as const;
const STATUS_VALIDOS = ["PENDENTE", "OK", "IRREGULAR", "PARCIALMENTE_IRREGULAR", "REVISAR", "DESNECESSARIO", "EM_ANALISE", "AGUARDANDO_DOCUMENTOS", "PRIORIDADE"] as const;

const criarChecklistSchema = z.object({
  empresaId: z.string().min(1),
  tipo: z.enum(TIPOS_VALIDOS),
});

async function itensDoModelo(tx: Prisma.TransactionClient, tipo: TipoEmbasamento) {
  const modelos = await tx.modeloItemChecklist.findMany({
    where: { OR: [{ tipo }, { tipo: null }] },
    orderBy: [{ secao: "asc" }, { createdAt: "asc" }],
  });
  const agora = new Date();
  return modelos.map((modelo) => ({
    modeloItemId: modelo.id,
    codigo: modelo.codigo,
    secao: modelo.secao,
    descricao: modelo.nome,
    complemento: modelo.descricao,
    obrigatorio: modelo.obrigatorio,
    status: "PENDENTE" as StatusItemChecklist,
    atualizadoEm: agora,
  }));
}

export async function criarChecklist(empresaId: string, tipo: TipoEmbasamento) {
  try {
    await requireSession();
    const { empresaId: eId, tipo: t } = criarChecklistSchema.parse({ empresaId, tipo });

    const checklist = await db.$transaction(async (tx) => {
      const existente = await tx.checklist.findUnique({
        where: { empresaId_tipo: { empresaId: eId, tipo: t } },
        include: { itens: { include: { documentos: true } } },
      });
      const selecionado = existente ?? await tx.checklist.create({
        data: { empresaId: eId, tipo: t, itens: { create: await itensDoModelo(tx, t) } },
        include: { itens: { include: { documentos: true } } },
      });
      await tx.operacionalClientes.update({ where: { id: eId }, data: { tipo: t } });
      return selecionado;
    });

    revalidatePath(`/PainelAlpha/CheckList/${eId}`);
    revalidatePath("/PainelAlpha/CheckList");
    return { data: checklist };
  } catch (err: any) {
    return { error: err.message };
  }
}

const atualizarEmpresaChecklistSchema = z.object({
  empresaId: z.string().min(1),
  razaoSocial: z.string().trim().min(1).max(180),
  nomeFantasia: z.string().trim().max(180).nullable(),
  cnpj: z.string().trim().min(14).max(24),
  status: z.string().trim().min(1).max(40),
  embasamento: z.string().trim().max(120),
  tipo: z.enum(TIPOS_VALIDOS).nullable(),
  pastaChecklistId: z.string().min(1).nullable(),
  mesProtocolo: z.string().trim().max(40).nullable(),
  linkGrupo: z.string().trim().max(1000).nullable(),
  situacaoRadar: z.string().trim().max(120).nullable(),
  submodalidade: z.string().trim().max(120).nullable(),
  dataSituacao: z.string().trim().max(40).nullable(),
  municipio: z.string().trim().max(120).nullable(),
  uf: z.string().trim().max(8).nullable(),
  regimeTributario: z.string().trim().max(120).nullable(),
  capitalSocial: z.string().trim().max(80).nullable(),
  dataConstituicao: z.string().trim().max(40).nullable(),
  contribuinte: z.string().trim().max(120).nullable(),
});

export type DadosEmpresaChecklist = z.infer<typeof atualizarEmpresaChecklistSchema>;

export async function atualizarEmpresaChecklist(dados: DadosEmpresaChecklist) {
  try {
    await requireSession();
    const parsed = atualizarEmpresaChecklistSchema.parse(dados);

    if (parsed.pastaChecklistId) {
      const pasta = await db.pastaChecklist.findUnique({
        where: { id: parsed.pastaChecklistId },
        select: { id: true },
      });
      if (!pasta) return { error: "Pasta não encontrada" };
    }

    await db.$transaction(async (tx) => {
      const empresa = await tx.operacionalClientes.findUnique({
        where: { id: parsed.empresaId },
        select: { tipo: true },
      });
      if (!empresa) throw new Error("Empresa não encontrada");

      if (parsed.tipo && parsed.tipo !== empresa.tipo) {
        const checklistExistente = await tx.checklist.findUnique({
          where: { empresaId_tipo: { empresaId: parsed.empresaId, tipo: parsed.tipo } },
          select: { id: true },
        });
        if (!checklistExistente) {
          await tx.checklist.create({
            data: {
              empresaId: parsed.empresaId,
              tipo: parsed.tipo,
              itens: { create: await itensDoModelo(tx, parsed.tipo) },
            },
          });
        }
      }

      await tx.operacionalClientes.update({
        where: { id: parsed.empresaId },
        data: {
          razaoSocial: parsed.razaoSocial,
          nomeFantasia: parsed.nomeFantasia || null,
          cnpj: parsed.cnpj,
          status: parsed.status,
          embasamento: parsed.embasamento,
          tipo: parsed.tipo,
          pastaChecklistId: parsed.pastaChecklistId,
          mesProtocolo: parsed.mesProtocolo || null,
          linkGrupo: parsed.linkGrupo || null,
          situacaoRadar: parsed.situacaoRadar || null,
          submodalidade: parsed.submodalidade || null,
          dataSituacao: parsed.dataSituacao || null,
          municipio: parsed.municipio || null,
          uf: parsed.uf || null,
          regimeTributario: parsed.regimeTributario || null,
          capitalSocial: parsed.capitalSocial || null,
          dataConstituicao: parsed.dataConstituicao || null,
          contribuinte: parsed.contribuinte || null,
        },
      });
    });

    revalidatePath("/PainelAlpha/CheckList");
    revalidatePath("/PainelAlpha/CheckList/" + parsed.empresaId);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function trocarEmbasamentoChecklist(empresaId: string, tipo: TipoEmbasamento) {
  try {
    await requireSession();
    const parsed = criarChecklistSchema.parse({ empresaId, tipo });
    const checklist = await db.$transaction(async (tx) => {
      const existente = await tx.checklist.findUnique({
        where: { empresaId_tipo: { empresaId: parsed.empresaId, tipo: parsed.tipo } },
        include: { itens: { include: { documentos: true } } },
      });
      const selecionado = existente ?? await tx.checklist.create({
        data: {
          empresaId: parsed.empresaId,
          tipo: parsed.tipo,
          itens: { create: await itensDoModelo(tx, parsed.tipo) },
        },
        include: { itens: { include: { documentos: true } } },
      });
      await tx.operacionalClientes.update({
        where: { id: parsed.empresaId },
        data: { tipo: parsed.tipo },
      });
      return selecionado;
    });

    revalidatePath("/PainelAlpha/CheckList");
    revalidatePath("/PainelAlpha/CheckList/" + parsed.empresaId);
    return { data: checklist };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── ATUALIZAR STATUS + OBSERVAÇÃO DE UM ITEM ────────────────────────────────

const atualizarItemSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(STATUS_VALIDOS),
  observacao: z.string().optional(),
});

export async function atualizarItemChecklist(
  itemId: string,
  data: { status: StatusItemChecklist; observacao?: string }
) {
  try {
    await requireSession();
    const parsed = atualizarItemSchema.parse({ itemId, ...data });

    const item = await db.itemChecklist.update({
      where: { id: parsed.itemId },
      data: {
        status: parsed.status,
        observacao: parsed.observacao ?? null,
        atualizadoEm: new Date(),
      },
      include: {
        checklist: {
          include: {
            itens: { select: { status: true, obrigatorio: true } },
            empresa: { include: { cliente: { select: { id: true } } } },
          },
        },
      },
    });

    const progressoNovo = calcularProgressoItens(item.checklist.itens);
    await db.operacionalClientes.update({
      where: { id: item.checklist.empresaId },
      data: { progresso: progressoNovo },
    });

    // Notificar cliente
    const clienteId = item.checklist.empresa.cliente?.id;
    if (clienteId) {
      const tipo = parsed.observacao ? "OBSERVACAO_ITEM" : "STATUS_MUDOU";
      const titulo = parsed.observacao
        ? `Nova observação: ${item.descricao.substring(0, 60)}`
        : `Status atualizado: ${item.descricao.substring(0, 60)}`;
      const mensagem = parsed.observacao ?? `Novo status: ${parsed.status.replace(/_/g, " ")}`;
      await db.notificacaoCliente.create({
        data: {
          clienteId,
          tipo,
          titulo,
          mensagem,
          empresaId: item.checklist.empresaId,
          itemId: item.id,
        },
      }).catch(() => {}); // silencia erros para não quebrar a action principal
    }

    revalidatePath(`/PainelAlpha/CheckList/${item.checklist.empresaId}`);
    return { data: item, progresso: progressoNovo };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── CALCULAR PROGRESSO ──────────────────────────────────────────────────────

export async function calcularProgresso(checklistId: string) {
  try {
    await requireSession();

    const checklist = await db.checklist.findUnique({
      where: { id: checklistId },
      include: { itens: { select: { status: true, obrigatorio: true, secao: true } } },
    });

    if (!checklist) return { error: "Checklist não encontrado" };

    const total = checklist.itens.filter((i) => i.obrigatorio).length;
    const concluidos = checklist.itens.filter(
      (i) => i.obrigatorio && (i.status === "OK" || i.status === "DESNECESSARIO")
    ).length;
    const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    const secoesMap = new Map<string, { total: number; concluidos: number }>();
    checklist.itens.forEach((i) => {
      const curr = secoesMap.get(i.secao) ?? { total: 0, concluidos: 0 };
      if (i.obrigatorio) {
        curr.total++;
        if (i.status === "OK" || i.status === "DESNECESSARIO") curr.concluidos++;
      }
      secoesMap.set(i.secao, curr);
    });

    const porSecao: Record<string, { total: number; concluidos: number; percentual: number }> = {};
    secoesMap.forEach((val, key) => {
      porSecao[key] = {
        ...val,
        percentual: val.total > 0 ? Math.round((val.concluidos / val.total) * 100) : 0,
      };
    });

    return { data: { total, concluidos, percentual, porSecao } };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── ADICIONAR DOCUMENTO A UM ITEM ───────────────────────────────────────────

const adicionarDocSchema = z.object({
  itemId: z.string().min(1),
  nome: z.string().min(1),
  url: z.string().url(),
  uploadedByCliente: z.boolean().default(false),
});

export async function adicionarDocumento(
  itemId: string,
  data: { nome: string; url: string; uploadedByCliente: boolean }
) {
  try {
    await requireSession();
    const parsed = adicionarDocSchema.parse({ itemId, ...data });

    const doc = await db.documentoChecklist.create({
      data: {
        itemId: parsed.itemId,
        nome: parsed.nome,
        url: parsed.url,
        uploadedByCliente: parsed.uploadedByCliente,
      },
    });

    return { data: doc };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── ATUALIZAR OBSERVAÇÃO DE UM DOCUMENTO ────────────────────────────────────

export async function atualizarObservacaoDocumento(docId: string, observacao: string) {
  try {
    await requireSession();
    if (!docId) throw new Error("ID do documento obrigatório");

    await db.documentoChecklist.update({
      where: { id: docId },
      data: { observacao: observacao.trim() || null },
    });

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── REMOVER DOCUMENTO (hard delete — legado) ────────────────────────────────

export async function removerDocumento(docId: string) {
  try {
    await requireSession();
    await db.documentoChecklist.delete({ where: { id: docId } });
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── EXCLUIR DOCUMENTO PELO ANALISTA (soft delete → histórico) ───────────────

export async function excluirDocumentoAnalista(docId: string) {
  try {
    await requireSession();
    await db.documentoChecklist.update({
      where: { id: docId },
      data: { deletadoEm: new Date(), deletadoPorCliente: false },
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── HISTÓRICO DE DOCUMENTOS EXCLUÍDOS ───────────────────────────────────────

export type DocHistorico = {
  id: string;
  nome: string;
  url: string;
  uploadedByCliente: boolean;
  observacao: string | null;
  criadoEm: Date;
  deletadoEm: Date;
  deletadoPorCliente: boolean;
  itemDescricao: string;
  itemCodigo: string;
  empresaId: string;
  razaoSocial: string;
  cnpj: string;
  clienteNome: string;
};

export async function getHistoricoDocumentosExcluidos(): Promise<{ data?: DocHistorico[]; error?: string }> {
  try {
    await requireSession();

    const docs = await db.documentoChecklist.findMany({
      where: { deletadoEm: { not: null } },
      orderBy: { deletadoEm: "desc" },
      include: {
        item: {
          select: {
            descricao: true,
            codigo: true,
            checklist: {
              select: {
                empresa: {
                  select: {
                    id: true,
                    razaoSocial: true,
                    cnpj: true,
                    cliente: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const data: DocHistorico[] = docs
      .filter((d) => d.deletadoEm !== null)
      .map((d) => ({
        id: d.id,
        nome: d.nome,
        url: d.url,
        uploadedByCliente: d.uploadedByCliente,
        observacao: d.observacao,
        criadoEm: d.criadoEm,
        deletadoEm: d.deletadoEm!,
        deletadoPorCliente: d.deletadoPorCliente,
        itemDescricao: d.item.descricao,
        itemCodigo: d.item.codigo,
        empresaId: d.item.checklist.empresa.id,
        razaoSocial: d.item.checklist.empresa.razaoSocial,
        cnpj: d.item.checklist.empresa.cnpj,
        clienteNome: d.item.checklist.empresa.cliente?.nome ?? "—",
      }));

    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
}
