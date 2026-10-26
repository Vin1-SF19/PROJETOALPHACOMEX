import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma',()=>({default:{}}));
vi.mock('@/lib/bpm/campos-configuraveis-server',()=>({carregarValoresCanonicosCampos:vi.fn(async()=>({}))}));
import { carregarCamposRegistradosSemFormulario } from '@/lib/bpm/campos-registrados-sem-formulario-server';
import { validarValoresCamposBpm } from '@/lib/bpm/campos-dinamicos';
const pipelineId='pipeline',etapaId='etapa',cardId='card';
const field=(id:string,changes={})=>({id,chave:null,pipelineId,etapaId:null,nome:`Campo ${id}`,tipo:'texto',ordem:1,ativo:true,visivel:true,editavel:true,somenteLeitura:false,escopo:'CARD',fonteEntidade:null,fonteAtributo:null,entidadeGlobal:null,opcoesJson:null,configVersao:1,pipelinesAssociados:[],acessos:[],opcoes:[],etapaConfiguracoes:[],...changes});
const mocks={etapa:vi.fn(),card:vi.fn(),values:vi.fn(),fields:vi.fn(),mapping:vi.fn(),users:vi.fn()};
const client={bpmEtapa:{findUnique:mocks.etapa},bpmCard:{findUnique:mocks.card},bpmCardCampoValor:{findMany:mocks.values},bpmCampo:{findMany:mocks.fields},bpmCampoMapeamento:{findMany:mocks.mapping},usuarios:{findMany:mocks.users}};
const load=(profile:'ADMIN'|'RESPONSAVEL'|'MEMBRO'='MEMBRO')=>carregarCamposRegistradosSemFormulario(cardId,pipelineId,etapaId,client as never,profile);
beforeEach(()=>{vi.resetAllMocks();mocks.etapa.mockResolvedValue({pipelineId,formulario:null,campoConfiguracoes:[]});mocks.card.mockResolvedValue({pipelineId,etapaId});mocks.mapping.mockResolvedValue([]);mocks.users.mockResolvedValue([]);mocks.values.mockResolvedValue([{campoId:'existing',valor:'Valor existente'}]);mocks.fields.mockResolvedValue([field('existing')]);});

describe('edição dos dados registrados em etapa sem formulário',()=>{
  it('reapresenta somente campos já registrados sem criar obrigatoriedade/default',async()=>{
    mocks.fields.mockResolvedValue([field('existing'),field('novo')]);
    const result=await load();expect(result).toHaveLength(1);expect(result[0]).toMatchObject({id:'existing',valor:'Valor existente',editavel:true,obrigatorio:false,obrigatorioEntrada:false,obrigatorioSaida:false,valorPadrao:null});
    expect(validarValoresCamposBpm(result,{existing:'Valor editado'}).success).toBe(true);
    expect(validarValoresCamposBpm(result,{novo:'Injeção de campo'}).success).toBe(false);
  });
  it.each([{id:'publicado',ativo:true},{id:'inativo',ativo:false}])('formulário $id existente nunca ativa o fallback',async(formulario)=>{
    mocks.etapa.mockResolvedValue({pipelineId,formulario});expect(await load()).toEqual([]);expect(mocks.values).not.toHaveBeenCalled();
  });
  it('não substitui composição canônica existente, inclusive configuração oculta',async()=>{
    mocks.etapa.mockResolvedValue({pipelineId,formulario:null,campoConfiguracoes:[{id:'config-oculta'}]});
    expect(await load()).toEqual([]);expect(mocks.values).not.toHaveBeenCalled();
  });
  it('não reativa obrigatoriedade condicional ao hidratar dados registrados',async()=>{
    mocks.fields.mockResolvedValue([field('existing',{etapaConfiguracoes:[{condicaoObrigatoriedadeJson:'{"operador":"AND","condicoes":[]}'}]})]);
    expect((await load())[0]).toMatchObject({obrigatorio:false,obrigatorioEntrada:false,obrigatorioSaida:false,condicaoObrigatoriedadeJson:null});
  });
  it('recusa contexto de card ou etapa de outro pipeline',async()=>{
    mocks.card.mockResolvedValue({pipelineId:'outro',etapaId});expect(await load()).toEqual([]);
    mocks.card.mockResolvedValue({pipelineId,etapaId:'mudou'});expect(await load()).toEqual([]);
    mocks.card.mockResolvedValue({pipelineId,etapaId});mocks.etapa.mockResolvedValue({pipelineId:'outro',formulario:null,campoConfiguracoes:[]});expect(await load()).toEqual([]);
  });
  it('não expõe campo inativo, oculto ou de pipeline não associado',async()=>{
    mocks.fields.mockResolvedValue([field('existing',{ativo:false}),field('existing',{visivel:false}),field('existing',{pipelineId:'outro'})]);
    expect(await load()).toEqual([]);
  });
  it('aceita campo associado à pipeline, sem torná-lo obrigatório',async()=>{
    mocks.fields.mockResolvedValue([field('existing',{pipelineId:'outro',pipelinesAssociados:[{pipelineId}]})]);expect(await load()).toHaveLength(1);
  });
  it('preserva ACL de visibilidade e de leitura por perfil',async()=>{
    mocks.fields.mockResolvedValue([field('existing',{acessos:[{perfil:'MEMBRO',visivel:false,editavel:false,somenteLeitura:true}]})]);
    expect(await load('MEMBRO')).toEqual([]);expect(await load('RESPONSAVEL')).toHaveLength(1);
    mocks.fields.mockResolvedValue([field('existing',{acessos:[{perfil:'MEMBRO',visivel:true,editavel:true,somenteLeitura:true}]})]);
    const result=await load('MEMBRO');expect(result[0]).toMatchObject({somenteLeitura:true,editavel:false});
    expect(validarValoresCamposBpm(result,{existing:'Não autorizado'}).success).toBe(false);
  });
  it('preserva mapeamento de referência por meio da hidratação canônica',async()=>{
    mocks.values.mockResolvedValue([{campoId:'existing',valor:'Antes'},{campoId:'source',valor:'Canônico'}]);
    mocks.fields.mockResolvedValue([field('existing')]);
    mocks.mapping.mockResolvedValue([{campoOrigemId:'source',campoDestinoId:'existing',modo:'REFERENCIAR',ativo:true,campoOrigem:{id:'source',escopo:'CARD',fonteEntidade:null,fonteAtributo:null,entidadeGlobal:null}}]);
    const result=await load();expect(result[0]).toMatchObject({valor:'Canônico',somenteLeitura:true,editavel:false,mapeamentoModo:'REFERENCIAR'});
  });
  it('não cria campo nem aplica valor padrão em card sem valores registrados',async()=>{
    mocks.values.mockResolvedValue([]);expect(await load()).toEqual([]);expect(mocks.fields).not.toHaveBeenCalled();
  });
});

it('restrições já configuradas na etapa continuam válidas mesmo sem formulário',async()=>{
  mocks.fields.mockResolvedValue([field('existing',{etapaConfiguracoes:[{visivel:false}]})]);expect(await load()).toEqual([]);
  mocks.fields.mockResolvedValue([field('existing',{etapaConfiguracoes:[{visivel:true,editavel:false,somenteLeitura:false}]})]);
  expect((await load())[0]).toMatchObject({editavel:false});
});
