# RM-2026-9E89F2 — Correção funcional da configuração de pipeline

## Status

Concluída — em testes

## Contexto e problema

A página atual de configuração de pipeline do Alpha CRM pode confirmar uma edição antes da resposta do servidor, exibir campos e SLA a partir de colunas legadas que não são a autoridade do runtime e registrar a auditoria de etapas/transições fora da transação da mutação. Isso permite divergência entre interface, banco, auditoria e execução.

O anexo foi lido integralmente. O documento obrigatório nele citado, `2026-09-05-painel-alpha-crm-configuracao-pipeline-revisao-radar-codex.md`, não existe no repositório nem nos demais projetos locais; seu diagnóstico detalhado foi preservado no próprio anexo e cada fato foi revalidado diretamente no código e no Turso ativo.

## Caminho de consumo

Administrador autenticado → Alpha CRM → Configurações → Pipelines → selecionar pipeline → `/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]` → editar etapas, transições, campos, acessos e SLA → salvar → recarregar → runtime consumir a mesma configuração.

## Escopo

1. Tornar mutação e auditoria atômicas em etapas, substatus, transições e demais configurações tocadas.
2. Impedir submissões concorrentes, só confirmar estado após sucesso e restaurar o último estado confirmado em falha.
3. Usar `BpmCampoEtapaConfig` como fonte da distribuição moderna de campos por etapa; `BpmCampo.etapaId` permanece apenas como legado de leitura.
4. Identificar corretamente proprietário, pipelines associados e etapas aplicáveis dos campos compartilhados.
5. Retornar o agregado completo de campo após create/update e salvar mapeamento junto da edição.
6. Remover da interface os seletores/toggles legados conflitantes de etapa e obrigatoriedade base.
7. Usar `BpmSlaConfig` como único editor operacional de SLA, com prioridade, precedência e combinações disparáveis.
8. Representar transições como `PERMITIDA`, `BLOQUEADA` ou `NÃO CONFIGURADA`; ausência nunca equivale a permissão.
9. Criar políticas explícitas bloqueadas entre uma etapa nova e as etapas existentes.
10. Validar que seleção customizada ativa possui opções e que seleção canônica somente leitura usa sua fonte real.
11. Investigar duplicidade de faturamento sem apagar dados.

## Fora de escopo

- Redesign, nova paleta, reorganização da navegação ou mudança visual relevante.
- Alteração de schema, migration, seed, backfill ou mutação em massa.
- Remoção das colunas legadas `BpmCampo.etapaId`, `BpmCampo.obrigatorio` e `BpmEtapa.slaDias`.
- Inventar catálogos de opções ausentes.
- Commit, push, PR, deploy ou promoção para produção.

## Auditoria do banco antes da implementação

- Turso remoto ativo e schema Prisma comparados em modo somente leitura.
- As 10 estruturas exigidas pelo runtime existem, incluindo `BpmCampoEtapaConfig`, `BpmSlaConfig`, `BpmTransicaoEtapa`, ontologia e auditoria.
- Não existe tabela `_prisma_migrations`; a compatibilidade foi conferida pela presença de tabelas/colunas/índices esperados.
- Distribuição atual por `BpmCampoEtapaConfig` no pipeline Revisão de Radar: 6, 0, 18, 0, 2, 1, 0, 0, 0, na ordem das etapas. Os números não serão codificados.
- A aparente duplicidade de faturamento já está reconciliada: o campo canônico possui um valor e está ativo; o registro legado não possui valores e já está inativo. Ambos são preservados.
- `Regime tributário` é seleção canônica somente leitura ligada a `CLIENTE.regimeTributario`; não precisa de catálogo local. `Radar atual` e `Status da sede` são seleções customizadas sem catálogo nem valores e devem aparecer como configuração inválida até o administrador definir opções ou alterar o tipo — nenhum catálogo será inventado.
- `DATABASE_CHANGE_NOT_REQUIRED`: nenhuma migration ou mudança estrutural é necessária.

## Critérios de aceite

- [x] **AC1:** falha da auditoria reverte a mutação e falha da mutação não produz auditoria.
- [x] **AC2:** toda mutation da página possui estado de salvamento, bloqueio de concorrência, resultado tratado e rollback/recarga do estado confirmado.
- [x] **AC3:** agrupamento por etapa deriva de `BpmCampoEtapaConfig`, suporta o mesmo campo em várias etapas e não usa `BpmCampo.etapaId` como autoridade moderna.
- [x] **AC4:** campo associado mostra pipeline proprietário, compartilhamento e configuração válida sem falso “Etapa inativa ou indisponível”.
- [x] **AC5:** create/update de campo retornam opções, configurações por etapa, acessos, pipelines e mapeamento; segundo save sem reload preserva relações.
- [x] **AC6:** a UI não apresenta dois seletores de etapa nem “Obrigatório” base; obrigatoriedade é contextual por etapa/entrada/saída e acesso é separado.
- [x] **AC7:** `BpmSlaConfig` é o único editor de SLA; prioridade e precedência determinística são visíveis, e combinações não disparáveis são rejeitadas.
- [x] **AC8:** transição ausente aparece como “Não configurada”, nunca marcada como permitida; etapa nova recebe arestas explícitas bloqueadas.
- [x] **AC9:** seleção canônica é exibida pela fonte somente leitura; seleção customizada sem opção é rejeitada pelo servidor e sinalizada na UI.
- [x] **AC10:** schema ativo contém as estruturas usadas e nenhuma migration/schema change é criada nesta RM.
- [x] **AC11:** reload da rota reflete exatamente o agregado confirmado pelo servidor e o contrato consumido pelo runtime.
- [x] **AC12:** nenhuma regressão relevante é introduzida nas demais seções existentes.

## Plano técnico

- `src/actions/bpm/Etapas.ts`, `SubStatus.ts`, `Transicoes.ts`: cliente transacional explícito para auditoria e políticas de transição na criação.
- `src/actions/bpm/Campos.ts` e validações: agregado autoritativo, edição+mapeamento atômicos e rejeição de semântica legada contraditória.
- `src/lib/bpm/campos-admin.ts`: projeção de agrupamento por configurações de etapa.
- `AdminPipelineClient.tsx` e `EtapaAvancadaSection.tsx`: estados confirmados, saving, rollback e semânticas explícitas.
- `Sla.ts`, `bpm-sla.ts`, `SlaConfigForm.tsx` e `SlaConfigSection.tsx`: prioridade, validações e ordenação iguais ao runtime.
- Testes focados de actions, helper, UI, SLA e transições; depois lint, typecheck, suíte e build.

## Fases

- [x] Fase 0 — anexo, contexto e entregabilidade auditados.
- [x] Fase 1 — página, actions, runtime, migrations e banco mapeados.
- [x] Fase 2 — story criada antes da implementação.
- [x] Fase 3 — contratos server-side e persistência.
- [x] Fase 4 — página atual corrigida sem redesign.
- [x] Fase 5 — gate técnico.
- [x] Fase 6 — integração ponta a ponta.
- [x] Fase 7 — segurança.
- [x] Fase 8 — arquitetura e qualidade.
- [x] Fase 9 — regressões e bordas.
- [x] Fase 10 — memória e documentação.
- [x] Fase 11 — arquivamento e relatório.

## Evidências de conclusão

- 56 testes focados aprovados em seis arquivos.
- Build de produção aprovado, com 78 páginas geradas.
- ESLint escopado e `git diff --check` aprovados.
- Typecheck global sem diagnóstico nos arquivos centrais desta entrega; os débitos remanescentes pertencem a módulos concorrentes/externos. Um contrato compartilhado em `Cards.ts` foi mantido compatível sem reintroduzir a tabela legada como autoridade do runtime.
- A suíte BPM/global foi executada; as falhas remanescentes são de módulos em alteração concorrente e estão discriminadas no relatório final.
- Auditoria Turso somente leitura confirmou schema compatível, zero transições ativas sem definição e ausência de necessidade de migration.
- Os 18 campos ativos sem `BpmCampoEtapaConfig` permanecem visivelmente sem configuração e fora do runtime até correção administrativa explícita; nenhum backfill ou catálogo foi inventado.

## File List

- [x] `docs/stories/story-rm-2026-9e89f2-correcao-configuracao-pipeline.md`
- [x] `src/actions/bpm/{Campos,Etapas,PipelineFinanceiro,Pipelines,Sla,SubStatus,Transicoes}.ts`
- [x] `src/lib/bpm/{campos-admin,pipeline-financeiro,requisitos-etapa-server,transicao-command}.ts`
- [x] `src/lib/validations/{bpm,bpm-sla}.ts`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{AdminPipelineClient,ConfigurarEtapasFinanceiroButton,EtapaAvancadaSection,SlaConfigForm,SlaConfigSection,VisibilidadeEtapasSection,page}.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/{CampoBpmInput,pipeline/[pipelineId]/page}.tsx`
- [x] `tests/bpm/{campos-agrupados-por-coluna,campos-configuraveis-actions,configuracao-pipeline-confiavel,pipelines-etapas-admin,requisitos-etapa-server,sla-admin-ui}.test.ts`
- [x] `.bibble/memory/{architecture,components,decisions,integration-points,journal}.md`
- [x] `prompt-phases/roadmap-alpha/rm-2026-9e89f2/r0001/99-relatorio-conclusao.md`
