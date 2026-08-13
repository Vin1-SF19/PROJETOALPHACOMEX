import db from "@/lib/prisma";

import { isAdminRole, isSameRole } from "@/lib/roles";

const PERMISSAO_CRM = "crm";

type ClienteAcessoBpm = Pick<
  typeof db,
  | "usuarios"
  | "setorPermissao"
  | "usuarioPermissaoOverride"
  | "bpmPipeline"
  | "bpmCardMembro"
>;

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
  if (isAdminRole(usuario.role)) {
    return { usuario, permissoes: [PERMISSAO_CRM] };
  }

  const [permissoesSetorTodas, overrides] = await Promise.all([
    client.setorPermissao.findMany({ select: { setor: true, modulo: true } }),
    client.usuarioPermissaoOverride.findMany({
      where: { usuarioId: userId },
      select: { modulo: true, acao: true },
    }),
  ]);
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
  return { usuario, permissoes: [...efetivas] };
}

export async function checarAcessoModuloBpm(
  userId: number,
): Promise<boolean> {
  const acesso = await carregarUsuarioEPermissoesBpm(userId);
  return Boolean(
    acesso
    && (isAdminRole(acesso.usuario.role) || possuiPermissaoCrm(acesso.permissoes)),
  );
}

export async function exigirAcessoModuloBpm(userId: number): Promise<void> {
  if (!(await checarAcessoModuloBpm(userId))) throw new Error("Não autorizado");
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

const PERMISSOES_POR_ROLE: Record<string, BpmAcao[]> = {
  RESPONSAVEL: [
    "visualizar", "editarCard", "moverEtapa", "criarTarefa", "concluirTarefa",
    "enviarArquivo", "excluirArquivo", "adicionarParticipantes",
    "excluirCard", "visualizarHistorico",
  ],
  ADMINISTRADOR: [
    "visualizar", "editarCard", "moverEtapa", "criarTarefa", "concluirTarefa",
    "enviarArquivo", "excluirArquivo", "adicionarParticipantes",
    "excluirCard", "visualizarHistorico",
  ],
  PARTICIPANTE: ["visualizar", "criarTarefa", "concluirTarefa", "visualizarHistorico"],
};

export interface AcessoBpmCard {
  autorizado: boolean;
  isAdminGlobal: boolean;
  role: string | null;
}

/**
 * Fonte única de ownership do módulo Alpha BPM. Nunca confia em role/permissão
 * vinda do cliente — sempre resolve do banco a partir de userId + cardId.
 * Admin/CEO globais têm acesso pleno a qualquer card (mesmo padrão do Blueprint).
 *
 * Regra de negócio (D-042): apenas o responsável do card ou um administrador
 * pode movê-lo de etapa — participantes têm acesso de leitura/colaboração, não de
 * movimentação. Isso é refletido em PERMISSOES_POR_ROLE: só RESPONSAVEL e
 * ADMINISTRADOR têm "moverEtapa".
 */
export async function checarAcessoBpmCard(
  cardId: string,
  userId: number,
  _userRoleGlobal: string | null,
  acao: BpmAcao,
  client: ClienteAcessoBpm = db,
): Promise<AcessoBpmCard> {
  const acessoModulo = await carregarUsuarioEPermissoesBpm(userId, client);
  if (!acessoModulo) {
    return { autorizado: false, isAdminGlobal: false, role: null };
  }
  if (isAdminRole(acessoModulo.usuario.role)) {
    return { autorizado: true, isAdminGlobal: true, role: "ADMINISTRADOR" };
  }
  if (!possuiPermissaoCrm(acessoModulo.permissoes)) {
    return { autorizado: false, isAdminGlobal: false, role: null };
  }

  const membro = await client.bpmCardMembro.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { role: true },
  });

  if (!membro) return { autorizado: false, isAdminGlobal: false, role: null };

  const permitido = PERMISSOES_POR_ROLE[membro.role]?.includes(acao) ?? false;
  return { autorizado: permitido, isAdminGlobal: false, role: membro.role };
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
export function checarAcessoConfigPipeline(
  userRoleGlobal: string | null,
  _acao: BpmAcaoPipeline,
): boolean {
  void _acao;
  return isAdminRole(userRoleGlobal);
}

export function exigirAcessoConfigPipeline(
  userRoleGlobal: string | null,
  acao: BpmAcaoPipeline,
): void {
  if (!checarAcessoConfigPipeline(userRoleGlobal, acao)) {
    throw new Error("Não autorizado — apenas administradores configuram pipelines");
  }
}

export { isAdminRole } from "@/lib/roles";
