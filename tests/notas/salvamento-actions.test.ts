import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),access:vi.fn(),transaction:vi.fn(),find:vi.fn(),updateMany:vi.fn(),version:vi.fn(),confirmed:vi.fn()}));
vi.mock('../../auth',()=>({auth:mocks.auth}));
vi.mock('@/lib/notas/permissoes',()=>({podeEditarNota:mocks.access,podeVisualizarNota:vi.fn(),podeArquivarNota:vi.fn(),podeRestaurarNota:vi.fn(),podeExcluirNota:vi.fn(),podeExcluirDefinitivamenteNota:vi.fn(),temAcessoAoModuloNotas:vi.fn()}));
vi.mock('@/lib/prisma',()=>({default:{$transaction:mocks.transaction}}));
import { AtualizarNota } from '@/actions/Notas';
const tx={note:{findUnique:mocks.find,updateMany:mocks.updateMany,findUniqueOrThrow:mocks.confirmed},noteVersion:{create:mocks.version}};
beforeEach(()=>{
  vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:'7',role:'User'}});mocks.access.mockResolvedValue(true);
  mocks.find.mockResolvedValue({currentVersion:3,title:'Título anterior',contentJson:{text:'Conteúdo'},plainText:'Conteúdo',deletedAt:null});
  mocks.updateMany.mockResolvedValue({count:1});mocks.confirmed.mockResolvedValue({id:'nota',title:'Novo',currentVersion:4,updatedAt:new Date()});
  mocks.transaction.mockImplementation(async (callback: (client:typeof tx)=>unknown)=>callback(tx));
});
describe('atualização atômica e erros estruturados de notas',()=>{
  it('usa comparação atômica de versão e grava o histórico na mesma transação',async()=>{
    expect((await AtualizarNota({id:'nota',baseVersion:3,title:'Novo'})).success).toBe(true);
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{id:'nota',currentVersion:3,deletedAt:null},data:expect.objectContaining({currentVersion:4,title:'Novo',contentJson:undefined,plainText:undefined})}));
    expect(mocks.version).toHaveBeenCalledWith({data:expect.objectContaining({version:4,title:'Novo',plainText:'Conteúdo',contentJson:{text:'Conteúdo'},changedById:7})});
  });
  it('rejeita versão obsoleta sem escrita',async()=>{
    expect(await AtualizarNota({id:'nota',baseVersion:2,title:'Antigo'})).toMatchObject({success:false,error:'CONFLITO_VERSAO',versaoAtual:3});
    expect(mocks.updateMany).not.toHaveBeenCalled();expect(mocks.version).not.toHaveBeenCalled();
  });
  it('detecta disputa posterior à leitura sem inserir uma versão de histórico',async()=>{
    mocks.updateMany.mockResolvedValue({count:0});
    expect(await AtualizarNota({id:'nota',baseVersion:3,title:'Concorrente'})).toEqual({success:false,error:'CONFLITO_VERSAO'});
    expect(mocks.version).not.toHaveBeenCalled();
  });
  it('retorna erro estruturado se a gravação do histórico falha',async()=>{
    mocks.version.mockRejectedValue(new Error('falha simulada'));
    expect(await AtualizarNota({id:'nota',baseVersion:3,title:'Novo'})).toEqual({success:false,error:'Não foi possível salvar a nota. Tente novamente.'});
    expect(mocks.confirmed).not.toHaveBeenCalled();
  });
  it('traduz conflito de transação em conflito recuperável',async()=>{
    mocks.transaction.mockRejectedValue(Object.assign(new Error('concorrência'),{code:'P2034'}));
    expect(await AtualizarNota({id:'nota',baseVersion:3,title:'Novo'})).toEqual({success:false,error:'CONFLITO_VERSAO'});
  });
  it('nega edição antes de abrir a transação',async()=>{
    mocks.access.mockResolvedValue(false);
    expect(await AtualizarNota({id:'nota',baseVersion:3,title:'Novo'})).toEqual({success:false,error:'Sem permissão para editar esta nota'});
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
