import * as c from '../../../contracts/portal-api/v1';
import { jsonInput, queryInput, success, type PortalHandler } from './http';
import { listarEmpresas, obterEmpresa, listarDocumentos } from '@/lib/checklist/leitura';
import { iniciarUploadDireto, finalizarUploadDireto, registrarDocumento } from '@/lib/checklist/documentos';
import { alterarDocumento } from '@/lib/checklist/service';
import { scopeAtendimento, scopeChecklist, scopeItem, scopeDocument, recheckOnDenied } from './scope';
import { atendimentoListDTO, atendimentoDetailDTO, documentWire } from './projections';
export const atendimentos: PortalHandler = async (req, p, rid) => success(atendimentoListDTO(await listarEmpresas(p!.actor, queryInput(req, c.filtroEmpresasSchema))), rid);
export const atendimento = (id: string): PortalHandler => async (req, p, rid) => {
    c.idSchema.parse(id);
    const q = queryInput(req, c.detalheQuerySchema);
    await scopeAtendimento(p!.actor, id);
    if (q.checklistId)
        await scopeChecklist(p!.actor, q.checklistId);
    return success(atendimentoDetailDTO(await recheckOnDenied(() => scopeAtendimento(p!.actor, id), () => obterEmpresa(p!.actor, id, q))), rid);
};
export const progress = (id: string): PortalHandler => async (req, p, rid) => { c.idSchema.parse(id); queryInput(req, c.emptySchema); const empresaId = await scopeChecklist(p!.actor, id); return success(c.resumoSchema.parse((await recheckOnDenied(() => scopeChecklist(p!.actor, id), () => obterEmpresa(p!.actor, empresaId, { checklistId: id }))).resumo), rid); };
export const documents: PortalHandler = async (req, p, rid) => {
    const q = queryInput(req, c.documentoQuerySchema);
    await scopeAtendimento(p!.actor, q.empresaId);
    if (q.itemId)
        await scopeItem(p!.actor, q.itemId);
    if (q.checklistId)
        await scopeChecklist(p!.actor, q.checklistId);
    if (q.excluidos)
        return success({ items: [], totalCount: 0, page: q.page, pageSize: q.pageSize }, rid);
    const page = await recheckOnDenied(() => scopeAtendimento(p!.actor, q.empresaId), () => listarDocumentos(p!.actor, q));
    return success({ ...page, items: page.items.map(documentWire) }, rid);
};
export const initiateUpload: PortalHandler = async (req, p, rid) => { queryInput(req, c.emptySchema); const body = await jsonInput(req, c.initiateSchema); await scopeItem(p!.actor, body.itemId); const result = await recheckOnDenied(() => scopeItem(p!.actor, body.itemId), () => iniciarUploadDireto(p!.actor, body)); return success(c.uploadAutorizacaoSchema.parse({ ...result, expiresAt: result.expiresAt.toISOString() }), rid); };
export const finalizeUpload: PortalHandler = async (req, p, rid) => { queryInput(req, c.emptySchema); const body = await jsonInput(req, c.finalizeSchema); await scopeItem(p!.actor, body.itemId); return success(c.uploadVerificadoSchema.parse(await recheckOnDenied(() => scopeItem(p!.actor, body.itemId), () => finalizarUploadDireto(p!.actor, body))), rid); };
export const registerDocument: PortalHandler = async (req, p, rid) => { queryInput(req, c.emptySchema); const body = await jsonInput(req, c.registerSchema); await scopeItem(p!.actor, body.itemId); return success(documentWire(await recheckOnDenied(() => scopeItem(p!.actor, body.itemId), () => registrarDocumento(p!.actor, body))), rid); };
export const observeDocument = (id: string): PortalHandler => async (req, p, rid) => { c.idSchema.parse(id); queryInput(req, c.emptySchema); const body = await jsonInput(req, c.observationSchema); await scopeDocument(p!.actor, id, true); return success(documentWire(await recheckOnDenied(() => scopeDocument(p!.actor, id, true), () => alterarDocumento(p!.actor, { ...body, documentoId: id }, 'OBSERVACAO'))), rid); };
export const removeDocument = (id: string): PortalHandler => async (req, p, rid) => { c.idSchema.parse(id); queryInput(req, c.emptySchema); const body = await jsonInput(req, c.mutationSchema); await scopeDocument(p!.actor, id, true); return success(documentWire(await recheckOnDenied(() => scopeDocument(p!.actor, id, true), () => alterarDocumento(p!.actor, { ...body, documentoId: id }, 'EXCLUIR'))), rid); };
