// @vitest-environment happy-dom
import React, { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SpecificationEditor } from '@/components/AlphaBlueprint/SpecificationEditor';
import { ListarDocumentosBlueprint, SalvarDocumentoBlueprint } from '@/actions/BlueprintDocuments';
import { chaveRascunhoDocumentoBlueprint, guardarRascunhoDocumentoBlueprint } from '@/lib/blueprint/documento-rascunho';

const tiptap=vi.hoisted(()=>{
  const state={text:'',update:()=>{}};
  const editor={getJSON:()=>({type:'doc',content:[{type:'text',text:state.text}]}),getText:()=>state.text,setEditable:vi.fn(),isActive:()=>false,commands:{setContent:vi.fn((json:{content?:Array<{text?:string}>})=>{state.text=json.content?.[0]?.text??'';state.update();})}};
  return {state,editor};
});
vi.mock('@tiptap/react',()=>({useEditor:(options:{onUpdate:()=>void})=>{tiptap.state.update=options.onUpdate;return tiptap.editor;},EditorContent:()=>null}));
vi.mock('@/actions/BlueprintDocuments',()=>({ListarDocumentosBlueprint:vi.fn(),SalvarDocumentoBlueprint:vi.fn()}));
const projectId='c000000000000000000000001',documentId='c000000000000000000000002';
const initialDate=new Date('2026-10-26T10:00:00Z'),firstDate=new Date('2026-10-26T10:01:00Z'),secondDate=new Date('2026-10-26T10:02:00Z');
type SaveResult=Awaited<ReturnType<typeof SalvarDocumentoBlueprint>>;
type Document=NonNullable<Awaited<ReturnType<typeof ListarDocumentosBlueprint>>['data']>[number];
const doc=(text:string,updatedAt=initialDate)=>({id:documentId,projectId,title:'Especificação',contentJson:JSON.stringify({type:'doc',content:[{type:'text',text}]}),contentText:text,updatedAt,createdAt:initialDate,createdById:1,updatedById:1,order:0} satisfies Document);
let root:Root,host:HTMLDivElement;
const key=(userId=1)=>chaveRascunhoDocumentoBlueprint(userId,projectId);
async function mount(userId=1){await act(async()=>root.render(h(SpecificationEditor,{key:userId,projectId,userId,accent:'1,2,3'})));}
async function edit(text:string){await act(async()=>{tiptap.state.text=text;tiptap.state.update();});}
async function tick(ms=1500){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});}
beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();localStorage.clear();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.spyOn(navigator,'onLine','get').mockReturnValue(true);host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.mocked(ListarDocumentosBlueprint).mockResolvedValue({success:true,data:[doc('Original')]});tiptap.editor.commands.setContent.mockImplementation(json=>{tiptap.state.text=json.content?.[0]?.text??'';tiptap.state.update();});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});

it('resposta de A não limpa B, a fila usa a nova base e só confirma a última revisão',async()=>{
  let resolveA!:(r:SaveResult)=>void,resolveB!:(r:SaveResult)=>void;
  vi.mocked(SalvarDocumentoBlueprint).mockImplementationOnce(()=>new Promise(resolve=>{resolveA=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{resolveB=resolve;}));
  await mount();await edit('A');await tick();await edit('B');
  await act(async()=>{resolveA({success:true,data:doc('A',firstDate)});});
  expect(SalvarDocumentoBlueprint).toHaveBeenCalledTimes(2);
  expect(SalvarDocumentoBlueprint).toHaveBeenLastCalledWith(expect.objectContaining({contentText:'B',baseUpdatedAt:firstDate.toISOString()}));
  expect(localStorage.getItem(key())).toContain('B');expect(host.textContent).not.toContain('Salvo');
  await act(async()=>{resolveB({success:true,data:doc('B',secondDate)});});
  expect(localStorage.getItem(key())).toBeNull();expect(host.textContent).toContain('Salvo');
});
it('falha de transporte mantém o texto e permite tentativa manual sem redigitar',async()=>{
  vi.mocked(SalvarDocumentoBlueprint).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({success:true,data:doc('Pendente',firstDate)});
  await mount();await edit('Pendente');await tick();expect(host.textContent).toContain('Falha de conexão');expect(localStorage.getItem(key())).toContain('Pendente');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Tentar salvar novamente')!.click());
  expect(SalvarDocumentoBlueprint).toHaveBeenCalledTimes(2);expect(localStorage.getItem(key())).toBeNull();
});
it('reconectar retoma o envio de rascunho offline',async()=>{
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);await mount();await edit('Offline');await tick();expect(SalvarDocumentoBlueprint).not.toHaveBeenCalled();
  vi.mocked(SalvarDocumentoBlueprint).mockResolvedValue({success:true,data:doc('Offline',firstDate)});vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
  await act(async()=>window.dispatchEvent(new Event('online')));
  expect(SalvarDocumentoBlueprint).toHaveBeenCalledOnce();expect(host.textContent).toContain('Salvo');
});
it('rascunho de versão antiga fica visível e exige resolução explícita',async()=>{
  guardarRascunhoDocumentoBlueprint({userId:1,projectId,creationKey:'00000000-0000-4000-8000-000000000001',documentId,baseUpdatedAt:initialDate.toISOString(),contentJson:doc('Meu rascunho').contentJson,contentText:'Meu rascunho',revision:1});
  vi.mocked(ListarDocumentosBlueprint).mockResolvedValue({success:true,data:[doc('Remoto',firstDate)]});
  await mount();await tick();expect(tiptap.state.text).toBe('Meu rascunho');expect(host.textContent).toContain('Conflito de versão');expect(SalvarDocumentoBlueprint).not.toHaveBeenCalled();
  vi.mocked(SalvarDocumentoBlueprint).mockResolvedValue({success:true,data:doc('Meu rascunho',secondDate)});
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Salvar meu rascunho')!.click());
  expect(SalvarDocumentoBlueprint).toHaveBeenCalledWith(expect.objectContaining({contentText:'Meu rascunho',baseUpdatedAt:firstDate.toISOString()}));
});
it('rascunhos são isolados por usuário e a criação conserva a mesma chave após reabrir',async()=>{
  vi.mocked(ListarDocumentosBlueprint).mockResolvedValue({success:true,data:[]});vi.mocked(SalvarDocumentoBlueprint).mockRejectedValue(new Error('resposta incerta'));
  await mount();await edit('Nova especificação');await tick();const intent=JSON.parse(localStorage.getItem(key())!).creationKey;
  await mount(2);expect(tiptap.state.text).toBe('');expect(localStorage.getItem(key())).toContain('Nova especificação');
  await mount(1);await tick();expect(SalvarDocumentoBlueprint).toHaveBeenLastCalledWith(expect.objectContaining({creationKey:intent,documentId:undefined,contentText:'Nova especificação'}));
});
it('falha de carga não libera edição ou indica Salvo',async()=>{
  vi.mocked(ListarDocumentosBlueprint).mockResolvedValue({success:false,error:'não autorizado',data:[]});
  await mount();expect(host.textContent).toContain('Não foi possível carregar');expect(host.textContent).not.toContain('Salvo');expect(tiptap.editor.setEditable).not.toHaveBeenCalledWith(true);
});

it('confirmação de outra instância não remove um rascunho local mais recente',async()=>{
  let resolve!:(result:SaveResult)=>void;
  vi.mocked(SalvarDocumentoBlueprint).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await mount();await edit('Enviado por esta instância');await tick();
  const other=JSON.parse(localStorage.getItem(key())!);
  guardarRascunhoDocumentoBlueprint({...other,contentText:'Texto de outra aba',contentJson:doc('Texto de outra aba').contentJson,revision:other.revision+1});
  await act(async()=>{resolve({success:true,data:doc('Enviado por esta instância',firstDate)});});
  expect(localStorage.getItem(key())).toContain('Texto de outra aba');
});

it.each(['conteudo', 'token', 'versao'] as const)('resposta de A não regrava a base de A2 sobre outra instância com %s diferente',async(diferenca)=>{
  let resolveA!:(result:SaveResult)=>void;
  vi.mocked(SalvarDocumentoBlueprint)
    .mockImplementationOnce(()=>new Promise(done=>{resolveA=done;}))
    .mockResolvedValueOnce({success:false,error:'CONFLITO_DOCUMENTO',data:doc('Servidor',secondDate)});
  await mount();await edit('A');await tick();await edit('A2');
  const pending=JSON.parse(localStorage.getItem(key())!);
  expect(pending.token).toEqual(expect.any(String));
  const other={...pending,...(diferenca==='conteudo'
    ? {contentText:'B em outra aba',contentJson:doc('B em outra aba').contentJson}
    : diferenca==='token' ? {token:crypto.randomUUID()} : {baseUpdatedAt:secondDate.toISOString()})};
  guardarRascunhoDocumentoBlueprint(other);
  const stored=localStorage.getItem(key());
  await act(async()=>{resolveA({success:true,data:doc('A',firstDate)});});
  expect(SalvarDocumentoBlueprint).toHaveBeenCalledTimes(2);
  expect(SalvarDocumentoBlueprint).toHaveBeenLastCalledWith(expect.objectContaining({contentText:'A2',baseUpdatedAt:firstDate.toISOString()}));
  expect(host.textContent).toContain('Conflito de versão');
  expect(localStorage.getItem(key())).toBe(stored);
  expect(tiptap.state.text).toBe('A2');
});

it('uma nova revisão recebe outro token e confirmações mantêm o token ao atualizar a base',async()=>{
  let resolveA!:(result:SaveResult)=>void;
  vi.mocked(SalvarDocumentoBlueprint)
    .mockImplementationOnce(()=>new Promise(done=>{resolveA=done;}))
    .mockRejectedValueOnce(new Error('rede'));
  await mount();await edit('A');await tick();
  const first=JSON.parse(localStorage.getItem(key())!);
  await edit('A2');
  const second=JSON.parse(localStorage.getItem(key())!);
  expect(second.token).not.toBe(first.token);
  await act(async()=>{resolveA({success:true,data:doc('A',firstDate)});});
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual({...second,baseUpdatedAt:firstDate.toISOString()});
});

it.each(['token','versao'] as const)('confirmação não limpa conteúdo idêntico de outra instância com %s diferente',async(diferenca)=>{
  let resolve!:(result:SaveResult)=>void;
  vi.mocked(SalvarDocumentoBlueprint).mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  await mount();await edit('Mesmo texto');await tick();
  const pending=JSON.parse(localStorage.getItem(key())!);
  guardarRascunhoDocumentoBlueprint({...pending,...(diferenca==='token'?{token:crypto.randomUUID()}:{baseUpdatedAt:secondDate.toISOString()})});
  const stored=localStorage.getItem(key());
  await act(async()=>{resolve({success:true,data:doc('Mesmo texto',firstDate)});});
  expect(localStorage.getItem(key())).toBe(stored);
});
