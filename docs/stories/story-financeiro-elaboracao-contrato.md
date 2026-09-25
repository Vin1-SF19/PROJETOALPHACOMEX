# Story — Financeiro: Elaboração do Contrato

## Status

Ready for Review — código da integração RADAR publicado e configuração da Solicitação/Elaboração ativada no Turso; falta teste visual autenticado com card real.


## Story

**Como** integrante do Financeiro, **quero** conferir os dados recebidos de Solicitação de Contrato, registrar a elaboração e o envio para assinatura, **para** acompanhar a assinatura de um contrato que reflita a contratação validada.

**Escopo:** segunda etapa do pipeline Financeiro, `Elaboração do Contrato`, entre `Solicitação de Contrato` e `Formalização`. Esta story não redefine a primeira etapa nem exige a assinatura concluída para sair da segunda: o envio deve iniciar a espera pela assinatura.

## Campos da etapa

| Campo | Comportamento solicitado |
| --- | --- |
| Contrato elaborado | Sim/Não |
| Data de elaboração | Preenchida automaticamente quando `Contrato elaborado = Sim` se estiver vazia; obrigatória nessa condição |
| Contrato enviado para assinatura | Sim/Não |
| Data do envio | Data/hora registrada automaticamente no evento de envio; obrigatória quando enviado |
| Link/arquivo do contrato | Obrigatório quando enviado; aceitar referência ou arquivo pelo fluxo autenticado já existente no card |

## Critérios de aceite

1. [ ] O formulário publicado em `Elaboração do Contrato` mostra os cinco campos acima e permite registrar os indicadores Sim/Não e o contrato. Os valores existentes de cards antigos continuam legíveis; configuração e validação usam a mesma identidade de campo ativo, independentemente do rótulo exibido.
2. [ ] Para marcar `Contrato elaborado = Sim`, o sistema confirma que os dados cadastrais exigidos na etapa anterior estão completos e válidos e que Serviço contratado, Valor bruto do contrato, Forma de pagamento e Condição negociada estão definidos. Caso haja pendência, a marcação é rejeitada com os nomes dos campos; o contrato usa os valores validados na etapa anterior, inclusive o valor efetivamente negociado.
3. [ ] Quando `Contrato elaborado = Sim`, `Data de elaboração` é obrigatória. Se estiver vazia no momento em que a marcação é aceita, o sistema registra a data automaticamente. Uma data já informada é preservada; salvar novamente não altera a data registrada.
4. [ ] `Contrato enviado para assinatura = Sim` só é aceito se `Contrato elaborado = Sim` estiver válido. O envio exige `Link/arquivo do contrato` e data do envio; se faltar contrato, a alteração é bloqueada com pendência nominal. Não é possível registrar envio de contrato ainda não elaborado.
5. [ ] Na primeira marcação válida de `Contrato enviado para assinatura = Sim`, o sistema registra automaticamente a data **e hora** do envio, atualiza `Status do contrato/assinatura` para `Aguardando assinatura` e cria acompanhamento da assinatura no mecanismo de tarefas/acompanhamento já disponível. Regravar o card ou repetir a operação não duplica acompanhamento nem muda o instante original do envio.
6. [ ] Mudança posterior em dado cadastral ou em Serviço contratado, Valor bruto do contrato, Forma de pagamento ou Condição negociada gera alerta visível no card para conferir se o contrato elaborado/enviado precisa ser atualizado. O alerta identifica os dados alterados e não substitui silenciosamente o contrato já registrado.
7. [ ] O avanço real para `Formalização` aplica as mesmas regras dos itens 2 a 5 no servidor, sem salto de etapas. Com contrato elaborado, data de elaboração, envio válido, data/hora do envio e link/arquivo presentes, o avanço ocorre; com pendências, permanece na etapa e retorna a lista nominal de campos. Dados preenchidos no formulário ativo não podem ser rejeitados por exigência de chave legada, inativa ou rótulo hardcoded.
8. [ ] Quando existir integração de elaboração/assinatura de contratos aplicável ao card, o fluxo usa o contrato e o estado dessa integração sem duplicar registro ou envio. Se não houver integração configurada, o fluxo manual dos itens 1 a 7 permanece funcional. A escolha de provedor, credenciais e disparo externo dependem de contrato de integração existente e não são presumidos por esta story.
9. [ ] Entrar em `Elaboração do Contrato` não exige que `Contrato elaborado` ou `Contrato enviado para assinatura` já estejam preenchidos. O diálogo de movimento exige somente campos marcados para entrada; os dois indicadores permanecem no formulário do card após a entrada, para preenchimento e validação durante a etapa.
10. [ ] Ao entrar na etapa, somente para serviço RADAR, uma automação configurada cria uma única instância em conferência no Gerador de Documentos a partir do contrato padrão, vinculada à empresa do card e nomeada `CONTRATO DE PRESTAÇÃO DE SERVIÇOS + <Razão Social>`. Dados cadastrais e financeiros vêm dos campos validados em `Solicitação de Contrato`. A contratada é o cadastro ativo `ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA`; a qualificação do modelo não conserva a empresa antiga. O formulário da **primeira etapa** solicita valor inicial, valor final e desconto para RADAR antes do avanço, sem bloquear outros serviços nem pressupor divisão ou desconto. Data de assinatura ainda desconhecida aparece como pendência de conferência no rascunho.
11. [x] Ao clicar no contrato gerado na lista de anexos do card, uma prévia abre em modal, inclusive quando o PDF ainda não foi gerado. PDF, imagem e texto comuns também abrem no modal; arquivos sem prévia oferecem abertura/download. O contrato é lido com a permissão do card, sem exigir acesso separado ao módulo Gerador de Documentos, e a API confere o vínculo entre documento e card.

## Tarefas / checklist de execução

- [x] Inventariar, em somente leitura, a composição publicada da segunda etapa, campos ativos/inativos, chaves e requisitos; identificar precisamente os bloqueios no avanço (AC 1, 7).
- [x] Reconciliar campos configurados com validação, salvamento e transição; manter uma fonte de identidade por campo e compatibilidade de cards existentes (AC 1, 7).
- [x] Preparar requisitos configuráveis de conferência da contratação e dos dados cadastrais para salvamento e transição real (AC 2, 7).
- [x] Implementar padrões configurados para data de elaboração e instante do envio, preservando valores preexistentes (AC 3, 5).
- [x] Preparar bloqueio configurável do envio sem elaboração/contrato e automação configurável de status e acompanhamento (AC 4, 5).
- [x] Preparar automações configuráveis de alerta para alterações posteriores nos 14 dados relevantes (AC 6).
- [x] Conferir integração existente: ação configurável `GERAR_CONTRATO` no Gerador de Documentos; nenhuma automação ativa vinculada à segunda etapa no Turso. O fluxo manual permanece (AC 8).
- [x] Gerar plano somente leitura: 5 campos publicados, 18 requisitos e 15 automações; registrar backup completo e snapshot seletivo Vault.
- [ ] Verificar o fluxo autenticado com card real, inclusive cards antigos, anexos e erro nominal por campo (AC 1 a 8). Configuração publicada após autorização específica; verificação em leitura confirmou campos e automação ativos.
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão local (lint: 0 erros, avisos preexistentes; testes na worktree seletiva: 511 arquivos/3.828 casos aprovados; build concluído).
- [x] Corrigir o diagnóstico de movimento para aplicar `obrigatorioEntrada` somente na entrada do destino, sem exigir indicadores que devem ser preenchidos durante a elaboração; teste de regressão e quality gates locais aprovados (AC 9).
- [x] Corrigir a transição Solicitação → Elaboração para avaliar requisitos `DURING_STAGE` apenas da origem, representar campos publicados ainda sem resposta como vazios e aceitar serviço nulo na condição `contém Radar`. Avaliação somente leitura dos dois cards reais da etapa 1 retornou `success: true`, sem movê-los (AC 9).
- [x] Validar a correção local: lint sem erros (1.192 avisos preexistentes), typecheck, 519 arquivos/3.867 testes aprovados, build e `git diff --check` aprovados. Smoke autenticado com movimento real permanece pendente.
- [ ] Confirmar no card autenticado que a entrada em Elaboração é liberada e os campos aparecem dentro da segunda etapa (AC 1, 9). O código da correção foi publicado e o deployment ficou pronto; falta o teste visual autenticado.
- [x] Criar rascunho automático no Gerador, com dados da contratação, contratada correta, título solicitado e idempotência por card/template (AC 10).
- [x] Publicar três campos de pagamento no formulário da primeira etapa, visíveis e obrigatórios na saída para RADAR, e automação de entrada exclusiva de RADAR (AC 10). Verificação em leitura confirmou os três campos ativos, formulário v6 e automação ativa.
- [x] Adicionar visualização de contratos e anexos em modal no card, com rota de prévia autenticada pelo acesso ao card e texto de conferência quando não houver PDF (AC 11).
- [x] Plano somente leitura validou formulário da Solicitação v5, template padrão versionado `cmthgdqel00000akvfblyma6y`, contratada ativa e três campos ainda ausentes. O modelo padrão descreve revisão de RADAR; a condição da automação confere `card.servico` contendo Radar. A versão atual do pipeline passou de 11 a 14 por edições concorrentes; o segundo backup e o snapshot seletivo cobrem v14.
- [x] Publicar código `ceb738bf` após gates e confirmar deployment Production Vercel `6667061093` do mesmo SHA, com resposta HTTP 200.
- [x] Publicar configuração após autorização específica do usuário e reler o Turso: 18 requisitos e 15 automações ativos, formulário versão 3, pipeline versão 10 e tipos `data_hora`/`url_ou_arquivo`.
- [ ] Verificar o fluxo autenticado com cartão real, inclusive card antigo, anexo, acompanhamento e erro nominal por campo (AC 1 a 8).
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão local (lint: 0 erros, avisos preexistentes; testes: 512 arquivos/3.840 casos aprovados; build concluído).

## Contexto e pontos de integração

- **Etapa anterior:** `docs/stories/story-financeiro-novo-contrato.md`, critérios 2 a 5 e 10, define quais dados são validados e a identidade do valor negociado. A implementação anterior publicou os campos da primeira etapa; seu smoke visual autenticado ainda está pendente no registro da story.
- **Pipeline base:** `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md` define seis etapas sequenciais, bloqueio nominal de pendências e anexos pelo fluxo autenticado do card.
- **Código atual:** o fluxo hardcoded anterior foi removido no commit `81ba6063`. Salvamento e transição passam a consultar o formulário publicado e `BpmRequisito`; automações consultam versões publicadas no motor central.
- **Pontos existentes:** `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` renderiza campos da etapa; `src/actions/bpm/Campos.ts` persiste respostas; `src/lib/bpm/transicao-command.ts` prepara o avanço; `src/actions/bpm/Cards.ts` executa movimento; `src/lib/bpm/automacoes.ts` e `src/lib/bpm/automacoes/central-runtime.ts` tratam automações. Confirmar interfaces concretas antes de codificar.
- **Compatibilidade histórica:** há um valor `Data do envio` antigo com somente a data (`AAAA-MM-DD`). Ele será mantido sem inventar hora; o formulário informa que é preciso completar o horário ao editar. O plano altera o tipo publicado para `data_hora` somente após autorização.
- **Limite de banco:** cadastro/publicação de campos ou opções em produção, migration, backfill ou mutação em massa requerem relatório Vault, backup completo verificado com até 48 horas em `database-backups/pre-change/`, plano de impacto/rollback e confirmação explícita específica do usuário conforme AGENTS.md. Esta story não autoriza essas operações.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. `[AUTO-DECISION]` Coerência conferida pela story anterior, story base, Constitution e código observado, sem inventar conteúdo ausente.
- **Integração externa:** `[AUTO-DECISION]` Tratar “quando aplicável” como uso de integração já configurada e identificada no inventário; não escolher provedor ou criar contrato externo sem requisito adicional.
- **Diagnóstico real de 25/09:** não há card ativo na segunda etapa. Os três cards de teste da primeira etapa falhavam ao avaliar a entrada porque (1) a transação HTTP no Turso expirava em 5 segundos e (2) `transicao-command.ts` cobrava os dois booleanos obrigatórios da etapa de destino já na entrada. Após ampliar o timeout e respeitar `obrigatorioEntrada`, a avaliação somente leitura dos três cards retornou `success: true`, sem movê-los.
- **Reteste de 25/09 (transição genérica):** dois cards estão na Solicitação e nenhum na Elaboração. O requisito `DURING_STAGE` da Elaboração era avaliado já na entrada; sua condição consultava `Contrato elaborado`, ainda sem valor, e gerava `CAMPO_INEXISTENTE`, convertido em `TRANSITION_FAILED` genérico. Após corrigir o escopo, o card sem serviço revelou outra exceção: `contém Radar` com valor nulo gerava `TIPO_INCOMPATIVEL`. Os dois casos foram corrigidos em código; avaliação somente leitura de ambos os cards retornou sucesso. Movimento real autenticado permanece pendente.
- **Reteste informado pelo usuário:** o diálogo `Antes de mover para Elaboração do Contrato` ainda cobrava os dois indicadores da segunda etapa na entrada, embora o comando de transição já respeitasse `obrigatorioEntrada`. O inventário de produção confirmou os dois campos ativos, visíveis, editáveis e publicados no formulário da segunda etapa, com `obrigatorio=true` e `obrigatorioEntrada=false`; todos os requisitos publicados para a etapa estão em `DURING_STAGE`. A causa é a projeção divergente do diálogo, que usava `destino.obrigatorio` como exigência de entrada. Nenhuma alteração no banco é necessária.
- **Plano de publicação:** `scripts/financeiro-elaboracao-config.mts` é somente leitura sem `--apply`. Seleciona a etapa ativa `cmsd9yw74000ddzggndlvgbun`, altera tipos de `Data do envio` para `data_hora` e `Link/arquivo` para `url_ou_arquivo`, configura duas datas automáticas, 18 requisitos e 15 automações. A etapa homônima `elaboracao_contrato_legacy` está inativa e sem cards; não será modificada.
- **Vault:** backup completo `database-backups/pre-change/painelalpha_turso_pre_change_elaboracao_config_2026-09-25T17-42-13-450Z.db` validado por restauração (`integrity_check=ok`, 331 tabelas, 171.275 linhas, FK=0), SHA-256 `ad960a4aff973d18301e88a6f8060583ada72eb08983888205696cd5346a3d5a`. Snapshot seletivo `database-backups/pre-change/elaboracao-config-before-2026-09-25T17-42-33-799Z.json`. O inventário somente leitura deste reteste confirmou os campos e requisitos publicados; a correção atual não altera o banco.
- **Plano de publicação:** `scripts/financeiro-elaboracao-config.mts` é somente leitura sem `--apply`. Seleciona a etapa ativa `cmsd9yw74000ddzggndlvgbun`, altera tipos de `Data do envio` para `data_hora` e `Link/arquivo` para `url_ou_arquivo`, configura duas datas automáticas, 18 requisitos e 15 automações. A etapa homônima `elaboracao_contrato_legacy` está inativa e sem cards; não será modificada.
- **Vault e publicação:** backup completo `database-backups/pre-change/painelalpha_turso_pre_change_elaboracao_config_2026-09-25T17-42-13-450Z.db` validado por restauração (`integrity_check=ok`, 331 tabelas, 171.275 linhas, FK=0), SHA-256 `ad960a4aff973d18301e88a6f8060583ada72eb08983888205696cd5346a3d5a`. Snapshot pré-publicação `database-backups/pre-change/financeiro-elaboracao-config-1790359530426.json`. Usuário autorizou especificamente esta publicação em 25/09/2026; script retornou `APPLIED`. Leitura pós-publicação confirmou 18/18 requisitos ativos, 15/15 automações com versão ativa, formulário versão 3, pipeline versão 10 e tipos esperados. Nenhum cartão foi mutado pelo script.
- **Limite de verificação:** nenhum card real foi movido ou editado nesta implementação. A automação de geração de contrato existe no catálogo, mas não está configurada para a segunda etapa e depende de um template selecionado pelo administrador.
- **Contrato RADAR:** o DOCX padrão contém qualificação antiga de `ALPHA COMEX BRASIL LTDA`. A nova ação substitui essa qualificação na instância, preserva o arquivo fonte, usa o cadastro ativo `ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA`, vincula documento e anexo interno ao card e impede criação repetida quando já houver documento vinculado. As variáveis mapeadas usam IDs de campos na configuração da automação; os dados ausentes são marcados para conferência e impedem finalização até preenchimento. O pedido do usuário colocou valor inicial, valor final e desconto na **primeira** etapa, antes da entrada na Elaboração. O serviço sem RADAR não executa este modelo.
- **Vault RADAR:** backup completo imediatamente anterior à publicação `database-backups/pre-change/painelalpha_turso_pre_change_radar_contrato_pagamento_2026-09-25T20-14-28-265Z.db` (173.723.648 bytes, SHA-256 `269d07a9cdc27348763991ebe4a23e93abf30754399b040a4a03d61e72444e88`) validado por restauração local: integridade OK, FK=0, 331 tabelas, 174.876 linhas. Manifesto `.manifest.json` homônimo e snapshot seletivo v20 `database-backups/pre-change/radar-contrato-pagamento-config-before-v20-2026-09-25T20-15-40-017Z.json` (SHA-256 `62d1002da840de4f2169173bad0de9dda628e2d3c924b2b0011ea06497cf63e6`). Snapshot automático adicional da aplicação: `database-backups/pre-change/financeiro-contrato-radar-before-1790367422660.json`.
- **Publicação RADAR:** usuário autorizou explicitamente os três campos e a automação no Turso. A versão do Financeiro avançou de v14 a v20 antes da escrita por edições de campos compartilhados; Vault confirmou que o plano RADAR permaneceu igual e renovou backup/snapshot. O script aplicou com guarda exata v20 e formulário v5. Leitura posterior confirmou pipeline v21, formulário v6, três campos ativos/obrigatórios na saída somente quando `card.servico` contém Radar e automação `ENTRAR_COLUNA` ativa com template/contratada corretos. Nenhum card foi movido.
- **Concorrência observada:** a configuração do Financeiro avançou de v11 para v20 por edições em campos compartilhados (`Vendedor responsável`, `Regime tributário`, `Contato responsável/representante`). Vault confirmou que as 40 configurações lógicas das etapas Solicitação/Elaboração permaneceram equivalentes, embora alguns IDs de configuração tenham sido recriados. O script exigiu a versão exata v20 e o formulário v5 antes da escrita.
- **Gates locais da nova integração:** `npm run lint` (0 erros, 1.192 avisos preexistentes), `npm run typecheck` (exit 0), `npm test` (515 arquivos, 3.837 casos aprovados; 4 skipped e 1 todo), `npm run build` (exit 0), `git diff --check` (exit 0). Após ajuste de autorização, os testes focados de ownership, download e reescrita passaram (28 casos).

## Testes de aceite

1. Dados cadastrais ou de contratação faltando/inválidos impedem marcar elaboração e listam cada campo; conjunto completo permite marcar e grava a data uma vez.
2. Marcar envio antes da elaboração falha; elaboração sem link/arquivo falha; elaboração com contrato registra instante de envio, estado `Aguardando assinatura` e um acompanhamento.
3. Repetir salvamento/envio não altera datas nem duplica acompanhamento. Arquivo válido pelo fluxo autenticado satisfaz a condição de contrato.
4. Alterar serviço, valor, forma de pagamento, condição negociada ou dado cadastral após elaboração exibe alerta de revisão e preserva o contrato registrado.
5. Card com todos os valores no formulário publicado avança para `Formalização`; remover um obrigatório bloqueia com nome do campo. O mesmo cenário com campo legado inativo não exige preenchê-lo.
6. Card histórico com valores existentes permanece legível. Na ausência de integração externa configurada, elaboração/envio manual continuam operáveis.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integração; secundários API, Frontend e dados configurados; complexidade alta por validação de transição, automação e histórico.
- **Specialized Agents:** @dev implementa; @architect revisa identidade e evento de envio; @qa valida transição e idempotência; @ux-expert revisa alerta e formulário; Vault atua antes de mutação protegida; @github-devops conduz PR e deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão de campos ativos/legados. Pre-PR (@github-devops): conferir regressão de cards históricos e automações. Pre-Deployment (@github-devops): conferir configuração, evidência Vault e rollback quando houver mutação protegida.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** bloqueio por chaves/rótulos hardcoded, consistência dos dados herdados, data/hora do envio, anexos autenticados, duplicação de acompanhamento, alerta após alteração e acesso ao formulário.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-elaboracao-contrato.md` — critérios, diagnóstico, checklist e registro.
- `scripts/financeiro-elaboracao-config.mts` — plano de leitura e publicação protegida da configuração.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — padrões temporais e requisitos publicados no salvamento.
- `src/lib/bpm/transicao-command.ts` — requisito `REGRA` e referência autenticada de arquivo na transição.
- `src/lib/bpm/requisitos-etapa.ts` — escopo de requisitos durante a transição.
- `src/lib/bpm/regras/avaliador.ts` — comparação `contém` com valor nulo.
- `src/actions/bpm/Cards.ts` — requisito no salvamento, eventos de alteração e arquivo vinculado.
- `src/lib/bpm/requisitos-etapa.ts` — obrigatoriedade contextual de origem/entrada no diagnóstico da transição.
- `src/actions/bpm/Anexos.ts` — upload em campo de link ou arquivo.
- `src/lib/bpm/campos-dinamicos.ts` — validação de data/hora e URL ou arquivo.
- `src/lib/bpm/regras/avaliador.ts` — comparação segura de campo vazio em condição.
- `src/lib/bpm/automacoes/central-schemas.ts` — opção de alterar status somente se vazio.
- `src/lib/bpm/automacoes/central-runtime.ts` — execução idempotente dessa opção.
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx` — opção configurável no editor.
- `src/lib/validations/bpm.ts` — tipo configurável `url_ou_arquivo`.
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` — entrada de data/hora e link/arquivo, aviso para data histórica.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — arquivo atual do novo tipo.
- `tests/bpm/validacao-salvamento-configurado.test.ts` — padrões e requisitos no salvamento.
- `tests/bpm/requisitos-transicao-obrigatoriedade.test.ts` — regressão da entrada em Elaboração sem indicadores futuros já preenchidos.
- `tests/bpm/regras-engine.test.ts` — regressão da condição `contém Radar` com serviço nulo.
- `tests/bpm/edicao-campos-card.test.ts` — mocks da persistência parcial diante do novo validador.
- `tests/bpm/cpf-pendencias-react.test.ts` — persistência UTC de campo `data_hora`.
- `src/lib/bpm/automacoes/schemas.ts` — opções configuráveis da ação de contrato.
- `src/actions/bpm/Automacoes.ts` — catálogo de contratadas e variáveis atuais do contrato padrão na configuração.
- `src/components/bpm/automacoes/types.ts` — tipo do catálogo de contratadas.
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx` — seleção da contratada e opção de rascunho com pendências.
- `src/lib/bpm/automacoes/executor.ts` — uso do DOCX padrão, contratada cadastrada, mapeamento de campos do card e criação idempotente em conferência.
- `src/lib/gerador-documentos/contrato-padrao.ts` — qualificação da contratada selecionada na instância.
- `src/lib/gerador-documentos/contrato-conferencia.ts` — preenchimento explícito de pendências e preservação de cláusulas editadas.
- `src/actions/gerador-documentos.ts` — conferência e complemento das variáveis pendentes antes da finalização.
- `src/lib/gerador-documentos/ownership.ts` — acesso ao documento vinculado condicionado ao acesso ao card e ao módulo.
- `src/components/GeradorDocumentos/ConferenciaClient.tsx` — formulário de conferência das variáveis do contrato automático.
- `src/app/api/bpm/anexos/[anexoId]/route.ts` — redirecionamento autenticado do anexo interno de contrato para a conferência.
- `src/app/api/bpm/anexos/[anexoId]/preview/route.ts` — prévia autenticada do contrato vinculado ao card e PDF inline quando disponível.
- `src/components/bpm/anexos/VisualizadorAnexoCard.tsx` — modal de contrato, PDF, imagem e texto, com fallback para outros arquivos.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` — abertura do modal na lista de anexos e nos campos de arquivo do card.
- `tests/bpm/anexo-preview-route.test.ts`, `tests/bpm/arquivo-persistencia-react.test.ts`, `tests/bpm/authorization-actions.test.ts` — autorização da prévia, vínculo e abertura pelo campo.
- `src/app/PainelAlpha/GeradorDocumentos/[templateId]/download/route.ts` e `src/app/api/gerador-documentos/[id]/download/route.ts` — leitura do PDF sob a mesma autorização de documento vinculado.
- `scripts/financeiro-contrato-radar-config.mts` — plano e aplicação protegida dos três campos na Solicitação e da automação RADAR.
- `tests/gerador-documentos/contrato-padrao-contratada.test.ts` — qualificação da empresa e preservação do modelo fonte.
- `tests/gerador-documentos/contrato-conferencia.test.ts` — complemento de variáveis sem sobrescrever edições manuais.
- `tests/gerador-documentos/ownership.test.ts` — acesso restrito por vínculo ao card, com permissões de edição.
- `tests/bpm/edicao-campos-card.test.ts` — mocks da persistência parcial diante do novo validador.
- `tests/bpm/cpf-pendencias-react.test.ts` — persistência UTC de campo `data_hora`.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft da segunda etapa, critérios e validação preliminar | River (@sm) |
| 2026-09-25 | 0.2 | Correções locais, diagnóstico da transição real em leitura e quality gates | Codex |
| 2026-09-25 | 0.3 | Remoção das rotas hardcoded anterior, implementação configurável e plano Vault de publicação | Codex |
| 2026-09-25 | 0.4 | Correção da exigência prematura dos indicadores no diálogo de entrada; 513 arquivos e 3.834 testes, lint, typecheck e build aprovados | Codex |
| 2026-09-25 | 0.5 | Integração local da geração automática do contrato RADAR, plano de configuração da primeira etapa e backup Vault validado; publicação pendente de checkpoint específico | Codex |
| 2026-09-25 | 0.6 | Backup Vault renovado na configuração v14, conferência dos gates e plano de publicação RADAR atualizado | Codex |
| 2026-09-25 | 0.7 | Código publicado, backup/snapshot Vault v20 validado e configuração RADAR ativada com verificação em leitura | Codex |
| 2026-09-25 | 0.4 | Código publicado em produção, configuração aplicada no Turso e leitura posterior conferida; smoke autenticado pendente | Codex |
| 2026-09-25 | 0.8 | Prévia autenticada de contrato e anexos em modal no card | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PARTIAL** (fluxo de acompanhamento, integração aplicável e representação de data/hora precisam de inventário antes da implementação); referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para investigação e implementação local.** Publicação/mutação de configuração protegida depende do checkpoint Vault.
