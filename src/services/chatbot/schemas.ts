import { z } from "zod";

export const chatbotChannelSchema = z.enum([
  "whatsapp", "messenger", "instagram", "tiktok", "telegram", "zalo", "webchat", "email", "api",
]);
export const entityStatusSchema = z.enum(["active", "inactive", "draft", "scheduled", "completed", "paused", "error"]);
export const conversationStatusSchema = z.enum(["open", "pending", "resolved"]);
export const conversationStatusFilterSchema = z.enum(["all", "open", "pending", "resolved"]);
export const chatbotChannelFilterSchema = z.union([z.literal("all"), chatbotChannelSchema]);
export const pageSortSchema = z.enum(["recent", "oldest", "name"]);
export const integrationStatusSchema = z.enum(["connected", "disconnected", "error", "required"]);
export const flowNodeKindSchema = z.enum([
  "sendMessage", "startFlow", "performAction", "condition", "sendMail", "splitTraffic", "wait", "followUp", "landingPage", "addNotes",
]);

export const chatbotIdSchema = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, "Identificador inválido.");
const shortTextSchema = z.string().trim().min(1, "Campo obrigatório.").max(120, "Use no máximo 120 caracteres.");
const descriptionSchema = z.string().trim().max(500, "Use no máximo 500 caracteres.");
const longTextSchema = z.string().trim().min(1, "Campo obrigatório.").max(10_000, "Use no máximo 10.000 caracteres.");
const isoDateSchema = z.string().datetime({ offset: true });
const nonNegativeIntegerSchema = z.number().int().min(0).max(10_000_000);

export const tagSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  color: z.string().trim().min(1).max(32),
}).strict();

export const assigneeSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  initials: z.string().trim().min(1).max(6),
}).strict();

export const pageRequestSchema = z.object({
  page: z.number().int().min(1).max(100_000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(32).optional(),
  channel: chatbotChannelSchema.optional(),
  sort: z.enum(["recent", "oldest", "name"]).optional(),
}).strict();

export const contactPatchSchema = z.object({
  name: shortTextSchema.optional(),
  phone: z.string().trim().max(40, "Use no máximo 40 caracteres.").optional(),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido.").max(254)]).optional(),
  notes: z.string().trim().max(5_000, "Use no máximo 5.000 caracteres.").optional(),
  status: z.enum(["lead", "customer", "blocked"]).optional(),
  assignee: assigneeSchema.optional(),
  tags: z.array(tagSchema).max(30).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Informe ao menos uma alteração.");

export const conversationUpdateSchema = z.object({
  id: chatbotIdSchema,
  patch: z.object({
    status: conversationStatusSchema.optional(),
    assignee: assigneeSchema.optional(),
    tags: z.array(tagSchema).max(30).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, "Informe ao menos uma alteração."),
}).strict();

export const messageBodySchema = z.string().trim().min(1, "Digite uma mensagem.").max(8_000, "A mensagem excede 8.000 caracteres.");
export const messageCreateSchema = z.object({
  conversationId: chatbotIdSchema,
  body: messageBodySchema,
}).strict();

const flowNodeDataSchema = z.object({
  label: shortTextSchema,
  kind: flowNodeKindSchema,
  description: descriptionSchema,
  config: z.record(z.string().max(80), z.string().max(2_000)).refine((value) => Object.keys(value).length <= 30, "Configuração excede 30 propriedades."),
}).strict();

export const flowNodeSchema = z.object({
  id: chatbotIdSchema,
  type: flowNodeKindSchema,
  position: z.object({ x: z.number().finite().min(-100_000).max(100_000), y: z.number().finite().min(-100_000).max(100_000) }).strict(),
  data: flowNodeDataSchema,
}).strict().refine((node) => node.type === node.data.kind, "O tipo do node deve corresponder à configuração.");

export const flowEdgeSchema = z.object({
  id: chatbotIdSchema,
  source: chatbotIdSchema,
  target: chatbotIdSchema,
  label: z.string().trim().max(120).optional(),
}).strict();

export const chatbotFlowSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  description: descriptionSchema,
  status: entityStatusSchema,
  updatedAt: isoDateSchema,
  nodes: z.array(flowNodeSchema).max(250),
  edges: z.array(flowEdgeSchema).max(500),
}).strict();

export const aiAgentSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  description: descriptionSchema,
  instructions: longTextSchema,
  model: shortTextSchema,
  temperature: z.number().finite().min(0).max(1),
  tools: z.array(shortTextSchema).max(30),
  behavior: z.string().trim().max(2_000),
  flowIds: z.array(chatbotIdSchema).max(50),
  channels: z.array(chatbotChannelSchema).max(chatbotChannelSchema.options.length),
  active: z.boolean(),
}).strict();

export const campaignSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  audience: z.string().trim().min(1, "Informe o público.").max(500),
  templateId: chatbotIdSchema,
  channel: chatbotChannelSchema,
  scheduledAt: isoDateSchema.optional(),
  status: entityStatusSchema,
  sent: nonNegativeIntegerSchema,
  delivered: nonNegativeIntegerSchema,
}).strict().refine((value) => value.delivered <= value.sent, { message: "Entregas não podem exceder os envios.", path: ["delivered"] });

export const sequenceStepSchema = z.object({
  id: chatbotIdSchema,
  order: z.number().int().min(1).max(100),
  delay: z.string().trim().min(1, "Informe a espera.").max(60),
  templateId: chatbotIdSchema,
  channel: chatbotChannelSchema,
}).strict();

export const sequenceSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  description: descriptionSchema,
  status: entityStatusSchema,
  contacts: nonNegativeIntegerSchema,
  steps: z.array(sequenceStepSchema).max(100),
  updatedAt: isoDateSchema,
}).strict().refine((value) => value.steps.every((step, index) => step.order === index + 1), { message: "A ordem dos passos deve ser sequencial.", path: ["steps"] });

export const messageTemplateSchema = z.object({
  id: chatbotIdSchema,
  name: shortTextSchema,
  category: z.enum(["marketing", "utility", "support"]),
  channel: chatbotChannelSchema,
  content: longTextSchema,
  status: entityStatusSchema,
  language: z.string().trim().min(2).max(20).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/, "Idioma inválido."),
  updatedAt: isoDateSchema,
}).strict();

export const integrationUpdateSchema = z.object({ id: chatbotIdSchema, status: integrationStatusSchema }).strict();

export const chatbotAvailabilitySchema = z.enum(["online", "away", "offline"]);
export const chatbotDefaultViewSchema = z.enum(["all", "mine"]);
export const chatbotSettingsSchema = z.object({
  availability: chatbotAvailabilitySchema,
  desktopNotifications: z.boolean(),
  sound: z.boolean(),
  autoAssign: z.boolean(),
  compactMode: z.boolean(),
  queueLimit: z.number().int().min(1).max(100),
  defaultView: chatbotDefaultViewSchema,
}).strict();

// Schemas exclusivos dos formulários client-side. Eles validam somente os
// campos editáveis; IDs, métricas e timestamps continuam sendo compostos pela
// camada de UI antes de passar pelos schemas completos acima.
export const contactFormSchema = z.object({
  name: shortTextSchema,
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido.").max(254)]),
  phone: z.string().trim().max(40, "Use no máximo 40 caracteres."),
  notes: z.string().trim().max(5_000, "Use no máximo 5.000 caracteres."),
}).strict();

export const agentFormSchema = z.object({
  name: shortTextSchema,
  description: descriptionSchema,
  instructions: longTextSchema,
  model: shortTextSchema,
  temperature: z.number({ error: "Informe uma temperatura válida." }).finite().min(0, "Mínimo: 0.").max(1, "Máximo: 1."),
  tools: z.string().trim().max(1_000, "Use no máximo 1.000 caracteres."),
  behavior: z.string().trim().max(2_000, "Use no máximo 2.000 caracteres."),
  channels: z.array(chatbotChannelSchema).max(chatbotChannelSchema.options.length),
  flowIds: z.array(chatbotIdSchema).max(50),
}).strict();

export const campaignFormSchema = z.object({
  name: shortTextSchema,
  audience: z.string().trim().min(1, "Informe o público.").max(500),
  templateId: chatbotIdSchema,
  channel: chatbotChannelSchema,
  scheduledAt: z.string().trim().refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Data de agendamento inválida."),
}).strict();

export const sequenceFormSchema = z.object({
  name: shortTextSchema,
  description: descriptionSchema,
}).strict();

export const templateFormSchema = z.object({
  name: shortTextSchema,
  category: z.enum(["marketing", "utility", "support"]),
  channel: chatbotChannelSchema,
  content: longTextSchema,
  language: z.string().trim().min(2, "Informe o idioma.").max(20).regex(/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/, "Idioma inválido."),
}).strict();

export function firstSchemaError(result: z.ZodSafeParseError<unknown>): string {
  return result.error.issues[0]?.message ?? "Dados inválidos.";
}
