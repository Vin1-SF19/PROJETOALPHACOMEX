# Auditoria de hardcoded — Pipeline Financeiro (2026-09-26)

## Objetivo
Centralizar pipeline, etapas, campos, requisitos, valores e automações do Financeiro em configuração de banco/UI, removendo strings literais e regras fixas do runtime sem quebrar comportamento existente.

## Escopo
- Pipeline: `financeiro`.
- Etapas: `solicitacao_contrato`, `elaboracao_contrato`, `formalizacao_contratacao`, `confirmacao_pagamento`, `emissao_nota_fiscal`, `contratacao_finalizada`, `boas_vindas`.
- Automações: elaboração, assinatura, pagamento, nota fiscal, conclusão e handoff operacional.
- UI/runtime: validação de formalização, resumo de contratação, campos de etapa, anexos, lembretes e handoff.

## Scripts de configuração existentes
- `scripts/financeiro-elaboracao-config.mts`
  - Default: `PLAN` somente leitura.
  - `--apply` exige `FINANCEIRO_ELABORACAO_APROVADO=SIM_PUBLICAR_SEGUNDA_ETAPA`, `--admin-id` e backup pre-change.
  - Chaves: `alpha.contrato.elaborado`, `alpha.data.de.elaboracao`, `alpha.contrato.enviado.para.assinatura`, `alpha.data.do.envio`, `alpha.link.arquivo.do.contrato`, `alpha.financeiro.status.contrato.assinatura`.
  - Automações: `financeiro.elaboracao.envio.assinatura` e `financeiro.elaboracao.revisar.<campo>`.
  - Valida formulário, campos ativos, status canônico `Aguardando assinatura`, requisitos e histórico.
- `scripts/financeiro-formalizacao-config.mts`
  - Default: somente leitura.
  - Etapas: `formalizacao_contratacao`, `confirmacao_pagamento`, `emissao_nota_fiscal`, `contratacao_finalizada`.
  - Chaves: `alpha.financeiro.status.contrato.assinatura`, `alpha.status.da.assinatura`, `alpha.status.do.contrato`, `alpha.data.da.assinatura`, `alpha.contrato.assinado.anexo`, `alpha.pagamento.confirmado`, `alpha.financeiro.prazo.assinatura`.
- `scripts/financeiro-contrato-radar-config.mts`
  - Default: plano; `--apply` exige backup Vault validado.
  - `chaveAutomacao = "financeiro.elaboracao.gerar.contrato.radar"`.
  - Novos campos: `alpha.financeiro.contrato.valor.inicial`, `alpha.financeiro.contrato.valor.final`, `alpha.financeiro.contrato.desconto`.
  - Campos fonte: endereço, e-mail, valor bruto, forma de pagamento, condição negociada.
- `scripts/financeiro-pagamento-config.mts`
  - Default: `PLAN` somente leitura.
  - `--apply` exige `FINANCEIRO_PAGAMENTO_APROVADO=SIM_PUBLICAR_PAGAMENTO_FINANCEIRO`, Turso remoto, admin ativo e backup pre-change.
  - Campos: `alpha.pagamento.confirmado`, `alpha.data.do.pagamento`, `alpha.valor.esperado`, `alpha.valor.recebido`, `alpha.comprovante`, `alpha.comprovante.pagamento`, `alpha.forma.de.pagamento`, `alpha.status.financeiro`, `alpha.financeiro.status.contrato.assinatura`, `alpha.pagamento.no.exito`, `alpha.financeiro.valor.liquido.pagamento`, `alpha.financeiro.valor.bruto.contrato`, `alpha.total.retencoes`, `alpha.vencimento`.
  - Novos campos: `alpha.financeiro.forma.pagamento.utilizada`, `alpha.financeiro.status.contratacao`.
  - Automações: sincronizar valor esperado, recalcular status, cobrança de vencimento.
- `scripts/financeiro-conclusao-operacional-config.mts`
  - Default: somente leitura.
  - `chaveAutomacao = "financeiro.conclusao.automatica.contrato.pagamento"`.
  - Etapas: `formalizacao_contratacao`, `confirmacao_pagamento`, `emissao_nota_fiscal`, `contratacao_finalizada`, `boas_vindas`.
  - Campos de entrega: status/assinatura, pagamento, CNPJ, razão social, e-mail, serviço, contrato, NF, comercial.
- `scripts/bpm-handoff-config.mts`
  - Default: `PLAN` somente leitura.
  - `--apply` exige `BPM_HANDOFF_APROVADO=SIM_PUBLICAR_HANDOFF` e backup pre-change.
  - Automação: `financeiro.handoff.contrato.concluido.operacional`.
  - Origem: `financeiro.contratacao_finalizada`.
  - Destino: `operacional.boas_vindas`.
  - Também ajusta automação comercial `fechamento` para remover destino Radar inativo.

## Schema relevante
- `BpmPipeline` linha `4338`: `chave`, `nome`, `ordem`, `ativo`, `configVersion`, relações para etapas, campos, automações, requisitos, auditoria, transições.
- `BpmEtapa` linha `4479`: etapa do pipeline, chave, ordem, inicial/final.
- `BpmRequisito` linha `4601`: requisito por pipeline/etapa, `alvoTipo`, `condicaoJson`, `fase`, `ordem`, `ativo`.
- `BpmAutomacao` linha `4743`: `chave`, `pipelineId`, `etapaId`, `gatilhoTipo`, `acaoTipo`, `parametrosJson`, `ativa`, `criadoPorId`, `@@unique([pipelineId, chave])`.
- `BpmAutomacaoVersao` linha `4777`: snapshot imutável por versão, `status` (`RASCUNHO`, `ATIVA`, `ARQUIVADA`), `gatilhoConfigJson`, `condicaoJson`, `grafoJson`, `timezone`.
- `BpmCampo` linha `4994`: `chave`, `pipelineId`, `etapaId?`, `tipo`, `opcoesJson`, `obrigatorio`, `ordem`, `ativo`, `escopo`, `valorPadrao`, `fonteEntidade`, `fonteAtributo`, `visivel`, `editavel`, `somenteLeitura`, `configVersao`.
- `BpmCampoEtapaConfig` linha `5085`: configuração por etapa: `visivel`, `editavel`, `somenteLeitura`, `ordem`, `grupo`, `condicaoObrigatoriedadeJson`, `valorPadrao`.
- `BpmCampoObrigatorioEtapa` linha `5872`: `@@unique([campoId, etapaId])`.
- `BpmCampoOcultoEtapa` linha `5885`: legado; `BpmCampoEtapaConfig` é a fonte operacional.
- `BpmChecklistFollowUp` linha `5900`: `cardId`, `perguntasJson`, `respostasJson`, `completo`, `criadoPorId`, `criadoEm`.

## Hardcoded identificados em runtime
- `src/lib/bpm/ontology.ts`
  - `BPM_PIPELINE_KEYS`, `BPM_STAGE_KEYS`, `BPM_CAPABILITIES`, `BPM_FIELD_KEYS`.
  - Etapas financeiras e chaves de campo fixas.
- `src/lib/bpm/automacoes.ts`
  - Strings `"Financeiro"`, `"Radar"`, `"Nota Fiscal"`.
  - Automações `D-034`.
- `src/lib/bpm/automacoes/migracao-hardcoded.ts`
  - `fechamento`, `notaFiscal`, `novosLeadsOitoDias`, `agendarReuniaoOitoDias`, `reuniaoAgendadaOitoDias`, `ligacoesDiarias`, `standbySemanal`, `monitoramentoMensal`, `transcricaoMeet`.
- `src/lib/bpm/automacoes/central-runtime.ts`
  - Ações `CRIAR_SLA`, `CRIAR_ALERTA`, `ADICIONAR_ANOTACAO`, `CRIAR_CARD_OUTRO_PIPELINE`.
- `src/actions/bpm/ExcecaoOperacional.ts`
  - `CHAVE_AUTOMACAO = "financeiro.handoff.contrato.concluido.operacional"`.
  - Guarda de pipeline/etapa financeira.
- `src/lib/bpm/resumo-contratacao-server.ts`
  - `CAMPOS` hardcoded.
  - Filtro `pipeline: { chave: "financeiro" }`.
- `src/actions/bpm/Cards.ts`
  - `ObterCardBpm`, `carregarResumoContratacao`, `registrarConclusaoContratoFinanceiro`, `publicarEventoBpm`.
- `src/lib/bpm/pipeline-financeiro.ts`
  - `FINANCIAL_FIELD_KEYS`.
- `src/lib/bpm/financeiro-formalizacao.ts`
  - `avaliarFormalizacaoFinanceira` com `"Assinado"`, `"Sim"`, data/anexo.
- `src/lib/bpm/financeiro-assinatura-server.ts`
  - `registrarConclusaoContratoFinanceiro` e chaves de assinatura.
- `src/lib/bpm/financeiro-lembretes.ts`
  - `processarLembretesAssinaturaFinanceiro`, `ASSINATURA_CONTRATO`.
- `src/lib/bpm/financeiro-metas.ts`
  - `buscarAnexosAssinadosFinanceiroPorContrato`.
- `src/lib/bpm/validacao-salvamento-configurado.ts`
  - `alpha.financeiro.status.contrato.assinatura` e `"Assinado"`.
- `src/actions/bpm/ConsultaCnpjFinanceiro.ts`
  - Pipeline financeiro e etapa `solicitacao_contrato`.
- `src/actions/bpm/Anexos.ts`
  - `alpha.contrato.assinado.anexo`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
  - `chave === "financeiro"`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
  - Estado `"Concluído"`/pendente de contrato.

## Testes relevantes
- `tests/bpm/financeiro-formalizacao.test.ts`
- `tests/bpm/automacoes-central.test.ts`
- `tests/bpm/anexo-handoff-access.test.ts`
- `tests/bpm/financeiro-operacional-handoff.test.ts`
- `tests/bpm/requisitos-etapa-server.test.ts`

## Riscos
- Scripts de configuração existentes já publicam automações/requisitos com backup, snapshot, validação de versão e autorização específica.
- Criar seed independente pode duplicar lógica e divergir do estado atual do banco.
- Alterar runtime sem ler configuração pode quebrar validações, automações e handoff.
- Valores históricos em `bpmCardCampoValor` e `bpmCardAnexo` podem exigir migração cuidadosa.

## Decisão
- Não aplicar nenhuma publicação com `--apply` sem autorização explícita e backup válido.
- Criar `src/lib/bpm/financeiro-config.ts` como camada de leitura/validação central.
- Criar `scripts/seed-financeiro-config.mts` como seed idempotente em modo `PLAN` por padrão.
- O seed deve reutilizar as mesmas chaves e entidades dos scripts existentes, evitando duplicação.
- Refatorar runtime para consumir configuração antes de remover strings literais.
- Adotar `src/lib/bpm/financeiro-config.client.ts` como fonte canônica para constantes compartilhadas entre client e server.
- Manter `src/lib/bpm/financeiro-config.ts` apenas para leitura/validação com `Prisma`, reexportando o client module.

## Estado atual
- `src/lib/bpm/financeiro-config.client.ts` centraliza:
  - `PIPELINE_CHAVE`, `PIPELINE_NOME`;
  - `ETAPAS` como objeto `as const`;
  - `CHAVES_CAMPOS`, incluindo aliases de valor/vendedor/parceiro/origem/observações;
  - `VALORES` `Assinado`, `Sim`, `Não`, `Pendente`, `Concluído`;
  - chaves de automação/histórico;
  - requisitos de contrato e pagamento;
  - `avaliarRequisitosFinanceiro`.
- `src/lib/bpm/financeiro-config.ts`:
  - importa apenas `PIPELINE_CHAVE`, `ETAPAS`, `VALORES`, `CHAVE_AUTOMACAO_HANDOFF`, `ACAO_HISTORICO_CONTRATO`, `ACAO_HISTORICO_EXCECAO` e `resolverChavesCampos` do client;
  - reexporta `CHAVES_CAMPOS`, `resolverEtapas` e demais símbolos canônicos para consumidores server existentes;
  - mantém `carregarConfigFinanceiro` e `validarPipelineFinanceiro` com `Prisma`;
  - corrige nullability com `pipeline.chave ?? PIPELINE_CHAVE`, `etapa.chave ?? ""` e `campo.chave ?? ""`.
- Consumers atualizados:
  - client: `CampoBpmInput.tsx`, `PainelCamposEtapaAtual.tsx`, `PainelRegistrar.tsx`;
  - server: `Cards.ts`, `ConsultaCnpjFinanceiro.ts`, `ExcecaoOperacional.ts`, `resumo-contratacao-server.ts`, `financeiro-formalizacao.ts`, `financeiro-assinatura-server.ts`, `financeiro-lembretes.ts`.
- Scripts:
  - `scripts/seed-financeiro-config.mts` continua como wrapper/orquestrador;
  - etapas já orquestradas: `financeiro-elaboracao-config.mts`, `financeiro-pagamento-config.mts`, `bpm-handoff-config.mts`;
  - candidatos a inclusão: `financeiro-formalizacao-config.mts`, `financeiro-contrato-radar-config.mts`, `financeiro-conclusao-operacional-config.mts`.

## Validação
- `npm run typecheck && npm run lint && npm test` executado após a limpeza de imports.
- Testes:
  - `Test Files  531 passed (531)`;
  - `Tests  3937 passed | 4 skipped | 1 todo (3942)`.
- Coverage:
  - Statements `58.44%`;
  - Branches `49.74%`;
  - Functions `66.14%`;
  - Lines `61.79%`.
- Saída recente: `/home/ialpha/.local/share/opencode/tool-output/tool_0df9adf3a001U07DBYGS2YRu8N`.
- Grep por `financeiro-config\.ts` na saída recente não encontrou warnings no arquivo; os 2 warnings anteriores do módulo server não aparecem mais.
- Nenhuma escrita em banco, seed `--apply`, backup ou automação foi executada.
- `npm run typecheck && npm run lint && npm test` executado novamente após as edições em `FormularioEtapaWorkspace.tsx` e nesta memória.
- Saída recente: `/home/ialpha/.local/share/opencode/tool-output/tool_0dfc9a218001yzrtBKo7tcNDEb`.
- Resultado: typecheck, lint e testes passaram; testes `531` arquivos e `3937` testes passaram, com `4 skipped` e `1 todo`.
- Coverage final:
  - Statements `58.44%`;
  - Branches `49.74%`;
  - Functions `66.14%`;
  - Lines `61.79%`.

## Pendências
- Validar se o wrapper de seed deve incluir `scripts/financeiro-formalizacao-config.mts`, `scripts/financeiro-contrato-radar-config.mts` e `scripts/financeiro-conclusao-operacional-config.mts` dentro do escopo central do pipeline financeiro.
- Auditoria de labels/valores de UI em AlphaCRM concluída para os casos inequívocos:
  - `PainelResumoContratacao.tsx`: substituído `Pendente` por `VALORES.PENDENTE`;
  - `PainelResumoEtapas.tsx`: labels de retorno usam `VALORES.SIM`/`VALORES.NAO`; comparações com `"true"`/`"false"` permanecem como valores de opção/UI e não como domínio canônico;
  - `PainelChecklistFollowUp.tsx`: labels de booleano usam `VALORES.SIM`/`VALORES.NAO`; `option value` permanece `true`/`false`;
  - `PainelTarefasPorTipo.tsx`: `Pendente` substituído por `VALORES.PENDENTE`; `Concluída` mantida como UI copy específica de tarefa;
  - `DashboardClient.tsx`: `Pendente` substituído por `VALORES.PENDENTE`;
  - `DadosEmpresaConteudo.tsx`: `Sim`/`Não` substituídos por `VALORES.SIM`/`VALORES.NAO`; `Não informado` mantido como UI copy;
  - `PainelNotaFiscalConcluida.tsx`: `Sim`/`Não` substituídos por `VALORES.SIM`/`VALORES.NAO`; `type Nota` ainda contém literais `"Sim" | "Não" | ""` como contrato local e pode ser refatorado com segurança futura;
  - `FormularioEtapaWorkspace.tsx`: label `Sim ou não`, fallback de condição e placeholder `Sim` substituídos por `VALORES.SIM`/`VALORES.NAO`; placeholder JSON avançado mantém `"Sim"` como exemplo de string.
- Decisão registrada: manter `"true"`/`"false"` em `option value`, comparações de UI e placeholder JSON avançado quando representam valor de controle/interface e não valor de domínio.
- Decisão registrada: manter `Não informado`, `Concluída` e `Não configurada` como copy local de UI quando não existem constantes equivalentes em `VALORES`.
- Inspecionar `src/lib/bpm/automacoes/central-schemas.ts` e `src/lib/bpm/regras/schemas.ts` se houver necessidade de alinhar tipos de automação/regras.
