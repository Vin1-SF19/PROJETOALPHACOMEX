# Vault — RM-2026-E1E1F7 — Fase 3

Status: WAITING_APPROVAL. Nenhum comprovante específico recebido; mandatoryAdministratorFeedback vazio. Nenhuma migration criada ou executada. Este documento é o plano para aprovação externa; não é autorização de execução.

## Ambiente e pré-condições

Alvo solicitado: Turso real de produção do Painel Alpha, identificado pelas variáveis TURSO_DATABASE_URL/TURSO_AUTH_TOKEN carregadas de .env.local. O script abortou antes de conectar porque uma ou ambas estão indisponíveis. Portanto a identidade remota, schema remoto e contagens NÃO foram confirmados. Não se pode presumir que o schema local represente integralmente produção. Nenhum segredo foi impresso ou incluído neste relatório.

A aprovação deve vincular o hash deste plano, identidade do banco confirmada em preflight e manifesto de backup verificado. Sem esses complementos, nenhuma execução é liberada. Se completar a evidência mudar o plano, gerar novo checkpoint e colher aprovação específica correspondente.

## Estrutura local confirmada — citação literal

Arquivo: prisma/schema.prisma. Hash integral registrado em schema-before.sha256. Não existe model BpmEtapaCardViewConfig nem model com CardView no nome. A inspeção encontrou BpmEtapaFormulario para composição de formulário e BpmCampoEtapaConfig para visibilidade; nenhum deles representa configuração independente do card compacto.

```prisma
model BpmPipeline {
  id            String   @id @default(cuid())
  chave         String?  @unique // identidade semântica estável; nome permanece apenas apresentação
  nome          String
  ordem         Int      @default(0)
  ativo         Boolean  @default(true)
  configVersion Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  setores            BpmPipelineSetor[]
  etapas             BpmEtapa[]
  campos             BpmCampo[]
  cards              BpmCard[]
  automacoes         BpmAutomacao[]
  configAuditoria    BpmPipelineConfigAuditoria[]
  checklistPerguntas BpmChecklistFollowUpPergunta[]
  transicoesEtapa    BpmTransicaoEtapa[]
  cadencias          BpmCadencia[]
  regras             BpmRegra[]
  checklistTemplates BpmChecklistTemplate[]
  slaConfigs         BpmSlaConfig[]
  conhecimentoLinks  BpmPipelineConhecimentoLink[]
  webhookEndpoints   BpmWebhookEndpoint[]
  camposAssociados   BpmCampoPipeline[]
  requisitos         BpmRequisito[]

  @@index([ativo])
  @@index([ordem])
}

model BpmEtapa {
  id               String  @id @default(cuid())
  pipelineId       String
  chave            String? // identidade semântica estável dentro do pipeline
  nome             String
  ordem            Int     @default(0)
  cor              String? // cor de exibição da etapa (ex.: badge/coluna do Kanban); ausente = cor padrão do tema
  slaDias          Int? // histórico legado; runtime e administração usam BpmSlaConfig
  script           String? // roteiro de texto exibido na aba "Script" da coluna Presente — só leitura por enquanto
  ativo            Boolean @default(true)
  ehInicial        Boolean @default(false) // marca a etapa de entrada configurável do pipeline
  ehFinal          Boolean @default(false) // marca etapa(s) de encerramento configurável do pipeline
  capabilitiesJson String? // capacidades explícitas consumidas por domínio e apresentação

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pipeline BpmPipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  campos   BpmCampo[]
  cards    BpmCard[]

  transicoesOrigem             BpmEtapaTransicaoPermitida[] @relation("TransicaoOrigem")
  transicoesDestino            BpmEtapaTransicaoPermitida[] @relation("TransicaoDestino")
  transicoesEtapaOrigem        BpmTransicaoEtapa[]          @relation("BpmTransicaoEtapaOrigem")
  transicoesEtapaDestino       BpmTransicaoEtapa[]          @relation("BpmTransicaoEtapaDestino")
  camposObrigatorios           BpmCampoObrigatorioEtapa[]
  camposOcultos                BpmCampoOcultoEtapa[]
  visibilidades                BpmEtapaVisibilidade[]
  automacoes                   BpmAutomacao[]
  subStatus                    BpmSubStatus[]
  cadencias                    BpmCadencia[]
  cadenciaAssociacoes          BpmCadenciaEtapa[]
  checklistTemplates           BpmChecklistTemplate[]
  checklistTemplateAssociacoes BpmChecklistTemplateEtapa[]
  slaConfigs                   BpmSlaConfig[]
  campoConfiguracoes           BpmCampoEtapaConfig[]
  formulario                   BpmEtapaFormulario?
  requisitos                   BpmRequisito[]
  execucoesTransicaoOrigem     BpmTransicaoExecucao[]       @relation("BpmTransicaoExecucaoOrigem")
  execucoesTransicaoDestino    BpmTransicaoExecucao[]       @relation("BpmTransicaoExecucaoDestino")

  @@unique([pipelineId, chave])
  @@index([pipelineId])
  @@index([pipelineId, ordem])
}
```

## Fontes existentes e limite da alteração

- Nome da empresa: BpmCard.empresaId → Cliente.id; Cliente.razaoSocial e Cliente.nomeFantasia.
- CNPJ: mesma relação, Cliente.cnpj nullable.
- Telefone: BpmCard.empresaId → PessoaClienteVinculo.clienteId → Pessoa.celular; ListarTelefonesCardBpm em src/actions/bpm/Cards.ts já usa essa fonte e ordena por nome. Projeção em lote e tratamento de múltiplos contatos pertencem à implementação. Lead virtual possui NolossLead.telefone, exposto como nolossTelefone.
- Origem comercial e Radar pretendido: BpmCardCampoValor.valor, ligado por campoId a BpmCampo; valores compartilhados têm BpmCampoValorGlobal.valor por entidadeTipo/entidadeId/campoId. BpmCampoEtapaConfig continua autoridade de presença/visibilidade. A consulta atual em Cards.ts limita valores a Canal de origem e Resumo da reunião: radar exige ajuste de projeção, não coluna nova. Existência de valores preenchidos em produção não foi confirmada.
- Não há necessidade de ALTER em tabelas existentes para esses dados. Nenhum backfill, seed ou reconciliação está incluído.

## Delta exato proposto

Novo model BpmEtapaCardViewConfig: id String @id @default(cuid()), pipelineId String, etapaId String, camposJson String, versao Int @default(1), createdAt DateTime @default(now()), updatedAt DateTime @updatedAt. Relações pipeline e etapa com Cascade na exclusão e atualização; unicidade (pipelineId, etapaId). Usar createdAt/updatedAt conforme blueprint e convenção do projeto. Adicionar apenas campos inversos de relação no Prisma de BpmPipeline/BpmEtapa; isso não adiciona colunas nessas tabelas.

camposJson guarda lista ordenada de identidades estáveis do registry (campos comerciais referenciados por campoId); validação estrita na action. Ausência de registro difere de lista explicitamente vazia. CAS da versão, auditoria e incremento de BpmPipeline.configVersion serão transacionais na fase executora.

Duas FKs independentes NÃO garantem que a etapa pertença ao pipeline: a action deve revalidar etapa.pipelineId dentro da transação e rejeitar divergência. Não adicionar índice composto na tabela pai ou trigger fora deste plano.

SQL planejado, somente documental:

```sql
CREATE TABLE "BpmEtapaCardViewConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pipelineId" TEXT NOT NULL,
  "etapaId" TEXT NOT NULL,
  "camposJson" TEXT NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmEtapaCardViewConfig_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmEtapaCardViewConfig_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BpmEtapaCardViewConfig_pipelineId_etapaId_key" ON "BpmEtapaCardViewConfig"("pipelineId", "etapaId");
```

Classificação: CREATE TABLE — baixo risco, aditivo; CREATE UNIQUE INDEX — requer análise de unicidade, seguro sobre tabela nova vazia. Não há DROP/RENAME no avanço. id e updatedAt são fornecidos pelo Prisma, não por defaults SQL. Nenhuma alteração de schema local nesta fase.

## Sequência para execução posterior especificamente aprovada

1. Disponibilizar a configuração do ambiente pelo mecanismo seguro do projeto, sem revelar valores. Confirmar identidade do banco com evidência sanitizada. Regerar backup e verificar como abaixo; idade máxima 48h no momento da aplicação.
2. Preflight em transação de leitura: consultar sqlite_master para BpmPipeline, BpmEtapa e BpmEtapaCardViewConfig; PRAGMA table_info e foreign_key_list dos pais; contar pais e registros de etapa sem pipeline; PRAGMA foreign_key_check. Tabela de destino já existente, órfãos, drift ou integridade inválida bloqueiam aplicação e exigem revisão do checkpoint. Guardar contagens e fingerprints, nunca dados pessoais.
3. Depois de aprovação específica válida, preparar os arquivos Prisma limitados ao delta e migration hand-written prisma/migrations/20260919140000_bpm_etapa_card_view_config/migration.sql com os dois statements acima. Comparar cópias anterior/proposta por prisma migrate diff --script usando flags suportadas pela CLI local e sem banco remoto/shadow. Comparação ainda não executada; gate obrigatório antes de liberar aplicação, não aprovação implícita neste checkpoint.
4. Ensaiar SQL em restauração descartável dentro de database-backups/pre-change/, conferir criação, unicidade, FKs, isolamento e rollback. Não executar o SQL sobre o banco do projeto durante o ensaio.
5. Repetir preflight e validade do backup imediatamente antes de aplicar. Aplicação remota única: node scripts/apply-turso-migration.mjs prisma/migrations/20260919140000_bpm_etapa_card_view_config/migration.sql. Script inspecionado: executa statements em batch write; não registra automaticamente _prisma_migrations. Evidência externa deve registrar hash do SQL e resultado, sem inventar histórico de migration.
6. Pós-aplicação: PRAGMA table_info('BpmEtapaCardViewConfig'), foreign_key_list e index_list/index_info; confirmar os sete campos, duas FKs Cascade, unicidade composta e COUNT(*)=0; foreign_key_check sem violações. Comparar contagens/fingerprints dos pais e tabelas preexistentes. Nenhum INSERT remoto de teste.
7. Gerar client e executar gates de implementação em fase posterior. A configuração visual somente será consumível após actions, projeção, editor e renderer compartilhado.

## Impacto, riscos e alternativa

Tabela nova vazia, sem migração de dados existentes nem recriação dos pais. Risco de indisponibilidade baixo, mas DDL pode disputar lock e falhar; reservar janela sem publicação administrativa concorrente. CAS não é histórico: auditoria continuará usando infraestrutura existente. Campos configuráveis ausentes usam lista vazia, preservando shell, abertura e arrasto conforme AC-06; há risco de perda de informação visual até configurar etapas, a validar na UI.

Alternativa sem DDL: misturar configuração em BpmEtapa.script ou capabilitiesJson. Não recomendada: esses campos já têm contratos e consumidores próprios; misturaria roteiro/capabilities com apresentação compacta, sem versão independente para CAS. Tabela dedicada mantém a menor separação adequada. Nenhum dado existente deve ser reaproveitado ou apagado para simular essa configuração.

## Rollback proposto, não executado

Preferência: desativar consumidor novo e conservar tabela/dados. Rollback estrutural, somente em janela aprovada e após exportar configurações eventualmente criadas: DROP TABLE "BpmEtapaCardViewConfig"; remove também seu índice e perde todas as configurações dessa tabela. Não afeta linhas dos pais com as FKs propostas; NÃO significa ausência de perda após uso. Não executar se surgirem novos dependentes sem revisar plano. Restaurar código anterior sem Git mutável nesta sessão.

Se houver dano inesperado: parar escritas, restaurar o dump completo em instância isolada, validar integridade, FKs, contagens e hash, comparar com produção e planejar recuperação específica. Restaurar sobre produção pode perder escritas posteriores ao backup e exige aprovação própria; não é ação automática deste plano.

## Backup e evidência

Tentativas executadas: node scripts/turso-backup.mjs 'RM-2026-E1E1F7 fase 3 card Kanban por etapa' e repetição diagnóstica com motivo da RM. Ambas exit 1: TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local. Nenhum backup específico produzido, nenhum tamanho/hash/idade validado. Evidência sanitizada: backup-result.json.

Comando a repetir: node scripts/turso-backup.mjs 'RM-2026-E1E1F7 fase 3 card Kanban por etapa'. O script inspecionado usa snapshot em transação read, exporta tabelas/índices/views/triggers e dados para database-backups/pre-change/, criando manifesto com data, motivo, tabelas, linhas, bytes e SHA-256.

Após obter os caminhos reais retornados, executar scripts/verify-turso-backup.mjs com dump e manifesto. Definir TMPDIR para diretório exclusivo dentro de database-backups/pre-change/ antes de rodar, pois o verificador usa os.tmpdir(); assim a restauração temporária permanece dentro do projeto. A limpeza do script atinge somente a restauração que ele próprio cria, nunca dumps anteriores. O verificador restaura SQLite real e exige integrity_check=ok, foreign_key_check sem violações, SHA-256, tamanho, tabelas e linhas conferidos. Registrar paths reais, generatedAt, idade <48h e resultado. Não tratar backups históricos citados na memória como válidos hoje. Diretório de backups está ignorado pelo Git.

## Auditoria de entregabilidade

Artefato desta fase: este relatório Markdown e seu hash, consumidos pelo administrador/pipeline via repositório/CLI. Não há requisito de viewer na UI para esse checkpoint.

Artefato final: card compacto configurável do CRM. Reinspecionados AdminPipelineClient.tsx (aba Card do Kanban, FormularioEtapaWorkspace modo=card), FormularioEtapaWorkspace.tsx (preview FormularioEtapaRenderer) e PipelineBoardClient.tsx (seleção por etapa e nomes comerciais).

AUTO_ADJUSTMENT_REQUIRED: /PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId] → Card do Kanban ainda edita formulário, e /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card fechado não consome configuração compacta persistida.
AUTO_ADJUSTMENT_ACCEPTANCE: após aprovação Vault e implementação, salvar e recarregar composição independente por etapa, comparar preview/board compartilhados e validar AC-01 a AC-10 da story com autorização e realtime.

Não se declara DELIVERY_READY para a funcionalidade.

## Gates e checkpoint

Inspeção de schema, fontes, scripts e consumidor concluída. Backup tentou e falhou por configuração ausente. Verificação de restauração, preflight remoto, migrate diff, lint, typecheck, testes e build não executados nesta fase: checkpoint interrompe execução antes de implementação. Nenhuma aprovação técnica global reivindicada. Aprovação e backup válido continuam pendentes.

A coleta de consentimento cabe ao pipeline fora desta sessão, conforme instrução superior ao Markdown da fase. Texto para o checkpoint externo, sem pergunta interativa aqui: autorizar especificamente a criação desta tabela e índice no banco confirmado, com o hash deste plano e manifesto de backup válido anexados, após ler impacto, alternativa, validação e rollback. Uma aprovação genérica não libera execução.
