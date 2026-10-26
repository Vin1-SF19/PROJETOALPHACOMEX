// @vitest-environment happy-dom
import React, {act,createElement as h} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NoteEditor} from '@/components/Notas/NoteEditor/NoteEditor';
import {AtualizarNota,ObterNota,ArquivarNota,MoverNotaParaLixeira} from '@/actions/Notas';
import {PainelPropriedades} from '@/components/Notas/Central/PainelPropriedades';
import {getNotaRascunhoStorageKey} from '@/lib/notas-tabs';
import {renomearNotaPreservandoRascunho} from '@/lib/notas/salvamento-client';
import {toast} from 'sonner';
const tiptap=vi.hoisted(()=>{
  const state={text:'Original',update:undefined as undefined|((event:{editor:unknown})=>void)};
  const editor={getJSON:()=>({type:'doc',text:state.text}),getText:()=>state.text,setEditable:vi.fn(),commands:{setContent:vi.fn()}};
  return {state,editor};
});
vi.mock('@tiptap/react',()=>({useEditor:(options:{onUpdate:typeof tiptap.state.update})=>{tiptap.state.update=options.onUpdate;return tiptap.editor;}}));
vi.mock('@/components/Notas/NoteEditor/NoteEditorPrimitives',()=>({criarExtensoesEditorNote:()=>[],NoteEditorContent:()=>null,NoteEditorToolbar:({status}:{status:React.ReactNode})=>h('div',{'data-status':true},status)}));
vi.mock('@/actions/Notas',()=>({AtualizarNota:vi.fn(),ObterNota:vi.fn(),ArquivarNota:vi.fn(),MoverNotaParaLixeira:vi.fn(),ExcluirNotaDefinitivamente:vi.fn()}));
vi.mock('@/actions/NotasBusca',()=>({FixarNota:vi.fn(),FavoritarNota:vi.fn()}));
vi.mock('@/actions/NotasWorkspace',()=>({FecharAbaNota:vi.fn()}));
vi.mock('@/components/ui/dock',()=>({Dock:({children}:{children:React.ReactNode})=>h('div',null,children),DockItem:({children}:{children:React.ReactNode})=>h('div',null,children),DockIcon:({children}:{children:React.ReactNode})=>h('span',null,children),DockLabel:({children}:{children:React.ReactNode})=>h('span',null,children)}));
vi.mock('@/components/Notas/Colaboracao/NoteShareDialog',()=>({NoteShareDialog:()=>null}));
vi.mock('@/components/Notas/Colaboracao/NoteHistoryDialog',()=>({NoteHistoryDialog:()=>null}));
vi.mock('@/components/Notas/Colaboracao/NoteCommentsPanel',()=>({NoteCommentsPanel:()=>null}));
vi.mock('@/components/Notas/Anexos/ListaAnexos',()=>({ListaAnexos:()=>null}));
vi.mock('@/components/Notas/Lembretes/CriarLembreteDialog',()=>({CriarLembreteDialog:()=>null}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
let root:Root;let host:HTMLDivElement;
const key=getNotaRascunhoStorageKey('note',1);
beforeEach(()=>{
  vi.resetAllMocks();vi.useFakeTimers();localStorage.clear();
  Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);tiptap.state.text='Original';
  vi.mocked(AtualizarNota).mockResolvedValue({success:true,data:{id:'note',title:'Título',currentVersion:2,updatedAt:new Date()}});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
async function mount(version=1,readonly=false){await act(async()=>root.render(h(NoteEditor,{noteId:'note',usuarioAtualId:1,initialTitle:'Título',initialContentJson:{type:'doc'},initialVersion:version,somenteLeitura:readonly})));}
async function type(text:string){await act(async()=>{tiptap.state.text=text;tiptap.state.update?.({editor:tiptap.editor});});}
async function tick(){await act(async()=>{await vi.advanceTimersByTimeAsync(1500);});}
const status=()=>host.querySelector('[data-status]')?.textContent;

it('mantém rascunho e indicador enquanto a revisão mais recente aguarda confirmação',async()=>{
  let first!: (value:Awaited<ReturnType<typeof AtualizarNota>>)=>void;
  let second!: (value:Awaited<ReturnType<typeof AtualizarNota>>)=>void;
  vi.mocked(AtualizarNota).mockImplementationOnce(()=>new Promise(resolve=>{first=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{second=resolve;}));
  await mount();await type('A');await tick();await type('B');
  await act(async()=>{first({success:true,data:{id:'note',title:'Título',currentVersion:2,updatedAt:new Date()}});});
  expect(status()).not.toBe('Salvo');expect(localStorage.getItem(key)).toContain('B');
  expect(AtualizarNota).toHaveBeenNthCalledWith(2,expect.objectContaining({plainText:'B',baseVersion:2}));
  await act(async()=>{second({success:true,data:{id:'note',title:'Título',currentVersion:3,updatedAt:new Date()}});});
  expect(status()).toBe('Salvo');expect(localStorage.getItem(key)).toBeNull();
});
it('retoma pendência ao receber online',async()=>{
  vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
  await mount();await type('Offline');await tick();expect(status()).toContain('Sem conexão');
  vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
  await act(async()=>window.dispatchEvent(new Event('online')));
  expect(AtualizarNota).toHaveBeenCalledWith(expect.objectContaining({plainText:'Offline'}));expect(status()).toBe('Salvo');
});
it('restaura e envia rascunho compatível sem precisar digitar novamente',async()=>{
  localStorage.setItem(key,JSON.stringify({title:'Recuperado',contentJson:{type:'doc'},plainText:'Local',baseVersion:1}));
  await mount();expect(host.querySelector('input')?.value).toBe('Recuperado');await tick();
  expect(AtualizarNota).toHaveBeenCalledWith(expect.objectContaining({title:'Recuperado',plainText:'Local',baseVersion:1}));expect(status()).toBe('Salvo');
});
it('apresenta versão divergente e não a sobrescreve automaticamente',async()=>{
  localStorage.setItem(key,JSON.stringify({title:'Local',contentJson:{type:'doc'},plainText:'Local',baseVersion:1}));
  await mount(3);await tick();expect(host.querySelector('input')?.value).toBe('Local');expect(status()).toBe('Conflito de versão');expect(AtualizarNota).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Descartar rascunho e carregar versão salva');
});
it('captura erro de transporte e oferece tentativa manual com conteúdo preservado',async()=>{
  vi.mocked(AtualizarNota).mockRejectedValueOnce(new Error('rede'));
  await mount();await type('Texto pendente');await tick();expect(status()).toBe('Falha ao salvar');expect(localStorage.getItem(key)).toContain('Texto pendente');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Tentar novamente')!.click());
  expect(status()).toBe('Salvo');expect(localStorage.getItem(key)).toBeNull();
});
it('permite escolher a versão salva e só então descarta o rascunho divergente',async()=>{
  localStorage.setItem(key,JSON.stringify({title:'Local',contentJson:{type:'doc'},plainText:'Local',baseVersion:1}));
  vi.mocked(ObterNota).mockResolvedValue({success:true,somenteLeitura:false,data:{id:'note',title:'Remoto',contentJson:{type:'doc'},plainText:'Remoto',currentVersion:4}} as unknown as Awaited<ReturnType<typeof ObterNota>>);
  await mount(3);
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Descartar rascunho'))!.click());
  expect(host.querySelector('input')?.value).toBe('Remoto');expect(status()).toBe('Salvo');expect(localStorage.getItem(key)).toBeNull();expect(AtualizarNota).not.toHaveBeenCalled();
});
it('renomeação pela aba salva título junto ao texto pendente no editor',async()=>{
  await mount();await type('Conteúdo ainda pendente');
  await act(async()=>{expect(await renomearNotaPreservandoRascunho('note','Título novo',async()=>false)).toBe(true);});
  expect(AtualizarNota).toHaveBeenCalledWith(expect.objectContaining({title:'Título novo',plainText:'Conteúdo ainda pendente'}));expect(host.querySelector('input')?.value).toBe('Título novo');
});
it('não restaura rascunho de outro usuário nem o legado sem identidade',async()=>{
  localStorage.setItem(getNotaRascunhoStorageKey('note',2),JSON.stringify({title:'Outra conta',contentJson:{type:'doc'},baseVersion:1}));
  localStorage.setItem(getNotaRascunhoStorageKey('note'),JSON.stringify({title:'Legado sem dono',contentJson:{type:'doc'},baseVersion:1}));
  await mount();await tick();expect(host.querySelector('input')?.value).toBe('Título');expect(AtualizarNota).not.toHaveBeenCalled();
});
it.each(['arquivar','lixeira'])('negativa de %s preserva rascunho e mostra erro',async action=>{
  vi.mocked(ArquivarNota).mockResolvedValue({success:false,error:'Sem permissão'});vi.mocked(MoverNotaParaLixeira).mockResolvedValue({success:false,error:'Sem permissão'});
  const nota={id:'note',title:'Título',status:'ATIVA',isFavorite:false,isPinned:false,color:null,icon:null,contexts:[],tags:[],visibility:'PRIVADA',owner:{id:1,nome:'Pessoa fictícia'},createdAt:'2026-10-26',updatedAt:'2026-10-26',_count:{comments:0,attachments:0}};
  localStorage.setItem(key,'conteúdo pendente');
  await act(async()=>root.render(h(PainelPropriedades,{nota,usuarioAtualId:1,onAtualizado:vi.fn(),accent:'1,2,3'})));
  await act(async()=>host.querySelector<HTMLButtonElement>(`[data-guia-notas="acao-${action}"]`)!.click());
  expect(toast.error).toHaveBeenCalledWith('Sem permissão');expect(toast.success).not.toHaveBeenCalled();expect(localStorage.getItem(key)).toBe('conteúdo pendente');
});


it('arquivar espera o salvamento do editor e bloqueia o encerramento se ele falhar',async()=>{
  vi.mocked(AtualizarNota).mockRejectedValueOnce(new Error('rede indisponível'));
  vi.mocked(ArquivarNota).mockResolvedValue({success:true});
  const nota={id:'note',title:'Título',status:'ATIVA',isFavorite:false,isPinned:false,color:null,icon:null,contexts:[],tags:[],visibility:'PRIVADA',owner:{id:1,nome:'Pessoa fictícia'},createdAt:'2026-10-26',updatedAt:'2026-10-26',_count:{comments:0,attachments:0}};
  await act(async()=>root.render(h(React.Fragment,null,h(NoteEditor,{noteId:'note',usuarioAtualId:1,initialTitle:'Título',initialContentJson:{type:'doc'},initialVersion:1}),h(PainelPropriedades,{nota,usuarioAtualId:1,onAtualizado:vi.fn(),accent:'1,2,3'}))));
  await type('Texto ainda no debounce');
  await act(async()=>host.querySelector<HTMLButtonElement>('[data-guia-notas="acao-arquivar"]')!.click());
  expect(AtualizarNota).toHaveBeenCalledWith(expect.objectContaining({plainText:'Texto ainda no debounce'}));
  expect(ArquivarNota).not.toHaveBeenCalled();expect(localStorage.getItem(key)).toContain('Texto ainda no debounce');
  expect(toast.error).toHaveBeenCalled();
  await act(async()=>host.querySelector<HTMLButtonElement>('[data-guia-notas="acao-arquivar"]')!.click());
  expect(ArquivarNota).toHaveBeenCalledOnce();expect(localStorage.getItem(key)).toBeNull();
});
