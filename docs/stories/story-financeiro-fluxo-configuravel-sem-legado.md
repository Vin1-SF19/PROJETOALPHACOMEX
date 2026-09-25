# Story — Financeiro: fluxo configurável sem legado

## Status

In Progress — retirada do bloqueio financeiro fixo implementada localmente e quatro registros `alpha.legacy.*` removidos do Turso após autorização e checkpoint Vault. Configuração campo a campo, regressões das etapas posteriores e publicação do código pendentes.

## Story

**Como** administrador e integrante do Financeiro, **quero** que os formulários, campos obrigatórios, condições de avanço, transições e automações do pipeline Financeiro sejam governados pela configuração publicada, **para** testar o ciclo sem bloqueios herdados do código e depois ajustar cada campo nas configurações.

**Escopo:** seis etapas existentes (`Solicitação de Contrato`, `Elaboração do Contrato`, `Formalização`, `Confirmação de Pagamento`, `Emissão da Nota Fiscal`, `Contratação Finalizada`). Não recriar pipeline ou cards. Remover o caminho de movimento legado e as regras financeiras fixas que ainda participam do movimento atual. Manter os valores e o histórico legíveis. Esta story prepara o fluxo para a configuração campo a campo; não decide novas obrigatoriedades de Formalização, Pagamento ou NF além das já documentadas.

## Critérios de aceite

1. [ ] O mesmo identificador estável de campo, cadastrado e publicado, é usado para exibição, salvamento, obrigatoriedade, validação, cálculo e mensagem de pendência. Renomear o rótulo não altera a regra; campo inativo, não publicado ou duplicado não bloqueia silenciosamente o avanço. Valores históricos continuam legíveis.
2. [ ] Campos exibidos, tipos, opções, ordem e obrigatoriedade estática/condicional/de entrada/de saída vêm da configuração da etapa. O formulário e o servidor interpretam a mesma versão publicada. Toda pendência aponta o campo visível e a regra configurada que a originou. O editor permite configurar e publicar essas propriedades, e a mudança publicada afeta o próximo salvamento/movimento sem alteração de código.
3. [ ] As transições permitidas vêm das arestas configuradas no pipeline. O movimento impede aresta não permitida e salto conforme a política publicada, sem impor uma lista fixa de seis nomes/chaves de etapa no validador financeiro. A saída da etapa final e eventual reabertura seguem a configuração aprovada; divergências atuais são apresentadas no diagnóstico/configuração antes de mudar dados.
4. [ ] Requisitos e condições de avanço vêm do mecanismo configurável de campos/requisitos/regras, inclusive dependências já solicitadas para `Contrato elaborado` e `Contrato enviado para assinatura`. Editar uma condição publicada modifica o resultado da validação no servidor. Nenhum bloco de requisitos por etapa em `validateCanonicalFinancialTransition` ou validação por rótulo permanece como segunda fonte oculta de bloqueio.
5. [ ] Os hooks financeiros de salvamento também consultam a configuração publicada; não criam datas, status, tarefas, alertas ou valores por nome/chave fixa fora de uma regra ou automação configurada. A marcação válida de envio para assinatura continua registrando o instante original, colocando `Aguardando assinatura`, criando acompanhamento uma vez e alertando alterações posteriores relevantes, conforme a story de Elaboração, quando as respectivas regras/automações estiverem publicadas. Integração com Gerador de Documentos só é executada quando uma automação/template aplicável estiver configurado; o registro manual continua disponível.
6. [ ] O cálculo de retenções permanece no servidor, com memória auditável e fórmulas da story `Novo contrato`, mas sua ativação e entradas/saídas referenciam campos configurados por identidade estável. Indicador `Sim` com alíquota ausente gera pendência nominal; ausência não é tratada como zero. Valor usado no contrato/cálculo corresponde ao snapshot negociado do card; compatibilidade para card histórico sem snapshot é explícita e testada, sem substituição silenciosa por dado global mutável.
7. [ ] Datas de elaboração, envio, assinatura e pagamento representam seus eventos reais, são preservadas em regravações e não são inventadas por um movimento genérico. Link/arquivo do contrato e da NF são validados pela referência do campo/documento configurado e pelo fluxo autenticado de anexos, não apenas por trecho do nome do arquivo. O formulário informa qual referência falta.
8. [ ] O caminho `executarMovimentoLegadoDesativado`, o validador por rótulos e o preset `ConfigurarPipelineFinanceiro` deixam de ser caminhos invocáveis de movimento/reconfiguração em produção; chamadas residuais e testes ligados ao legado são removidos ou migrados. O comando canônico permanece único e as proteções de campo calculado/somente leitura usam identidade estável, não nome exibido.
9. [ ] Sem requisito configurado para uma condição, o sistema não cria obrigatoriedade oculta. Publicação incompleta ou inválida recebe diagnóstico administrativo claro; o movimento é decidido somente pelas regras publicadas e invariantes genéricas do BPM (autorização, integridade e consistência da transação), nunca por fallback financeiro fixo. Dados existentes não são apagados para alcançar esse estado.
10. [ ] Testes cobrem salvamento e tentativa de movimento em cada uma das seis etapas, cenários completos/incompletos, mudança de configuração publicada, rótulo alterado, campo inativo/duplicado, automação idempotente, cálculo, datas e anexos. Uma simulação somente leitura demonstra o resultado com a configuração atual; nenhum dos três cards ativos é movido durante essa verificação. Gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; checklist e File List são atualizados.

## Tarefas / checklist de execução

- [x] Congelar inventário somente leitura `etapa → aresta → campo/chave → componente publicado → requisito/regra/automação → valor histórico`, com atenção aos conceitos duplicados de Formalização e Pagamento (AC 1–4, 9).
- [x] Definir e revisar com @architect o contrato de identidade estável e a interpretação única da configuração publicada no salvamento e movimento, reutilizando `BpmCampoEtapaConfig`, `BpmRequisito`, regras e automações existentes (AC 1–4, 9).
- [x] Substituir a chamada ao validador financeiro fixo por validação orientada pela configuração; eliminar `executarMovimentoLegadoDesativado`, `validateFinancialTransition` e o preset de reconfiguração por nomes após checar referências (AC 3, 4, 8).
- [ ] Ajustar editor, publicação, formulário, proteção de calculados e mensagens para que configuração e runtime usem a mesma identidade e versão (AC 1, 2, 8, 9). Editor condicional e guarda de calculados ajustados; falta regressão completa e diagnóstico de configuração inválida.
- [ ] Conectar eventos/automação da Elaboração, cálculo, datas e documentos às configurações sem perder garantias das stories anteriores; reparar ausência de alíquota e fallback mutável (AC 5–7).
- [ ] Construir/verificar configuração desejada em artefato revisável e simulação somente leitura. Simulação da primeira aresta feita para três cartões antes e depois da limpeza; configuração campo a campo e as demais arestas pendentes. Os quatro campos inativos `alpha.legacy.*` foram excluídos após autorização específica e checkpoint Vault.
- [ ] Executar regressões das seis etapas e gates completos; registrar evidências, pendências reais de configuração, checklist e File List (AC 10).

## Notas para implementação

- **Caminho atual:** `SalvarRequisitosEMoverCardBpm`/`MoverCardBpm` → `executarMovimentoCanonico` em `src/actions/bpm/Cards.ts` → `executarTransicaoBpm` em `src/lib/bpm/transicao-command.ts` → `validateCanonicalFinancialTransition` em `src/lib/bpm/pipeline-financeiro.ts`. O último ainda fixa regras por etapa. `src/lib/bpm/novo-contrato-financeiro-server.ts` também aplica efeitos no salvamento. Retirar só `executarMovimentoLegadoDesativado` não altera os bloqueios observados.
- **Configuração atual:** seis etapas; só três cards ativos, todos na primeira. `obrigatorioEntrada`, `obrigatorioSaida` e condições de obrigatoriedade estão vazios em todas as etapas; requisitos antigos observados estão inativos. Assim, ao desligar as guardas fixas, a configuração atual pode permitir avanço com dados que as stories anteriores exigem. Identificar e preparar as regras faltantes antes de qualquer publicação, sem gravar no banco sem Vault.
- **Duplicidades:** Formalização expõe três status de contrato/assinatura e pares distintos de IRRF, CSRF e valor líquido. Pagamento expõe dois conceitos de comprovante. A reconciliação deve preservar valores históricos, escolher identidade por conceito na configuração e impedir edição dupla; não excluir fisicamente por esta story.
- **Divergência de arestas:** a configuração permite retornos da etapa final, enquanto o validador fixo impede qualquer saída. Confirmar a política de reabertura antes de publicar a aresta; não deduzir autorização apenas do dado antigo.
- **Fontes:** `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md` (caminho efetivo e achados 1–9); `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md` (sequência, pendências, cálculo e anexos); `docs/stories/story-financeiro-novo-contrato.md` (campos e cálculo da primeira etapa); `docs/stories/story-financeiro-elaboracao-contrato.md` (evento de elaboração/envio e acompanhamento). A story `story-rm-2026-dbef25-remover-regras-financeiras.md` preservava expressamente o validador canônico naquele escopo; o pedido atual altera esse ponto, sem ressuscitar o módulo Regras Financeiras removido.
- **Contexto ausente:** `accumulated-context.md`, `.aiox/gotchas.json` e o diretório `docs/prd/` não existem nesta worktree. `[AUTO-DECISION]` A coerência foi extraída do diagnóstico, Constitution e stories existentes; nenhum requisito ausente foi presumido.
- **Banco e rollout:** edição de código e testes locais podem ocorrer agora. Alteração de schema, configuração persistida em massa, limpeza ou migração de valores requer Vault, inventário do ambiente e banco, comandos/impacto/risco/alternativa/rollback, backup completo verificado com até 48 horas em `database-backups/pre-change/` e confirmação explícita específica do usuário. Até esse checkpoint, entregar apenas plano e artefatos de configuração revisáveis. Manter registros antigos legíveis; limpeza física é objetivo separado.

## Testes de aceite

1. Com a configuração publicada, remover um obrigatório e tentar avançar: o servidor bloqueia e lista o campo visível; desativar a regra e republicar muda a resposta sem deploy de código.
2. Renomear rótulo ou manter valor histórico de campo inativo não muda a identidade da regra nem cria bloqueio invisível.
3. Testar cada aresta sequencial e uma aresta proibida; o resultado coincide com a configuração publicada e não depende de nome de etapa.
4. Elaboração/envio repetidos preservam datas e acompanhamento único; alteração posterior relevante produz alerta; integração com Gerador só é acionada quando configurada.
5. IRRF/CSRF `Sim` sem alíquota bloqueia; com dados completos, cálculo e memória correspondem às fórmulas existentes e ao valor negociado estável.
6. Anexo de nome parecido, sem referência no campo pertinente, não satisfaz contrato/NF; referência válida satisfaz pelo fluxo autenticado.
7. Simulação somente leitura documenta, para os três cards atuais, pendências resultantes das configurações. Smoke real fica para execução operacional posterior.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal Integração; secundários backend, frontend e configuração de dados; complexidade alta pelo impacto em todas as transições.
- **Specialized Agents:** @dev implementa; @architect revisa o contrato de configuração/identidade; @qa verifica regressões; @ux-expert revisa editor e pendências; Vault atua antes de mutação protegida; @github-devops atua em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão; Pre-PR (@github-devops): compatibilidade histórica e remoção de chamadas legadas; Pre-Deployment (@github-devops): diff de configuração, evidência Vault/rollback quando aplicável.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta. Executar o gate real configurado no repositório.
- **Focus Areas:** única fonte de regras, identidades estáveis, integridade de cards históricos, autorização/transição, condições de avanço, idempotência de automações, cálculo, datas, anexos e rollback de configuração.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-fluxo-configuravel-sem-legado.md` — story, checklist e evidências.
- `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md` — diagnóstico e estado da implementação local.
- `src/actions/bpm/Cards.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/requisitos-etapa-server.ts`, `src/lib/bpm/regras/guarda-movimento.ts` — remoção das guardas fixas e avaliação configurável. `Cards.ts` também continha mudanças paralelas anteriores, preservadas nesta worktree.
- `src/actions/bpm/FormulariosEtapa.ts`, `src/lib/bpm/formularios-etapa.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — edição e publicação de obrigatoriedade condicional.
- `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/automacoes/placeholders.ts`, `src/lib/bpm/automacoes/distribuicao-oportunidades.ts`, `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx` — execução de automações pelo comando canônico e remoção do controle de bypass.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`, `src/lib/bpm/pipeline-financeiro.ts` — interface e integração opcional de CNPJ; o painel de campos continha mudanças paralelas anteriores, preservadas nesta worktree.
- Removidos: `src/actions/bpm/PipelineFinanceiro.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ConfigurarEtapasFinanceiroButton.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CalculoTributario.tsx`, `src/lib/bpm/novo-contrato-financeiro-server.ts`, `tests/bpm/pipeline-financeiro.test.ts`, `tests/bpm/novo-contrato-financeiro-server.test.ts`.
- Testes atualizados: `tests/bpm/alinhamento-estrategico.test.ts`, `tests/bpm/automacoes-central.test.ts`, `tests/bpm/automacoes.test.ts`, `tests/bpm/boas-vindas-acesso.test.ts`, `tests/bpm/canonical-sources-contract.test.ts`, `tests/bpm/configuracao-pipeline-confiavel.test.ts`, `tests/bpm/formularios-etapa-save.test.ts`, `tests/bpm/regras-financeiras-remocao.test.ts`, `tests/bpm/requisitos-etapa-server.test.ts`, `tests/bpm/sla-calculo.test.ts`, `tests/bpm/visibilidade-etapa.test.ts`.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft derivado do pedido de configuração integral e diagnóstico do fluxo | River (@sm) |
| 2026-09-25 | 0.2 | Retirada local das guardas legadas; publicação de condições e simulação da primeira aresta; pendências de configuração e banco registradas | Codex (@dev) |
| 2026-09-25 | 0.3 | Limpeza física autorizada dos quatro campos inativos e quatro configurações; validação após commit registrada no diagnóstico | Codex (@dev) |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS**; referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para implementação local.** A publicação de regras e qualquer saneamento persistido aguardam o checkpoint Vault; a política de reabertura e novas obrigatoriedades das etapas posteriores exigem decisão de produto antes de serem configuradas.
