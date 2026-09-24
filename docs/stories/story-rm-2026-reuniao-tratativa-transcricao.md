# Story: Alpha CRM — desbloquear avanço de Reunião Agendada para Em Tratativa

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, `coderabbit`

## Story

**Como** responsável por um card em **Reunião Agendada**, **quero** entender o requisito pendente e conseguir resolvê-lo no card, **para** mover o card para **Em Tratativa** quando a reunião e os demais requisitos estiverem registrados.

## Contexto e diagnóstico

O requisito de transcrição para avanço comercial já existe na [story da reunião](story-alpha-crm-reuniao-agendada-transcricao-meet.md#regra-de-avanço-e-standby), AC 14–16. O requisito de **Próximo Contato** para entrada em Em Tratativa já existe na [story da etapa](story-alpha-crm-card-por-etapa-em-tratativa.md#acceptance-criteria), AC 4–6 e 11–15. Esta story corrige a divergência entre a UI e a transição canônica, sem retirar esses requisitos.

Diagnóstico do código em 24/09/2026:

- `PainelProximaEtapa.tsx` desabilita o destino comercial quando `card.transcricaoReuniao` está vazio, mas explica o motivo somente no atributo `title` do botão desabilitado.
- `transicao-command.ts` consultava `BpmCardReuniao.transcricao`; a edição manual e a sincronização do Google persistem `BpmCard.transcricaoReuniao`. O card podia, portanto, aparentar cumprir o requisito e continuar bloqueado no servidor.
- O mesmo comando lia Próximo Contato em `BpmCardFollowUpEstado`, enquanto a UI e o preflight liam `BpmCard.proximoContatoEm`; registros auxiliares ausentes ou divergentes podiam bloquear o movimento depois do preflight.
- `PainelReuniao.tsx` só mostra o campo editável de resumo quando `resumo.trim()` já tem conteúdo. Com o campo vazio, a própria UI não oferece esse caminho de resolução.
- Inventário remoto somente leitura: os três cards atualmente em Reunião Agendada têm as duas colunas de transcrição vazias e `proximoContatoEm` preenchido. Esse inventário não autoriza preencher transcrição fictícia nem mover cards em massa.

## Acceptance Criteria

1. Para sair manualmente de **Reunião Agendada** rumo a um destino comercial permitido, a UI e o guard canônico avaliam a mesma transcrição persistida em `BpmCard.transcricaoReuniao`, com `trim()`. Texto ausente ou só com espaços continua bloqueando; transcrição válida não é bloqueada por `BpmCardReuniao.transcricao` vazio.
2. Quando a transcrição falta, o card apresenta mensagem visível junto à tentativa de avanço, nomeia a pendência e indica a ação **Buscar transcrição** ou o controle de resumo disponível. A explicação funciona por teclado e em telas de toque, sem depender de `title`/hover.
3. O controle de resumo da reunião permanece acessível quando ainda está vazio para o usuário que pode editar o card. Salvar texto válido usa o fluxo persistente já existente; não há preenchimento automático artificial.
4. Após sincronizar ou salvar a transcrição, o estado visual de avanço é atualizado e a transição para **Em Tratativa** é permitida se Próximo Contato, permissões e demais regras de destino estiverem satisfeitos. Falha ou pendência do Google permanece explicada e não desbloqueia o card.
5. Drag-and-drop, modal e chamada direta à action de movimento mantêm a mesma regra de backend. Em caso de recusa, nenhuma etapa/histórico parcial é persistido e o motivo chega ao usuário.
6. **Standby - Follow Up** conserva a exceção sem transcrição prevista na story da reunião; destinos proibidos pelo pipeline continuam proibidos.
7. Testes cobrem transcrição ausente, whitespace, válida em `BpmCard` com `BpmCardReuniao.transcricao` vazio, mensagem acionável, resumo inicialmente vazio, Próximo Contato pendente e exceção de Standby. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Tasks / Subtasks

- [x] Alinhar a leitura do guard de transição à fonte canônica de transcrição e Próximo Contato (AC 1, 4–6).
- [x] Expor pendência e caminho de resolução no card; tornar o resumo vazio editável quando autorizado (AC 2–4).
- [x] Cobrir preflight do modal, persistência do resumo vazio e guard de domínio; conferir propagação do erro no board e na action canônica (AC 5–7).
- [x] Executar quality gates e atualizar esta checklist e File List (AC 7).

## Dev Notes

- Arquivos centrais: `src/lib/bpm/transicao-command.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` e testes em `tests/bpm/`.
- Usar os mecanismos atuais de ownership, persistência, histórico e realtime. Não alterar schema nem dados remotos para este ajuste; qualquer necessidade de migração segue o fluxo Vault do `AGENTS.md`.
- **[AUTO-DECISION]** O valor válido deve ser o de `BpmCard.transcricaoReuniao` → é a fonte declarada na story original e usada pela UI e pela sincronização já existentes.
- **[AUTO-DECISION]** Os três cards atuais permanecem bloqueados enquanto sem transcrição real → o pedido é corrigir a causa e tornar o requisito resolúvel, sem fabricar evidência.
- Não há `accumulated-context.md` no workspace; coerência verificada pelas duas stories relacionadas acima.

## Testing

Executar testes focados do guard e componentes, depois os gates de qualidade do `AGENTS.md`. Verificar mensagem visível em botão desabilitado, uso por teclado e estado após salvar/sincronizar.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal Frontend; secundário API/lógica de domínio; complexidade média.
- **Specialized Agents:** `@dev` implementa; `@qa` verifica; `@ux-design-expert` revisa a orientação visível e acessibilidade quando acionado.
- **Quality Gate Tasks:** [ ] Pre-Commit (`@dev`, revisão de lógica, acesso e mensagens); [ ] Pre-PR (`@devops`, quando houver PR).
- **Self-Healing Configuration (Story 6.3.3):** `@dev` em modo light, até 2 iterações/15 min; CRITICAL corrigido, HIGH documentado. `@qa` em modo full, até 3 iterações/30 min, corrige CRITICAL/HIGH. `@devops` em modo check, apenas reporta.
- **Focus Areas:** mesma fonte persistida em UI e backend; erro legível por teclado/toque; guard autoritativo; exceção Standby; ausência de movimento parcial.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-24 | 1.0 | Diagnóstico e critérios para avanço de Reunião Agendada a Em Tratativa. | River (`@sm`) |
| 2026-09-24 | 1.1 | Guardas alinhadas aos dados do card, aviso e acesso ao resumo vazio; testes e gates concluídos. | Codex |

## Dev Agent Record

### File List

- `docs/stories/story-rm-2026-reuniao-tratativa-transcricao.md` — story inicial.
- `src/lib/bpm/transicao-command.ts` — usa a transcrição e o Próximo Contato do card na transição canônica; preserva a exceção Standby.
- `src/lib/bpm/reuniao-agendada.ts` — identifica a regra por chaves estáveis quando disponíveis.
- `src/actions/bpm/Cards.ts` — passa as chaves das etapas à consulta de requisitos.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — pendência visível, preflight acionável e foco no resumo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` — resumo disponível mesmo vazio.
- `tests/bpm/transicao-requisitos-card-react.test.ts` — tentativa de avanço com transcrição pendente e foco no controle.
- `tests/bpm/autosave-fixed-recovery-react.test.ts` — salvamento de resumo inicialmente vazio.
- `tests/bpm/reuniao-agendada.test.ts` — regra com rótulos editados e exceção Standby.

### Verificação

- `npm run lint`: passou, 0 erros; 1.192 avisos existentes no repositório.
- `npm run typecheck`: passou.
- `npm test`: 506 arquivos, 3.818 testes aprovados, 4 ignorados e 1 pendente.
- `npm run build`: passou; avisos preexistentes de `pdfjs-polyfill`.
- Revisão do board: falha da action retorna motivo ao painel e restaura o arrasto; o comando canônico valida antes de persistir a transição.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Goal & Context | PASS | Destino, bloqueio e benefício definidos. |
| Technical Guidance | PASS | Fontes divergentes e arquivos centrais identificados. |
| References | PASS | Duas stories relacionadas citadas por seção. |
| Self-Containment | PASS | Regras, exceção e dados observados resumidos. |
| Testing | PASS | Cenários e gates explícitos. |
| CodeRabbit | PASS | Tipo, agentes, gates, self-healing e focos definidos. |

**Final Assessment:** READY para implementação; dados remotos permanecem sem alteração.
