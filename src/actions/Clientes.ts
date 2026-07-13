"use server"
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { z } from "zod";
import crypto from "crypto";

async function getColaboradorNome(): Promise<string> {
  const session = await auth();
  const u = session?.user as { nome?: string; usuario?: string } | undefined;
  return u?.nome || u?.usuario || "Sistema";
}

/**
 * Resolve o usuário da sessão atual para o novo sistema de histórico
 * (`HistoricoAlteracaoCliente`), que precisa de um `userId` real (FK para
 * `usuarios`) além do nome. `session.user.id` é `string` na sessão
 * (Next-Auth v5 / JWT) — convertido para `Number` para bater com
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
 * Monta as linhas de `HistoricoAlteracaoCliente` prontas para `createMany`,
 * comparando `estadoAnterior` com `dadosNovos` campo a campo. Só gera 1 linha
 * para campos que realmente mudaram — comparação normalizada
 * (`String(a ?? "").trim() === String(b ?? "").trim()`) para não poluir o
 * histórico com falsos positivos de tipo (`null` vs `""` vs `undefined`),
 * mesmo padrão já usado em `modalLogAuditoria.tsx`.
 */
function montarLinhasHistorico(params: {
  clienteId: number;
  loteId: string;
  estadoAnterior: Record<string, unknown>;
  dadosNovos: Record<string, unknown>;
  userId: number | null;
  nomeUsuarioNaEpoca: string;
  campos: string[];
}) {
  const { clienteId, loteId, estadoAnterior, dadosNovos, userId, nomeUsuarioNaEpoca, campos } = params;

  return campos
    .filter((campo) => {
      const anterior = String(estadoAnterior[campo] ?? "").trim();
      const novo = String(dadosNovos[campo] ?? "").trim();
      return anterior !== novo;
    })
    .map((campo) => ({
      loteId,
      clienteId,
      campo,
      valorAnterior: estadoAnterior[campo] === null || estadoAnterior[campo] === undefined
        ? null
        : String(estadoAnterior[campo]),
      valorNovo: dadosNovos[campo] === null || dadosNovos[campo] === undefined
        ? null
        : String(dadosNovos[campo]),
      userId,
      nomeUsuarioNaEpoca,
      acao: "EDICAO" as const,
    }));
}

/** Campos do cliente rastreados pelo histórico de alterações do CS&NPS. */
const CAMPOS_HISTORICO_CLIENTE = [
  "analistaResponsavel",
  "dataContratacao",
  "status",
  "nps",
  "feedbackGoogle",
  "nomeGoogle",
  "cnpj",
  "razaoSocial",
  "nomeFantasia",
  "dataConstituicao",
  "regimeTributario",
  "uf",
  "municipio",
  "servicos",
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
  } catch (error: any) {
    console.error("ERRO buscarUsuariosPorRole:", error?.message ?? error);
    return [];
  }
}

/**
 * Verifica se o CNPJ já existe na base (qualquer serviço) — usada como aviso
 * informativo na consulta de CNPJ (Receita Federal), ANTES do usuário escolher
 * o serviço. Não bloqueia o cadastro: o mesmo CNPJ pode ter múltiplos serviços
 * contratados em registros separados. O bloqueio real de duplicidade exata
 * (mesmo CNPJ + mesmo serviço) acontece em `CadastrarCliente`, via constraint
 * composta `@@unique([cnpj, servicos])` do banco.
 */
export async function verificarCNPJDuplicado(cnpj: string): Promise<{ existe: boolean; razaoSocial?: string }> {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  try {
    const cliente = await db.clientes.findFirst({
      where: { cnpj: cnpjLimpo },
      select: { razaoSocial: true },
    });
    return { existe: !!cliente, razaoSocial: cliente?.razaoSocial };
  } catch {
    return { existe: false };
  }
}

export async function CadastrarCliente(dados: any, socios: any[]) {
  try {
    const res = await db.clientes.create({
      data: {
        cnpj: dados.cnpj.replace(/\D/g, ""),
        razaoSocial: dados.razaoSocial || "",
        nomeFantasia: dados.nomeFantasia || "",
        dataConstituicao: dados.dataConstituicao || "",
        uf: dados.uf || "",
        municipio: dados.municipio || null,
        regimeTributario: dados.regimeTributario || "",
        servicos: Array.isArray(dados.servicos) ? dados.servicos.join(", ") : dados.servicos,
        analistaResponsavel: dados.analistaResponsavel || "",
        embasamento: dados.embasamento || null,
        origemLead: dados.origemLead || null,
        dataContratacao: dados.dataContratacao ? new Date(dados.dataContratacao).toISOString() : null,
        dataExito: null,
        formaPagamento: dados.formaPagamento || null,
        valorContrato: dados.valorContrato ? Number(dados.valorContrato) : null,
        closerNome: dados.closerNome || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        socios: {
          create: socios.map(s => ({
            nome: s.nome,
            telefone: s.telefone || "",
            obs: s.obs || "",
            dataNascimento: s.dataNascimento || "",
            vinculo: s.vinculo
          }))
        }
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO CADASTRO:", error.message);
    if (error.code === 'P2002') return { success: false, error: "Este CNPJ já possui esse serviço contratado!" };
    return { success: false, error: "Erro na base de dados. Verifique os campos." };
  }
}


/**
 * Cria o registro correspondente em `clientes` (CS&NPS) quando um contrato é
 * fechado no Painel de Metas — decisão tomada em 2026-07-13 (ver decisions.md)
 * para eliminar a lacuna onde um serviço novo cadastrado só no Metas nunca
 * aparecia no CS&NPS (a mesclagem por CNPJ só junta registros que já existem
 * em `clientes`, nunca cria nada novo sozinha).
 *
 * Checa primeiro (via `findFirst`, não reagindo a erro de constraint) se já
 * existe um registro com esse cnpj+serviço:
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
interface SocioParaSincronizacao {
  nome: string;
  telefone?: string | null;
  dataNascimento?: string | null;
  vinculo?: string | null;
  obs?: string | null;
}

interface DadosContratoParaSincronizacao {
  cnpj: string;
  razaoSocial: string;
  servico: string;
  nomeFantasia?: string | null;
  dataConstituicao?: string | null;
  regimeTributario?: string | null;
  uf?: string | null;
  municipio?: string | null;
  dataContratacao?: string | null;
  socios?: SocioParaSincronizacao[];
}

export async function criarRegistroClienteAPartirDeContrato(
  dados: DadosContratoParaSincronizacao
): Promise<{ success: true; criado: boolean; reativado?: boolean; clienteId: number }> {
  const cnpjLimpo = dados.cnpj.replace(/\D/g, "");

  try {
    const existente = await db.clientes.findFirst({
      where: { cnpj: cnpjLimpo, servicos: dados.servico },
      select: { id: true, status: true, nomeFantasia: true, dataConstituicao: true, regimeTributario: true, uf: true, municipio: true, dataContratacao: true },
    });

    if (existente) {
      if (existente.status === "Arquivado") {
        // Dados fiscais (objetivos, vindos da Receita Federal) são atualizados na
        // reativação — mas nunca sobrescrevem um valor já preenchido com um novo
        // valor vazio (não perder dado bom por um cadastro incompleto).
        await db.clientes.update({
          where: { id: existente.id },
          data: {
            status: "Em Andamento",
            nomeFantasia: dados.nomeFantasia || existente.nomeFantasia,
            dataConstituicao: dados.dataConstituicao || existente.dataConstituicao,
            regimeTributario: dados.regimeTributario || existente.regimeTributario,
            uf: dados.uf || existente.uf,
            municipio: dados.municipio || existente.municipio,
            dataContratacao: dados.dataContratacao || existente.dataContratacao,
            updatedAt: new Date().toISOString(),
          },
        });
        revalidatePath("/PainelAlpha/CadastroClientes");
        return { success: true, criado: false, reativado: true, clienteId: existente.id };
      }
      // Já existe e está ativo — idempotente, não sobrescreve nada.
      return { success: true, criado: false, clienteId: existente.id };
    }

    const sociosComNome = (dados.socios ?? []).filter((s) => s.nome?.trim());

    const novoCliente = await db.clientes.create({
      data: {
        cnpj: cnpjLimpo,
        razaoSocial: dados.razaoSocial || "",
        nomeFantasia: dados.nomeFantasia || null,
        dataConstituicao: dados.dataConstituicao || null,
        regimeTributario: dados.regimeTributario || null,
        uf: dados.uf || null,
        municipio: dados.municipio || null,
        servicos: dados.servico,
        analistaResponsavel: "",
        embasamento: null,
        origemLead: null,
        dataContratacao: dados.dataContratacao || null,
        dataExito: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        socios: {
          create: sociosComNome.map((s) => ({
            nome: s.nome,
            telefone: s.telefone || "",
            obs: s.obs || "",
            dataNascimento: s.dataNascimento || "",
            vinculo: s.vinculo || "",
          })),
        },
      },
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, criado: true, clienteId: novoCliente.id };
  } catch (error: any) {
    // Qualquer erro (incluindo P2002 em corrida rara entre o findFirst e o create)
    // é logado, mas NUNCA deve derrubar a criação do contrato no Metas.
    console.error("ERRO criarRegistroClienteAPartirDeContrato:", error?.message ?? error);
    // Sem clienteId confiável nesse caminho de erro — resolve o registro de novo por cnpj+serviço
    // como melhor esforço (pode retornar null se nem isso funcionar, tratado pelo chamador).
    const fallback = await db.clientes.findFirst({
      where: { cnpj: cnpjLimpo, servicos: dados.servico },
      select: { id: true },
    }).catch(() => null);
    return { success: true, criado: false, clienteId: fallback?.id ?? 0 };
  }
}

export async function buscarClientes() {
  try {
    const lista = await db.clientes.findMany({
      where: {
        status: {
          not: "Arquivado"
        }
      },
      include: {
        socios: true,
        log_cs: {
          orderBy: { dataRegistro: 'desc' },
        },
        logFeedback: {
          orderBy: { dataRegistro: 'desc' },
        },
        historicoAlteracoes: {
          orderBy: { criadoEm: 'desc' },
        },
        indicacao: {
          where: { status: "ATIVA" },
          include: { parceiro: { select: { id: true, nome: true, nivel: true } } },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    return lista;
  } catch (error: any) {
    console.error("ERRO DO PRISMA buscarClientes:", error?.message ?? error);
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
 * Casamento por CNPJ normalizado (só dígitos), pois os dois lados podem salvar
 * o CNPJ com/sem máscara.
 */
export async function buscarServicosContratados(cnpj: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  if (!cnpjLimpo) return [];

  try {
    const contratos = await db.contratoComercial.findMany({
      where: { arquivado: false },
      select: {
        id: true,
        cnpj: true,
        servico: true,
        valorContrato: true,
        formaPagamento: true,
        closerNome: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return contratos
      .filter((c) => c.cnpj.replace(/\D/g, "") === cnpjLimpo)
      .map(({ cnpj: _cnpj, ...resto }) => resto);
  } catch (error: any) {
    console.error("ERRO buscarServicosContratados:", error?.message ?? error);
    return [];
  }
}

/**
 * Igual a `buscarServicosContratados`, mas casa também pelo nome do serviço —
 * usada quando o CS&NPS tem múltiplos registros de `clientes` para o mesmo
 * CNPJ (um por serviço contratado) e precisa ligar CADA registro ao seu
 * contrato correspondente no Painel de Metas, não a todos os contratos do
 * CNPJ de uma vez. Normaliza acentuação/caixa dos dois lados antes de comparar
 * (ambos os campos são texto livre hoje, sem enum compartilhado).
 */
export async function buscarServicoContratadoPorCliente(cnpj: string, servicos: string | null) {
  if (!servicos) return null;
  const candidatos = await buscarServicosContratados(cnpj);
  const alvo = normalizarNomeServico(servicos);

  return (
    candidatos.find((c) => normalizarNomeServico(c.servico) === alvo) ??
    candidatos.find((c) => alvo.includes(normalizarNomeServico(c.servico))) ??
    null
  );
}

export async function salvarLogCS(clienteId: number, dados: { sentimento: string, observacao: string, data_registro: string }) {
  try {
    const colaborador = await getColaboradorNome();
    await db.$executeRawUnsafe(
      `INSERT INTO log_cs (colaborador, sentimento, observacao, clienteId, dataRegistro)
         VALUES (?, ?, ?, ?, ?)`,
      colaborador,
      dados.sentimento,
      dados.observacao,
      clienteId,
      dados.data_registro 
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO SQL AO SALVAR CS:", error.message);
    return { success: false, error: "Erro crítico no banco." };
  }
}

export async function atualizarDadosGestao(clienteId: number, dados: any) {
  try {
    await db.clientes.update({
      where: { id: clienteId },
      data: {
        nps: Number(dados.nps),
        feedbackGoogle: Boolean(dados.feedbackGoogle),
        nomeGoogle: dados.nomeGoogle,
        status: dados.status
      }
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function salvarLogFeedback(clienteId: number, dados: any) {
  try {
    const colaborador = await getColaboradorNome();
    const sentimento = dados.sentimento || "N/A";
    const observacao = dados.observacao || "";
    const dataRegistro = dados.data_registro; 

    await db.$executeRawUnsafe(
      `INSERT INTO logFeedback (colaborador, sentimento, observacao, clienteId, dataRegistro) 
       VALUES (?, ?, ?, ?, ?)`,
      colaborador,
      sentimento,
      observacao,
      Number(clienteId),
      dataRegistro 
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO CRÍTICO FEEDBACK:", error.message);
    return { success: false, error: error.message };
  }
}

export async function salvarAlteracoesGeral(clienteId: number, dadosNovos: any) {
  try {
    const { userId, nome } = await getUsuarioSessao();
    const estadoAnterior = await db.clientes.findUnique({ where: { id: clienteId } });

    if (!estadoAnterior) return { success: false, error: "Cliente não encontrado" };

    const dadosParaAtualizar = {
      analistaResponsavel: dadosNovos.analistaResponsavel,
      dataContratacao: dadosNovos.dataContratacao ? new Date(dadosNovos.dataContratacao).toISOString() : null,
      status: dadosNovos.status,
      nps: (dadosNovos.nps === "" || dadosNovos.nps === null) ? null : Number(dadosNovos.nps),
      feedbackGoogle: dadosNovos.feedbackGoogle,
      nomeGoogle: dadosNovos.nomeGoogle,
      cnpj: dadosNovos.cnpj?.replace(/\D/g, ""),
      razaoSocial: dadosNovos.razaoSocial,
      nomeFantasia: dadosNovos.nomeFantasia,
      dataConstituicao: dadosNovos.dataConstituicao,
      regimeTributario: dadosNovos.regimeTributario,
      uf: dadosNovos.uf,
      municipio: dadosNovos.municipio,
      servicos: Array.isArray(dadosNovos.servicos) ? dadosNovos.servicos.join(", ") : dadosNovos.servicos,
      embasamento: dadosNovos.embasamento ?? null,
      origemLead: dadosNovos.origemLead ?? null,
      dataExito: dadosNovos.dataExito ? new Date(dadosNovos.dataExito).toISOString() : (dadosNovos.status === "Deferido" ? new Date().toISOString() : null),
      formaPagamento: dadosNovos.formaPagamento,
      valorContrato: dadosNovos.valorContrato === "" || dadosNovos.valorContrato === undefined ? undefined : (dadosNovos.valorContrato === null ? null : Number(dadosNovos.valorContrato)),
      closerNome: dadosNovos.closerNome,
      updatedAt: new Date().toISOString(),
    };

    await db.clientes.update({
      where: { id: clienteId },
      data: dadosParaAtualizar,
    });

    const loteId = crypto.randomUUID();
    const linhasHistorico = montarLinhasHistorico({
      clienteId,
      loteId,
      estadoAnterior,
      dadosNovos: dadosParaAtualizar,
      userId,
      nomeUsuarioNaEpoca: nome,
      campos: [...CAMPOS_HISTORICO_CLIENTE],
    });

    if (linhasHistorico.length > 0) {
      await db.historicoAlteracaoCliente.createMany({ data: linhasHistorico });
    }

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO UPDATE:", error.message);
    return { success: false, error: error.message };
  }
}

const reverterCampoHistoricoSchema = z.object({
  historicoId: z.string().cuid(),
});

/**
 * Campos de `clientes` que são numéricos ou booleanos no schema — usados para
 * fazer o parse reverso correto do `valorAnterior` (que é sempre `String?` no
 * histórico) de volta ao tipo esperado pelo Prisma. Os demais campos rastreados
 * (incluindo os de data) permanecem `String` como já são hoje no schema de
 * `clientes` — nenhuma conversão de tipo é inventada além do que o schema pede.
 */
const CAMPOS_NUMERICOS_CLIENTE = new Set(["nps", "valorContrato"]);
const CAMPOS_BOOLEANOS_CLIENTE = new Set(["feedbackGoogle"]);

function converterValorParaCampo(campo: string, valor: string | null): unknown {
  if (CAMPOS_NUMERICOS_CLIENTE.has(campo)) {
    if (valor === null || valor === "") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }
  if (CAMPOS_BOOLEANOS_CLIENTE.has(campo)) {
    return valor === "true";
  }
  return valor;
}

/**
 * Reverte 1 campo específico de `clientes` para o valor que ele tinha antes de
 * uma alteração registrada em `HistoricoAlteracaoCliente`. Substitui
 * completamente o antigo `restaurarVersaoCliente` (que restaurava o cliente
 * inteiro a partir de um snapshot JSON) — no modelo por-campo não existe mais
 * um snapshot completo para restaurar de uma vez.
 *
 * Após aplicar o `update`, cria uma NOVA linha de histórico (não reaproveita o
 * `loteId` da edição original) registrando a própria reversão: `valorAnterior`
 * é o valor que estava ANTES de reverter (o `valorNovo` da linha original),
 * `valorNovo` é o valor restaurado, `acao: "REVERSAO"`, autoria de quem está
 * revertendo AGORA (não de quem editou originalmente) — preserva a cadeia de
 * auditoria em vez de apagar o rastro da edição revertida.
 */
export async function reverterCampoHistorico(historicoId: string) {
  try {
    const { historicoId: idValidado } = reverterCampoHistoricoSchema.parse({ historicoId });

    const linhaOriginal = await db.historicoAlteracaoCliente.findUnique({
      where: { id: idValidado },
    });

    if (!linhaOriginal) return { success: false, error: "Registro de histórico não encontrado" };

    const { campo, valorAnterior, clienteId } = linhaOriginal;
    const valorRestaurado = converterValorParaCampo(campo, valorAnterior);

    await db.clientes.update({
      where: { id: clienteId },
      data: {
        [campo]: valorRestaurado,
        updatedAt: new Date().toISOString(),
      },
    });

    const { userId, nome } = await getUsuarioSessao();

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

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: "ID de histórico inválido" };
    }
    console.error("ERRO reverterCampoHistorico:", error?.message ?? error);
    return { success: false, error: error.message };
  }
}





export async function adicionarSocio(clienteId: number, dadosSocio: { nome: string; telefone?: string; obs?: string, dataNascimento: string, vinculo: string }) {
  try {
    const novoSocio = await db.socios.create({
      data: {
        clienteId: clienteId,
        nome: dadosSocio.nome,
        telefone: dadosSocio.telefone || "",
        obs: dadosSocio.obs || "",
        dataNascimento: dadosSocio.dataNascimento || "",
        vinculo: dadosSocio.vinculo,
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: novoSocio };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


export async function excluirLogCS(logId: number) {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM log_cs WHERE id = ?`,
      logId
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO EXCLUIR LOG CS:", error.message);
    return { success: false, error: "Não foi possível excluir o registro." };
  }
}


export async function excluirLogFeedback(logId: number) {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM logFeedback WHERE id = ?`, 
      logId
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO EXCLUIR FEEDBACK:", error.message);
    return { success: false };
  }
}

export async function atualizarSocio(socioId: number, dados: { nome: string; telefone?: string; dataNascimento?: string; vinculo?: string; obs?: string }) {
  try {
    await db.socios.update({
      where: { id: socioId },
      data: dados,
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function atualizarLogCS(logId: number, dados: { sentimento: string; observacao: string; dataRegistro?: string }) {
  try {
    await db.log_cs.update({
      where: { id: logId },
      data: {
        sentimento: dados.sentimento,
        observacao: dados.observacao,
        ...(dados.dataRegistro ? { dataRegistro: new Date(`${dados.dataRegistro}T12:00:00`) } : {}),
      },
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function atualizarStatusCliente(clienteId: number, novoStatus: string) {
  try {
    await db.clientes.update({
      where: { id: clienteId },
      data: {
        status: novoStatus, 
        updatedAt: new Date().toISOString(),
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO OCULTAR:", error.message);
    return { success: false };
  }
}
