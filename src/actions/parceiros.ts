"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { put } from "@vercel/blob";

const EnderecoSchema = z.object({
  cep: z.string().min(8),
  logradouro: z.string().min(1),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
});

const ResponsavelSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().optional(),
  dataNascimento: z.string().optional(),
  cargo: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
});

const ParceiroSchema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  tipoParceiro: z.enum(["PADRAO", "SEM_COMISSAO", "ESPECIAL"]).default("PADRAO"),
  documento: z.string().min(11),
  nome: z.string().min(2),
  nomeFantasia: z.string().optional(),
  dataNascimento: z.string().optional(),
  sobre: z.string().optional(),
  email: z.string().email(),
  telefone: z.string().optional(),
  telefone2: z.string().optional(),
  chavePix: z.string().optional(),
  tipoChavePix: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
  nomeBanco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  nivel: z.enum(["GOLD", "PLATINUM", "BLACK"]).default("GOLD"),
  comissaoPercentual: z.number().min(0).max(100).optional(),
  dadosConsulta: z.string().optional(),
  endereco: EnderecoSchema.optional(),
  responsaveis: z.array(ResponsavelSchema).optional(),
  // Aceite do termo — usado quando o parceiro já aceitou no wizard do convite
  // público. Não obrigatório: cadastro manual pelo admin continua sem aceite.
  termoAceito: z.boolean().optional(),
  termoAceitoEm: z.coerce.date().optional(),
  termoVersao: z.string().optional(),
});

function gerarSenhaSegura(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export async function criarParceiro(input: z.input<typeof ParceiroSchema>): Promise<{
  success: boolean;
  error?: string;
  parceiro?: { id: number; loginEmail: string; senhaGerada: string; nome: string };
}> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Não autorizado" };

    const userId = (session.user as { id?: string | number }).id;
    if (!userId) return { success: false, error: "Usuário inválido" };

    const parsed = ParceiroSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const { tipo, tipoParceiro, documento, nome, nomeFantasia, dataNascimento, sobre, email, telefone, telefone2, chavePix, tipoChavePix, nomeBanco, agencia, conta, nivel, comissaoPercentual, dadosConsulta, endereco, responsaveis, termoAceito, termoAceitoEm, termoVersao } = parsed.data;

    const docLimpo = documento.replace(/\D/g, "");

    const existente = await db.parceiro.findUnique({ where: { documento: docLimpo } });
    if (existente) return { success: false, error: "Documento já cadastrado como parceiro" };

    const respValidos = (responsaveis ?? []).filter(r => r.nome.trim());
    if (tipo === "PJ" && respValidos.length === 0) {
      return { success: false, error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica" };
    }

    const senhaGerada = gerarSenhaSegura();
    const senhaHash = hashSync(senhaGerada, 10);

    // SEM_COMISSAO nunca guarda override manual — a comissão fica sempre indefinida.
    const comissaoFinal = tipoParceiro === "SEM_COMISSAO" ? null : (comissaoPercentual ?? null);

    const parceiro = await db.parceiro.create({
      data: {
        tipo,
        tipoParceiro,
        documento: docLimpo,
        nome,
        nomeFantasia: nomeFantasia || null,
        dataNascimento: dataNascimento || null,
        sobre: sobre || null,
        email,
        telefone: telefone || null,
        telefone2: telefone2 || null,
        chavePix: chavePix || null,
        tipoChavePix: tipoChavePix || null,
        nomeBanco: nomeBanco || null,
        agencia: agencia || null,
        conta: conta || null,
        nivel,
        comissaoPercentual: comissaoFinal,
        dadosConsulta: dadosConsulta || null,
        loginEmail: email.toLowerCase().trim(),
        senhaHash,
        criadoPorId: Number(userId),
        ...(termoAceito && {
          termoAceito: true,
          termoAceitoEm: termoAceitoEm ?? new Date(),
          termoVersao: termoVersao ?? null,
        }),
        ...(endereco && {
          endereco: {
            create: {
              cep: endereco.cep.replace(/\D/g, ""),
              logradouro: endereco.logradouro,
              numero: endereco.numero || null,
              complemento: endereco.complemento || null,
              bairro: endereco.bairro,
              cidade: endereco.cidade,
              uf: endereco.uf.toUpperCase(),
            },
          },
        }),
        ...(respValidos.length > 0 && {
          representantes: {
            create: respValidos.map(r => ({
              tipo: "PF",
              documento: r.cpf?.replace(/\D/g, "") || "",
              nome: r.nome,
              dataNascimento: r.dataNascimento || null,
              cargo: r.cargo || null,
              email: r.email || null,
              telefone: r.telefone || null,
            })),
          },
        }),
      },
    });

    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true, parceiro: { id: parceiro.id, loginEmail: email, senhaGerada, nome: parceiro.nome } };
  } catch (err: unknown) {
    console.error("[criarParceiro]", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    if (msg.includes("Unique constraint")) return { success: false, error: "Documento já cadastrado" };
    return { success: false, error: "Erro ao cadastrar parceiro" };
  }
}

export async function listarParceiros(busca?: string, nivel?: string) {
  const session = await auth();
  if (!session?.user) return { parceiros: [] };

  const parceiros = await db.parceiro.findMany({
    where: {
      ...(busca && {
        OR: [
          { nome: { contains: busca } },
          { documento: { contains: busca.replace(/\D/g, "") } },
          { email: { contains: busca } },
        ],
      }),
      ...(nivel && { nivel }),
    },
    include: {
      endereco: true,
      indicacoes: {
        where: { status: "ATIVA" },
        include: { cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
        orderBy: { dataIndicacao: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return { parceiros };
}

const COMISSAO_POR_NIVEL: Record<string, number> = { GOLD: 5, PLATINUM: 10, BLACK: 15 };
const DIA_MS_COMISSAO = 1000 * 60 * 60 * 24;

/**
 * Reconstrói o NÍVEL HISTÓRICO do parceiro no momento de cada contratação — uma
 * empresa contratada quando o parceiro ainda era GOLD sempre gera comissão de
 * GOLD, mesmo que o parceiro depois tenha subido para PLATINUM/BLACK com novas
 * contratações. Mesma regra de transição usada para o nível atual (1ª=GOLD,
 * 2ª em ≤60d=PLATINUM, 3ª em ≤60d=BLACK, gap>60d reinicia em GOLD), mas retorna
 * o nível válido EM CADA PONTO da timeline, indexado por CNPJ.
 */
function calcularNivelPorContratacaoHistorico(
  contratacoes: { cnpj: string; data: Date }[],
): Map<string, string> {
  const ordenadas = [...contratacoes].sort((a, b) => a.data.getTime() - b.data.getTime());
  const nivelPorCnpj = new Map<string, string>();

  let nivel = "GOLD";
  let nivelDate: Date | null = null;

  ordenadas.forEach((c, i) => {
    if (i === 0) {
      nivel = "GOLD";
      nivelDate = c.data;
    } else {
      const gap = (c.data.getTime() - nivelDate!.getTime()) / DIA_MS_COMISSAO;
      if (gap <= 60) {
        if (nivel === "GOLD") nivel = "PLATINUM";
        else if (nivel === "PLATINUM") nivel = "BLACK";
      } else {
        nivel = "GOLD";
      }
      nivelDate = c.data;
    }
    nivelPorCnpj.set(c.cnpj, nivel);
  });

  return nivelPorCnpj;
}

export async function buscarParceiro(id: number) {
  const session = await auth();
  if (!session?.user) return null;

  const parceiro = await db.parceiro.findUnique({
    where: { id },
    include: {
      endereco: true,
      representantes: true,
      indicacoes: {
        where: { status: "ATIVA" },
        include: {
          cliente: {
            select: {
              id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
              dataConstituicao: true, dataContratacao: true, uf: true, regimeTributario: true, status: true,
            },
          },
        },
        orderBy: { dataIndicacao: "desc" },
      },
    },
  });
  if (!parceiro) return null;

  // Serviço contratado + valor do contrato (ContratoComercial vinculado só por CNPJ,
  // sem FK — pega o contrato FECHADO mais recente de cada CNPJ indicado).
  const cnpjs = parceiro.indicacoes.map((ind) => ind.cliente.cnpj);
  const contratos = cnpjs.length
    ? await db.contratoComercial.findMany({
        where: { cnpj: { in: cnpjs }, status: "FECHADO" },
        orderBy: { createdAt: "desc" },
        select: { cnpj: true, servico: true, valorContrato: true },
      })
    : [];
  const contratoPorCnpj = new Map<string, { servico: string; valorContrato: number }>();
  for (const c of contratos) {
    if (!contratoPorCnpj.has(c.cnpj)) contratoPorCnpj.set(c.cnpj, { servico: c.servico, valorContrato: c.valorContrato });
  }

  // Comissão que o parceiro recebe por empresa indicada — mesma regra do portal:
  // SEM_COMISSAO nunca calcula; ESPECIAL usa sempre a % fixa do cadastro; PADRAO usa
  // o override manual se existir, senão a % do NÍVEL HISTÓRICO daquela contratação
  // (não o nível atual — uma empresa contratada no GOLD sempre rende comissão de GOLD).
  const semComissao = parceiro.tipoParceiro === "SEM_COMISSAO";
  const ehEspecial = parceiro.tipoParceiro === "ESPECIAL";
  const TOTAL_TRIBUTOS_PCT = 19.53;

  const contratacoesParaTimeline = parceiro.indicacoes
    .filter((ind) => ind.cliente.dataContratacao)
    .map((ind) => {
      const data = new Date(ind.cliente.dataContratacao!);
      return isNaN(data.getTime()) ? null : { cnpj: ind.cliente.cnpj, data };
    })
    .filter((c): c is { cnpj: string; data: Date } => c !== null);
  const nivelHistoricoPorCnpj = calcularNivelPorContratacaoHistorico(contratacoesParaTimeline);

  const comissaoPercentualFixaEspecial = ehEspecial ? parceiro.comissaoPercentual ?? null : null;

  return {
    ...parceiro,
    indicacoes: parceiro.indicacoes.map((ind) => {
      const contrato = contratoPorCnpj.get(ind.cliente.cnpj);
      const valorContrato = contrato?.valorContrato ?? null;

      const nivelHistorico = nivelHistoricoPorCnpj.get(ind.cliente.cnpj) ?? null;
      const comissaoPercentualEmpresa = semComissao
        ? null
        : ehEspecial
          ? comissaoPercentualFixaEspecial
          : parceiro.comissaoPercentual ?? (nivelHistorico ? COMISSAO_POR_NIVEL[nivelHistorico] : null) ?? null;

      const receitaLiquida = !semComissao && valorContrato !== null ? valorContrato * (1 - TOTAL_TRIBUTOS_PCT / 100) : null;
      const comissaoValor = receitaLiquida !== null && comissaoPercentualEmpresa !== null
        ? receitaLiquida * (comissaoPercentualEmpresa / 100)
        : null;
      return {
        ...ind,
        cliente: {
          ...ind.cliente,
          servico: contrato?.servico ?? null,
          valorContrato,
          receitaLiquida,
          comissaoValor,
          comissaoPercentual: comissaoPercentualEmpresa,
        },
      };
    }),
  };
}

// ─── Permissões do módulo (Admin/CEO sempre full; outros via ParceiroAcesso) ──

interface ParceiroCtx {
  userId: number;
  role: string;
  isAdmin: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeAprovar: boolean;
}

async function getCtx(): Promise<ParceiroCtx | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = isAdminRole(role);
  let podeEditar = isAdmin;
  let podeExcluir = isAdmin;
  let podeAprovar = isAdmin;
  if (!isAdmin && userId) {
    const acesso = await db.parceiroAcesso.findUnique({ where: { userId } });
    podeEditar = acesso?.podeEditar ?? false;
    podeExcluir = acesso?.podeExcluir ?? false;
    podeAprovar = acesso?.podeAprovar ?? false;
  }
  return { userId, role, isAdmin, podeEditar, podeExcluir, podeAprovar };
}

/** Permissões do usuário atual no módulo — usado pela UI pra liberar/esconder botões. */
export async function getPermissaoParceiros() {
  const ctx = await getCtx();
  if (!ctx) return { isAdmin: false, podeEditar: false, podeExcluir: false, podeAprovar: false };
  return { isAdmin: ctx.isAdmin, podeEditar: ctx.podeEditar, podeExcluir: ctx.podeExcluir, podeAprovar: ctx.podeAprovar };
}

// ─── Engrenagem (Admin): gerenciar quem pode editar/excluir ──────────────────

export async function listarAcessosParceiros() {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { acessos: [], usuarios: [] };
  const [acessos, usuarios] = await Promise.all([
    db.parceiroAcesso.findMany({ include: { user: { select: { id: true, nome: true, email: true, role: true } } } }),
    db.usuarios.findMany({ select: { id: true, nome: true, email: true, role: true }, orderBy: { nome: "asc" } }),
  ]);
  return { acessos, usuarios };
}

export async function salvarAcessoParceiro(userId: number, podeEditar: boolean, podeExcluir: boolean, podeAprovar: boolean) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores" };
  await db.parceiroAcesso.upsert({
    where: { userId },
    create: { userId, podeEditar, podeExcluir, podeAprovar },
    update: { podeEditar, podeExcluir, podeAprovar },
  });
  return { success: true };
}

// ─── Níveis (GOLD/PLATINUM/BLACK) + comissão ─────────────────────────────────

const DIA_MS = 86_400_000;

/**
 * Recalcula o nível do parceiro a partir da linha do tempo das CONTRATAÇÕES (não das
 * vinculações) — o parceiro só sobe de nível quando a empresa indicada é efetivamente
 * contratada (cliente.dataContratacao preenchida no CS&NPS). Indicações ativas cujo
 * cliente ainda não tem dataContratacao são ignoradas neste cálculo (mas continuam
 * aparecendo normalmente na lista de empresas indicadas).
 * Regras: 1ª contratação=GOLD(5%); 2ª em até 60d=PLATINUM(10%); 3ª em até 60d=BLACK(15%);
 * BLACK renova a janela; gap >60d reinicia em GOLD; PLATINUM/BLACK inativo >60d → GOLD.
 */
export async function recalcularNivel(parceiroId: number): Promise<string> {
  const indicacoes = await db.indicacao.findMany({
    where: { parceiroId, status: "ATIVA" },
    select: { cliente: { select: { dataContratacao: true } } },
  });

  const datasContratacao = indicacoes
    .map((i) => (i.cliente.dataContratacao ? new Date(i.cliente.dataContratacao) : null))
    .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  let nivel = "GOLD";
  let nivelDate: Date | null = null;

  if (datasContratacao.length > 0) {
    nivelDate = datasContratacao[0];
    for (let i = 1; i < datasContratacao.length; i++) {
      const gap = (datasContratacao[i].getTime() - nivelDate.getTime()) / DIA_MS;
      if (gap <= 60) {
        if (nivel === "GOLD") nivel = "PLATINUM";
        else if (nivel === "PLATINUM") nivel = "BLACK";
        nivelDate = datasContratacao[i]; // sobe (ou renova BLACK)
      } else {
        nivel = "GOLD"; // passou de 60 dias → reinicia a contagem
        nivelDate = datasContratacao[i];
      }
    }
    // Rebaixamento por inatividade: PLATINUM/BLACK sem nova contratação há mais de 60 dias
    if (nivel !== "GOLD" && nivelDate && (Date.now() - nivelDate.getTime()) / DIA_MS > 60) {
      nivel = "GOLD";
    }
  }

  await db.parceiro.update({ where: { id: parceiroId }, data: { nivel, nivelAtualizadoEm: nivelDate } });
  return nivel;
}

/** Para um cron/manutenção: rebaixa PLATINUM/BLACK inativos. */
export async function recalcularNiveisInativos() {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false };
  const ativos = await db.parceiro.findMany({ where: { nivel: { in: ["PLATINUM", "BLACK"] } }, select: { id: true } });
  for (const p of ativos) await recalcularNivel(p.id);
  return { success: true, total: ativos.length };
}

// ─── Indicações (vincular parceiro ↔ empresa do CS&NPS) ──────────────────────

export async function criarIndicacao(parceiroId: number, clienteId: number) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false, error: "Sem permissão" };
  try {
    const existe = await db.indicacao.findUnique({ where: { clienteId } });
    if (existe && existe.status === "ATIVA") {
      return { success: false, error: "Esta empresa já está vinculada a um parceiro" };
    }
    if (existe) {
      await db.indicacao.update({
        where: { clienteId },
        data: { parceiroId, status: "ATIVA", dataIndicacao: new Date(), criadoPorId: ctx.userId },
      });
    } else {
      await db.indicacao.create({ data: { parceiroId, clienteId, criadoPorId: ctx.userId } });
    }
    await recalcularNivel(parceiroId);
    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao vincular a indicação" };
  }
}

/** Desvincular indicação — APENAS Admin. */
export async function desvincularIndicacao(indicacaoId: number) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores podem desvincular" };
  const ind = await db.indicacao.findUnique({ where: { id: indicacaoId } });
  if (!ind) return { success: false, error: "Indicação não encontrada" };
  await db.indicacao.update({ where: { id: indicacaoId }, data: { status: "DESVINCULADA" } });
  await recalcularNivel(ind.parceiroId);
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true };
}

/** Empresas do CS&NPS para o modal de indicação (mostra se já têm parceiro e o status do processo). */
export async function listarClientesParaIndicacao(busca?: string) {
  const session = await auth();
  if (!session?.user) return [];

  // `contains` já é case-insensitive neste adapter (LibSQL) — confirmado. O bug
  // real era `cnpj: { contains: "" }` quando a busca não tinha dígitos: string
  // vazia SEMPRE bate no Prisma, fazendo o OR inteiro devolver tudo e ignorar
  // o filtro por nome. Só inclui o termo de CNPJ quando há dígito de verdade.
  const buscaLimpa = busca?.trim() ?? "";
  const cnpjDigitos = buscaLimpa.replace(/\D/g, "");

  const clientes = await db.clientes.findMany({
    where: buscaLimpa
      ? {
          OR: [
            { razaoSocial: { contains: buscaLimpa } },
            { nomeFantasia: { contains: buscaLimpa } },
            ...(cnpjDigitos ? [{ cnpj: { contains: cnpjDigitos } }] : []),
          ],
        }
      : {},
    select: {
      id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, status: true,
      indicacao: { select: { parceiroId: true, status: true } },
    },
    take: 30,
    orderBy: { razaoSocial: "asc" },
  });
  return clientes;
}

/** Lista enxuta de parceiros para selects (modais, Metas). */
export async function listarParceirosSimples() {
  const session = await auth();
  if (!session?.user) return [];
  return db.parceiro.findMany({
    select: {
      id: true, nome: true, nomeFantasia: true, documento: true, nivel: true,
      representantes: { select: { nome: true } },
    },
    orderBy: { nome: "asc" },
  });
}

/** Dados completos do parceiro para confirmação visual (ex: ao selecionar "Indicação Parceiro" em Novo Cliente). Somente leitura. */
export async function buscarParceiroDetalheSimples(id: number) {
  const session = await auth();
  if (!session?.user) return null;
  return db.parceiro.findUnique({
    where: { id },
    select: {
      id: true, tipo: true, documento: true, nome: true, nomeFantasia: true,
      email: true, telefone: true, telefone2: true, nivel: true,
      endereco: { select: { cep: true, logradouro: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true } },
      representantes: { select: { nome: true, documento: true, cargo: true, email: true, telefone: true } },
    },
  });
}

// ─── Edição e exclusão (com permissão) ───────────────────────────────────────

const EditarParceiroSchema = z.object({
  nome: z.string().min(2),
  nomeFantasia: z.string().optional().nullable(),
  dataNascimento: z.string().optional().nullable(),
  sobre: z.string().optional().nullable(),
  email: z.string().email(),
  telefone: z.string().optional().nullable(),
  telefone2: z.string().optional().nullable(),
  chavePix: z.string().optional().nullable(),
  tipoChavePix: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional().nullable(),
  nomeBanco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipoParceiro: z.enum(["PADRAO", "SEM_COMISSAO", "ESPECIAL"]).optional(),
  comissaoPercentual: z.number().min(0).max(100).optional().nullable(),
  endereco: EnderecoSchema.optional(),
  responsaveis: z.array(ResponsavelSchema).optional(),
});

export async function editarParceiro(id: number, input: z.infer<typeof EditarParceiroSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false, error: "Sem permissão para editar" };

  const parsed = EditarParceiroSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const d = parsed.data;

  // Se o admin mudar Pix ou dados bancários, a confirmação anterior do parceiro
  // não vale mais para o novo valor — precisa reconfirmar pelo portal.
  const atual = await db.parceiro.findUnique({
    where: { id },
    select: { tipo: true, chavePix: true, tipoChavePix: true, nomeBanco: true, agencia: true, conta: true },
  });
  if (!atual) return { success: false, error: "Parceiro não encontrado" };

  const responsaveisValidos = d.responsaveis?.filter((responsavel) => responsavel.nome.trim().length >= 2);
  if (atual.tipo === "PJ" && d.responsaveis && responsaveisValidos?.length === 0) {
    return { success: false, error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica" };
  }
  const dadosBancariosMudaram =
    (atual?.chavePix ?? null) !== (d.chavePix ?? null) ||
    (atual?.tipoChavePix ?? null) !== (d.tipoChavePix ?? null) ||
    (atual?.nomeBanco ?? null) !== (d.nomeBanco ?? null) ||
    (atual?.agencia ?? null) !== (d.agencia ?? null) ||
    (atual?.conta ?? null) !== (d.conta ?? null);

  // SEM_COMISSAO nunca guarda override manual — a comissão fica sempre indefinida.
  const comissaoFinal = d.tipoParceiro === "SEM_COMISSAO" ? null : (d.comissaoPercentual ?? null);

  try {
    await db.parceiro.update({
      where: { id },
      data: {
        nome: d.nome,
        nomeFantasia: d.nomeFantasia ?? null,
        dataNascimento: d.dataNascimento ?? null,
        sobre: d.sobre ?? null,
        email: d.email,
        loginEmail: d.email.toLowerCase().trim(),
        telefone: d.telefone ?? null,
        telefone2: d.telefone2 ?? null,
        chavePix: d.chavePix ?? null,
        tipoChavePix: d.tipoChavePix ?? null,
        nomeBanco: d.nomeBanco ?? null,
        agencia: d.agencia ?? null,
        conta: d.conta ?? null,
        ...(dadosBancariosMudaram && { pixConfirmado: false, pixConfirmadoEm: null }),
        ...(d.tipoParceiro && { tipoParceiro: d.tipoParceiro }),
        comissaoPercentual: comissaoFinal,
        ...(d.endereco && {
          endereco: {
            upsert: {
              create: { cep: d.endereco.cep.replace(/\D/g, ""), logradouro: d.endereco.logradouro, numero: d.endereco.numero || null, complemento: d.endereco.complemento || null, bairro: d.endereco.bairro, cidade: d.endereco.cidade, uf: d.endereco.uf.toUpperCase() },
              update: { cep: d.endereco.cep.replace(/\D/g, ""), logradouro: d.endereco.logradouro, numero: d.endereco.numero || null, complemento: d.endereco.complemento || null, bairro: d.endereco.bairro, cidade: d.endereco.cidade, uf: d.endereco.uf.toUpperCase() },
            },
          },
        }),
        ...(d.responsaveis && {
          // Substitui o conjunto de representantes (deleta os antigos e recria)
          representantes: {
            deleteMany: {},
            create: (responsaveisValidos ?? [])
              .map(r => ({
                tipo: "PF",
                documento: r.cpf?.replace(/\D/g, "") || "",
                nome: r.nome,
                dataNascimento: r.dataNascimento || null,
                cargo: r.cargo || null,
                email: r.email || null,
                telefone: r.telefone || null,
              })),
          },
        }),
      },
    });
    revalidatePath("/PainelAlpha/Parceiros");
    revalidatePath(`/PainelAlpha/Parceiros/${id}`);
    return { success: true };
  } catch (error) {
    console.error("[editarParceiro]", error);
    return { success: false, error: "Erro ao salvar alterações" };
  }
}

/**
 * Redefine a senha de acesso de um parceiro — SOMENTE Admin/CEO.
 * Não exige a senha atual. A nova senha entra como temporária, forçando o
 * parceiro a definir uma própria no próximo acesso ao portal.
 */
export async function redefinirSenhaParceiro(parceiroId: number, novaSenha: string) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores podem redefinir a senha" };

  const senha = (novaSenha ?? "").trim();
  if (senha.length < 6) return { success: false, error: "A senha deve ter ao menos 6 caracteres" };

  try {
    await db.parceiro.update({
      where: { id: parceiroId },
      data: { senhaHash: hashSync(senha, 10), senhaTemporaria: true },
    });
    revalidatePath(`/PainelAlpha/Parceiros/${parceiroId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao redefinir a senha" };
  }
}

/**
 * Ativa/desativa o acesso do parceiro ao portal (AlphaParceiros), sem excluir o
 * cadastro. Parceiro desativado tem o login bloqueado (ver findParceiroByCredentials
 * no projeto alphaparceiros). Admin only.
 */
export async function alternarAcessoParceiro(parceiroId: number, ativo: boolean) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores podem ativar/desativar acesso" };

  try {
    await db.parceiro.update({
      where: { id: parceiroId },
      data: {
        ativo,
        desativadoEm: ativo ? null : new Date(),
        desativadoPorId: ativo ? null : ctx.userId,
      },
    });
    revalidatePath("/PainelAlpha/Parceiros");
    revalidatePath(`/PainelAlpha/Parceiros/${parceiroId}`);
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao alterar o acesso do parceiro" };
  }
}

/** Exclusão em massa — exige permissão de excluir (Admin ou liberado na engrenagem). */
export async function excluirParceiros(ids: number[]) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeExcluir)) return { success: false, error: "Sem permissão para excluir" };
  if (!ids.length) return { success: false, error: "Nenhum parceiro selecionado" };
  try {
    const res = await db.parceiro.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true, count: res.count };
  } catch {
    return { success: false, error: "Erro ao excluir" };
  }
}

// ─── Termo de adesão editável (Admin) + histórico ───────────────────────────

/** Retorna o termo ATIVO (versão + conteúdo). Qualquer usuário logado pode ler. */
export async function obterTermoAtivo() {
  const session = await auth();
  if (!session?.user) return null;
  const termo = await db.parceiroTermo.findFirst({
    where: { ativo: true },
    orderBy: { createdAt: "desc" },
  });
  return termo ? { id: termo.id, versao: termo.versao, conteudo: termo.conteudo, updatedAt: termo.updatedAt } : null;
}

/** Histórico de todas as versões do termo (mais recente primeiro). Admin. */
export async function listarHistoricoTermos() {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return [];
  const termos = await db.parceiroTermo.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, versao: true, ativo: true, createdAt: true },
  });
  return termos.map((t) => ({
    id: t.id,
    versao: t.versao,
    ativo: t.ativo,
    createdAt: t.createdAt.toISOString(),
  }));
}

/** Lê o conteúdo de uma versão específica do termo (para visualizar histórico). Admin. */
export async function obterTermoPorId(id: number) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return null;
  const termo = await db.parceiroTermo.findUnique({ where: { id } });
  return termo
    ? { id: termo.id, versao: termo.versao, conteudo: termo.conteudo, ativo: termo.ativo, createdAt: termo.createdAt.toISOString() }
    : null;
}

/**
 * Publica uma NOVA versão do termo — SOMENTE Admin. Sempre cria um registro novo
 * e desativa as anteriores (NUNCA edita versões já existentes → histórico imutável).
 * A versão deve ser única (não pode repetir uma já publicada).
 */
export async function atualizarTermo(versao: string, conteudo: string) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores podem atualizar o termo" };

  const v = (versao ?? "").trim();
  const texto = (conteudo ?? "").trim();
  if (!v) return { success: false, error: "Informe a versão do termo (ex: V1.1 - 2026)" };
  if (texto.length < 20) return { success: false, error: "O conteúdo do termo é muito curto" };

  try {
    // Versão não pode colidir com uma já publicada (histórico imutável por versão)
    const jaExiste = await db.parceiroTermo.findFirst({ where: { versao: v }, select: { id: true } });
    if (jaExiste) {
      return { success: false, error: `A versão "${v}" já existe no histórico. Use um número de versão novo.` };
    }

    await db.parceiroTermo.updateMany({ where: { ativo: true }, data: { ativo: false } });
    await db.parceiroTermo.create({
      data: { versao: v, conteudo: texto, ativo: true, criadoPorId: ctx.userId ?? null },
    });
    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true };
  } catch (err) {
    // Expõe a causa real no servidor (antes ficava silenciado pelo catch vazio)
    console.error("[atualizarTermo] falhou:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: `Erro ao atualizar o termo: ${msg}` };
  }
}

// ─── Comprovante de comissão (envio no PainelAlpha, visto no portal) ─────────

/**
 * Envia (ou substitui) o comprovante de comissão de uma indicação. SÓ Admin ou
 * quem tem podeEditar. Aceita qualquer tipo de arquivo. Sobe pro Vercel Blob
 * usando o token dedicado COMISSOES_READ_WRITE_TOKEN (access público).
 */
export async function enviarComprovante(indicacaoId: number, formData: FormData) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false, error: "Sem permissão" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Nenhum arquivo selecionado" };
  if (file.size > 25 * 1024 * 1024) return { success: false, error: "Arquivo muito grande (máx. 25MB)" };

  const ind = await db.indicacao.findUnique({ where: { id: indicacaoId }, select: { id: true } });
  if (!ind) return { success: false, error: "Indicação não encontrada" };

  const token = process.env.COMISSOES_READ_WRITE_TOKEN;
  if (!token) return { success: false, error: "COMISSOES_READ_WRITE_TOKEN não configurado" };

  try {
    const blob = await put(`comprovantes/${indicacaoId}-${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
      token,
    });

    // Quem enviou (nome do usuário logado)
    const session = await auth();
    const enviadoPor = (session?.user as { nome?: string })?.nome ?? "—";

    await db.indicacao.update({
      where: { id: indicacaoId },
      data: {
        comprovanteUrl: blob.url,
        comprovanteNome: file.name,
        comprovanteTipo: file.type || "application/octet-stream",
        comprovanteEnviadoEm: new Date(),
        comprovanteEnviadoPor: enviadoPor,
      },
    });

    revalidatePath(`/PainelAlpha/Parceiros/${ind.id}`);
    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true, url: blob.url, nome: file.name };
  } catch (err) {
    console.error("[enviarComprovante] falhou:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: `Erro ao enviar comprovante: ${msg}` };
  }
}

/** Remove o comprovante de uma indicação (Admin/podeEditar). */
export async function removerComprovante(indicacaoId: number) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false, error: "Sem permissão" };
  try {
    await db.indicacao.update({
      where: { id: indicacaoId },
      data: {
        comprovanteUrl: null,
        comprovanteNome: null,
        comprovanteTipo: null,
        comprovanteEnviadoEm: null,
        comprovanteEnviadoPor: null,
      },
    });
    revalidatePath("/PainelAlpha/Parceiros");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao remover comprovante" };
  }
}
