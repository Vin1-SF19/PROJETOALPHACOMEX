# Story — Financeiro ativo: Confirmação de Pagamento

## Status

Ready for Review — configuração v12 publicada e conferida no Turso; smoke autenticado com card real pendente.

## Executor Assignment

`executor: @dev` · `quality_gate: @qa` · `quality_gate_tools: [npm run lint, npm run typecheck, npm test, npm run build, ensaio e leitura da configuração publicada]`

## Story

**Como** integrante do Financeiro, **quero** conferir e confirmar o pagamento recebido, acompanhar a assinatura em paralelo e tratar divergências, **para** iniciar a nota fiscal no momento correto e concluir a contratação somente quando os dois requisitos estiverem satisfeitos.

**Escopo:** etapa `Confirmação de Pagamento` (`confirmacao_pagamento`) do pipeline Financeiro **ativo** (`cmuih4i54000209gmmyqrg557`), após `Formalização` e antes de `Emissão da Nota Fiscal`. A story histórica `story-financeiro-confirmacao-pagamento.md` registra publicação no Financeiro v44 de uma configuração anterior. Essa publicação não prova que os sete campos, regras ou automações estão ativos no pipeline atual. Inventariar a configuração corrente antes de escolher IDs, versões ou plano de publicação. A Formalização atual permite assinatura e pagamento em qualquer ordem e já introduziu o indicador de pagamento compartilhado.

## Campos

| Campo | Comportamento requerido |
| --- | --- |
| Pagamento confirmado | Select `Sim/Não`; `Sim` somente após validação efetiva. Reutilizar o indicador compartilhado pela Formalização. |
| Data do pagamento | Obrigatória para `Sim`; registrar a data/hora da primeira confirmação válida se ainda não informada. |
| Valor esperado | Derivado do valor líquido calculado, quando houver retenções; não inferir do valor bruto se o líquido válido existir. |
| Valor recebido | Obrigatório para `Sim`; guardar o valor efetivamente recebido. |
| Forma de pagamento utilizada | Obrigatória para `Sim`; distinta da forma negociada, preservando ambas. |
| Comprovante | Referência autenticada ao anexo do próprio card, obrigatória quando a forma/processo configurado exigir prova manual. |
| Status financeiro | `Aguardando pagamento`, `PAGAMENTO CONCLUÍDO` ou estado de divergência/vencimento compatível com a configuração e o evento real. |

Os campos, opções, condições, obrigatoriedades e composição do formulário devem estar disponíveis para edição em **Configurações → Campos e Formulários**. As automações devem aparecer na UI administrativa como versões ativas, com gatilhos, condições e ações editáveis. Um status calculado pode ser somente leitura no card, mesmo com definição editável no admin.

## Critérios de aceite

1. [ ] O formulário publicado no Financeiro ativo mostra os sete campos e usa identidades canônicas únicas. Reutiliza o indicador `Pagamento confirmado` já compartilhado com a Formalização; valores existentes permanecem legíveis. Configurações de campos, regras e formulário são editáveis na UI, e o servidor aplica a versão publicada.
2. [ ] `Pagamento confirmado = Sim` exige `Data do pagamento`, `Valor recebido` e `Forma de pagamento utilizada`. Se a data não for informada, registrar automaticamente data/hora na primeira confirmação válida. A ausência de valor, forma ou outro requisito aplicável bloqueia a confirmação com pendências nominais; mover o card por si só não confirma pagamento.
3. [ ] `Valor esperado` reflete o líquido calculado no Novo Contrato quando há retenções e usa uma fonte verificável na ausência delas. `Valor esperado` e `Valor recebido` são valores monetários não negativos; a comparação é feita com precisão monetária, sem arredondamento flutuante. O valor negociado e a memória de cálculo permanecem rastreáveis.
4. [ ] Se o valor recebido diferir do esperado, o card exibe divergência financeira e não marca `PAGAMENTO CONCLUÍDO` nem conclui automaticamente a contratação. A divergência é resolvida por regularização dos valores ou por uma validação excepcional somente se autoridade, registro e política estiverem explicitamente configurados; não presumir tolerância, pagamento parcial ou aprovação tácita.
5. [ ] `Comprovante` é exigido quando a forma de pagamento ou processo publicado exigir comprovação manual. O servidor valida que o anexo existe, pertence ao card e usa o fluxo privado/autenticado; a condição administrativa permite ajustar as formas e processos sujeitos à regra.
6. [ ] O estado geral deriva dos dois requisitos independentes, nesta ordem Contrato/Pagamento: `Não/Não → Aguardando assinatura e pagamento`; `Sim/Não → Aguardando pagamento`; `Não/Sim → Aguardando assinatura`; `Sim/Sim → Contratação concluída`. Assinatura antes ou depois do pagamento é permitida. `Sim` só representa requisito concluído após validação efetiva, e a saída final exige ambos.
7. [ ] Para `Pagamento no êxito`, a falta de antecipação não gera inadimplência. Vencimento e cobrança só se tornam exigíveis quando o evento de êxito contratualmente vinculado estiver registrado; sem esse evento, o acompanhamento permanece pendente sem marcar atraso indevido.
8. [ ] Na primeira confirmação válida, registrar data/hora e valor recebido, marcar `PAGAMENTO CONCLUÍDO`, criar uma única tarefa `Emitir Nota Fiscal – [Razão Social]`, verificar assinatura e recalcular o estado geral. Reprocessar o evento ou salvar novamente não duplica a tarefa nem muda o primeiro instante. A tarefa não depende de assinatura prévia.
9. [ ] Enquanto não houver pagamento confirmado, manter `Aguardando pagamento` quando o pagamento for exigível. No vencimento exigível sem pagamento, sinalizar atraso e criar alerta/tarefa interna de cobrança de acordo com política publicada, sem duplicação por ciclo e sem enviar mensagem externa sem solicitação específica. Pagamento no êxito ainda não exigível fica excluído do alerta.
10. [ ] A tentativa de avançar retorna pendências nominais para confirmação incompleta, comprovante exigível ou divergência. A etapa de Nota Fiscal segue apenas a transição publicada; a contratação finalizada não é alcançada por mera mudança de etapa sem assinatura e pagamento válidos.

## Tarefas / checklist

- [x] Inventariar somente leitura a etapa ativa, formulários, campos, opções, versões, requisitos, automações e cards; comparar identidades com Novo Contrato e Formalização sem reutilizar versões/IDs históricos (AC 1–3).
- [x] Preparar e publicar os sete campos e o formulário em **Campos e Formulários**, preservando o `Pagamento confirmado` compartilhado e a origem do valor líquido (AC 1–3).
- [x] Implementar validações no salvamento e na transição: data automática, valor monetário não negativo, forma utilizada, comprovante privado condicional e divergência; listar pendências ao usuário (AC 2–5, 10).
- [x] Implementar os quatro estados Contrato/Pagamento, o evento único de confirmação e a tarefa de NF idempotente; assegurar ambas as ordens dos eventos (AC 6, 8, 10).
- [x] Preparar e publicar política de vencimento/cobrança com exclusão de pagamento no êxito antes do evento vinculante (AC 7, 9).
- [ ] Completar testes de integração com persistência, concorrência, regra administrativa alterada e execução real do cron; testes unitários e ensaio de configuração cobrem valor, quatro estados e êxito (AC 1–10).
- [x] Antes de qualquer alteração de configuração/dados no Turso: acionar Vault, descrever ambiente, comandos, impacto, riscos, alternativa e rollback; verificar backup completo de até 48 horas em `database-backups/pre-change/`; obter autorização específica e conferir publicação por leitura (AC 1–10). Evidência em `docs/reports/vault-financeiro-ativo-pagamento-2026-09-29.md`.
- [ ] Executar lint, typecheck, testes, build e smoke autenticado; os quatro gates locais passaram em 2026-09-29, smoke depende da publicação.

## Dev Notes

- `docs/stories/story-financeiro-ativo-novo-contrato-validacao.md` define valor bruto, retenções, líquido e vencimento do pipeline atual. `docs/stories/story-financeiro-ativo-formalizacao.md` define assinatura comprovada e pagamento independente. Confirmar o estado publicado dessas stories antes de configurar Pagamento.
- `docs/stories/story-financeiro-confirmacao-pagamento.md` contém critérios e decisões anteriores para manual, cobrança e pagamento no êxito, mas trata Financeiro v44 do pipeline histórico. `[AUTO-DECISION]` Usar as decisões como contexto a validar no pipeline atual, sem copiar sua versão, IDs, quantidade de requisitos ou status de publicação.
- Pontos atuais para inspeção: `src/lib/bpm/financeiro-config.client.ts`, `src/lib/bpm/financeiro-formalizacao.ts`, `src/lib/bpm/validacao-salvamento-configurado.ts`, `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/automacoes/central-runtime.ts`, `src/lib/bpm/automacoes/idempotencia-tarefa.ts`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/Anexos.ts` e `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`. As chaves atuais incluem `alpha.pagamento.confirmado`, `alpha.valor.esperado`, `alpha.valor.recebido` e `alpha.financeiro.status.contratacao`; confirmar no banco ativo antes de reutilizar qualquer uma.
- `[AUTO-DECISION]` Até haver política excepcional configurada, divergência é bloqueante. Zero é permitido pelos limites pedidos, mas não equivale por si só a quitação; comparar com o esperado e com o processo contratual.
- `accumulated-context.md` e `.aiox/gotchas.json` não existem neste checkout. A coerência foi conferida nas stories adjacentes e no código atual, sem inferir conteúdo ausente.

## Testes de aceite

1. Receber valor líquido igual ao esperado, com data vazia e forma válida: confirmar uma vez, gravar data/hora e valor, criar uma tarefa NF; repetir sem duplicar.
2. Confirmar com data/valor/forma ausentes, valor negativo, comprovante manual ausente ou anexo de outro card: bloquear com campo nominal.
3. Valor bruto com IRRF/CSRF produz esperado igual ao líquido; pagamento divergente sinaliza pendência e não gera conclusão automática.
4. Assinar antes de pagar e pagar antes de assinar; conferir os quatro estados e bloqueio da finalização enquanto qualquer requisito estiver pendente.
5. Vencimento de pagamento exigível cria uma cobrança interna por ciclo; no êxito sem evento vinculado não cria atraso/cobrança.
6. Editar/publicar condição administrativa altera a validação real do formulário e servidor, preservando cards históricos.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** regras financeiras e automações configuráveis, com integração no formulário; complexidade alta por estados independentes, anexo e idempotência.
- **Specialized Agents:** `@dev` implementa; `@qa` revisa testes; `@architect` revisa fonte monetária/estados; Vault conduz checkpoint de banco; `@github-devops` publica código autorizado.
- **Quality Gates:** pre-commit: lint, typecheck, testes, build; pré-publicação: ensaio em cópia, Vault, backup, autorização e rollback; pós-publicação: leitura da configuração, smoke autenticado e execução observável.
- **Self-Healing:** corrigir achados CRITICAL/HIGH antes de concluir; registrar limitações de políticas ainda não configuradas.
- **Focus Areas:** valor líquido, precisão, divergência, prova privada, pagamento no êxito, cobrança, quatro estados e tarefa NF única.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-ativo-confirmacao-pagamento.md` — escopo, checklist e evidências.
- `scripts/configurar-pagamento-financeiro-ativo.mts` — prévia e publicação transacional v11→v12 após mudança concorrente da versão.
- `docs/reports/vault-financeiro-ativo-pagamento-2026-09-29.md` — plano, riscos, backup e rollback para autorização específica.
- `scripts/lib/verificar-backup-turso.mjs` — verificação de backup por restauração.
- `scripts/turso-backup-prisma.mts` — backup completo alternativo por Prisma HTTP.
- `src/lib/bpm/financeiro-pagamento-validacao.ts` — comparação monetária e pendências.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — validação ao salvar conforme configuração ativa.
- `src/lib/bpm/transicao-command.ts` — bloqueio de avanço conforme confirmação e assinatura.
- `src/lib/bpm/automacoes/central-runtime.ts` — proteção dos estados concluídos e tarefa NF.
- `src/actions/bpm/Anexos.ts` — proteção de comprovante usado na confirmação.
- `tests/bpm/financeiro-pagamento-validacao.test.ts` — valores e pendências.
- `tests/bpm/financeiro-pagamento-fluxo.test.ts` e `tests/bpm/fixtures/financeiro-pagamento-ativo-v11.json` — grafo ensaiado, quatro estados e cobrança no êxito.
- `docs/qa/gates/financeiro-ativo-confirmacao-pagamento.yml` — gate QA local e pendências de publicação.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft da etapa Pagamento no Financeiro ativo, separado do histórico v44 | River (@sm) |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PASS** para inventário e implementação local; referências **PASS**; autossuficiência **PARTIAL** até inventário publicado/política excepcional; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para inventário e desenvolvimento local.** A publicação depende do checkpoint Vault específico.

## QA Results

Revisão preliminar: CONCERNS pela falta de testes de integração com persistência/concorrência e publicação ainda pendente. Os bypasses de comprovante, conclusão e cobrança encontrados na revisão foram corrigidos. Gate final depende da execução dos testes de fluxo acrescentados e da publicação/smoke.

### Revisão final local — 2026-09-29 — Quinn (@qa)

**Veredito: NEEDS_WORK (CONCERNS para publicação).** A implementação local e o ensaio da configuração passaram. A story ainda não atende aos critérios que exigem publicação e verificação no Financeiro ativo: a produção segue na versão 10, sem os campos e automações da versão 11.

- Os quatro estados, a tarefa de NF mesmo sem assinatura, a preferência pelo valor líquido e a exclusão de cobrança antes do êxito foram conferidos no grafo ensaiado. A comparação monetária usa centavos inteiros; divergência bloqueia conclusão automática.
- Os caminhos de salvar, avançar e executar automação consultam a regra ativa de comprovante, conferem anexo privado do próprio card e falham fechados se faltar `Valor esperado`. A exclusão do comprovante referenciado fica bloqueada enquanto `Pagamento confirmado = Sim`. A tarefa de NF usa identidade por card e tipo para evitar duplicação.
- Gates: `npm run lint` passou com 0 erros (1.191 avisos preexistentes); `npm run typecheck` passou; `npm test` passou com 556 arquivos e 4.079 testes (4 ignorados, 1 todo); `npm run build` passou. O ensaio em cópia do backup v10→v11 confirmou 7 campos novos, 6 requisitos e 9 versões de automação `ATIVA`. Os 11 testes direcionados de pagamento passaram.
- Limites: os testes de fluxo avaliam um snapshot do grafo ensaiado e a função pura; não exercitam persistência concorrente, execução real do cron nem edição administrativa seguida de reprocessamento. Falta publicar com Vault, ler de volta a configuração no Turso e fazer smoke autenticado. A data preenchida antes da confirmação fica imutável, exigindo procedimento auditado para corrigir erro prévio.

**Recomendação:** concluir o checkpoint Vault e a publicação autorizada, verificar a versão 11 e as automações na UI, executar smoke autenticado e então reavaliar a story para `Done`.

### Retomada do checkpoint — 2026-09-29

Leitura do Turso confirmou que o Financeiro ativo avançou de v10 para v11 sem os campos/requisitos/automações desta story. A prévia foi atualizada para v11→v12 e passou; zero cards nas etapas Pagamento e Nota Fiscal. O backup dedicado foi restaurado e verificado conforme `docs/reports/vault-financeiro-ativo-pagamento-2026-09-29.md`. A publicação segue bloqueada até confirmação específica; nenhuma configuração foi alterada nesta retomada.

Gates desta retomada: `npm run lint` passou com zero erros e 1.191 avisos; `npm run typecheck` passou; `npm test` passou com 556 arquivos e 4.085 testes (4 ignorados, 1 todo); `npm run build` passou. O smoke autenticado continua pendente da publicação.

### Publicação autorizada — 2026-09-29

Após a confirmação explícita do usuário, a prévia v11→v12 e a restauração do backup foram repetidas e passaram. A publicação transacional concluiu. Leitura posterior confirmou Financeiro v12, formulários de Formalização/Pagamento/Nota Fiscal v2, sete campos solicitados ativos e publicados no formulário de Pagamento, seis requisitos ativos e nove automações com versão `ATIVA`. Os grafos publicados contêm quatro estados, tarefa de NF idempotente, cobrança após êxito e preferência pelo líquido. O smoke autenticado com card real segue pendente porque não havia cards em Pagamento ou Nota Fiscal; nenhum card de produção foi criado ou movido nesta validação.

### Correção — salvamento manual na confirmação (2026-09-29)

Relato em card real: ao editar `Pagamento confirmado = Sim`, data, valor recebido, forma e pagamento no êxito, o botão interrompe o salvamento no primeiro campo. Causa: o formulário envia cada campo isolado, enquanto `prepararSalvamentoConfigurado` valida todos os requisitos da confirmação na mesma transação. Os status da contratação e financeiro são calculados por automação na configuração v12 e aparecem como selects desabilitados, sem indicação do motivo.

- [x] Campos interdependentes de confirmação são enviados juntos numa atualização atômica, com comprovante enviado antes quando exigido; os demais campos mantêm salvamento sequencial.
- [x] O progresso do botão conta alterações realmente confirmadas e a falha preserva o rascunho com pendência nominal.
- [x] Após uma falha, editar o formulário invalida o retry antigo; uma resposta tardia não apaga a recuperação da tentativa mais recente.
- [x] Os status calculados aparecem como informação de leitura com explicação, sem controle de edição manual.
- [x] Testes de confirmação agrupada, falha, progresso, status de leitura e gates lint/typecheck/test/build passam.
- [ ] Smoke autenticado em card real confirma persistência após reload e atualização dos status.

Validação local desta correção: lint sem erros (1.191 avisos preexistentes), typecheck e build aprovados; suíte completa com 561 arquivos e 4.121 testes aprovados, 4 ignorados e 1 pendente. O smoke autenticado depende de um card real na etapa e segue aberto.

**File List desta correção:**

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `tests/bpm/salvamento-manual-campos-react.test.ts`
- `tests/bpm/validacao-salvamento-configurado.test.ts`
- `tests/bpm/formulario-etapa.test.ts`
- `docs/stories/story-financeiro-ativo-confirmacao-pagamento.md`
