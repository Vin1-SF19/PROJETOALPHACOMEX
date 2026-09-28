# Story: Revisão de Radar — Reunião Agendada e Análise de Viabilidade

## Status

In Progress — publicação Turso aguardando gate Vault

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `test`, `build`, CodeRabbit, homologação autenticada e prévia Vault.

## Story

**Como** responsável comercial no pipeline **Revisão de Radar**, **quero** registrar a transcrição, o resumo e a Análise de Viabilidade na etapa **Reunião Agendada**, gerar a ficha e seguir apenas para destinos permitidos, **para que** a decisão comercial permaneça documentada e os cards sem retorno sigam a cadência configurável.

## Contexto e precedência

Pedido explícito do usuário nesta conversa. A story `story-alpha-crm-reuniao-agendada-transcricao-meet.md` já implementou parte da integração Google Meet, transcrição, guard de avanço, reagendamento e ciclo de oito dias úteis; esta story deve **auditar e reaproveitar** o que está efetivamente entregue, sem duplicar cliente, job, scheduler ou valor canônico. Há também `docs/google-meet-transcricoes-alpha-crm.md`, que deve ser confrontado com a integração real antes de entregar o guia final. A regra atual da etapa de Agendar Reunião utiliza **uma ligação por dia útil durante oito dias úteis, excluindo feriados nacionais**. Para Reunião Agendada, o pedido atual fala em “até 8 dias”; manter a mesma convenção de oito dias úteis já implementada na etapa, mas verificar que o job realmente registra/respeita cada tentativa e a configuração editável na UI.

O nome visível do destino pode variar no banco (por exemplo **Standby - Follow Up** e **Em tratativa**). Resolver as etapas por identidade/configuração ativa do pipeline Revisão de Radar, e apresentar ao usuário os rótulos publicados. O requisito de transcrição bloqueia o avanço **comercial** para Em tratativa e Sem viabilidade; Standby permanece a saída de contingência, inclusive para vencimento da cadência, como na story anterior. A seção da Análise de Viabilidade deve persistir no **card**, não apenas no formulário em memória. Não inferir regras de aplicabilidade nem preencher dados fictícios.

## Contrato de campos da Análise de Viabilidade

Todos os campos abaixo devem constar em **Configurações → Campos e Formulário** do pipeline e da etapa Reunião Agendada, com tipo, catálogo e obrigatoriedade configuráveis na UI. Valores de mesmo significado já existentes no pipeline/card devem ser reutilizados, especialmente **Radar pretendido**, **Valor acordado no contrato** e **Forma de pagamento**. A transcrição também deve ter controle visível na configuração/formulário, vinculado ao valor canônico `BpmCard.transcricaoReuniao`.

| Campo | Tipo / opções solicitadas |
| --- | --- |
| Mês para protocolar | Data |
| Radar pretendido | Select; reutilizar as opções ativas já configuradas: Habilitação de Radar 50k; Revisão de Radar Limitado a USD150k; Revisão de Radar Ilimitado. |
| Faturamento nos últimos 5 anos | Select: Menos de 5M; De 5 a 16M; Acima de 16M. |
| Armazenamento | Select: Sede da empresa — imóvel alugado; Sede da empresa — imóvel próprio; Sede da empresa — imóvel do sócio; Local separado — galpão alugado; Local separado — galpão próprio; Operador logístico; Sem local definido; Local cedido. |
| Faturas sob titularidade da empresa | Select: Internet; Energia; Internet e energia; Despesas inclusas no coworking; Despesas inclusas no comodato; À regularizar. |
| Atuação da empresa | Select: Varejo/e-commerce; Atacado/distribuidor; Indústria; Prestação de serviços. |
| Tributos pagos no último semestre | Select: Suficiente para Radar 150k; Suficiente para Radar Ilimitado. |
| Valor acordado no contrato | Valor monetário; se houver desconto, registrar o **valor final com desconto**. Não inventar campo de desconto obrigatório. |
| Forma de pagamento | Select: 50% Entrada / 50% Êxito (Pix); Parcelamento Cartão de Crédito - até 12x com juros; Integral na contratação - 10% OFF (Pix). |
| Exportador | Texto editável, conforme decisão posterior do usuário. |
| Nível de complexidade da revisão | Select: Nível 1 — Sem ajustes na documentação; Nível 2 — Ajustes na capacidade operacional; Nível 3 — Mudança de regime tributário usando início/retomada; Nível 4 — Ajustes complexos. |
| Histórico de tentativas anteriores | Sim / Não. |
| Embasamento do processo | Select: Disponibilidade financeira; Início ou retomada — Tributos semestrais; Receita Bruta (DAS); Receita Bruta (CPRB); Desoneração tributária. |

**Aplicabilidade:** o usuário confirmou que configurará depois, na UI, quais campos da análise são obrigatórios. Expor e salvar os treze campos como opcionais inicialmente. O guard deve respeitar obrigações aplicáveis **efetivamente configuradas**, além da transcrição obrigatória explícita.

## Acceptance Criteria

1. A etapa **Reunião Agendada** mostra no card a transcrição persistida, seu estado de sincronização e o resumo das reuniões vinculadas, com acesso à ação de registrar/sincronizar transcrição quando aplicável. O resumo identifica a reunião de origem e não apresenta texto de reunião de outro card.
2. Antes de mover manualmente para **Em tratativa** ou **Sem viabilidade**, o servidor exige transcrição persistida, não vazia após `trim()`, e valida os campos da Análise de Viabilidade marcados obrigatórios pela configuração ativa **quando aplicáveis**. Chamada direta, drag e botão de avanço têm o mesmo resultado; falha não altera etapa nem cria histórico parcial. **Standby** continua disponível como contingência sem transcrição.
3. A seção **Análise de Viabilidade** aparece no card, permite salvar e reabrir os treze campos especificados, e preserva os valores no mesmo card. Tipos e opções seguem exatamente a tabela acima, sem valor paralelo para campos canônicos já existentes.
4. Todos os treze campos e o controle de transcrição aparecem em **Configurações → Campos e Formulário** da etapa/pipeline, com visibilidade, ordem e obrigatoriedade editáveis nos limites do editor existente. Alterações publicadas na UI refletem formulário e guard; nenhum requisito hardcoded ignora uma desativação administrativa, exceto a transcrição explicitamente obrigatória nesta regra.
5. **Forma de pagamento** usa as três opções fornecidas pelo usuário. **Exportador** é texto editável. Os dois campos permanecem opcionais até uma obrigação ser publicada na UI.
6. **Radar pretendido** reutiliza o select vigente e as três opções já decididas pelo usuário. **Valor acordado no contrato** aceita moeda e persiste o valor final com desconto, quando houver; **Histórico de tentativas anteriores** oferece Sim/Não.
7. As únicas saídas manuais oferecidas e aceitas da etapa neste pipeline são **Em tratativa**, **Standby** e **Sem viabilidade**. Mover para qualquer outro destino é recusado no backend e não aparece como ação possível no board/card. Os rótulos reais da configuração publicada são respeitados.
8. A ação **Gerar ficha** está disponível nesta etapa e produz uma ficha a partir dos valores persistidos da Análise de Viabilidade e da reunião, com indicador claro de dados ausentes. Reutiliza infraestrutura de ficha existente quando compatível; não mistura dados de outro card ou inventa conteúdo.
9. É possível reagendar a reunião nesta etapa conforme a regra de integridade da transcrição já documentada: preservar evento/Meet e evidência existente; se a transcrição recebida tornar o reagendamento inseguro, a UI e o backend explicam a recusa e oferecem orientação operacional, sem limpar a transcrição.
10. A integração Google Meet captura/permite registrar a transcrição e traz resumo das reuniões. Estados pendente, recebida e erro são distinguíveis. Falha de licença, permissão ou ausência de transcrição no Google não gera transcrição fictícia e não libera o avanço comercial.
11. Sem **Próximo Contato**, card ativo em Reunião Agendada participa da cadência de **até oito dias úteis**, com uma ligação registrada por dia útil conforme configuração; com Próximo Contato a cadência e envio automático a Standby pausam. Tentativa não registrada não é presumida como realizada. Configuração de cadência deve aparecer na UI e edições/desativação/exclusão são respeitadas pelo job existente.
12. Ao esgotar a cadência ativa e as tentativas exigidas sem resposta/Próximo Contato, a automação envia o card para **Standby** uma só vez, com histórico e atualização do board. Retry e concorrência não duplicam movimento. Não cria segundo cron.
13. Entregar guia **passo a passo completo** para habilitar transcrição no Google Workspace/Cloud, incluindo licença elegível, gravação/transcrição habilitada na reunião, Meet REST API, conta de serviço e Domain-Wide Delegation, scope necessário, usuário impersonado/permissões, variáveis de ambiente, implantação, teste com reunião real, verificação de estados, solução de problemas e limites de disponibilidade. Segredos e dados de clientes não entram no guia/logs.
14. Antes de publicar campos, formulário, transições, cadência ou automação no Turso, executar o protocolo **Vault** do `AGENTS.md`: relatório claro, backup completo verificado de até 48 horas, prévia e confirmação específica do usuário. A autorização anterior para outras etapas não cobre esta publicação. Schema/migration/mutação em massa exige novo gate específico. Toda publicação tem auditoria e rollback documentados.
15. Testes cobrem guard e três saídas, cada tipo/catálogo de campo, edição de configuração, persistência/reabertura, ficha, reagendamento, estados de transcrição, permissões Google, oito dias úteis/feriados, Próximo Contato, tentativa ausente, edição/exclusão da cadência, idempotência e autorização. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Decisions and limits

- [AUTO-DECISION] “Obrigatórios conforme aplicabilidade” → aplicar apenas regras de obrigatoriedade/condição realmente definidas na configuração; expor controles para configuração futura (razão: o usuário não forneceu condições).
- [AUTO-DECISION] “Até 8 dias” → usar oito **dias úteis** como a cadência já documentada/implementada da jornada de Revisão de Radar, sem acrescentar feriados locais não configurados (razão: manter coerência com a decisão da etapa anterior e story existente).
- [AUTO-DECISION] “Gerar ficha” → reutilizar a infraestrutura existente somente se ela puder gerar ficha deste card com os dados pedidos; caso contrário, implementar extensão específica sem alterar o significado das fichas de outros fluxos.
- [USER-DECISION] Forma de pagamento → três opções fornecidas nesta conversa; Exportador → texto editável por enquanto.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout; a coerência foi conferida pelas stories relacionadas e pelo código real.

## Tasks / Subtasks

- [x] 1. Auditar configuração ativa, transições, valores canônicos, editor, formulário, ficha, captura de transcrição e cadência existentes (AC 1–15).
- [ ] 2. Implementar/ajustar seção de Análise de Viabilidade com os treze campos, tipos e catálogos, salvamento e reabertura (AC 3–6): script e UI genérica preparados; aguarda publicação e homologação.
- [ ] 3. Configurar UI administrativa de campos/formulário, transcrição e obrigações aplicáveis sem duplicar valores; preparar prévia da configuração (AC 2, 4–6, 14): prévia pronta; publicação pendente.
- [x] 4. Aplicar guard de avanço no backend e limitar saídas no board/servidor/configuração; preservar contingência Standby (AC 2, 7): guard no servidor pronto; transições do banco pendentes.
- [x] 5. Integrar Gerar ficha, reagendamento, transcrição e resumo de reuniões ao card, respeitando a evidência existente (AC 1, 8–10).
- [x] 6. Auditar/ajustar cadência configurável e job único para esta etapa, Próximo Contato e Standby idempotente (AC 11–12): runtime pronto; definição da cadência pendente no banco.
- [ ] 7. Produzir e validar guia operacional Google Workspace/Cloud com teste real e diagnóstico de permissões/licença (AC 13): guia pronto; teste real requer configuração externa.
- [ ] 8. Se houver escrita protegida no Turso, executar Vault, obter confirmação específica e publicar com auditoria/rollback; homologar UI autenticada (AC 14).
- [x] 9. Executar testes e gates, preencher File List e checklist, documentar evidências e pendências externas (AC 15).

## Dev Notes

- `src/actions/bpm/Cards.ts` e `src/lib/bpm/reuniao-agendada.ts`: movimento e guard de transcrição existentes.
- `src/actions/bpm/TranscricaoMeet.ts`, `src/lib/google-meet/client.ts`, `src/lib/bpm/transcricao-reuniao-server.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`: captura/registro e UI da reunião. Validar comportamento real antes de estender.
- `src/lib/bpm/automacao-novos-leads.ts` e `src/app/api/bpm/jobs/automacao-novos-leads/route.ts`: job existente a reutilizar.
- `src/actions/bpm/Campos.ts` e `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`: configuração canônica de campos/formulário.
- `src/components/GerarFicha.tsx` e `src/app/api/bibble/gerar-ficha/route.ts`: infraestrutura potencial de ficha; confirmar se o contrato atende ao CRM.
- `story-alpha-crm-reuniao-agendada-transcricao-meet.md`: regras de transcrição/reagendamento/cadência já implementadas; esta story deve validar o estado real e completar a experiência.
- `story-alpha-crm-revisao-radar-agendar-reuniao-atribuicao-cadencia.md`: precedente de oito dias úteis, um registro diário e UI de cadências.
- `story-alpha-crm-fechado-status-pos-fechamento.md`: valor acordado e forma de pagamento podem ser compartilhados ao longo da jornada; não criar segundo valor.
- `docs/google-meet-transcricoes-alpha-crm.md`: ponto de partida do guia final; revisar contra APIs/permissões oficiais atuais e ambiente implantado.

### Testing

Testes BPM em `tests/bpm/` e integração Google com mocks para situações pendente, recebida e erro. Testes de UI devem verificar formulário/configuração, ficha e feedback de bloqueio. Não usar banco compartilhado nem reunião real como teste automatizado; o teste real de habilitação Google é uma homologação operacional separada.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack e integração externa; secundários: configuração persistida, automação e segurança. **Complexidade:** alta.

**Specialized Agent Assignment:** `@dev` implementação/pré-commit; `@qa` validação; `@ux-design-expert` formulário/editor; `@architect` vínculo de evidência e integração; `Vault` escritas protegidas; `@devops` configuração/deploy quando solicitado.

**Quality Gate Tasks:**

- [x] Pre-Commit (`@dev`): lint, typecheck, test, build e QA de código; CodeRabbit externo não executado.
- [ ] Pre-PR (`@devops`): revisar compatibilidade e evidência de publicação, se houver PR.
- [ ] Pre-Deployment (`@devops`): revisar envs, cron único, rollback e configuração publicada, se houver deploy.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 minutos, CRITICAL corrigir, HIGH documentar; `@qa` full, até 3 iterações/30 minutos, CRITICAL/HIGH corrigir; `@devops` check/report only.

**CodeRabbit Focus Areas:** campos canônicos sem duplicação; obrigações configuráveis; guard transacional; autorização e vínculo correto da transcrição; ficha sem vazamento entre cards; cadência editável e idempotência; segredo Google somente server-side.

## Checklist de conclusão

- [ ] AC 1–15 verificados com evidência no Dev Agent Record.
- [ ] Configuração Turso publicada apenas após gate Vault e confirmação específica.
- [ ] Guia Google Workspace/Cloud validado contra integração e homologação real.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` executados: lint 0 erros (1191 avisos preexistentes), typecheck PASS, 537 arquivos/3967 testes PASS, build PASS.
- [x] QA sem issue CRITICAL pendente; CodeRabbit externo não executado.
- [x] File List e Change Log atualizados.

## Initial File List

- `docs/stories/story-alpha-crm-revisao-radar-reuniao-agendada-viabilidade.md` — esta story.
- `src/actions/bpm/Cards.ts`, `src/lib/bpm/reuniao-agendada.ts` — previstos, conforme auditoria do guard.
- `src/actions/bpm/Campos.ts`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — previstos para configuração.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` e painel de campos da etapa — previstos para transcrição/resumo e Análise de Viabilidade.
- `src/lib/bpm/automacao-novos-leads.ts` — previsto se houver lacuna na cadência existente.
- `src/components/GerarFicha.tsx` ou adaptação específica de CRM — a decidir após auditoria.
- `docs/google-meet-transcricoes-alpha-crm.md` — previsto para guia operacional completo.
- `tests/bpm/` e testes Google Meet direcionados — previstos para cenários dos AC.
- `docs/reports/` e script de publicação configuracional — somente se o Vault autorizar a escrita no Turso.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story complementar para Reunião Agendada, Análise de Viabilidade, ficha, saídas, cadência e guia Google. | River (`@sm`) |
| 2026-09-28 | 0.2 | Código, guia, prévia Vault, testes e QA concluídos; publicação Turso e teste real Google aguardam. | Codex (`@dev`) |

## Dev Agent Record

### Agent Model Used

GPT-6 Codex.

### Completion Notes

Implementado guard de saídas/transcrição, remoção do fallback Calendar que criava falsa transcrição, reagendamento em Reunião Agendada, links de smart notes/gravações, ficha PDF, cadência editável com início após reunião, e guia Workspace. Script de publicação e prévia read-only prontos. Configuração Turso ainda não aplicada por gate Vault; sem reunião real de homologação.

### File List

- `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/reuniao-agendada.ts` — guard de saídas e transcrição.
- `src/lib/bpm/transcricao-reuniao-server.ts`, `src/lib/google-meet/client.ts`, `src/actions/bpm/TranscricaoMeet.ts` — transcrição real e links de resumos/gravações.
- `src/actions/bpm/GoogleMeet.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` — reagendamento, transcrição e ficha no card.
- `src/lib/bpm/ficha-viabilidade-server.ts`, `src/actions/bpm/FichaViabilidade.ts` — PDF de viabilidade.
- `src/lib/bpm/automacao-novos-leads.ts`, `src/lib/bpm/cadencias/ativacao-automatica.ts` — cadência após reunião.
- `scripts/bpm-reuniao-agendada-config.mjs` — publicação transacional com prévia e guard Vault.
- `docs/google-meet-transcricoes-alpha-crm.md`, `docs/reports/vault-revisao-radar-reuniao-agendada-2026-09-28.md` — guia e relatório de banco.
- `tests/bpm/ficha-viabilidade.test.ts`, `tests/bpm/reuniao-agendada.test.ts`, `tests/bpm/transcricao-reuniao-server.test.ts`, `tests/bpm/automacao-reuniao-agendada.test.ts`, `tests/bpm/google-meet-etapa-guard.test.ts`, `tests/bpm/formulario-etapa.test.ts`, `tests/bpm/card-modal-integration.test.ts`, `tests/bpm/reuniao-transcricao.test.ts`, `tests/bpm/autosave-fixed-recovery-react.test.ts` — testes de regressão e novos cenários.

## QA Results

PASS para código em revisão read-only de @qa: guard e saídas, rejeição do fallback legado, bloqueio de reagendamento depois da reunião, ficha PDF, links Meet e cadência configurável. Testes dirigidos 5 arquivos/39 testes e `git diff --check` passaram. Publicação Turso e homologação Google são gates operacionais pendentes.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Pedido e relação com entregas anteriores explícitos. |
| Technical Implementation Guidance | PASS | Fontes canônicas e pontos de integração identificados. |
| Reference Effectiveness | PASS | Stories e guia relevantes resumidos, sem depender de leitura integral. |
| Self-Containment Assessment | PASS | Usuário definiu opções de pagamento e Exportador texto; obrigatoriedade posterior pela UI foi confirmada. |
| Testing Guidance | PASS | Casos de domínio, UI, integração, cadência e publicação mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY para implementação. A obrigatoriedade condicional poderá ser definida depois na UI; escrita no Turso depende do gate Vault e confirmação específica.
