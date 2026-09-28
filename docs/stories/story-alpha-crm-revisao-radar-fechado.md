# Story: Revisão de Radar — Fechado, contratação e arquivamento

## Status

Configuração publicada no Turso — Revisão de Radar versão 19 e Financeiro versão 6; código local ainda aguarda publicação da aplicação e homologação autenticada. NAS/QNAP fica para configuração futura.

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
