# Story — Operacional: Alinhamento Estratégico agendado

## Status

Reaberta em 29/09/2026 — atualização do pipeline Operacional ativo

## Retomada — decisões e critérios atuais

- A etapa ativa é `draft-stage-fea7d252-8276-439f-9b39-c676c15d7cf9`, pipeline Operacional v9, formulário v1 com 19 componentes e nenhum card. Os três campos descritos na versão antiga desta story não foram publicados nessa etapa; o resumo em texto existe apenas no Radar.
- `[USER-DECISION]` O responsável é a **analista interna** atribuída em Boas-vindas. Seu nome e CPF devem vir da mesma conta de usuário; as três analistas elegíveis verificadas têm CPF cadastrado. Não criar nome/CPF desconectados do cadastro.
- `[USER-DECISION]` O compromisso criado em Boas-vindas deve alertar **30 minutos antes**. A analista deve receber lembrete no Painel Alpha, além do lembrete do evento Google.
- `[USER-DECISION]` O avanço exige **somente o link do resumo**. O texto do resumo pode permanecer opcional. O link deve ser uma URL HTTPS válida e estar salvo no card antes de sair da etapa.
- Os resumos disponíveis no Google Meet devem aparecer na coluna quando o Meet os oferecer, para facilitar a cópia do link. Ausência de artefato automático não dispensa o link exigido; ele pode ser colado manualmente.
- Nome, CPF derivado, link e requisito de saída devem aparecer em Configurações → Campos e Formulários. A validação autoritativa segue a configuração publicada, inclusive em movimento por botão, arraste ou automação.

### Checklist da retomada

- [x] Inventariar etapa/formulário/campos e confirmar identidade do responsável, link e antecedência com o usuário.
- [x] Criar campos configuráveis de nome/CPF canônicos e link do resumo; publicação do formulário/requisito de saída aguarda Vault.
- [x] Exibir artefatos do Meet na etapa e alerta de link pendente.
- [x] Criar lembrete de 30 minutos para a analista no agendamento de Boas-vindas e no Google Agenda.
- [x] Cobrir CPF vinculado, URL do resumo, reminder e UI com testes; rodar lint, typecheck, test e build.
- [ ] Antes de aplicar configuração no Turso: relatório Vault, backup completo validado em até 48 horas e autorização específica para esta operação.

## Objetivo

> Histórico da primeira versão: as seções abaixo até “File List” registram a proposta anterior de resumo em texto. Para a configuração ativa, prevalecem as decisões e o checklist da retomada de 29/09/2026 acima: analista interna canônica e somente link HTTPS obrigatório na saída.

Tornar a etapa **Alinhamento Estratégico agendado** operacional: lembrar visualmente a chamada pendente, registrar seu resumo com template, identificar o responsável pelo processo por nome e CPF e bloquear a saída sem o resumo persistido.

## Decisões de implementação

- O alerta é visual, persistente e aparece no board e no formulário enquanto o campo **Resumo da reunião** estiver vazio. Não há data/hora da chamada configurada na etapa, portanto não será inventado cron ou notificação temporal.
- O template inserível contém: participantes, objetivo, pontos discutidos, decisões e próximos passos.
- Os campos diretos obrigatórios da etapa são: **Responsável pelo processo**, **CPF do responsável** e **Resumo da reunião**.
- CPF recebe validação algorítmica no frontend/backend. O resumo usa campo longo.
- A regra de saída é revalidada no backend antes e dentro da transação; drag-and-drop, botão e action direta convergem no mesmo bloqueio.
- Não há schema ou migration: os dados usam `BpmCampo`/`BpmCardCampoValor` existentes.

## Acceptance Criteria

1. Cards em Alinhamento Estratégico agendado sem resumo mostram alerta vermelho no board e no formulário.
2. O formulário central da etapa expõe os três campos, inclusive se vazios.
3. O resumo tem botão para inserir o template sem sobrescrever texto já digitado.
4. CPF inválido é recusado no cliente e no backend.
5. Nenhum caminho de movimento permite sair da etapa sem resumo persistido.
6. Nome e CPF do responsável podem ser preenchidos e editados posteriormente dentro do card.
7. Campos são configurados na etapa Operacional já criada, sem alterar schema.
8. Histórico/realtime/CAS existentes são preservados.

## Tasks

- [x] Criar helpers de etapa, template e validação de CPF.
- [x] Suportar os tipos de campo `texto_longo` e `cpf` no editor/validador.
- [x] Configurar os campos obrigatórios da etapa no pipeline Operacional.
- [x] Aplicar alerta e template no formulário e no board.
- [x] Estender o guard de transição, com validação pré e transacional.
- [x] Cobrir os fluxos com testes e executar quality gates.

## File List

- `src/lib/bpm/alinhamento-estrategico.ts`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/alinhamento-estrategico.test.ts`

### File List da retomada de 29/09/2026

- `docs/stories/story-alpha-crm-operacional-alinhamento-estrategico.md`
- `scripts/diagnosticar-alinhamento-operacional.mts`
- `scripts/configurar-alinhamento-operacional.mts`
- `scripts/verificar-alinhamento-operacional.mts`
- `src/lib/bpm/alinhamento-estrategico.ts`
- `src/lib/bpm/campos-configuraveis.ts`
- `src/lib/bpm/campos-configuraveis-server.ts`
- `src/lib/bpm/ontology.ts`
- `src/lib/bpm/transicao-command.ts`
- `src/lib/validations/bpm.ts` (somente enum da fonte `USUARIO`; demais edições locais são de outro trabalho)
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelAlinhamentoEstrategico.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/alinhamento-estrategico.test.ts`
- `tests/bpm/boas-vindas-agendamento-action.test.ts`
- `tests/bpm/campos-configuraveis.test.ts`
- `tests/bpm/campos-globais-cliente.test.ts`
- `tests/bpm/crud-campos-bpm.test.ts`
- `tests/bpm/exclusao-modal-board-react.test.ts`

### Evidência da retomada

- Prévia read-only: Operacional v9 → v10; Alinhamento v1 → v2, 19 → 22 componentes; nome, CPF e link visíveis em 12 etapas; quatro requisitos de saída (responsável, nome, CPF, link). Nenhum card existente alterado.
- As analistas elegíveis (IDs 15, 32 e 34) têm CPF cadastrado e válido; a verificação expõe somente presença/validade, sem dados pessoais.
- `npm run lint`: 0 erros, 1.191 avisos preexistentes após correção do painel.
- `npm run typecheck`: aprovado no commit isolado `05ade97c` após geração dos artefatos pelo build.
- `npm test`: 558 arquivos, 4.094 testes aprovados, 4 ignorados, 1 pendente no worktree isolado do commit da feature; a correção posterior alterou somente a tipagem do verificador de publicação.
- Uma nova execução durante alterações paralelas do fluxo de upload terminou com 8 falhas em `tests/bpm/arquivo-persistencia-react.test.ts`; não são deste recorte. Os testes focados de Alinhamento, Boas-vindas e campos passaram novamente. Repetir a suíte antes de enviar/deployar quando o trabalho paralelo estabilizar.
- `npm run build`: aprovado no commit isolado `05ade97c`.
- Backup Vault dedicado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T17-20-36-026Z.sql`, concluído às 17:25:13 UTC; 182.704.706 bytes, 332 tabelas, 194.611 linhas. Manifesto adjacente com SHA-256 `74571a777e90ee17be7b048fc20741396c931530fbba6e80bd2679dd4ec3ed8e`. Restauração isolada aprovada por `scripts/verify-turso-backup.mjs`: hash, tamanho, integridade, chaves estrangeiras, tabelas e linhas.
- `prisma migrate diff --script`: migration vazia; não há alteração de schema.
- Publicação no Turso aguarda autorização específica. Até lá, o código permanece preparado localmente.

## Validação

- `npx vitest run tests/bpm` — 42 arquivos / 247 testes passaram.
- ESLint focado — passou.
- `git diff --check` — passou.
- `npx tsc --noEmit` permanece bloqueado por erros anteriores fora deste recorte, incluindo cliente Prisma desatualizado e módulos de CS/NPS, Exclusão Fiscal, Habilitação Radar e testes de Google Calendar. O único erro novo desta story foi corrigido antes da regressão BPM.
