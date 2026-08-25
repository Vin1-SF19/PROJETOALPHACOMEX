"use server"
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { z } from "zod";
import crypto from "crypto";
import {
  cadastrarClienteSchema,
  socioSchema,
  logRegistroSchema,
  alteracoesClienteSchema,
  alteracoesServicoSchema,
} from "@/lib/validations/cs-nps";

async function getColaboradorNome(): Promise<string> {
  const session = await auth();
  const u = session?.user as { nome?: string; usuario?: string } | undefined;
  return u?.nome || u?.usuario || "Sistema";
}

/**
 * Resolve o usuário da sessão atual para o sistema de histórico
 * (`HistoricoAlteracaoCliente`/`ClienteServicoHistorico`), que precisa de um
 * `userId` real (FK para `usuarios`) além do nome. `session.user.id` é `string` na
 * sessão (Next-Auth v5 / JWT) — convertido para `Number` para bater com
 * `usuarios.id Int`. Se a sessão estiver ausente ou o id não for um número
 * válido, retorna `userId: null` (o model aceita, com `onDelete: SetNull`).
 */
async function getUsuarioSessao(): Promise<{ userId: number | null; nome: string }> {
  const session = await auth();
  const u = session?.user as { id?: string; nome?: string; usuario?: string } | undefined;
  const nome = u?.nome || u?.usuario || "Sistema";
  const idNumerico = u?.id !== undefined ? Number(u.id) : NaN;
  const userId = Number.isFinite(idNumerico) ? idNumerico : null;
  return { userId, nome };
}

/**
 * Compara `estadoAnterior` com `dadosNovos` campo a campo e retorna só os que
 * realmente mudaram — comparação normalizada (`String(a ?? "").trim() ===
 * String(b ?? "").trim()`) para não poluir o histórico com falsos positivos
 * de tipo (`null` vs `""` vs `undefined`).
 */
function camposAlterados(params: {
  estadoAnterior: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  campos: string[];
}) {
  const { estadoAnterior, dadosNovos, campos } = params;

  return campos
    .filter((campo) => {
      const anterior = String(estadoAnterior[campo] ?? "").trim();
      const novo = String(dadosNovos[campo] ?? "").trim();
      return anterior !== novo;
    })
    .map((campo) => ({
      campo,
      valorAnterior: estadoAnterior[campo] === null || estadoAnterior[campo] === undefined
        ? null
        : String(estadoAnterior[campo]),
      valorNovo: dadosNovos[campo] === null || dadosNovos[campo] === undefined
        ? null
        : String(dadosNovos[campo]),
    }));
}

/** Monta linhas de `HistoricoAlteracaoCliente` (cadastral) prontas para `createMany`. */
function montarLinhasHistoricoCliente(params: {
  clienteId: number;
  loteId: string;
  estadoAnterior: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  userId: number | null;
  nomeUsuarioNaEpoca: string;
  campos: string[];
}) {
  const { clienteId, loteId, userId, nomeUsuarioNaEpoca } = params;
  return camposAlterados(params).map((alteracao) => ({
    ...alteracao,
    clienteId,
    loteId,
    userId,
    nomeUsuarioNaEpoca,
    acao: "EDICAO" as const,
  }));
}

/** Monta linhas de `ClienteServicoHistorico` (negócio) prontas para `createMany`. */
function montarLinhasHistoricoServico(params: {
  clienteServicoId: number;
  loteId: string;
  estadoAnterior: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  userId: number | null;
  nomeUsuarioNaEpoca: string;
  campos: string[];
}) {
  const { clienteServicoId, loteId, userId, nomeUsuarioNaEpoca } = params;
  return camposAlterados(params).map((alteracao) => ({
    ...alteracao,
    clienteServicoId,
    loteId,
    userId,
    nomeUsuarioNaEpoca,
    acao: "EDICAO" as const,
  }));
}

/** Campos de `Cliente` (cadastral) rastreados pelo histórico de alterações. */
const CAMPOS_HISTORICO_CLIENTE = [
  "razaoSocial",
  "nomeFantasia",
  "dataConstituicao",
  "regimeTributario",
  "uf",
  "municipio",
] as const;

/** Campos de `ClienteServico` (negócio) rastreados pelo histórico de alterações. */
const CAMPOS_HISTORICO_SERVICO = [
  "analistaResponsavel",
  "dataContratacao",
  "status",
  "nps",
  "feedbackGoogle",
  "nomeGoogle",
  "embasamento",
  "origemLead",
  "dataExito",
  "formaPagamento",
  "valorContrato",
  "closerNome",
] as const;

/**
 * Lista usuários ATIVOS filtrados por role — usada pelos dropdowns de
 * Analista Responsável (role 'OPERACIONAL') e Closer (role 'COMERCIAL'/'Lider
 * Comercial') no CS&NPS. Retorna só `id`/`nome`, nunca email/senha/imagemUrl.
 */
export async function buscarUsuariosPorRole(roles: string[]): Promise<{ id: number; nome: string }[]> {
  try {
    const usuarios = await db.usuarios.findMany({
      where: { role: { in: roles }, status: "ATIVO" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    return usuarios;
  } catch (error) {
    console.error("ERRO buscarUsuariosPorRole:", error);
    return [];
  }
}

/**
 * Verifica se o CNPJ já existe na base (qualquer serviço) — usada como aviso
 * informativo na consulta de CNPJ, ANTES do usuário escolher o serviço. Não
 * bloqueia o cadastro: o mesmo Cliente pode ter múltiplos ClienteServico. O
 * bloqueio real de duplicidade exata (mesmo Cliente + mesmo serviço) acontece
 * em `CadastrarCliente`, via constraint composta `@@unique([clienteId, servico])`.
 */
export async function verificarCNPJDuplicado(cnpj: string): Promise<{ existe: boolean; razaoSocial?: string }> {
  const cnpjNormalizado = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  try {
    const cliente = await db.cliente.findUnique({
      where: { cnpj: cnpjNormalizado },
      select: { razaoSocial: true },
    });
    return { existe: !!cliente, razaoSocial: cliente?.razaoSocial };
  } catch {
    return { existe: false };
  }
}

/**
 * Resolve o `Cliente` master a partir do CNPJ — busca OU CRIA (mesmo padrão de
 * `resolverClienteDoContrato` em `ContratoComercial.ts`: o BPM ainda não é a
 * porta de entrada real de Cliente novo, bloquear quebraria o cadastro manual
 * do time de CS&NPS).
 */
async function resolverClienteCsNps(dados: {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  dataConstituicao?: string;
  uf?: string;
  municipio?: string;
  regimeTributario?: string;
}): Promise<{ success: true; clienteId: number } | { success: false; error: string }> {
  const cnpjNormalizado = dados.cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const existente = await db.cliente.findUnique({ where: { cnpj: cnpjNormalizado }, select: { id: true } });
  if (existente) return { success: true, clienteId: existente.id };

  try {
    const novo = await db.cliente.create({
      data: {
        cnpj: cnpjNormalizado,
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia || null,
        dataConstituicao: dados.dataConstituicao || null,
        uf: dados.uf || null,
        municipio: dados.municipio || null,
        regimeTributario: dados.regimeTributario || null,
      },
      select: { id: true },
    });
    return { success: true, clienteId: novo.id };
  } catch (err) {
    const fallback = await db.cliente.findUnique({ where: { cnpj: cnpjNormalizado }, select: { id: true } });
    if (fallback) return { success: true, clienteId: fallback.id };
    console.error("resolverClienteCsNps:", err);
    return { success: false, error: "Erro ao identificar a empresa" };
  }
}

export async function CadastrarCliente(dados: unknown, socios: unknown[]) {
  try {
    const parsed = cadastrarClienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    const sociosValidados = z.array(socioSchema).safeParse(socios.filter((s) => (s as { nome?: string })?.nome?.trim()));
    if (!sociosValidados.success) {
      return { success: false, error: sociosValidados.error.issues[0]?.message ?? "Sócio inválido" };
    }

    const d = parsed.data;
    const clienteResolvido = await resolverClienteCsNps(d);
    if (!clienteResolvido.success) return clienteResolvido;

    // Resolve/cria Pessoa por celular (reaproveita se já existe — mesmo padrão de
    // sincronizarRepresentantesParceiro em parceiros.ts) + PessoaClienteVinculo.
    const clienteServico = await db.$transaction(async (tx) => {
      const servico = await tx.clienteServico.create({
        data: {
          clienteId: clienteResolvido.clienteId,
          servico: d.servico,
          analistaResponsavel: d.analistaResponsavel || "",
          embasamento: d.embasamento || null,
          origemLead: d.origemLead || null,
          dataContratacao: d.dataContratacao || null,
          dataExito: null,
          formaPagamento: d.formaPagamento || null,
          valorContrato: d.valorContrato ?? null,
          closerNome: d.closerNome || null,
        },
      });

      for (const socio of sociosValidados.data) {
        // Sócio sem telefone não vira Pessoa/vínculo agora — `Pessoa.celular` é
        // `@unique`, então múltiplos sócios sem telefone colidiriam entre si.
        // Fica como pendência: complete o telefone depois na edição do cliente.
        if (!socio.telefone) continue;

        const pessoa = await tx.pessoa.upsert({
          where: { celular: socio.telefone },
          update: { nome: socio.nome },
          create: {
            celular: socio.telefone,
            nome: socio.nome,
            dataNascimento: socio.dataNascimento || null,
          },
        });
        await tx.pessoaClienteVinculo.upsert({
          where: { pessoaId_clienteId: { pessoaId: pessoa.id, clienteId: clienteResolvido.clienteId } },
          update: { vinculo: socio.vinculo },
          create: {
            pessoaId: pessoa.id,
            clienteId: clienteResolvido.clienteId,
            vinculo: socio.vinculo,
          },
        });
      }

      return servico;
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    const sociosSemTelefone = sociosValidados.data.filter((s) => !s.telefone).map((s) => s.nome);
    return {
      success: true,
      clienteServicoId: clienteServico.id,
      sociosSemTelefone: sociosSemTelefone.length ? sociosSemTelefone : undefined,
    };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.error("ERRO CADASTRO:", err.message);
    if (err.code === "P2002") return { success: false, error: "Este CNPJ já possui esse serviço contratado!" };
    return { success: false, error: "Erro na base de dados. Verifique os campos." };
  }
}


/**
 * Cria o `ClienteServico` correspondente quando um contrato é fechado no
 * Painel de Metas — decisão tomada em 2026-07-13 (ver decisions.md) para
 * eliminar a lacuna onde um serviço novo cadastrado só no Metas nunca aparecia
 * no CS&NPS. Fase 3.6 do Cliente Master (2026-08-14): `Cliente` já vem
 * resolvido pelo chamador (`clienteId`, do `ContratoComercial.clienteId`) —
 * esta função só cuida do `ClienteServico` (o serviço em si), nunca criou
 * `Cliente`, isso não muda.
 *
 * Checa primeiro (via `findUnique`, não reagindo a erro de constraint) se já
 * existe um `ClienteServico` com esse clienteId+serviço:
 * - Não existe → cria (`criado: true`).
 * - Existe e está "Arquivado" → REATIVA (volta pra "Em Andamento"), porque um
 *   registro arquivado é invisível na listagem do CS&NPS (`buscarClientes`
 *   filtra `status != Arquivado`) — sem reativar, o closer fecha o contrato no
 *   Metas e o cliente continua "sumido" pro time de CS (`reativado: true`).
 * - Existe e não está arquivado → idempotente, não mexe em nada (não
 *   sobrescreve dados que o time de CS já preencheu manualmente).
 *
 * Qualquer erro inesperado é logado, mas NUNCA deve derrubar a criação do
 * contrato no Metas — quem chama esta função está fechando uma venda, não
 * deveria ver nenhum erro relacionado ao CS&NPS.
 *
 * Campos exclusivos do CS&NPS sem equivalente no Metas (analistaResponsavel,
 * embasamento, origemLead) ficam com o mesmo default do cadastro manual —
 * o time de CS completa depois, mesmo fluxo de sempre para clientes novos.
 */
interface DadosContratoParaSincronizacao {
  clienteId: number;
  servico: string;
  dataContratacao?: string | null;
}

export async function criarRegistroClienteAPartirDeContrato(
  dados: DadosContratoParaSincronizacao
): Promise<{ success: true; criado: boolean; reativado?: boolean; clienteServicoId: number }> {
  try {
    const existente = await db.clienteServico.findUnique({
      where: { clienteId_servico: { clienteId: dados.clienteId, servico: dados.servico } },
      select: { id: true, status: true, dataContratacao: true },
    });

    if (existente) {
      if (existente.status === "Arquivado") {
        await db.clienteServico.update({
          where: { id: existente.id },
          data: {
            status: "Em Andamento",
            dataContratacao: dados.dataContratacao || existente.dataContratacao,
          },
        });
        revalidatePath("/PainelAlpha/CadastroClientes");
        return { success: true, criado: false, reativado: true, clienteServicoId: existente.id };
      }
      // Já existe e está ativo — idempotente, não sobrescreve nada.
      return { success: true, criado: false, clienteServicoId: existente.id };
    }

    const novoServico = await db.clienteServico.create({
      data: {
        clienteId: dados.clienteId,
        servico: dados.servico,
        analistaResponsavel: "",
        embasamento: null,
        origemLead: null,
        dataContratacao: dados.dataContratacao || null,
        dataExito: null,
      },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, criado: true, clienteServicoId: novoServico.id };
  } catch (error) {
    // Qualquer erro (incluindo P2002 em corrida rara entre o findUnique e o create)
    // é logado, mas NUNCA deve derrubar a criação do contrato no Metas.
    console.error("ERRO criarRegistroClienteAPartirDeContrato:", error);
    // Sem clienteServicoId confiável nesse caminho de erro — resolve de novo por
    // clienteId+serviço como melhor esforço (pode retornar 0 se nem isso funcionar).
    const fallback = await db.clienteServico.findUnique({
      where: { clienteId_servico: { clienteId: dados.clienteId, servico: dados.servico } },
      select: { id: true },
    }).catch(() => null);
    return { success: true, criado: false, clienteServicoId: fallback?.id ?? 0 };
  }
}

const SELECT_CLIENTE_CS_NPS = {
  cnpj: true,
  razaoSocial: true,
  nomeFantasia: true,
  dataConstituicao: true,
  uf: true,
  municipio: true,
  regimeTributario: true,
  historicoAlteracoes: { orderBy: { criadoEm: "desc" as const } },
  pessoas: {
    where: { ativo: true },
    include: { pessoa: true },
  },
  indicacao: {
    where: { status: "ATIVA" as const },
    include: { parceiro: { select: { id: true, nome: true, nivel: true } } },
  },
} as const;

/**
 * Lista os serviços (CS&NPS) não arquivados, achatando `ClienteServico` +
 * `Cliente` no shape que a UI já esperava (padrão "achatar" já usado em
 * Extratos/BPM/Operacional/ContratoComercial). `socios` (agora `Pessoa` via
 * `PessoaClienteVinculo`) e `log_cs`/`logFeedback` (agora `ClienteServicoLogCs`/
 * `ClienteServicoLogFeedback`) são achatados no mesmo shape de campo solto que
 * a UI antiga usava.
 */
export async function buscarClientes() {
  try {
    const registros = await db.clienteServico.findMany({
      where: { status: { not: "Arquivado" } },
      include: {
        cliente: { select: SELECT_CLIENTE_CS_NPS },
        logCs: { orderBy: { dataRegistro: "desc" } },
        logFeedback: { orderBy: { dataRegistro: "desc" } },
        historicoAlteracoes: { orderBy: { criadoEm: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return registros.map((r) => {
      const { cliente, ...resto } = r;
      const { historicoAlteracoes: historicoCliente, pessoas, indicacao, ...clienteDados } = cliente;
      return {
        ...resto,
        ...clienteDados,
        socios: pessoas.map((v) => ({
          id: v.pessoa.id,
          nome: v.pessoa.nome,
          telefone: v.pessoa.celular,
          obs: v.pessoa.observacao,
          dataNascimento: v.pessoa.dataNascimento,
          vinculo: v.vinculo,
          clienteId: v.clienteId,
        })),
        // Histórico exibido é o do SERVIÇO (negócio) + o do CLIENTE (cadastral), mesclados
        // e ordenados por data — reflete a decisão do usuário 2026-08-14 (2 históricos
        // separados por natureza, mas exibidos juntos na timeline por conveniência).
        historicoAlteracoes: [...resto.historicoAlteracoes, ...historicoCliente]
          .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()),
        indicacao,
      };
    });
  } catch (error) {
    console.error("ERRO DO PRISMA buscarClientes:", error);
    throw error;
  }
}

/** Tipo de 1 registro retornado por `buscarClientes` — usado pela UI para agrupar/mesclar por CNPJ. */
export type ClienteCS = Awaited<ReturnType<typeof buscarClientes>>[number];

function normalizarNomeServico(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Busca todos os Contratos Comerciais (módulo Metas/Comercial) daquele CNPJ,
 * mais recente primeiro. Um mesmo CNPJ pode ter vários contratos (serviços
 * diferentes vendidos em momentos diferentes) — no Comercial eles continuam
 * como linhas separadas; aqui mesclamos só para exibição no card do CS&NPS.
 * Casamento por CNPJ normalizado (`Cliente.cnpj`, já sem máscara).
 */
export async function buscarServicosContratados(cnpj: string) {
  const cnpjNormalizado = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!cnpjNormalizado) return [];

  try {
    const contratos = await db.contratoComercial.findMany({
      where: { arquivado: false, cliente: { cnpj: cnpjNormalizado } },
      select: {
        id: true,
        servico: true,
        valorContrato: true,
        formaPagamento: true,
        closerNome: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return contratos;
  } catch (error) {
    console.error("ERRO buscarServicosContratados:", error);
    return [];
  }
}

/**
 * Igual a `buscarServicosContratados`, mas casa também pelo nome do serviço —
 * usada quando o CS&NPS tem múltiplos `ClienteServico` para o mesmo `Cliente`
 * (um por serviço contratado) e precisa ligar CADA registro ao seu contrato
 * correspondente no Painel de Metas, não a todos os contratos do CNPJ de uma
 * vez. Normaliza acentuação/caixa dos dois lados antes de comparar (ambos os
 * campos são texto livre hoje, sem enum compartilhado).
 */
export async function buscarServicoContratadoPorCliente(cnpj: string, servico: string | null) {
  if (!servico) return null;
  const candidatos = await buscarServicosContratados(cnpj);
  const alvo = normalizarNomeServico(servico);

  return (
    candidatos.find((c) => normalizarNomeServico(c.servico) === alvo) ??
    candidatos.find((c) => alvo.includes(normalizarNomeServico(c.servico))) ??
    null
  );
}

function normalizarDataRegistro(valor: string): Date {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00`)
    : new Date(valor);

  if (Number.isNaN(data.getTime())) {
    throw new Error("Data de registro inválida");
  }

  return data;
}

function mensagemDoErro(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado";
}

export async function salvarLogCS(clienteServicoId: number, dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = logRegistroSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const colaborador = await getColaboradorNome();
    const novoLog = await db.clienteServicoLogCs.create({
      data: {
        colaborador,
        sentimento: parsed.data.sentimento,
        observacao: parsed.data.observacao,
        clienteServicoId,
        dataRegistro: normalizarDataRegistro(parsed.data.data_registro),
      },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: novoLog };
  } catch (error: unknown) {
    const mensagem = mensagemDoErro(error);
    console.error("ERRO AO SALVAR CS:", mensagem);
    return { success: false, error: mensagem };
  }
}

export async function atualizarDadosGestao(clienteServicoId: number, dados: { nps?: string | number; feedbackGoogle?: boolean; nomeGoogle?: string; status?: string }) {
  try {
    await db.clienteServico.update({
      where: { id: clienteServicoId },
      data: {
        nps: dados.nps !== undefined ? Number(dados.nps) : undefined,
        feedbackGoogle: dados.feedbackGoogle,
        nomeGoogle: dados.nomeGoogle,
        status: dados.status,
      }
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO atualizarDadosGestao:", error);
    return { success: false };
  }
}

export async function salvarLogFeedback(clienteServicoId: number, dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = logRegistroSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const colaborador = await getColaboradorNome();
    const novoLog = await db.clienteServicoLogFeedback.create({
      data: {
        colaborador,
        sentimento: parsed.data.sentimento || "N/A",
        observacao: parsed.data.observacao,
        clienteServicoId: Number(clienteServicoId),
        dataRegistro: normalizarDataRegistro(parsed.data.data_registro),
      },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: novoLog };
  } catch (error: unknown) {
    const mensagem = mensagemDoErro(error);
    console.error("ERRO AO SALVAR FEEDBACK:", mensagem);
    return { success: false, error: mensagem };
  }
}

/**
 * Salva os campos CADASTRAIS de `Cliente` (razão social, nome fantasia, UF,
 * município, regime tributário, data de constituição) — CNPJ deliberadamente
 * de fora: somente-leitura fora do BPM (Fase 3.6 do Cliente Master, decisão do
 * usuário 2026-08-14, mesmo princípio já aplicado em Extratos/Operacional/
 * ContratoComercial).
 */
export async function salvarAlteracoesCliente(clienteId: number, dadosNovos: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = alteracoesClienteSchema.safeParse(dadosNovos);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const { userId, nome } = await getUsuarioSessao();
    const estadoAnterior = await db.cliente.findUnique({ where: { id: clienteId } });
    if (!estadoAnterior) return { success: false, error: "Cliente não encontrado" };

    await db.cliente.update({ where: { id: clienteId }, data: parsed.data });

    const loteId = crypto.randomUUID();
    const linhasHistorico = montarLinhasHistoricoCliente({
      clienteId,
      loteId,
      estadoAnterior,
      dadosNovos: parsed.data,
      userId,
      nomeUsuarioNaEpoca: nome,
      campos: [...CAMPOS_HISTORICO_CLIENTE],
    });

    if (linhasHistorico.length > 0) {
      await db.historicoAlteracaoCliente.createMany({ data: linhasHistorico });
    }

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO salvarAlteracoesCliente:", error);
    return { success: false, error: mensagemDoErro(error) };
  }
}

/**
 * Salva os campos de NEGÓCIO de `ClienteServico` (status, analista, datas,
 * pagamento, NPS, feedback Google, etc). Fase 3.6 do Cliente Master — sucessora
 * de `salvarAlteracoesGeral`, agora separada de `salvarAlteracoesCliente`
 * porque os dois passaram a ser entidades (e históricos) diferentes.
 */
export async function salvarAlteracoesServico(clienteServicoId: number, dadosNovos: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = alteracoesServicoSchema.safeParse(dadosNovos);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

    const { userId, nome } = await getUsuarioSessao();
    const estadoAnterior = await db.clienteServico.findUnique({ where: { id: clienteServicoId } });
    if (!estadoAnterior) return { success: false, error: "Serviço não encontrado" };

    const dadosParaAtualizar = {
      ...parsed.data,
      dataExito: parsed.data.dataExito ?? (parsed.data.status === "Deferido" ? new Date().toISOString() : null),
    };

    await db.clienteServico.update({ where: { id: clienteServicoId }, data: dadosParaAtualizar });

    const loteId = crypto.randomUUID();
    const linhasHistorico = montarLinhasHistoricoServico({
      clienteServicoId,
      loteId,
      estadoAnterior,
      dadosNovos: dadosParaAtualizar,
      userId,
      nomeUsuarioNaEpoca: nome,
      campos: [...CAMPOS_HISTORICO_SERVICO],
    });

    if (linhasHistorico.length > 0) {
      await db.clienteServicoHistorico.createMany({ data: linhasHistorico });
    }

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO salvarAlteracoesServico:", error);
    return { success: false, error: mensagemDoErro(error) };
  }
}

const reverterCampoHistoricoSchema = z.object({
  historicoId: z.string().cuid(),
  tipo: z.enum(["cliente", "servico"]),
});

/**
 * Campos que são numéricos ou booleanos no schema — usados para fazer o parse
 * reverso correto do `valorAnterior` (que é sempre `String?` no histórico) de
 * volta ao tipo esperado pelo Prisma. Os demais campos rastreados (incluindo os
 * de data) permanecem `String`.
 */
const CAMPOS_NUMERICOS = new Set(["nps", "valorContrato"]);
const CAMPOS_BOOLEANOS = new Set(["feedbackGoogle"]);

function converterValorParaCampo(campo: string, valor: string | null): unknown {
  if (CAMPOS_NUMERICOS.has(campo)) {
    if (valor === null || valor === "") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  if (CAMPOS_BOOLEANOS.has(campo)) {
    return valor === "true";
  }
  return valor;
}

/**
 * Reverte 1 campo específico (de `Cliente` ou `ClienteServico`, conforme
 * `tipo`) para o valor que ele tinha antes de uma alteração registrada no
 * histórico correspondente. Após aplicar o `update`, cria uma NOVA linha de
 * histórico (não reaproveita o `loteId` da edição original) registrando a
 * própria reversão: `valorAnterior` é o valor que estava ANTES de reverter (o
 * `valorNovo` da linha original), `valorNovo` é o valor restaurado,
 * `acao: "REVERSAO"`, autoria de quem está revertendo AGORA (não de quem
 * editou originalmente) — preserva a cadeia de auditoria em vez de apagar o
 * rastro da edição revertida.
 */
export async function reverterCampoHistorico(historicoId: string, tipo: "cliente" | "servico") {
  try {
    const { historicoId: idValidado, tipo: tipoValidado } = reverterCampoHistoricoSchema.parse({ historicoId, tipo });
    const { userId, nome } = await getUsuarioSessao();

    if (tipoValidado === "cliente") {
      const linhaOriginal = await db.historicoAlteracaoCliente.findUnique({ where: { id: idValidado } });
      if (!linhaOriginal) return { success: false, error: "Registro de histórico não encontrado" };

      const { campo, valorAnterior, clienteId } = linhaOriginal;
      const valorRestaurado = converterValorParaCampo(campo, valorAnterior);

      await db.cliente.update({ where: { id: clienteId }, data: { [campo]: valorRestaurado } });
      await db.historicoAlteracaoCliente.create({
        data: {
          loteId: crypto.randomUUID(),
          clienteId,
          campo,
          valorAnterior: linhaOriginal.valorNovo,
          valorNovo: valorAnterior,
          userId,
          nomeUsuarioNaEpoca: nome,
          acao: "REVERSAO",
        },
      });
    } else {
      const linhaOriginal = await db.clienteServicoHistorico.findUnique({ where: { id: idValidado } });
      if (!linhaOriginal) return { success: false, error: "Registro de histórico não encontrado" };

      const { campo, valorAnterior, clienteServicoId } = linhaOriginal;
      const valorRestaurado = converterValorParaCampo(campo, valorAnterior);

      await db.clienteServico.update({ where: { id: clienteServicoId }, data: { [campo]: valorRestaurado } });
      await db.clienteServicoHistorico.create({
        data: {
          loteId: crypto.randomUUID(),
          clienteServicoId,
          campo,
          valorAnterior: linhaOriginal.valorNovo,
          valorNovo: valorAnterior,
          userId,
          nomeUsuarioNaEpoca: nome,
          acao: "REVERSAO",
        },
      });
    }

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "ID de histórico inválido" };
    }
    console.error("ERRO reverterCampoHistorico:", error);
    return { success: false, error: mensagemDoErro(error) };
  }
}

/**
 * Adiciona um sócio ao `Cliente` — resolve/cria `Pessoa` por celular
 * (reaproveita se já existe, mesmo padrão de `sincronizarRepresentantesParceiro`
 * em `parceiros.ts`) + `PessoaClienteVinculo`. Fase 3.6 do Cliente Master:
 * `socios` (por-serviço, legado) virou `Pessoa`+`PessoaClienteVinculo`
 * (global, por-empresa) — celular obrigatório a partir de agora.
 */
export async function adicionarSocio(clienteId: number, dadosSocio: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = socioSchema.safeParse(dadosSocio);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    const d = parsed.data;
    if (!d.telefone) return { success: false, error: "Telefone é obrigatório para vincular o sócio" };
    const telefone = d.telefone;

    const vinculo = await db.$transaction(async (tx) => {
      const pessoa = await tx.pessoa.upsert({
        where: { celular: telefone },
        update: { nome: d.nome },
        create: { celular: telefone, nome: d.nome, dataNascimento: d.dataNascimento || null },
      });
      return tx.pessoaClienteVinculo.upsert({
        where: { pessoaId_clienteId: { pessoaId: pessoa.id, clienteId } },
        update: { vinculo: d.vinculo },
        create: { pessoaId: pessoa.id, clienteId, vinculo: d.vinculo },
        include: { pessoa: true },
      });
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return {
      success: true,
      data: {
        id: vinculo.pessoa.id,
        nome: vinculo.pessoa.nome,
        telefone: vinculo.pessoa.celular,
        obs: vinculo.pessoa.observacao,
        dataNascimento: vinculo.pessoa.dataNascimento,
        vinculo: vinculo.vinculo,
        clienteId: vinculo.clienteId,
      },
    };
  } catch (error) {
    console.error("ERRO adicionarSocio:", error);
    return { success: false, error: mensagemDoErro(error) };
  }
}

/**
 * Desvincula a `Pessoa` do `Cliente` — remove só o `PessoaClienteVinculo`
 * (nunca deleta `Pessoa`, que é global e pode estar vinculada a outras
 * empresas ou a um Parceiro).
 */
export async function excluirSocio(pessoaId: number, clienteId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const idValidado = z.number().int().positive().safeParse(pessoaId);
    if (!idValidado.success) {
      return { success: false, error: "ID de sócio inválido" };
    }

    await db.pessoaClienteVinculo.delete({
      where: { pessoaId_clienteId: { pessoaId: idValidado.data, clienteId } },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: unknown) {
    console.error("ERRO AO EXCLUIR SÓCIO:", mensagemDoErro(error));
    return { success: false, error: "Não foi possível excluir o sócio." };
  }
}

export async function excluirLogCS(logId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await db.clienteServicoLogCs.delete({ where: { id: logId } });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO AO EXCLUIR LOG CS:", error);
    return { success: false, error: "Não foi possível excluir o registro." };
  }
}

export async function excluirLogFeedback(logId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await db.clienteServicoLogFeedback.delete({ where: { id: logId } });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO AO EXCLUIR FEEDBACK:", error);
    return { success: false };
  }
}

export async function atualizarSocio(pessoaId: number, clienteId: number, dados: { nome: string; telefone: string; dataNascimento?: string; vinculo?: string; obs?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await db.$transaction(async (tx) => {
      await tx.pessoa.update({
        where: { id: pessoaId },
        data: {
          nome: dados.nome,
          celular: dados.telefone,
          dataNascimento: dados.dataNascimento,
          observacao: dados.obs,
        },
      });
      if (dados.vinculo !== undefined) {
        await tx.pessoaClienteVinculo.update({
          where: { pessoaId_clienteId: { pessoaId, clienteId } },
          data: { vinculo: dados.vinculo },
        });
      }
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    return { success: false, error: mensagemDoErro(error) };
  }
}

export async function atualizarLogCS(logId: string, dados: { sentimento: string; observacao: string; dataRegistro?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const logAtualizado = await db.clienteServicoLogCs.update({
      where: { id: logId },
      data: {
        sentimento: dados.sentimento,
        observacao: dados.observacao,
        ...(dados.dataRegistro ? { dataRegistro: normalizarDataRegistro(dados.dataRegistro) } : {}),
      },
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: logAtualizado };
  } catch (error: unknown) {
    return { success: false, error: mensagemDoErro(error) };
  }
}

export async function atualizarLogFeedback(
  logId: string,
  dados: { sentimento: string; observacao: string; dataRegistro?: string },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const logAtualizado = await db.clienteServicoLogFeedback.update({
      where: { id: logId },
      data: {
        sentimento: dados.sentimento,
        observacao: dados.observacao,
        ...(dados.dataRegistro ? { dataRegistro: normalizarDataRegistro(dados.dataRegistro) } : {}),
      },
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: logAtualizado };
  } catch (error: unknown) {
    return { success: false, error: mensagemDoErro(error) };
  }
}

export async function atualizarStatusCliente(clienteServicoId: number, novoStatus: string) {
  try {
    await db.clienteServico.update({
      where: { id: clienteServicoId },
      data: { status: novoStatus },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    console.error("ERRO AO OCULTAR:", error);
    return { success: false };
  }
}
