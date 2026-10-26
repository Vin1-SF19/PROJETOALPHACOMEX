import type { AtualizarNotaInput } from '@/lib/validations/notas';

export type ConteudoNotaEditado = { title: string; contentJson: unknown; plainText: string };
export type RascunhoNota = ConteudoNotaEditado & { baseVersion: number; savedAt: number; token?: string };
export type EstadoSalvamentoNota = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'offline';
type Resultado = { success: true; data: { currentVersion: number } } | { success: false; error: string; versaoAtual?: number };
type StorageNota = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let nextSession = 0;

/** Uma revisão só é confirmada pela resposta correspondente. Rascunhos de outra
 * instância/aba nunca são removidos pela confirmação desta sessão. */
export class SalvamentoNota {
  private revision = 0;
  private confirmedRevision = 0;
  private version: number;
  private content: ConteudoNotaEditado;
  private token = '';
  private readonly session = `${Date.now()}:${++nextSession}`;
  private inFlight: Promise<boolean> | null = null;
  private conflict = false;
  private listeners = new Set<(status: EstadoSalvamentoNota) => void>();
  private state: EstadoSalvamentoNota = 'salvo';

  constructor(private readonly options: {
    noteId: string; version: number; content: ConteudoNotaEditado; storageKey: string;
    storage: () => StorageNota; online: () => boolean;
    update: (input: AtualizarNotaInput) => Promise<Resultado>;
  }) {
    this.version = options.version;
    this.content = options.content;
  }
  get status() { return this.state; }
  get pending() { return this.revision !== this.confirmedRevision; }
  get hasConflict() { return this.conflict; }
  get currentContent() { return this.content; }
  subscribe(listener: (status: EstadoSalvamentoNota) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private emit(status: EstadoSalvamentoNota) {
    this.state = status;
    for (const listener of this.listeners) listener(status);
  }
  private store(onlyIfOwned = false) {
    try {
      const storage = this.options.storage();
      if (onlyIfOwned && this.read()?.token !== this.token) return;
      storage.setItem(this.options.storageKey, JSON.stringify({ ...this.content, baseVersion: this.version, savedAt: Date.now(), token: this.token }));
    } catch { /* Navegadores sem armazenamento mantêm o conteúdo em memória. */ }
  }
  private clearConfirmed(token: string) {
    try {
      if (this.read()?.token === token) this.options.storage().removeItem(this.options.storageKey);
    } catch { /* Conteúdo confirmado no servidor; limpeza local é best effort. */ }
  }
  read(): RascunhoNota | null {
    try {
      const raw = this.options.storage().getItem(this.options.storageKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      const draft = value as Partial<RascunhoNota>;
      if (typeof draft.title !== 'string' || !draft.contentJson || typeof draft.contentJson !== 'object'
        || !Number.isInteger(draft.baseVersion) || (draft.baseVersion ?? 0) < 1) return null;
      return { title: draft.title, contentJson: draft.contentJson, plainText: typeof draft.plainText === 'string' ? draft.plainText : '', baseVersion: draft.baseVersion!, savedAt: draft.savedAt ?? 0, token: draft.token };
    } catch { return null; }
  }
  restore(): RascunhoNota | null {
    const draft = this.read();
    if (!draft) return null;
    this.content = { title: draft.title, contentJson: draft.contentJson, plainText: draft.plainText };
    this.revision += 1;
    this.token = draft.token ?? `${this.session}:${this.revision}`;
    this.conflict = draft.baseVersion !== this.version;
    this.version = draft.baseVersion;
    // Migra somente o rascunho local sem token; nenhuma estrutura de banco muda.
    if (!draft.token) this.store();
    this.emit(this.conflict ? 'conflito' : 'pendente');
    return draft;
  }
  change(content: ConteudoNotaEditado) {
    this.content = content;
    this.revision += 1;
    this.token = `${this.session}:${this.revision}`;
    this.store();
    this.emit(this.conflict ? 'conflito' : 'pendente');
  }
  useRemote(content: ConteudoNotaEditado, version: number) {
    const token = this.token;
    this.content = content;
    this.version = version;
    this.confirmedRevision = this.revision;
    this.conflict = false;
    this.clearConfirmed(token);
    this.emit('salvo');
  }
  /** Chamado apenas após escolha explícita do usuário de reaplicar o rascunho. */
  keepDraftOnVersion(version: number) {
    this.version = version;
    this.conflict = false;
    this.store(true);
    this.emit('pendente');
  }
  save(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    const operation = this.persist();
    this.inFlight = operation;
    void operation.finally(() => { if (this.inFlight === operation) this.inFlight = null; });
    return operation;
  }
  private async persist(): Promise<boolean> {
    while (this.pending) {
      if (this.conflict) { this.emit('conflito'); return false; }
      if (!this.options.online()) { this.emit('offline'); return false; }
      const revision = this.revision;
      const token = this.token;
      this.emit('salvando');
      try {
        const content = JSON.parse(JSON.stringify(this.content)) as ConteudoNotaEditado;
        const result = await this.options.update({ id: this.options.noteId, ...content, baseVersion: this.version });
        if (!result.success) {
          this.conflict = result.error === 'CONFLITO_VERSAO';
          this.emit(this.conflict ? 'conflito' : 'erro');
          return false;
        }
        this.version = result.data.currentVersion;
        this.confirmedRevision = revision;
        if (this.revision === revision) {
          this.clearConfirmed(token);
          this.emit('salvo');
        } else {
          this.store(true);
          this.emit('pendente');
        }
      } catch {
        this.emit(this.options.online() ? 'erro' : 'offline');
        return false;
      }
    }
    return true;
  }
}

type EditorNotaRegistrado = { rename: (title: string) => Promise<boolean>; save?: () => Promise<boolean> };
const editors = new Map<string, Set<EditorNotaRegistrado>>();
export function registrarRenomeacaoEditor(noteId: string, handler: (title: string) => Promise<boolean>, save?: () => Promise<boolean>) {
  const registration = {rename: handler, save};
  const handlers = editors.get(noteId) ?? new Set<EditorNotaRegistrado>();
  handlers.add(registration); editors.set(noteId, handlers);
  return () => { handlers.delete(registration); if (!handlers.size) editors.delete(noteId); };
}
export async function salvarNotaAbertaAntesDeEncerrar(noteId: string): Promise<boolean> {
  // Se duas instâncias estão abertas no mesmo contexto, cada uma precisa confirmar.
  // Uma recusa mantém o editor e os rascunhos disponíveis para resolução.
  for (const handler of editors.get(noteId) ?? []) if (handler.save && !await handler.save()) return false;
  return true;
}
export async function renomearNotaPreservandoRascunho(noteId: string, title: string, fallback: () => Promise<boolean>) {
  const handler = [...(editors.get(noteId) ?? [])].at(-1);
  return handler ? handler.rename(title) : fallback();
}
