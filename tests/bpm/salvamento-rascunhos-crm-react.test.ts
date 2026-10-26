// @vitest-environment happy-dom
import React, { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CardSaveProvider, useCardSave } from '@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext';
import { EditorAnotacaoCard } from '@/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard';
import { PainelChecklistsCard } from '@/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard';
import { PainelCamposEtapaAtual } from '@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual';
import { chaveRascunhosCrm } from '@/lib/bpm/rascunhos-locais';

const api = vi.hoisted(() => ({anotar:vi.fn(),listar:vi.fn(),atualizar:vi.fn(),card:vi.fn(),campos:vi.fn()}));
vi.mock('@/actions/bpm/Cards',()=>({ObterCardBpm:api.card,AtualizarCardBpm:api.campos}));
vi.mock('@/actions/bpm/ConsultaCnpjFinanceiro',()=>({ConsultarCnpjNovoContrato:vi.fn()}));
vi.mock('@/actions/bpm/Anexos',()=>({RegistrarAnexoBpm:vi.fn()}));
vi.mock('@/actions/bpm/Interacoes',()=>({CriarInteracaoCardBpm:api.anotar}));
vi.mock('@/actions/bpm/Checklists',()=>({ListarChecklistsCardBpm:api.listar,AtualizarItemChecklistCardBpm:api.atualizar,AdicionarItemExclusivoChecklistCardBpm:vi.fn(),CriarChecklistDocumentalAvulsoBpm:vi.fn()}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn(),dismiss:vi.fn()}}));
let root:Root, host:HTMLDivElement, context:ReturnType<typeof useCardSave>;
function Probe(){const value=useCardSave();React.useEffect(()=>{context=value;},[value]);return null;}
const baseDate='2026-10-26T12:00:00.000Z';
const card={id:'card',updatedAt:baseDate,pipelineId:'pipeline',etapaId:'stage',etapa:{id:'stage',nome:'Etapa',chave:'stage'},responsavel:{id:7,nome:'Pessoa teste'},membros:[],camposEtapa:[{id:'campo',nome:'Descrição',tipo:'texto',valor:'Servidor',editavel:true,obrigatorio:false,pipelineId:'pipeline',etapaId:'stage',ordem:0,opcoesJson:null}]} as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>['card'];
const items=['a','b'].map(id=>({id,nome:`Documento ${id.toUpperCase()}`,status:'PENDENTE',observacao:'',responsavelId:null,obrigatorio:false,exclusivoCard:false,updatedAt:baseDate}));
beforeEach(()=>{
  vi.resetAllMocks();vi.useFakeTimers();localStorage.clear();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  api.card.mockResolvedValue({success:true,data:card});api.listar.mockResolvedValue({success:true,data:[{id:'checklist',templateNome:'Procedimento',itens:items}]});
  api.atualizar.mockResolvedValue({success:true,data:{id:'b',updatedAt:baseDate,observacao:''}});
  api.anotar.mockResolvedValue({success:true,data:{id:'nota',tipo:'ANOTACAO',observacoes:'Texto'}});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();});
async function mount(kind:'anotacao'|'checklist'|'campos'='anotacao',user='7',show=true){
  const child=kind==='anotacao'?h(EditorAnotacaoCard,{card,accent:'1,2,3',podeEditar:true,onInteracaoCriada:vi.fn()}):kind==='checklist'?h(PainelChecklistsCard,{card,accent:'1,2,3',podeEditar:true,realtimeRevision:0,onAtualizado:vi.fn()}):h(PainelCamposEtapaAtual,{card,campoIds:['campo'],instanceKey:'form',accent:'1,2,3',podeEditar:true,realtimeRevision:0,onAtualizado:vi.fn()});
  await act(async()=>root.render(h(CardSaveProvider,{key:user,userId:user,children:h(React.Fragment,null,h(Probe),show?child:null)})));
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
}
async function input(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});}
async function remount(kind:'anotacao'|'checklist'|'campos'='anotacao',user='7'){await act(async()=>root.render(null));await mount(kind,user);}

it('anotação registra pendência e o comando de salvar na saída aguarda sua confirmação',async()=>{
  await mount();await input(host.querySelector('textarea')!,'Anotação pendente');
  expect(context.getPendingFields('card')).toContain('Anotação');expect(await context.flushSaves('card')).toBe(false);
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});
  expect(api.anotar).toHaveBeenCalledOnce();expect(api.anotar).toHaveBeenCalledWith(expect.objectContaining({observacoes:'Anotação pendente',idempotencyKey:expect.any(String)}));
  expect(host.querySelector('textarea')?.value).toBe('');expect(localStorage.getItem(chaveRascunhosCrm('7')!)).toBeNull();
});
it('falha de anotação preserva texto, pendência e a mesma identidade no retry',async()=>{
  api.anotar.mockResolvedValueOnce({success:false,error:'offline'});await mount();await input(host.querySelector('textarea')!,'Não perder');
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(false);});
  expect(host.querySelector('textarea')?.value).toBe('Não perder');const first=api.anotar.mock.calls[0][0].idempotencyKey;
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});
  expect(api.anotar.mock.calls[1][0].idempotencyKey).toBe(first);
});
it('recarregar recupera anotação do usuário e exige revisão antes de reenviar',async()=>{
  await mount();await input(host.querySelector('textarea')!,'Recuperar');await remount();
  expect(host.querySelector('textarea')?.value).toBe('Recuperar');expect(context.getRecoveredDraftKeys('card')).toEqual(['card:anotacao']);
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(false);});expect(api.anotar).not.toHaveBeenCalled();
  await act(async()=>context.acknowledgeRecoveredDrafts('card'));
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});expect(api.anotar).toHaveBeenCalledOnce();
});
it('outro usuário não recebe rascunho e descarte explícito só remove o card da conta atual',async()=>{
  await mount();await input(host.querySelector('textarea')!,'Privado de sete');await mount('anotacao','8');expect(host.querySelector('textarea')?.value).toBe('');
  expect(localStorage.getItem(chaveRascunhosCrm('7')!)).toContain('Privado de sete');await mount('anotacao','7');
  await act(async()=>context.discardPending('card'));await remount();expect(host.querySelector('textarea')?.value).toBe('');
});
it('saída do navegador avisa enquanto houver alteração e deixa de avisar depois de salvar',async()=>{
  await mount();await input(host.querySelector('textarea')!,'Pendente');const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
  await act(async()=>{await context.retryFailedSaves('card');});const clean=new Event('beforeunload',{cancelable:true});window.dispatchEvent(clean);expect(clean.defaultPrevented).toBe(false);
});
it('um save e a tentativa de fechar em paralelo enviam uma única anotação',async()=>{
  let release!:(value:unknown)=>void;api.anotar.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  await mount();await input(host.querySelector('textarea')!,'Única');await act(async()=>host.querySelector('button')!.click());
  let closed!:Promise<boolean>;await act(async()=>{closed=context.retryFailedSaves('card');await Promise.resolve();});
  expect(api.anotar).toHaveBeenCalledOnce();await act(async()=>{release({success:true,data:{id:'nota'}});await closed;});expect(api.anotar).toHaveBeenCalledOnce();
});
it('salvar item B preserva observação ainda não enviada de A e a inclui no salvamento de saída',async()=>{
  await mount('checklist');await input(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')!,'Texto de A');
  await act(async()=>{const select=host.querySelectorAll('select')[1];select.value='7';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')?.value).toBe('Texto de A');
  expect(context.getPendingFields('card')).toContain('Observação de Documento A');
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});
  expect(api.atualizar).toHaveBeenCalledWith(expect.objectContaining({itemId:'a',observacao:'Texto de A',versaoEsperadaEm:baseDate}));
});
it('falha de procedimento não apaga observação e permite tentar novamente',async()=>{
  api.atualizar.mockResolvedValueOnce({success:false,error:'indisponível'});await mount('checklist');await input(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')!,'Preservar A');
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(false);});expect(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')?.value).toBe('Preservar A');
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});
});
it('reabre procedimento com observação recuperada e versão-base preservada',async()=>{
  await mount('checklist');await input(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')!,'Recuperada A');await remount('checklist');
  expect(host.querySelector<HTMLInputElement>('[aria-label="Observação de Documento A"]')?.value).toBe('Recuperada A');expect(context.getDraftBase('card:procedimentos')?.valores['versao:a']).toBe(baseDate);
});
it('campos comuns recuperam a base anterior e mostram conflito se o servidor mudou',async()=>{
  await mount('campos');await input(host.querySelector<HTMLInputElement>('#campo-bpm-campo')!,'Meu texto');
  expect(context.getDraftBase('card-form')?.valores.campo).toBe('Servidor');
  const old=card.camposEtapa[0].valor;const version=card.updatedAt;card.camposEtapa[0].valor='Outra sessão';card.updatedAt=new Date('2026-10-26T13:00:00Z');
  await remount('campos');expect(host.querySelector<HTMLInputElement>('#campo-bpm-campo')?.value).toBe('Meu texto');
  expect(host.textContent).toContain('Manter meus valores para revisão');expect(api.campos).not.toHaveBeenCalled();
  card.camposEtapa[0].valor=old;card.updatedAt=version;
});

it('recuperar e salvar campos libera todas as pendências e permite sair',async()=>{
  await mount('campos');await input(host.querySelector<HTMLInputElement>('#campo-bpm-campo')!,'Recuperar e salvar');await remount('campos');
  await act(async()=>context.acknowledgeRecoveredDrafts('card'));
  api.campos.mockResolvedValue({success:true,data:{updatedAt:new Date('2026-10-26T13:00:00Z'),camposValores:{campo:'Recuperar e salvar'}}});
  await act(async()=>{expect(await context.retryFailedSaves('card')).toBe(true);});
  expect(api.campos).toHaveBeenCalled();
  expect(localStorage.getItem(chaveRascunhosCrm('7')!)).toBeNull();
  expect(context.getPendingFields('card')).toEqual([]);
  expect(await context.flushSaves('card')).toBe(true);
  const exit = new Event('beforeunload', {cancelable:true});window.dispatchEvent(exit);expect(exit.defaultPrevented).toBe(false);
});

it('recuperação de formato anterior normaliza pendência de formulário e descarte libera navegação',async()=>{
  await mount('campos');await input(host.querySelector<HTMLInputElement>('#campo-bpm-campo')!,'Rascunho antigo');
  const key=chaveRascunhosCrm('7')!;const saved=JSON.parse(localStorage.getItem(key)!);delete saved['card-form'].pendingKey;localStorage.setItem(key,JSON.stringify(saved));
  await remount('campos');await act(async()=>context.discardPending('card'));
  expect(context.getPendingFields()).toEqual([]);expect(await context.flushSaves()).toBe(true);
});
