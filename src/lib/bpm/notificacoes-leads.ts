import { z } from "zod";

export const BPM_LEAD_ALERTA_EVENT = "bpm-leads-atualizados";
const identidade = z.string().min(1).max(200);
export const responsavelPipelineBpmSchema = z.object({
  pipelineId: identidade, pipelineNome: z.string(), setor: z.enum(["COMERCIAL", "FINANCEIRO", "OPERACIONAL"]),
  usuarioId: z.number().int().positive(), nome: z.string(),
}).strict();
export type ResponsavelPipelineBpm = z.infer<typeof responsavelPipelineBpmSchema>;
export const destinoAlertaLeadBpmSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("LEAD_VIRTUAL"), pipelineId: identidade, origemLead: z.enum(["instagram", "noloss"]), leadId: identidade }).strict(),
  z.object({ tipo: z.literal("CARD"), pipelineId: identidade, cardId: identidade, recepcaoId: identidade }).strict(),
]);
export type DestinoAlertaLeadBpm = z.infer<typeof destinoAlertaLeadBpmSchema>;
export const recebimentoPipelineBpmSchema = z.object({
  recepcaoId: identidade, status: z.enum(["PENDENTE", "ASSUMIDO"]), recebidoEm: z.string().datetime(),
  podeAssumir: z.boolean(), assumidoEm: z.string().datetime().nullable(), assumidoPor: responsavelPipelineBpmSchema.nullable(),
  responsaveisAnteriores: z.array(responsavelPipelineBpmSchema), motivoImpedimentoAssuncao: z.string().nullable(),
}).strict();
export type RecebimentoPipelineBpm = z.infer<typeof recebimentoPipelineBpmSchema>;
export const alertaLeadBpmSchema = z.object({
  id: z.string().min(1).max(800), tipo: z.literal("LEAD_SEM_RESPONSAVEL"),
  fonte: z.enum(["INSTAGRAM", "NOLOSS", "ENCAMINHAMENTO"]), origem: z.enum(["INSTAGRAM", "SITE", "OUTRA"]),
  pipelineId: identidade, pipelineNome: z.string(), etapaId: identidade, etapaNome: z.string(),
  nome: z.string(), email: z.string().nullable(), telefone: z.string().nullable(), cnpj: z.string().nullable(),
  resumo: z.string().nullable(), recebidoEm: z.string().datetime(), destino: destinoAlertaLeadBpmSchema,
  responsaveisAnteriores: z.array(responsavelPipelineBpmSchema),
}).strict();
export type AlertaLeadBpm = z.infer<typeof alertaLeadBpmSchema>;
export const paginaAlertasLeadsBpmSchema = z.object({
  alertas: z.array(alertaLeadBpmSchema), proximoCursor: z.string().nullable(), snapshotEm: z.string().datetime(),
}).strict();
export type PaginaAlertasLeadsBpm = z.infer<typeof paginaAlertasLeadsBpmSchema>;

export function urlLeadAlertaBpm(alerta: Pick<AlertaLeadBpm, "destino">): string {
  const destino = alerta.destino;
  const base = `/PainelAlpha/AlphaCRM/pipeline/${encodeURIComponent(destino.pipelineId)}`;
  return destino.tipo === "LEAD_VIRTUAL"
    ? `${base}?origemLead=${destino.origemLead}&leadId=${encodeURIComponent(destino.leadId)}`
    : `${base}?cardId=${encodeURIComponent(destino.cardId)}&recepcaoId=${encodeURIComponent(destino.recepcaoId)}`;
}

export function detalhesAlertaLeadBpm(alerta: AlertaLeadBpm): string {
  const origem = alerta.origem === "INSTAGRAM" ? "Instagram" : alerta.origem === "SITE" ? "Site" : "Outra origem";
  const chegada = new Date(alerta.recebidoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return [origem, `Chegada: ${chegada} (Brasília)`, `${alerta.pipelineNome} · ${alerta.etapaNome}`, "Ninguém assumiu este lead.",
    alerta.email, alerta.telefone, alerta.cnpj ? `CNPJ: ${alerta.cnpj}` : null, alerta.resumo,
    ...alerta.responsaveisAnteriores.map((responsavel) => `Responsável no ${responsavel.pipelineNome}: ${responsavel.nome}`),
  ].filter(Boolean).join("\n");
}
