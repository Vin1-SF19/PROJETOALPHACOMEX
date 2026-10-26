import { describe, expect, it, vi } from 'vitest';
import { SalvamentoNota, registrarRenomeacaoEditor, renomearNotaPreservandoRascunho } from '@/lib/notas/salvamento-client';
import { getNotaRascunhoStorageKey } from '@/lib/notas-tabs';

function setup(version = 1) {
  const data = new Map<string,string>();
  const storage = {getItem: (key:string)=>data.get(key)??null,setItem: (key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
  const update = vi.fn(async () => ({success:true as const,data:{currentVersion:2}}));
  const online = vi.fn(()=>true);
  const options = {noteId:'nota',version,content:{title:'Título',contentJson:{type:'doc'},plainText:'Original'},storageKey:'draft',storage:()=>storage,online,update};
  const session = new SalvamentoNota(options);
  const change = (text:string) => session.change({title:'Título',contentJson:{text},plainText:text});
  return {session,storage,update,online,options,change};
}

describe('salvamento de notas com revisão e recuperação',()=>{
  it('confirma A sem apagar B e enfileira B na versão retornada por A',async()=>{
    const {session,storage,update,change}=setup();
    let release!: (v: {success:true;data:{currentVersion:number}})=>void;
    update.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const statuses:string[]=[];session.subscribe(s=>{statuses.push(s);});
    change('A');const save=session.save();change('B');
    expect(storage.getItem('draft')).toContain('B');
    expect(update).toHaveBeenCalledOnce();
    release({success:true,data:{currentVersion:2}});
    expect(await save).toBe(true);
    expect(update).toHaveBeenNthCalledWith(2,expect.objectContaining({plainText:'B',baseVersion:2}));
    expect(statuses.slice(statuses.indexOf('salvando'))).toEqual(['salvando','pendente','pendente','salvando','salvo']);
    expect(storage.getItem('draft')).toBeNull();
  });
  it('preserva B quando seu envio falha após A ter sido confirmado',async()=>{
    const {session,storage,update,change}=setup();
    let release!: (v:{success:true;data:{currentVersion:number}})=>void;
    update.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockRejectedValueOnce(new Error('rede'));
    change('A');const save=session.save();change('B');release({success:true,data:{currentVersion:2}});
    expect(await save).toBe(false);expect(session.status).toBe('erro');
    expect(JSON.parse(storage.getItem('draft')!)).toMatchObject({plainText:'B',baseVersion:2});
  });
  it('não remove o rascunho de uma instância posterior ao confirmar',async()=>{
    const {session,storage,update,change}=setup();
    let release!: (v:{success:true;data:{currentVersion:number}})=>void;
    update.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    change('A');const save=session.save();storage.setItem('draft',JSON.stringify({title:'Outra aba',contentJson:{},baseVersion:1,token:'outro'}));
    release({success:true,data:{currentVersion:2}});await save;
    expect(storage.getItem('draft')).toContain('Outra aba');
  });
  it('mantém o rascunho offline e permite retomar com a mesma versão',async()=>{
    const {session,storage,update,change,online}=setup();online.mockReturnValue(false);change('Offline');
    expect(await session.save()).toBe(false);expect(session.status).toBe('offline');expect(update).not.toHaveBeenCalled();expect(storage.getItem('draft')).toContain('Offline');
    online.mockReturnValue(true);expect(await session.save()).toBe(true);expect(update).toHaveBeenCalledWith(expect.objectContaining({plainText:'Offline',baseVersion:1}));
  });
  it('preserva rascunho divergente até uma escolha explícita e mantém conflito ao remontar',async()=>{
    const {session,storage,update,options}=setup(4);
    storage.setItem('draft',JSON.stringify({title:'Local',contentJson:{text:'Rascunho'},plainText:'Rascunho',baseVersion:2}));
    expect(session.restore()?.title).toBe('Local');expect(session.status).toBe('conflito');
    session.change({...session.currentContent,plainText:'Revisado'});
    expect(await session.save()).toBe(false);expect(update).not.toHaveBeenCalled();
    const reopened=new SalvamentoNota(options);reopened.restore();expect(reopened.status).toBe('conflito');
    session.keepDraftOnVersion(4);expect(await session.save()).toBe(true);expect(update).toHaveBeenCalledWith(expect.objectContaining({baseVersion:4,plainText:'Revisado'}));
  });
  it('transforma uma rejeição em erro recuperável sem apagar conteúdo',async()=>{
    const {session,storage,update,change}=setup();update.mockRejectedValueOnce(new Error('db'));change('Preservar');
    expect(await session.save()).toBe(false);expect(session.status).toBe('erro');expect(storage.getItem('draft')).toContain('Preservar');
    expect(await session.save()).toBe(true);
  });
  it('isola rascunhos por usuário e não reutiliza o namespace legado',()=>{
    expect(getNotaRascunhoStorageKey('nota',1)).not.toBe(getNotaRascunhoStorageKey('nota',2));
    expect(getNotaRascunhoStorageKey('nota',1)).not.toBe(getNotaRascunhoStorageKey('nota'));
  });
  it('renomeia pelo editor registrado para preservar conteúdo ainda pendente',async()=>{
    const {session,update,change}=setup();change('Conteúdo pendente');
    const remove=registrarRenomeacaoEditor('nota',async title=>{session.change({...session.currentContent,title});return session.save();});
    const fallback=vi.fn(async()=>false);
    expect(await renomearNotaPreservandoRascunho('nota','Novo título',fallback)).toBe(true);
    expect(fallback).not.toHaveBeenCalled();expect(update).toHaveBeenCalledWith(expect.objectContaining({title:'Novo título',plainText:'Conteúdo pendente'}));
    remove();
    await renomearNotaPreservandoRascunho('nota','Outro',fallback);expect(fallback).toHaveBeenCalledOnce();
  });
});
