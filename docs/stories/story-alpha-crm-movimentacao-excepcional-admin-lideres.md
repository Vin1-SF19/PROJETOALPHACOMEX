# Alpha CRM — Movimentação livre por Admin (TI) e líderes de setor

## Status

Ready for Review — implementação e testes concluídos em 20/10/2026. Build interrompido por SIGTERM; limitação registrada abaixo. O adiamento da versão 0.1 foi substituído pelo pedido atual.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: revisão de autorização no servidor, regressões de movimentação, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Story

**Como** Admin (TI) ou líder de setor, **quero** mover os cards livremente pelo modal e pelo Kanban, **para** conduzir o trabalho do meu setor mesmo quando existirem pendências de preenchimento ou de fluxo.

## Origem e contexto

Pedido atual literal: “gostaria que Admin (TI) e os lideres do setores, podessem mover os cards livremente, tnato dentro do card, quanto pelo kanban (para o operacional nao foi configurado lider operacional, mas e o usuario vitor, configure ele)”.

O pedido anterior adiava a implementação; esta retomada a autoriza e identifica Vitor como líder Operacional. Não é necessário pedir novamente aprovação do desenho da movimentação.

`docs/stories/accumulated-context.md` não foi localizado. A coerência entre entregas considera:

- [Alinhamento de cards e fluxo de contrato](./story-alpha-crm-alinhamento-cards-fluxo-contrato.md): preservar a evolução concorrente das regras normais e do fluxo comercial.
- [Movimentação manual de importados RD](./story-alpha-crm-movimentacao-manual-importados-rd.md): o privilégio por papel vale para cards nativos e importados; a confirmação RD não deve acrescentar uma confirmação ao movimento autorizado por liderança.
- [Conclusão Financeiro/Operacional](./story-alpha-crm-conclusao-financeiro-handoff-operacional.md#acceptance-criteria): a dispensa de uma pendência para mover não comprova assinatura, pagamento ou emissão de nota fiscal.

## Escopo e decisões

- [AUTO-DECISION] “Livremente” exige justificativa ou confirmação adicional? → Não. Usar os comandos normais de movimentação, sem exigir justificativa, prévia ou confirmação especial.
- [AUTO-DECISION] Quem é Admin (TI)? → Reutilizar a política administrativa global existente (`isAdminRole`: Admin, CEO e TI), sem criar privilégio baseado em rótulo do navegador.
- [AUTO-DECISION] Qual é o alcance do líder? → O setor liderado deve corresponder a um setor associado ao pipeline ou à etapa de origem/destino; liderança isolada de outro setor não basta. Destino deve continuar sendo etapa ativa do mesmo pipeline. Acesso de módulo/pipeline e usuário ativo continuam necessários.
- [AUTO-DECISION] A liberdade inclui pular ou voltar etapas? → Sim, para movimentação manual autorizada, dispensando as obrigatoriedades e restrições de sequência de negócio que impeçam a troca de etapa.
- [AUTO-DECISION] Jobs herdam privilégio de quem criou o card? → Não. A exceção só pode ser derivada da pessoa autenticada executando uma operação manual.
- [AUTO-DECISION] Como identificar liderança? → Usar catálogo canônico: papel persistido `Lider <setor>` associado ao cadastro normalizado de setores e concessão individual Operacional para a identidade já definida em `DIRETOR_OPERACIONAL_VITOR_ID`. Supervisores de leitura do pipeline não recebem autoridade de movimentação.
- [AUTO-DECISION] Como configurar Vitor? → Reutilizar a constante existente em `boas-vindas.ts`, cuja identidade foi confirmada no banco pelo executor, como concessão individual de liderança OPERACIONAL. Exigir conta ativa, role OPERACIONAL e acesso CRM; vale para os pipelines Operacional e SMART no escopo de setor, sem alterar dados/schema ou inferir liderança pelo cargo.
- [AUTO-DECISION] O movimento livre executa o fluxo financeiro e automações? → Reposicionar a etapa preservando status financeiro e lifecycle. Suprimir gatilhos imediatos e o processamento/replay de eventos de automação originados por essa movimentação; manter histórico auditável sem fabricar conclusão do fluxo.

## Acceptance Criteria

1. Admin (TI), conforme política administrativa global existente, pode mover manualmente cards nativos e importados para qualquer etapa ativa do mesmo pipeline, inclusive avançando várias etapas ou retornando, mesmo com pendências de campos, formulários, checklists, tarefas e condições de entrada/saída do fluxo.
2. Líderes de setores possuem a mesma liberdade dentro do escopo descrito acima. A autoridade é derivada no servidor de usuário ativo, papel `Lider <setor>` associado ao cadastro de setores ou concessão individual explícita no catálogo canônico; administrador ou participante do card, supervisor de leitura, cargo arbitrário e acesso individual ao pipeline não concedem por si só a exceção de liderança.
3. A política funciona de forma equivalente no arrastar/soltar do Kanban e na seleção de destino dentro do card. Ambos oferecem os destinos permitidos para o ator e não bloqueiam o movimento por pendências dispensadas. Não exigem justificativa nem confirmação adicional, inclusive para cards RD.
4. Usuários comuns continuam sujeitos às regras normais. Flags, papéis, nomes ou setores enviados pelo cliente não podem elevar a autoridade. Uma conta inativa, liderança revogada ou líder fora do escopo não pode usar o privilégio.
5. Permanecem obrigatórios autenticação, acesso ao módulo/pipeline, autorização de setor, existência do card, identidade e integridade do destino ativo no mesmo pipeline, controle de versão/concorrência e transação atômica. Destino de outro pipeline ou inexistente deve falhar sem gravação parcial.
6. A movimentação registra no histórico o ator, a autoridade usada, setor quando aplicável, etapa de origem/destino e dispensa aplicada. Não fabrica valores de campos, anexos, assinatura, pagamento ou NF; pendências existentes permanecem identificáveis. A operação reposiciona a etapa preservando status financeiro e lifecycle; dispensa de movimento não transforma evidência ausente em conclusão financeira válida.
7. Automações, webhooks e integrações não recebem a exceção pessoal. A movimentação livre não dispara gatilhos imediatos nem processamento/replay de eventos de automação capazes de concluir fluxos ou alterar outros cards. O histórico permanece disponível para auditoria. A exceção não amplia permissões de edição, anexos ou configuração.
8. A conta existente de Vitor recebe liderança OPERACIONAL no catálogo canônico por meio da identidade já representada por `DIRETOR_OPERACIONAL_VITOR_ID`, cobrindo os pipelines Operacional e SMART conforme vínculo de setor. O resolvedor exige usuário ativo, role OPERACIONAL e acesso CRM; revoga a concessão efetiva ao sair do setor, perder CRM ou ser desativado. Não duplicar conta, alterar dados/schema nem promover a Admin/TI; preservar os acessos existentes.
9. Reenvio, concorrência ou falha de auditoria respeitam os mecanismos existentes de idempotência, conflito e rollback, sem duplicar movimento/histórico. Permissões são reavaliadas pelo servidor na operação efetiva.

## Tasks / Subtasks

- [x] Retomar o registro de backlog conforme pedido atual e remover requisitos não solicitados de confirmação e justificativa.
- [x] Identificar pontos de integração atuais de papel, setor, movimento e interfaces.
- [x] Verificar identidade de Vitor e distinguir liderança autorizada de supervisão de leitura: a constante `DIRETOR_OPERACIONAL_VITOR_ID` já existe; supervisores de leitura incluem analistas e não devem ser promovidos.
- [x] Implementar catálogo canônico e resolução de autoridade manual administrativa/liderança: papéis `Lider <setor>`, concessão individual de Vitor e escopo por setor, sem confiar no cliente ou promover supervisores (AC 1, 2, 4, 5).
- [x] Aplicar a dispensa de requisitos de negócio no comando compartilhado de transição, preservando integridade, concorrência, auditoria e contratos financeiros (AC 1, 5, 6, 9).
- [x] Integrar disponibilidade de destinos, ação do modal e arrastar/soltar do Kanban com a mesma política, evitando confirmação RD redundante (AC 3).
- [x] Preservar status financeiro/lifecycle e suprimir gatilhos imediatos e processamento/replay de eventos de automação da movimentação livre; garantir que automações, integrações e demais permissões não herdem o privilégio (AC 4, 6, 7).
- [x] Configurar e verificar a concessão individual Operacional de Vitor no catálogo canônico usando a identidade existente, com revogação por estado/setor/CRM e cobertura Operacional/SMART, sem escrita no banco (AC 8).
- [x] Executar testes de autorização, movimento, UI e regressão e registrar resultados reais dos quality gates (AC 1–9).
- [x] Atualizar checklist, File List e registros de conclusão antes de marcar Ready for Review.

## Dev Notes

Não foram encontrados documentos gerais de arquitetura ou `docs/framework/` aplicáveis a esta alteração. As referências abaixo são evidências do código existente, sem prescrever novo schema ou biblioteca.

- `src/lib/roles.ts`: `isAdminRole` já normaliza Admin, CEO e TI. `isSameRole` normaliza caixa, acentos e pontuação.
- `prisma/schema.prisma`: `usuarios.role` e `usuarios.cargo` existem; `Setor` contém nome/estado e vínculo `bpmPipelines`, sem coluna própria de líder. `BpmPipelineSetor` é a associação persistida relevante para escopo. Os papéis `Lider <setor>` devem ser resolvidos contra o cadastro de setores; não usar o cargo livre como fonte de autoridade.
- `src/actions/gestaoSetores.ts`: cadastro de setores/papéis existente inclui `Lider Comercial`; não presumir que todos os ocupantes de OPERACIONAL sejam líderes.
- Evidência de leitura do executor em 20/10/2026: Vitor (usuário 10) está ativo e possui role OPERACIONAL. `src/lib/bpm/boas-vindas.ts` já define `DIRETOR_OPERACIONAL_VITOR_ID = 10`; reutilizar essa identidade no catálogo canônico de liderança, condicionada a conta ativa/setor/CRM. O JSON `supervisores` do pipeline contém também uma analista Operacional sem autorização de liderança; trata-se de supervisão de leitura, portanto não serve como concessão para movimentação livre. O cadastro Comercial inclui papel `Lider Comercial` associado ao pipeline.
- Limitação explícita: a concessão individual de Vitor permanece configurada em código, consistente com sua identidade operacional já existente; o pedido não inclui interface genérica de gestão de líderes. Demais líderes são reconhecidos pelo papel persistido `Lider <setor>`, normalizado e associado ao cadastro de setores.
- `src/lib/bpm/ownership.ts`: acesso atual de módulo, pipeline e card; preservar visibilidade/acesso sem transformar a exceção de movimento em autorização geral para outras operações.
- `src/lib/bpm/transicao-command.ts`: comando compartilhado contém preparação, validação, concorrência, gravação, histórico e efeitos derivados; centralizar aqui a aplicação autorizada da dispensa.
- `src/actions/bpm/Cards.ts` e `src/actions/bpm/DisponibilidadeEtapasCard.ts`: entradas do movimento e consulta de destinos devem compartilhar a política.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: duas entradas visuais exigidas pelo usuário.
- `src/lib/bpm/movimento-importado-rd.ts`: preservar o comportamento RD normal quando não houver privilégio administrativo/de liderança.

Esta implementação usa cadastro existente e concessão individual em código; não exige nem executa escrita de dados, schema, seed ou backfill. Qualquer mudança futura de banco coberta pela política deve seguir o `AGENTS.md`; não faz parte desta entrega.

## Testing

- Unitários: Admin/TI/CEO, líder Comercial, líder Operacional, líder de outro setor, usuário comum, supervisor de leitura, cargo sem vínculo, inativo e liderança revogada; normalização de papéis e escopo por origem/destino.
- Integração de action/comando: avanço e retorno com pendências; card RD/nativo; destino inválido/inativo/outro pipeline; payload forjado; versão antiga; reenvio; falha transacional de histórico.
- React/UI: modal mostra destinos e permite movimento sem preencher pendências; Kanban aceita drop equivalente; ausência de confirmação adicional para privilegiados; bloqueios normais de usuário comum preservados.
- Regressão: automações/webhooks sem exceção herdada; movimentação livre sem gatilho imediato nem processamento/replay de automação; status financeiro/lifecycle preservados; contratos financeiros sem evidências fabricadas e permissões de edição/anexos inalteradas.
- Configuração: autoridade individual de Vitor reutiliza a identidade canônica existente, com acesso Operacional/SMART preservado; teste de revogação ao sair do setor, desativar ou perder CRM. Nenhuma comparação por nome/cargo e nenhuma promoção automática dos supervisores de leitura.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Registrar falhas ambientais ou preexistentes separadamente; não afirmar aprovação sem execução.

## CodeRabbit Integration

- **Story Type Analysis:** Security; secundárias API, Frontend e Integration; complexidade alta.
- **Specialized Agents:** `@dev`, `@architect`, `@qa`, `@ux-design-expert`; Vault/Data Engineer apenas se surgir alteração de banco coberta pela política.
- **Quality Gates:** pre-commit com revisão de autorização; pre-PR/pre-deployment quando publicação fizer parte da entrega.
- **Self-Healing:** `@dev` light, 2 iterações/15 minutos, CRITICAL; HIGH documentado; `@qa` full, 3 iterações/30 minutos, CRITICAL/HIGH. Registrar fallback se CLI indisponível.
- **Focus Areas:** autoridade derivada no servidor, setor de origem/destino, atomicidade, idempotência, auditoria e ausência de escalonamento por automações.

## Validação da story — River

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado | Observação |
|---|---|---|
| Objetivo e contexto | PASS | Retomada atual e Vitor incluídos. |
| Orientação técnica | PASS | Papéis, setor, pontos de integração e ausência de FK de líder documentados. |
| Referências | PASS | Fontes locais e relação com RD/Financeiro identificadas. |
| Autossuficiência | PASS | Escopo e significado de movimento livre explícitos, sem confirmação extra. |
| Testes | PASS | Casos positivos, negativos, duas interfaces e integridade cobertos. |
| CodeRabbit | PASS | Revisão prevista; execução pertence à implementação. |

**READY para execução; status operacional In Progress conforme retomada.** Clareza 9/10. A identidade de Vitor já foi verificada pelo executor e será reutilizada pela constante existente no catálogo; supervisão de leitura foi explicitamente excluída. A configuração individual em código e seus critérios de revogação estão documentados. Nenhuma alteração de código ou dados foi realizada durante a expansão documental.

## Dev Agent Record

- Autoridade específica de movimento derivada de conta ativa, CRM e setores do pipeline; Admin/CEO/TI, papéis Lider <setor> e identidade canônica de Vitor. Supervisão legada de leitura não concede liderança.
- Vitor foi verificado por leitura no cadastro: conta ativa OPERACIONAL. Verificação CLI com o resolvedor novo reconheceu Operacional e REVISÃO DO RADAR - ASSESSORIA SMART; líderes comerciais reconhecidas somente em Revisão de Radar; a analista registrada como supervisora não recebeu privilégio. Nenhuma escrita de dados, migration ou alteração de schema realizada.
- Modal (inclusive layout compacto) e Kanban recebem `podeMoverLivremente`; servidor reaplica autorização em cada transação, permitindo saltos/retornos sem aresta configurada ou requisitos. Edição de campos/responsável exige autorização própria e ACL do perfil de edição.
- Reposicionamento preserva lifecycle/status financeiro, registra autoridade no histórico e usa CAS/idempotência. Não cria evidências de contrato/pagamento nem dispara automações imediatas ou replay do evento; SLA acompanha a etapa real.
- `npm test`: **659 arquivos e 5.003 testes aprovados**, 4 ignorados, 1 todo. Log `/tmp/alpha-livre-full-tests-final.log`.
- `npm run lint`: **0 erros**, 1.193 warnings preexistentes. Log `/tmp/alpha-livre-lint.log`.
- `npm run typecheck`: **aprovado**, exit 0. Log `/tmp/alpha-livre-typecheck-final.log`.
- `npm run build`: Prisma Client/player gerados e compilação com warnings de `pdfjs-polyfill.ts`; worker Next.js encerrou com `SIGTERM`. Também houve warning de cache `ENOENT` em `.next/cache/webpack/edge-server-production`. Build completo não aprovado; causa do sinal não determinada. Log `/tmp/alpha-livre-build.log`.
- Revisão independente AIOX QA: **APPROVED para código e testes**, com ressalva de build/publicação. Achados de ACL, perfil de edição e destinos corrigidos; regressão independente anterior 68/68. CodeRabbit CLI indisponível.
- Alterações concorrentes preservadas; patch dos arquivos compartilhados desta sessão em `/tmp/alpha-movimento-livre-own.patch`. Usuário solicitou explicitamente commit e push para staging após conhecer a ressalva de build.

### Validação da entrega isolada para staging

- Patch preparado sobre `bcc3373c9afda0d455961efcf2e313c5e2dd0784`, sem incorporar alterações concorrentes de RD, histórico ou compartilhamento geral. Os resultados de 5.003 testes acima pertencem ao workspace integrado, não a esta base isolada.
- Liderança recebe leitura dos cards do pipeline de seu setor em `Cards.ts` e `Quadro.ts`, necessária para mover cards de colegas. Isso não concede edição geral. Três testes adicionais cobrem líder Comercial, Vitor e recusa para líder de outro setor.
- `npm run typecheck`: aprovado, exit 0, `/tmp/alpha-livre-isolated-typecheck.log`.
- `npm run lint`: aprovado, zero erros e 1.193 warnings preexistentes, `/tmp/alpha-livre-isolated-final-lint.log`.
- `npm test`: 635 arquivos aprovados, 4 com falha e 1 ignorado; 4.745 testes aprovados, 6 com falha, 7 ignorados, 1 todo. `/tmp/alpha-livre-isolated-all-tests.log`.
- As falhas são as mesmas já reproduzidas na base antes desta entrega: três testes em `builder/embed`, dois em `bpm/em-tratativa`, um de scroll em `bpm/card-modal-integration` e erro de importação `next/server` na suíte `bpm/arquivamento-modal-react`. Comparação em `/tmp/origem-isolated-baseline-tests.log` e `/tmp/origem-isolated-tests-final.log`. Nenhuma regressão nova na suíte completa.
- Comando isolado: 17 casos novos aprovados; React e Quadro com os três casos adicionais: 14/14 aprovados em `/tmp/alpha-livre-isolated-last-tests.log`.
- Build completo continua sem aprovação pelo SIGTERM já registrado; não foi repetido na cópia isolada. Push solicitado explicitamente pelo usuário, sem deploy de produção.

### DoD

- [x] Requisitos funcionais e escopo por setor implementados, incluindo Vitor e ambas as interfaces.
- [x] Segurança, autorização de edição separada, testes negativos, concorrência e rollback revisados.
- [x] Testes de integração e componentes React executados; lint/typecheck aprovados.
- [x] Configuração real conferida por CLI somente leitura; sem novas dependências ou variáveis.
- [x] Checklist, decisões, File List e documentação atualizados.
- [ ] Build completo — interrompido por SIGTERM; não declarar publicação aprovada.
- [ ] Smoke manual em navegador autenticado — não executado; comportamento coberto por testes React e comandos transacionais.

## File List

Somente arquivos efetivamente alterados nesta entrega (mudanças concorrentes preservadas):

- `docs/stories/story-alpha-crm-movimentacao-excepcional-admin-lideres.md`
- `src/lib/bpm/lideranca-setor.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/bpm/automacoes/eventos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/DisponibilidadeEtapasCard.ts`
- `src/actions/bpm/Quadro.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/lideranca-setor.test.ts`
- `tests/bpm/movimento-livre-eventos.test.ts`
- `tests/bpm/ownership-security.test.ts`
- `tests/bpm/disponibilidade-etapas-card.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/movimento-livre-command.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/membros-card-ui.test.ts`
- `tests/bpm/visibilidade-etapa.test.ts`
- `tests/bpm/quadro-actions.test.ts`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Registro em backlog com implementação adiada por solicitação anterior. | River |
| 2026-10-20 | 0.2 | Retomada: movimento livre em modal/Kanban, liderança por setor, Vitor no Operacional, sem justificativa/confirmação especial. | River |
| 2026-10-20 | 0.3 | Liderança por papel e concessão individual canônica de Vitor; supervisores de leitura excluídos; preservação financeira/lifecycle e supressão de automações do movimento livre. | River |

| 2026-10-20 | 1.0 | Regra de liderança, movimento livre em duas interfaces, auditoria, supressão de automações e regressão de 5.003 testes; build com ressalva SIGTERM. | Codex |

| 2026-10-20 | 1.1 | Entrega isolada sobre staging; leitura dos cards de colegas no setor liderado; testes independentes e falhas preexistentes documentadas. | Gage |
