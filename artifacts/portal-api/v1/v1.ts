/** Canonical wire contract. Edit here; generated copies are immutable artifacts. */
import { z } from 'zod/v3';
export const CONTRACT_VERSION = '1.1.0';
export const CONTRACT_MAJOR = 1;
export const environmentSchema = z.enum(['local', 'staging', 'production']);
export type PortalEnvironment = z.infer<typeof environmentSchema>;
export const JSON_REQUEST_BYTES = 32768;
export const JSON_RESPONSE_BYTES = 2097152;
export const PRINCIPAL_TTL_SECONDS = 604800;
export const tiposChecklist = ['RECEITA_BRUTA_DAS', 'RECEITA_BRUTA_CPRB', 'INICIO_RETOMADA', 'DISPONIBILIDADE_FINANCEIRA'] as const;
export const statusChecklist = ['PENDENTE', 'OK', 'IRREGULAR', 'PARCIALMENTE_IRREGULAR', 'REVISAR', 'DESNECESSARIO', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTOS', 'PRIORIDADE'] as const;
export const statusLeitura = [...statusChecklist, 'FALAR_DR_EDVAN', 'FALAR_ANDREW'] as const;
export const idSchema = z.string().trim().min(1).max(80).refine(v => !/[\x00-\x1f\x7f/\\]/.test(v));
export const revisionSchema = z.number().int().safe().nonnegative();
export const isoSchema = z.string().datetime();
const int = z.number().int().safe().nonnegative();
const positive = z.number().int().safe().positive();
const text = z.string().max(JSON_RESPONSE_BYTES);
export const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
export const senhaAtualSchema = z.string().min(1).refine(v => new TextEncoder().encode(v).byteLength <= 4096);
export const novaSenhaPortalSchema = z.string().min(12, 'Use uma senha de pelo menos 12 caracteres.').refine(v => new TextEncoder().encode(v).byteLength <= 72, 'A senha deve ter até 72 bytes em UTF-8.');
export const mutationSchema = z.object({ mutationId: z.string().uuid(), expectedRevision: revisionSchema }).strict();
export const pageSchema = z.object({ page: positive.max(1000000).default(1), pageSize: positive.max(100).default(25) }).strict();
export const notificationQuerySchema = pageSchema.extend({ pageSize: positive.max(100).default(50) }).strict();
export const filtroEmpresasSchema = pageSchema.extend({ busca: z.string().trim().max(200).optional(), tipo: z.enum(tiposChecklist).optional(), status: z.string().trim().max(40).optional(), analistaId: positive.optional(), semAnalista: z.boolean().optional(), clienteId: positive.optional() }).strict();
export const documentoQuerySchema = notificationQuerySchema.extend({ empresaId: idSchema, itemId: idSchema.optional(), checklistId: idSchema.optional(), excluidos: z.boolean().optional() }).strict();
export const emptySchema = z.object({}).strict();
export const loginSchema = z.object({ email: emailSchema, senha: senhaAtualSchema }).strict();
export const recoverySchema = z.object({ email: emailSchema.refine(v => v.length <= 180) }).strict();
export const resetSchema = z.object({ token: z.string().min(32).max(100), novaSenha: novaSenhaPortalSchema }).strict();
export const passwordSchema = z.object({ senhaAtual: senhaAtualSchema, novaSenha: novaSenhaPortalSchema }).strict();
export const profileInputSchema = z.object({ nome: z.string().trim().min(2).max(100), email: emailSchema }).strict();
export const detalheQuerySchema = z.object({ checklistId: idSchema.optional() }).strict();
export const avatarQuerySchema = z.object({ v: z.string().regex(/^[a-f0-9]{20}$/).optional() }).strict();
export const avatarUploadQuerySchema = z.object({ filename: z.string().trim().min(1).max(255) }).strict();
export const incrementalQuerySchema = z.object({ desde: isoSchema }).strict();
export const mimeSchema = z.enum(['application/pdf', 'image/jpeg', 'image/png']);
export const initiateSchema = z.object({ itemId: idSchema, nome: z.string().trim().min(1).max(180), mime: mimeSchema, tamanhoBytes: positive.max(8388608) }).strict();
export const finalizeSchema = z.object({ itemId: idSchema, recibo: z.string().min(32).max(100) }).strict();
export const registerSchema = mutationSchema.extend({ itemId: idSchema, recibo: z.string().min(32).max(100) }).strict();
export const observationSchema = mutationSchema.extend({ observacao: z.string().trim().max(5000).nullable() }).strict();
// Responses intentionally strip additions, preserving minor-version compatibility.
export const identitySchema = z.object({ id: idSchema, nome: text, email: emailSchema, authSessionVersion: revisionSchema, principalExpiresAt: isoSchema }).strip();
export const loginPrivateSchema = z.object({ principalToken: z.string().min(1).max(8192), principalExpiresAt: isoSchema, identity: identitySchema }).strip();
export const profileSchema = z.object({ id: idSchema, nome: text, email: emailSchema, imagemUrl: z.string().regex(/^\/api\/perfil\/avatar\?v=[a-f0-9]{20}$/).nullable() }).strip();
export const capabilitiesSchema = z.object({ canRead: z.boolean(), canEdit: z.boolean(), canCreateOwn: z.boolean(), canAssignOwner: z.boolean(), canManageModels: z.boolean(), canManagePortalAccess: z.boolean(), canLinkCrm: z.boolean() }).strip();
export const resumoSchema = z.object({ estado: z.enum(['SEM_CHECKLIST', 'SEM_ITENS', 'EM_ANDAMENTO', 'COMPLETO']), total: int, concluidos: int, pendentes: int, percentual: int.max(100), semObrigatorios: z.boolean() }).strip();
export const analistaSchema = z.object({ id: positive, nome: text, imagemUrl: z.string().url().refine(v => v.startsWith('https://')).nullable(), status: text }).strip();
export const masterSchema = z.object({ id: positive, razaoSocial: text, nomeFantasia: text.nullable(), cnpj: text, regimeTributario: text.nullable() }).strip();
const atendimentoFields = { id: idSchema, clienteId: positive, status: text, embasamento: text, mesProtocolo: text.nullable(), linkGrupo: text.nullable(), analista: analistaSchema.nullable(), tipoAtivo: z.enum(tiposChecklist).nullable(), checklistAtivoId: idSchema.nullable(), resumo: resumoSchema, revision: revisionSchema, capabilities: capabilitiesSchema };
export const atendimentoResumoSchema = z.object({ ...atendimentoFields, razaoSocial: text, cnpj: text, nomeFantasia: text.nullable() }).strip();
export const checklistReferenciaSchema = z.object({ id: idSchema, tipo: z.enum(tiposChecklist), criadoEm: isoSchema, atualizadoEm: isoSchema }).strip();
export const itemSchema = z.object({ id: idSchema, codigo: text, secao: text, descricao: text, complemento: text.nullable(), status: z.enum(statusLeitura), observacao: text.nullable(), obrigatorio: z.boolean(), ordem: z.number().int().safe(), atualizadoEm: isoSchema, _count: z.object({ documentos: int }).strip() }).strip();
export const atendimentoDetalheSchema = z.object({ ...atendimentoFields, cliente: masterSchema, checklist: checklistReferenciaSchema.extend({ itens: z.array(itemSchema) }).strip().nullable(), checklists: z.array(checklistReferenciaSchema), historical: z.boolean() }).strip();
export const documentoSchema = z.object({ id: idSchema, nome: text, url: z.string().regex(/^\/api\/checklist\/documentos\/[^/]+\/download$/), uploadedByCliente: z.boolean(), observacao: text.nullable(), criadoEm: isoSchema, deletadoEm: isoSchema.nullable(), deletadoPorCliente: z.boolean(), uploadedByUsuarioId: positive.nullable(), uploadedByContaId: idSchema.nullable(), deletadoPorUsuarioId: positive.nullable(), deletadoPorContaId: idSchema.nullable() }).strip();
export const notificacaoSchema = z.object({ id: idSchema, clienteId: idSchema, eventoId: idSchema.nullable(), tipo: text, titulo: text, mensagem: text.nullable(), empresaId: idSchema, itemId: idSchema.nullable(), lida: z.boolean(), criadaEm: isoSchema }).strip();
export const pageOf = <S extends z.ZodTypeAny>(schema: S) => z.object({ items: z.array(schema).max(100), totalCount: int, page: positive.max(1000000), pageSize: positive.max(100) }).strip();
export const notificacoesSchema = pageOf(notificacaoSchema).extend({ naoLidas: int }).strip();
export const incrementalSchema = z.object({ items: z.array(notificacaoSchema).max(100) }).strip();
export const uploadAutorizacaoSchema = z.object({ recibo: z.string().min(32).max(100), pathname: text, clientToken: text, access: z.literal('private'), expiresAt: isoSchema }).strip();
export const uploadVerificadoSchema = z.object({ recibo: z.string().min(32).max(100), nome: text, tamanhoBytes: positive.max(8388608), mimeType: mimeSchema, verificado: z.literal(true) }).strip();
export const errorCodeSchema = z.enum(['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'CONFLICT', 'UPLOAD_INVALID', 'LIMIT_EXCEEDED', 'UNSUPPORTED_MEDIA', 'RATE_LIMITED', 'RETRYABLE', 'INTERNAL', 'MODEL_EMPTY', 'MODEL_CODE_CONFLICT', 'GONE']);
export const errorSchema = z.object({ ok: z.literal(false), error: z.object({ code: errorCodeSchema, message: text, fieldErrors: z.record(z.array(text)).optional() }).strip(), requestId: z.string().uuid() }).strip();
export const successOf = <S extends z.ZodTypeAny>(schema: S) => z.object({ ok: z.literal(true), data: schema, requestId: z.string().uuid() }).strip();
export type IdentityDTO = z.infer<typeof identitySchema>;
export type LoginPrivateDTO = z.infer<typeof loginPrivateSchema>;
export type ProfileDTO = z.infer<typeof profileSchema>;
export type AtendimentoResumoDTO = z.infer<typeof atendimentoResumoSchema>;
export type AtendimentoDetalheDTO = z.infer<typeof atendimentoDetalheSchema>;
export type DocumentoDTO = z.infer<typeof documentoSchema>;
export type NotificacaoDTO = z.infer<typeof notificacaoSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type Result<T> = {
    ok: true;
    data: T;
    requestId: string;
} | z.infer<typeof errorSchema>;
export type Page<T> = {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
};
export type TipoEmbasamento = typeof tiposChecklist[number];
export type StatusLeitura = typeof statusLeitura[number];
export const operations = [
    { id: 'login', method: 'POST', path: '/identity/login', authMode: 'A' },
    { id: 'me', method: 'GET', path: '/identity/me', authMode: 'P' },
    { id: 'recovery', method: 'POST', path: '/identity/recovery', authMode: 'A' },
    { id: 'reset', method: 'POST', path: '/identity/reset', authMode: 'A' },
    { id: 'password', method: 'POST', path: '/identity/password', authMode: 'P' },
    { id: 'profile', method: 'GET', path: '/profile', authMode: 'P' },
    { id: 'updateProfile', method: 'PATCH', path: '/profile', authMode: 'P' },
    { id: 'uploadAvatar', method: 'POST', path: '/profile/avatar', authMode: 'P' },
    { id: 'avatar', method: 'GET', path: '/profile/avatar', authMode: 'P' },
    { id: 'notifications', method: 'GET', path: '/notifications', authMode: 'P' },
    { id: 'readNotification', method: 'POST', path: '/notifications/[id]/read', authMode: 'P' },
    { id: 'readAllNotifications', method: 'POST', path: '/notifications/read-all', authMode: 'P' },
    { id: 'incremental', method: 'GET', path: '/notifications/incremental', authMode: 'P' },
    { id: 'notificationStream', method: 'GET', path: '/notifications/stream', authMode: 'P' },
    { id: 'atendimentos', method: 'GET', path: '/atendimentos', authMode: 'P' },
    { id: 'atendimento', method: 'GET', path: '/atendimentos/[id]', authMode: 'P' },
    { id: 'progress', method: 'GET', path: '/checklists/[id]/progress', authMode: 'P' },
    { id: 'documents', method: 'GET', path: '/documents', authMode: 'P' },
    { id: 'initiateUpload', method: 'POST', path: '/uploads/initiate', authMode: 'P' },
    { id: 'finalizeUpload', method: 'POST', path: '/uploads/finalize', authMode: 'P' },
    { id: 'registerDocument', method: 'POST', path: '/documents', authMode: 'P' },
    { id: 'observeDocument', method: 'PATCH', path: '/documents/[id]/observation', authMode: 'P' },
    { id: 'removeDocument', method: 'POST', path: '/documents/[id]/remove', authMode: 'P' },
    { id: 'downloadDocument', method: 'GET', path: '/documents/[id]/download', authMode: 'P' },
] as const;
export type OperationId = typeof operations[number]['id'];
export const responseSchemas = {
    login: loginPrivateSchema, me: identitySchema, recovery: z.object({ message: text }).strip(), reset: z.object({ reautenticar: z.literal(true) }).strip(), password: z.object({ reautenticar: z.literal(true) }).strip(), profile: profileSchema, updateProfile: z.object({ success: z.literal(true) }).strip(), uploadAvatar: z.object({ url: profileSchema.shape.imagemUrl.unwrap() }).strip(), notifications: notificacoesSchema, readNotification: z.object({ id: idSchema }).strip(), readAllNotifications: z.object({ ok: z.literal(true) }).strip(), incremental: incrementalSchema, atendimentos: pageOf(atendimentoResumoSchema), atendimento: atendimentoDetalheSchema, progress: resumoSchema, documents: pageOf(documentoSchema), initiateUpload: uploadAutorizacaoSchema, finalizeUpload: uploadVerificadoSchema, registerDocument: documentoSchema, observeDocument: documentoSchema, removeDocument: documentoSchema,
} as const;
export type JsonOperationId = keyof typeof responseSchemas;
export type OperationData<K extends JsonOperationId> = z.infer<(typeof responseSchemas)[K]>;
