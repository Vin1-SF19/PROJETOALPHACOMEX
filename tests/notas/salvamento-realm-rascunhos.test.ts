import { describe, expect, it, vi } from 'vitest';
import { SalvamentoNota, type ConteudoNotaEditado, type RascunhoNota } from '@/lib/notas/salvamento-client';

const content = (text: string): ConteudoNotaEditado => ({ title: 'Título', plainText: text, contentJson: { type: 'doc', text } });
function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const update = vi.fn<(input: unknown) => Promise<{ success: true; data: { currentVersion: number } } | { success: false; error: string }>>()
    .mockResolvedValue({ success: true, data: { currentVersion: 2 } });
  const options = { noteId: 'nota', version: 1, content: content('Original'), storageKey: 'draft', storage: () => storage, online: () => true, update };
  const read = () => JSON.parse(storage.getItem('draft')!) as RascunhoNota;
  return { storage, update, options, read };
}
function deferSave(update: ReturnType<typeof fixture>['update']) {
  let resolve!: (value: { success: true; data: { currentVersion: number } }) => void;
  update.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  return () => resolve({ success: true, data: { currentVersion: 2 } });
}

describe('propriedade de rascunhos de Notas entre abas e versões', () => {
  it('duas cópias independentes do módulo no mesmo milissegundo não compartilham a identidade de salvamento', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      vi.resetModules();
      const { SalvamentoNota: SessionA } = await import('@/lib/notas/salvamento-client');
      vi.resetModules();
      const { SalvamentoNota: SessionB } = await import('@/lib/notas/salvamento-client');
      const { options, storage, update, read } = fixture();
      const release = deferSave(update);
      const a = new SessionA(options);
      const b = new SessionB(options);
      a.change(content('A'));
      const tokenA = read().token;
      const saving = a.save();
      b.change(content('B'));
      const tokenB = read().token;
      release();
      expect(await saving).toBe(true);
      expect(storage.getItem('draft')).not.toBeNull();
      expect(read()).toMatchObject({ plainText: 'B', baseVersion: 1, token: tokenB });
      expect(tokenA).not.toBe(tokenB);
      expect(b.pending).toBe(true);
    } finally {
      clock.mockRestore();
      vi.resetModules();
    }
  });

  it.each([
    { title: 'Título de outra instância' },
    { plainText: 'Texto de outra instância' },
    { contentJson: { type: 'doc', text: 'A', bold: true } },
    { baseVersion: 5 },
  ])('confirmação preserva snapshot modificado mesmo com token legado compartilhado: %j', async patch => {
    const { options, storage, update, read } = fixture();
    const session = new SalvamentoNota(options);
    const release = deferSave(update);
    session.change(content('A'));
    const saving = session.save();
    const newer = { ...read(), ...patch };
    storage.setItem('draft', JSON.stringify(newer));
    release();
    expect(await saving).toBe(true);
    expect(read()).toEqual(newer);
  });

  it('confirmação antiga não rebaixa a versão-base de rascunho recuperado e resolvido em outra instância', async () => {
    const { options, update, read } = fixture();
    const session = new SalvamentoNota(options);
    const release = deferSave(update);
    update.mockResolvedValueOnce({ success: false, error: 'CONFLITO_VERSAO' });
    session.change(content('A'));
    const saving = session.save();
    session.change(content('B'));
    const other = new SalvamentoNota({ ...options, version: 5 });
    other.restore();
    expect(other.hasConflict).toBe(true);
    other.keepDraftOnVersion(5);
    expect(read()).toMatchObject({ plainText: 'B', baseVersion: 5 });
    release();
    expect(await saving).toBe(false);
    expect(read()).toMatchObject({ plainText: 'B', baseVersion: 5 });
  });

  it('escolher versão remota não limpa um rascunho compartilhado alterado por outra instância', () => {
    const { options, storage, read } = fixture();
    const session = new SalvamentoNota(options);
    session.change(content('A'));
    const newer = { ...read(), ...content('B'), baseVersion: 5 };
    storage.setItem('draft', JSON.stringify(newer));
    session.useRemote(content('Remoto'), 6);
    expect(read()).toEqual(newer);
    expect(session.currentContent.plainText).toBe('Remoto');
  });

  it('escolher versão remota limpa o snapshot próprio inalterado', () => {
    const { options, storage } = fixture();
    const session = new SalvamentoNota(options);
    session.change(content('A'));
    session.useRemote(content('Remoto'), 2);
    expect(storage.getItem('draft')).toBeNull();
    expect(session.pending).toBe(false);
  });
});
