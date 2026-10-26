export interface RascunhoDocumentoBlueprint {
  userId: number;
  projectId: string;
  creationKey: string;
  documentId?: string;
  baseUpdatedAt?: string;
  contentJson: string;
  contentText: string;
  revision: number;
  token?: string;
}

export function chaveRascunhoDocumentoBlueprint(userId: number, projectId: string) {
  return `alpha_blueprint_documento_v1_user_${userId}_project_${projectId}`;
}

export function lerRascunhoDocumentoBlueprint(userId: number, projectId: string): RascunhoDocumentoBlueprint | null {
  try {
    const raw = localStorage.getItem(chaveRascunhoDocumentoBlueprint(userId, projectId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as RascunhoDocumentoBlueprint;
    if (!draft || draft.userId !== userId || draft.projectId !== projectId
      || typeof draft.creationKey !== "string" || typeof draft.contentJson !== "string"
      || draft.contentJson.length > 2 * 1024 * 1024 || typeof draft.contentText !== "string"
      || !Number.isSafeInteger(draft.revision) || draft.revision < 1
      || (draft.token !== undefined && (typeof draft.token !== "string" || !draft.token))
      || (draft.documentId !== undefined && typeof draft.documentId !== "string")
      || (draft.baseUpdatedAt !== undefined && (typeof draft.baseUpdatedAt !== "string" || Number.isNaN(Date.parse(draft.baseUpdatedAt))))) return null;
    JSON.parse(draft.contentJson);
    return draft;
  } catch { return null; }
}

function mesmoRascunho(atual: RascunhoDocumentoBlueprint | null, esperado: RascunhoDocumentoBlueprint) {
  return atual?.token === esperado.token && atual?.creationKey === esperado.creationKey
    && atual?.revision === esperado.revision && atual?.contentJson === esperado.contentJson
    && atual?.contentText === esperado.contentText && atual?.documentId === esperado.documentId
    && atual?.baseUpdatedAt === esperado.baseUpdatedAt;
}

export function guardarRascunhoDocumentoBlueprint(draft: RascunhoDocumentoBlueprint, anterior?: RascunhoDocumentoBlueprint): boolean {
  try {
    // Respostas assíncronas só atualizam a base do registro que esta instância gravou.
    // Outra aba pode ter tomado a chave enquanto o request estava em trânsito.
    if (anterior && !mesmoRascunho(lerRascunhoDocumentoBlueprint(draft.userId, draft.projectId), anterior)) return true;
    localStorage.setItem(chaveRascunhoDocumentoBlueprint(draft.userId, draft.projectId), JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export function limparRascunhoDocumentoBlueprint(userId: number, projectId: string, confirmado?: RascunhoDocumentoBlueprint) {
  try {
    const atual = lerRascunhoDocumentoBlueprint(userId, projectId);
    // Uma resposta de outra aba não pode remover o rascunho mais recente.
    if (confirmado && !mesmoRascunho(atual, confirmado)) return;
    localStorage.removeItem(chaveRascunhoDocumentoBlueprint(userId, projectId));
  }
  catch { /* A confirmação do servidor continua válida se o navegador negar storage. */ }
}
