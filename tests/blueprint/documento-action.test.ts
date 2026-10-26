import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),access:vi.fn(),transaction:vi.fn(),find:vi.fn(),create:vi.fn(),update:vi.fn(),activity:vi.fn(),cache:vi.fn()}));
vi.mock('../../auth',()=>({auth:mocks.auth}));
vi.mock('next/cache',()=>({revalidatePath:mocks.cache}));
vi.mock('@/lib/blueprint/ownership',()=>({exigirAcessoBlueprint:mocks.access}));
vi.mock('@/lib/prisma',()=>({default:{$transaction:mocks.transaction}}));
import { SalvarDocumentoBlueprint } from '@/actions/BlueprintDocuments';
const projectId='c000000000000000000000001',documentId='c000000000000000000000002',creationKey='00000000-0000-4000-8000-000000000001';
const input={projectId,creationKey,title:'Especificação',contentJson:'{}',contentText:'Conteúdo'};
const doc={...input,id:documentId,createdById:1,updatedById:null,createdAt:new Date(),updatedAt:new Date(),order:0};
const tx={blueprintDocument:{findUnique:mocks.find,create:mocks.create,updateMany:mocks.update},blueprintActivity:{create:mocks.activity}};
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:'1',role:'User'}});mocks.access.mockResolvedValue({autorizado:true});mocks.transaction.mockImplementation(callback=>callback(tx));mocks.find.mockResolvedValueOnce(null).mockResolvedValue(doc);mocks.create.mockResolvedValue(doc);mocks.activity.mockResolvedValue({});});
it('revalida acesso usando o client transacional e confirma criação pelo retorno persistido',async()=>{
  expect(await SalvarDocumentoBlueprint(input)).toEqual({success:true,data:doc});
  expect(mocks.access).toHaveBeenNthCalledWith(2,projectId,1,'User','editarDocumento',tx);
});
it('revogação antes da escrita na transação não cria documento ou atividade',async()=>{
  mocks.access.mockResolvedValueOnce({autorizado:true}).mockRejectedValueOnce(new Error('Não autorizado'));
  expect(await SalvarDocumentoBlueprint(input)).toEqual({success:false,error:'Não autorizado'});
  expect(mocks.create).not.toHaveBeenCalled();expect(mocks.activity).not.toHaveBeenCalled();
});
it('falha de cache posterior ao commit mantém confirmação verdadeira do salvamento',async()=>{
  mocks.cache.mockImplementation(()=>{throw new Error('cache fora do ar');});
  expect(await SalvarDocumentoBlueprint(input)).toEqual({success:true,data:doc});expect(mocks.transaction).toHaveBeenCalledOnce();
});
it('falha de histórico retorna erro estruturado para preservar o rascunho',async()=>{
  mocks.activity.mockRejectedValue(new Error('histórico fora do ar'));
  expect(await SalvarDocumentoBlueprint(input)).toEqual({success:false,error:'Erro ao salvar documento'});
  expect(mocks.cache).not.toHaveBeenCalled();
});
it('payload sem versão-base ou intenção estável é recusado antes de gravar',async()=>{
  expect((await SalvarDocumentoBlueprint({...input,documentId})).success).toBe(false);
  expect((await SalvarDocumentoBlueprint({...input,creationKey:undefined})).success).toBe(false);
  expect((await SalvarDocumentoBlueprint({...input,contentJson:'JSON inválido'})).success).toBe(false);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
