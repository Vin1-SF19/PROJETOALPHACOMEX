import { hash, stableId, guard } from './rd-sync-engine.mjs';
import { campoRd, dadoRdAusente, mapearCampoRd, normalizarTexto, normalizarTelefoneRd, normalizarEmailRd, normalizarUfRd, normalizarDataRd } from './rd-field-mapping.mjs';
import { cnpjEhValido } from '../../src/lib/format-cnpj.ts';
import { resolverServicoRd } from '../../src/lib/bpm/rd-station-service.ts';
import { projetarEventosHistoricoRd } from '../../src/lib/bpm/rd-station-history.ts';

export const PROVIDER = 'RD_STATION_CRM_V1';
export const SMART_ID = '6aa89b99ca40910029d7ca7a';
const blank = value => value == null || String(value).trim() === '';
const idOf = value => value?.id ?? value?._id;
const statement = (sql, args = []) => ({ sql, args });
const qi = value => `"${String(value).replaceAll('"', '""')}"`;
const configId = (...parts) => `c${hash(parts.join(':')).slice(0,24)}`;
const sortedUnique = values => [...new Set(values.filter(value => value != null && value !== ''))].sort();

export function extrairCnpjRd(deal) {
  const values = [deal.name, deal.organization?.name].filter(value => typeof value === 'string');
  const ids = sortedUnique(values.flatMap(value => [...value.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)].map(match => match[0].replace(/\D/g, ''))).filter(cnpjEhValido));
  return ids.length === 1 ? ids[0] : null;
}

export function contatosRd(deals) {
  const result = new Map();
  for (const deal of deals) for (const raw of deal.contacts ?? []) {
    const phones = sortedUnique((raw.phones ?? []).map(phone => normalizarTelefoneRd(typeof phone === 'string' ? phone : phone.phone)));
    const emails = sortedUnique((raw.emails ?? []).map(email => normalizarEmailRd(typeof email === 'string' ? email : email.email)));
    const key = hash({ name: normalizarTexto(raw.name), phones, emails });
    result.set(key, { name: String(raw.name ?? '').trim(), phones, emails, title: raw.title ?? null, sourceDealId: idOf(deal) });
  }
  return [...result.values()];
}

/** Build in a private restored database. No remote writes are performed here. */
export async function criarPlanoRd(db, { source, scope, details, databaseHash, sourceHashes, smartOwnerId, smartSectorId, now = new Date().toISOString() }) {
  if (source.complete !== true || source.deals.length !== new Set(source.deals.map(idOf)).size) throw Error('Coleta incompleta ou identidades duplicadas.');
  const read = async (sql, args = []) => (await db.execute(statement(sql, args))).rows.map(row => ({ ...row }));
  const origins = await read('SELECT id,cardId,sourceDealId,sourcePipelineId,rawJson FROM BpmCardOrigemExterna WHERE provider=?', [PROVIDER]);
  const cards = await read('SELECT id,empresaId,pipelineId,etapaId,responsavelId,servico,status,versao FROM BpmCard');
  const clients = await read('SELECT id,cnpj,razaoSocial,nomeFantasia,uf,municipio,regimeTributario,dataConstituicao,status FROM Cliente');
  const pipelines = await read('SELECT id,nome,ativo,configVersion FROM BpmPipeline');
  const stages = await read('SELECT id,pipelineId,nome,ativo FROM BpmEtapa');
  const users = await read('SELECT id,nome,email,status FROM usuarios');
  const fields = await read('SELECT id,chave,pipelineId,nome,tipo,escopo,fonteEntidade,fonteAtributo,ativo,configVersao,opcoesJson FROM BpmCampo WHERE ativo=1');
  const fieldLinks = await read('SELECT campoId,pipelineId FROM BpmCampoPipeline');
  const options = await read('SELECT campoId,chave,rotulo,ativo FROM BpmCampoOpcao ORDER BY campoId,ordem');
  const peopleCache = await read('SELECT id,nome,celular,email FROM Pessoa');
  let personSequence = Math.max(0,...peopleCache.map(person=>Number(person.id)));
  let linkSequence = Number((await read('SELECT COALESCE(MAX(id),0) id FROM PessoaClienteVinculo'))[0].id);
  const byDeal = new Map(origins.map(origin => [origin.sourceDealId, origin]));
  const byCard = new Map(cards.map(card => [card.id, card]));
  const sourceById = new Map(source.deals.map(deal => [idOf(deal), deal]));
  const newScope = new Map(scope.newDeals.map(deal => [deal.id, deal]));
  const stageNames = new Map(source.stages.flatMap(pipeline => pipeline.stages.map(stage => [idOf(stage), stage.name])));
  const exceptions = [], preserved = [], changes = [], groups = new Map();
  const counts = { existingCards: 0, newCards: 0, newClients: 0, newPeople: 0, newLinks: 0, personFields: 0, clientFields: 0, cardFields: 0, serviceFields: 0, newPipelines: 0, sourceEvents: 0 };
  let clientSequence = Math.max(0, ...clients.map(client => Number(client.id)));
  const issue = (kind, key, reason, data = {}) => exceptions.push({ kind, key, reason, ...data });
  for (const origin of origins) if (!sourceById.has(origin.sourceDealId)) issue('identity', origin.sourceDealId, 'origem_ausente_snapshot_preservada');
  for (const deal of source.deals) {
    const dealId = idOf(deal), origin = byDeal.get(dealId);
    if (origin) {
      const card = byCard.get(origin.cardId);
      if (!card) throw Error('Origem sem card.');
      const key = String(card.empresaId), group = groups.get(key) ?? { client: clients.find(client => client.id === card.empresaId), items: [], isNew: false };
      group.items.push({ deal, card, origin, isNew: false }); groups.set(key, group); counts.existingCards++; continue;
    }
    const destination = newScope.get(dealId);
    if (!destination) { issue('new', dealId, 'sem_inventario_destino'); continue; }
    const isSmart = destination.sourcePipelineId === SMART_ID;
    if (!destination.alphaPipelineId && !isSmart) { issue('new', dealId, 'funil_fora_escopo_atual', { sourcePipelineId: destination.sourcePipelineId }); continue; }
    if(destination.sourceStageId!==idOf(deal.deal_stage)||destination.sourceOwnerId!==idOf(deal.user))throw Error('Inventário de destino diverge da fotografia atual do negócio.');
    const pipelineId = isSmart ? configId('rdpipeline', SMART_ID) : destination.alphaPipelineId;
    // Alias is explicit for the unchanged stage ID renamed by the user.
    const stageId = isSmart ? configId('rdstage', destination.sourceStageId) : destination.alphaStageId ?? (destination.alphaStageName === 'Em tratativas' ? destination.suggestedAlphaStageId : null);
    const evidence = destination.existingOwnerEvidence ?? [];
    const owners = sortedUnique(evidence.filter(item => item.status === 'ATIVO').map(item => item.responsavelId));
    const ownerId = isSmart ? smartOwnerId : destination.fixedAlphaOwnerId ?? (owners.length === 1 ? owners[0] : null);
    if (!stageId || !ownerId || !users.some(user => user.id === ownerId && user.status === 'ATIVO')) { issue('new', dealId, 'destino_ou_responsavel_nao_confirmado'); continue; }
    if(isSmart){
      const rdUsers=Array.isArray(source.users)?source.users:source.users?.users??[];
      const rdOwner=rdUsers.find(user=>idOf(user)===destination.sourceOwnerId),alphaOwner=users.find(user=>user.id===ownerId);
      if(!normalizarEmailRd(rdOwner?.email)||normalizarEmailRd(rdOwner?.email)!==normalizarEmailRd(alphaOwner?.email))throw Error('Responsável Smart sem correspondência exata de e-mail.');
    }
    if (!isSmart && (!pipelines.some(pipeline => pipeline.id === pipelineId && pipeline.ativo) || !stages.some(stage => stage.id === stageId && stage.pipelineId === pipelineId && stage.ativo))) { issue('new', dealId, 'destino_inativo_ou_inexistente'); continue; }
    if (!details[dealId]?.complete) { issue('new', dealId, 'detalhe_historico_incompleto'); continue; }
    const cnpj = extrairCnpjRd(deal);
    if (!cnpj) { issue('new', dealId, 'cnpj_ausente_invalido_ou_contraditorio'); continue; }
    const matches = clients.filter(client => client.cnpj?.replace(/\D/g, '') === cnpj);
    if (matches.length > 1) { issue('new', dealId, 'cliente_cnpj_ambiguo'); continue; }
    let client = matches[0], group;
    if (client) group = groups.get(String(client.id)) ?? { client, items: [], isNew: false };
    else {
      group = groups.get(`cnpj:${cnpj}`);
      if (!group) {
        const name = String(deal.organization?.name ?? '').trim();
        if (!name) { issue('new', dealId, 'razao_social_sem_evidencia'); continue; }
        client = { id: ++clientSequence, cnpj, razaoSocial: name, nomeFantasia: null, uf: null, municipio: null, regimeTributario: null, dataConstituicao: null, status: 'ATIVO' };
        group = { client, items: [], isNew: true };
      }
    }
    const card = { id: stableId('rdcard', PROVIDER, dealId), empresaId: group.client.id, pipelineId, etapaId: stageId, responsavelId: ownerId, servico: resolverServicoRd(deal).servico, status: 'ATIVO', versao: 0 };
    group.items.push({ deal, card, origin: null, isNew: true, isSmart, destination });
    groups.set(group.isNew ? `cnpj:${cnpj}` : String(group.client.id), group);
  }
  // A phone shared by different named contacts is evidence of ambiguity, not an identity merge.
  const phoneNames = new Map(), phoneEmails = new Map();
  for (const contact of contatosRd(source.deals)) for (const phone of contact.phones) {
    const names = phoneNames.get(phone) ?? new Set(); names.add(normalizarTexto(contact.name)); phoneNames.set(phone, names);
  }
  for (const contact of contatosRd([...groups.values()].flatMap(group=>group.items.map(item=>item.deal)))) for (const phone of contact.phones) {
    const emails=phoneEmails.get(phone)??new Set();contact.emails.forEach(email=>emails.add(email));phoneEmails.set(phone,emails);
  }
  let smartCreated = false;
  for (const group of groups.values()) {
    const { client, items } = group;
    const auditCard = items[0].card.id, selectors = new Map(), writes = [], undo = [], evidence = [];
    const select = async (sql, args = []) => {
      const key = JSON.stringify([sql, args]);
      if (!selectors.has(key)) selectors.set(key, { sql, args, rows: await read(sql, args) });
      return selectors.get(key).rows;
    };
    const insert = (table, data) => statement(`INSERT INTO ${qi(table)} (${Object.keys(data).map(qi).join(',')}) VALUES (${Object.keys(data).map(() => '?').join(',')})`, Object.values(data));
    const schedule = (write, reverse) => { writes.push(write); if (reverse) undo.unshift(reverse); };
    const entitiesRetainedOnRollback = [];
    if (group.isNew) {
      await select("SELECT id,cnpj,razaoSocial,uf,municipio,regimeTributario,dataConstituicao,status FROM Cliente WHERE id=? OR replace(replace(replace(cnpj,'.',''),'/',''),'-','')=? ORDER BY id", [client.id, client.cnpj]);
      schedule(insert('Cliente', { ...client, createdAt: now, updatedAt: now })); counts.newClients++;
      entitiesRetainedOnRollback.push({ table: 'Cliente', id: client.id });
    } else await select('SELECT id,cnpj,razaoSocial,uf,municipio,regimeTributario,dataConstituicao,status FROM Cliente WHERE id=?', [client.id]);

    if (items.some(item => item.isSmart) && !smartCreated) {
      if (!smartSectorId || !(await read('SELECT id FROM Setor WHERE id=?', [smartSectorId])).length) throw Error('Setor Smart não validado.');
      const mirror = source.stages.find(pipeline => pipeline.pipelineId === SMART_ID);
      if (!mirror?.stages.length) throw Error('Etapas Smart ausentes.');
      const pipelineId = configId('rdpipeline', SMART_ID);
      await select('SELECT id,nome,ativo,configVersion FROM BpmPipeline WHERE id=? OR chave=? ORDER BY id', [pipelineId, `rd.crm.v1.${SMART_ID}`]);
      if ((await read('SELECT id FROM BpmPipeline WHERE id=?', [pipelineId])).length) throw Error('Smart já existe: recolecione destinos antes de preparar novo plano.');
      schedule(insert('BpmPipeline', { id: pipelineId, chave: `rd.crm.v1.${SMART_ID}`, nome: mirror.pipelineName, ordem: pipelines.length + 1, ativo: 1, configVersion: 1, createdAt: now, updatedAt: now }), statement('UPDATE BpmPipeline SET ativo=0,updatedAt=? WHERE id=?', [now, pipelineId]));
      schedule(insert('BpmPipelineSetor', { id: configId('rdpsector', pipelineId, smartSectorId), pipelineId, setorId: smartSectorId }));
      await select('SELECT id,nome FROM Setor WHERE id=?', [smartSectorId]);
      const mirrorFields = [];
      const canonical = [['CNPJ','cnpj','CLIENTE','cnpj'],['Razão Social','texto','CLIENTE','razaoSocial'],['E-mail','email','CONTATO','email'],['Estado','texto','CLIENTE','uf'],['Regime tributário do cliente','texto','CLIENTE','regimeTributario'],['Data de abertura da empresa','data','CLIENTE','dataConstituicao'],['Serviço contratado','texto','CARD','servico']];
      for (const [index, [nome,tipo,fonteEntidade,fonteAtributo]] of canonical.entries()) mirrorFields.push({ id: configId('rdsmartcanonical', nome), chave: `rd.smart.${fonteEntidade}.${fonteAtributo}`, pipelineId, nome, tipo, escopo: 'GLOBAL', fonteEntidade, fonteAtributo, ativo: 1, ordem: index, configVersao: 1 });
      const smartSourceIds=new Set(items.filter(item=>item.isSmart).flatMap(item=>(item.deal.deal_custom_fields??[]).map(field=>field.custom_field_id??idOf(field.custom_field))));
      for (const raw of source.customFields.filter(field => field.for === 'deal'&&smartSourceIds.has(idOf(field)))) {
        if(['Estado','Regime Tributário atual','Data de abertura da empresa'].map(normalizarTexto).includes(normalizarTexto(raw.label)))continue;
        const id = configId('rdsmartfield', idOf(raw));
        const field = { id, chave: `rd.crm.v1.field.${idOf(raw)}`, pipelineId, nome: String(raw.label).trim(), tipo: raw.type === 'option' ? 'selecao' : raw.type === 'date' ? 'data' : raw.type === 'number' ? 'numero' : 'texto', escopo: 'CARD', fonteEntidade: null, fonteAtributo: null, ativo: 1, ordem: mirrorFields.length, configVersao: 1, sourceFieldId: idOf(raw) };
        mirrorFields.push(field);
        for (const [index, value] of (raw.opts ?? []).entries()) {
          if (typeof value !== 'string') throw Error('Opção Smart sem representação explícita.');
          const option = { campoId: id, chave: `rd_${index}`, rotulo: value.trim(), ativo: 1 };
          options.push(option);
        }
      }
      for (const field of mirrorFields) {
        field.opcoesJson=field.tipo==='selecao'?JSON.stringify(options.filter(option=>option.campoId===field.id&&option.ativo).map(option=>option.rotulo)):null;
        const data=Object.fromEntries(Object.entries(field).filter(([key])=>key!=='sourceFieldId'));
        await select('SELECT id,chave,pipelineId,nome,tipo,escopo,fonteEntidade,fonteAtributo,ativo,configVersao,opcoesJson FROM BpmCampo WHERE id=?',[field.id]);
        await select('SELECT chave,rotulo,ativo FROM BpmCampoOpcao WHERE campoId=? ORDER BY ordem,id',[field.id]);
        await select('SELECT campoId,pipelineId FROM BpmCampoPipeline WHERE campoId=? ORDER BY pipelineId',[field.id]);
        schedule(insert('BpmCampo', { ...data, createdAt: now, updatedAt: now }));
        for (const [index, option] of options.filter(option => option.campoId === field.id).entries()) schedule(insert('BpmCampoOpcao', { ...option, id: configId('rdsmartoption', field.id, option.chave), ordem: index, createdAt: now, updatedAt: now }));
        fields.push(field);
      }
      for (const [index, stage] of mirror.stages.entries()) {
        const stageId = configId('rdstage', idOf(stage)), formId = configId('rdform', stageId), sectionId = configId('rdsection', stageId);
        schedule(insert('BpmEtapa', { id: stageId, pipelineId, chave: `rd.${idOf(stage)}`, nome: stage.name, ordem: index, ativo: 1, ehInicial: 0, ehFinal: 0, createdAt: now, updatedAt: now }));
        schedule(insert('BpmEtapaFormulario', { id: formId, etapaId: stageId, versao: 1, ativo: 1, createdAt: now, updatedAt: now }));
        schedule(insert('BpmFormularioSecao', { id: sectionId, formularioId: formId, chave: 'dados_rd', titulo: 'Dados do RD Station', ordem: 0, createdAt: now, updatedAt: now }));
        for (const [order, field] of mirrorFields.entries()) {
          schedule(insert('BpmCampoEtapaConfig', { id: configId('rdfconfig', stageId, field.id), campoId: field.id, etapaId: stageId, visivel: 1, editavel: 1, somenteLeitura: 0, obrigatorio: 0, obrigatorioEntrada: 0, obrigatorioSaida: 0, ordem: order, createdAt: now, updatedAt: now }));
          schedule(insert('BpmFormularioComponente', { id: configId('rdcomponent', stageId, field.id), secaoId: sectionId, chave: field.id, tipo: 'CAMPO', campoId: field.id, configJson:'{}',ordem: order, createdAt: now, updatedAt: now }));
        }
      }
      // Guard the complete mirror composition against concurrent edits and rollback dependencies.
      for (const table of ['BpmEtapa','BpmCampo','BpmPipelineSetor']) await select(`SELECT * FROM ${table} WHERE pipelineId=? ORDER BY id`, [pipelineId]);
      await select('SELECT id,empresaId,pipelineId,etapaId,status,versao FROM BpmCard WHERE pipelineId=? ORDER BY id',[pipelineId]);
      await select('SELECT f.* FROM BpmEtapaFormulario f JOIN BpmEtapa e ON e.id=f.etapaId WHERE e.pipelineId=? ORDER BY f.id',[pipelineId]);
      await select('SELECT s.* FROM BpmFormularioSecao s JOIN BpmEtapaFormulario f ON f.id=s.formularioId JOIN BpmEtapa e ON e.id=f.etapaId WHERE e.pipelineId=? ORDER BY s.id',[pipelineId]);
      await select('SELECT c.* FROM BpmFormularioComponente c JOIN BpmFormularioSecao s ON s.id=c.secaoId JOIN BpmEtapaFormulario f ON f.id=s.formularioId JOIN BpmEtapa e ON e.id=f.etapaId WHERE e.pipelineId=? ORDER BY c.id',[pipelineId]);
      await select('SELECT c.* FROM BpmCampoEtapaConfig c JOIN BpmEtapa e ON e.id=c.etapaId WHERE e.pipelineId=? ORDER BY c.id',[pipelineId]);
      counts.newPipelines++; smartCreated = true;
    }
    for (const item of items) {
      const { card, deal } = item;
      await select('SELECT id,empresaId,pipelineId,etapaId,responsavelId,servico,status,versao FROM BpmCard WHERE id=?', [card.id]);
      if (item.isNew) {
        const dealId = idOf(deal), destination = item.destination, detail = details[dealId].detail;
        const importId = stableId('rdsyncimport', dealId), originId = stableId('rdorigin', PROVIDER, dealId);
        await select('SELECT id,cardId,sourceDealId,rawJson FROM BpmCardOrigemExterna WHERE provider=? AND sourceDealId=?', [PROVIDER, dealId]);
        await select('SELECT id,nome,email,status FROM usuarios WHERE id=?', [card.responsavelId]);
        if (!item.isSmart) {
          await select('SELECT id,nome,ativo,configVersion FROM BpmPipeline WHERE id=?', [card.pipelineId]);
          await select('SELECT id,pipelineId,nome,ativo FROM BpmEtapa WHERE id=?', [card.etapaId]);
        }
        schedule(insert('BpmImportacaoExterna', { id: importId, provider: PROVIDER, fingerprint: hash({ dealId, sourceHashes }), status: 'CONCLUIDO', resumoJson: JSON.stringify({ sourceDealId: dealId, mode: 'FIELDS_AND_NEW_SYNC' }), iniciadoEm: now, concluidoEm: now }));
        schedule(insert('BpmCard', { ...card, createdAt: now, updatedAt: now }), statement('UPDATE BpmCard SET status=?,versao=versao+1,updatedAt=? WHERE id=?', ['ARQUIVADO', now, card.id]));
        schedule(insert('BpmCardMembro', { id: stableId('rdmember', card.id, card.responsavelId), cardId: card.id, userId: card.responsavelId, role: 'RESPONSAVEL', createdAt: now }));
        schedule(insert('BpmCardOrigemExterna', { id: originId, provider: PROVIDER, sourceDealId: dealId, cardId: card.id, importacaoId: importId, sourcePipelineId: destination.sourcePipelineId, sourcePipelineName: destination.sourcePipelineName, sourceStageId: destination.sourceStageId, sourceStageName: destination.sourceStageName, sourceOwnerId: destination.sourceOwnerId, sourceOwnerName: destination.sourceOwnerName, sourceDealName: deal.name, rawJson: JSON.stringify({ ...detail, contacts: deal.contacts ?? [] }), createdAt: now }));
        const projected = projetarEventosHistoricoRd(detail, details[dealId].activities, stageNames);
        for (const event of projected) schedule(insert('BpmEventoExternoCard', { id: stableId('rdevent', originId, event.sourceKey), origemId: originId, sourceKey: event.sourceKey, sourceEventId: event.sourceEventId, eventType: event.eventType, occurredAt: event.occurredAt, rawJson: JSON.stringify(event.raw), projectedJson: JSON.stringify(event.projection), createdAt: now, updatedAt: now }));
        await select('SELECT id,cardId,userId,role FROM BpmCardMembro WHERE cardId=? ORDER BY id', [card.id]);
        await select('SELECT id,origemId,sourceKey,rawJson,projectedJson FROM BpmEventoExternoCard WHERE origemId=? ORDER BY id', [originId]);
        counts.sourceEvents += projected.length; counts.newCards++;
      } else {
        await select('SELECT id,cardId,provider,sourceDealId,rawJson FROM BpmCardOrigemExterna WHERE cardId=?', [card.id]);
        if (blank(card.servico)) {
          const resolved = resolverServicoRd(deal);
          if (resolved.servico) { schedule(statement('UPDATE BpmCard SET servico=? WHERE id=?', [resolved.servico,card.id]), statement('UPDATE BpmCard SET servico=? WHERE id=?', [card.servico,card.id])); card.servico = resolved.servico; counts.serviceFields++; }
        }
      }
    }
    const companyMap = [['uf','Estado',normalizarUfRd],['regimeTributario','Regime Tributário atual', value => ['simples nacional','lucro real','lucro presumido','regime normal'].includes(normalizarTexto(value)) ? String(value).trim() : null],['dataConstituicao','Data de abertura da empresa',normalizarDataRd]];
    const organizationIds=new Set(items.map(item=>idOf(item.deal.organization)).filter(Boolean));
    const companySources=source.deals.filter(deal=>items.some(item=>idOf(item.deal)===idOf(deal))||organizationIds.has(idOf(deal.organization))||(client.cnpj&&extrairCnpjRd(deal)===client.cnpj.replace(/\D/g,'')));
    for (const [attribute, label, normalize] of companyMap) {
      const values = sortedUnique(companySources.map(deal => normalize(campoRd(deal,label))));
      if (values.length > 1) { issue('client', String(client.id), 'fontes_empresa_divergentes', { attribute }); continue; }
      if (!values.length) continue;
      if (!blank(client[attribute])) { if (normalizarTexto(client[attribute]) !== normalizarTexto(values[0])) issue('client', String(client.id), 'valor_existente_preservado', { attribute }); continue; }
      const beforeValue=client[attribute]??null;
      schedule(statement(`UPDATE Cliente SET ${qi(attribute)}=? WHERE id=?`, [values[0],client.id]), statement(`UPDATE Cliente SET ${qi(attribute)}=? WHERE id=?`, [beforeValue,client.id])); client[attribute] = values[0]; counts.clientFields++; evidence.push({ entity:'CLIENTE',attribute,source:label,before:beforeValue,after:values[0] });
    }
    const candidates = contatosRd(items.map(item => item.deal));
    const linked = (await select('SELECT id,pessoaId,clienteId,principal,ativo,cargo,vinculo FROM PessoaClienteVinculo WHERE clienteId=? ORDER BY id', [client.id])).map(row=>({...row}));
    for(const link of linked)await select('SELECT id,nome,celular,email FROM Pessoa WHERE id=?',[link.pessoaId]);
    for (const contact of candidates) {
      if (!contact.name || contact.phones.length !== 1 || phoneNames.get(contact.phones[0])?.size !== 1) { issue('contact', contact.sourceDealId, 'telefone_ausente_multiplo_ou_compartilhado'); continue; }
      const phone = contact.phones[0], candidateEmails=[...(phoneEmails.get(phone)??[])],email = candidateEmails.length === 1 ? candidateEmails[0] : null;
      const people = peopleCache;
      const phoneMatches = people.filter(person => normalizarTelefoneRd(person.celular) === phone);
      const emailMatches = email ? people.filter(person => normalizarEmailRd(person.email) === email) : [];
      if (phoneMatches.length > 1 || emailMatches.length > 1 || (phoneMatches.length && emailMatches.length && phoneMatches[0].id !== emailMatches[0].id)) { issue('contact', contact.sourceDealId, 'identificadores_apontam_pessoas_distintas'); continue; }
      let person = phoneMatches[0];
      if (!person && emailMatches.length) { issue('contact',contact.sourceDealId,'email_existente_com_outro_telefone'); continue; }
      if (person && normalizarTexto(person.nome) !== normalizarTexto(contact.name) && (!email || normalizarEmailRd(person.email) !== email)) { issue('contact',contact.sourceDealId,'telefone_existente_identidade_divergente'); continue; }
      // Guard normalized matching over all people; new changes are built sequentially in this shadow database.
      const normalizedPhone="replace(replace(replace(replace(replace(replace(celular,'+',''),' ',''),'(',''),')',''),'-',''),'.','')";
      await select(`SELECT id,nome,celular,email FROM Pessoa WHERE ${normalizedPhone} IN (?,?,?) OR lower(trim(email))=? ORDER BY id`,[phone,`55${phone}`,`0055${phone}`,email??'']);
      if (!person) {
        const personId = ++personSequence;
        await select('SELECT id,nome,celular,email FROM Pessoa WHERE id=?',[personId]);
        person = { id:personId,nome:contact.name,celular:phone,email };
        peopleCache.push(person);
        schedule(insert('Pessoa',{...person,createdAt:now,updatedAt:now})); entitiesRetainedOnRollback.push({table:'Pessoa',id:personId}); counts.newPeople++;
      } else {
        await select('SELECT id,nome,celular,email FROM Pessoa WHERE id=?',[person.id]);
        if (blank(person.email) && email) {
        evidence.push({entity:'PESSOA',entityId:person.id,attribute:'email',source:'contacts.emails',sourceDealId:contact.sourceDealId,before:person.email??null,after:email});
        schedule(statement('UPDATE Pessoa SET email=? WHERE id=?',[email,person.id]),statement('UPDATE Pessoa SET email=? WHERE id=?',[person.email??null,person.id])); person.email=email; counts.personFields++;
        } else if (email && normalizarEmailRd(person.email) !== email) issue('contact',contact.sourceDealId,'email_existente_preservado');
      }
      if (!linked.some(link => link.pessoaId === person.id)) {
        const id=++linkSequence;
        await select('SELECT id,pessoaId,clienteId FROM PessoaClienteVinculo WHERE id=?',[id]);
        schedule(insert('PessoaClienteVinculo',{id,pessoaId:person.id,clienteId:client.id,principal:0,ativo:1,cargo:contact.title,vinculo:null,criadoEm:now}),statement('DELETE FROM PessoaClienteVinculo WHERE pessoaId=? AND clienteId=?',[person.id,client.id]));
        linked.push({id,pessoaId:person.id,clienteId:client.id,principal:0,ativo:1});counts.newLinks++;
      }else if(linked.some(link=>link.pessoaId===person.id&&!link.ativo))issue('contact',contact.sourceDealId,'vinculo_inativo_preservado');
    }
    // Execute entity writes in the shadow first so canonical card fields read the actual planned entities.
    const initialWrites = writes.length;
    await db.batch(writes,'write');
    for (const item of items) {
      const {card,deal}=item;
      const links=await read('SELECT v.principal,p.nome,p.email,p.celular FROM PessoaClienteVinculo v JOIN Pessoa p ON p.id=v.pessoaId WHERE v.clienteId=? AND v.ativo=1 ORDER BY v.id',[client.id]);
      const primary=links.filter(link=>link.principal),contact=primary.length===1?primary[0]:links.length===1?links[0]:null;
      const applicable=fields.filter(field=>field.pipelineId===card.pipelineId||fieldLinks.some(link=>link.campoId===field.id&&link.pipelineId===card.pipelineId));
      for(const field of applicable){
        if(field.escopo==='GLOBAL') continue;
        const current=await read('SELECT id,cardId,campoId,valor FROM BpmCardCampoValor WHERE cardId=? AND campoId=?',[card.id,field.id]);
        if(current.length&&!blank(current[0].valor)){preserved.push({cardId:card.id,campoId:field.id});continue;}
        let mapped;
        const directSourceId=field.sourceFieldId??/^rd\.crm\.v1\.field\.(.+)$/.exec(field.chave??'')?.[1];
        if(directSourceId){
          const raw=(deal.deal_custom_fields??[]).find(value=>(value.custom_field_id??idOf(value.custom_field))===directSourceId)?.value;
          if(dadoRdAusente(raw)){if(!blank(raw))issue('field',card.id,'origem_indefinida_preservada_payload',{campoId:field.id});continue;}
          const value=field.tipo==='selecao'?options.find(option=>option.campoId===field.id&&normalizarTexto(option.rotulo)===normalizarTexto(raw))?.chave:field.tipo==='data'?normalizarDataRd(raw):field.tipo==='numero'?(/^\d+(?:[.,]\d+)?$/.test(String(raw).trim())?String(raw).replace(',','.'):null):String(raw).trim();
          mapped={value:value??null,reason:value==null?'valor_smart_nao_representavel':null,sourceLabel:field.nome};
        }else{
          const name=normalizarTexto(field.nome),base={'cnpj':client.cnpj,'razao social':client.razaoSocial,'municipio':client.municipio,'estado':client.uf,'regime tributario do cliente':client.regimeTributario,'e-mail':contact?.email,'contato':contact?.nome,'servico contratado':card.servico};
          mapped=Object.hasOwn(base,name)&&!blank(base[name])?{value:base[name],reason:null,sourceLabel:'entidade_canonica'}:mapearCampoRd(deal,field,options.filter(option=>option.campoId===field.id));
          if(field.tipo==='selecao'&&mapped.sourceLabel==='entidade_canonica'){
            const match=options.filter(option=>option.campoId===field.id&&option.ativo&&normalizarTexto(option.rotulo)===normalizarTexto(mapped.value));mapped=match.length===1?{...mapped,value:match[0].chave}:{value:null,reason:'opcao_canonica_sem_equivalente',sourceLabel:mapped.sourceLabel};
          }
        }
        if(mapped.value==null){if(mapped.reason&&!mapped.reason.startsWith('sem_dado'))issue('field',card.id,mapped.reason,{campoId:field.id,sourceLabel:mapped.sourceLabel});continue;}
        const selectedOption=field.tipo==='selecao'?options.find(option=>option.campoId===field.id&&option.ativo&&option.chave===mapped.value):null;
        if(field.tipo==='selecao'&&!selectedOption){issue('field',card.id,'opcao_sem_identidade_ativa',{campoId:field.id});continue;}
        await select('SELECT id,chave,pipelineId,nome,tipo,escopo,fonteEntidade,fonteAtributo,ativo,configVersao,opcoesJson FROM BpmCampo WHERE id=?',[field.id]);
        await select('SELECT chave,rotulo,ativo FROM BpmCampoOpcao WHERE campoId=? ORDER BY ordem,id',[field.id]);
        await select('SELECT campoId,pipelineId FROM BpmCampoPipeline WHERE campoId=? ORDER BY pipelineId',[field.id]);
        await select('SELECT id,cardId,campoId,valor FROM BpmCardCampoValor WHERE cardId=? AND campoId=?',[card.id,field.id]);
        // The Alpha form/validator persist labels; option keys identify mappings only.
        const value=String(selectedOption?.rotulo??mapped.value),rowId=current[0]?.id??stableId('rdvalue',card.id,field.id);
        schedule(current.length?statement('UPDATE BpmCardCampoValor SET valor=? WHERE id=?',[value,rowId]):insert('BpmCardCampoValor',{id:rowId,cardId:card.id,campoId:field.id,valor:value}),current.length?statement('UPDATE BpmCardCampoValor SET valor=? WHERE id=?',[current[0].valor,rowId]):statement('DELETE FROM BpmCardCampoValor WHERE id=?',[rowId]));
        counts.cardFields++;evidence.push({cardId:card.id,campoId:field.id,fieldName:field.nome,source:mapped.sourceLabel,before:current[0]?.valor??null,after:value,optionKey:selectedOption?.chave??null});
      }
    }
    if(writes.length===0)continue;
    if(writes.length>initialWrites)await db.batch(writes.slice(initialWrites),'write');
    const before=[...selectors.values()].map(selector=>guard(selector.sql,selector.args,selector.rows));
    const after=[];for(const selector of selectors.values())after.push(guard(selector.sql,selector.args,await read(selector.sql,selector.args)));
    // Derive the compensatory state, retaining new identity rows and archived new cards.
    await db.execute('SAVEPOINT rd_sync_undo_preview');
    for(const write of undo)await db.execute(write);
    const rollbackAfter=[];for(const selector of selectors.values())rollbackAfter.push(guard(selector.sql,selector.args,await read(selector.sql,selector.args)));
    await db.execute('ROLLBACK TO rd_sync_undo_preview');
    await db.execute('RELEASE rd_sync_undo_preview');
    const change={key:`client:${client.id}`,cardId:auditCard,label:'Dados RD recuperados com origem por campo',before,after,rollbackAfter,writes,undo,evidence,entitiesRetainedOnRollback,newCardIds:items.filter(item=>item.isNew).map(item=>item.card.id)};
    changes.push(change);
    // Each following group reads the planned state, making cross-company dependencies explicit.
  }
  // Shared identities can legitimately return to their original value only when
  // an earlier group's compensation runs. Record both the immediate checkpoint
  // and the final compensated state, rather than weakening concurrency guards.
  await db.execute('SAVEPOINT rd_sync_final_rollback');
  for(const change of [...changes].reverse())for(const write of change.undo)await db.execute(write);
  const finalReads=new Map();
  for(const change of changes){
    change.rollbackFinal=[];
    for(const check of change.rollbackAfter){
      const key=JSON.stringify([check.sql,check.args]);
      if(!finalReads.has(key))finalReads.set(key,await read(check.sql,check.args));
      change.rollbackFinal.push(guard(check.sql,check.args,finalReads.get(key)));
    }
  }
  await db.execute('ROLLBACK TO rd_sync_final_rollback');
  await db.execute('RELEASE rd_sync_final_rollback');
  return {version:1,provider:PROVIDER,databaseHash,generatedAt:now,sourceHashes,summary:{...counts,sourceDeals:source.deals.length,plannedGroups:changes.length,exceptions:exceptions.length,preservedFields:preserved.length},changes,exceptions,preserved};
}
