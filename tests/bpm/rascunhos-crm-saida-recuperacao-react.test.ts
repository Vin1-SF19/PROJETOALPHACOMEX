// @vitest-environment happy-dom
import React, { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CardSaveProvider, useCardSave } from '@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext';
import { chaveRascunhosCrm } from '@/lib/bpm/rascunhos-locais';

vi.mock('@/actions/bpm/Cards', () => ({ ObterCardBpm: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));
const cardId = 'c000000000000000000000001';
let root: Root, host: HTMLDivElement, context: ReturnType<typeof useCardSave>;
function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.clearAllMocks(); });
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label);
  expect(button, `Botão ${label}`).toBeDefined(); await act(async () => button!.click());
}
async function mount(draftKey: string) {
  localStorage.setItem(chaveRascunhosCrm(7)!, JSON.stringify({ [draftKey]: { valores: { campo: 'Rascunho fictício' } } }));
  localStorage.setItem(chaveRascunhosCrm(8)!, 'rascunho de outra conta');
  await act(async () => root.render(h(CardSaveProvider, { userId: 7, children: h(Probe) })));
}

it.each([`${cardId}-form`, `${cardId}:anotacao`])('descarta rascunho recuperado %s pela navegação sem montar o card', async draftKey => {
  await mount(draftKey);
  expect(context.getPendingFields(cardId)).toEqual(['Rascunho recuperado']);
  let leaving!: Promise<boolean>;
  await act(async () => { leaving = context.requestLeave(); });
  await click('Continuar editando'); expect(await leaving).toBe(false);
  expect(localStorage.getItem(chaveRascunhosCrm(7)!)).toContain('Rascunho fictício');
  await act(async () => { leaving = context.requestLeave(); });
  await click('Descartar e sair'); expect(await leaving).toBe(true);
  expect(context.getPendingFields()).toEqual([]); expect(localStorage.getItem(chaveRascunhosCrm(7)!)).toBeNull();
  expect(localStorage.getItem(chaveRascunhosCrm(8)!)).toBe('rascunho de outra conta');
  const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(false);
});

it('salvar e sair sem editor montado conserva a recuperação e explica a pendência', async () => {
  await mount(`${cardId}-form`);
  let leaving!: Promise<boolean>; await act(async () => { leaving = context.requestLeave(); });
  await click('Salvar e sair');
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Não foi possível salvar tudo');
  expect(localStorage.getItem(chaveRascunhosCrm(7)!)).toContain('Rascunho fictício');
  expect(context.getPendingFields(cardId)).toEqual(['Rascunho recuperado']);
  await click('Continuar editando'); expect(await leaving).toBe(false);
});
