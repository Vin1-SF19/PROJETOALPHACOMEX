# Story — Notificações de abertura e conclusão de chamados

## Status

InProgress

## Story

Como usuário do módulo de Chamados, quero receber os avisos de abertura e conclusão em tempo real, para acompanhar novos atendimentos e saber quando minha solicitação foi resolvida.

## Acceptance Criteria

1. Administradores e CEOs recebem notificação para chamados abertos pelo formulário manual.
2. Administradores e CEOs recebem a mesma notificação para chamados abertos pelo ChatBot ou pelo Bibble.
3. O usuário que abriu o chamado recebe uma notificação quando ele é concluído pelo fluxo rápido.
4. O usuário que abriu o chamado recebe uma notificação quando ele é concluído com protocolo.
5. O canal de conclusão é privado e somente pode ser autorizado para o próprio usuário autenticado.
6. A falha no serviço de notificação não desfaz a criação ou conclusão já persistida do chamado.
7. A notificação de conclusão possui identificação visual e texto diferentes do alerta de novo chamado.

## Tasks / Subtasks

- [x] Task 1 — Centralizar notificações de abertura (AC: 1, 2, 6)
  - [x] Criar contrato e serviço compartilhados.
  - [x] Integrar formulário, ChatBot e Bibble.
- [x] Task 2 — Notificar conclusão ao solicitante (AC: 3, 4, 5, 6)
  - [x] Criar canal privado individual e validar sua autorização.
  - [x] Publicar nos fluxos de conclusão rápida e com protocolo.
  - [x] Assinar o canal individual no layout autenticado.
- [x] Task 3 — Diferenciar a apresentação da conclusão (AC: 7)
  - [x] Adicionar estilo e texto específicos no toast e no histórico.
- [ ] Task 4 — Validar a entrega (AC: 1–7)
  - [x] Executar testes direcionados.
  - [ ] Executar lint.
  - [ ] Executar typecheck.
  - [x] Executar testes completos.
  - [x] Executar build.

## Dev Notes

- A mudança reutiliza a infraestrutura Pusher existente e não requer migration, nova tabela ou alteração estrutural de banco.
- Os três pontos atuais de criação são `createChamadoAction`, `/api/ChatBot/AbrirChamado` e a ferramenta `abrir_chamado` do Bibble.
- Os dois pontos atuais de conclusão são `updateChamadosStatus` e `finalizarComProtocolo`.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-07-30 | 1.0 | Story criada e investigação dos fluxos de notificação concluída. | Dex |
| 2026-07-30 | 1.1 | Notificações de abertura centralizadas e conclusão individual implementada nos dois fluxos. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/chamados/notificacoes.test.ts` — 5 testes passaram.
- Lint direcionado dos 14 arquivos da entrega — passou sem erros ou avisos.
- `npm test` — 54 arquivos e 453 testes passaram.
- `npx next build` — build de produção passou.
- `npm run typecheck` — sem erros da entrega; bloqueado por quatro erros preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador` e `HabilitacaoRadarClient`.
- `npm run lint` — excedeu 240 segundos porque a configuração global percorre diretórios internos; o lint direcionado passou.
- `git diff --check` — passou.

### Completion Notes List

- A investigação confirmou que os fluxos ChatBot/Bibble não publicavam o evento de novo chamado e que nenhum fluxo publicava a conclusão ao solicitante.
- Formulário, ChatBot e ferramenta do Bibble agora usam o mesmo serviço tolerante a falhas para publicar novos chamados.
- Conclusões rápidas e com protocolo publicam em `private-chamados-usuario-{id}`; a rota de autorização aceita somente o canal pertencente à sessão.
- O layout assina o canal individual de todo usuário autenticado e mantém a assinatura administrativa somente para Admin/CEO.
- A configuração do Pusher foi atualizada para `channelAuthorization`, compatível com a versão instalada.
- Toast e card exibem estado verde e rótulo “Chamado concluído” para não confundir com a urgência de uma abertura.
- Nenhuma migration, dependência ou alteração de estrutura do banco foi necessária.

### File List

- `docs/stories/story-chamados-notificacoes-abertura-conclusao.md`
- `plan/self-critique-chamados-notificacoes.json`
- `src/actions/chamados.ts`
- `src/actions/protocolos.ts`
- `src/app/PainelAlpha/layout.tsx`
- `src/app/api/ChatBot/AbrirChamado/route.ts`
- `src/app/api/pusher/auth/route.ts`
- `src/components/chamados/NotificationCard.tsx`
- `src/components/chamados/NotificationToast.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useAdminChamadosNotifications.ts`
- `src/lib/bibble/tool-executor.ts`
- `src/lib/chamados/notificacoes.ts`
- `src/lib/chamados/notificacoes-server.ts`
- `src/lib/pusher.ts`
- `tests/chamados/notificacoes.test.ts`

## QA Results

_A preencher pelo agente de QA._
