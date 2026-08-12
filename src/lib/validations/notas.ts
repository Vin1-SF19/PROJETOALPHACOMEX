import { z } from "zod";

export const VISIBILIDADE_NOTA = ["PRIVADA", "COMPARTILHADA", "EQUIPE", "INSTITUCIONAL"] as const;
export type VisibilidadeNota = (typeof VISIBILIDADE_NOTA)[number];

export const STATUS_NOTA = ["RASCUNHO", "ATIVA", "ARQUIVADA", "LIXEIRA"] as const;
export type StatusNota = (typeof STATUS_NOTA)[number];

export const SUBJECT_TYPE_PERMISSAO = ["USUARIO", "SETOR", "ROLE"] as const;
export type SubjectTypePermissao = (typeof SUBJECT_TYPE_PERMISSAO)[number];

export const ROLE_PERMISSAO_NOTA = ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"] as const;
export type RolePermissaoNota = (typeof ROLE_PERMISSAO_NOTA)[number];

export const MAX_MEMBROS_EQUIPE_NOTA = 50;

const membroEquipeNotaSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(ROLE_PERMISSAO_NOTA).default("LEITOR"),
});

const membrosEquipeNotaSchema = z
  .array(membroEquipeNotaSchema)
  .max(MAX_MEMBROS_EQUIPE_NOTA, `Adicione no máximo ${MAX_MEMBROS_EQUIPE_NOTA} membros por vez`)
  .superRefine((membros, ctx) => {
    const ids = new Set<number>();
    membros.forEach((membro, index) => {
      if (ids.has(membro.userId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "userId"],
          message: "Usuário duplicado na equipe",
        });
      }
      ids.add(membro.userId);
    });
  });

export const criarEquipeNotaSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com ao menos 2 caracteres").max(80),
  members: membrosEquipeNotaSchema.default([]),
});
export type CriarEquipeNotaInput = z.infer<typeof criarEquipeNotaSchema>;

export const renomearEquipeNotaSchema = z.object({
  teamId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Informe um nome com ao menos 2 caracteres").max(80),
});
export type RenomearEquipeNotaInput = z.infer<typeof renomearEquipeNotaSchema>;

export const adicionarMembrosEquipeNotaSchema = z.object({
  teamId: z.string().trim().min(1),
  members: membrosEquipeNotaSchema.min(1, "Selecione ao menos um usuário"),
});
export type AdicionarMembrosEquipeNotaInput = z.infer<typeof adicionarMembrosEquipeNotaSchema>;

export const alterarPapelMembroEquipeNotaSchema = z.object({
  teamId: z.string().trim().min(1),
  userId: z.number().int().positive(),
  role: z.enum(ROLE_PERMISSAO_NOTA),
});
export type AlterarPapelMembroEquipeNotaInput = z.infer<typeof alterarPapelMembroEquipeNotaSchema>;

export const membroEquipeNotaAlvoSchema = z.object({
  teamId: z.string().trim().min(1),
  userId: z.number().int().positive(),
});
export type MembroEquipeNotaAlvoInput = z.infer<typeof membroEquipeNotaAlvoSchema>;

export const equipeNotaAlvoSchema = z.object({ teamId: z.string().trim().min(1) });
export type EquipeNotaAlvoInput = z.infer<typeof equipeNotaAlvoSchema>;

export const compartilharNotaComEquipeSchema = z.object({
  noteId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
});
export type CompartilharNotaComEquipeInput = z.infer<typeof compartilharNotaComEquipeSchema>;

export const removerCompartilhamentoEquipeSchema = z.object({ shareId: z.string().trim().min(1) });
export type RemoverCompartilhamentoEquipeInput = z.infer<typeof removerCompartilhamentoEquipeSchema>;

export const VIEWER_MODE = ["RECOLHIDO", "COMPACTO", "EXPANDIDO", "TELA_AMPLA"] as const;
export type ViewerMode = (typeof VIEWER_MODE)[number];

export const criarNotaSchema = z.object({
  title: z.string().trim().max(200).default(""),
  contentJson: z.unknown(),
  plainText: z.string().max(200_000).default(""),
  visibility: z.enum(VISIBILIDADE_NOTA).default("PRIVADA"),
  color: z.string().trim().max(30).nullish(),
  icon: z.string().trim().max(60).nullish(),
  contexto: z
    .object({
      moduleKey: z.string().trim().min(1).max(60),
      entityType: z.string().trim().min(1).max(60),
      entityId: z.string().trim().min(1).max(120),
      displayName: z.string().trim().min(1).max(200),
      internalPath: z.string().trim().min(1).max(300),
      metadata: z.unknown().optional(),
    })
    .optional(),
});
export type CriarNotaInput = z.infer<typeof criarNotaSchema>;

export const atualizarNotaSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  titleEditadoManualmente: z.boolean().optional(),
  contentJson: z.unknown().optional(),
  plainText: z.string().max(200_000).optional(),
  color: z.string().trim().max(30).nullish(),
  icon: z.string().trim().max(60).nullish(),
  isFavorite: z.boolean().optional(),
  /** Versão que o client tinha ao carregar — base do controle de conflito otimista. */
  baseVersion: z.number().int().min(1),
});
export type AtualizarNotaInput = z.infer<typeof atualizarNotaSchema>;

export const listarNotasSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  busca: z.string().trim().max(200).optional(),
  status: z.enum(STATUS_NOTA).optional(),
  visibility: z.enum(VISIBILIDADE_NOTA).optional(),
  moduleKey: z.string().trim().max(60).optional(),
  apenasFavoritas: z.boolean().optional(),
  apenasFixadas: z.boolean().optional(),
});
export type ListarNotasInput = z.infer<typeof listarNotasSchema>;

export const vincularContextoSchema = z.object({
  noteId: z.string().min(1),
  moduleKey: z.string().trim().min(1).max(60),
  entityType: z.string().trim().min(1).max(60),
  entityId: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(200),
  internalPath: z.string().trim().min(1).max(300),
  metadata: z.unknown().optional(),
});
export type VincularContextoInput = z.infer<typeof vincularContextoSchema>;

export const removerContextoSchema = z.object({
  contextId: z.string().min(1),
});
export type RemoverContextoInput = z.infer<typeof removerContextoSchema>;

export const compartilharNotaSchema = z.object({
  noteId: z.string().min(1),
  subjectType: z.enum(SUBJECT_TYPE_PERMISSAO),
  subjectId: z.string().trim().min(1).max(120),
  role: z.enum(ROLE_PERMISSAO_NOTA),
});
export type CompartilharNotaInput = z.infer<typeof compartilharNotaSchema>;

export const removerAcessoNotaSchema = z.object({
  permissionId: z.string().min(1),
});
export type RemoverAcessoNotaInput = z.infer<typeof removerAcessoNotaSchema>;

export const atualizarWorkspaceSchema = z.object({
  isTaskbarVisible: z.boolean().optional(),
  viewerMode: z.enum(VIEWER_MODE).optional(),
  viewerHeight: z.number().int().min(120).max(1200).optional(),
  activeNoteId: z.string().nullish(),
});
export type AtualizarWorkspaceInput = z.infer<typeof atualizarWorkspaceSchema>;

export const abrirAbaNotaSchema = z.object({
  noteId: z.string().min(1),
});
export type AbrirAbaNotaInput = z.infer<typeof abrirAbaNotaSchema>;

export const reordenarAbasNotasSchema = z.object({
  ordemNoteIds: z.array(z.string().min(1)).min(1).max(50),
});
export type ReordenarAbasNotasInput = z.infer<typeof reordenarAbasNotasSchema>;

export const SECAO_CENTRAL_NOTAS = [
  "RECENTES",
  "FAVORITAS",
  "FIXADAS",
  "COMPARTILHADAS_COMIGO",
  "CRIADAS_POR_MIM",
  "EQUIPE",
  "CONTEXTUAIS",
  "ARQUIVADAS",
  "LIXEIRA",
] as const;
export type SecaoCentralNotas = (typeof SECAO_CENTRAL_NOTAS)[number];

export const ORDENACAO_NOTAS = ["ATUALIZACAO", "CRIACAO", "TITULO"] as const;
export type OrdenacaoNotas = (typeof ORDENACAO_NOTAS)[number];

export const buscarNotasSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).optional(),
  secao: z.enum(SECAO_CENTRAL_NOTAS).default("RECENTES"),
  ordenarPor: z.enum(ORDENACAO_NOTAS).default("ATUALIZACAO"),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  teamId: z.string().trim().min(1).optional(),
  moduleKey: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(60).optional(),
  comChecklistPendente: z.boolean().optional(),
  comAnexos: z.boolean().optional(),
});
export type BuscarNotasInput = z.infer<typeof buscarNotasSchema>;

export const fixarNotaSchema = z.object({
  noteId: z.string().min(1),
  fixada: z.boolean(),
});
export type FixarNotaInput = z.infer<typeof fixarNotaSchema>;

export const favoritarNotaSchema = z.object({
  noteId: z.string().min(1),
  favorita: z.boolean(),
});
export type FavoritarNotaInput = z.infer<typeof favoritarNotaSchema>;

export const definirCorNotaSchema = z.object({
  noteId: z.string().min(1),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser um hex válido, ex: #f59e0b")
    .nullable(),
});
export type DefinirCorNotaInput = z.infer<typeof definirCorNotaSchema>;

export const criarTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(30),
});
export type CriarTagInput = z.infer<typeof criarTagSchema>;

export const aplicarTagSchema = z.object({
  noteId: z.string().min(1),
  tagId: z.string().min(1),
});
export type AplicarTagInput = z.infer<typeof aplicarTagSchema>;

export const excluirNotasDefinitivamenteSchema = z.object({
  noteIds: z
    .array(z.string().trim().min(1))
    .min(1, "Selecione ao menos uma nota")
    .max(100, "Selecione no máximo 100 notas por vez")
    .transform((ids) => [...new Set(ids)]),
});
export type ExcluirNotasDefinitivamenteInput = z.infer<typeof excluirNotasDefinitivamenteSchema>;

export const NOTAS_ANEXO_MAX_SIZE = 25 * 1024 * 1024; // 25MB

export const NOTAS_ANEXO_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

/**
 * `storageKey` DEVE ser uma URL real do Vercel Blob — nunca uma string livre. Sem esta
 * validação, `RegistrarAnexoNota` (chamável diretamente, sem passar pelo upload real) aceitaria
 * qualquer URL, e a rota de download (`/api/notas/anexos/[id]`) faria `fetch()` dela sem
 * restrição — um SSRF clássico com o servidor da aplicação como proxy (achado do Anubis, Fase
 * 06). Mesmo padrão de allowlist de domínio já usado em `JustificativaMeta.arquivoUrl`.
 */
function ehUrlBlobValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export const registrarAnexoSchema = z.object({
  noteId: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(NOTAS_ANEXO_MAX_SIZE),
  storageKey: z.string().trim().min(1).refine(ehUrlBlobValida, {
    message: "storageKey deve ser uma URL válida do Vercel Blob",
  }),
});
export type RegistrarAnexoInput = z.infer<typeof registrarAnexoSchema>;

export const criarLembreteSchema = z.object({
  noteId: z.string().min(1),
  remindAt: z.coerce.date(),
});
export type CriarLembreteInput = z.infer<typeof criarLembreteSchema>;
