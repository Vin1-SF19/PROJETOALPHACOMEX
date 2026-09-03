import db from "@/lib/prisma";

import { isAdminRole, isSameRole } from "@/lib/roles";
import { etapaEhBoasVindas, usuarioEhDiretoriaBpm } from "@/lib/bpm/boas-vindas";
import {
  acaoBpmExigeSomenteVisualizacao,
  resolverVisibilidadeEtapa,
} from "@/lib/bpm/visibilidade-etapa";

const PERMISSAO_CRM = "crm";

type ClienteAcessoBpm = Pick<
  typeof db,
  | "usuarios"
  | "setorPermissao"
  | "usuarioPermissaoOverride"
  | "bpmPipeline"
  | "bpmCard"
  | "bpmCardMembro"
>;

type UsuarioComAcessoBpm = {
  id: number;
  role: string;
  status: string;
  permissoes: string | null;
};

type PermissaoSetorBpm = { setor: string; modulo: string };
type OverridePermissaoBpm = { modulo: string; acao: string };

function resolverPermissoesEfetivasBpm(
  usuario: UsuarioComAcessoBpm,
  permissoesSetorTodas: readonly PermissaoSetorBpm[],
  overrides: readonly OverridePermissaoBpm[],
): string[] {
  if (isAdminRole(usuario.role)) return [PERMISSAO_CRM];

  const permissoesSetor = permissoesSetorTodas
    .filter((permissao) => isSameRole(permissao.setor, usuario.role))
    .map((permissao) => normalizarPermissaoBpm(permissao.modulo));
  const legado = (usuario.permissoes ?? "")
    .split(",")
    .map(normalizarPermissaoBpm)
    .filter(Boolean);
  const efetivas = new Set(permissoesSetor.length > 0 ? permissoesSetor : legado);
  for (const override of overrides) {
    const modulo = normalizarPermissaoBpm(override.modulo);
    if (override.acao === "ADD") efetivas.add(modulo);
    if (override.acao === "REMOVE") efetivas.delete(modulo);
  }
  return [...efetivas];
}

export function normalizarPermissaoBpm(permissao: string): string {
  return permissao.trim().toLocaleLowerCase("pt-BR");
}

export function possuiPermissaoCrm(permissoes: readonly string[]): boolean {
  return permissoes.some(
    (permissao) => normalizarPermissaoBpm(permissao) === PERMISSAO_CRM,
  );
}

export function podeAcessarPipelineBpm(params: {
  role: string;
  permissoes: readonly string[];
  setoresPipeline: readonly string[];
  ehMembroPipeline: boolean;
}): boolean {
  if (isAdminRole(params.role)) return true;
  if (!possuiPermissaoCrm(params.permissoes)) return false;
  return params.setoresPipeline.length === 0
    || params.ehMembroPipeline
    || params.setoresPipeline.some((setor) => isSameRole(setor, params.role));
}

export function podeSerResponsavelPipelineBpm(params: {
  role: string;
  permissoes: readonly string[];
  setoresPipeline: readonly string[];
}): boolean {
  return podeAcessarPipelineBpm({ ...params, ehMembroPipeline: false });
}

async function carregarUsuarioEPermissoesBpm(
  userId: number,
  client: ClienteAcessoBpm = db,
) {
  const usuario = await client.usuarios.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, permissoes: true },
  });
  if (!usuario || usuario.status !== "ATIVO") return null;
  const [permissoesSetorTodas, overrides] = await Promise.all([
    client.setorPermissao.findMany({ select: { setor: true, modulo: true } }),
    client.usuarioPermissaoOverride.findMany({
      where: { usuarioId: userId },
      select: { modulo: true, acao: true },
    }),
  ]);
  return {
    usuario,
    permissoes: resolverPermissoesEfetivasBpm(usuario, permissoesSetorTodas, overrides),
  };
}

export type UsuarioVinculavelBpm = {
  id: number;
  nome: string;
  imagemUrl: string | null;
};

/**
 * Retorna somente contas ativas que têm acesso efetivo ao CRM. A mesma regra é
 * reaplicada durante a mutação, para que um payload antigo nunca consiga
 * vincular uma conta desativada ou sem a permissão CRM.
 */
export async function listarUsuariosVinculaveisBpm(
  client: ClienteAcessoBpm = db,
): Promise<UsuarioVinculavelBpm[]> {
  const [usuarios, permissoesSetorTodas] = await Promise.all([
    client.usuarios.findMany({
      where: { status: "ATIVO" },
      select: {
        id: true,
        nome: true,
        imagemUrl: true,
        role: true,
        status: true,
        permissoes: true,
      },
      orderBy: { nome: "asc" },
    }),
    client.setorPermissao.findMany({ select: { setor: true, modulo: true } }),
  ]);
  if (usuarios.length === 0) return [];

  const overrides = await client.usuarioPermissaoOverride.findMany({
    where: { usuarioId: { in: usuarios.map((usuario) => usuario.id) } },
    select: { usuarioId: true, modulo: true, acao: true },
  });
  const overridesPorUsuario = new Map<number, OverridePermissaoBpm[]>();
  for (const override of overrides) {
    const atuais = overridesPorUsuario.get(override.usuarioId) ?? [];
    atuais.push(override);
    overridesPorUsuario.set(override.usuarioId, atuais);
  }

  return usuarios
    .filter((usuario) => usuario.status === "ATIVO" && possuiPermissaoCrm(
      resolverPermissoesEfetivasBpm(
        usuario,
        permissoesSetorTodas,
        overridesPorUsuario.get(usuario.id) ?? [],
      ),
    ))
    .map(({ id, nome, imagemUrl }) => ({ id, nome, imagemUrl }));
}

export async function checarAcessoModuloBpm(
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(userId, client);
  return Boolean(
    acesso
    && (isAdminRole(acesso.usuario.role) || possuiPermissaoCrm(acesso.permissoes)),
  );
}

export async function exigirAcessoModuloBpm(
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<void> {
  if (!(await checarAcessoModuloBpm(userId, client))) throw new Error("Não autorizado");
}

/**
 * Diretoria do pipeline Operacional. Não use `isAdminRole` aqui: CEO/TI têm
 * privilégios administrativos no produto, mas não podem ver a triagem de
 * Boas-vindas, que é reservada à conta de diretoria (`Admin`).
 */
export async function checarAcessoDiretoriaBpm(
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(userId, client);
  return Boolean(acesso && usuarioEhDiretoriaBpm(acesso.usuario.role));
}

export async function checarAcessoBpmPipeline(
  pipelineId: string,
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(userId, client);
  if (!acesso) return false;
  if (isAdminRole(acesso.usuario.role)) return true;
  if (!possuiPermissaoCrm(acesso.permissoes)) return false;

  const [pipeline, membro] = await Promise.all([
    client.bpmPipeline.findUnique({
      where: { id: pipelineId },
      select: {
        setores: { select: { setor: { select: { nome: true } } } },
      },
    }),
    client.bpmCardMembro.findFirst({
      where: { userId, card: { pipelineId } },
      select: { id: true },
    }),
  ]);
  if (!pipeline) return false;
  return podeAcessarPipelineBpm({
    role: acesso.usuario.role,
    permissoes: acesso.permissoes,
    setoresPipeline: pipeline.setores.map(({ setor }) => setor.nome),
    ehMembroPipeline: Boolean(membro),
  });
}

export async function exigirAcessoBpmPipeline(
  pipelineId: string,
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<void> {
  if (!(await checarAcessoBpmPipeline(pipelineId, userId, client))) {
    throw new Error("Não autorizado");
  }
}

export async function usuarioElegivelResponsavelBpm(
  pipelineId: string,
  responsavelId: number,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(responsavelId, client);
  if (!acesso) return false;
  if (isAdminRole(acesso.usuario.role)) return true;
  if (!possuiPermissaoCrm(acesso.permissoes)) return false;

  const pipeline = await client.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: { setores: { select: { setor: { select: { nome: true } } } } },
  });
  if (!pipeline) return false;
  return podeSerResponsavelPipelineBpm({
    role: acesso.usuario.role,
    permissoes: acesso.permissoes,
    setoresPipeline: pipeline.setores.map(({ setor }) => setor.nome),
  });
}

/**
 * Escolhe automaticamente um responsável elegível para `pipelineId`, sem exigir seleção manual
 * (RM-2026-97934A — indicação de parceiro direcionada ao closer automaticamente). Preferência:
 * `preferidoUserId` (ex: quem criou a indicação) se elegível; senão o usuário ativo com permissão
 * CRM há mais tempo no sistema (`orderBy id asc`, determinístico) dentre os elegíveis do pipeline.
 * Retorna `null` se nenhum usuário elegível existir — chamador deve tratar como erro de configuração.
 */
export async function resolverResponsavelAutomaticoBpm(
  pipelineId: string,
  preferidoUserId?: number,
  client: ClienteAcessoBpm = db,
): Promise<number | null> {
  if (preferidoUserId && (await usuarioElegivelResponsavelBpm(pipelineId, preferidoUserId, client))) {
    return preferidoUserId;
  }

  const pipeline = await client.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: { setores: { select: { setor: { select: { nome: true } } } } },
  });
  if (!pipeline) return null;
  const setoresPipeline = pipeline.setores.map(({ setor }) => setor.nome);

  const [usuarios, permissoesSetorTodas] = await Promise.all([
    client.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, role: true, status: true, permissoes: true },
      orderBy: { id: "asc" },
    }),
    client.setorPermissao.findMany({ select: { setor: true, modulo: true } }),
  ]);
  if (usuarios.length === 0) return null;

  const overrides = await client.usuarioPermissaoOverride.findMany({
    where: { usuarioId: { in: usuarios.map((usuario) => usuario.id) } },
    select: { usuarioId: true, modulo: true, acao: true },
  });
  const overridesPorUsuario = new Map<number, OverridePermissaoBpm[]>();
  for (const override of overrides) {
    const atuais = overridesPorUsuario.get(override.usuarioId) ?? [];
    atuais.push(override);
    overridesPorUsuario.set(override.usuarioId, atuais);
  }

  const elegivel = usuarios.find((usuario) => podeSerResponsavelPipelineBpm({
    role: usuario.role,
    permissoes: resolverPermissoesEfetivasBpm(
      usuario,
      permissoesSetorTodas,
      overridesPorUsuario.get(usuario.id) ?? [],
    ),
    setoresPipeline,
  }));
  return elegivel?.id ?? null;
}

export type BpmAcao =
  | "visualizar"
  | "editarCard"
  | "moverEtapa"
  | "criarTarefa"
  | "concluirTarefa"
  | "enviarArquivo"
  | "excluirArquivo"
  | "adicionarParticipantes"
  | "excluirCard"
  | "visualizarHistorico";

/** Operações necessárias para executar o trabalho cotidiano do card. */
const ACOES_TRABALHO_CARD: BpmAcao[] = [
  "visualizar",
  "editarCard",
  "moverEtapa",
  "criarTarefa",
  "concluirTarefa",
  "enviarArquivo",
  "excluirArquivo",
  "visualizarHistorico",
];

const PERMISSOES_POR_ROLE: Record<string, BpmAcao[]> = {
  RESPONSAVEL: [
    ...ACOES_TRABALHO_CARD,
    "adicionarParticipantes",
    "excluirCard",
  ],
  ADMINISTRADOR: [
    ...ACOES_TRABALHO_CARD,
    "adicionarParticipantes",
    "excluirCard",
  ],
  // Pessoas vinculadas precisam conseguir atender o card de ponta a ponta:
  // campos/anotações, anexos, interações, tarefas, reunião e movimento usam
  // as capacidades abaixo. Gestão de pessoas e exclusão continuam restritas.
  PARTICIPANTE: ACOES_TRABALHO_CARD,
};

export interface AcessoBpmCard {
  autorizado: boolean;
  isAdminGlobal: boolean;
  role: string | null;
  perfilGlobal: string | null;
  podeAgirEtapa: boolean;
}

/**
 * Fonte única de ownership do módulo Alpha BPM. Nunca confia em role/permissão
 * vinda do cliente — sempre resolve do banco a partir de userId + cardId.
 * Admin/CEO globais têm acesso pleno a qualquer card (mesmo padrão do Blueprint).
 *
 * Pessoas vinculadas podem executar o trabalho do card, inclusive editar e
 * mover etapa. A gestão da composição (`adicionarParticipantes`) e a exclusão
 * do card permanecem restritas ao responsável, administrador do card ou
 * administrador global.
 */
export async function checarAcessoBpmCard(
  cardId: string,
  userId: number,
  _userRoleGlobal: string | null,
  acao: BpmAcao,
  client: ClienteAcessoBpm = db,
): Promise<AcessoBpmCard> {
  const [acessoModulo, card] = await Promise.all([
    carregarUsuarioEPermissoesBpm(userId, client),
    client.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        etapa: {
          select: {
            nome: true,
            visibilidades: {
              select: { perfil: true, podeVer: true, podeAgir: true },
            },
          },
        },
      },
    }),
  ]);
  if (!acessoModulo || !card) {
    return { autorizado: false, isAdminGlobal: false, role: null, perfilGlobal: null, podeAgirEtapa: false };
  }
  if (etapaEhBoasVindas(card.etapa.nome) && !usuarioEhDiretoriaBpm(acessoModulo.usuario.role)) {
    return { autorizado: false, isAdminGlobal: false, role: null, perfilGlobal: acessoModulo.usuario.role, podeAgirEtapa: false };
  }
  if (isAdminRole(acessoModulo.usuario.role)) {
    return { autorizado: true, isAdminGlobal: true, role: "ADMINISTRADOR", perfilGlobal: acessoModulo.usuario.role, podeAgirEtapa: true };
  }
  if (!possuiPermissaoCrm(acessoModulo.permissoes)) {
    return { autorizado: false, isAdminGlobal: false, role: null, perfilGlobal: acessoModulo.usuario.role, podeAgirEtapa: false };
  }

  const permissaoEtapa = resolverVisibilidadeEtapa(
    acessoModulo.usuario.role,
    card.etapa.visibilidades,
  );
  const permitidoNaEtapa = acaoBpmExigeSomenteVisualizacao(acao)
    ? permissaoEtapa.podeVer
    : permissaoEtapa.podeAgir;
  if (!permitidoNaEtapa) {
    return { autorizado: false, isAdminGlobal: false, role: null, perfilGlobal: acessoModulo.usuario.role, podeAgirEtapa: false };
  }

  const membro = await client.bpmCardMembro.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { role: true },
  });

  if (!membro) {
    return { autorizado: false, isAdminGlobal: false, role: null, perfilGlobal: acessoModulo.usuario.role, podeAgirEtapa: false };
  }

  const permitido = PERMISSOES_POR_ROLE[membro.role]?.includes(acao) ?? false;
  return {
    autorizado: permitido,
    isAdminGlobal: false,
    role: membro.role,
    perfilGlobal: acessoModulo.usuario.role,
    podeAgirEtapa: permissaoEtapa.podeAgir,
  };
}

/** Lança erro padronizado se o acesso não for autorizado — usar no início de toda action. */
export async function exigirAcessoBpmCard(
  cardId: string,
  userId: number,
  userRoleGlobal: string | null,
  acao: BpmAcao,
  client: ClienteAcessoBpm = db,
): Promise<AcessoBpmCard> {
  const acesso = await checarAcessoBpmCard(
    cardId,
    userId,
    userRoleGlobal,
    acao,
    client,
  );
  if (!acesso.autorizado) {
    throw new Error("Não autorizado");
  }
  return acesso;
}

export type BpmAcaoPipeline =
  | "visualizarPipeline"
  | "configurarEtapas"
  | "configurarCampos"
  | "configurarSla"
  | "criarPipeline";

/**
 * Ownership de configuração de pipeline (D-031): apenas administradores globais
 * podem criar/editar etapas, campos, SLA e layout de um pipeline — não há papel
 * intermediário aqui, diferente do ownership por card acima.
 */
export async function checarAcessoConfigPipeline(
  userId: number,
  _acao: BpmAcaoPipeline,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  void _acao;
  const acesso = await carregarUsuarioEPermissoesBpm(userId, client);
  return Boolean(acesso && isAdminRole(acesso.usuario.role));
}

/**
 * Eventos no canal do pipeline são apenas invalidações genéricas e não carregam
 * `cardId` nem dados do card. Assim, uma pessoa CRM ativa vinculada a qualquer
 * card daquele pipeline pode assinar o canal para perceber a revogação do
 * próprio vínculo; a recarga posterior continua filtrando cards por membro.
 */
export async function checarAcessoRealtimeBpmPipeline(
  pipelineId: string,
  userId: number,
  client: ClienteAcessoBpm = db,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(userId, client);
  if (!acesso) return false;
  if (isAdminRole(acesso.usuario.role)) return true;
  if (!possuiPermissaoCrm(acesso.permissoes)) return false;

  const [pipeline, membro] = await Promise.all([
    client.bpmPipeline.findUnique({
      where: { id: pipelineId },
      select: { setores: { select: { setor: { select: { nome: true } } } } },
    }),
    client.bpmCardMembro.findFirst({
      where: { userId, card: { pipelineId } },
      select: { id: true },
    }),
  ]);
  if (!pipeline) return false;
  return pipeline.setores.length === 0
    || pipeline.setores.some(({ setor }) => isSameRole(setor.nome, acesso.usuario.role))
    || Boolean(membro);
}

export async function exigirAcessoConfigPipeline(
  userId: number,
  acao: BpmAcaoPipeline,
  client: ClienteAcessoBpm = db,
): Promise<void> {
  if (!(await checarAcessoConfigPipeline(userId, acao, client))) {
    throw new Error("Não autorizado — apenas administradores configuram pipelines");
  }
}

export { isAdminRole } from "@/lib/roles";
