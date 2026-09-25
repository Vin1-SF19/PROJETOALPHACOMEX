# Story — Financeiro: Confirmação de Pagamento e status da contratação

## Status

Ready for Review — implementação e gates locais concluídos; publicação de configuração no Turso aguarda autorização específica.

## Executor Assignment

- **Executor:** @dev
- **Quality gate:** @qa, com revisão de @architect para estados e automações.
- **Ferramentas:** diagnóstico somente leitura do BPM, testes de validação/automação e gates do projeto.

## Story

**Como** integrante do Financeiro, **quero** confirmar o pagamento, comparar os valores e acompanhar conjuntamente assinatura e pagamento, **para** concluir a contratação apenas quando as duas condições estiverem cumpridas e iniciar a emissão da nota fiscal no momento correto.

**Escopo:** etapa `Confirmação de Pagamento` do pipeline Financeiro e status geral da contratação afetado pelos eventos de assinatura e pagamento. A etapa seguinte existente é `Emissão da Nota Fiscal`.

## Campos solicitados

| Campo | Regra solicitada |
| --- | --- |
| Pagamento confirmado | Sim/Não |
| Data do pagamento | Obrigatória quando confirmado = Sim; registrar data/hora no evento real da confirmação |
| Valor esperado | Derivado do valor líquido calculado quando há retenções |
| Valor recebido | Obrigatório quando confirmado = Sim |
| Forma de pagamento utilizada | Obrigatória quando confirmado = Sim |
| Comprovante | Obrigatório quando a forma utilizada for Manual; a lista permanece configurável |
| Status financeiro | Reflete o estado do pagamento, inclusive `Aguardando pagamento` e `PAGAMENTO CONCLUÍDO` |

## Critérios de aceite

1. [ ] O formulário publicado da etapa apresenta os sete campos acima com as identidades configuradas correspondentes. Salvar e avançar usam os mesmos campos ativos, sem requisito de chave inativa ou rótulo hardcoded. Valores existentes permanecem legíveis.
2. [ ] Para `Pagamento confirmado = Sim`, `Data do pagamento`, `Valor recebido` e `Forma de pagamento utilizada` são obrigatórios. A ausência de qualquer um bloqueia a confirmação e a saída com indicação nominal da pendência. A data/hora automática representa a confirmação efetiva; não é preenchida apenas por mover de etapa.
3. [ ] `Valor esperado` vem do valor líquido calculado quando houver retenções e acompanha a memória de cálculo válida. `Valor esperado` e `Valor recebido` são numéricos e maiores ou iguais a zero. O sistema compara ambos ao confirmar o pagamento.
4. [ ] Se os valores esperado e recebido divergirem, a divergência fica sinalizada e a conclusão automática é impedida até regularização ou validação. A forma de registrar uma validação excepcional e sua autoridade dependem de definição na configuração; nenhuma tolerância numérica ou quitação parcial é presumida nesta story.
5. [ ] `Comprovante` é exigido quando a forma de pagamento ou o processo configurado exigir comprovação manual. A regra e sua aplicação são explícitas na configuração publicada. Enquanto a política não estiver definida, não presumir que toda forma exige comprovante nem que nenhuma exige.
6. [ ] O CRM acompanha assinatura e pagamento de modo conjunto, com estas quatro combinações: **Não/Não → Aguardando assinatura e pagamento**; **Sim/Não → Aguardando pagamento**; **Não/Sim → Aguardando assinatura**; **Sim/Sim → Contratação concluída**. A ordem é assinatura/pagamento. A confirmação, correção ou reversão válida de qualquer indicador recalcula o estado geral sem combinação contraditória.
7. [ ] `Pagamento no êxito` não gera inadimplência pela ausência de pagamento antecipado. Sua condição é respeitada na avaliação de vencimento, cobrança e status, conforme o acordo registrado; não inventar vencimento ou cobrança antes do evento que torna o pagamento exigível.
8. [ ] Na primeira confirmação válida, a automação registra data/hora e valor recebido, coloca o status financeiro em `PAGAMENTO CONCLUÍDO`, cria uma única tarefa **“Emitir Nota Fiscal – [Razão Social]”**, verifica o estado da assinatura e recalcula o status geral conforme o item 6. Reprocessar o evento ou salvar novamente não duplica a tarefa nem altera o instante original.
9. [ ] Enquanto não houver confirmação válida, o estado financeiro permanece `Aguardando pagamento` quando o pagamento for exigível. A mera passagem de etapa, o vencimento ou a presença de valor recebido isolado não constituem confirmação.
10. [ ] No vencimento de pagamento exigível e não confirmado, o sistema cria alerta/tarefa de cobrança **conforme política definida na configuração**. O gatilho não trata `Pagamento no êxito` ainda não exigível como atraso; repetição não duplica acompanhamento.
11. [ ] Uma divergência pendente ou outro requisito obrigatório impede a conclusão automática, com mensagem acionável. Com valores regulares/validados, campos obrigatórios e estado da assinatura coerentes, o avanço para `Emissão da Nota Fiscal` segue apenas as transições publicadas.

## Decisões pendentes e limites

- **Prova manual (usuário):** lista configurável de formas/processos; a opção manual exige comprovante. Usar o fluxo autenticado de arquivo do card.
- **[AUTO-DECISION] Divergência:** o pedido permite “regularização/validação”, mas não define tolerância, responsável, trilha de aprovação ou pagamento parcial. Documentar essas decisões antes de publicar eventual exceção; a regra padrão bloqueia conclusão automática.
- **Cobrança (usuário):** no vencimento informado no card, criar alerta e tarefa interna. Nenhuma mensagem externa automática foi solicitada.
- **Pagamento no êxito (usuário):** o card permanece em Pagamento até o recebimento; a ausência de antecipação não é inadimplência. O vencimento informado só pode gerar cobrança depois da data de êxito do serviço vinculado ao card. Sem vínculo/êxito, a cobrança fica suspensa.
- **Banco/configuração:** publicação de campos, regras, automações ou mutação em massa no Turso requer o checkpoint Vault do `AGENTS.md`: plano com ambiente/impacto/rollback, backup completo validado de até 48 horas em `database-backups/pre-change/` e autorização humana explícita e específica para esta publicação. Aprovações anteriores não cobrem esta etapa.

## Tarefas / subtarefas

- [x] **Inventariar a etapa real** (AC 1–5): campos ativos/inativos, composição publicada, valores históricos, status/opções, cálculo líquido, indicadores `Pagamento no êxito`, comprovantes e regras/automações atuais. Registrar a identidade canônica de cada conceito.
- [x] **Definir configuração de validação** (AC 2–5, 11): condicional de confirmação, origem do valor esperado, limites numéricos, comparação e comprovação manual conforme política aprovada; publicação pendente.
- [x] **Configurar estados combinados** (AC 6, 7, 9): mapear a assinatura e o pagamento para as quatro saídas sem sobrepor os status individuais; respeitar pagamento no êxito; publicação pendente.
- [x] **Configurar automações** (AC 8, 10): confirmação, tarefa de NF idempotente, verificação da assinatura, recálculo e cobrança por vencimento somente com política definida; publicação pendente.
- [ ] **Testar fluxo real** (AC 1–11): salvamento, transição, idempotência, valores iguais/divergentes, quatro estados, pagamento no êxito, comprovante configurado e vencimento. Conferir execução/histórico das automações.
- [ ] **Publicação protegida e gates**: antes de alterar banco/configuração, Vault, backup validado, autorização específica e rollback; depois executar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e smoke autenticado. Atualizar este checklist e File List.

## Dev Notes

- `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md` registrou oito campos publicados na etapa, dois conceitos de comprovante e o antigo preenchimento da data no avanço. É um diagnóstico histórico; confirmar o estado atual em leitura antes de decidir migração de campos.
- `docs/stories/story-financeiro-novo-contrato.md` define cálculo de retenções e valor líquido, `Vencimento` e `Link/dados para pagamento`, e proíbe colocar `Aguardando pagamento` sem esses dados. Preservar essa pré-condição.
- `docs/stories/story-financeiro-elaboracao-contrato.md` define o evento de envio para assinatura e o acompanhamento `Aguardando assinatura`. Esta story combina esse estado com o pagamento, sem alterar a regra da elaboração.
- `docs/stories/story-financeiro-fluxo-configuravel-sem-legado.md` removeu guardas financeiras por nome/chave fixa; requisitos e automações devem vir da configuração publicada. `src/lib/bpm/transicao-command.ts` é o movimento canônico; `src/lib/bpm/automacoes/central-runtime.ts` executa ações centrais. Localizar as implementações atuais e confirmar capacidade antes de editar.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no checkout ao preparar o draft. Coerência cruzada foi conferida com as stories e o diagnóstico citados; não foi presumido conteúdo ausente.

## Testing

- Exercitar combinações assinatura/pagamento `NN`, `SN`, `NS`, `SS` e alterações posteriores em qualquer indicador; conferir a tabela de estados e tarefas sem duplicação.
- Confirmar pagamento com data/valor/forma ausentes, esperado ou recebido negativo, esperado calculado com retenção e divergência de valores; exigir mensagem e impedir conclusão automática.
- Testar comprovante quando uma política configurada o exige e quando não o exige; tratar arquivo por referência autenticada válida, não por nome de anexo.
- Testar vencimento sem pagamento para política configurada, inclusive pagamento no êxito ainda não exigível. Verificar que não há cobrança prematura.
- Teste integrado no formulário publicado, action de salvamento, motor de transição, execução de automação e tarefa de NF; repetir evento para conferir idempotência.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integração e regra de negócio configurada; secundários API, Frontend e dados; complexidade alta pela combinação de estados, valor e automações.
- **Specialized Agents:** @dev implementa; @architect revisa modelo de estados; @qa valida aceites; @ux-expert revisa mensagens/indicadores; Vault antes de mutação protegida; @github-devops em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão; Pre-PR (@github-devops): regressão de etapas e dados históricos; Pre-Deployment (@github-devops): configuração publicada, evidência Vault e rollback.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, trata CRITICAL; @qa full, até 3 iterações/30 min, trata CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** fonte do líquido, precisão de comparação, divergência, idempotência da tarefa NF, evento real de data/hora, política de cobrança, condição de pagamento no êxito e referências de comprovante.

## Checklist

- [x] Pedido do usuário e stories adjacentes consolidados em critérios testáveis.
- [x] Draft validado pelo checklist: objetivo/contexto PASS; orientação técnica PARTIAL (inventário real e políticas pendentes); referências PASS; autossuficiência PASS; testes PASS; CodeRabbit PASS.
- [x] Política de comprovação e cobrança definida pelo usuário; divergência bloqueia até correção, sem validação excepcional presumida.
- [x] Inventário atual: etapa Pagamento v3 com 13 campos publicados, duplicidade de comprovante, sem requisito/automação própria; zero cards ativos nela. Identidades canônicas e plano de código em análise.
- [x] Implementação, regressões locais e gates estáticos concluídos.
- [ ] Smoke autenticado do formulário e das automações no ambiente publicado.
- [ ] Checkpoint Vault e publicação concluídos, se necessária mutação protegida.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-confirmacao-pagamento.md` — este draft.
- `scripts/financeiro-pagamento-config.mts` — plano somente leitura e publicação protegida por autorização, backup e versão.
- `src/lib/bpm/regras/{types,schemas,avaliador,contexto}.ts` — comparação entre campos, data atual e êxito do serviço vinculado.
- `src/lib/bpm/automacoes/{central-runtime,central-schemas,publicacao}.ts` — cópia de campo em automação, evento atômico e deduplicação da tarefa de NF.
- `src/lib/bpm/automacoes/idempotencia-tarefa.ts` — identidade estável por card/tipo para tarefa única, sem migration.
- `src/components/bpm/automacoes/CondicoesAutomacaoEditor.tsx`, `src/components/bpm/regras/RegraFormDialog.tsx` — fonte temporal na configuração visual.
- `tests/bpm/regras-engine.test.ts`, `tests/bpm/regras-guarda-movimento.test.ts`, `tests/bpm/automacoes-central.test.ts` — regressões de comparação, vínculo e identidade estável da tarefa.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft de Confirmação de Pagamento e estados conjuntos | River (@sm) |
| 2026-09-25 | 0.2 | Política de êxito, plano de configuração e suporte a regras/automações | Codex |
| 2026-09-25 | 0.3 | Saída exige fonte de valor válida; tarefa única usa ID determinístico e evento atômico | Codex |

## QA Results

`npm run lint`: passou, com 1.192 avisos existentes e zero erros. `npm run typecheck`: passou. Após as correções de QA, `npm test`: 517 arquivos, 3.852 testes passaram, quatro ignorados e um todo. `npm run build` passou após direcionar o cache da worktree para disco persistente; a primeira tentativa no `/tmp` falhou por cota de escrita. QA do diff corrigido: **CONCERNS**, sem bloqueante estático; teste real do fluxo publicado e concorrência permanece pendente. O smoke autenticado e a publicação continuam sujeitos à autorização específica do banco.
