"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
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
  cpf: z.string().min(11),
  dataNascimento: z.string().min(1),
  cargo: z.string().optional(),
});

const ParceiroSchema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  documento: z.string().min(11),
  nome: z.string().min(2),
  nomeFantasia: z.string().optional(),
  email: z.string().email(),
  telefone: z.string().optional(),
  telefone2: z.string().optional(),
  chavePix: z.string().optional(),
  tipoChavePix: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional(),
  nivel: z.enum(["GOLD", "PLATINUM", "BLACK"]).default("GOLD"),
  comissaoPercentual: z.number().min(0).max(100).optional(),
  dadosConsulta: z.string().optional(),
  endereco: EnderecoSchema.optional(),
  responsaveis: z.array(ResponsavelSchema).optional(),
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

    const { tipo, documento, nome, nomeFantasia, email, telefone, telefone2, chavePix, tipoChavePix, nivel, comissaoPercentual, dadosConsulta, endereco, responsaveis } = parsed.data;

    const docLimpo = documento.replace(/\D/g, "");

    const existente = await db.parceiro.findUnique({ where: { documento: docLimpo } });
    if (existente) return { success: false, error: "Documento já cadastrado como parceiro" };

    const respValidos = (responsaveis ?? []).filter(r => r.nome.trim() && r.cpf.replace(/\D/g, "").length >= 11);
    if (tipo === "PJ" && respValidos.length === 0) {
      return { success: false, error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica" };
    }

    const senhaGerada = gerarSenhaSegura();
    const senhaHash = hashSync(senhaGerada, 10);

    const parceiro = await db.parceiro.create({
      data: {
        tipo,
        documento: docLimpo,
        nome,
        nomeFantasia: nomeFantasia || null,
        email,
        telefone: telefone || null,
        telefone2: telefone2 || null,
        chavePix: chavePix || null,
        tipoChavePix: tipoChavePix || null,
        nivel,
        comissaoPercentual: comissaoPercentual ?? null,
        dadosConsulta: dadosConsulta || null,
        loginEmail: email,
        senhaHash,
        criadoPorId: Number(userId),
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
          responsaveis: {
            create: respValidos.map(r => ({
              nome: r.nome,
              cpf: r.cpf.replace(/\D/g, ""),
              dataNascimento: r.dataNascimento,
              cargo: r.cargo || null,
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

export async function buscarParceiro(id: number) {
  const session = await auth();
  if (!session?.user) return null;

  return db.parceiro.findUnique({
    where: { id },
    include: {
      endereco: true,
      responsaveis: true,
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
}

// ─── Permissões do módulo (Admin/CEO sempre full; outros via ParceiroAcesso) ──

interface ParceiroCtx {
  userId: number;
  role: string;
  isAdmin: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
}

async function getCtx(): Promise<ParceiroCtx | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";
  let podeEditar = isAdmin;
  let podeExcluir = isAdmin;
  if (!isAdmin && userId) {
    const acesso = await db.parceiroAcesso.findUnique({ where: { userId } });
    podeEditar = acesso?.podeEditar ?? false;
    podeExcluir = acesso?.podeExcluir ?? false;
  }
  return { userId, role, isAdmin, podeEditar, podeExcluir };
}

/** Permissões do usuário atual no módulo — usado pela UI pra liberar/esconder botões. */
export async function getPermissaoParceiros() {
  const ctx = await getCtx();
  if (!ctx) return { isAdmin: false, podeEditar: false, podeExcluir: false };
  return { isAdmin: ctx.isAdmin, podeEditar: ctx.podeEditar, podeExcluir: ctx.podeExcluir };
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

export async function salvarAcessoParceiro(userId: number, podeEditar: boolean, podeExcluir: boolean) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false, error: "Apenas administradores" };
  await db.parceiroAcesso.upsert({
    where: { userId },
    create: { userId, podeEditar, podeExcluir },
    update: { podeEditar, podeExcluir },
  });
  return { success: true };
}

// ─── Níveis (GOLD/PLATINUM/BLACK) + comissão ─────────────────────────────────

const DIA_MS = 86_400_000;

/**
 * Recalcula o nível do parceiro a partir da linha do tempo das indicações ativas.
 * Regras: 1ª indicação=GOLD(5%); 2ª em até 60d=PLATINUM(10%); 3ª em até 60d=BLACK(15%);
 * BLACK renova a janela; gap >60d reinicia em GOLD; PLATINUM/BLACK inativo >60d → GOLD.
 */
export async function recalcularNivel(parceiroId: number): Promise<string> {
  const indicacoes = await db.indicacao.findMany({
    where: { parceiroId, status: "ATIVA" },
    orderBy: { dataIndicacao: "asc" },
    select: { dataIndicacao: true },
  });

  let nivel = "GOLD";
  let nivelDate: Date | null = null;

  if (indicacoes.length > 0) {
    nivelDate = indicacoes[0].dataIndicacao;
    for (let i = 1; i < indicacoes.length; i++) {
      const gap = (indicacoes[i].dataIndicacao.getTime() - nivelDate.getTime()) / DIA_MS;
      if (gap <= 60) {
        if (nivel === "GOLD") nivel = "PLATINUM";
        else if (nivel === "PLATINUM") nivel = "BLACK";
        nivelDate = indicacoes[i].dataIndicacao; // sobe (ou renova BLACK)
      } else {
        nivel = "GOLD"; // passou de 60 dias → reinicia a contagem
        nivelDate = indicacoes[i].dataIndicacao;
      }
    }
    // Rebaixamento por inatividade: PLATINUM/BLACK sem nova indicação há mais de 60 dias
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

/** Empresas do CS&NPS para o modal de indicação (mostra se já têm parceiro). */
export async function listarClientesParaIndicacao(busca?: string) {
  const session = await auth();
  if (!session?.user) return [];
  return db.clientes.findMany({
    where: busca
      ? {
          OR: [
            { razaoSocial: { contains: busca } },
            { nomeFantasia: { contains: busca } },
            { cnpj: { contains: busca.replace(/\D/g, "") } },
          ],
        }
      : {},
    select: {
      id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
      indicacao: { select: { parceiroId: true, status: true } },
    },
    take: 30,
    orderBy: { razaoSocial: "asc" },
  });
}

/** Lista enxuta de parceiros para selects (modais, Metas). */
export async function listarParceirosSimples() {
  const session = await auth();
  if (!session?.user) return [];
  return db.parceiro.findMany({
    select: { id: true, nome: true, nomeFantasia: true, documento: true, nivel: true },
    orderBy: { nome: "asc" },
  });
}

// ─── Edição e exclusão (com permissão) ───────────────────────────────────────

const EditarParceiroSchema = z.object({
  nome: z.string().min(2),
  nomeFantasia: z.string().optional().nullable(),
  email: z.string().email(),
  telefone: z.string().optional().nullable(),
  telefone2: z.string().optional().nullable(),
  chavePix: z.string().optional().nullable(),
  tipoChavePix: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]).optional().nullable(),
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

  try {
    await db.parceiro.update({
      where: { id },
      data: {
        nome: d.nome,
        nomeFantasia: d.nomeFantasia ?? null,
        email: d.email,
        loginEmail: d.email,
        telefone: d.telefone ?? null,
        telefone2: d.telefone2 ?? null,
        chavePix: d.chavePix ?? null,
        tipoChavePix: d.tipoChavePix ?? null,
        comissaoPercentual: d.comissaoPercentual ?? null,
        ...(d.endereco && {
          endereco: {
            upsert: {
              create: { cep: d.endereco.cep.replace(/\D/g, ""), logradouro: d.endereco.logradouro, numero: d.endereco.numero || null, complemento: d.endereco.complemento || null, bairro: d.endereco.bairro, cidade: d.endereco.cidade, uf: d.endereco.uf.toUpperCase() },
              update: { cep: d.endereco.cep.replace(/\D/g, ""), logradouro: d.endereco.logradouro, numero: d.endereco.numero || null, complemento: d.endereco.complemento || null, bairro: d.endereco.bairro, cidade: d.endereco.cidade, uf: d.endereco.uf.toUpperCase() },
            },
          },
        }),
        ...(d.responsaveis && {
          // Substitui o conjunto de responsáveis (deleta os antigos e recria)
          responsaveis: {
            deleteMany: {},
            create: d.responsaveis
              .filter(r => r.nome.trim() && r.cpf.replace(/\D/g, "").length >= 11)
              .map(r => ({ nome: r.nome, cpf: r.cpf.replace(/\D/g, ""), dataNascimento: r.dataNascimento, cargo: r.cargo || null })),
          },
        }),
      },
    });
    revalidatePath("/PainelAlpha/Parceiros");
    revalidatePath(`/PainelAlpha/Parceiros/${id}`);
    return { success: true };
  } catch {
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
