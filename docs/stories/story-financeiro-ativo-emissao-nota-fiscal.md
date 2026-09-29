# Story — Financeiro ativo: Emissão da Nota Fiscal

## Status

Publicada no Financeiro ativo v17; smoke autenticado com card apropriado pendente.

## Executor Assignment

`executor: @dev` · `quality_gate: @qa` · `quality_gate_tools: [npm run lint, npm run typecheck, npm test, npm run build, prévia e leitura da configuração publicada]`

## Story

**Como** integrante do Financeiro, **quero** registrar e consultar a Nota Fiscal vinculada ao card e ao cliente, **para** encerrar a tarefa de emissão quando a NF estiver válida sem confundir seu estado com a assinatura ou o pagamento da contratação.

**Escopo:** etapa `Emissão da Nota Fiscal` (`emissao_nota_fiscal`) do pipeline Financeiro ativo (`cmuih4i54000209gmmyqrg557`). A etapa sucede `Confirmação de Pagamento`. A story de pagamento publicou o Financeiro v12 em 2026-09-29; outras publicações avançaram a versão até v16 durante esta preparação. A versão corrente deve ser lida novamente antes de qualquer alteração. Os campos, opções, obrigatoriedades, condições e composição do formulário desta etapa devem ser configuráveis em **Configurações → Campos e Formulários**. As automações devem ser visíveis e editáveis na UI administrativa e aplicadas pelo servidor conforme a versão publicada.

## Campos

| Campo | Comportamento requerido |
| --- | --- |
| NF emitida | Indicador `Sim/Não`, independente de contrato assinado e pagamento confirmado. |
| Número da NF | Número preenchido quando `NF emitida = Sim`. |
| Data de emissão | Data válida, obrigatória quando `NF emitida = Sim`; conservar a data informada da emissão. |
| Valor da NF | Valor monetário maior que zero quando `NF emitida = Sim`. |
| Arquivo/link da NF | Referência acessível à NF, obrigatória quando `NF emitida = Sim`; associada ao card e consultável pelo cliente vinculado. |

## Critérios de aceite

1. [ ] O formulário publicado na etapa mostra os cinco campos acima com identidades canônicas únicas. Campos já existentes de NF são reutilizados sem perder dados históricos; `Valor da NF` é acrescentado se ainda não existir. Definições, obrigatoriedades condicionais e formulário são editáveis em **Configurações → Campos e Formulários**, e a versão publicada governa a validação no servidor.
2. [ ] `NF emitida = Sim` exige Número da NF, Data de emissão, Valor da NF e Arquivo/link da NF. Número vazio ou composto apenas de espaços, data inexistente/inválida, valor não numérico ou `<= 0`, ou referência ausente/inacessível impedem a confirmação e apresentam pendências nominais. `NF emitida = Não` não exige esses quatro campos para o registro do estado pendente.
3. [ ] A validação da referência distingue anexo privado do card e link externo. Um anexo deve existir, pertencer ao próprio card e ser consultável pelo fluxo autenticado; um link deve ter formato permitido e ser acessível conforme a política do produto. A UI permite abrir a referência com autorização adequada. Uma string arbitrária ou arquivo de outro card não satisfaz a exigência.
4. [ ] A confirmação de pagamento válida cria uma única tarefa de emissão para o card com a razão social: `Emitir NF – [Razão Social]`. A automação de pagamento já publicada usa o título `Emitir Nota Fiscal – [Razão Social]`; ambos representam a mesma tarefa lógica. Reutilizar a identidade/idempotência existente, ajustando a apresentação sem criar tarefa paralela nem duplicar em reprocessamento. A criação independe de assinatura prévia.
5. [ ] Enquanto `NF emitida = Não` ou a confirmação válida estiver pendente, a tarefa de emissão continua aberta. Salvar ou movimentar o card sem NF validada não encerra a tarefa.
6. [ ] Na primeira transição válida para `NF emitida = Sim`, registrar a data de emissão informada, encerrar automaticamente a tarefa de emissão correspondente e vincular o arquivo/link ao card e ao cliente. Repetir salvamento ou automação não duplica a vinculação nem recria/encerra tarefas alheias.
7. [ ] A NF emitida e sua referência aparecem no histórico do card e permanecem consultáveis após avanço de etapa. Alterações ou correções posteriores preservam trilha de auditoria de quem, quando e o que mudou; a referência histórica não é substituída silenciosamente.
8. [ ] O estado da NF é independente do estado de assinatura. Emitir NF não altera `Contrato assinado`, `Pagamento confirmado` ou o status geral por si só. A conclusão da contratação continua condicionada aos requisitos de contrato e pagamento válidos e às transições publicadas; `NF emitida = Sim` não contorna pendências financeiras ou de assinatura.
9. [ ] Tentativas de salvar, confirmar ou avançar com NF inválida retornam erros acionáveis, sem marcar emissão, fechar tarefa ou criar histórico de conclusão. O fluxo mantém os dados já válidos do card e do cliente.

## Tarefas / checklist

- [x] Inventariar a configuração publicada da etapa e os campos de NF existentes, incluindo formulários, regras, automações e tarefas; verificar versão e identidades atuais antes de propor publicação (AC 1, 4).
- [x] Publicar por script transacional os cinco campos e a obrigatoriedade condicional em **Campos e Formulários**, além de novas versões das quatro automações de pagamento, preservando o tipo/idempotência da tarefa (AC 1–4).
- [x] Validar os dados de NF no servidor ao salvar e ao avançar, incluindo data real, valor monetário `> 0`, referência do próprio card e acesso autorizado (AC 2, 3, 9).
- [x] Conectar o ciclo da tarefa existente ao estado da NF; fechar após confirmação válida e reabrir se a emissão for revertida (AC 4–6).
- [x] Registrar referência, vínculo cliente/card e evento no histórico; preservar histórico e idempotência em salvamentos repetidos (AC 6, 7).
- [x] Conferir independência entre NF, assinatura e pagamento e proteção da conclusão da contratação (AC 8, 9).
- [x] Cobrir a validação e a reconciliação com testes automatizados; executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (AC 1–9). Smoke autenticado com card apropriado pendente de publicação.
- [x] Antes de alterar configuração, dados ou estrutura no banco: acionar Vault; apresentar ambiente, comandos, impacto, riscos, alternativa não destrutiva e rollback; verificar backup completo de até 48 horas em `database-backups/pre-change/`; obter autorização explícita específica para esta publicação; ler e conferir a configuração após publicar. A autorização dada para Pagamento v11→v12 não cobria esta mudança (AC 1–9).
- [x] Atualizar checklist, File List e evidências dos testes locais e da versão publicada. Smoke autenticado permanece pendente por ausência de card na etapa.

## Dev Notes

- `docs/stories/story-financeiro-ativo-confirmacao-pagamento.md#critérios-de-aceite`: o pagamento válido gera tarefa de NF idempotente, inclusive sem assinatura prévia; assinatura e pagamento continuam independentes. A publicação anterior não confirma que a configuração de NF desta story esteja ativa.
- `docs/stories/story-financeiro-ativo-formalizacao.md#critérios-de-aceite`: assinatura e pagamento podem ocorrer em qualquer ordem; a conclusão exige ambos.
- `docs/stories/story-alpha-crm-conclusao-financeiro-handoff-operacional.md#critérios-de-aceite`: o card concluído deve permitir consultar NF emitida e número/link sem fonte divergente.
- `src/lib/bpm/financeiro-nota-fiscal.ts` já resolve quatro campos por chave (`alpha.nf.emitida`, `alpha.data.de.emissao`, `alpha.numero.da.nf`, `alpha.arquivo.link.da.nf`) e valida formato básico de data e link. Falta inventariar o campo de valor e verificar persistência, acesso real, tarefa e histórico no fluxo ativo. `tests/bpm/financeiro-nota-fiscal.test.ts` cobre a função existente.
- Inspecionar `src/lib/bpm/validacao-salvamento-configurado.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/automacoes/idempotencia-tarefa.ts`, `src/actions/bpm/Anexos.ts` e o formulário da etapa para conectar regras publicadas. Confirmar caminhos e contrato de dados antes de editar.
- `[AUTO-DECISION]` O texto curto `Emitir NF` pedido agora é tratado como nome exibido da mesma tarefa criada pelo pagamento; identidade e deduplicação prevalecem sobre diferença textual. O usuário não pediu segunda tarefa.
- `[AUTO-DECISION]` Acessibilidade de link externo deve seguir uma política do produto a localizar durante o inventário; não presumir que um URL HTTPS sintaticamente válido prove que o documento existe, nem emitir requisições arbitrárias do servidor sem salvaguardas.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. A coerência entre stories foi conferida nas stories adjacentes e nos pontos atuais do código, sem atribuir conteúdo aos arquivos ausentes.

## Testes de aceite

1. Confirmar NF com número, data real, valor positivo e anexo do próprio card: tarefa única fecha, vínculo e evento aparecem no histórico; salvar novamente não duplica.
2. Para `NF emitida = Sim`, omitir cada campo, informar espaços no número, data impossível, valor zero/negativo/não numérico, link inválido ou anexo de outro card: bloquear com pendência específica e tarefa aberta.
3. Manter `NF emitida = Não`: tarefa de emissão aberta sem exigir os quatro campos condicionais; não registrar conclusão da NF.
4. Confirmar pagamento antes da assinatura: tarefa de NF surge uma única vez; emitir NF não altera contrato nem conclui a contratação enquanto a assinatura estiver pendente.
5. Conferir leitura autenticada de arquivo/link e histórico após avanço; conferir que edição da regra em **Campos e Formulários** afeta a validação publicada no servidor.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** integração de regra configurável, formulário, automação e histórico; complexidade média/alta por acesso a arquivo e idempotência.
- **Specialized Agents:** `@dev` implementa; `@qa` revisa testes; `@ux-design-expert` revisa formulário/acessibilidade; Vault conduz checkpoint de banco; `@github-devops` responde por PR/publicação autorizada.
- **Quality Gates:** pre-commit (`@dev`): lint, typecheck, testes, build e revisão; pré-PR (`@github-devops`): CodeRabbit e compatibilidade da configuração; pré-publicação (`@github-devops`/Vault): prévia, backup, autorização, rollback e leitura posterior.
- **Self-Healing (Story 6.3.3):** `@dev` light (até 2 iterações/15 min; corrigir CRITICAL, registrar HIGH); `@qa` full (até 3 iterações/30 min; corrigir CRITICAL/HIGH); `@github-devops` check (somente relatório). MEDIUM vira débito documentado; LOW é informativo.
- **Focus Areas:** obrigatoriedade condicional, data/valor, autorização de anexos, segurança de links, tarefa única, histórico, independência dos estados e não regressão do pagamento.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-ativo-emissao-nota-fiscal.md` — story, checklist e evidências.
- `docs/reports/vault-financeiro-ativo-emissao-nf-2026-09-29.md` — relatório Vault e plano de publicação.
- `scripts/configurar-emissao-nf-financeiro-ativo.mts` — prévia e publicação guardada por versão, backup e consentimento.
- `scripts/verificar-emissao-nf-financeiro-ativo.mts` — leitura independente da configuração publicada.
- `src/lib/bpm/financeiro-config.client.ts`, `src/lib/bpm/financeiro-nota-fiscal.ts`, `src/lib/bpm/financeiro-nota-fiscal-server.ts`, `src/lib/bpm/nota-fiscal-link.ts`, `src/lib/bpm/validacao-salvamento-configurado.ts` — chaves, validação, acessibilidade do link, histórico e reconciliação da tarefa.
- `src/actions/bpm/Cards.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/automacoes/central-runtime.ts`, `src/actions/bpm/NotaFiscal.ts`, `src/actions/bpm/Tarefas.ts`, `src/actions/bpm/Anexos.ts` — integração de salvamento, automação, tarefa e anexo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelNotaFiscalConcluida.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `src/lib/bpm/timeline.ts`, `src/lib/bpm/historico-descricao.ts`, `src/lib/bpm/resumo-contratacao-server.ts` — leitura/edição e histórico da NF.
- `tests/bpm/financeiro-nota-fiscal.test.ts`, `tests/bpm/financeiro-nota-fiscal-server.test.ts`, `tests/bpm/nota-fiscal-link.test.ts` — testes automatizados.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da emissão da NF no Financeiro ativo | River (@sm) |
| 2026-09-29 | 0.2 | Implementação local, prévia da configuração, testes e checkpoint Vault pendente de autorização | Codex (@dev) |
| 2026-09-29 | 0.3 | Publicação autorizada v16→v17 e leitura independente da configuração | Codex (@dev) |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS** para iniciar inventário; referências **PASS**; autossuficiência **PASS** com política de link explicitamente pendente de inventário; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para inventário e desenvolvimento local.** A publicação permanece condicionada ao checkpoint Vault e à autorização específica.

## QA Results

Testes locais: `npm run lint` passou com zero erros (1.191 warnings preexistentes); `npm run typecheck` passou após o build; `npm test` passou (558 arquivos, 4.094 testes aprovados, 4 ignorados e 1 todo); `npm run build` passou com avisos conhecidos de `pdfjs-polyfill`; testes focados da NF passaram (3 arquivos, 9 testes); `git diff --check` passou. Prévia v16→v17 passou em modo somente leitura; o backup dedicado foi restaurado e verificado em SQLite isolado. A transação autorizada publicou a v17; leitura independente conferiu cinco campos, formulário v3, cinco requisitos e quatro automações v2. QA funcional autenticado em card real permanece pendente porque a etapa tinha zero cards, e esta verificação não criou ou moveu card de produção.
