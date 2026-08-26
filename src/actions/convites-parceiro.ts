"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import { criarParceiro } from "@/actions/parceiros";
import { pusherServer } from "@/lib/pusher-server.ts";

// ─── Helpers de contexto/permissão ────────────────────────────────────────────

interface Ctx {
  userId: number;
  role: string;
  isAdmin: boolean;
  podeAcessarParceiros: boolean;
  podeAprovar: boolean;
}

async function getCtx(): Promise<Ctx | null> {
  const session = await auth();
  if (!session?.user) return null;
  const userId = Number((session.user as { id?: string | number }).id ?? 0);
  const role = (session.user as { role?: string }).role ?? "";
  const isAdmin = isAdminRole(role);
  // Acesso ao módulo: admin OU registro em ParceiroAcesso.
  let podeAcessarParceiros = isAdmin;
  let podeAprovar = isAdmin;
  if (!isAdmin && userId) {
    const acesso = await db.parceiroAcesso.findUnique({ where: { userId } });
    podeAcessarParceiros = !!acesso;
    podeAprovar = acesso?.podeAprovar ?? false;
  }
  return { userId, role, isAdmin, podeAcessarParceiros, podeAprovar };
}

const VALIDADES_PERMITIDAS = [1, 3, 7, 15, 30] as const;

// ─── Config do módulo (singleton) ─────────────────────────────────────────────

/** Lê a config do módulo Parceiros (cria a linha padrão se não existir). */
export async function obterConfigParceiros() {
  const cfg = await db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
    select: {
      permitirParceiroConvidar: true,
      validadeConvitePadraoDias: true,
      // CRM de Canais e Parcerias (Fase 01) — regras de relacionamento configuráveis.
      diasAlertaSemIndicacao: true,
      diasInatividade: true,
      cadenciaPotencial4Dias: true,
      cadenciaPotencial5Dias: true,
    },
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

const RegrasParceirosSchema = z.object({
  diasAlertaSemIndicacao: z.number().int().positive().nullable(),
  diasInatividade: z.number().int().positive(),
  cadenciaPotencial4Dias: z.number().int().positive().nullable(),
  cadenciaPotencial5Dias: z.number().int().positive().nullable(),
});

/**
 * CRM de Canais e Parcerias (Fase 05) — atualiza as regras de relacionamento configuráveis
 * (alertas, inatividade, cadência de follow-up por potencial). Admin only — mesmo padrão de
 * `togglePermitirParceiroConvidar`. Nunca confundir com regras de comissão (`comissaoPercentual`
 * em `Parceiro`), que são um sistema totalmente separado.
 */
export async function AtualizarRegrasParceiros(input: z.input<typeof RegrasParceirosSchema>) {
  const ctx = await getCtx();
  if (!ctx?.isAdmin) return { success: false as const, error: "Apenas administradores" };

  const parsed = RegrasParceirosSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  await db.parceiroConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
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
      id: true, token: true, status: true, expiraEm: true, createdAt: true, pin: true,
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

const RepresentanteExtraSchema = z.object({
  nome: z.string().min(2, "Informe o nome do representante"),
  cpf: z.string().min(11, "CPF do representante inválido"),
  dataNascimento: z.string().min(1, "Informe a data de nascimento do representante"),
  cargo: z.string().max(80).optional(),
  telefone: z.string().max(30).optional(),
});

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
  whatsapp: z.string().min(8, "Informe o WhatsApp").max(30),
  cep: z.string().min(8, "Informe o CEP").max(9),
  logradouro: z.string().min(1, "Informe o logradouro").max(150),
  numero: z.string().min(1, "Informe o número").max(30),
  complemento: z.string().min(1, "Informe o complemento").max(30),
  bairro: z.string().min(1, "Informe o bairro").max(150),
  cidade: z.string().min(1, "Informe a cidade").max(150),
  areasAtuacao: z.array(z.string().max(60)).max(15).optional(),
  tipoRecebimento: z.enum(["PF", "PJ"], { message: "Selecione como deseja receber as comissões" }),
  souRepresentante: z.boolean().optional(),
  representantesExtra: z.array(RepresentanteExtraSchema).max(10).optional(),
  nomeEmpresa: z.string().max(200).optional(),
  razaoSocial: z.string().max(200).optional(),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z.string().max(20).optional(),
  dadosConsultaCnpj: z.string().optional(),
  sobre: z.string().max(3000).optional(),
  termoAceito: z.boolean().refine((v) => v === true, { message: "É necessário aceitar os termos" }),
}).refine(
  (d) => d.tipoRecebimento !== "PJ" || d.souRepresentante !== false || (d.representantesExtra && d.representantesExtra.length > 0),
  { message: "Adicione ao menos um representante da empresa", path: ["representantesExtra"] },
).refine(
  // Espelha a exigência de aprovarPreCadastro (souRepresentante && pc.cpf && pc.dataNascimento):
  // sem isso o pré-cadastro é salvo mas fica impossível de aprovar depois.
  (d) => d.tipoRecebimento !== "PJ" || d.souRepresentante === false || (!!d.cpf && d.cpf.replace(/\D/g, "").length === 11 && !!d.dataNascimento?.trim()),
  { message: "Informe seu CPF e data de nascimento — obrigatórios para você ser o representante da empresa", path: ["cpf"] },
);

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

  const [preCadastroCriado] = await db.$transaction([
    db.preCadastroParceiro.create({
      select: { id: true, nomeCompleto: true },
      data: {
        conviteId: convite.id,
        email: d.email.trim(),
        nomeCompleto: d.nomeCompleto.trim(),
        cpf: d.cpf?.replace(/\D/g, "") || null,
        dataNascimento: d.dataNascimento?.trim() || null,
        dadosConsultaCpf: d.dadosConsultaCpf || null,
        uf: d.uf.toUpperCase(),
        municipio: d.municipio?.trim() || null,
        // telefone é legado (NOT NULL no banco) — WhatsApp é o único campo coletado
        // na UI a partir desta versão; espelhamos o valor para não quebrar a coluna.
        telefone: d.whatsapp.trim(),
        whatsapp: d.whatsapp.trim(),
        cep: d.cep.replace(/\D/g, ""),
        logradouro: d.logradouro.trim(),
        numero: d.numero.trim(),
        complemento: d.complemento.trim(),
        bairro: d.bairro.trim(),
        cidade: d.cidade.trim(),
        areasAtuacao: d.areasAtuacao && d.areasAtuacao.length > 0 ? d.areasAtuacao.join(",") : null,
        tipoRecebimento: d.tipoRecebimento,
        souRepresentante: d.souRepresentante ?? true,
        representantesExtra: d.representantesExtra && d.representantesExtra.length > 0
          ? JSON.stringify(d.representantesExtra)
          : null,
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

  try {
    await pusherServer.trigger("private-parceiros-precadastros", "novo-pre-cadastro", {
      id: preCadastroCriado.id,
      nomeCompleto: preCadastroCriado.nomeCompleto,
    });
  } catch (pusherErr) {
    console.error("[Pusher] Falha ao disparar evento novo-pre-cadastro:", pusherErr);
  }

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
      tipoRecebimento: true, souRepresentante: true, representantesExtra: true,
      termoVersao: true, termoAceitoEm: true, status: true, createdAt: true, updatedAt: true,
      parceiroId: true, aprovadoPorId: true,
    },
  });

  // aprovadoPorId não tem @relation formal no schema — resolve o nome à parte
  // (evita join implícito e mantém a select acima simples/estável).
  const aprovadorIds = [...new Set(preCadastros.map((p) => p.aprovadoPorId).filter((id): id is number => id != null))];
  const aprovadores = aprovadorIds.length
    ? await db.usuarios.findMany({ where: { id: { in: aprovadorIds } }, select: { id: true, nome: true } })
    : [];
  const nomeAprovadorPorId = new Map(aprovadores.map((u) => [u.id, u.nome]));

  return {
    preCadastros: preCadastros.map((p) => ({
      ...p,
      aprovadoPorNome: p.aprovadoPorId ? (nomeAprovadorPorId.get(p.aprovadoPorId) ?? null) : null,
    })),
  };
}

/** Conta pré-cadastros pendentes (badge na UI). */
export async function contarPreCadastrosPendentes() {
  const ctx = await getCtx();
  if (!ctx?.podeAcessarParceiros) return 0;
  return db.preCadastroParceiro.count({ where: { status: "PENDENTE" } });
}

const RepresentanteEdicaoSchema = z.object({
  nome: z.string().min(2, "Informe o nome do representante"),
  cpf: z.string().min(11, "CPF do representante inválido"),
  dataNascimento: z.string().min(1, "Informe a data de nascimento do representante"),
  cargo: z.string().max(80).optional(),
  telefone: z.string().max(30).optional(),
});

// Edição pela equipe (via ModalEditarPreCadastro) — mais permissiva que
// PreCadastroSchema (formulário público): todo campo é opcional aqui porque a
// edição é parcial (corrige só o que falta), a obrigatoriedade real de cada
// campo é decidida por avaliarPendencias()/aprovarPreCadastro(), não aqui.
const EdicaoPreCadastroSchema = z.object({
  nomeCompleto: z.string().min(2).max(200).optional(),
  cpf: z.string().max(20).optional(),
  dataNascimento: z.string().max(20).optional(),
  whatsapp: z.string().max(30).optional(),
  cep: z.string().max(9).optional(),
  logradouro: z.string().max(150).optional(),
  numero: z.string().max(30).optional(),
  complemento: z.string().max(30).optional(),
  bairro: z.string().max(150).optional(),
  cidade: z.string().max(150).optional(),
  uf: z.string().length(2).optional(),
  tipoRecebimento: z.enum(["PF", "PJ"]).optional(),
  souRepresentante: z.boolean().optional(),
  representantesExtra: z.array(RepresentanteEdicaoSchema).max(10).optional(),
  razaoSocial: z.string().max(200).optional(),
  nomeFantasia: z.string().max(200).optional(),
  cnpj: z.string().max(20).optional(),
});

/**
 * Edita um pré-cadastro PENDENTE (ou REJEITADO) para corrigir dados faltantes
 * antes de aprovar — usado quando aprovarPreCadastro() bloqueou por falta de
 * representante/documento. Não altera status nem cria Parceiro.
 */
export async function atualizarPreCadastro(preCadastroId: number, input: z.infer<typeof EdicaoPreCadastroSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeAprovar)) return { success: false as const, error: "Sem permissão para editar pré-cadastros" };

  const pc = await db.preCadastroParceiro.findUnique({ where: { id: preCadastroId }, select: { id: true, status: true } });
  if (!pc) return { success: false as const, error: "Pré-cadastro não encontrado" };
  if (pc.status === "APROVADO") return { success: false as const, error: "Pré-cadastro já foi aprovado — não é mais editável" };

  const parsed = EdicaoPreCadastroSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const d = parsed.data;

  await db.preCadastroParceiro.update({
    where: { id: preCadastroId },
    data: {
      ...(d.nomeCompleto !== undefined && { nomeCompleto: d.nomeCompleto.trim() }),
      ...(d.cpf !== undefined && { cpf: d.cpf.replace(/\D/g, "") || null }),
      ...(d.dataNascimento !== undefined && { dataNascimento: d.dataNascimento.trim() || null }),
      ...(d.whatsapp !== undefined && { whatsapp: d.whatsapp.trim() || null, telefone: d.whatsapp.trim() }),
      ...(d.cep !== undefined && { cep: d.cep.replace(/\D/g, "") || null }),
      ...(d.logradouro !== undefined && { logradouro: d.logradouro.trim() || null }),
      ...(d.numero !== undefined && { numero: d.numero.trim() || null }),
      ...(d.complemento !== undefined && { complemento: d.complemento.trim() || null }),
      ...(d.bairro !== undefined && { bairro: d.bairro.trim() || null }),
      ...(d.cidade !== undefined && { cidade: d.cidade.trim() || null }),
      ...(d.uf !== undefined && { uf: d.uf.toUpperCase() }),
      ...(d.tipoRecebimento !== undefined && { tipoRecebimento: d.tipoRecebimento }),
      ...(d.souRepresentante !== undefined && { souRepresentante: d.souRepresentante }),
      ...(d.representantesExtra !== undefined && {
        representantesExtra: d.representantesExtra.length > 0 ? JSON.stringify(d.representantesExtra) : null,
      }),
      ...(d.razaoSocial !== undefined && { razaoSocial: d.razaoSocial.trim() || null }),
      ...(d.nomeFantasia !== undefined && { nomeFantasia: d.nomeFantasia.trim() || null }),
      ...(d.cnpj !== undefined && { cnpj: d.cnpj.replace(/\D/g, "") || null }),
    },
  });

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}

/**
 * Aprova um pré-cadastro → cria o Parceiro de verdade via criarParceiro().
 * Usa o tipo explícito escolhido no wizard (tipoRecebimento); pré-cadastros
 * antigos (antes desta feature, tipoRecebimento null) caem no fallback por CNPJ.
 */
export async function aprovarPreCadastro(preCadastroId: number) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeAprovar)) return { success: false as const, error: "Sem permissão para aprovar pré-cadastros" };

  const pc = await db.preCadastroParceiro.findUnique({ where: { id: preCadastroId } });
  if (!pc) return { success: false as const, error: "Pré-cadastro não encontrado" };
  // PENDENTE (fluxo normal) ou REJEITADO (reversão de uma rejeição feita sem
  // querer) podem ser aprovados. Já APROVADO não pode reaprovar (evita duplicar
  // criarParceiro() e criar um segundo Parceiro para o mesmo pré-cadastro).
  if (pc.status === "APROVADO") return { success: false as const, error: "Pré-cadastro já foi aprovado" };

  const cnpj = pc.cnpj?.replace(/\D/g, "") ?? "";
  const cpf = pc.cpf?.replace(/\D/g, "") ?? "";
  const tipo: "PF" | "PJ" = pc.tipoRecebimento === "PF" || pc.tipoRecebimento === "PJ"
    ? pc.tipoRecebimento
    : (cnpj.length === 14 ? "PJ" : "PF");
  const documento = tipo === "PJ" ? cnpj : cpf;

  if (!documento || documento.length < 11) {
    return { success: false as const, error: "Pré-cadastro sem CPF/CNPJ válido — peça o documento antes de aprovar" };
  }

  // PJ exige ao menos um representante físico para criarParceiro aceitar (ver
  // ParceiroSchema/respValidos em actions/parceiros.ts). Monta a partir dos
  // dados que o próprio preenchedor já informou (souRepresentante=true) ou da
  // lista de representantes extras coletada no wizard (souRepresentante=false).
  // WhatsApp obrigatório desde a Fase 3.1b (Cliente Master) — todo representante
  // vira Pessoa, que exige celular como chave única.
  type RepresentanteWizard = { nome: string; cpf: string; dataNascimento: string; cargo?: string; telefone: string; email?: string };
  let responsaveis: RepresentanteWizard[] | undefined;
  if (tipo === "PJ") {
    if (pc.souRepresentante && pc.cpf && pc.dataNascimento && pc.whatsapp) {
      // O preenchedor já informou WhatsApp e e-mail no Step 1 (pc.whatsapp/pc.email)
      // — reaproveita aqui em vez de exigir que ele digite de novo como representante.
      responsaveis = [{ nome: pc.nomeCompleto, cpf: pc.cpf, dataNascimento: pc.dataNascimento, telefone: pc.whatsapp, email: pc.email ?? undefined }];
    } else if (!pc.souRepresentante && pc.representantesExtra) {
      try {
        const extras = JSON.parse(pc.representantesExtra) as (Omit<RepresentanteWizard, "telefone"> & { telefone?: string })[];
        if (Array.isArray(extras) && extras.length > 0) {
          const comTelefone = extras.filter((e): e is RepresentanteWizard => !!e.telefone?.trim());
          if (comTelefone.length < extras.length) {
            return {
              success: false as const,
              error: "Um ou mais representantes estão sem WhatsApp — edite o pré-cadastro e complete o telefone antes de aprovar",
            };
          }
          responsaveis = comTelefone;
        }
      } catch {
        // JSON inválido — cai para o fallback abaixo (erro claro ao invés de crash)
      }
    }
    if (!responsaveis || responsaveis.length === 0) {
      return {
        success: false as const,
        error: pc.souRepresentante && (!pc.whatsapp)
          ? "Pré-cadastro sem WhatsApp do representante — complete o telefone antes de aprovar"
          : "Pré-cadastro PJ sem representante válido — complete os dados do representante antes de aprovar",
      };
    }
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
    // Data de nascimento é do PARCEIRO PESSOA FÍSICA — para PJ, pc.dataNascimento é
    // do preenchedor (pode não ser o representante), não da empresa; não propaga.
    dataNascimento: tipo === "PF" ? (pc.dataNascimento ?? undefined) : undefined,
    sobre: pc.sobre ?? undefined,
    email: pc.email,
    telefone: pc.telefone,
    telefone2: pc.whatsapp ?? undefined,
    nivel: "GOLD",
    endereco: enderecoCompleto,
    responsaveis,
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
