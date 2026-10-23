import { atendimentoResumoSchema, atendimentoDetalheSchema, documentoSchema } from '../../../contracts/portal-api/v1';
import type { listarEmpresas, obterEmpresa } from '@/lib/checklist/leitura';
import type { documentoDTO } from '@/lib/checklist/dto';
const analyst = (a: Awaited<ReturnType<typeof obterEmpresa>>['analista']) => a ? { id: a.id, nome: a.nome, status: a.status, imagemUrl: a.imagemUrl && publicImage(a.imagemUrl) ? a.imagemUrl : null } : null;
function publicImage(value: string) { try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
}
catch {
    return false;
} }
export function atendimentoListDTO(page: Awaited<ReturnType<typeof listarEmpresas>>) { return { items: page.items.map(e => atendimentoResumoSchema.parse({ ...e, analista: analyst(e.analista) })), totalCount: page.totalCount, page: page.page, pageSize: page.pageSize }; }
export function atendimentoDetailDTO(e: Awaited<ReturnType<typeof obterEmpresa>>) {
    const ref = (c: {
        id: string;
        tipo: string;
        criadoEm: Date;
        atualizadoEm: Date;
    }) => ({ id: c.id, tipo: c.tipo, criadoEm: c.criadoEm.toISOString(), atualizadoEm: c.atualizadoEm.toISOString() });
    return atendimentoDetalheSchema.parse({ id: e.id, clienteId: e.clienteId, cliente: e.cliente, analista: analyst(e.analista), tipoAtivo: e.tipoAtivo, status: e.status, embasamento: e.embasamento, mesProtocolo: e.mesProtocolo, linkGrupo: e.linkGrupo, revision: e.revision, checklistAtivoId: e.checklistAtivoId, checklist: e.checklist ? { ...ref(e.checklist), itens: e.checklist.itens.map(i => ({ ...i, atualizadoEm: i.atualizadoEm.toISOString() })) } : null, checklists: e.checklists.map(ref), historical: e.historical, resumo: e.resumo, capabilities: e.capabilities });
}
export function documentWire(d: ReturnType<typeof documentoDTO>) { return documentoSchema.parse({ ...d, criadoEm: d.criadoEm.toISOString(), deletadoEm: d.deletadoEm?.toISOString() ?? null }); }
