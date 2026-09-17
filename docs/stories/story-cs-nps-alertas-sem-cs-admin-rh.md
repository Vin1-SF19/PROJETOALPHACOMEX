# Story: CS & NPS — alertas para empresas sem CS e acesso de Admin/RH

**ID:** STORY-CS-NPS-ALERTAS-SEM-CS-ADMIN-RH
**Módulo:** CS & NPS + central global de notificações
**Status:** InProgress
**Prioridade:** Alta
**Data de criação:** 2026-09-17

## Story

**Como** usuário administrador ou de Recursos Humanos responsável pelo acompanhamento de clientes,
**quero** visualizar também os serviços em andamento que nunca tiveram um CS registrado, diferenciados dos CS vencidos há 10 dias,
**para** identificar toda empresa que precisa de atendimento inicial ou atualização.

## Contexto

Esta story estende `story-cs-nps-alertas-ultimo-cs-dez-dias.md`. O fluxo atual consulta somente serviços em andamento que já possuem histórico, diferencia o atraso a partir do último CS e restringe o alerta a TI/RH. O pedido atual inclui serviços sem qualquer histórico de CS e corrige o público para contemplar Admin e Recursos Humanos, preservando o acesso de TI já existente.

O diagnóstico confirmou que a usuária **FRANCIELLI ROSA ROSAR** está ativa e possui a role persistida `RECURSOS HUMANOS`, valor aceito pela normalização atual. A sessão, porém, usa a role gravada no JWT e a revalidação atual consulta somente o status do usuário; portanto, uma role alterada depois do login pode permanecer desatualizada durante a sessão.

## Acceptance Criteria

1. Todo `ClienteServico` com status exatamente **Em Andamento** e sem nenhum `ClienteServicoLogCs` válido aparece na fila derivada do CS & NPS.
2. Serviços com CS continuam aparecendo somente quando o CS válido mais recente completou 10 dias corridos; os demais status e CS recentes continuam fora da fila.
3. Cada pendência informa um tipo explícito: **Sem CS realizado** ou **CS vencido**, sem depender apenas de cor. Para pendência sem CS, a UI não tenta formatar uma data inexistente.
4. O item agregado do sino contabiliza os dois tipos, abre o mesmo modal existente e comunica quando a fila contém empresas sem CS e/ou CS vencido.
5. Admin, TI e Recursos Humanos recebem e podem tratar os alertas. CEO, Administrativo e demais perfis não recebem acesso por consequência de bypass genérico.
6. A autorização server-side usa o perfil atual persistido do usuário autenticado, evitando que uma role antiga no JWT impeça Francielli/RH de consultar ou salvar pelo fluxo rápido.
7. O shell do painel usa o perfil atual persistido para decidir a montagem da consulta e do modal, mantendo cliente e servidor consistentes.
8. Após registrar o primeiro CS pelo modal rápido, a pendência sem CS é reconciliada: sai da fila quando o registro novo está dentro de 10 dias e volta a seguir a regra normal de vencimento posteriormente.
9. A entrega não cria ou altera tabela, coluna, índice, constraint, seed, migration ou backfill e não adiciona variável de ambiente.
10. Há testes para ausência de CS, diferenciação visual, contagem agregada, autorização Admin/TI/RH, negação dos demais perfis e uso da role atual persistida quando o JWT está desatualizado.

## Fora de escopo

- Alterar a janela de 10 dias ou os status do módulo.
- Criar notificações persistidas, cron, e-mail, WhatsApp ou push de navegador.
- Alterar roles de usuários, schema, migrations, seeds ou dados existentes.
- Incluir CEO, Administrativo ou outros setores não solicitados.

## Tasks / Subtasks

- [x] **Task 1 — Estender o domínio e a consulta de pendências** (AC: 1–3, 5–6, 9)
  - [x] Representar explicitamente os tipos `SEM_CS` e `CS_VENCIDO`, com datas opcionais apenas quando aplicáveis.
  - [x] Consultar todos os serviços em andamento e classificar os sem histórico sem alterar a regra temporal existente.
  - [x] Autorizar Admin, TI e Recursos Humanos usando a role atual persistida.
- [x] **Task 2 — Atualizar shell, store e central global** (AC: 4, 7–8)
  - [x] Passar ao shell o perfil persistido atual do usuário.
  - [x] Tornar a assinatura da fila segura para pendências sem data.
  - [x] Ajustar texto e data do item agregado para filas mistas.
- [x] **Task 3 — Diferenciar pendências no modal** (AC: 3–4, 8)
  - [x] Exibir rótulo acessível “Sem CS realizado” para empresas sem histórico.
  - [x] Preservar a data e os dias de atraso para CS vencidos.
  - [x] Reutilizar o mesmo formulário rápido e a reconciliação após salvar.
- [ ] **Task 4 — Testes e quality gates** (AC: 1–10)
  - [x] Atualizar testes de domínio/server action e integração visual.
  - [ ] Executar testes focados, lint, typecheck, suíte completa e build.
  - [x] Atualizar checklist, Dev Agent Record e File List.

## Testing

- Domínio: sem logs, log inválido, CS recente, fronteira exata de 10 dias e status diferente.
- Autorização: Admin, TI, Recursos Humanos, role antiga no JWT versus role atual no banco e negação de CEO/demais perfis.
- Consulta: payload serializável com campos temporais nulos para `SEM_CS` e preenchidos para `CS_VENCIDO`.
- UI: sino com fila mista, modal sem formatação de data ausente, rótulos acessíveis e reconciliação após primeiro CS.
- Regressão: fluxo original de CS vencido, salvamento rápido e demais fontes da central.

## Dev Notes

- Reutilizar `src/lib/cs-nps/alertas-ultimo-cs.ts`, `buscarPendenciasUltimoCs`, `useCsNpsNotifications`, o store e `CsNpsPendenciasModal`; não criar uma segunda fila concorrente.
- A fonte de verdade de autorização é `usuarios.role` do ID autenticado. O JWT continua identificando o usuário, mas não deve ser a decisão final quando a role persistida mudou.
- Dados observados em 2026-09-17: Francielli está ativa com role `RECURSOS HUMANOS`; existem serviços em andamento com e sem histórico. A observação foi somente leitura e não alterou o banco.
- A política Vault não é acionada porque não há alteração estrutural, migration ou mutação em massa.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-17 | 1.0.0 | Story criada e pronta para desenvolvimento a partir do ajuste solicitado. | River (SM) |
| 2026-09-17 | 1.1.0 | Desenvolvimento iniciado — Status: Ready → InProgress. | @dev |
| 2026-09-17 | 1.2.0 | Funcionalidade e testes focados concluídos; story mantida InProgress por gates globais preexistentes. | @dev |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/cs-nps/alertas-ultimo-cs.test.ts tests/cs-nps/alertas-ultimo-cs-ui.test.ts tests/chamados/central-notificacoes-painel.test.ts tests/cs-nps/clientes-logs.test.ts --coverage=false` — 40/40 aprovados.
- ESLint focado nos oito arquivos TypeScript/TSX alterados — aprovado sem erros ou avisos.
- `git diff --check` — aprovado.
- `npm run build` — aprovado; 80 páginas geradas, apenas avisos preexistentes do `pdfjs-polyfill`.
- `npm run typecheck` — bloqueado por erros preexistentes em Exclusão Fiscal, Gerador de Documentos, Radar, `BibbleEmptyState.orig.tsx` e `node:sqlite`; nenhum erro no recorte da story.
- `npm test` — 3.292 aprovados, 1 todo e 20 falhas preexistentes em 12 arquivos fora do módulo CS&NPS.
- `npm run lint` — bloqueado pelo baseline global de 2.474 erros e 1.237 avisos; lint focado aprovado.
- CodeRabbit CLI indisponível; revisão manual PASS registrada em `docs/qa/coderabbit-reports/story-cs-nps-alertas-sem-cs-admin-rh.md`.

### Completion Notes List

- Incluída a classificação derivada `SEM_CS`/`CS_VENCIDO`, sem persistência ou alteração de banco.
- A central agrega os dois tipos e o modal diferencia claramente empresas sem CS, preservando o fluxo rápido existente.
- Admin, TI e Recursos Humanos são autorizados pela role/status atuais do banco; CEO e demais perfis continuam negados.
- O layout lê a role persistida atual, corrigindo o caso em que a role do JWT ficou antiga após alteração do cadastro da Francielli.
- Consulta somente leitura confirmou Francielli ativa como `RECURSOS HUMANOS`; nenhuma mutação de dados foi realizada.
- DoD parcial: requisitos, segurança, testes focados e build atendidos; lint/typecheck/suíte globais impedem promoção honesta para InReview.

### File List

- `src/lib/cs-nps/alertas-ultimo-cs.ts` — modificado.
- `src/actions/Clientes.ts` — modificado.
- `src/app/PainelAlpha/layout.tsx` — modificado.
- `src/store/useCsNpsNotificacoes.ts` — modificado.
- `src/components/layout/CentralNotificacoesPainel.tsx` — modificado.
- `src/components/cs-nps/CsNpsPendenciasModal.tsx` — modificado.
- `tests/cs-nps/alertas-ultimo-cs.test.ts` — modificado.
- `tests/cs-nps/alertas-ultimo-cs-ui.test.ts` — modificado.
- `docs/qa/coderabbit-reports/story-cs-nps-alertas-sem-cs-admin-rh.md` — criado.
- `docs/stories/story-cs-nps-alertas-sem-cs-admin-rh.md` — criado/modificado.
