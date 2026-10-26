// @vitest-environment happy-dom
import React, { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CardSaveProvider, useCardSave } from '@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext';
import { chaveRascunhosCrm } from '@/lib/bpm/rascunhos-locais';
vi.mock('@/actions/bpm/Cards', () => ({ ObterCardBpm: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), dismiss: vi.fn() } }));
let contexts: ReturnType<typeof useCardSave>[];
let roots: Root[];
function Probe({ index }: { index: number }) { const value=useCardSave();React.useEffect(()=>{contexts[index]=value;},[index,value]);return null; }
beforeEach(async()=>{
  Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();contexts=[];
  roots=[document.createElement('div'),document.createElement('div')].map(host=>createRoot(host));
  await act(async()=>roots.forEach((root,index)=>root.render(h(CardSaveProvider,{userId:7,children:h(Probe,{index})}))));
});
afterEach(async()=>{await act(async()=>roots.forEach(root=>root.unmount()));localStorage.clear();});
const stored=()=>JSON.parse(localStorage.getItem(chaveRascunhosCrm(7)!)??'{}');
it('confirmar A não remove a revisão mais recente escrita por B',async()=>{
  await act(async()=>contexts[0].setDraft('card:anotacao',{texto:'A'}));
  await act(async()=>contexts[1].setDraft('card:anotacao',{texto:'B mais recente'}));
  await act(async()=>contexts[0].setDraft('card:anotacao'));
  expect(stored()['card:anotacao'].valores.texto).toBe('B mais recente');
});
it('rebase e mudanças de metadados de A não substituem rascunho de outra instância',async()=>{
  await act(async()=>contexts[0].setDraft('card:campo',{texto:'A pendente'}));
  await act(async()=>contexts[1].setDraft('card:campo',{texto:'B novo'}));
  const token=stored()['card:campo'].token;
  await act(async()=>{
    contexts[0].setDraft('card:campo',{texto:'A pendente',automatico:'Atualizado'},{versao:'nova',valores:{texto:'antigo'}},'sync');
    contexts[0].setPendingFields('card:campo',['Campo pendente']);
  });
  expect(stored()['card:campo']).toMatchObject({token,valores:{texto:'B novo'}});
});
it('salvar ou descartar um card não perde rascunhos de outro card escritos em outra aba',async()=>{
  await act(async()=>contexts[0].setDraft('A:anotacao',{texto:'Card A'}));
  await act(async()=>contexts[1].setDraft('B:anotacao',{texto:'Card B'}));
  await act(async()=>contexts[0].discardPending('A'));
  expect(stored()['B:anotacao'].valores.texto).toBe('Card B');expect(stored()['A:anotacao']).toBeUndefined();
});
it('uma edição explícita nova recebe identidade diferente e só sua confirmação a remove',async()=>{
  await act(async()=>contexts[0].setDraft('card:anotacao',{texto:'A'}));const a=stored()['card:anotacao'].token;
  await act(async()=>contexts[1].setDraft('card:anotacao',{texto:'B'}));expect(stored()['card:anotacao'].token).not.toBe(a);
  await act(async()=>contexts[1].setDraft('card:anotacao'));expect(stored()['card:anotacao']).toBeUndefined();
});
