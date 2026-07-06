"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import { criarParceiro } from "@/actions/parceiros";

// ─── Helpers de contexto/permissão ────────────────────────────────────────────

interface Ctx {
  userId: number;
  role: string;
  isAdmin: boolean;
  podeAcessarParceiros: boolean;
}

async function getCtx(): Promise<Ctx | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = role === "Admin" || role === "CEO";
  // Acesso ao módulo: admin OU registro em ParceiroAcesso.
  let podeAcessarParceiros = isAdmin;
  if (!isAdmin && userId) {
    const acesso = await db.parceiroAcesso.findUnique({ where: { userId } });
    podeAcessarParceiros = !!acesso;
  }
  return { userId, role, isAdmin, podeAcessarParceiros };
}

const VALIDADES_PERMITIDAS = [1, 3, 7, 15, 30] as const;

// ─── Config do módulo (singleton) ─────────────────────────────────────────────

/** Lê a config do módulo Parceiros (cria a linha padrão se não existir). */
export async function obterConfigParceiros() {
  const cfg = await db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: { permitirParceiroConvidar: true, validadeConvitePadraoDias: true },
  });
  return cfg;
}

/** Liga/desliga a permissão de parceiros gerarem convites. Admin only. */
export async function togglePermitirParceiroConvidar(ativo: boolean) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Apenas administradores" };
  await db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1, permitirParceiroConvidar: ativo },
    update: { permitirParceiroConvidar: ativo },
  });
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}

// ─── Geração / gestão de convites (equipe do Painel) ──────────────────────────

const GerarConviteSchema = z.object({
  validadeDias: z.number().int().refine((v) => VALIDADES_PERMITIDAS.includes(v as 1 | 3 | 7 | 15 | 30), {
    message: "Validade inválida",
  }),
});

/** Gera um convite (link) com token e validade. Equipe com acesso ao módulo. */
export async function gerarConvite(input: z.infer<typeof GerarConviteSchema>) {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return { success: false as const, error: "Sem permissão" };

  const parsed = GerarConviteSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  const expiraEm = new Date(Date.now() + parsed.data.validadeDias * 86_400_000);
  const token = randomUUID();
  // PIN de 4 dígitos — protege a busca automática de CPF (custo por chamada na InfoSimples).
  const pin = String(Math.floor(1000 + Math.random() * 9000));

  const convite = await db.conviteParceiro.create({
    data: { token, expiraEm, pin, criadoPorUserId: ctx.userId },
    select: { id: true, token: true, expiraEm: true, status: true, pin: true },
  });

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, convite };
}

/** Lista convites gerados (mais recentes primeiro). Equipe com acesso. */
export async function listarConvites() {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return { convites: [] };

  const convites = await db.conviteParceiro.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, token: true, status: true, expiraEm: true, createdAt: true,
      criadoPorUser: { select: { nome: true } },
      criadoPorParceiro: { select: { nome: true } },
      _count: { select: { preCadastros: true } },
    },
  });
  return { convites };
}

/** Revoga um convite (invalida o link imediatamente). Equipe com acesso. */
export async function revogarConvite(id: number) {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return { success: false as const, error: "Sem permissão" };
  await db.conviteParceiro.update({ where: { id }, data: { status: "REVOGADO" } });
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}

// ─── Validação pública do token + submissão do formulário ─────────────────────

/**
 * Valida um token de convite (uso público — chamado da página do formulário).
 * Retorna o termo ATIVO + versão para exibir no form. NÃO expõe dados sensíveis.
 */
export async function validarConvitePublico(token: string): Promise<
  | { valido: false; motivo: "NAO_ENCONTRADO" | "EXPIRADO" | "USADO" | "REVOGADO" }
  | { valido: true; termo: { versao: string; conteudo: string } | null }
> {
  if (!token || token.length < 10) return { valido: false, motivo: "NAO_ENCONTRADO" };

  const convite = await db.conviteParceiro.findUnique({
    where: { token },
    select: { status: true, expiraEm: true },
  });

  if (!convite) return { valido: false, motivo: "NAO_ENCONTRADO" };
  if (convite.status === "REVOGADO") return { valido: false, motivo: "REVOGADO" };
  if (convite.status === "USADO") return { valido: false, motivo: "USADO" };
  if (convite.expiraEm.getTime() < Date.now()) return { valido: false, motivo: "EXPIRADO" };

  const termo = await db.parceiroTermo.findFirst({
    where: { ativo: true },
    orderBy: { createdAt: "desc" },
    select: { versao: true, conteudo: true },
  });

  return { valido: true, termo };
}

// Validação rígida do formulário público (espelho do Google Forms).
const PreCadastroSchema = z.object({
  token: z.string().min(10),
  email: z.string().email("E-mail inválido").max(200),
  nomeCompleto: z.string().min(2, "Informe o nome completo").max(200),
  cpf: z.string().max(20).optional(),
  dataNascimento: z.string().max(20).optional(),
  dadosConsultaCpf: z.string().optional(),
  uf: z.string().length(2, "Selecione o estado"),
  municipio: z.string().max(120).optional(),
  telefone: z.string().min(8, "Informe o telefone").max(30),
  whatsapp: z.string().max(30).optional(),
  cep: z.string().max(9).optional(),
  logradouro: z.string().max(150).optional(),
  numero: z.string().max(30).optional(),
  complemento: z.string().max(30).optional(),
  bairro: z.string().max(150).optional(),
  cidade: z.string().max(150).optional(),
  areasAtuacao: z.array(z.string().max(60)).max(15).optional(),
  nomeEmpresa: z.string().max(200).optional(),
  razaoSocial: z.string().max(200).optional(),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z.string().max(20).optional(),
  dadosConsultaCnpj: z.string().optional(),
  sobre: z.string().max(3000).optional(),
  termoAceito: z.boolean().refine((v) => v === true, { message: "É necessário aceitar os termos" }),
});

/**
 * Submete o formulário público → cria um PreCadastroParceiro (PENDENTE).
 * Marca o convite como USADO (uso único). Sem auth (rota pública), mas o token
 * é a credencial — validado a cada chamada.
 */
export async function submeterConvitePublico(input: z.infer<typeof PreCadastroSchema>) {
  const parsed = PreCadastroSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;

  const convite = await db.conviteParceiro.findUnique({
    where: { token: d.token },
    select: { id: true, status: true, expiraEm: true, usoUnico: true },
  });
  if (!convite) return { success: false as const, error: "Convite inválido" };
  if (convite.status !== "PENDENTE") return { success: false as const, error: "Este convite não está mais disponível" };
  if (convite.expiraEm.getTime() < Date.now()) return { success: false as const, error: "Este convite expirou" };

  // Captura a versão do termo ativo no momento do aceite.
  const termo = await db.parceiroTermo.findFirst({
    where: { ativo: true },
    orderBy: { createdAt: "desc" },
    select: { versao: true },
  });

  await db.$transaction([
    db.preCadastroParceiro.create({
      data: {
        conviteId: convite.id,
        email: d.email.trim(),
        nomeCompleto: d.nomeCompleto.trim(),
        cpf: d.cpf?.replace(/\D/g, "") || null,
        dataNascimento: d.dataNascimento?.trim() || null,
        dadosConsultaCpf: d.dadosConsultaCpf || null,
        uf: d.uf.toUpperCase(),
        municipio: d.municipio?.trim() || null,
        telefone: d.telefone.trim(),
        whatsapp: d.whatsapp?.trim() || null,
        cep: d.cep?.replace(/\D/g, "") || null,
        logradouro: d.logradouro?.trim() || null,
        numero: d.numero?.trim() || null,
        complemento: d.complemento?.trim() || null,
        bairro: d.bairro?.trim() || null,
        cidade: d.cidade?.trim() || null,
        areasAtuacao: d.areasAtuacao && d.areasAtuacao.length > 0 ? d.areasAtuacao.join(",") : null,
        nomeEmpresa: d.nomeEmpresa?.trim() || null,
        razaoSocial: d.razaoSocial?.trim() || null,
        nomeFantasia: d.nomeFantasia?.trim() || null,
        cnpj: d.cnpj?.replace(/\D/g, "") || null,
        dadosConsultaCnpj: d.dadosConsultaCnpj || null,
        sobre: d.sobre?.trim() || null,
        termoVersao: termo?.versao ?? "sem-versao",
        termoAceito: true,
      },
    }),
    db.conviteParceiro.update({
      where: { id: convite.id },
      data: { status: convite.usoUnico ? "USADO" : "PENDENTE" },
    }),
  ]);

  return { success: true as const };
}

// ─── Pré-cadastros: listar e aprovar (vira Parceiro) ──────────────────────────

/** Lista pré-cadastros por status (default PENDENTE). Equipe com acesso. */
export async function listarPreCadastros(status: "PENDENTE" | "APROVADO" | "REJEITADO" = "PENDENTE") {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return { preCadastros: [] };

  const preCadastros = await db.preCadastroParceiro.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, email: true, nomeCompleto: true, cpf: true, dataNascimento: true, uf: true, municipio: true,
      telefone: true, whatsapp: true, cep: true, logradouro: true, numero: true,
      complemento: true, bairro: true, cidade: true,
      areasAtuacao: true, nomeEmpresa: true, razaoSocial: true, nomeFantasia: true, cnpj: true, sobre: true,
      termoVersao: true, termoAceitoEm: true, status: true, createdAt: true,
    },
  });
  return { preCadastros };
}

/** Conta pré-cadastros pendentes (badge na UI). */
export async function contarPreCadastrosPendentes() {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return 0;
  return db.preCadastroParceiro.count({ where: { status: "PENDENTE" } });
}

/**
 * Aprova um pré-cadastro → cria o Parceiro de verdade via criarParceiro().
 * Determina PF/PJ pelo documento informado (CNPJ tem prioridade se houver).
 */
export async function aprovarPreCadastro(preCadastroId: number) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Apenas administradores aprovam pré-cadastros" };

  const pc = await db.preCadastroParceiro.findUnique({ where: { id: preCadastroId } });
  if (!pc) return { success: false as const, error: "Pré-cadastro não encontrado" };
  if (pc.status !== "PENDENTE") return { success: false as const, error: "Pré-cadastro já processado" };

  const cnpj = pc.cnpj?.replace(/\D/g, "") ?? "";
  const cpf = pc.cpf?.replace(/\D/g, "") ?? "";
  const tipo = cnpj.length === 14 ? "PJ" : "PF";
  const documento = tipo === "PJ" ? cnpj : cpf;

  if (!documento || documento.length < 11) {
    return { success: false as const, error: "Pré-cadastro sem CPF/CNPJ válido — peça o documento antes de aprovar" };
  }

  // Endereço estruturado só é enviado se todos os campos obrigatórios do
  // EnderecoSchema (parceiros.ts) estiverem presentes — campos são opcionais
  // no pré-cadastro (wizard pode não ter passado por essa etapa em respostas antigas).
  const enderecoCompleto =
    pc.cep && pc.logradouro && pc.bairro && pc.cidade && pc.uf
      ? {
          cep: pc.cep,
          logradouro: pc.logradouro,
          numero: pc.numero ?? undefined,
          complemento: pc.complemento ?? undefined,
          bairro: pc.bairro,
          cidade: pc.cidade,
          uf: pc.uf,
        }
      : undefined;

  // Dados brutos das duas consultas automáticas (CPF via InfoSimples, CNPJ via
  // ReceitaFederal) combinados num único payload — evita reconsultar na aprovação.
  const dadosConsultaCombinado =
    pc.dadosConsultaCpf || pc.dadosConsultaCnpj
      ? JSON.stringify({
          cpf: pc.dadosConsultaCpf ? JSON.parse(pc.dadosConsultaCpf) : null,
          cnpj: pc.dadosConsultaCnpj ? JSON.parse(pc.dadosConsultaCnpj) : null,
        })
      : undefined;

  const resultado = await criarParceiro({
    tipo,
    documento,
    // Razão social (empresa) tem prioridade; sem ela, usa o nome da pessoa (PF sem empresa).
    nome: pc.razaoSocial ?? pc.nomeCompleto,
    nomeFantasia: pc.nomeFantasia ?? pc.nomeEmpresa ?? undefined,
    email: pc.email,
    telefone: pc.telefone,
    telefone2: pc.whatsapp ?? undefined,
    nivel: "GOLD",
    endereco: enderecoCompleto,
    dadosConsulta: dadosConsultaCombinado,
    // Termo já foi aceito no wizard do convite — o parceiro nasce com o aceite registrado.
    termoAceito: true,
    termoAceitoEm: pc.termoAceitoEm,
    termoVersao: pc.termoVersao,
  });

  if (!resultado.success || !resultado.parceiro) {
    return { success: false as const, error: resultado.error ?? "Falha ao criar parceiro" };
  }

  await db.preCadastroParceiro.update({
    where: { id: preCadastroId },
    data: { status: "APROVADO", parceiroId: resultado.parceiro.id, aprovadoPorId: ctx.userId },
  });

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, parceiro: resultado.parceiro };
}

/** Rejeita um pré-cadastro. Equipe com acesso. */
export async function rejeitarPreCadastro(preCadastroId: number) {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return { success: false as const, error: "Sem permissão" };
  await db.preCadastroParceiro.update({ where: { id: preCadastroId }, data: { status: "REJEITADO" } });
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}
