import { z } from "zod";

export const BLUEPRINT_STATUS = [
  "IDEA",
  "PRONTO_ESPECIFICACAO",
  "EM_ESPECIFICACAO",
  "PRONTO_DESENVOLVIMENTO",
  "EM_DESENVOLVIMENTO",
  "EM_REVISAO",
  "CONCLUIDO",
  "ARQUIVADO",
] as const;

export const BLUEPRINT_PRIORIDADE = ["BAIXA", "NORMAL", "ALTA", "URGENTE", "CRITICA"] as const;

export const BLUEPRINT_MEMBRO_ROLE = ["PROPRIETARIO", "ADMINISTRADOR", "EDITOR", "COMENTARISTA", "VISUALIZADOR"] as const;

export const BLUEPRINT_REQUISITO_TIPO = [
  "FUNCIONAL",
  "NAO_FUNCIONAL",
  "REGRA_DE_NEGOCIO",
  "INTEGRACAO",
  "PERMISSAO",
  "DESIGN",
  "SEGURANCA",
  "DESEMPENHO",
  "DADO",
  "DUVIDA",
] as const;

export const BLUEPRINT_REQUISITO_STATUS = [
  "RASCUNHO",
  "PENDENTE",
  "EM_VALIDACAO",
  "APROVADO",
  "EM_DESENVOLVIMENTO",
  "CONCLUIDO",
  "DESCARTADO",
] as const;

export const BLUEPRINT_PERGUNTA_STATUS = ["ABERTA", "RESPONDIDA", "RESOLVIDA", "DESCARTADA"] as const;

const MAX_TAGS = 20;
const MAX_TAG_LEN = 40;

const tagsSchema = z.array(z.string().trim().min(1).max(MAX_TAG_LEN)).max(MAX_TAGS).optional();

export const criarProjetoSchema = z.object({
  title: z.string().trim().min(1, "Nome do sistema é obrigatório").max(200),
  summary: z.string().trim().max(2000).optional(),
  problem: z.string().trim().max(4000).optional(),
  setor: z.string().trim().max(60).optional(),
  requesterId: z.number().int().positive(),
  ownerId: z.number().int().positive().optional(),
  developerId: z.number().int().positive().optional(),
  priority: z.enum(BLUEPRINT_PRIORIDADE).default("NORMAL"),
  dueDate: z.coerce.date().optional(),
  status: z.enum(BLUEPRINT_STATUS).default("IDEA"),
  tags: tagsSchema,
  membrosIds: z.array(z.number().int().positive()).max(50).optional(),
  relatedProjectId: z.string().cuid().optional(),
});

export const atualizarProjetoSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  problem: z.string().trim().max(4000).nullable().optional(),
  objective: z.string().trim().max(4000).nullable().optional(),
  setor: z.string().trim().max(60).nullable().optional(),
  ownerId: z.number().int().positive().nullable().optional(),
  developerId: z.number().int().positive().nullable().optional(),
  priority: z.enum(BLUEPRINT_PRIORIDADE).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  icon: z.string().trim().max(60).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  tags: tagsSchema,
});

export const moverProjetoSchema = z.object({
  projectId: z.string().cuid(),
  novoStatus: z.enum(BLUEPRINT_STATUS),
  justificativa: z.string().trim().max(1000).optional(),
});

export const paginacaoProjetosSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(30),
  busca: z.string().trim().max(200).optional(),
  status: z.enum(BLUEPRINT_STATUS).optional(),
  priority: z.enum(BLUEPRINT_PRIORIDADE).optional(),
  setor: z.string().trim().max(60).optional(),
  responsavelId: z.number().int().positive().optional(),
  incluirArquivados: z.boolean().default(false),
});

// ── Documento (editor rico) ──────────────────────────────────────────────────

const MAX_CONTENT_JSON_BYTES = 2 * 1024 * 1024; // 2MB

export const salvarDocumentoSchema = z.object({
  projectId: z.string().cuid(),
  documentId: z.string().cuid().optional(),
  title: z.string().trim().min(1).max(200).default("Especificação"),
  contentJson: z.string().max(MAX_CONTENT_JSON_BYTES, "Documento excede o tamanho máximo permitido"),
  contentText: z.string().max(500_000).optional(),
});

// ── Board / Canvas ───────────────────────────────────────────────────────────

const MAX_ELEMENTS_JSON_BYTES = 2 * 1024 * 1024; // 2MB

export const salvarBoardSchema = z.object({
  projectId: z.string().cuid(),
  boardId: z.string().cuid().optional(),
  title: z.string().trim().min(1).max(200).default("Canvas Principal"),
  viewportJson: z.string().max(10_000).optional(),
  elementsJson: z.string().max(MAX_ELEMENTS_JSON_BYTES, "Canvas excede o tamanho máximo permitido"),
  version: z.number().int().positive().optional(),
});

// ── Arquivos ──────────────────────────────────────────────────────────────────

export const BLUEPRINT_ALLOWED_MIME_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "text/markdown",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/mpeg", "audio/wav", "audio/ogg",
  "application/zip", "application/x-zip-compressed",
] as const;

export const BLUEPRINT_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB, mesmo limite do upload do Bibble

export const registrarArquivoSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().trim().min(1).max(255),
  originalName: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(60).optional(),
  mimeType: z.string().refine((m) => (BLUEPRINT_ALLOWED_MIME_TYPES as readonly string[]).includes(m), {
    message: "Tipo de arquivo não permitido",
  }),
  size: z.number().int().positive().max(BLUEPRINT_MAX_FILE_SIZE),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
});

// ── Requisitos ────────────────────────────────────────────────────────────────

export const criarRequisitoSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  type: z.enum(BLUEPRINT_REQUISITO_TIPO),
  priority: z.enum(BLUEPRINT_PRIORIDADE).default("NORMAL"),
  acceptanceCriteria: z.string().trim().max(4000).optional(),
  sourceType: z.string().trim().max(40).optional(),
  sourceId: z.string().trim().max(60).optional(),
  assigneeId: z.number().int().positive().optional(),
});

export const atualizarRequisitoSchema = z.object({
  requirementId: z.string().cuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(BLUEPRINT_REQUISITO_STATUS).optional(),
  priority: z.enum(BLUEPRINT_PRIORIDADE).optional(),
  acceptanceCriteria: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
});

// ── Perguntas ─────────────────────────────────────────────────────────────────

export const criarPerguntaSchema = z.object({
  projectId: z.string().cuid(),
  question: z.string().trim().min(1).max(2000),
  assignedToId: z.number().int().positive().optional(),
  priority: z.enum(BLUEPRINT_PRIORIDADE).default("NORMAL"),
  sourceType: z.string().trim().max(40).optional(),
  sourceId: z.string().trim().max(60).optional(),
});

export const responderPerguntaSchema = z.object({
  questionId: z.string().cuid(),
  answer: z.string().trim().min(1).max(4000),
});

// ── Comentários ───────────────────────────────────────────────────────────────

export const criarComentarioSchema = z.object({
  projectId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  targetType: z.enum(["PROJETO", "DOCUMENTO", "REQUISITO", "ARQUIVO", "CANVAS_ELEMENTO", "PERGUNTA"]),
  targetId: z.string().trim().max(60).optional(),
  content: z.string().trim().min(1).max(4000),
});

// ── Membros ───────────────────────────────────────────────────────────────────

export const adicionarMembroSchema = z.object({
  projectId: z.string().cuid(),
  userId: z.number().int().positive(),
  role: z.enum(BLUEPRINT_MEMBRO_ROLE).default("VISUALIZADOR"),
});

export const atualizarMembroRoleSchema = z.object({
  memberId: z.string().cuid(),
  role: z.enum(BLUEPRINT_MEMBRO_ROLE),
});
