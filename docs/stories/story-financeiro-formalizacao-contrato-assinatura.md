# Story — Financeiro: Formalização, assinatura e contratação

## Status

Ready for Review — release ativo, configuração publicada e gates locais aprovados. Pendentes: smoke autenticado com card real e conciliação do card histórico sem anexo. Critérios de aceite ainda não verificados permanecem desmarcados. Integração NAS é futura e opcional.

## Executor Assignment

- `executor: @dev`
- `quality_gate: @qa`
- `quality_gate_tools: [lint, typecheck, npm test, build, CodeRabbit]`

## Story

**Como** integrante do Financeiro, **quero** confirmar a assinatura com data e contrato assinado e acompanhar seu requisito separadamente do pagamento, **para** concluir a contratação somente depois que ambos os requisitos estiverem satisfeitos e disponibilizar o contrato no painel de Metas.

**Escopo:** etapa `Formalização` do pipeline Financeiro existente. A etapa `Elaboração do Contrato` envia o contrato, define `Aguardando assinatura` e cria o primeiro acompanhamento; a presente story continua esse fluxo sem exigir assinatura antes de pagamento nem pagamento antes de assinatura. O avanço entre etapas pode continuar sequencial no quadro, mas a conclusão da contratação depende de dois requisitos independentes. Não recriar pipeline, cards ou contrato já enviado.

## Campos e estados

| Campo visível | Regra funcional |
| --- | --- |
| Status do contrato | Exibir o estado coerente com o requisito Contrato; não permitir que um valor manual contradiga a assinatura confirmada. |
| Status da assinatura | Usar `Aguardando assinatura` ou `Assinado` como estado canônico desta etapa; reconciliar os status redundantes existentes sem perder valores históricos. |
| Data da assinatura | Obrigatória se `Status da assinatura = Assinado`; registrar a data e hora do evento em trilha auditável, preservando o primeiro instante válido em salvamentos repetidos. |
| Contrato assinado/anexo | Obrigatório se `Status da assinatura = Assinado`; apontar para documento assinado acessível pelo fluxo autenticado de anexos do card. |

`Contrato enviado para assinatura` e o documento enviado da etapa anterior **não** comprovam assinatura. Documento assinado é a versão confirmada na Formalização.

## Critérios de aceite

1. [ ] O formulário publicado de `Formalização` apresenta os quatro campos acima e um estado inequívoco de assinatura. Os valores históricos dos três status relacionados continuam legíveis; novos salvamentos e automações usam uma identidade canônica e não deixam estados contraditórios.
2. [ ] Enquanto `Status da assinatura = Aguardando assinatura`, o requisito `Contrato` permanece `Pendente`, mesmo quando há contrato elaborado, enviado ou arquivo não assinado. A pendência aparece no card e na avaliação de conclusão com identificação nominal.
3. [ ] Para aceitar `Status da assinatura = Assinado`, o servidor exige `Data da assinatura` e `Contrato assinado/anexo` válido e acessível no card. A ausência de cada item bloqueia a marcação e a conclusão com mensagem nominal; a UI aplica a mesma condição. Um campo de texto livre sem arquivo/referência autenticada não satisfaz o anexo.
4. [ ] Na primeira confirmação válida da assinatura, registrar data e hora do evento, marcar `CONTRATO CONCLUÍDO`, manter o documento assinado disponível no card e atualizar o requisito `Contrato` para `Concluído`. Repetir salvamento, automação ou evento não troca o instante original nem duplica anexo, tarefa ou efeito de conclusão. Uma data informada e validada é preservada; o instante do evento fica distinguível da data declarada.
5. [ ] A situação do pagamento é verificada automaticamente após a confirmação da assinatura. `Contrato` e `Pagamento` são requisitos independentes: assinatura antes do pagamento, pagamento antes da assinatura e eventos no mesmo momento produzem o mesmo resultado; nenhum evento exige o outro como pré-condição.
6. [ ] `Contratação concluída` somente quando `Contrato = Concluído` **e** `Pagamento = Concluído`. Se apenas um estiver concluído, a contratação permanece pendente e identifica o requisito faltante. A regra é aplicada no servidor em salvamento/transição/conclusão, não apenas na apresentação do card. A passagem para a etapa de pagamento não exige assinatura prévia.
7. [ ] O contrato assinado fica disponível no painel de Metas **somente** pelo vínculo explícito `BpmCardServicoContexto.contratoComercialId` com o `ContratoComercial` correto, com acesso autorizado e referência ao mesmo documento do card, sem associação por nome, empresa ou outro palpite e sem duplicação divergente. Se o vínculo estiver ausente, manter a integração com Metas `Pendente de associação` até que o contrato correto seja associado; não atribuir o documento a outro contrato nem anunciar disponibilização bem-sucedida. Falhas de disponibilização em Metas são observáveis e não apagam a confirmação da assinatura nem bloqueiam a conclusão quando Contrato e Pagamento estiverem concluídos. A integração com NAS fica futura e opcional: sua ausência ou indisponibilidade não impede assinatura, requisito Contrato ou conclusão da contratação, e não gera indicação falsa de arquivo disponível no NAS.
8. [ ] Cada contrato permite configurar seu próprio prazo de assinatura no acompanhamento, além dos quatro campos de Formalização. Enquanto `Status da assinatura = Aguardando assinatura`, o acompanhamento iniciado no envio permanece ativo e o sistema emite lembrete **diário** de assinatura pendente para o contrato, associado ao prazo configurado. O prazo de um contrato não altera o de outro. Após assinatura válida, cessam os lembretes futuros. Reprocessamentos do mesmo dia local do projeto (`America/Sao_Paulo`) não criam lembretes duplicados.
9. [ ] Cards existentes, inclusive com status legados ou pagamento já concluído, continuam legíveis e são reconciliados sem inferir assinatura de um simples status legado ou do contrato enviado. O requisito só é concluído quando há confirmação verificável nos termos do critério 3.

## Tarefas / checklist de execução

- [x] Inventariar em somente leitura a configuração publicada da Formalização, os três status relacionados, identidade dos campos, anexos, requisitos e automações existentes; registrar o mapeamento histórico antes de alterar qualquer configuração (AC 1, 9). Plano somente leitura em `scripts/financeiro-formalizacao-config.mts` executado com sucesso.
- [x] Implementar localmente o estado canônico de assinatura e a reconciliação de valores legados no fluxo configurável, sem atualizar cards em massa por inferência (AC 1, 9). Validação após publicação ainda pendente.
- [x] Implementar localmente validação condicional no servidor e no formulário para data e documento assinado, usando o anexo autenticado existente (AC 2, 3). Validação com card real ainda pendente.
- [x] Implementar localmente evento idempotente de confirmação, instante auditável, atualização de `CONTRATO CONCLUÍDO` e armazenamento/referência do documento assinado (AC 4). Integração de ponta a ponta ainda pendente.
- [x] Implementar localmente requisitos independentes de Contrato e Pagamento e o gate final conjuntivo, inclusive verificação automática do pagamento após assinatura (AC 5, 6). Validação com card real ainda pendente.
- [x] Implementar localmente integração do documento assinado ao painel de Metas via `BpmCardServicoContexto.contratoComercialId`; sem vínculo, sinalizar `Pendente de associação` e permitir conciliação após associar o contrato correto. Preservar conclusão independente de Metas/NAS (AC 7). Validação com contrato comercial real ainda pendente.
- [x] Implementar localmente prazo de assinatura por contrato e lembrete diário enquanto pendente, com deduplicação por contrato/dia e parada após assinatura (AC 8). Execução agendada/publicada ainda pendente.
- [ ] Cobrir ordens dos eventos, faltas de data/anexo, repetição, estados históricos, autorização de anexo e falhas de integração em testes direcionados (AC 1–9).
- [x] Gerar e verificar backup Vault dedicado e executar `scripts/financeiro-formalizacao-config.mts --plan` em somente leitura.
- [x] Preparar a publicação protegida com plano de impacto/rollback, backup Vault dedicado válido e snapshot `pre-change`; a configuração Turso foi publicada. O registro de confirmação operacional específica permanece no relatório Vault do lead; a aprovação funcional inicial, por si só, não autorizava esta escrita.
- [x] Publicar e reler a configuração Turso: `configVersion` 24 → 25; formulários Formalização, Pagamento e Nota Fiscal v2 → v3; campo de anexo configurado como arquivo, prazo criado e quatro requisitos finais ativos.
- [x] Confirmar release Vercel `dpl_Gps4rbrqoF6q5vFXGKVMNNmUGzHg` ativo em `painel.alpha-comex.com`: HTTP 200 na aplicação e HTTP 401 na rota protegida sem sessão.
- [x] Fazer verificação somente leitura do card histórico `cmugxle5800060agmhtfqtnjg`: já está na etapa final, com `Assinado`, data e pagamento `Sim`, porém sem anexo; requisito Contrato continua pendente pela regra publicada. Nenhum backfill foi executado.
- [ ] Executar smoke autenticado com card real, inclusive assinatura com anexo, ordens de pagamento, Metas, lembretes e card histórico (AC 1–9).
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar este checklist e a File List. Gates locais concluídos: lint com 0 erros e 1.192 warnings do repositório; typecheck aprovado; testes aprovados (514 arquivos, 3.851 testes, 4 skipped e 1 todo); build aprovado com avisos preexistentes de `pdfjs`.

### Evidência de validação local

- `scripts/financeiro-formalizacao-config.mts --plan` executado em modo somente leitura; backup Vault dedicado gerado e validado. Validade de até 48 horas deve ser reconfirmada imediatamente antes de qualquer escrita protegida.
- `npm run lint`: aprovado, 0 erros, 1.192 warnings do repositório.
- `npm run typecheck`: aprovado após os ajustes locais.
- `npm test`: aprovado, 514 arquivos e 3.851 testes; 4 skipped e 1 todo.
- `npm run build`: aprovado; avisos de `pdfjs` já existentes.
- Configuração Turso publicada; os critérios de aceite e o smoke autenticado com card real permanecem desmarcados até a verificação funcional em sessão.

### Publicação e leitura posterior

- Release Vercel: `dpl_Gps4rbrqoF6q5vFXGKVMNNmUGzHg`, ativo em `painel.alpha-comex.com`; HTTP 200. A rota autenticada respondeu HTTP 401 sem sessão, como esperado para acesso não autenticado.
- Turso: `configVersion` 24 → 25; formulários Formalização, Pagamento e Nota Fiscal v2 → v3; campo de anexo como arquivo; prazo criado; quatro requisitos finais ativos. Backup completo e snapshot `pre-change` registrados antes da publicação.
- Card histórico `cmugxle5800060agmhtfqtnjg`, em leitura somente: etapa final, assinatura `Assinado`, data informada, pagamento `Sim`, nenhum anexo. O requisito Contrato segue pendente; nenhum estado legado foi promovido por inferência e nenhum backfill foi executado.
- Limite: não houve smoke autenticado com edição/assinatura real de card. HTTP 200/401 e leitura de banco demonstram publicação e aplicação da regra no estado histórico observado, não concluem os demais critérios.

## Contexto técnico e dependências

- `docs/stories/story-financeiro-elaboracao-contrato.md#critérios-de-aceite`, itens 4, 5, 7 e 8: contrato enviado, status inicial `Aguardando assinatura`, primeiro acompanhamento e entrada em Formalização. O smoke com card real dessa story ainda consta pendente; validar a integração de ponta a ponta.
- `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md#acceptance-criteria`: seis etapas, pendências nominais e anexos autenticados.
- Pontos de entrada existentes a conferir antes de codificar: `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` (formulário), `src/actions/bpm/Campos.ts` (respostas), `src/actions/bpm/Anexos.ts` (arquivo), `src/lib/bpm/transicao-command.ts` e `src/actions/bpm/Cards.ts` (transição/salvamento), `src/lib/bpm/automacoes/central-runtime.ts` (eventos). Metas consulta `ContratoComercial` separadamente; usar `BpmCardServicoContexto.contratoComercialId` como identidade explícita do contrato correto, validando acesso e existência antes de disponibilizar. NAS ainda não está pronto e não integra o caminho crítico desta story.
- O fluxo de assinatura é manual se não houver integração aplicável já configurada. Não presumir provedor de assinatura, novo serviço externo, credenciais ou migração de dados.
- A Constitution exige lógica operável pelo caminho de comando/servidor antes da UI; o quadro observa os requisitos e recebe mensagens nominais.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. `[AUTO-DECISION]` Coerência conferida pelas duas stories anteriores e Constitution, sem presumir conteúdo ausente.

## Decisões pendentes

- **Metas — resolvida:** decisão do usuário em 25/09/2026: usar exclusivamente o vínculo explícito `BpmCardServicoContexto.contratoComercialId`. Sem vínculo, estado `Pendente de associação` até que o contrato comercial correto seja associado; nenhuma vinculação inferida por dados textuais. O ponto de exibição usa o painel de Metas já existente e sua autorização, a localizar no inventário técnico sem alterar a regra de identidade.
- **NAS:** decisão do usuário em 25/09/2026: NAS ainda não está pronto e não deve ser obrigatório. `[AUTO-DECISION]` Tratar disponibilização no NAS como integração futura, opcional e fora do gate de conclusão; exibir somente estados confirmados por evidência, sem indicar sucesso de transferência inexistente.
- **Lembretes:** decisão do usuário em 25/09/2026: prazo de assinatura configurável por contrato e lembrete diário enquanto não assinado. `[AUTO-DECISION]` Usar o mecanismo de acompanhamento existente e não fixar um prazo global. O destinatário segue a atribuição de acompanhamento já existente no card; se ela não existir, registrar essa lacuna no inventário antes de publicar a automação, sem escolher destinatário arbitrário.
- **Revogação/correção de assinatura:** não há política aprovada para desfazer uma assinatura confirmada. `[AUTO-DECISION]` Não automatizar reversão destrutiva; se um documento ou data precisar de correção, exigir novo requisito de negócio ou usar mecanismo auditado existente depois de validado.

## Testes de aceite

1. Card enviado e sem assinatura: `Contrato = Pendente`, inclusive com documento enviado e pagamento concluído; contratação pendente aponta Contrato.
2. Tentar marcar `Assinado` sem data, sem anexo ou com texto sem anexo: rejeição no servidor e pendências nominais; data e documento válidos permitem confirmação.
3. Confirmar assinatura duas vezes: mesmo instante auditável, um efeito de conclusão, documento acessível, nenhuma duplicação de acompanhamento.
4. Assinar primeiro e pagar depois; pagar primeiro e assinar depois; simular ambos no mesmo ciclo: contratação concluída somente após os dois requisitos.
5. Reabrir card histórico com status redundantes: apresentação coerente, sem promover contrato enviado a assinado automaticamente.
6. Com `contratoComercialId` válido, Metas recebe referência ao documento do contrato correto; sem vínculo, fica `Pendente de associação`, sem vazamento para outro contrato, e a associação posterior permite conciliação. Simular falha de Metas: assinatura permanece rastreável e a falha é observável. NAS ausente/indisponível não bloqueia assinatura nem conclusão e não aparece como entrega bem-sucedida.
7. Configurar prazos diferentes para dois contratos: cada card preserva o próprio prazo; ambos geram um lembrete por dia enquanto pendentes, reprocessar o mesmo dia não duplica, e assinatura interrompe os lembretes seguintes.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** integração e lógica de API; secundários frontend e configuração persistida; complexidade alta pelas condições paralelas, histórico e Metas.
- **Specialized Agents:** @dev implementa; @architect valida o vínculo entre card e Metas; @qa revisa estados e idempotência; @ux-expert revisa formulário e pendências; Vault atua antes de escrita protegida; @github-devops conduz PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e CodeRabbit; Pre-PR (@github-devops): regressão de cards históricos e acessos; Pre-Deployment (@github-devops): estado de configuração, evidência Vault, rollback e smoke autenticado.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** confirmação falsa por campo legado, servidor/UI divergentes, acesso ao anexo, idempotência de eventos e lembretes, duas ordens dos requisitos, indisponibilidade de Metas e não dependência de NAS.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-formalizacao-contrato-assinatura.md` — critérios, progresso e registro da story.
- `src/lib/bpm/financeiro-formalizacao.ts` — regras de Formalização.
- `src/lib/bpm/financeiro-assinatura-server.ts` — confirmação de assinatura no servidor.
- `src/lib/bpm/financeiro-metas.ts` — vínculo e disponibilização em Metas.
- `src/lib/bpm/financeiro-lembretes.ts` — prazo e lembretes de assinatura.
- `src/lib/bpm/transicao-command.ts` — gate de transição/conclusão.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — validação no salvamento.
- `src/actions/bpm/Cards.ts` — integração com salvamento e movimento do card.
- `src/actions/ContratoComercial.ts` — referência ao contrato comercial para Metas.
- `src/components/comercial/ModalGerenciamentoLeads.tsx` — apresentação do contrato em Metas.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — formulário e pendências da etapa.
- `src/app/api/contratos/[contratoId]/assinado-financeiro/route.ts` — acesso ao contrato assinado.
- `src/app/api/bpm/jobs/automacoes/route.ts` — execução de automações agendadas.
- `scripts/bpm-automacoes.ts` — execução de automações por CLI.
- `scripts/financeiro-formalizacao-config.mts` — plano somente leitura e publicação protegida da configuração Turso.
- `tests/bpm/financeiro-formalizacao.test.ts` — testes direcionados da Formalização.
- `.vercelignore` — exclui backups, logs e builds temporários do pacote enviado ao Vercel.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft do fluxo aprovado, critérios, dependências e decisões pendentes | River (@sm) |
| 2026-09-25 | 0.2 | Prazo configurável por contrato e lembrete diário definidos pelo usuário | River (@sm) |
| 2026-09-25 | 0.3 | NAS futuro/opcional, fora do gate; Metas permanece no escopo | River (@sm) |
| 2026-09-25 | 0.4 | Vínculo explícito com Metas e estado pendente sem associação definidos pelo usuário | River (@sm) |
| 2026-09-25 | 0.5 | File List real e checklist de implementação local; publicação, gates completos e smoke pendentes | River (@sm) |
| 2026-09-25 | 0.6 | Gates locais completos, plano e backup válidos; publicação e smoke continuam pendentes | River (@sm) |
| 2026-09-25 | 0.7 | Release e configuração publicados; leitura histórica confirmou Contrato pendente sem anexo; smoke autenticado pendente | River (@sm) |
| 2026-09-25 | 0.8 | Status Ready for Review para gate de PR; smoke e conciliação histórica explícitos como pendentes | River (@sm) |
| 2026-09-25 | 0.9 | File List inclui `.vercelignore` do release Vercel | River (@sm) |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS**; referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: Ready for Review da implementação publicada.** A revisão deve conferir o smoke autenticado e a conciliação histórica; os critérios de aceite seguem desmarcados até verificação funcional. NAS não bloqueia esta story.
