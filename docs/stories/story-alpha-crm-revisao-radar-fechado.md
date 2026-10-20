# Story: Revisão de Radar — Fechado, contratação e arquivamento

## Status

Ready for Review — configuração de Em tratativa autorizada, aplicada e verificada em produção em 16/10/2026: pipeline Radar v32 e formulário v3, mesmos dois campos opcionais na origem e obrigatórios na entrada de Fechado. Correção nominal do vendedor implementada e revisada localmente; publicação da aplicação e homologação autenticada pendentes. Lint, typecheck pré-build, build e 126 testes direcionados passaram; suíte global mantém seis falhas preexistentes. Typecheck pós-build repetido com sucesso no gate de publicação; duas tentativas anteriores haviam sido interrompidas (143). Histórico anterior não substitui esta verificação; NAS/QNAP continua fora do escopo.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, homologação CRM/Financeiro/Operacional/BlobCRM

## Story

**Como** responsável comercial do Alpha CRM, **quero** entrar em **Fechado** com dados contratuais válidos, acompanhar a contratação no Financeiro e encontrar os anexos assinados no BlobCRM, **para** manter a venda e o processo posterior rastreáveis.

## Contexto verificado e limites

Aplica-se à etapa **Fechado** (`draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83`) do pipeline ativo **Revisão de Radar**. Inventário somente leitura recebido em 2026-09-28: a etapa ainda está **sem formulário/configurações de campos**; já existe a automação ativa **“Fechado — criar card no Financeiro”**. Os campos compartilhados já existem em **Reunião Agendada**: **Valor acordado no contrato** (`cmulgji5o000t9cihst0e4tuc`, moeda) e **Forma de pagamento** (`cmulgji99000u9cihr9mcumnr`, select com três opções). IDs servem ao diagnóstico; a implementação deve localizar a identidade/configuração vigente, sem hardcode.

`story-alpha-crm-fechado-status-pos-fechamento.md` implementou o contrato de cinco status, cores, badge e edição protegida em um estado anterior do pipeline. É preciso **reassociar/verificar** esse comportamento na etapa recriada; não recriar um segundo status. A story antiga excluía Financeiro e assinatura, mas o pedido atual amplia expressamente esse escopo. `story-alpha-crm-saidas-radar-financeiro-operacional.md` documenta a criação de card Financeiro vinculado, que já tem automação ativa nesta etapa. `story-financeiro-formalizacao-contrato-assinatura.md` exige data, anexo autenticado e evidência para marcar contrato assinado no Financeiro; a integração NAS era futura naquela entrega.

**Decisões posteriores do usuário:** **DEFERIDO** é resultado separado, lido do card **vinculado** do pipeline **Operacional** quando este estiver na etapa ativa **Processo deferido**; não é sexto status pós-fechamento. O arquivamento inicial do contrato assinado será **somente no BlobCRM privado**. NAS/QNAP será configurado depois e não integra a entrega atual. No checkout, as variáveis presentes são `CRM_STORE_ID` e `CRM_READ_WRITE_TOKEN`; não há variáveis `BLOBCRM_*`. Não registrar valores de segredos na story, em logs ou em testes.

## Acceptance Criteria

1. **Valor acordado no contrato** é moeda obrigatória ao entrar em Fechado. Se houver desconto, o valor persistido e apresentado como acordado é o **final após desconto**; não se cria desconto obrigatório sem requisito adicional. **Forma de pagamento** é select obrigatório com as três opções atuais: **50% Entrada / 50% Êxito (Pix)**; **Parcelamento Cartão de Crédito - até 12x com juros**; **Integral na contratação - 10% OFF (Pix)**.
2. Esses são os campos compartilhados já existentes, com **uma fonte de valor** ao longo de Reunião Agendada, Em tratativas e Fechado. A etapa Fechado os apresenta em **Configurações → Campos e Formulários**, com obrigatoriedade, visibilidade e ordem configuráveis na UI. O formulário do card carrega valores persistidos, permite correção autorizada e não cria `BpmCampo` duplicado.
3. Movimento para Fechado pelo modal, drag ou action direta falha com pendência nominal se um dos dois campos estiver ausente ou inválido. O servidor revalida os valores e a configuração publicada na transação; falha não altera etapa, status, histórico nem dispara automação financeira. Alterar a obrigatoriedade na UI modifica o guard conforme a regra publicada, preservando a exigência de negócio aprovada para a configuração inicial.
4. Na entrada válida, o status pós-fechamento inicia em **Aguardando contrato** apenas quando ainda não houver status persistido. O select no card aceita exatamente **Aguardando contrato**, **Contrato a enviar**, **Contrato enviado**, **Pagamento confirmado** e **Contrato assinado**. Valor existente não é apagado por releitura/reentrada.
5. O board de Fechado mostra badge e aparência distintos por status: Aguardando contrato cinza, Contrato a enviar azul, Contrato enviado âmbar, Pagamento confirmado violeta, Contrato assinado verde. A informação textual permanece visível para não depender apenas de cor. Edição de status usa autorização, histórico e atualização do board já existentes.
6. Entrar em Fechado aciona a automação configurada **“Fechado — criar card no Financeiro”**, criando/vinculando uma única instância no estágio inicial Financeiro. Valores comerciais compartilháveis, especialmente valor final e forma de pagamento, chegam ao Financeiro pelos mapeamentos configurados. Retry ou reentrada não duplica o card nem sobrescreve edição financeira posterior. Falha de integração fica observável e não é apresentada como contratação concluída.
7. O card comercial mostra o estado do processo de contratação a partir do card Financeiro **vinculado**, distinguindo contrato aguardado, enviado, pagamento confirmado e assinatura comprovada. Não se deduz assinatura de `Contrato enviado`, de status manual, nem de anexo sem confirmação. A sequência de assinatura e pagamento segue os requisitos independentes já estabelecidos no Financeiro.
8. A seção de anexos usa o fluxo autenticado já existente e mostra os documentos do card/contrato vinculado conforme permissão. Quando a assinatura for confirmada no Financeiro com data e anexo válido, garantir **arquivamento automático no BlobCRM privado**, com referência verificável ao mesmo documento assinado, estado de sucesso/erro e retry idempotente. Se o anexo assinado já estiver no BlobCRM, reutilizar sua referência autenticada em vez de duplicar o arquivo. Falha no BlobCRM não produz indicação falsa de arquivamento; preservar a confirmação de assinatura e permitir reconciliação. Não escrever no NAS/QNAP nesta entrega.
9. **DEFERIDO** é resultado processual separado dos cinco status de contratação e do movimento para Fechado. O card comercial o exibe **somente** quando o card do mesmo processo, ligado pela cadeia de vínculos Radar → Financeiro → Operacional, estiver na etapa ativa **Processo deferido** do pipeline Operacional. Não inferir por texto livre, status manual, nome da empresa ou card operacional não vinculado; não adicionar sexta opção ao select pós-fechamento. A atualização do resultado acompanha a mudança real de etapa e preserva histórico/auditoria, sem confundir deferimento com pagamento ou assinatura.
10. Toda alteração de configuração no Turso (formulário, obrigatoriedade, automações, mapeamento ou resultado) segue **Vault** do `AGENTS.md`: inventário e relatório de comandos/impacto/riscos/alternativa/rollback, backup completo verificado de até 48 horas e confirmação específica antes da escrita. Schema/migration/backfill exige gate próprio. Não reutilizar autorização concedida a outra etapa.
11. Testes verificam os dois obrigatórios, valor final com desconto, três opções, guard em três caminhos, editor de campos, cinco status/cores, vinculação Financeiro sem duplicação, dados preservados, estados independentes de pagamento/assinatura, anexo autorizado, BlobCRM privado com reuso/erro/retry, ausência de escrita NAS e DEFERIDO vindo somente da etapa ativa **Processo deferido** do card Operacional vinculado. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List.

## Tasks / Subtasks

- [x] Inventariar versão ativa, formulário vazio, campos compartilhados, cinco status e automação Financeiro; registrar evidências e lacunas.
- [x] Preparar Fechado com os dois campos existentes e guard de entrada; expor no editor/card sem duplicar identidade. Publicação pendente.
- [x] Revalidar status/badge/cores do código anterior no pipeline recriado e corrigir lacunas constatadas.
- [x] Validar automação Financeiro ativa, mapeamento, vínculo, idempotência e visibilidade do andamento no card comercial. Publicação pendente.
- [x] Integrar anexos e referência ao BlobCRM privado na assinatura; confirmação exige Blob e o card comercial mostra estado/documentos financeiros.
- [x] Projetar resultado DEFERIDO a partir da etapa ativa **Processo deferido** do card Operacional vinculado, sem alterar o select de cinco status.
- [x] Executar Vault antes de qualquer escrita protegida; publicar após autorização específica e verificar os registros no Turso.
- [ ] Homologar o fluxo autenticado após publicação da aplicação.

## Dev Notes

- Reutilizar `BpmCampoObrigatorioEtapa` e campos compartilhados; o guard canônico de transição é `src/lib/bpm/transicao-command.ts`. Inspecionar ações de movimento e formulário da etapa antes de alterar código.
- Status canônico existente: `BpmCard.statusPosFechamento`; `PainelStatusPosFechamento` e card do board são pontos de verificação. As cores exatas estão nos AC 23–24 de `story-alpha-crm-fechado-status-pos-fechamento.md`.
- Automação entre pipelines e `BpmCardVinculo` estão documentados em `story-alpha-crm-saidas-radar-financeiro-operacional.md`; confirmar comportamento no pipeline recriado, sem substituir automação ativa por lógica fixa.
- Assinatura comprovada vem do fluxo Financeiro/Formalização, cuja story exige data e anexo autenticado. Anexos CRM já usam Blob privado; `CRM_STORE_ID` e `CRM_READ_WRITE_TOKEN` estão presentes no checkout, mas sua disponibilidade no ambiente implantado deve ser verificada sem exibir valores. NAS/QNAP não tem destino/padrão definido e fica fora do escopo atual.
- Os arquivos `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no checkout na preparação; a coerência cruzada foi verificada pelas stories citadas.

## Testing

Unit/integration em `tests/bpm/` para guard, status, vínculos Radar → Financeiro → Operacional, idempotência e BlobCRM privado; testes de UI para editor, card e badge. Homologação autenticada deve confirmar card Radar → Financeiro, anexo assinado no BlobCRM e resultado DEFERIDO somente no processo Operacional vinculado em **Processo deferido**.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Full-stack e integração interna/externa; complexidade alta. Secundários: configuração persistida, autorização e arquivos.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@architect` revisa vínculo e arquivamento; `@ux-design-expert` revisa editor e card; `Vault` conduz escrita protegida; `@devops` para eventual publicação.

**Quality Gate Tasks:** Pre-Commit (`@dev`): lint, typecheck, testes, build e revisão; Pre-PR (`@devops`): compatibilidade se houver PR; Pre-Deployment (`@devops`): Vault, configuração BlobCRM e rollback quando houver deploy.

**Self-Healing Configuration:** `@dev` light (2 iterações/15 min; CRITICAL corrigir, HIGH documentar); `@qa` full (3 iterações/30 min; CRITICAL/HIGH corrigir); `@devops` check/report only.

**CodeRabbit Focus Areas:** valor único e validação transacional; status sem regressão; cadeia de vínculos e automação sem duplicação; permissão dos anexos; BlobCRM privado e retry seguro; DEFERIDO separado.

## Checklist de conclusão

- [ ] AC 1–11 verificados em produção; validação autenticada depende da publicação. NAS/QNAP fica para story futura.
- [x] Vault aplicado antes da escrita configuracional: backup completo verificado e autorização específica; versões publicadas Radar 19 e Financeiro 6.
- [x] Lint (0 erros, 1191 avisos existentes), typecheck, testes (545 arquivos, 4004 casos aprovados) e build passaram. QA APPROVED no escopo revisado. Homologação autenticada depende de publicação.
- [x] File List e Change Log atualizados.

## File List

- `docs/stories/story-alpha-crm-revisao-radar-fechado.md` — esta story.
- `src/lib/bpm/transicao-command.ts`, `src/actions/bpm/Cards.ts`, `src/lib/bpm/status-pos-fechamento.ts` — guard de entrada, status inicial e resumo vinculado.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`, `PainelResumoContratacao.tsx`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/lib/bpm/resultado-operacional.ts` — estado comercial, Financeiro e DEFERIDO.
- `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/resumo-contratacao-server.ts`, `src/lib/bpm/financeiro-assinatura-server.ts`, `src/actions/bpm/Anexos.ts` — mapeamento, resumo, arquivo privado e proteção da evidência.
- `scripts/configurar-fechado-radar.mts` — prévia e aplicação protegida de formulários, campos e mapeamentos; ainda não aplicada.
- `tests/bpm/fechado-status-pos-fechamento.test.ts`, `fechado-ui.test.ts`, `financeiro-operacional-handoff.test.ts`, `resultado-operacional.test.ts` — regressão.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Draft da etapa Fechado, integração Financeiro e pendências NAS/DEFERIDO. | River (`@sm`) |
| 2026-09-28 | 0.2 | DEFERIDO definido pela etapa Operacional vinculada; arquivamento inicial limitado ao BlobCRM privado. | River (`@sm`) |
| 2026-09-28 | 0.3 | Implementação e prévia: guard Fechado, status, mapeamento canônico Financeiro, resumo, Blob e DEFERIDO. Aguarda Vault/publicação. | Dex (`@dev`) |
| 2026-09-28 | 0.4 | QA aprovou correções; backup Turso validado, 332 tabelas e 184.038 linhas. Publicação continua bloqueada até confirmação específica. | Quinn (`@qa`) / Vault |
| 2026-09-28 | 0.5 | Publicação configuracional autorizada e aplicada; verificados formulários, quatro campos, dois mapeamentos e versões 19/6. | Dex (`@dev`) |
| 2026-10-16 | 0.6 | Reabertura por pedido explícito: valor/forma no formulário atual de Em tratativa e nome do usuário efetivo no vendedor automático, preservando IDs e guard de Fechado. | @architect / @sm |
| 2026-10-16 | 0.7 | Implementação nominal/readonly, guard de leitura do destino e CLI configuracional com testes; plano/Vault/backup preparados, banco e publicação pendentes. | @dev / Scribe / Kowalski |

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Etapa, valor e integrações definidos. |
| Technical Implementation Guidance | PASS | Fonte Operacional e armazenamento BlobCRM definidos; NAS futuro excluído. |
| Reference Effectiveness | PASS | Stories de status, Financeiro e assinatura resumidas. |
| Self-Containment Assessment | PASS | Fonte de deferimento, armazenamento e limite NAS explícitos. |
| Testing Guidance | PASS | Casos locais, integração e homologação descritos. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY para implementação; NAS/QNAP permanece fora desta story até configuração futura.

## Reabertura de 16/10/2026 — preencher em Em tratativa antes de Fechado

### Pedido confirmado e precedência

O usuário confirmou que **Valor acordado no contrato** e **Forma de pagamento** devem ser preenchidos na aba de campos/formulário do card em **Em tratativa**, antes de avançar para **Fechado**. A obrigatoriedade de entrada em Fechado está correta e deve ser preservada. O campo **Vendedor responsável · automático** deve apresentar o nome da pessoa vinculada, preservando o ID usado pelo domínio.

Esta seção prevalece sobre estados e pendências históricos da story onde houver conflito. Não amplia o escopo para refazer Financeiro, Reunião Agendada, permissões do CRM ou o fluxo genérico de transições. O usuário escolheu o formulário da etapa atual; não será acrescentada uma nova ação genérica de preenchimento em `PainelProximaEtapa` nesta correção.

### Diagnóstico verificado antes do código

O inventário somente leitura recebido do fluxo principal confirma que os dois campos `alpha.radar.viabilidade.valor_acordado` e `alpha.radar.viabilidade.forma_pagamento` existem e estão ativos. Ambos possuem configuração visível/editável, obrigação de entrada e componentes CAMPO no formulário ativo de Fechado; também estão publicados em Reunião Agendada. Em tratativa não possui configuração nem componente desses dois campos. Logo, não se trata de ausência de configuração em Fechado: falta a montagem dos mesmos campos na etapa em que o usuário precisa preenchê-los.

O formulário atual respeita a configuração canônica: `BpmCampoEtapaConfig` determina aplicabilidade e `BpmEtapaFormulario` determina composição. `PainelCamposEtapaAtual` renderiza somente IDs recebidos da composição e presentes em `card.camposEtapa`. O guard de transição cobra a entrada em Fechado com os valores compartilhados. O botão de avanço fica indisponível quando há pendência, e o diálogo genérico de requisitos não possui ação alternativa para Fechado bloqueado; a correção escolhida é disponibilizar os campos em Em tratativa, sem remover o bloqueio nem adicionar atalhos de movimento.

O vendedor atual é um campo de tipo `usuario`, escopo GLOBAL, fonte `CARD.responsavelId`, com flags globais `editavel=true` e `somenteLeitura=false`, sem mapeamento de destino. O carregador canônico retorna o ID e o input genérico de usuário o apresenta como número. O input já apresenta referências de seleção/multisseleção vinculadas como texto somente leitura, independentemente dessas flags; o usuário vinculado escapou desse tratamento visual de fonte automática. Converter o valor em nome quebraria a validação e os mapeamentos: nomes devem ser metadados de apresentação. Overrides persistidos continuam possíveis pelas regras existentes, e resolver sempre o nome do responsável atual poderia apresentar uma pessoa diferente do ID efetivamente usado.

### Critérios adicionais de aceite — vigentes em 16/10

12. Em tratativa apresenta os **mesmos dois BpmCampo existentes** na aba **Formulário da Etapa** do card e no editor **Campos e formulários**. Acrescentar duas configurações de aplicabilidade e dois componentes na seção existente `dados_financeiro`, grupo **Dados para o Financeiro**, componentes nas ordens 16 e 17 após os 16 atuais de ordem 0–15; configurações de aplicabilidade nas ordens 116 e 117 após as atuais 100–115. Preservar os outros campos, capabilities, identidade e ordem relativa dos elementos existentes; não criar uma seção nova.
13. Nessa etapa os dois campos são opcionais: não criar obrigação na entrada, na saída ou durante a permanência em Em tratativa. A configuração de Fechado continua exigindo ambos na entrada e validando moeda/seleção conforme as opções publicadas. Não alterar a configuração de Reunião Agendada nem os mapeamentos do Financeiro.
14. O valor preenchido em Em tratativa persiste no mesmo armazenamento por card/campo e reaparece em Fechado, Reunião Agendada e integrações que já usam essa identidade. Não criar campos duplicados, cópias paralelas, valores globais novos ou backfill de respostas reais.
15. Usuários autorizados editam e salvam os dois campos pelo editor/autosave já existente. Após confirmação do save, a disponibilidade de Fechado se atualiza. Ausência ou formato inválido continua impedindo o movimento pelo card, drag e action direta, sem side effects financeiros ou movimentação parcial.
16. O vendedor vinculado apresenta o **nome correspondente ao ID efetivo**, incluindo override permitido. O DTO mantém `valor` com ID e pode acrescentar `valorExibicao` opcional somente para apresentação. Não persistir nomes no lugar de IDs e não alterar chave, fonte, tipo, obrigação, permissões, responsável ou membros do card.
17. O campo de usuário vinculado a fonte automática usa o mesmo tratamento visual já existente para seleção/multisseleção vinculadas: nome em controle textual somente leitura, sem mostrar o ID como conteúdo principal nem oferecer edição direta da referência automática na UI. As flags, fontes, valores persistidos e regras de edição/override do backend permanecem inalterados, incluindo a preservação de override anterior. Campos de usuário manuais/legados **sem fonte** mantêm seu editor de ID e payload existentes. Não criar seletor ou catálogo novo de usuários e não converter nomes em IDs por inferência.
18. Referência sem usuário resolvido não inventa pessoa nem devolve o ID como se fosse nome. Usar indicação neutra de usuário indisponível, preservando o valor canônico para diagnóstico e domínio. Não expor credenciais ou dados pessoais adicionais no DTO; selecionar somente ID e nome para os rótulos.
19. Resolver nomes em lote pelos IDs efetivos únicos; evitar consulta por campo/usuário ou requisição do navegador por nome. A mudança na pessoa responsável e a atualização do valor efetivo devem refletir no nome após a recarga/reconciliação normal, sem persistência auxiliar.
20. Toda gravação configuracional segue o gate Vault desta story e do `AGENTS.md`: inventário, plano concreto, impacto/risco, alternativa não destrutiva, rollback, backup completo válido de até 48 horas e confirmação específica antes da execução. O “sim” para preencher na aba é uma decisão de produto, não confirmação de execução remota. Não há schema/migration nesta correção.
21. Testar dois campos opcionais em Em tratativa, persistência compartilhada e obrigação de entrada em Fechado intacta; nome do ID efetivo, override diferente do responsável, referência ausente, readonly, edição legada e payload ID. Executar lint, typecheck, testes e build; registrar baseline e limitações, sem declarar banco configurado ou aplicação publicada sem evidência.

### Decisão arquitetural — @architect, antes da implementação

1. **Aplicabilidade/composição reais:** preparar alteração configuracional mínima de `BpmCampoEtapaConfig` e `BpmFormularioComponente` para Em tratativa: duas configurações e dois componentes na seção existente `dados_financeiro`, grupo Dados para o Financeiro, componentes nas ordens 16/17 e configurações nas ordens 116/117 (inventário remoto confirmou configurações atuais 100–115). Não acrescentar seção. Os dois campos já existem; não mudar o renderer para acrescentá-los por nome/chave fora do formulário. Preservar configurações existentes e usar versão esperada/CAS e auditoria de publicação para evitar sobrescrever edição concorrente.
2. **Valor e apresentação separados:** acrescentar `valorExibicao?: string | null` ao DTO `CampoAplicavelEtapaBpm` e ao contrato de campo recebido por `CampoBpmInput`. Preencher esse metadado no servidor depois de resolver o valor efetivo e os overrides; `valor`, normalização, validação, dirty checking e payloads de save continuam representando o ID.
3. **Resolução nominal:** identificar os campos elegíveis pelo descritor real (`tipo: usuario`, GLOBAL, fonte CARD e atributo de referência a usuário `responsavelId`), sem depender de nomes como “Vendedor” nem da chave de um pipeline. Resolver somente IDs efetivos dos campos já autorizados para a leitura do card; consulta em lote `usuarios.findMany`, com `select: {id,nome}`, nunca catálogo global de usuários. Reutilizar relação do responsável somente se corresponder ao ID efetivo. Resolução de apresentação não concede acesso novo ou elegibilidade para assumir o card.
4. **Referência automática somente leitura na UI:** estender ao usuário vinculado o padrão existente de apresentação textual readonly das seleções vinculadas. A fonte automática é resolvida no servidor; a interface apresenta o nome separado do ID, sem editor direto dessa referência. Essa decisão visual foi explicitada após confirmar que as flags globais atuais permitem edição/override; não modificar essas flags ou as regras/payloads do backend e preservar overrides já existentes. Não substituir o input numérico dos usuários manuais/legados sem fonte, nem criar seletor ou endpoints de busca de pessoas.
5. **Sem expansão de transição:** preservar `transicao-command.ts`, `SalvarRequisitosEMoverCardBpm`, drag e bloqueio de `PainelProximaEtapa`; esta entrega usa o formulário de origem para satisfazer os requisitos já publicados no destino. Não enfraquecer o guard ou criar exceção específica para Fechado.
6. **Fronteira operacional:** código e fixtures podem ser preparados/validados antes da aprovação de banco. O plano configuracional é um artefato revisável separado; sua aplicação remota permanece bloqueada até o gate Vault e a confirmação específica. Não executar scripts históricos como `configurar-fechado-radar.mts`: eles representam outro estado/versões e recriam configuração de Fechado/Financeiro fora desta mudança.

### Blueprint de integração

#### CRIAR SOMENTE SE NECESSÁRIO

- [x] Script/plano configuracional próprio com preview, fingerprint, CAS, auditoria e rollback condicionado; relatório Vault privado e backup verificado preparados. Aplicação remota pendente.
- [x] Apresentação nominal coberta nos testes existentes de relacionamento/requisitos; helper de referência de usuário compartilhado e testes de visibilidade do destino adicionados.

#### EDITAR

- [x] `src/lib/bpm/requisitos-etapa-server.ts` — DTO opcional de apresentação e resolução nominal em lote depois do cálculo do ID efetivo.
- [x] `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` — referência automática de usuário em texto readonly como as seleções vinculadas, mantendo ID no estado/payload e edição de usuários legados sem fonte.
- [x] `tests/bpm/requisitos-etapa-server.test.ts` e `relacionamento-ui.test.ts` — ID/nome separados, override, referência ausente, readonly e preservação da edição legada; `campos-globais-cliente.test.ts` preservado.
- [x] `tests/bpm/contratacao-em-tratativa-config.test.ts` cobre aplicabilidade/composição de origem opcionais e obrigação de Fechado preservada em banco descartável; `requisitos-transicao-destino-visibilidade.test.ts` cobre bloqueio de leitura do destino. Testes/fluxos existentes preservados; homologação remota pendente.
- [x] `docs/stories/story-alpha-crm-revisao-radar-fechado.md` — pedido, diagnóstico, arquitetura, aceite e gate registrados antes do código.

#### CONSULTAR; NÃO ALTERAR SEM NECESSIDADE DEMONSTRADA

- [ ] `src/lib/bpm/{campos-configuraveis-server,campos-configuraveis,campos-dinamicos,formulario-renderer,campos-formulario-publicado,transicao-command}.ts` — valor canônico, tipo usuário, composição e guard.
- [ ] `src/actions/bpm/{Cards,Campos,FormulariosEtapa}.ts` — detalhe/autosave, acesso, publicação e auditoria existentes.
- [ ] `src/app/PainelAlpha/AlphaCRM/CardModal/{PainelCamposEtapaAtual,FormularioEtapaRenderer,CardOpenFormSlot,PainelProximaEtapa}.tsx` — passagem do DTO ao input, montagem da etapa atual e disponibilidade após save.
- [ ] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` — edição canônica de aplicabilidade/composição já existente.
- [x] Menu `src/lib/modulos-registry.ts`, rota atual do pipeline, `middleware.ts`, `auth.ts` e `src/lib/bpm/ownership.ts` — fluxo existente; não há novo módulo, rota, atalho ou permissão nesta correção. Nenhum arquivo de shortcuts ou types global exige registro novo; o DTO é definido no próprio domínio.
- [x] `.bibble/memory/{codebase-map,integration-points,decisions,journal}.md` — consolidação da implementação e evidências, sem copiar dados privados.

### Checklist da reabertura de 16/10

- [x] Confirmar escolha do usuário pelo formulário de Em tratativa, preservando obrigatoriedade de Fechado.
- [x] Registrar inventário somente leitura e causa de apresentação do vendedor.
- [x] Definir contrato de valor/label e preservação das permissões efetivas.
- [x] Implementar resolução nominal e apresentação com regressões.
- [x] Preparar plano configuracional reversível e relatório Vault; validar backup completo.
- [x] Obter confirmação específica do plano configuracional antes da escrita: usuário respondeu “sim, autorizo” após relatório e backup verificado.
- [x] Aplicar somente configuração autorizada e validar os dois campos compartilhados/opcionais na origem: pipeline v32, formulário v3; quatro inserções e auditoria verificadas, Fechado preservado.
- [x] Validar em fixtures a configuração opcional de origem/obrigação de destino preservada, ID/override e leitura autorizada do destino; nenhuma reimplementação da integração financeira.
- [ ] Homologar persistência/fluxo autenticado após eventual aplicação autorizada.
- [x] Executar gates e revisão no escopo; registrar seis falhas preexistentes da suíte global e limites de browser/publicação/banco.
- [x] Atualizar file list efetiva, memórias e status do checkpoint conforme resultados reais.

### File list efetiva da implementação de 16/10

- `docs/stories/story-alpha-crm-revisao-radar-fechado.md`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/lib/bpm/referencia-usuario-campo.ts`
- `src/lib/bpm/contratacao-em-tratativa-config.ts`
- `scripts/configurar-contratacao-em-tratativa.mts`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `tests/bpm/relacionamento-ui.test.ts`
- `tests/bpm/contratacao-em-tratativa-config.test.ts`
- `tests/bpm/requisitos-transicao-destino-visibilidade.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/journal.md`

### Validação da preparação — @sm

READY para implementação local do código e preparação do plano configuracional. Objetivo, precedência, escopo, contrato, integração, cenários de teste e gate de banco estão explícitos. A seção CodeRabbit existente permanece aplicável, com foco adicional em ID/rótulo separados, resolução em lote, source-of-truth de campos e obrigação de destino preservada. Aplicação remota da configuração continua pendente e não está autorizada por esta classificação da story.


### Checkpoint de implementação e evidências — 16/10, Scribe/Kowalski

- `valorExibicao` é metadado separado de `valor`: o ID efetivo/override é resolvido antes de buscar nomes em lote, somente `{ id, nome }`. Referência automática `usuario/GLOBAL/CARD/responsavelId` apresenta texto readonly, sem alterar flags/backend/payload; legado sem fonte mantém edição de ID e referência ausente usa indicação neutra.
- `ObterRequisitosTransicaoBpm` agora exige visibilidade da etapa de destino antes de carregar campos/referências para não administradores. O guard de entrada em Fechado permanece intacto.
- CLI `scripts/configurar-contratacao-em-tratativa.mts` prepara quatro inserções: duas configurações opcionais (116/117) e dois componentes (16/17) na seção existente `dados_financeiro`; pipeline 31→32 e formulário 2→3. Preview/fingerprint, CAS, auditoria na transação e rollback condicionado preservam conteúdo concorrente. Não cria campo, seção, schema ou migration; não altera Fechado/Financeiro/Reunião Agendada nem valores reais.
- Vault privado: `/tmp/crm-fechado-preflight/vault-report.md`, `.json` e `vault-backup-verification.json`. Backup completo verificado: 337 tabelas, 271590 linhas, 347346721 bytes, integridade/FK/hash conferidos. Backup preparado não é consentimento: aplicação remota ainda não executada e exige confirmação específica do plano.
- Lint: exit 0, zero erros/1193 warnings. Typecheck inicial revelou incompatibilidade de literal no helper configuracional, corrigida; tsc subsequente passou e o fluxo principal repetirá o gate final. `npm test`: 632 arquivos aprovados/4 falhos, 4738 testes aprovados/6 falhos/4 skipped/1 todo; mesmas quatro suites falhas do baseline: import `next/server` em arquivamento-modal-react, Builder/embed (3), card-modal-integration (1), em-tratativa (2). Não há aprovação global dos testes.
- Build de produção concluído (exit 0); Probe/Anubis sem bloqueios e Lens sem bloqueios novos após Forge. Nove arquivos direcionados passaram, 126 testes. Typecheck anterior ao build passou; duas repetições extras pós-build foram interrompidas com exit 143 (Terminated), sem diagnóstico TypeScript; não declaradas aprovadas. Banco não aplicado, código não publicado e browser autenticado não executado. AC de operação real permanecem abertos; resultados históricos desta story não substituem essas evidências.

### Aplicação configuracional autorizada — 16/10/2026

- Confirmação explícita recebida após apresentação do plano Vault e backup completo verificado; fingerprint `3a2f1841b7a73b7c18733c9f8d148833441cf5a296a5c2161e7a8ccffd0b686f`. Artefatos de código e plano revalidados; preview imediatamente anterior permaneceu idêntico.
- Aplicação transacional concluída: duas configurações opcionais (ordens 116/117), dois componentes (16/17) na seção existente, pipeline 31→32, formulário 2→3 e auditoria administrativa. Verificações de preservação dos cards/valores/histórico e configurações anteriores passaram dentro da transação.
- `--verify` confirmou recibo/auditoria, versões e apenas as alterações previstas. Consulta independente confirmou dois campos visíveis/editáveis e opcionais em Em tratativa, dois componentes corretos e obrigatoriedade de entrada em Fechado preservada.
- Evidências privadas: `/tmp/crm-fechado-preflight/{database-authorization.json,contratacao-receipt.json,contratacao-verification.json,semantic-verification.json}`; backup pre-change preservado. Nenhuma migration ou backfill.
- Código do vendedor ainda não publicado; browser autenticado não executado. Recarregar card/editor para refletir a configuração. Não houve commit, push ou deploy nesta aplicação de banco.

### Gate de publicação — Virtus, 16/10/2026

Usuário instruiu explicitamente “publiq” após a entrega concreta e aplicação autorizada do banco. Publicação limitada aos 15 arquivos da file list acima, destino `origin/main`, commit proposto `fix(crm): corrigir contratacao e vendedor no formulario`. Revalidação final de TypeScript pós-build passou (exit 0); smoke do runtime compilado passou 22/22, incluindo assets e proteção das rotas sem sessão. Reutilizadas evidências de lint/build/testes do mesmo código e revisão sem bloqueios novos; suíte global conserva seis falhas anteriores. Nenhuma dependência/lockfile alterada. Banco já aplicado não será executado pelo deploy. Plano de rollback do código: deployment anterior saudável, sem reverter configuração ou valores do banco. Commit/push/deploy explicitamente autorizados pelo pedido atual, monitoramento da versão, assets e logs de produção pendentes.
