# Story — Financeiro ativo: Formalização e confirmação da assinatura

## Status

Ready for Review — implementação e ensaio local concluídos; publicação pendente. A Elaboração ativa ainda não foi publicada no Turso, portanto esta configuração depende dela.

## Executor Assignment

`executor: @dev` · `quality_gate: @qa` · `quality_gate_tools: [npm run lint, npm run typecheck, npm test, npm run build, verificação da configuração publicada]`

## Story

**Como** integrante do Financeiro, **quero** confirmar a assinatura e acompanhar o contrato separadamente do pagamento na etapa Formalização, **para** concluir a contratação somente quando os dois requisitos independentes estiverem satisfeitos.

**Escopo:** etapa `Formalização` do pipeline Financeiro **ativo** (`cmuih4i54000209gmmyqrg557`), após `Elaboração de Contrato`. A story `story-financeiro-formalizacao-contrato-assinatura.md` descreve o pipeline anterior; suas regras, versões e evidências de publicação não demonstram que esta etapa ativa está configurada. Inventariar a etapa ativa antes de escolher IDs, chaves, versões ou migrar comportamento. A Elaboração ativa registra `Contrato enviado para assinatura = Sim`, `Data do envio`, documento enviado e status `Aguardando assinatura`; nenhum desses elementos prova que o documento foi assinado.

## Campos e regras

| Campo | Comportamento solicitado |
| --- | --- |
| Status do contrato | Mostrar o estado do requisito Contrato de forma coerente com a assinatura confirmada; `CONTRATO CONCLUÍDO` somente com comprovação válida. |
| Status da assinatura | Select com as opções `Aguardando assinatura` e `Assinado`. |
| Data da assinatura | Obrigatória ao selecionar `Assinado`; registrar data/hora do primeiro evento confirmado, preservando valor válido já informado. |
| Contrato assinado/anexo | Obrigatório ao selecionar `Assinado`; referência a arquivo assinado acessível no fluxo autenticado de anexos do card. |

Todos os quatro campos devem aparecer em **Configurações → Campos e Formulários** com tipo, opções, rótulo, visibilidade, ordem e regras editáveis. O formulário de Formalização precisa usar a configuração publicada. As automações e o prazo do acompanhamento devem ser inspecionáveis e ajustáveis pela UI administrativa correspondente. Editabilidade administrativa de `Status do contrato` não autoriza salvar um estado que contradiga assinatura, data ou anexo.

## Critérios de aceite

1. [ ] O formulário publicado da Formalização ativa apresenta os quatro campos e o administrador consegue editar sua configuração em `Campos e Formulários`. `Status da assinatura` oferece `Aguardando assinatura` e `Assinado`. Não há duas fontes editáveis para o mesmo status; valores históricos permanecem legíveis sem inferir assinatura de status legado ou de documento enviado.
2. [ ] Enquanto a assinatura não estiver comprovada, o requisito `Contrato` permanece `Pendente`, mesmo com documento elaborado/enviado ou pagamento confirmado. `Status do contrato` e a avaliação do requisito mostram um estado coerente; uma tentativa manual de marcar conclusão sem assinatura comprovada é rejeitada no servidor com pendências nominais.
3. [ ] Para aceitar `Status da assinatura = Assinado`, o servidor exige `Data da assinatura` e `Contrato assinado/anexo` válido, pertencente ao card e associado ao campo configurado. Se a data faltar, preencher automaticamente a data/hora na primeira confirmação válida; se o anexo faltar ou for inválido, bloquear a confirmação e não registrar conclusão. O usuário pode ver/acessar o documento assinado conforme as permissões já existentes.
4. [ ] Na primeira assinatura válida, registrar um evento auditável com data/hora, marcar `CONTRATO CONCLUÍDO`, manter o anexo assinado disponível no card e consultar automaticamente o estado de pagamento. Repetir salvamento/evento preserva o primeiro instante e não duplica conclusão. Alteração posterior do documento ou revogação não é presumida; qualquer correção deve respeitar trilha auditável e política existente.
5. [ ] Assinatura e pagamento avançam independentemente: assinatura antes do pagamento e pagamento antes da assinatura são permitidos. A passagem para a etapa de pagamento não exige assinatura, e a assinatura não exige pagamento. A contratação só é concluída quando os requisitos `Contrato` e `Pagamento` estiverem ambos `Concluído`; faltando qualquer um, a pendência é identificada no card e no servidor.
6. [ ] O contrato assinado é disponibilizado no painel de Metas quando houver vínculo explícito `BpmCardServicoContexto.contratoComercialId` com o `ContratoComercial` correto e acesso autorizado. Sem vínculo, indicar `Pendente de associação`; não associar por nome/CNPJ, não anunciar entrega concluída e permitir conciliação após vínculo válido. A integração NAS segue a definição existente: futura/opcional; ausência ou falha do NAS não bloqueia assinatura ou conclusão nem gera indicação falsa de disponibilidade.
7. [ ] Enquanto `Aguardando assinatura`, manter pendência e acompanhamento, com prazo individual configurável por contrato e lembretes conforme esse prazo. O histórico da etapa antiga registra decisão de lembrete diário; validar se essa política continua aplicável ao pipeline ativo antes de publicar. Reprocessamentos não duplicam lembretes do mesmo ciclo; após a assinatura válida, tarefas futuras são canceladas/cessadas. A configuração e a execução ficam visíveis como automações ativas, e falhas de execução são observáveis.
8. [ ] Campos, regras condicionais, requisitos, prazo e automações de Formalização são configuráveis e publicados pelas UIs administrativas existentes; alterações válidas passam a reger o servidor. Não basta exibir controles na UI: salvamento, transição e conclusão aplicam a configuração publicada e retornam a lista nominal de pendências.

## Tarefas / checklist

- [x] Inventariar somente leitura a Formalização do Financeiro ativo, formulário, campos, chaves, opções, requisitos, automações e cards: etapa vazia, sem formulário, campos ou automações, Financeiro v8. Elaboração também segue vazia em produção (AC 1, 8).
- [x] Definir identidade canônica dos quatro campos e reutilizar o status que a Elaboração ativa criará; alterar suas opções para permitir `Assinado` sem duplicar a identidade (AC 1, 2).
- [x] Implementar validação condicional no servidor e no formulário, anexos privados vinculados ao card/campo e data automática na primeira confirmação (AC 2–4).
- [x] Ligar avaliação independente de Contrato e Pagamento: campos de assinatura continuam acessíveis nas etapas Pagamento/Nota Fiscal, e a conclusão exige ambos os requisitos (AC 5).
- [x] Conferir a integração existente de Metas por `contratoComercialId`; anexo só é exposto com vínculo e autorização. NAS segue opcional/futuro (AC 6).
- [x] Publicar no plano três automações ativas, incluindo recorrência diária configurável pela UI e prazo individual do card; a execução central evita duplicação no mesmo dia e para de criar tarefas após `Assinado` (AC 7, 8). Aplicação no Turso pendente.
- [x] Exercitar testes direcionados de data, anexo inválido, estados contraditórios, requisitos independentes, encerramento de tarefas e deduplicação diária; lint e typecheck passaram. Suíte completa: 554 arquivos, 4.068 testes aprovados, 4 skipped e 1 todo (AC 1–8).
- [ ] Antes de alterar configuração ou dados protegidos no Turso: acionar Vault, apresentar plano/impacto/risco/alternativa/rollback, criar e verificar backup completo de até 48 horas em `database-backups/pre-change/`, obter autorização específica e conferir publicação por leitura (AC 8).
- [ ] Atualizar checklist, File List, evidências de testes, publicação e smoke autenticado antes de marcar a story Done.

### Evidências locais (29/09/2026)

- Script `scripts/configurar-formalizacao-financeiro-ativo.mts` prepara v9→v10 após Elaboração: 5 campos novos (os quatro solicitados usam o status de assinatura compartilhado; Prazo da assinatura e Pagamento confirmado sustentam o fluxo paralelo), 3 formulários, 6 requisitos e 3 automações com versões `ATIVA`. A UI administrativa pode editar a definição dos campos, opções, regras e automações; `Status do contrato` permanece somente leitura para o usuário do card porque é calculado da assinatura.
- Ensaio em cópia local do backup Turso de 28/09: Elaboração v8→v9 e Formalização v9→v10; leitura final confirmou 3 formulários, 6 requisitos, 3 automações e 3 versões ativas. Cópia e scripts temporários removidos; nenhuma escrita em produção.
- Validação no servidor rejeita assinatura sem arquivo privado do próprio card/campo, preenche data se vazia, impede edição após a confirmação auditada e verifica assinatura mais pagamento antes da etapa final. `registrarConclusaoContratoFinanceiro` existente preserva o primeiro evento e registra a situação do pagamento.
- `npm run lint`: 0 erros, 1.191 avisos existentes. `npm run typecheck` e `npm run build`: passaram, executados em sequência para evitar disputa de arquivos `.next`. Três arquivos direcionados: 27 testes aprovados. `npm test`: 554 arquivos, 4.068 testes aprovados, 4 skipped e 1 todo. As duas falhas transitórias da edição paralela do construtor de formulários foram corrigidas pelo respectivo responsável antes desta execução final.
- Publicação exige novo backup Vault completo e autorização específica. O backup de Elaboração não autoriza esta nova configuração; o script valida motivo, integridade e idade do backup antes do apply. O rollback preferencial desativa as novas automações/requisitos e remove os formulários depois de preservar quaisquer valores escritos; restauração integral é último recurso.

## Dev Notes

- `docs/stories/story-financeiro-ativo-novo-contrato-validacao.md`: dados financeiros e status de pagamento vêm da primeira etapa ativa. `docs/stories/story-financeiro-ativo-elaboracao-contrato.md`: envio do contrato inicia `Aguardando assinatura` e acompanhamento; sua configuração local foi ensaiada, mas a própria story registra publicação pendente na última atualização consultada. Confirmar estado atual antes de trabalhar sobre ela.
- `docs/stories/story-financeiro-formalizacao-contrato-assinatura.md`: fonte histórica para decisões de Metas (vínculo explícito), NAS (opcional) e prazo individual; não copiar IDs, versão ou status de release para o Financeiro ativo. `[AUTO-DECISION]` Tratar lembrete diário descrito ali como hipótese a validar no inventário atual, pois o pedido presente especifica apenas “conforme prazo definido”.
- Pontos de investigação existentes: `src/lib/bpm/financeiro-formalizacao.ts`, `financeiro-assinatura-server.ts`, `financeiro-lembretes.ts`, `financeiro-metas.ts`, `validacao-salvamento-configurado.ts`, `transicao-command.ts`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/Anexos.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` e `src/actions/ContratoComercial.ts`. O código histórico usa chaves e guardas do pipeline anterior; verificar aplicabilidade antes de reutilizar. A identidade de `BpmCardServicoContexto.contratoComercialId` já é usada por Metas, mas não prova associação válida para todo card ativo.
- `[AUTO-DECISION]` A data/hora automática atende “registrar data/hora” quando o usuário não a informou. Não marcar `Assinado` apenas pelo evento de envio, nem criar assinatura eletrônica externa sem integração existente. O anexo assinado é distinto do documento enviado para assinatura.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. A coerência foi conferida pelas stories anteriores disponíveis.

## Testes de aceite

1. Documento enviado e pagamento concluído, sem assinatura: Contrato pendente; tentativa de conclusão retorna Contrato.
2. Assinado sem anexo ou com anexo alheio: bloqueio; com anexo válido e data vazia: data/hora automática, conclusão única e acesso autorizado.
3. Assinar antes de pagar, pagar antes de assinar e repetir ambos: conclusão somente com os dois requisitos, sem eventos/tarefas duplicados.
4. Associar contrato comercial correto disponibiliza anexo em Metas; sem vínculo, estado pendente. NAS ausente não afeta o fluxo.
5. Dois prazos individuais diferentes não se misturam; lembrete segue configuração publicada, repetição não duplica e assinatura cessa futuras tarefas.
6. Editar/publicar uma configuração administrativa válida altera a avaliação real do servidor e preserva a leitura de cards existentes.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal integração/backend; secundários frontend e configuração persistida; complexidade alta pela assinatura auditável, duas ordens de pagamento e vínculo de documento.
- **Specialized Agents:** `@dev` implementa; `@qa` revisa testes/regressões; `@architect` revisa identidade e integração Metas; `@ux-expert` revisa formulário; Vault revisa a mudança protegida; `@github-devops` conduz publicação autorizada.
- **Quality Gates:** Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão. Pre-PR (`@github-devops`): compatibilidade com cards históricos e acesso ao anexo. Pre-Deployment (`@github-devops`): evidência Vault, versão/configuração, rollback e smoke.
- **Self-Healing (Story 6.3.3):** `@dev` light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; `@qa` full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; `@github-devops` check, apenas reporta.
- **Focus Areas:** falsos positivos de assinatura, anexo de outro card, datas idempotentes, independência Contrato/Pagamento, vínculo exato em Metas, NAS opcional, lembretes sem duplicação e automações ativas/publicadas.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-ativo-formalizacao.md` — story, checklist, evidências e plano de publicação.
- `scripts/configurar-formalizacao-financeiro-ativo.mts` — prévia e publicação transacional protegida.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — assinatura validada, anexo privado e proteção após confirmação.
- `src/lib/bpm/financeiro-assinatura-server.ts` — grava `CONTRATO CONCLUÍDO` quando a opção estiver configurada, preservando valores históricos.
- `src/lib/bpm/transicao-command.ts` — validações ao avançar e gate final de assinatura/pagamento.
- `src/lib/bpm/automacoes/central-schemas.ts` — parâmetros de prazo por campo e deduplicação diária da tarefa.
- `src/lib/bpm/automacoes/central-runtime.ts` — execução dos parâmetros configuráveis da tarefa.
- `src/lib/bpm/automacoes/idempotencia-tarefa.ts` — ID determinístico por card, tipo e dia civil de São Paulo.
- `src/lib/bpm/financeiro-lembretes.ts` — evita dupla execução com a automação central ativa.
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx` — edição dos novos parâmetros na UI de Automações.
- `tests/bpm/validacao-salvamento-configurado.test.ts` — cenários da Formalização ativa.
- `tests/bpm/automacoes-central.test.ts` — validação da configuração de tarefa com prazo por campo.
- `tests/bpm/financeiro-assinatura-server.test.ts` — encerramento de tarefas na assinatura, regravação e anexo inválido.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da Formalização no Financeiro ativo e separação do pipeline histórico | River (@sm) |
| 2026-09-29 | 0.2 | Implementação local, ensaio transacional e gates; publicação pendente | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS** para inventário e implementação; referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para inventário e implementação local.** Frequência do lembrete e configuração efetiva do Financeiro ativo precisam ser confirmadas antes da publicação; alteração no Turso depende do checkpoint Vault específico.

## QA Results

### Revisão de 29/09/2026 — Quinn (@qa)

**Gate inicial: CONCERNS.** Os 27 testes direcionados passaram. Lint, typecheck e build passaram segundo as evidências da implementação. A suíte completa apresentou duas falhas em arquivos do construtor de formulários alterados em paralelo, fora desta story; o gate completo precisava ser repetido sobre um snapshot estável.

- **AC 1–6, 8:** A configuração ensaiada cria os campos, formulários, requisitos e automações ativas. O servidor valida assinatura, data e anexo privado pertencente ao card/campo; pagamento e assinatura são requisitos independentes. A conclusão registra histórico uma vez, e Metas exige vínculo explícito com o contrato comercial. A publicação real e o smoke autenticado continuam pendentes.
- **AC 7 — acompanhamento após assinatura:** A condição da automação impede criar novos lembretes após `Assinado`, mas tarefas `ASSINATURA_CONTRATO` anteriormente criadas continuam `PENDENTE`. É necessário cessar ou resolver essas tarefas quando a assinatura é confirmada, com histórico auditável, ou ajustar o critério de aceite para deixar explícita a política desejada. Responsável sugerido: @dev/@po.
- **Deduplicação concorrente:** `naoDuplicarDiaTipo` consulta tarefas existentes antes de criar outra, sem chave única ou claim atômico para dois disparos distintos no mesmo dia. O agendamento central tem idempotência por ciclo, mas a promessa genérica de uma tarefa por dia e tipo não fica garantida sob concorrência. Responsável sugerido: @dev.
- **Segurança:** O fluxo novo exige ID do anexo do próprio card, campo configurado e URL privada; não encontrei exposição direta de arquivo nesse caminho.

**Recomendação:** corrigir/decidir a política de tarefas pendentes, repetir o gate completo após estabilizar a árvore e verificar configuração publicada antes de marcar Done. Nenhum código foi alterado nesta revisão.

### Reavaliação do patch — 29/09/2026

As duas correções foram inspecionadas: a confirmação da assinatura conclui tarefas `ASSINATURA_CONTRATO` pendentes na mesma transação, inclusive se o evento auditável já existir; a criação diária passou a usar ID determinístico por card, tipo e dia civil de São Paulo, com unicidade no banco e tratamento de conflito `P2002`. Novos testes cobrem encerramento, regravação, anexo inválido e chave diária em dias e cards distintos; três arquivos direcionados passaram (27 testes). **Os achados de implementação e cobertura estão resolvidos.**

### Gate final local — PASS

Em workspace estabilizado, `npm run lint` terminou com zero erros, `npm run typecheck` e `npm run build` passaram, e `npm test` aprovou 4.068 testes em 554 arquivos (4 ignorados, 1 todo). Os critérios de aceite implementados no código e no ensaio local estão cobertos sem achados bloqueantes. A publicação no Turso e o smoke autenticado são verificações posteriores e continuam pendentes; esta decisão não os substitui. **Recomendação: pronto para revisão da publicação autorizada.**
