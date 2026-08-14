# Story — Alpha CRM: autorização e segurança de backend

Status: Ready for Review

## Objetivo

Um usuário autenticado sem permissão CRM efetiva, inativo, ou sem escopo do
card/pipeline não pode ler nem alterar dados do CRM/BPM por Server Actions ou
rotas da API.

## Critérios de aceite

- [x] A permissão é resolvida no banco a cada operação; `role` enviado pela sessão não é fonte de autoridade.
- [x] Cards, dashboard, perfil consolidado, tarefas e presets respeitam escopo por card/pipeline.
- [x] Vínculos exigem acesso ao card de origem e destino; histórico cruzado omite cards não autorizados.
- [x] Configuração de pipeline exige administrador ativo resolvido no banco.
- [x] A escrita de histórico é helper interno `server-only`, não uma Server Action chamável.
- [x] Operações transacionais revalidam acesso imediatamente antes da persistência; Meet revalida antes da chamada externa.
- [x] Upload mantém validação de acesso do card. URLs públicas do Blob permanecem risco residual documentado.

## Decisões de segurança

- Perfil consolidado sem cards acessíveis responde como não encontrado, evitando enumeração de empresas.
- Usuários não administradores veem somente cards onde são membros, inclusive no board, dashboard e tarefas globais.
- A automação por cron não usa autenticação humana e mantém sua proteção exclusiva por `CRON_SECRET`.

## Risco residual conhecido

Os anexos usam Vercel Blob com URL pública, pois o armazenamento atual não tem
proxy autenticado de download. A autorização protege upload, registro e
metadados do card, mas quem já possuir uma URL Blob pública poderá acessá-la.
Corrigir isso requer mudança arquitetural para Blob privado + rota autenticada,
fora do escopo desta story.

## Validação executada

- `npx vitest run tests/bpm --reporter=dot` — 27 arquivos, 188 testes aprovados.
- `npx eslint src/actions/bpm src/lib/bpm/ownership.ts src/lib/bpm/historico-server.ts src/app/api/bpm/upload/route.ts` — aprovado.
- `git diff --check` — aprovado (avisos CRLF sem erro).
- `npx tsc --noEmit --pretty false` — falha apenas em 5 erros preexistentes fora do CRM (`ExclusaoFiscal`, `HabilitacaoRadarClient`, `sync-queue.test`).

## Hardening complementar — anexos, presets, realtime e transcrição

- Anexos novos usam `access: "private"`. O upload devolve exclusivamente um
  recibo HMAC de curta duração, ligado a card, pathname, nome, MIME e tamanho;
  `RegistrarAnexoBpm` não aceita URL fornecida pelo cliente.
- A UI só aponta para `/api/bpm/anexos/[anexoId]`. A rota revalida `visualizar`
  no card e obtém o stream do Blob privado sem expor a URL do storage.
- Anexos legados em Blob público continuam um risco residual para quem já
  possuía a URL antes desta correção. O CRM não a lista nem a devolve mais; a
  revogação efetiva exige migrar os objetos para Blob privado e excluir os
  públicos em operação posterior, com backup e plano de rollback próprios.
- `ListarTarefaPresetsBpm()` sem pipeline retorna apenas presets globais. Um
  preset local só aparece com `pipelineId` autorizado.
- O canal Pusher do pipeline exige CRM e pertencimento ao setor do pipeline
  (ou administração). Ser membro de um único card não libera metadados dos
  outros cards do board; esse perfil permanece com leituras diretas autorizadas,
  mas sem realtime do pipeline.
- A sincronização manual do Meet recebe revalidação de autorização dentro da
  transação, imediatamente antes do `updateMany` da transcrição.
- `CRM_ANEXO_RECEIPT_SECRET` é obrigatório e separado de
  `CRM_READ_WRITE_TOKEN`. O mesmo recibo só pode apontar ao mesmo pathname e
  card; retries retornam o anexo já criado sem novo histórico ou notificação.
- `CRM_ANEXO_RECEIPT_SECRET` precisa estar configurado tanto no ambiente local
  quanto em produção; o seu valor nunca deve ser versionado em `.env`.
- A unicidade de `BpmCardAnexo(cardId, url)` é aplicada pela evidência manual
  [`20260813_bpm_card_anexo_unique.sql`](../../prisma/manual-migrations/20260813_bpm_card_anexo_unique.sql).
  Em uma corrida, o conflito Prisma `P2002` é recuperado após nova checagem de
  acesso e devolve o anexo vencedor, sem segundo histórico ou evento realtime.
- Agendar e reagendar Google Meet recusam no servidor qualquer card fora de
  **Agendar Reunião**. A etapa é conferida antes da chamada ao Calendar e de
  novo dentro da transação, usando CAS para não persistir um resultado que
  concorra com uma movimentação do card.
- Os contadores do dashboard são derivados do conjunto de cards visível ao
  usuário; não há `_count.cards` bruto do pipeline para membros não-admin.

## Arquivos principais

- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/historico-server.ts`
- `src/actions/bpm/{Cards,Dashboard,Empresas,Vinculos,Tarefas,Campos,Etapas,Pipelines,Anexos,GoogleMeet,Interacoes,FollowUp}.ts`
- `src/app/api/bpm/upload/route.ts`
- `prisma/manual-migrations/20260813_bpm_card_anexo_unique.sql`
