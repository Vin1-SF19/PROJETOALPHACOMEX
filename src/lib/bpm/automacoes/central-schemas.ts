import { z } from "zod";

import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { validarParametrosAutomacaoBpm, type AcaoAutomacaoBpm } from "./schemas";

export const TIPOS_EVENTO_AUTOMACAO = [
  "CARD_CRIADO", "CARD_ATUALIZADO", "CARD_MOVIDO", "ENTRAR_COLUNA", "SAIR_COLUNA",
  "CAMPO_ALTERADO", "CAMPO_VALOR_ASSUMIDO", "RESPONSAVEL_ATRIBUIDO", "MEMBROS_ATUALIZADOS",
  "TAREFA_CRIADA", "TAREFA_CONCLUIDA", "TAREFA_PRAZO_ATINGIDO", "VINCULO_CRIADO",
  "TEMPO_NA_ETAPA_ATINGIDO", "RECORRENCIA_ATINGIDA", "WEBHOOK_RECEBIDO",
  "CHAMADA_EXTERNA_CONCLUIDA", "SLA_STATUS_ALTERADO",
  "PROCESSO_DEFERIDO", "TAREFA_ALERTA_ATINGIDO", "CADENCIA_INICIADA",
] as const;

export const TIPOS_ACAO_CENTRAL = [
  "ALTERAR_CAMPO", "MOVER_CARD", "ALTERAR_SUBSTATUS", "CRIAR_TAREFA", "CRIAR_SLA",
  "CRIAR_ALERTA", "ADICIONAR_ANOTACAO", "CRIAR_CARD_OUTRO_PIPELINE",
  "ATUALIZAR_CARD_RELACIONADO", "ATRIBUIR_RESPONSAVEL", "COMUNICACAO_EXISTENTE", "HTTP", "WEBHOOK",
  "ENVIAR_EMAIL", "GERAR_CONTRATO", "GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "DISTRIBUIR_RESPONSAVEL", "IDENTIFICAR_OPORTUNIDADE",
  "CRIAR_TAREFAS_POR_META", "MARCAR_ALERTA_TAREFA", "SINCRONIZAR_TRANSCRICAO_REUNIAO",
] as const;

export const gatilhoConfigSchema = z.object({
  escopo: z.enum(["ETAPAS", "GLOBAL_PIPELINE"]).default("ETAPAS"),
  origemChave: z.string().trim().min(1).max(160).optional(),
  etapaId: z.string().cuid().optional(),
  etapasIds: z.array(z.string().cuid()).max(100).optional(),
  campoId: z.string().cuid().optional(),
  valor: z.union([z.string().max(4_000), z.number(), z.boolean(), z.null()]).optional(),
  tipoTarefa: z.string().trim().max(80).optional(),
  webhookEndpointId: z.string().cuid().optional(),
  minutos: z.number().int().min(1).max(525_600).optional(),
  tempo: z.object({
    quantidade: z.number().int().min(1).max(525_600),
    unidade: z.enum(["MINUTOS", "DIAS_CORRIDOS", "DIAS_UTEIS"]),
    ancora: z.enum(["CRIACAO_CARD", "ENTRADA_ETAPA"]).default("ENTRADA_ETAPA"),
  }).strict().optional(),
  slaStatus: z.enum([
    "DENTRO_PRAZO", "PROXIMO_VENCIMENTO", "ATRASADO", "PAUSADO", "CONCLUIDO",
  ]).optional(),
  recorrencia: z.object({
    tipo: z.enum(["INTERVALO_HORAS", "INTERVALO_DIAS", "DIARIA", "SEMANAL", "DIAS_SEMANA"]),
    intervaloHoras: z.number().int().min(1).max(8_760).optional(),
    intervaloDias: z.number().int().min(1).max(3_650).optional(),
    hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    ancora: z.enum(["AGORA", "ENTRADA_ETAPA"]).default("AGORA"),
    ate: z.string().datetime().optional(),
  }).strict().optional(),
}).strict();

const alterarCampoSchema = z.object({ campoId: z.string().cuid(), valor: z.union([z.string().max(20_000), z.number(), z.boolean(), z.null()]) }).strict();
const moverCardSchema = z.object({
  etapaId: z.string().cuid(),
  validarRequisitos: z.boolean().default(true),
  exigirProximoContatoVazio: z.boolean().default(false),
}).strict();
const alterarSubstatusSchema = z.object({ subStatusId: z.string().cuid() }).strict();
const criarTarefaSchema = z.object({
  titulo: z.string().trim().min(1).max(200), descricao: z.string().max(4_000).optional(),
  responsavelId: z.number().int().positive().optional(), prazoMinutos: z.number().int().min(0).max(525_600).optional(),
  tipo: z.string().trim().min(1).max(80).default("TAREFA"), prioridade: z.enum(["BAIXA", "NORMAL", "ALTA"]).default("NORMAL"),
  alertaMinutos: z.number().int().min(0).max(525_600).optional(),
  naoDuplicarPendenteTipo: z.boolean().default(false),
  interromperSeCampoPreenchido: z.enum(["standbyFollowUpInterrompidoEm", "proximoContatoEm"]).optional(),
  registrarExecucaoEmCampo: z.enum(["standbyFollowUpUltimoEm"]).optional(),
}).strict();
const criarSlaSchema = z.object({ slaConfigId: z.string().cuid() }).strict();
const textoSchema = z.object({ texto: z.string().trim().min(1).max(8_000) }).strict();
const criarCardSchema = z.object({
  pipelineId: z.string().cuid(), etapaId: z.string().cuid(), responsavelId: z.number().int().positive().optional(),
  servico: z.string().trim().max(200).optional(), vincularAoOriginal: z.boolean().default(true),
  somenteSeNaoExistirAtivo: z.boolean().default(false),
}).strict();
const atualizarRelacionadoSchema = z.object({
  direcao: z.enum(["ORIGEM", "DESTINO", "TODOS"]).default("TODOS"),
  campoId: z.string().cuid().optional(), valor: z.union([z.string().max(20_000), z.number(), z.boolean(), z.null()]).optional(),
  etapaId: z.string().cuid().optional(), responsavelId: z.number().int().positive().optional(),
}).strict().refine((v) => Boolean(v.campoId || v.etapaId || v.responsavelId), "Informe uma atualização");
const responsavelSchema = z.object({ responsavelId: z.number().int().positive() }).strict();
const comunicacaoSchema = z.object({
  canal: z.enum(["EMAIL", "WHATSAPP", "INTEGRACAO_EXISTENTE"]), templateId: z.string().trim().max(200).optional(),
  mensagem: z.string().trim().min(1).max(8_000), destinatario: z.string().trim().max(320).optional(),
}).strict();
const criarTarefasPorMetaSchema = z.object({
  meta: z.number().int().min(1).max(100),
  interacaoTipo: z.string().trim().min(1).max(80),
  tarefaTipo: z.string().trim().min(1).max(80),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().max(4_000).optional(),
  prioridade: z.enum(["BAIXA", "NORMAL", "ALTA"]).default("NORMAL"),
  maximoDiasUteisDesdeCriacao: z.number().int().min(1).max(365).optional(),
}).strict();
const semParametrosSchema = z.object({}).strict();
export const chamadaHttpSchema = z.object({
  url: z.string().url().max(2_000), metodo: z.enum(["GET", "POST", "PUT", "PATCH"]),
  headers: z.record(z.string().trim().max(80), z.string().max(2_000)).default({}),
  corpo: z.unknown().optional(), timeoutMs: z.number().int().min(500).max(15_000).default(10_000),
}).strict().refine((valor) => new URL(valor.url).protocol === "https:", { path: ["url"], message: "Somente HTTPS é permitido" });

const parametrosPorAcao = {
  ALTERAR_CAMPO: alterarCampoSchema,
  MOVER_CARD: moverCardSchema,
  ALTERAR_SUBSTATUS: alterarSubstatusSchema,
  CRIAR_TAREFA: criarTarefaSchema,
  CRIAR_SLA: criarSlaSchema,
  CRIAR_ALERTA: textoSchema,
  ADICIONAR_ANOTACAO: textoSchema,
  CRIAR_CARD_OUTRO_PIPELINE: criarCardSchema,
  ATUALIZAR_CARD_RELACIONADO: atualizarRelacionadoSchema,
  ATRIBUIR_RESPONSAVEL: responsavelSchema,
  COMUNICACAO_EXISTENTE: comunicacaoSchema,
  CRIAR_TAREFAS_POR_META: criarTarefasPorMetaSchema,
  MARCAR_ALERTA_TAREFA: semParametrosSchema,
  SINCRONIZAR_TRANSCRICAO_REUNIAO: semParametrosSchema,
  HTTP: chamadaHttpSchema,
  WEBHOOK: chamadaHttpSchema,
} satisfies Record<Exclude<(typeof TIPOS_ACAO_CENTRAL)[number], AcaoAutomacaoBpm>, z.ZodType>;

const noAcaoSchema = z.object({
  id: z.string().trim().min(1).max(100), tipo: z.literal("ACAO"), acaoTipo: z.enum(TIPOS_ACAO_CENTRAL),
  parametros: z.record(z.string(), z.unknown()), proximoId: z.string().trim().min(1).max(100).optional(),
}).strict();
const noCondicaoSchema = z.object({
  id: z.string().trim().min(1).max(100), tipo: z.literal("CONDICAO"), condicao: grupoCondicaoSchema,
  entaoId: z.string().trim().min(1).max(100), senaoId: z.string().trim().min(1).max(100),
}).strict();
const noEsperaSchema = z.object({
  id: z.string().trim().min(1).max(100), tipo: z.literal("ESPERA"), minutos: z.number().int().min(1).max(525_600),
  proximoId: z.string().trim().min(1).max(100),
}).strict();
const noFimSchema = z.object({ id: z.string().trim().min(1).max(100), tipo: z.literal("FIM") }).strict();
export const noAutomacaoSchema = z.discriminatedUnion("tipo", [noAcaoSchema, noCondicaoSchema, noEsperaSchema, noFimSchema]);
export const grafoAutomacaoSchema = z.object({ inicioId: z.string().trim().min(1).max(100), nos: z.array(noAutomacaoSchema).min(1).max(100) }).strict();

export type GrafoAutomacao = z.infer<typeof grafoAutomacaoSchema>;
export type NoAutomacao = z.infer<typeof noAutomacaoSchema>;
export type TipoAcaoCentral = (typeof TIPOS_ACAO_CENTRAL)[number];
export type TipoEventoAutomacao = (typeof TIPOS_EVENTO_AUTOMACAO)[number];

export function validarParametrosAcaoCentral(tipo: TipoAcaoCentral, valor: unknown) {
  if (["ENVIAR_EMAIL", "GERAR_CONTRATO", "GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "DISTRIBUIR_RESPONSAVEL", "IDENTIFICAR_OPORTUNIDADE"].includes(tipo)) {
    return validarParametrosAutomacaoBpm(tipo as AcaoAutomacaoBpm, valor) as Record<string, unknown>;
  }
  return parametrosPorAcao[tipo as keyof typeof parametrosPorAcao].parse(valor) as Record<string, unknown>;
}

export function validarGrafoAutomacao(valor: unknown): GrafoAutomacao {
  const grafo = grafoAutomacaoSchema.parse(valor);
  const ids = new Set<string>();
  for (const no of grafo.nos) {
    if (ids.has(no.id)) throw new Error(`Nó duplicado: ${no.id}`);
    ids.add(no.id);
    if (no.tipo === "ACAO") validarParametrosAcaoCentral(no.acaoTipo, no.parametros);
  }
  if (!ids.has(grafo.inicioId)) throw new Error("Nó inicial inexistente");
  const destinos = (no: NoAutomacao): string[] => no.tipo === "CONDICAO"
    ? [no.entaoId, no.senaoId]
    : no.tipo === "ACAO" ? (no.proximoId ? [no.proximoId] : [])
      : no.tipo === "ESPERA" ? [no.proximoId] : [];
  for (const no of grafo.nos) for (const alvo of destinos(no)) if (!ids.has(alvo)) throw new Error(`Referência inexistente: ${no.id} → ${alvo}`);
  const porId = new Map(grafo.nos.map((no) => [no.id, no]));
  const visitando = new Set<string>();
  const visitados = new Set<string>();
  const visitar = (id: string) => {
    if (visitando.has(id)) throw new Error("O grafo precisa ser acíclico");
    if (visitados.has(id)) return;
    visitando.add(id);
    for (const alvo of destinos(porId.get(id)!)) visitar(alvo);
    visitando.delete(id); visitados.add(id);
  };
  visitar(grafo.inicioId);
  const inacessiveis = grafo.nos.filter((no) => !visitados.has(no.id)).map((no) => no.id);
  if (inacessiveis.length) throw new Error(`Nós inacessíveis: ${inacessiveis.join(", ")}`);
  return grafo;
}

export const eventoDominioInputSchema = z.object({
  tipo: z.enum(TIPOS_EVENTO_AUTOMACAO), entidadeTipo: z.enum(["CARD", "CAMPO", "TAREFA", "MEMBRO", "VINCULO", "WEBHOOK", "SLA", "SISTEMA"]),
  entidadeId: z.string().trim().min(1).max(200), cardId: z.string().cuid().optional(), pipelineId: z.string().cuid().optional(),
  valorAnterior: z.unknown().optional(), valorNovo: z.unknown().optional(), atorTipo: z.enum(["USUARIO", "AUTOMACAO", "SISTEMA", "WEBHOOK"]),
  atorUserId: z.number().int().positive().optional(), atorExecucaoId: z.string().cuid().optional(), correlationId: z.string().trim().min(1).max(200),
  causationId: z.string().trim().max(200).optional(), profundidade: z.number().int().min(0).max(10).default(0),
  idempotencyKey: z.string().trim().min(1).max(300), ocorridoEm: z.date().optional(),
}).strict();

export const salvarVersaoAutomacaoSchema = z.object({
  automacaoId: z.string().cuid(), gatilhoTipo: z.enum(TIPOS_EVENTO_AUTOMACAO), gatilhoConfig: gatilhoConfigSchema.default({ escopo: "ETAPAS" }),
  condicao: grupoCondicaoSchema.nullable().optional(), grafo: grafoAutomacaoSchema, timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
}).strict();
