# Story: Chamados — painel operacional rápido para TI na barra superior

## Status

InReview

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["eslint", "vitest", "typecheck", "build"]

## Story

Como usuário com role de TI,
quero visualizar e operar os chamados ativos diretamente na barra superior do Painel Alpha,
para assumir, acompanhar, responder e concluir atendimentos sem precisar abrir previamente o módulo de Chamados.

## Contexto e objetivo

A barra superior já mantém as abas dos módulos e a central global de notificações. Esta story adiciona, imediatamente à direita do botão de notificações, um atalho operacional exclusivo para TI. O atalho representa estado persistido dos chamados, não apenas notificações efêmeras, e desaparece quando não houver atendimento ativo.

## Acceptance Criteria

1. O atalho é renderizado somente para usuários cuja role normalize exatamente para `TI`, incluindo o valor legado `T.I`; Admin, CEO e demais roles não o recebem por bypass administrativo.
2. O atalho fica imediatamente à direita do botão global de notificações e antes do widget de clima na barra de abas do shell principal.
3. São considerados ativos somente chamados com status `ABERTO` ou `EM_ATENDIMENTO`.
4. Quando não existe chamado ativo, o atalho não ocupa espaço nem aparece na barra.
5. Quando existe ao menos um chamado ativo, o botão exibe a quantidade e possui feedback visual pulsante, respeitando o padrão compacto da barra.
6. Ao clicar, abre um painel suspenso responsivo, visualmente coerente com a central de notificações, contendo lista rolável com protocolo, título, solicitante, prioridade, status, técnico solicitado/vinculado e horário relevante.
7. A lista é carregada de fonte persistida autorizada no servidor, atualiza ao abrir/focar a janela, após cada ação e periodicamente como fallback para eventos em tempo real.
8. Um chamado `ABERTO` pode ser assumido diretamente no painel; todas as regras existentes de técnico solicitado, role, estado e concorrência continuam sendo validadas pela Server Action canônica.
9. Um chamado `EM_ATENDIMENTO` vinculado ao usuário atual permite visualizar as mensagens recentes e enviar uma nova mensagem textual pelo painel.
10. Um chamado `EM_ATENDIMENTO` vinculado ao usuário atual permite conclusão rápida mediante descrição não vazia da solução, reutilizando o fluxo canônico de conclusão, feedback, notificações e Agenda Alpha.
11. Chamados em atendimento por outro técnico permanecem identificados e não oferecem ações de envio ou conclusão ao usuário atual.
12. Falhas de carregamento ou de ação mantêm o painel utilizável, mostram feedback claro e não removem chamados localmente sem confirmação do servidor.
13. O painel oferece acesso ao módulo completo de Chamados pelo gerenciador de abas existente.
14. A entrega não altera schema, tabelas, migrations ou dados persistidos e possui testes de autorização, consulta, integração no shell e ações expostas na UI.

## Fora de escopo

- Criar novo status de chamado ou reinterpretar `EM_ATENDIMENTO` no banco.
- Alterar as regras de assunção, conclusão, feedback, notificações ou Agenda Alpha.
- Permitir que Admin/CEO vejam o atalho por causa do bypass de `isAdminRole`.
- Substituir a página completa de Chamados, o chat completo ou a central global de notificações.
- Adicionar upload de anexos ao painel compacto.
- Alterar estrutura ou executar migration de banco.

## Tasks / Subtasks

- [x] Task 1 — Consulta operacional autorizada (AC: 1, 3, 6, 7, 11, 14)
  - [x] Criar leitura server-side exclusiva para role normalizada `TI`.
  - [x] Retornar somente `ABERTO`/`EM_ATENDIMENTO`, com campos mínimos, relações necessárias e mensagens recentes em DTO serializável.
  - [x] Ordenar deterministicamente e limitar o histórico de mensagens usado na prévia.
  - [x] Cobrir role `TI`/`T.I`, negação para Admin e contrato da consulta com testes.
- [x] Task 2 — Painel compacto e ações inline (AC: 4–13)
  - [x] Criar componente client do botão/painel com badge, pulso, lista, estados vazio/carregando/erro e click-outside.
  - [x] Reutilizar `assumirChamado`, `enviarMensagemAction` e `updateChamadosStatus` sem duplicar regra de domínio.
  - [x] Restringir na UI envio/conclusão ao técnico efetivamente vinculado, mantendo o servidor como autoridade.
  - [x] Atualizar a lista após ações, foco e intervalo de reconciliação.
  - [x] Oferecer abertura do módulo completo via `openTab`.
- [x] Task 3 — Integração no shell (AC: 1, 2, 4, 13)
  - [x] Montar o componente no shell principal imediatamente depois de `CentralNotificacoesPainel` e antes do clima.
  - [x] Usar comparação exata normalizada com `TI`, sem ampliar a visibilidade para Admin/CEO.
  - [x] Preservar iframe, modo TV, mobile e comportamento atual das abas/notificações.
- [x] Task 4 — Qualidade e regressão (AC: 12, 14)
  - [x] Adicionar testes direcionados de action e wiring/UI.
  - [x] Executar ESLint do escopo e toda a suíte de Chamados.
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, separando débitos globais preexistentes.
  - [x] Atualizar checklist, Dev Agent Record e File List.

## Dev Notes

### Dependências

- Depende dos fluxos de assunção, mensagens, conclusão, feedback e notificação já entregues nas stories `story-rm-2026-d03061-assumir-chamado.md`, `story-chamados-notificacoes-abertura-conclusao.md` e `story-rm-2026-a6f2c9-chamados-feedback-preferencia-prazo.md`; esta story apenas cria uma nova superfície operacional para esses contratos.

### Fluxos e componentes existentes

- `PainelLayoutClient` é o proprietário da barra, das abas e de `openTab`; o bloco relevante renderiza `CentralNotificacoesPainel` antes de `BibbleWeatherWidget`. [Source: `src/components/layout/PainelLayoutClient.tsx`]
- `CentralNotificacoesPainel` fornece o padrão compacto de botão, badge, animação, dropdown, click-outside e lista rolável. [Source: `src/components/layout/CentralNotificacoesPainel.tsx`]
- `isSameRole(role, "TI")` compara roles tolerando pontuação e caixa sem herdar o bypass de Admin/CEO contido em `isAdminRole`. [Source: `src/lib/roles.ts`]
- `assumirChamado` já protege autorização, técnico solicitado, estado inicial e concorrência por `updateMany`; a UI nova deve chamá-la, não reproduzir essa regra. [Source: `src/actions/chamados.ts`]
- `enviarMensagemChamadoAtendidoTIAction` restringe a resposta rápida ao técnico vinculado e delega persistência/notificação a `enviarMensagemAction`; o painel compacto fica sem anexos. [Source: `src/actions/chamados.ts`]
- `updateChamadosStatus(..., "CONCLUIDO", solucao)` reutiliza `concluirChamadoComFeedback` e as integrações de notificação/Agenda; a conclusão permanece limitada no servidor ao técnico vinculado. [Source: `src/actions/chamados.ts`; `src/lib/chamados/conclusao.ts`]
- O modelo atual possui `status`, `tecnicoId`, `tecnicoSolicitadoId`, relações de solicitante/técnico e mensagens; não é necessária alteração estrutural. [Source: `prisma/schema.prisma`, models `chamados` e `MensagensChamado`]
- A documentação de arquitetura configurada em `docs/architecture/` e os fallbacks `docs/pt/framework/` não estão presentes neste checkout; os pontos acima foram derivados dos contratos reais e das stories anteriores de Chamados.

### Restrições técnicas

- Toda leitura e mutação deve revalidar sessão/role no servidor; esconder controles na UI não é autorização.
- O dropdown deve existir apenas no shell externo, pois `PainelLayoutClient` já retorna somente `children` quando está em iframe ou modo TV.
- Datas retornadas por Server Action devem ser serializáveis para o Client Component.
- O polling é fallback de reconciliação; deve ser cancelado no unmount e não pode criar chamadas sobrepostas.
- Preservar todas as mudanças locais de login e arquivos não relacionados existentes no worktree.

### Arquivos previstos

- `src/actions/chamados.ts` — consulta serializável e autorizada dos chamados ativos.
- `src/components/chamados/ChamadosOperacionaisPainel.tsx` — botão, dropdown, lista e ações rápidas.
- `src/components/layout/PainelLayoutClient.tsx` — montagem exclusiva para TI na posição definida.
- `src/hooks/useAdminChamadosNotifications.ts` — sinal de atualização em tempo real, se necessário para reconciliar o painel.
- `tests/chamados/painel-operacional-ti.test.ts` — autorização e contrato server-side.
- `tests/chamados/painel-operacional-ui.test.ts` — wiring e estados essenciais da UI.
- Não requer variável de ambiente nova.

## Testing

- Action: role `TI` e legado `T.I` autorizados; Admin/CEO negados; query filtra exclusivamente os dois estados ativos; mensagens retornam em ordem de leitura.
- UI/wiring: componente aparece somente com `isSameRole(role, "TI")`, fica depois do sino e antes do clima, retorna `null` sem ativos e expõe assumir/enviar/concluir/módulo completo.
- Regressão: suítes existentes de assunção, conclusão rápida, notificações e mensagens continuam aprovadas.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Frontend + Server Action + autorização; complexidade média.

**Specialized Agents:** `@dev`, `@ux-design-expert` e `@qa`.

**Quality Gate Tasks:**

- [x] Pre-Commit: revisão manual concluída; CodeRabbit indisponível no ambiente por ausência do executável.
- [ ] Pre-PR: validar integração com shell, abas, notificações, chat e conclusão existentes.

**Self-Healing:** `@dev` em modo light, máximo 2 iterações/15 minutos, somente CRITICAL.

**Severity Behavior:** CRITICAL recebe tentativa automática de correção; HIGH é documentado; MEDIUM e LOW ficam fora do auto-fix.

**Focus Areas:** autorização exata de TI no servidor, ausência do botão sem chamados, payload mínimo, prevenção de polling sobreposto, ownership das ações, acessibilidade do dropdown e não interferência na central de notificações/abas.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-11 | 0.1 | Story criada a partir do pedido de painel operacional de Chamados exclusivo para TI. | River / Codex |
| 2026-09-11 | 0.2 | Validated GO (9/10) — Status: Draft → Ready. | Pax / Codex |
| 2026-09-11 | 0.3 | Development started (autonomous execution) — Status: Ready → InProgress. | Dex / Codex |
| 2026-09-11 | 1.0 | Painel operacional TI implementado, protegido no servidor e validado — Status: InProgress → InReview. | Dex / Codex |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- ESLint do escopo alterado: aprovado sem erros ou avisos.
- Suíte de Chamados: 17 arquivos e 96 testes aprovados.
- Build de produção: aprovado; permaneceu apenas o aviso preexistente do `pdfjs-polyfill`.
- `npm run lint`: executado; falha no baseline global com 21.198 ocorrências, sem ocorrência nos arquivos desta story no lint isolado.
- `npm run typecheck`: executado com heap ampliado; falhas globais preexistentes em Exclusão Fiscal, gerador de documentos, Radar e Google Calendar, sem apontamento para esta story.
- `npm test`: executado; 365 arquivos/2.869 testes aprovados e 14 arquivos/28 testes globais falharam em módulos não relacionados; toda a suíte de Chamados passou.
- CodeRabbit: revisão automática não executada porque a CLI não está instalada; revisão manual do diff concluída.

### Completion Notes List

- Adicionado atalho pulsante exclusivo para role normalizada `TI`/`T.I`, oculto quando a fila ativa está vazia.
- O dropdown permite consultar a fila, assumir chamados, acompanhar mensagens, responder e concluir os próprios atendimentos, além de abrir o módulo completo.
- A fila reconcilia por evento, foco, abertura/ação e polling sem sobrepor consultas.
- Listagem e resposta rápida possuem autorização server-side; assunção e conclusão continuam reutilizando os contratos canônicos e suas proteções de concorrência/ownership.
- Nenhuma dependência, configuração, schema, migration ou dado persistido foi alterado.
- DoD: requisitos, ACs, estrutura, segurança, testes direcionados, build, documentação da story e File List atendidos. O lint/typecheck/test globais permanecem bloqueados apenas por débitos preexistentes documentados acima; a validação visual autenticada fica para o quality gate/review.

### File List

- `docs/stories/story-chamados-painel-operacional-ti.md`
- `src/actions/chamados.ts`
- `src/components/chamados/ChamadosOperacionaisPainel.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useAdminChamadosNotifications.ts`
- `src/lib/chamados/notificacoes.ts`
- `tests/chamados/painel-operacional-ti.test.ts`
- `tests/chamados/painel-operacional-ui.test.ts`

## QA Results

—
