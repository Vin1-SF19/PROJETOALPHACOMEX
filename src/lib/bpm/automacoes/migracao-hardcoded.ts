import "server-only";

import db from "@/lib/prisma";
import { gatilhoConfigSchema, validarGrafoAutomacao, type TipoEventoAutomacao } from "./central-schemas";
import { sincronizarAgendasVersaoAutomacao } from "./agenda";

type DefinicaoMigracao = {
  origemChave: string;
  nome: string;
  descricao: string;
  pipelineId: string;
  etapaId: string;
  gatilhoTipo: TipoEventoAutomacao;
  gatilhoConfig: Record<string, unknown>;
  grafo: Record<string, unknown>;
};

export const NOMES_AUTOMACOES_MIGRADAS = {
  fechamento: "Fechamento comercial — criar Financeiro e Radar",
  notaFiscal: "Nota Fiscal — criar tarefa de emissão",
  novosLeadsOitoDias: "Novos Leads — mover para Standby após 8 dias úteis",
  agendarReuniaoOitoDias: "Agendar reunião — mover para Standby após 8 dias úteis",
  reuniaoAgendadaOitoDias: "Reunião Agendada — mover para Standby após 8 dias úteis",
  ligacoesDiarias: "Novos Leads — planejar 5 ligações diárias",
  standbySemanal: "Standby — follow-up semanal",
  monitoramentoMensal: "Monitoramento — revisão mensal",
  transcricaoMeet: "Reunião Agendada — sincronizar transcrição do Google Meet",
} as const;

function noFim(id = "fim") { return { id, tipo: "FIM" as const }; }
function grafoAcoes(acoes: Array<{ tipo: string; parametros: Record<string, unknown> }>) {
  const nos = acoes.map((acao, indice) => ({ id: `acao-${indice + 1}`, tipo: "ACAO" as const, acaoTipo: acao.tipo, parametros: acao.parametros, proximoId: indice === acoes.length - 1 ? "fim" : `acao-${indice + 2}` }));
  return { inicioId: nos[0]?.id ?? "fim", nos: [...nos, noFim()] };
}

function etapaPorNome(pipeline: { etapas: Array<{ id: string; nome: string; ordem: number }> }, nome: string) {
  const etapa = pipeline.etapas.find((item) => item.nome.trim().toLocaleLowerCase("pt-BR") === nome.trim().toLocaleLowerCase("pt-BR"));
  if (!etapa) throw new Error(`Etapa obrigatória não encontrada: ${nome}`);
  return etapa;
}

export async function planejarMigracaoAutomacoesHardcodedBpm(): Promise<DefinicaoMigracao[]> {
  const pipelines = await db.bpmPipeline.findMany({ include: { etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true, ordem: true } } } });
  const revisao = pipelines.find((item) => item.nome === "Revisão de Radar");
  const financeiro = pipelines.find((item) => item.nome === "Financeiro");
  const radar = pipelines.find((item) => item.nome === "Radar");
  if (!revisao || !financeiro || !radar) throw new Error("Pipelines Revisão de Radar, Financeiro e Radar são obrigatórios para a migração");
  const fechado = etapaPorNome(revisao, "Fechado");
  const notaFiscal = etapaPorNome(financeiro, "Nota Fiscal");
  const novosLeads = etapaPorNome(revisao, "Novos leads");
  const agendarReuniao = etapaPorNome(revisao, "Agendar reunião");
  const reuniaoAgendada = etapaPorNome(revisao, "Reunião Agendada");
  const standby = etapaPorNome(revisao, "Standby - Follow Up");
  const monitoramento = etapaPorNome(revisao, "Monitoramento");
  const financeiroInicial = financeiro.etapas[0];
  const radarInicial = radar.etapas[0];
  if (!financeiroInicial || !radarInicial) throw new Error("Financeiro e Radar precisam ter uma etapa ativa");

  const temporal = (origemChave: string, nome: string, descricao: string, etapaId: string, ancora: "CRIACAO_CARD" | "ENTRADA_ETAPA", validarRequisitos: boolean): DefinicaoMigracao => ({
    origemChave, nome, descricao, pipelineId: revisao.id, etapaId, gatilhoTipo: "TEMPO_NA_ETAPA_ATINGIDO",
    gatilhoConfig: { origemChave, escopo: "ETAPAS", etapaId, etapasIds: [etapaId], tempo: { quantidade: 8, unidade: "DIAS_UTEIS", ancora } },
    grafo: grafoAcoes([{ tipo: "MOVER_CARD", parametros: { etapaId: standby.id, validarRequisitos, exigirProximoContatoVazio: true } }]),
  });

  const definicoes: DefinicaoMigracao[] = [
    {
      origemChave: "fechamento_comercial", nome: NOMES_AUTOMACOES_MIGRADAS.fechamento,
      descricao: "Ao entrar em Fechado, cria um card ativo vinculado no Financeiro e no Radar quando a empresa ainda não possui card ativo nesses pipelines.",
      pipelineId: revisao.id, etapaId: fechado.id, gatilhoTipo: "ENTRAR_COLUNA",
      gatilhoConfig: { origemChave: "fechamento_comercial", escopo: "ETAPAS", etapaId: fechado.id, etapasIds: [fechado.id] },
      grafo: grafoAcoes([
        { tipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: { pipelineId: financeiro.id, etapaId: financeiroInicial.id, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true } },
        { tipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: { pipelineId: radar.id, etapaId: radarInicial.id, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true } },
      ]),
    },
    {
      origemChave: "avanco_nota_fiscal", nome: NOMES_AUTOMACOES_MIGRADAS.notaFiscal,
      descricao: "Ao entrar em Nota Fiscal, cria uma tarefa prioritária de emissão se ainda não houver uma pendente do mesmo tipo.",
      pipelineId: financeiro.id, etapaId: notaFiscal.id, gatilhoTipo: "ENTRAR_COLUNA",
      gatilhoConfig: { origemChave: "avanco_nota_fiscal", escopo: "ETAPAS", etapaId: notaFiscal.id, etapasIds: [notaFiscal.id] },
      grafo: grafoAcoes([{ tipo: "CRIAR_TAREFA", parametros: { titulo: "Emissão de Nota Fiscal", descricao: "Tarefa criada automaticamente ao avançar para a etapa Nota Fiscal.", tipo: "EMISSAO_NF", prioridade: "ALTA", naoDuplicarPendenteTipo: true } }]),
    },
    temporal("novos_leads_8_dias_uteis", NOMES_AUTOMACOES_MIGRADAS.novosLeadsOitoDias, "Após oito dias úteis desde a criação, move para Standby se não houver próximo contato e se os requisitos estiverem completos.", novosLeads.id, "CRIACAO_CARD", true),
    temporal("agendar_reuniao_8_dias_uteis", NOMES_AUTOMACOES_MIGRADAS.agendarReuniaoOitoDias, "Após oito dias úteis na etapa, move para Standby se não houver próximo contato.", agendarReuniao.id, "ENTRADA_ETAPA", false),
    temporal("reuniao_agendada_8_dias_uteis", NOMES_AUTOMACOES_MIGRADAS.reuniaoAgendadaOitoDias, "Após oito dias úteis na etapa, move para Standby se não houver próximo contato.", reuniaoAgendada.id, "ENTRADA_ETAPA", false),
    {
      origemChave: "novos_leads_5_ligacoes_diarias", nome: NOMES_AUTOMACOES_MIGRADAS.ligacoesDiarias,
      descricao: "Em dias úteis, cria somente as tarefas necessárias para completar cinco tentativas de ligação registradas no dia, durante os oito dias úteis do ciclo.",
      pipelineId: revisao.id, etapaId: novosLeads.id, gatilhoTipo: "RECORRENCIA_ATINGIDA",
      gatilhoConfig: { origemChave: "novos_leads_5_ligacoes_diarias", escopo: "ETAPAS", etapaId: novosLeads.id, etapasIds: [novosLeads.id], recorrencia: { tipo: "DIAS_SEMANA", hora: "09:00", diasSemana: [1, 2, 3, 4, 5], ancora: "AGORA" } },
      grafo: grafoAcoes([{ tipo: "CRIAR_TAREFAS_POR_META", parametros: { meta: 5, interacaoTipo: "LIGACAO", tarefaTipo: "LIGACAO", titulo: "Ligação {{indice}} de {{meta}} — Novos Leads", descricao: "Tentativa operacional do dia {{diaCiclo}} do ciclo de 8 dias úteis. Registre o resultado como interação de ligação no card.", prioridade: "NORMAL", maximoDiasUteisDesdeCriacao: 8 } }]),
    },
    {
      origemChave: "standby_follow_up_semanal", nome: NOMES_AUTOMACOES_MIGRADAS.standbySemanal,
      descricao: "A cada sete dias em Standby, cria uma tarefa de follow-up enquanto o contato não tiver sido interrompido.",
      pipelineId: revisao.id, etapaId: standby.id, gatilhoTipo: "RECORRENCIA_ATINGIDA",
      gatilhoConfig: { origemChave: "standby_follow_up_semanal", escopo: "ETAPAS", etapaId: standby.id, etapasIds: [standby.id], recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 7, ancora: "ENTRADA_ETAPA" } },
      grafo: grafoAcoes([{ tipo: "CRIAR_TAREFA", parametros: { titulo: "Realizar follow-up semanal", descricao: "Contato operacional semanal do card em Standby - Follow Up. Não envia mensagem automaticamente.", tipo: "LIGACAO", prioridade: "NORMAL", prazoMinutos: 0, alertaMinutos: 0, interromperSeCampoPreenchido: "standbyFollowUpInterrompidoEm", registrarExecucaoEmCampo: "standbyFollowUpUltimoEm" } }]),
    },
    {
      origemChave: "monitoramento_mensal", nome: NOMES_AUTOMACOES_MIGRADAS.monitoramentoMensal,
      descricao: "A cada trinta dias em Monitoramento, cria uma tarefa interna de revisão sem contato externo automático.",
      pipelineId: revisao.id, etapaId: monitoramento.id, gatilhoTipo: "RECORRENCIA_ATINGIDA",
      gatilhoConfig: { origemChave: "monitoramento_mensal", escopo: "ETAPAS", etapaId: monitoramento.id, etapasIds: [monitoramento.id], recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 30, ancora: "ENTRADA_ETAPA" } },
      grafo: grafoAcoes([{ tipo: "CRIAR_TAREFA", parametros: { titulo: "Revisar monitoramento", descricao: "Revisão interna automática do card em Monitoramento. Não envia contato externo automaticamente.", tipo: "TAREFA", prioridade: "NORMAL", prazoMinutos: 0, alertaMinutos: 0 } }]),
    },
    {
      origemChave: "google_meet_polling", nome: NOMES_AUTOMACOES_MIGRADAS.transcricaoMeet,
      descricao: "Consulta diariamente o artefato da reunião passada e persiste a transcrição quando ela estiver disponível.",
      pipelineId: revisao.id, etapaId: reuniaoAgendada.id, gatilhoTipo: "RECORRENCIA_ATINGIDA",
      gatilhoConfig: { origemChave: "google_meet_polling", escopo: "ETAPAS", etapaId: reuniaoAgendada.id, etapasIds: [reuniaoAgendada.id], recorrencia: { tipo: "DIARIA", hora: "09:00", ancora: "AGORA" } },
      grafo: grafoAcoes([{ tipo: "SINCRONIZAR_TRANSCRICAO_REUNIAO", parametros: {} }]),
    },
  ];

  for (const pipeline of pipelines) {
    const ancora = pipeline.etapas[0];
    if (!ancora) continue;
    definicoes.push({
      origemChave: `alerta_tarefa:${pipeline.id}`, nome: `Alertas de tarefas — ${pipeline.nome}`,
      descricao: "Marca o alerta de uma tarefa pendente quando o horário configurado é atingido e registra o disparo no histórico do card.",
      pipelineId: pipeline.id, etapaId: ancora.id, gatilhoTipo: "TAREFA_ALERTA_ATINGIDO",
      gatilhoConfig: { origemChave: `alerta_tarefa:${pipeline.id}`, escopo: "GLOBAL_PIPELINE" },
      grafo: grafoAcoes([{ tipo: "MARCAR_ALERTA_TAREFA", parametros: {} }]),
    });
  }
  return definicoes.map((definicao) => ({ ...definicao, gatilhoConfig: gatilhoConfigSchema.parse(definicao.gatilhoConfig), grafo: validarGrafoAutomacao(definicao.grafo) }));
}

export async function automacaoMigradaEstaAtiva(nome: string): Promise<boolean> {
  if (!(db as unknown as { bpmAutomacao?: { findFirst?: unknown } }).bpmAutomacao?.findFirst) {
    if (process.env.NODE_ENV === "test") return false;
    throw new Error("Persistência de automações indisponível");
  }
  return Boolean(await db.bpmAutomacao.findFirst({ where: { nome, ativa: true, versoes: { some: { status: "ATIVA" } } }, select: { id: true } }));
}

export async function automacoesMigradasEstaoAtivas(nomes: readonly string[]): Promise<boolean> {
  const encontradas = await db.bpmAutomacao.count({ where: { nome: { in: [...nomes] }, ativa: true, versoes: { some: { status: "ATIVA" } } } });
  return encontradas === new Set(nomes).size;
}

export async function alertasTarefasForamMigrados(): Promise<boolean> {
  const pipelines = await db.bpmPipeline.count({ where: { etapas: { some: { ativo: true } } } });
  const definicoes = await db.bpmAutomacao.count({ where: { nome: { startsWith: "Alertas de tarefas — " }, ativa: true, versoes: { some: { status: "ATIVA" } } } });
  return pipelines > 0 && definicoes >= pipelines;
}

export async function migrarAutomacoesHardcodedBpm(params: { aplicar: boolean; userId?: number }) {
  const definicoes = await planejarMigracaoAutomacoesHardcodedBpm();
  if (!params.aplicar) return { modo: "PLANO" as const, definicoes, criadas: 0, atualizadas: 0, inalteradas: 0 };
  const userId = params.userId ?? (await db.usuarios.findFirst({ where: { status: "ATIVO", role: { in: ["ADMIN", "SUPER_ADMIN"] } }, orderBy: { id: "asc" }, select: { id: true } }))?.id;
  if (!userId) throw new Error("Informe --user-id de um administrador ativo");
  const resultado = {
    modo: "APLICADO" as const,
    definicoes,
    criadas: 0,
    atualizadas: 0,
    inalteradas: 0,
    automacoesIds: [] as string[],
    versoesAtivasIds: [] as string[],
  };
  for (const definicao of definicoes) {
    const salvo = await db.$transaction(async (tx) => {
      const candidatas = await tx.bpmAutomacao.findMany({ where: { pipelineId: definicao.pipelineId }, include: { versoes: { where: { status: "ATIVA" }, orderBy: { versao: "desc" }, take: 1 } } });
      const existente = candidatas.find((item) => { try { return item.versoes.some((versao) => JSON.parse(versao.gatilhoConfigJson).origemChave === definicao.origemChave); } catch { return false; } }) ?? null;
      const gatilhoConfigJson = JSON.stringify(definicao.gatilhoConfig);
      const grafoJson = JSON.stringify(definicao.grafo);
      const atual = existente?.versoes[0];
      if (existente && atual && existente.nome === definicao.nome && existente.descricao === definicao.descricao && atual.gatilhoTipo === definicao.gatilhoTipo && atual.gatilhoConfigJson === gatilhoConfigJson && atual.grafoJson === grafoJson && existente.ativa) return { tipo: "inalterada" as const, automacaoId: existente.id, versaoId: atual.id };
      const primeiraAcao = (definicao.grafo as { nos: Array<{ tipo: string; acaoTipo?: string; parametros?: Record<string, unknown> }> }).nos.find((no) => no.tipo === "ACAO");
      const automacao = existente
        ? await tx.bpmAutomacao.update({ where: { id: existente.id }, data: { nome: definicao.nome, descricao: definicao.descricao, pipelineId: definicao.pipelineId, etapaId: definicao.etapaId, gatilhoTipo: definicao.gatilhoTipo, tempoMinutos: null, acaoTipo: primeiraAcao?.acaoTipo ?? "SEM_ACAO", parametrosJson: JSON.stringify(primeiraAcao?.parametros ?? {}), ativa: false } })
        : await tx.bpmAutomacao.create({ data: { nome: definicao.nome, descricao: definicao.descricao, pipelineId: definicao.pipelineId, etapaId: definicao.etapaId, gatilhoTipo: definicao.gatilhoTipo, acaoTipo: primeiraAcao?.acaoTipo ?? "SEM_ACAO", parametrosJson: JSON.stringify(primeiraAcao?.parametros ?? {}), ativa: false, criadoPorId: userId } });
      const ultima = await tx.bpmAutomacaoVersao.aggregate({ where: { automacaoId: automacao.id }, _max: { versao: true } });
      await tx.bpmAutomacaoVersao.updateMany({ where: { automacaoId: automacao.id, status: "ATIVA" }, data: { status: "ARQUIVADA", arquivadaEm: new Date() } });
      const versao = await tx.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: (ultima._max.versao ?? 0) + 1, status: "ATIVA", gatilhoTipo: definicao.gatilhoTipo, gatilhoConfigJson, condicaoJson: null, grafoJson, timezone: "America/Sao_Paulo", criadoPorId: userId, ativadaEm: new Date() } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: definicao.pipelineId, adminId: userId, campoAlterado: "AUTOMACAO_HARDCODED_MIGRADA", valorAnteriorJson: existente ? JSON.stringify({ automacaoId: existente.id, versaoId: atual?.id ?? null }) : null, valorNovoJson: JSON.stringify({ automacaoId: automacao.id, versaoId: versao.id, origemChave: definicao.origemChave }) } });
      return { tipo: existente ? "atualizada" as const : "criada" as const, automacaoId: automacao.id, versaoId: versao.id };
    });
    if (salvo.tipo === "criada") resultado.criadas++;
    else if (salvo.tipo === "atualizada") resultado.atualizadas++;
    else resultado.inalteradas++;
    resultado.automacoesIds.push(salvo.automacaoId);
    resultado.versoesAtivasIds.push(salvo.versaoId);
  }
  const idsUnicos = [...new Set(resultado.automacoesIds)];
  if (idsUnicos.length !== definicoes.length) throw new Error("Cutover cancelado: o conjunto preparado de automações está incompleto");
  await db.$transaction(async (tx) => {
    const ativadas = await tx.bpmAutomacao.updateMany({ where: { id: { in: idsUnicos } }, data: { ativa: true } });
    if (ativadas.count !== definicoes.length) throw new Error("Cutover cancelado: nem todas as automações puderam ser ativadas");
  });
  for (const versaoId of resultado.versoesAtivasIds) await sincronizarAgendasVersaoAutomacao(versaoId);
  return resultado;
}
