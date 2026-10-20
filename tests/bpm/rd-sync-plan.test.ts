import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarPlanoRd, PROVIDER } from '../../scripts/lib/rd-sync-plan.mjs';
import { applySyncChange, hash, stateHash, verifySyncChange } from '../../scripts/lib/rd-sync-engine.mjs';
import { validarValoresCamposBpm } from '../../src/lib/bpm/campos-dinamicos';

let directory: string;
const connections: Client[] = [];
const now = '2026-10-16T12:00:00.000Z';
// Minimal real SQLite schema for the planner contracts. All fixture values are synthetic.
const schema = [
  'CREATE TABLE Cliente (id INTEGER PRIMARY KEY,cnpj TEXT UNIQUE,razaoSocial TEXT,nomeFantasia TEXT,uf TEXT,municipio TEXT,regimeTributario TEXT,dataConstituicao TEXT,status TEXT,createdAt TEXT,updatedAt TEXT)',
  'CREATE TABLE BpmPipeline (id TEXT PRIMARY KEY,nome TEXT,ativo INTEGER,configVersion INTEGER)',
  'CREATE TABLE BpmEtapa (id TEXT PRIMARY KEY,pipelineId TEXT,nome TEXT,ativo INTEGER)',
  'CREATE TABLE usuarios (id INTEGER PRIMARY KEY,nome TEXT,email TEXT,status TEXT)',
  'CREATE TABLE BpmCard (id TEXT PRIMARY KEY,empresaId INTEGER,pipelineId TEXT,etapaId TEXT,responsavelId INTEGER,servico TEXT,status TEXT,versao INTEGER,createdAt TEXT,updatedAt TEXT)',
  'CREATE TABLE BpmCardOrigemExterna (id TEXT PRIMARY KEY,provider TEXT,cardId TEXT,sourceDealId TEXT,sourcePipelineId TEXT,rawJson TEXT,importacaoId TEXT,sourcePipelineName TEXT,sourceStageId TEXT,sourceStageName TEXT,sourceOwnerId TEXT,sourceOwnerName TEXT,sourceDealName TEXT,createdAt TEXT, UNIQUE(provider,sourceDealId))',
  'CREATE TABLE BpmCampo (id TEXT PRIMARY KEY,chave TEXT,pipelineId TEXT,nome TEXT,tipo TEXT,escopo TEXT,fonteEntidade TEXT,fonteAtributo TEXT,ativo INTEGER,configVersao INTEGER,opcoesJson TEXT)',
  'CREATE TABLE BpmCampoPipeline (campoId TEXT,pipelineId TEXT)',
  'CREATE TABLE BpmCampoOpcao (id TEXT PRIMARY KEY,campoId TEXT,chave TEXT,rotulo TEXT,ativo INTEGER,ordem INTEGER)',
  'CREATE TABLE Pessoa (id INTEGER PRIMARY KEY,nome TEXT,celular TEXT UNIQUE NOT NULL,email TEXT,createdAt TEXT,updatedAt TEXT)',
  'CREATE TABLE PessoaClienteVinculo (id INTEGER PRIMARY KEY,pessoaId INTEGER,clienteId INTEGER,principal INTEGER,ativo INTEGER,cargo TEXT,vinculo TEXT,criadoEm TEXT, UNIQUE(pessoaId,clienteId))',
  'CREATE TABLE BpmCardCampoValor (id TEXT PRIMARY KEY,cardId TEXT,campoId TEXT,valor TEXT, UNIQUE(cardId,campoId))',
  'CREATE TABLE BpmCardHistorico (id TEXT PRIMARY KEY,cardId TEXT,acao TEXT,valorAnteriorJson TEXT,valorNovoJson TEXT,automacaoOrigem TEXT,createdAt TEXT)',
  'CREATE TABLE BpmImportacaoExterna (id TEXT PRIMARY KEY,provider TEXT,fingerprint TEXT,status TEXT,resumoJson TEXT,iniciadoEm TEXT,concluidoEm TEXT)',
  'CREATE TABLE BpmCardMembro (id TEXT PRIMARY KEY,cardId TEXT,userId INTEGER,role TEXT,createdAt TEXT)',
  'CREATE TABLE BpmEventoExternoCard (id TEXT PRIMARY KEY,origemId TEXT,sourceKey TEXT,sourceEventId TEXT,eventType TEXT,occurredAt TEXT,rawJson TEXT,projectedJson TEXT,createdAt TEXT,updatedAt TEXT)',
];

async function database(name = 'shadow') {
  const db = createClient({ url: `file:${join(directory, `${name}.sqlite`)}` });
  connections.push(db);
  await db.batch(schema, 'write');
  await db.batch([
    "INSERT INTO Cliente (id,cnpj,razaoSocial,status) VALUES (1,'11222333000181','Empresa Sintética','ATIVO')",
    "INSERT INTO BpmPipeline VALUES ('pipeline-a','Funil Sintético',1,1)",
    "INSERT INTO BpmEtapa VALUES ('stage-a','pipeline-a','Etapa Sintética',1)",
    "INSERT INTO usuarios VALUES (7,'Operador Sintético','operador@example.test','ATIVO')",
    "INSERT INTO BpmCard (id,empresaId,pipelineId,etapaId,responsavelId,servico,status,versao) VALUES ('card-a',1,'pipeline-a','stage-a',7,'Serviço preservado','ATIVO',4)",
    { sql: 'INSERT INTO BpmCardOrigemExterna (id,provider,cardId,sourceDealId,sourcePipelineId,rawJson) VALUES (?,?,?,?,?,?)', args: ['origin-a', PROVIDER, 'card-a', 'deal-a', 'rd-pipeline', '{"original":true}'] },
  ], 'write');
  return db;
}

const custom = (label: string, value: string) => ({ custom_field: { label }, value });
const deal = (id = 'deal-a', fields: { custom_field: { label: string }; value: string }[] = [], contacts: unknown[] = []) => ({ id, name: 'Empresa Sintética 11.222.333/0001-81', organization: { name: 'Empresa Sintética' }, deal_stage:{id:'rd-stage'},user:{id:'rd-owner'},deal_custom_fields: fields, contacts });
const contact = (name: string, email?: string) => ({ name, phones: [{ phone: '+55 (11) 98765-4321' }], emails: email ? [{ email }] : [] });
const plan = (db: Client, deals: unknown[], extra = {}) => criarPlanoRd(db, {
  source: { complete: true, deals, stages: [], customFields: [] }, scope: { newDeals: [] }, details: {},
  databaseHash: hash('synthetic database'), sourceHashes: { source: hash('synthetic snapshot') }, smartOwnerId: null, smartSectorId: null, now, ...extra,
});
async function secondCard(db: Client) {
  await db.execute("INSERT INTO BpmCard (id,empresaId,pipelineId,etapaId,responsavelId,servico,status,versao) VALUES ('card-b',1,'pipeline-a','stage-a',7,'Serviço preservado','ATIVO',0)");
  await db.execute({ sql: 'INSERT INTO BpmCardOrigemExterna (id,provider,cardId,sourceDealId,rawJson) VALUES (?,?,?,?,?)', args: ['origin-b', PROVIDER, 'card-b', 'deal-b', '{}'] });
}
async function radarField(db: Client) {
  await db.execute("INSERT INTO BpmCampo (id,chave,pipelineId,nome,tipo,escopo,ativo,configVersao) VALUES ('radar','alpha.radar','pipeline-a','Radar pretendido','selecao','CARD',1,1)");
  await db.execute("INSERT INTO BpmCampoOpcao VALUES ('opt','radar','opcao_3','Revisão de Radar Ilimitado',1,0)");
}
const count = async (db: Client, table: string) => Number((await db.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'rd-sync-plan-')); });
afterEach(() => { for (const db of connections.splice(0)) db.close(); rmSync(directory, { recursive: true, force: true }); });

describe('plano RD em SQLite sintético real', () => {
  it('preserva campos preenchidos, dados do card e payload original mesmo com divergência RD', async () => {
    const db = await database();
    await radarField(db);
    await db.execute("UPDATE Cliente SET uf='SP' WHERE id=1");
    await db.execute("INSERT INTO BpmCardCampoValor VALUES ('existing','card-a','radar','opcao_1')");
    const result = await plan(db, [deal('deal-a', [custom('Estado', 'Rio de Janeiro'), custom('Radar pretendido', 'Modalidade ilimitada')])]);
    expect(result.summary).toMatchObject({ existingCards: 1, cardFields: 0, clientFields: 0, preservedFields: 1 });
    expect(result.exceptions).toContainEqual(expect.objectContaining({ reason: 'valor_existente_preservado', attribute: 'uf' }));
    expect((await db.execute('SELECT uf FROM Cliente')).rows[0].uf).toBe('SP');
    expect((await db.execute('SELECT valor FROM BpmCardCampoValor')).rows[0].valor).toBe('opcao_1');
    expect((await db.execute('SELECT etapaId,responsavelId,servico,versao FROM BpmCard')).rows[0]).toMatchObject({ etapaId: 'stage-a', responsavelId: 7, servico: 'Serviço preservado', versao: 4 });
    expect((await db.execute('SELECT rawJson FROM BpmCardOrigemExterna')).rows[0].rawJson).toBe('{"original":true}');
  });

  it('reconcilia todas as fontes da empresa antes de preencher campos compartilhados', async () => {
    const db = await database(); await secondCard(db);
    const result = await plan(db, [deal('deal-a', [custom('Estado', 'São Paulo')]), deal('deal-b', [custom('Estado', 'Rio de Janeiro')])]);
    expect(result.summary.clientFields).toBe(0);
    expect(result.exceptions).toContainEqual(expect.objectContaining({ reason: 'fontes_empresa_divergentes', attribute: 'uf' }));
    expect((await db.execute('SELECT uf FROM Cliente')).rows[0].uf).toBeNull();
  });

  it('considera contradição do mesmo CNPJ mesmo quando o negócio novo está em funil excluído',async()=>{
    const db=await database();
    const result=await plan(db,[deal('deal-a',[custom('Estado','São Paulo')]),deal('excluded',[custom('Estado','Rio de Janeiro')])],{scope:{newDeals:[{id:'excluded',sourcePipelineId:'excluded-pipeline'}]}});
    expect(result.summary.clientFields).toBe(0);
    expect(result.exceptions).toContainEqual(expect.objectContaining({reason:'fontes_empresa_divergentes',attribute:'uf'}));
    expect((await db.execute('SELECT uf FROM Cliente')).rows[0].uf).toBeNull();
  });

  it('bloqueia inventário aprovado quando a etapa de origem diverge da fotografia',async()=>{
    const db=await database();
    await expect(plan(db,[deal('new')],{scope:{newDeals:[{id:'new',sourcePipelineId:'rd-pipeline',sourceStageId:'outdated',sourceOwnerId:'rd-owner',alphaPipelineId:'pipeline-a'}]}})).rejects.toThrow('Inventário de destino diverge');
  });

  it('não cria destino para novo negócio fora do inventário ou sem de/para aprovado', async () => {
    const db = await database();
    const result = await plan(db, [deal('new-without-inventory'), deal('new-outside')], { scope: { newDeals: [{ id: 'new-outside', sourcePipelineId: 'rd-outside' }] } });
    expect(result.summary.newCards).toBe(0);
    expect(result.exceptions).toContainEqual(expect.objectContaining({ key: 'new-without-inventory', reason: 'sem_inventario_destino' }));
    expect(result.exceptions).toContainEqual(expect.objectContaining({ key: 'new-outside', reason: 'funil_fora_escopo_atual' }));
    expect(await count(db, 'BpmCard')).toBe(1);
  });

  it('bloqueia coleta incompleta e negócios duplicados antes de qualquer escrita', async () => {
    const db = await database();
    await expect(plan(db, [deal(), deal()])).rejects.toThrow('duplicadas');
    await expect(plan(db, [], { source: { complete: false, deals: [] } })).rejects.toThrow('incompleta');
    expect(await count(db, 'Pessoa')).toBe(0);
  });

  it('consolida telefone e email consensuais em uma pessoa e um vínculo da mesma empresa', async () => {
    const db = await database(); await secondCard(db);
    const result = await plan(db, [deal('deal-a', [], [contact('Contato Sintético')]), deal('deal-b', [], [contact('Contato Sintético', 'contato@example.test')])]);
    expect(result.summary).toMatchObject({ newPeople: 1, newLinks: 1 });
    expect(await count(db, 'Pessoa')).toBe(1);
    expect(await count(db, 'PessoaClienteVinculo')).toBe(1);
    expect((await db.execute('SELECT celular,email FROM Pessoa')).rows[0]).toMatchObject({ celular: '11987654321', email: 'contato@example.test' });
    expect((await db.execute('SELECT principal,ativo FROM PessoaClienteVinculo')).rows[0]).toMatchObject({ principal: 0, ativo: 1 });
  });

  it('não mescla nomes diferentes que compartilham telefone', async () => {
    const db = await database(); await secondCard(db);
    const result = await plan(db, [deal('deal-a', [], [contact('Contato Sintético A')]), deal('deal-b', [], [contact('Contato Sintético B')])]);
    expect(result.summary.newPeople).toBe(0);
    expect(result.exceptions.filter(item => item.reason === 'telefone_ausente_multiplo_ou_compartilhado')).toHaveLength(2);
    expect(await count(db, 'Pessoa')).toBe(0);
  });

  it('telefone e email apontando para pessoas distintas impedem associação', async () => {
    const db = await database();
    await db.batch([
      "INSERT INTO Pessoa (id,nome,celular,email) VALUES (1,'Contato Sintético','11987654321','outro@example.test')",
      "INSERT INTO Pessoa (id,nome,celular,email) VALUES (2,'Outra Pessoa','21987654321','contato@example.test')",
    ], 'write');
    const result = await plan(db, [deal('deal-a', [], [contact('Contato Sintético', 'contato@example.test')])]);
    expect(result.summary).toMatchObject({ newPeople: 0, newLinks: 0 });
    expect(result.exceptions).toContainEqual(expect.objectContaining({ reason: 'identificadores_apontam_pessoas_distintas' }));
    expect(await count(db, 'PessoaClienteVinculo')).toBe(0);
  });

  it('preserva email existente da pessoa e reutiliza seu vínculo exato', async () => {
    const db = await database();
    await db.execute("INSERT INTO Pessoa (id,nome,celular,email) VALUES (1,'Contato Sintético','11987654321','existente@example.test')");
    await db.execute("INSERT INTO PessoaClienteVinculo (id,pessoaId,clienteId,principal,ativo) VALUES (1,1,1,1,1)");
    const result = await plan(db, [deal('deal-a', [], [contact('Contato Sintético', 'novo@example.test')])]);
    expect(result.summary).toMatchObject({ newPeople: 0, newLinks: 0, personFields: 0 });
    expect(result.exceptions).toContainEqual(expect.objectContaining({ reason: 'email_existente_preservado' }));
    expect((await db.execute('SELECT email FROM Pessoa')).rows[0].email).toBe('existente@example.test');
    expect((await db.execute('SELECT principal FROM PessoaClienteVinculo')).rows[0].principal).toBe(1);
  });

  it('reverte grupos com a mesma pessoa e verifica o estado compensatório final sem relaxar guards',async()=>{
    const shadow=await database(),target=await database('target');
    for(const db of[shadow,target])await db.batch([
      "INSERT INTO Cliente (id,razaoSocial,status) VALUES (2,'Segunda Empresa Sintética','ATIVO')",
      "INSERT INTO BpmCard (id,empresaId,pipelineId,etapaId,responsavelId,servico,status,versao) VALUES ('card-b',2,'pipeline-a','stage-a',7,'Serviço preservado','ATIVO',0)",
      {sql:'INSERT INTO BpmCardOrigemExterna (id,provider,cardId,sourceDealId,rawJson) VALUES (?,?,?,?,?)',args:['origin-b',PROVIDER,'card-b','deal-b','{}']},
      "INSERT INTO Pessoa (id,nome,celular,email) VALUES (1,'Contato Sintético','11987654321',NULL)",
    ],'write');
    const result=await plan(shadow,[deal('deal-a',[],[contact('Contato Sintético','contato@example.test')]),deal('deal-b',[],[contact('Contato Sintético','contato@example.test')])]);
    const fingerprint=hash(result);expect(result.summary.personFields).toBe(1);
    for(const change of result.changes)await applySyncChange(target,change,fingerprint);
    for(const change of [...result.changes].reverse())await applySyncChange(target,change,fingerprint,{rollback:true});
    for(const change of result.changes){
      expect(await verifySyncChange(target,change,fingerprint)).toMatchObject({rolledBack:true,stateMatches:true});
      expect(await applySyncChange(target,change,fingerprint,{rollback:true})).toEqual({applied:0,skipped:1});
    }
    expect((await target.execute('SELECT email FROM Pessoa WHERE id=1')).rows[0].email).toBeNull();
  });

  it('não duplica campos canônicos e grava o rótulo da opção ativa exigido pelo formulário real', async () => {
    const db = await database(); await radarField(db);
    await db.execute("INSERT INTO BpmCampo (id,pipelineId,nome,tipo,escopo,fonteEntidade,fonteAtributo,ativo) VALUES ('state','pipeline-a','Estado','texto','GLOBAL','CLIENTE','uf',1)");
    const result = await plan(db, [deal('deal-a', [custom('Estado', 'São Paulo'), custom('Radar pretendido', 'Modalidade ilimitada')])]);
    expect(result.summary).toMatchObject({ clientFields: 1, cardFields: 1 });
    expect((await db.execute('SELECT campoId,valor FROM BpmCardCampoValor')).rows).toHaveLength(1);
    expect((await db.execute('SELECT campoId,valor FROM BpmCardCampoValor')).rows[0]).toMatchObject({ campoId: 'radar', valor: 'Revisão de Radar Ilimitado' });
    const field={id:'radar',nome:'Radar pretendido',tipo:'selecao',opcoesJson:JSON.stringify(['Revisão de Radar Ilimitado'])};
    expect(validarValoresCamposBpm([field],{radar:'Revisão de Radar Ilimitado'}).success).toBe(true);
    expect(validarValoresCamposBpm([field],{radar:'opcao_3'}).success).toBe(false);
    expect(result.changes[0].evidence).toContainEqual(expect.objectContaining({ entity: 'CLIENTE', attribute: 'uf', source: 'Estado' }));
  });

  it('guards descrevem ambos os estados e integram aplicação, retomada e reversão no engine', async () => {
    const shadow = await database(); const target = await database('target');
    await radarField(shadow); await radarField(target);
    const result = await plan(shadow, [deal('deal-a', [custom('Estado', 'São Paulo'), custom('Radar pretendido', 'Modalidade ilimitada')])]);
    const change = result.changes[0], fingerprint = hash(result);
    for (const guard of change.before) expect(stateHash((await target.execute(guard)).rows.map(row => ({ ...row })))).toBe(guard.hash);
    for (const guard of change.after) expect(stateHash((await shadow.execute(guard)).rows.map(row => ({ ...row })))).toBe(guard.hash);
    expect(await applySyncChange(target, change, fingerprint)).toEqual({ applied: 1, skipped: 0 });
    expect(await verifySyncChange(target, change, fingerprint)).toMatchObject({ applied: true, stateMatches: true });
    expect(await applySyncChange(target, change, fingerprint)).toEqual({ applied: 0, skipped: 1 });
    expect(await count(target, 'BpmCardCampoValor')).toBe(1);
    expect(await applySyncChange(target, change, fingerprint, { rollback: true })).toEqual({ applied: 1, skipped: 0 });
    expect((await target.execute('SELECT uf FROM Cliente')).rows[0].uf).toBeNull();
    expect(await count(target, 'BpmCardCampoValor')).toBe(0);
    expect(await count(target, 'BpmCardHistorico')).toBe(2);
  });

  it('nova opção ou edição do campo após a prévia bloqueia a carga antes da escrita', async () => {
    const shadow = await database(); const target = await database('target');
    await radarField(shadow); await radarField(target);
    const result = await plan(shadow, [deal('deal-a', [custom('Estado', 'São Paulo'), custom('Radar pretendido', 'Modalidade ilimitada')])]);
    await target.execute("UPDATE BpmCampoOpcao SET ativo=0 WHERE id='opt'");
    await expect(applySyncChange(target, result.changes[0], hash(result))).rejects.toThrow('Estado mudou');
    expect((await target.execute('SELECT uf FROM Cliente')).rows[0].uf).toBeNull();
    expect(await count(target, 'BpmCardHistorico')).toBe(0);
  });

  it('edição posterior da razão social canônica bloqueia cópia desatualizada no formulário',async()=>{
    const shadow=await database(),target=await database('target');
    for(const db of[shadow,target])await db.execute("INSERT INTO BpmCampo (id,pipelineId,nome,tipo,escopo,ativo,configVersao) VALUES ('name','pipeline-a','Razão Social','texto','CARD',1,1)");
    const result=await plan(shadow,[deal()]);
    await target.execute("UPDATE Cliente SET razaoSocial='Nome corrigido pelo usuário' WHERE id=1");
    await expect(applySyncChange(target,result.changes[0],hash(result))).rejects.toThrow('Estado mudou');
    expect(await count(target,'BpmCardCampoValor')).toBe(0);
  });

  it('edição posterior do e-mail canônico bloqueia cópia desatualizada mesmo sem contato na origem RD',async()=>{
    const shadow=await database(),target=await database('target');
    for(const db of[shadow,target])await db.batch([
      "INSERT INTO BpmCampo (id,pipelineId,nome,tipo,escopo,ativo,configVersao) VALUES ('email','pipeline-a','E-mail','email','CARD',1,1)",
      "INSERT INTO Pessoa (id,nome,celular,email) VALUES (1,'Contato Sintético','11987654321','original@example.test')",
      "INSERT INTO PessoaClienteVinculo (id,pessoaId,clienteId,principal,ativo) VALUES (1,1,1,1,1)",
    ],'write');
    const result=await plan(shadow,[deal()]);
    await target.execute("UPDATE Pessoa SET email='corrigido@example.test' WHERE id=1");
    await expect(applySyncChange(target,result.changes[0],hash(result))).rejects.toThrow('Estado mudou');
    expect(await count(target,'BpmCardCampoValor')).toBe(0);
  });

  it('novo negócio com CNPJ e destino aprovados mantém identidade própria e compensa por arquivamento', async () => {
    const shadow = await database(); const target = await database('target');
    const newDeal = deal('deal-new');
    const destination = {
      id: 'deal-new', sourcePipelineId: 'rd-pipeline', sourcePipelineName: 'Origem Sintética',
      sourceStageId: 'rd-stage', sourceStageName: 'Etapa Sintética', sourceOwnerId: 'rd-owner', sourceOwnerName: 'Operador Sintético',
      alphaPipelineId: 'pipeline-a', alphaStageId: 'stage-a', fixedAlphaOwnerId: 7,
    };
    const result = await plan(shadow, [newDeal], {
      scope: { newDeals: [destination] }, details: { 'deal-new': { complete: true, detail: newDeal, activities: [] } },
    });
    expect(result.summary).toMatchObject({ newCards: 1, newClients: 0 });
    const change = result.changes[0], fingerprint = hash(result);
    expect(change.newCardIds).toHaveLength(1);
    expect(await applySyncChange(target, change, fingerprint)).toEqual({ applied: 1, skipped: 0 });
    expect(await count(target, 'BpmCard')).toBe(2);
    expect(await count(target, 'Cliente')).toBe(1);
    expect(await applySyncChange(target, change, fingerprint)).toEqual({ applied: 0, skipped: 1 });
    expect(await count(target, 'BpmCardOrigemExterna')).toBe(2);
    expect(await applySyncChange(target, change, fingerprint, { rollback: true })).toEqual({ applied: 1, skipped: 0 });
    expect((await target.execute({ sql: 'SELECT status FROM BpmCard WHERE id=?', args: [change.newCardIds[0]] })).rows[0].status).toBe('ARQUIVADO');
    expect((await target.execute("SELECT status FROM BpmCard WHERE id='card-a'")).rows[0].status).toBe('ATIVO');
    expect(await count(target, 'BpmCardOrigemExterna')).toBe(2);
  });
});
