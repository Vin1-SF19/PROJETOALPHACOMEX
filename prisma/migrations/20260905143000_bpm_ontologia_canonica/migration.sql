-- Saneamento ontologico do CRM/BPM.
-- Deliberadamente aditiva: legados permanecem para rollback/leitura, mas deixam
-- de ser autoridade runtime depois da implantacao da aplicacao.

ALTER TABLE "BpmPipeline" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmEtapa" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmEtapa" ADD COLUMN "capabilitiesJson" TEXT;
ALTER TABLE "BpmSubStatus" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmAutomacao" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmTransicaoEtapa" ADD COLUMN "chave" TEXT;
ALTER TABLE "BpmTransicaoEtapa" ADD COLUMN "lifecycleDestino" TEXT;
ALTER TABLE "BpmTransicaoEtapa" ADD COLUMN "outcomeDestino" TEXT;
ALTER TABLE "BpmTransicaoEtapa" ADD COLUMN "limparSubStatus" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BpmTransicaoEtapa" ADD COLUMN "slaEfeitoJson" TEXT;
ALTER TABLE "BpmCard" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BpmRequisito" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "chave" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "etapaId" TEXT,
  "transicaoId" TEXT,
  "campoId" TEXT,
  "checklistTemplateId" TEXT,
  "alvoTipo" TEXT NOT NULL CHECK ("alvoTipo" IN ('CAMPO','CHECKLIST','CAPABILITY','REGRA')),
  "alvoChave" TEXT,
  "fase" TEXT NOT NULL CHECK ("fase" IN ('DURING_STAGE','ENTER_STAGE','EXIT_STAGE')),
  "condicaoJson" TEXT,
  "mensagem" TEXT NOT NULL,
  "fonte" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("transicaoId") REFERENCES "BpmTransicaoEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("campoId") REFERENCES "BpmCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("checklistTemplateId") REFERENCES "BpmChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmEtapaFormulario" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "etapaId" TEXT NOT NULL UNIQUE,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmFormularioSecao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "formularioId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("formularioId") REFERENCES "BpmEtapaFormulario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmFormularioComponente" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "secaoId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('CAMPO','CHECKLIST','CAPABILITY')),
  "campoId" TEXT,
  "capability" TEXT,
  "configJson" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("secaoId") REFERENCES "BpmFormularioSecao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("campoId") REFERENCES "BpmCampo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCardEstado" (
  "cardId" TEXT NOT NULL PRIMARY KEY,
  "outcome" TEXT,
  "subStatusId" TEXT,
  "canceladoEm" DATETIME,
  "arquivadoEm" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("subStatusId") REFERENCES "BpmSubStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BpmTransicaoExecucao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "cardId" TEXT NOT NULL,
  "transicaoId" TEXT NOT NULL,
  "etapaOrigemId" TEXT NOT NULL,
  "etapaDestinoId" TEXT NOT NULL,
  "versaoEsperada" INTEGER NOT NULL,
  "versaoResultante" INTEGER NOT NULL,
  "atorTipo" TEXT NOT NULL,
  "atorUserId" INTEGER,
  "atorExecucaoId" TEXT,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "concluidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("transicaoId") REFERENCES "BpmTransicaoEtapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("etapaOrigemId") REFERENCES "BpmEtapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("etapaDestinoId") REFERENCES "BpmEtapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BpmCardReuniao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cardId" TEXT NOT NULL,
  "chave" TEXT NOT NULL DEFAULT 'principal',
  "status" TEXT NOT NULL DEFAULT 'AGENDADA',
  "agendadaEm" DATETIME,
  "googleEventId" TEXT,
  "googleCalendarId" TEXT,
  "googleMeetLink" TEXT,
  "transcricao" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCardFollowUpEstado" (
  "cardId" TEXT NOT NULL PRIMARY KEY,
  "proximoContatoEm" DATETIME,
  "standbyUltimoEm" DATETIME,
  "standbyInterrompidoEm" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BpmCardServicoContexto" (
  "cardId" TEXT NOT NULL PRIMARY KEY,
  "clienteServicoId" INTEGER,
  "contratoComercialId" TEXT,
  "nomeLegado" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("clienteServicoId") REFERENCES "ClienteServico"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("contratoComercialId") REFERENCES "contratos_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Conversao por IDs inventariados. Labels sao usados somente para apresentacao.
UPDATE "BpmPipeline" SET "chave" = CASE "id"
  WHEN 'cmsd9yw74000adzggrw91um3j' THEN 'financeiro'
  WHEN 'cmssy4gd60000dz7sn1gdl3yi' THEN 'operacional'
  WHEN 'cmsd9yx4v000gdzggtz2u90mq' THEN 'radar'
  WHEN 'cmsd9yvb90000dzggt1gjl980' THEN 'comercial'
  ELSE 'pipeline:' || "id" END
WHERE "chave" IS NULL;

UPDATE "BpmEtapa" SET "chave" = CASE "id"
  WHEN 'cmt8vpa0h000004jiprwpu64s' THEN 'solicitacao_contrato'
  WHEN 'cmsd9yw74000ddzggndlvgbun' THEN 'elaboracao_contrato'
  WHEN 'cmsd9yw74000edzgg4i0kwb65' THEN 'elaboracao_contrato_legacy'
  WHEN 'cmsd9yw74000fdzgg57ow6gh9' THEN 'formalizacao_contratacao'
  WHEN 'cmt36ivl90003kw0a28lwz0xn' THEN 'confirmacao_pagamento'
  WHEN 'cmt36ivlg0005kw0amtnob57l' THEN 'emissao_nota_fiscal'
  WHEN 'cmt36ivlo0007kw0aju0fddxp' THEN 'contratacao_finalizada'
  WHEN 'cmssy4gd70003dz7s1u6cvx68' THEN 'boas_vindas'
  WHEN 'cmssy4gd70004dz7s5kc5gfh6' THEN 'alinhamento_estrategico_agendado'
  WHEN 'cmssy4gd70005dz7sjzv19noy' THEN 'envio_checklist_atualizado'
  WHEN 'cmssy4gd70006dz7s2hr78bgx' THEN 'documentacao_em_analise'
  WHEN 'cmssy4gd70007dz7shsfsun3j' THEN 'processo_para_revisao'
  WHEN 'cmssy4gd70008dz7szj2pvhdr' THEN 'processo_revisado'
  WHEN 'cmssy4gd70009dz7suhx1d2do' THEN 'revisao_protocolo_feito'
  WHEN 'cmssy4gd7000adz7sdu28vt1t' THEN 'aguardando_despacho'
  WHEN 'cmssy4gd7000bdz7s1335cpt4' THEN 'peticao'
  WHEN 'cmssy4gd7000cdz7s8hsgb3kg' THEN 'exigencia_fiscal'
  WHEN 'cmssy4gd7000ddz7szwgop2y2' THEN 'resposta_ao_fiscal'
  WHEN 'cmssy4gd7000edz7sdoqytf8c' THEN 'processo_deferido'
  WHEN 'cmssy4gd7000fdz7sp9l85cf1' THEN 'processo_indeferido'
  WHEN 'cmsd9yx4w000jdzggwt8n4xpj' THEN 'em_monitoramento'
  WHEN 'cmsd9yx4w000kdzggnbyjpwkq' THEN 'pendencia'
  WHEN 'cmsd9yx4w000ldzggxeq8n4n1' THEN 'concluido'
  WHEN 'cmsd9yvb90003dzgg34vyurim' THEN 'novos_leads'
  WHEN 'cmsd9yvb90004dzgglwf9jjfc' THEN 'agendar_reuniao'
  WHEN 'cmsd9yvb90005dzgg8fj8vzeu' THEN 'reuniao_agendada'
  WHEN 'cmsd9yvb90006dzggi35u7evg' THEN 'em_tratativa'
  WHEN 'cmsd9yvb90008dzgg5s3czbv6' THEN 'fechado'
  WHEN 'cmsd9yvb90007dzggeumu49mm' THEN 'lost'
  WHEN 'cmsd9yvb90009dzggfimn1psq' THEN 'sem_viabilidade'
  WHEN 'cmsngxruj000hdzf069rei6fq' THEN 'standby_follow_up'
  WHEN 'cmsngxs2n000ldzf0nk2e9c40' THEN 'monitoramento'
  ELSE 'etapa:' || "id" END
WHERE "chave" IS NULL;

UPDATE "BpmEtapa" SET "ehInicial" = true WHERE "id" IN (
  'cmt8vpa0h000004jiprwpu64s','cmssy4gd70003dz7s1u6cvx68',
  'cmsd9yx4w000jdzggwt8n4xpj','cmsd9yvb90003dzgg34vyurim'
);
UPDATE "BpmEtapa" SET "ehFinal" = true WHERE "id" IN (
  'cmt36ivlo0007kw0aju0fddxp','cmssy4gd7000edz7sdoqytf8c',
  'cmsd9yx4w000ldzggxeq8n4n1','cmsd9yvb90008dzgg5s3czbv6',
  'cmsd9yvb90007dzggeumu49mm','cmsd9yvb90009dzggfimn1psq'
);

UPDATE "BpmEtapa" SET "capabilitiesJson" = CASE "id"
  WHEN 'cmsd9yvb90004dzgglwf9jjfc' THEN '["MEETING_SCHEDULER","FOLLOW_UP_SCHEDULER"]'
  WHEN 'cmsd9yvb90005dzgg8fj8vzeu' THEN '["MEETING_TRANSCRIPT","FOLLOW_UP_SCHEDULER"]'
  WHEN 'cmsd9yvb90006dzggi35u7evg' THEN '["FOLLOW_UP_CHECKLIST","FOLLOW_UP_SCHEDULER"]'
  WHEN 'cmsd9yvb90008dzgg5s3czbv6' THEN '["COMMERCIAL_POST_CLOSING","FOLLOW_UP_SCHEDULER"]'
  WHEN 'cmsngxruj000hdzf069rei6fq' THEN '["STANDBY_FOLLOW_UP","FOLLOW_UP_SCHEDULER"]'
  ELSE '["FOLLOW_UP_SCHEDULER"]' END
WHERE "capabilitiesJson" IS NULL;

UPDATE "BpmCampo" SET "chave" = CASE "id"
  WHEN 'c47e038e0323da47f06fce007' THEN 'alpha.legacy.faturamento.ultimos.5.anos'
  WHEN 'cmsnjzmy8001ddz5gwpocdb7j' THEN 'alpha.exportador'
  WHEN 'cmsnjzn30001fdz5g5gganw9l' THEN 'alpha.nivel.complexidade.revisao'
  WHEN 'cmsnjzn8v001hdz5g362n7apr' THEN 'alpha.historico.tentativas.revisao'
  WHEN 'cmsnjzno9001ndz5go7wstl62' THEN 'alpha.motivo.lost.outro'
  WHEN 'cmt36ivr5001nkw0adpbklsea' THEN 'alpha.financeiro.status.contrato.assinatura'
  WHEN 'cmt36ivru001tkw0axemf2k1v' THEN 'alpha.regime.tributario.prestador'
  WHEN 'cmt36ivsg001xkw0ar1oissgg' THEN 'alpha.aliquota.irrf'
  WHEN 'cmt36ivso001zkw0an0mjwalo' THEN 'alpha.financeiro.valor.irrf'
  WHEN 'cmt36ivt30023kw0atucqewar' THEN 'alpha.aliquota.csrf'
  WHEN 'cmt36ivtb0025kw0a7d0psl75' THEN 'alpha.financeiro.valor.csrf'
  WHEN 'cmt36ivtn0027kw0afwaj6z2g' THEN 'alpha.total.retencoes'
  WHEN 'cmt36ivtu0029kw0a76u59syc' THEN 'alpha.financeiro.valor.liquido.pagamento'
  WHEN 'cmt36ivuf002fkw0a165blz20' THEN 'alpha.memoria.calculo'
  WHEN 'cmt36ivve002pkw0a82cim2ge' THEN 'alpha.legacy.forma.pagamento.utilizada'
  WHEN 'cmt36ivvl002rkw0ap9tfue63' THEN 'alpha.comprovante.pagamento'
  WHEN 'cmt36ivlv0009kw0ahb5x0en4' THEN 'alpha.legacy.cnpj.financeiro'
  WHEN 'cmt36ivns000tkw0a01zcqo0l' THEN 'alpha.regime.tributario.cliente'
  WHEN 'cmt36ivo7000xkw0aiumeej4e' THEN 'alpha.legacy.valor.bruto.contrato'
  WHEN 'cmt36ivoe000zkw0ay6otrlc8' THEN 'alpha.legacy.forma.pagamento.financeiro'
  WHEN 'cmt36ivp50015kw0axn2uwmh4' THEN 'alpha.legacy.origem.cliente.financeiro'
  WHEN 'cmt36ivpl0019kw0a33qzjcaj' THEN 'alpha.contato.nome.responsavel'
  WHEN 'cmt36ivps001bkw0ah4iztji5' THEN 'alpha.observacoes.comerciais'
  WHEN 'cmsszkp8yu38mf5j5gyh00000' THEN 'alpha.cpf.responsavel'
  ELSE 'alpha.legacy.' || "id" END
WHERE "chave" IS NULL;

UPDATE "BpmAutomacao" SET "chave" = 'automacao:' || "id" WHERE "chave" IS NULL;
UPDATE "BpmSubStatus" SET "chave" = 'substatus:' || "id" WHERE "chave" IS NULL;

-- Catalogo comercial conhecido: codigo e identidade ficam separados do label.
INSERT INTO "BpmSubStatus" ("id","etapaId","chave","nome","cor","ordem","ativo","updatedAt") VALUES
  ('substatus:fechado:aguardando_contrato','cmsd9yvb90008dzgg5s3czbv6','AGUARDANDO_CONTRATO','Aguardando contrato','#64748b',10,true,CURRENT_TIMESTAMP),
  ('substatus:fechado:contrato_a_enviar','cmsd9yvb90008dzgg5s3czbv6','CONTRATO_A_ENVIAR','Contrato a enviar','#3b82f6',20,true,CURRENT_TIMESTAMP),
  ('substatus:fechado:contrato_enviado','cmsd9yvb90008dzgg5s3czbv6','CONTRATO_ENVIADO','Contrato enviado','#f59e0b',30,true,CURRENT_TIMESTAMP),
  ('substatus:fechado:pagamento_confirmado','cmsd9yvb90008dzgg5s3czbv6','PAGAMENTO_CONFIRMADO','Pagamento confirmado','#8b5cf6',40,true,CURRENT_TIMESTAMP),
  ('substatus:fechado:contrato_assinado','cmsd9yvb90008dzgg5s3czbv6','CONTRATO_ASSINADO','Contrato assinado','#10b981',50,true,CURRENT_TIMESTAMP);

UPDATE "BpmTransicaoEtapa"
SET "chave" = 'transicao:' || "etapaOrigemId" || ':' || "etapaDestinoId"
WHERE "chave" IS NULL;

-- Uma origem configurada no legado era uma allowlist. O backfill preserva a
-- decisao na tabela canônica, que passa a ser a unica autoridade runtime.
UPDATE "BpmTransicaoEtapa" AS canonical
SET "permitida" = false
WHERE EXISTS (
  SELECT 1 FROM "BpmEtapaTransicaoPermitida" legacyOrigin
  WHERE legacyOrigin."etapaOrigemId" = canonical."etapaOrigemId"
)
AND NOT EXISTS (
  SELECT 1 FROM "BpmEtapaTransicaoPermitida" legacyEdge
  WHERE legacyEdge."etapaOrigemId" = canonical."etapaOrigemId"
    AND legacyEdge."etapaDestinoId" = canonical."etapaDestinoId"
);

UPDATE "BpmTransicaoEtapa" SET
  "lifecycleDestino" = 'CONCLUIDO',
  "outcomeDestino" = CASE "etapaDestinoId"
    WHEN 'cmsd9yvb90008dzgg5s3czbv6' THEN 'WON'
    WHEN 'cmsd9yvb90007dzggeumu49mm' THEN 'LOST'
    WHEN 'cmsd9yvb90009dzggfimn1psq' THEN 'NO_VIABILITY'
    WHEN 'cmssy4gd7000edz7sdoqytf8c' THEN 'APPROVED'
    WHEN 'cmt36ivlo0007kw0aju0fddxp' THEN 'CONTRACTED'
    WHEN 'cmsd9yx4w000ldzggxeq8n4n1' THEN 'COMPLETED'
    ELSE "outcomeDestino" END
WHERE "etapaDestinoId" IN (
  'cmsd9yvb90008dzgg5s3czbv6','cmsd9yvb90007dzggeumu49mm',
  'cmsd9yvb90009dzggfimn1psq','cmssy4gd7000edz7sdoqytf8c',
  'cmt36ivlo0007kw0aju0fddxp','cmsd9yx4w000ldzggxeq8n4n1'
);

-- Sair de uma etapa terminal para uma etapa nao terminal reativa o processo
-- de forma explicita, evitando lifecycle concluido em etapa ativa.
UPDATE "BpmTransicaoEtapa" SET "lifecycleDestino"='ATIVO'
WHERE "lifecycleDestino" IS NULL;

-- Sair/retornar para etapa nao terminal reativa explicitamente o processo.
UPDATE "BpmTransicaoEtapa"
SET "lifecycleDestino"='ATIVO', "outcomeDestino"=NULL
WHERE "lifecycleDestino" IS NULL;

-- Estado runtime separado de etapa/lifecycle, sem inferencia por labels.
INSERT INTO "BpmCardEstado" ("cardId","outcome","canceladoEm","arquivadoEm","updatedAt")
SELECT card."id", NULL,
  CASE WHEN card."status" = 'CANCELADO' THEN COALESCE(card."concluidoEm",card."updatedAt") END,
  CASE WHEN card."status" = 'ARQUIVADO' THEN COALESCE(card."concluidoEm",card."updatedAt") END,
  CURRENT_TIMESTAMP
FROM "BpmCard" card;

UPDATE "BpmCardEstado"
SET "subStatusId" = (
  SELECT sub."id" FROM "BpmSubStatus" sub
  WHERE sub."etapaId"='cmsd9yvb90008dzgg5s3czbv6'
    AND sub."chave"=(SELECT card."statusPosFechamento" FROM "BpmCard" card WHERE card."id"="BpmCardEstado"."cardId")
)
WHERE EXISTS (
  SELECT 1 FROM "BpmCard" card
  WHERE card."id"="BpmCardEstado"."cardId"
    AND card."etapaId"='cmsd9yvb90008dzgg5s3czbv6'
    AND card."statusPosFechamento" IS NOT NULL
);

-- Owners especializados: copia integral e reversivel das colunas nativas.
INSERT INTO "BpmCardReuniao" (
  "id","cardId","chave","status","agendadaEm","googleEventId",
  "googleCalendarId","googleMeetLink","transcricao","updatedAt"
)
SELECT 'meeting:' || card."id", card."id", 'principal',
  CASE WHEN card."dataReuniao" IS NULL THEN 'RASCUNHO' ELSE 'AGENDADA' END,
  card."dataReuniao",card."googleEventId",card."googleCalendarId",
  card."googleMeetLink",card."transcricaoReuniao",CURRENT_TIMESTAMP
FROM "BpmCard" card
WHERE card."dataReuniao" IS NOT NULL OR card."googleEventId" IS NOT NULL
   OR card."googleCalendarId" IS NOT NULL OR card."googleMeetLink" IS NOT NULL
   OR card."transcricaoReuniao" IS NOT NULL;

INSERT INTO "BpmCardFollowUpEstado" (
  "cardId","proximoContatoEm","standbyUltimoEm","standbyInterrompidoEm","updatedAt"
)
SELECT card."id",card."proximoContatoEm",card."standbyFollowUpUltimoEm",
  card."standbyFollowUpInterrompidoEm",CURRENT_TIMESTAMP
FROM "BpmCard" card
WHERE card."proximoContatoEm" IS NOT NULL OR card."standbyFollowUpUltimoEm" IS NOT NULL
   OR card."standbyFollowUpInterrompidoEm" IS NOT NULL;

INSERT INTO "BpmCardServicoContexto" ("cardId","nomeLegado","updatedAt")
SELECT card."id",card."servico",CURRENT_TIMESTAMP
FROM "BpmCard" card WHERE card."servico" IS NOT NULL;

-- Requisitos base, de etapa, entrada e saida. Nenhum deles depende de
-- visibilidade nem de BpmCampoAcesso.obrigatorio.
INSERT INTO "BpmRequisito" (
  "id","chave","pipelineId","campoId","alvoTipo","alvoChave",
  "fase","mensagem","fonte","ordem","updatedAt"
)
SELECT 'req:field:base:' || campo."id",'field:base:' || campo."id",campo."pipelineId",
  campo."id",'CAMPO',campo."chave",'DURING_STAGE',
  'Preencha ' || campo."nome" || '.','CAMPO',campo."ordem",CURRENT_TIMESTAMP
FROM "BpmCampo" campo WHERE campo."obrigatorio" = true AND campo."ativo" = true;

INSERT INTO "BpmRequisito" (
  "id","chave","pipelineId","etapaId","campoId","alvoTipo","alvoChave",
  "fase","condicaoJson","mensagem","fonte","ordem","updatedAt"
)
SELECT 'req:field:stage:' || config."id",'field:stage:' || config."id",etapa."pipelineId",
  config."etapaId",config."campoId",'CAMPO',campo."chave",'DURING_STAGE',
  config."condicaoObrigatoriedadeJson",'Preencha ' || campo."nome" || '.',
  'ETAPA_CONFIG',config."ordem",CURRENT_TIMESTAMP
FROM "BpmCampoEtapaConfig" config
JOIN "BpmEtapa" etapa ON etapa."id"=config."etapaId"
JOIN "BpmCampo" campo ON campo."id"=config."campoId"
WHERE config."obrigatorio"=true;

INSERT INTO "BpmRequisito" (
  "id","chave","pipelineId","etapaId","campoId","alvoTipo","alvoChave",
  "fase","condicaoJson","mensagem","fonte","ordem","updatedAt"
)
SELECT 'req:field:enter:' || config."id",'field:enter:' || config."id",etapa."pipelineId",
  config."etapaId",config."campoId",'CAMPO',campo."chave",'ENTER_STAGE',
  config."condicaoObrigatoriedadeJson",'Preencha ' || campo."nome" || ' para entrar nesta etapa.',
  'ETAPA_CONFIG',config."ordem",CURRENT_TIMESTAMP
FROM "BpmCampoEtapaConfig" config
JOIN "BpmEtapa" etapa ON etapa."id"=config."etapaId"
JOIN "BpmCampo" campo ON campo."id"=config."campoId"
WHERE config."obrigatorioEntrada"=true;

INSERT INTO "BpmRequisito" (
  "id","chave","pipelineId","etapaId","campoId","alvoTipo","alvoChave",
  "fase","condicaoJson","mensagem","fonte","ordem","updatedAt"
)
SELECT 'req:field:exit:' || config."id",'field:exit:' || config."id",etapa."pipelineId",
  config."etapaId",config."campoId",'CAMPO',campo."chave",'EXIT_STAGE',
  config."condicaoObrigatoriedadeJson",'Preencha ' || campo."nome" || ' para sair desta etapa.',
  'ETAPA_CONFIG',config."ordem",CURRENT_TIMESTAMP
FROM "BpmCampoEtapaConfig" config
JOIN "BpmEtapa" etapa ON etapa."id"=config."etapaId"
JOIN "BpmCampo" campo ON campo."id"=config."campoId"
WHERE config."obrigatorioSaida"=true;

INSERT INTO "BpmRequisito" (
  "id","chave","pipelineId","etapaId","campoId","alvoTipo","alvoChave",
  "fase","mensagem","fonte","updatedAt"
)
SELECT 'req:field:legacy:' || legacy."id",'field:legacy:' || legacy."id",etapa."pipelineId",
  legacy."etapaId",legacy."campoId",'CAMPO',campo."chave",'DURING_STAGE',
  'Preencha ' || campo."nome" || '.','LEGADO',CURRENT_TIMESTAMP
FROM "BpmCampoObrigatorioEtapa" legacy
JOIN "BpmEtapa" etapa ON etapa."id"=legacy."etapaId"
JOIN "BpmCampo" campo ON campo."id"=legacy."campoId"
WHERE NOT EXISTS (
  SELECT 1 FROM "BpmRequisito" existing
  WHERE existing."etapaId"=legacy."etapaId"
    AND existing."campoId"=legacy."campoId"
    AND existing."fase"='DURING_STAGE'
);

-- FormDefinition explicita para toda etapa. Policies continuam externas a ela.
INSERT INTO "BpmEtapaFormulario" ("id","etapaId","versao","ativo","updatedAt")
SELECT 'form:' || etapa."id",etapa."id",1,true,CURRENT_TIMESTAMP FROM "BpmEtapa" etapa;

INSERT INTO "BpmFormularioSecao" ("id","formularioId","chave","titulo","ordem","updatedAt")
SELECT 'section:' || etapa."id" || ':fields','form:' || etapa."id",'fields','Dados da etapa',100,CURRENT_TIMESTAMP
FROM "BpmEtapa" etapa;

INSERT INTO "BpmFormularioSecao" ("id","formularioId","chave","titulo","ordem","updatedAt")
SELECT 'section:' || etapa."id" || ':workflow','form:' || etapa."id",'workflow','Acompanhamento',200,CURRENT_TIMESTAMP
FROM "BpmEtapa" etapa;

INSERT INTO "BpmFormularioComponente" (
  "id","secaoId","chave","tipo","campoId","ordem","updatedAt"
)
SELECT 'component:' || etapa."id" || ':field:' || campo."id",
  'section:' || etapa."id" || ':fields','field:' || campo."id",'CAMPO',campo."id",
  COALESCE(config."ordem",campo."ordem"),CURRENT_TIMESTAMP
FROM "BpmEtapa" etapa
JOIN "BpmCampo" campo ON campo."ativo"=true AND (
  campo."etapaId"=etapa."id"
  OR (campo."etapaId" IS NULL AND campo."pipelineId"=etapa."pipelineId")
  OR EXISTS (
    SELECT 1 FROM "BpmCampoPipeline" associado
    WHERE associado."campoId"=campo."id" AND associado."pipelineId"=etapa."pipelineId"
  )
)
LEFT JOIN "BpmCampoEtapaConfig" config
  ON config."campoId"=campo."id" AND config."etapaId"=etapa."id";

INSERT INTO "BpmFormularioComponente" (
  "id","secaoId","chave","tipo","capability","ordem","updatedAt"
)
SELECT 'component:' || etapa."id" || ':checklist','section:' || etapa."id" || ':workflow',
  'checklist:stage','CHECKLIST','STAGE_CHECKLIST',100,CURRENT_TIMESTAMP
FROM "BpmEtapa" etapa;

INSERT INTO "BpmFormularioComponente" (
  "id","secaoId","chave","tipo","capability","ordem","updatedAt"
)
SELECT 'component:' || etapa."id" || ':follow-up','section:' || etapa."id" || ':workflow',
  'capability:FOLLOW_UP_SCHEDULER','CAPABILITY','FOLLOW_UP_SCHEDULER',200,CURRENT_TIMESTAMP
FROM "BpmEtapa" etapa;

INSERT INTO "BpmFormularioComponente" (
  "id","secaoId","chave","tipo","capability","ordem","updatedAt"
)
VALUES
  ('component:cmsd9yvb90004dzgglwf9jjfc:meeting','section:cmsd9yvb90004dzgglwf9jjfc:workflow','capability:MEETING_SCHEDULER','CAPABILITY','MEETING_SCHEDULER',10,CURRENT_TIMESTAMP),
  ('component:cmsd9yvb90005dzgg8fj8vzeu:transcript','section:cmsd9yvb90005dzgg8fj8vzeu:workflow','capability:MEETING_TRANSCRIPT','CAPABILITY','MEETING_TRANSCRIPT',10,CURRENT_TIMESTAMP),
  ('component:cmsd9yvb90006dzggi35u7evg:follow-up-checklist','section:cmsd9yvb90006dzggi35u7evg:workflow','capability:FOLLOW_UP_CHECKLIST','CAPABILITY','FOLLOW_UP_CHECKLIST',10,CURRENT_TIMESTAMP),
  ('component:cmsd9yvb90008dzgg5s3czbv6:post-closing','section:cmsd9yvb90008dzgg5s3czbv6:workflow','capability:COMMERCIAL_POST_CLOSING','CAPABILITY','COMMERCIAL_POST_CLOSING',10,CURRENT_TIMESTAMP),
  ('component:cmsngxruj000hdzf069rei6fq:standby','section:cmsngxruj000hdzf069rei6fq:workflow','capability:STANDBY_FOLLOW_UP','CAPABILITY','STANDBY_FOLLOW_UP',10,CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "BpmPipeline_chave_key" ON "BpmPipeline"("chave");
CREATE UNIQUE INDEX "BpmEtapa_pipelineId_chave_key" ON "BpmEtapa"("pipelineId","chave");
CREATE UNIQUE INDEX "BpmSubStatus_etapaId_chave_key" ON "BpmSubStatus"("etapaId","chave");
CREATE UNIQUE INDEX "BpmAutomacao_pipelineId_chave_key" ON "BpmAutomacao"("pipelineId","chave");
CREATE UNIQUE INDEX "BpmTransicaoEtapa_pipelineId_chave_key" ON "BpmTransicaoEtapa"("pipelineId","chave");
CREATE INDEX "BpmRequisito_etapaId_fase_ativo_idx" ON "BpmRequisito"("etapaId","fase","ativo");
CREATE INDEX "BpmRequisito_transicaoId_fase_ativo_idx" ON "BpmRequisito"("transicaoId","fase","ativo");
CREATE INDEX "BpmRequisito_campoId_idx" ON "BpmRequisito"("campoId");
CREATE INDEX "BpmRequisito_checklistTemplateId_idx" ON "BpmRequisito"("checklistTemplateId");
CREATE UNIQUE INDEX "BpmRequisito_pipelineId_chave_key" ON "BpmRequisito"("pipelineId","chave");
CREATE INDEX "BpmFormularioSecao_formularioId_ordem_idx" ON "BpmFormularioSecao"("formularioId","ordem");
CREATE UNIQUE INDEX "BpmFormularioSecao_formularioId_chave_key" ON "BpmFormularioSecao"("formularioId","chave");
CREATE INDEX "BpmFormularioComponente_secaoId_ordem_idx" ON "BpmFormularioComponente"("secaoId","ordem");
CREATE INDEX "BpmFormularioComponente_campoId_idx" ON "BpmFormularioComponente"("campoId");
CREATE UNIQUE INDEX "BpmFormularioComponente_secaoId_chave_key" ON "BpmFormularioComponente"("secaoId","chave");
CREATE INDEX "BpmCardEstado_outcome_idx" ON "BpmCardEstado"("outcome");
CREATE INDEX "BpmCardEstado_subStatusId_idx" ON "BpmCardEstado"("subStatusId");
CREATE INDEX "BpmTransicaoExecucao_cardId_concluidoEm_idx" ON "BpmTransicaoExecucao"("cardId","concluidoEm");
CREATE INDEX "BpmTransicaoExecucao_transicaoId_idx" ON "BpmTransicaoExecucao"("transicaoId");
CREATE INDEX "BpmTransicaoExecucao_correlationId_idx" ON "BpmTransicaoExecucao"("correlationId");
CREATE INDEX "BpmTransicaoExecucao_atorExecucaoId_idx" ON "BpmTransicaoExecucao"("atorExecucaoId");
CREATE INDEX "BpmCardReuniao_cardId_status_idx" ON "BpmCardReuniao"("cardId","status");
CREATE INDEX "BpmCardReuniao_googleEventId_idx" ON "BpmCardReuniao"("googleEventId");
CREATE UNIQUE INDEX "BpmCardReuniao_cardId_chave_key" ON "BpmCardReuniao"("cardId","chave");
CREATE INDEX "BpmCardFollowUpEstado_proximoContatoEm_idx" ON "BpmCardFollowUpEstado"("proximoContatoEm");
CREATE INDEX "BpmCardServicoContexto_clienteServicoId_idx" ON "BpmCardServicoContexto"("clienteServicoId");
CREATE INDEX "BpmCardServicoContexto_contratoComercialId_idx" ON "BpmCardServicoContexto"("contratoComercialId");
