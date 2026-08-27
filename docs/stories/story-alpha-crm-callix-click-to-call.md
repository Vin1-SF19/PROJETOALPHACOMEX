# Story: Click-to-Call Callix nos telefones vinculados do Alpha CRM

## Status

In Progress — implementação concluída; gates globais ainda precisam terminar

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, revisão de segurança

## Story

**Como** usuário autorizado de um card do Alpha CRM/BPM,  
**quero** iniciar uma ligação Callix a partir de um telefone vinculado ao card,  
**para** contatar a pessoa associada sem copiar ou discar o número manualmente.

## Contexto e decisão de configuração

Esta story estende `story-alpha-crm-telefones-do-card.md`, cuja implementação já exibe o modal de telefones e protege a leitura por `exigirAcessoBpmCard(..., "visualizar")`.

A documentação Callix de Click-to-Call determina `POST {CALLIX_BASE_URL}/api/v1/click_to_call`, cabeçalho `Authorization: Bearer {token}` e corpo JSON com `user_id` (agente que realiza a chamada) e `phone` (destino). Respostas documentadas: `200` (enviado), `400`, `401` e `404`.

[AUTO-DECISION] O `user_id` Callix é individual e não pode ser global no ambiente. Com a autorização explícita do usuário e a migration já aplicada, cada registro em `usuarios` possui `callixHabilitado` (`Boolean`, padrão `false`) e `callixUserId` (`String?`). A ação usa exclusivamente o ID configurado para o usuário autenticado; ela não presume que `session.user.id` seja um ID válido na Callix. A configuração é exibida e editável somente para o role `COMERCIAL`: o toggle “Utiliza Callix” revela o campo de ID do agente e, quando habilitado, requer um ID não vazio. Para outro role ou toggle desabilitado, a configuração Callix permanece desabilitada e sem ID.

O token já existe em `.env.local` como `TOKEN_CALLIX`. Ele e `CALLIX_BASE_URL` são exclusivamente server-side: nunca podem integrar props, payload de browser, logs, mensagens de erro ou variáveis `NEXT_PUBLIC_*`. `CALLIX_USER_ID` não é variável de ambiente; é o dado de configuração individual persistido em `usuarios` e nunca é aceito do browser pela action de chamada.

## Acceptance Criteria

1. No modal de telefones vinculados do detalhe do card, cada telefone listado possui uma ação acessível de “Ligar” que pode ser acionada por mouse e teclado; o modal permanece aberto durante e após a tentativa.
2. A action que inicia a ligação exige sessão autenticada e revalida autorização `visualizar` para o `cardId` com a fonte de verdade `exigirAcessoBpmCard`; uma chamada sem acesso não alcança a Callix.
3. A action aceita somente o identificador do card e o telefone selecionado; ela não aceita `TOKEN_CALLIX`, URL-base ou `user_id` fornecidos pelo cliente.
4. O destino enviado à Callix é derivado de um telefone que pertence à lista autorizada de pessoas vinculadas à empresa do card, e não de valor arbitrário enviado pelo browser. Telefones devem ser normalizados removendo espaços, parênteses, hífens e demais caracteres não numéricos; um número vazio ou inválido não dispara a chamada.
5. A integração server-side consulta o usuário autenticado em `usuarios` e só chama a Callix quando seu `role` é `COMERCIAL`, `callixHabilitado` é `true` e `callixUserId` é não vazio. Ela envia `POST ${CALLIX_BASE_URL}/api/v1/click_to_call` com `Content-Type: application/json`, `Authorization: Bearer ${TOKEN_CALLIX}` e corpo `{ "user_id": "<callixUserId-do-usuário-autenticado>", "phone": "<telefone-normalizado>" }`.
6. `TOKEN_CALLIX` ou `CALLIX_BASE_URL` ausentes ou vazios impedem a chamada e retornam mensagem segura de indisponibilidade/configuração. Usuário não comercial, sem habilitação Callix ou sem `callixUserId` também não aciona a Callix e recebe mensagem segura de que seu usuário não está habilitado. Nenhum fluxo expõe nomes, valores ou conteúdo das variáveis de ambiente.
7. O formulário de colaborador exibe a seção de configuração Callix somente quando o role selecionado é `COMERCIAL`. Nela, o toggle “Utiliza Callix” revela o input “ID do agente na Callix”; habilitar sem fornecer ID impede o salvamento. Ao desabilitar o toggle, ou ao salvar usuário em outro role, `callixHabilitado` é `false` e `callixUserId` é limpo.
8. Com resposta HTTP `200` da Callix, a UI informa que a ligação foi solicitada com sucesso; pode usar `click_to_call_id` somente como metadado server-side/seguro e não deve prometer conexão concluída.
9. Para resposta `400`, `401`, `404`, outro status não-2xx, timeout ou falha de rede, a UI deixa de carregar, apresenta erro compreensível e permite nova tentativa; detalhes internos e corpo da resposta não são expostos ao usuário.
10. Enquanto uma solicitação estiver em andamento, apenas a ação daquele telefone fica indisponível e apresenta estado de carregamento; cliques repetidos não geram requisições concorrentes para o mesmo item.
11. O botão/modal preserva os estados já existentes de carregamento, lista vazia e erro da busca de telefones, e mantém nome acessível, foco visível e feedback anunciável para leitores de tela.
12. São adicionados testes para autorização antes da chamada externa, seleção autorizada do telefone, normalização, payload/headers corretos, segredos ausentes, usuário sem configuração/habilitação Callix, sucesso e cada família de falha. Também devem cobrir persistência da configuração individual, sua visibilidade exclusiva para `COMERCIAL` e o ID obrigatório quando habilitado. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados, distinguindo bloqueios preexistentes de regressões.
13. A migration aditiva aprovada adiciona `usuarios.callixHabilitado` (`Boolean`, padrão `false`) e `usuarios.callixUserId` (`String?`). Não há seed, backfill ou mutação em massa; a migration já foi aplicada com backup Vault válido e autorização explícita do usuário.

## Blueprint de Integração

### Editar

- `src/actions/bpm/Cards.ts` — manter a autorização já usada em `ListarTelefonesCardBpm` e adicionar a action server-side de Click-to-Call.
- `src/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton.tsx` — incluir ação por telefone e estados de envio/sucesso/erro sem fechar o dialog.
- `prisma/schema.prisma` e `prisma/migrations/20260827153000_add_callix_user_settings/migration.sql` — persistir a habilitação e o ID Callix por usuário, com migration somente aditiva já aprovada/aplicada.
- `src/actions/ColaboradorRH.ts` — validar e persistir a configuração individual; limpar os campos quando o role não for `COMERCIAL` ou o toggle estiver desabilitado.
- `src/components/Colaboradores/ModalPerfilColaborador.tsx` — exibir o toggle e o input de ID exclusivamente para `COMERCIAL`.
- `src/lib/callix/click-to-call.ts` — manter token e URL-base server-side; receber o `callixUserId` já autorizado pela action.
- `tests/bpm/card-telefones.test.ts` — ampliar cobertura da action ou criar teste dedicado em `tests/bpm/` seguindo o mesmo padrão de mocks.
- `.env.example` — documentar somente os nomes `TOKEN_CALLIX` e `CALLIX_BASE_URL`, sem valores reais.

### Consultar

- `src/lib/bpm/ownership.ts` — `exigirAcessoBpmCard` é a fonte única de autorização por card.
- `src/actions/bpm/Cards.ts#ListarTelefonesCardBpm` — fonte da associação autorizada card → empresa → pessoas/telefones.
- `prisma/schema.prisma#model usuarios` — fonte do `role`, `callixHabilitado` e `callixUserId` do usuário que inicia a chamada.
- [Documentação Callix — Click to Call](https://callixbrasil.github.io/docs/acoes/click-to-call) — contrato da chamada externa e status documentados.

## Tasks / Subtasks

- [x] Criar uma action server-side para Click-to-Call, validando sessão, ownership do card e pertencimento do telefone antes do `fetch` (AC: 2, 3, 4).
- [x] Criar e aplicar, com aprovação explícita e backup Vault válido, migration aditiva para `callixHabilitado` e `callixUserId` em `usuarios` (AC: 13).
- [x] Configurar o formulário de colaborador: seção exclusiva de `COMERCIAL`, toggle, ID obrigatório quando habilitado e limpeza consistente nos demais estados (AC: 7).
- [x] Ler e validar `TOKEN_CALLIX` e `CALLIX_BASE_URL` no servidor; obter o `callixUserId` do usuário autenticado e construir URL, headers e payload conforme o contrato Callix, sem vazar segredos (AC: 5, 6).
- [x] Normalizar o destino para somente dígitos e tratar erro, timeout e respostas não-2xx de forma segura (AC: 4, 8).
- [x] Integrar botão de ligar por contato, feedback acessível e bloqueio de requisição duplicada por item (AC: 1, 7, 9, 10).
- [x] Documentar as chaves de configuração em `.env.example` sem copiar token ou URL/ID reais (AC: 6).
- [ ] Executar os gates globais e atualizar esta story com resultados completos (AC: 11).

## Testing

- Vitest deve mockar `auth`, `exigirAcessoBpmCard`, Prisma e `fetch`; nunca usar token real em testes.
- Validar que acesso negado, telefone fora do vínculo e telefone vazio não chamam `fetch`.
- Validar URL, `POST`, headers e corpo normalizado, incluindo `user_id` persistido para o usuário autenticado e habilitado.
- Validar que usuário não `COMERCIAL`, Callix desabilitada ou ID ausente não chamam `fetch`.
- Validar que a configuração aparece apenas para `COMERCIAL`, exige ID quando habilitada e é limpa ao desabilitar ou trocar para outro role.
- Validar sucesso `200`, códigos documentados (`400`, `401`, `404`), outro não-2xx, exceção/timeout e configuração de ambiente ausente.
- Verificação manual: configurar um colaborador comercial habilitado com ID Callix, abrir card autorizado, iniciar uma ligação, observar carregamento e sucesso; simular falha e confirmar retry, foco e que token/ID não aparecem indevidamente no DevTools/UI.

## CodeRabbit Integration

- **Story Type Analysis:** integração externa e segurança; secundário frontend; complexidade média.
- **Primary Agents:** `@dev`, `@qa`.
- **Supporting Agents:** `@ux-expert` para acessibilidade; `@github-devops` no PR/deploy.
- **Quality Gates:** Pre-Commit (`@dev`), Pre-PR (`@github-devops`) e Pre-Deployment (`@github-devops`, se aplicável).
- **Expected Self-Healing:** `@dev` light, até 2 iterações/15 min: CRITICAL auto-fix; HIGH documentado.
- **Focus Areas:** autorização server-side, SSRF/URL de ambiente controlada, validação do destino, proteção de segredo, tratamento de falhas e acessibilidade dos estados assíncronos.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Dependência e benefício explícitos. |
| Technical Implementation Guidance | PASS | Contrato Callix, configuração individual persistida, arquivos e limites server-side definidos. |
| Reference Effectiveness | PASS | Referência direta ao endpoint e ao fluxo já implementado. |
| Self-Containment Assessment | PASS | `user_id` individual, URL do tenant e condições de habilitação foram explicitados. |
| Testing Guidance | PASS | Cenários de autorização, payload, configuração individual, UI por role e falhas definidos. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates e focos preenchidos. |

**Final Assessment:** IN PROGRESS — a migration aditiva aprovada e a configuração individual por colaborador comercial estão registradas. Requer `CALLIX_BASE_URL` e `TOKEN_CALLIX` válidos do tenant, além de habilitar e informar o ID Callix de cada agente comercial que utilizará a função. Gates globais ainda pendem.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-27 | 1.0 | Story criada para integrar Click-to-Call Callix ao modal de telefones do Alpha CRM/BPM. | River |
| 2026-08-27 | 1.1 | Requisito aprovado: `user_id` Callix passa a ser individual em `usuarios`; configuração exclusiva de `COMERCIAL`; migration já aplicada. | River |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/bpm/card-telefones.test.ts tests/lib/callix/click-to-call.test.ts --coverage.enabled=false` — 14/14 PASS.
- Migration aplicada: `prisma/migrations/20260827153000_add_callix_user_settings/migration.sql` — 2 statements aditivos.
- Pós-validação remota: colunas existentes; 30 usuários preservados e 0 habilitados (padrão seguro).
- Backup pré-alteração validado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-08-27T17-18-39-459Z.sql` — 21.769.673 bytes, 254 tabelas, 47.421 registros e SHA-256 conferido.
- `npx eslint` nos arquivos alterados, `npm run lint`, `npm run typecheck` e `npm test` foram iniciados, mas não produziram conclusão dentro da janela de execução disponível; `npm run build` permanece pendente.

### Completion Notes List

- A Callix é chamada exclusivamente no servidor, usando `TOKEN_CALLIX`, `CALLIX_BASE_URL` e o `callixUserId` do usuário autenticado habilitado.
- A action repete a autorização do card e confirma que o telefone pertence à empresa associada antes da chamada externa.
- Cada contato tem ação acessível de ligar, com carregamento e feedback anunciado sem fechar o modal.
- A configuração do agente Callix foi adicionada ao perfil do colaborador comercial e a migration aditiva foi aplicada após autorização explícita.

### File List

- `.env.example`
- `docs/stories/story-alpha-crm-callix-click-to-call.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260827153000_add_callix_user_settings/migration.sql`
- `src/actions/ColaboradorRH.ts`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton.tsx`
- `src/lib/callix/click-to-call.ts`
- `tests/bpm/card-telefones.test.ts`
- `tests/lib/callix/click-to-call.test.ts`

## QA Results

_A preencher durante a revisão QA._
