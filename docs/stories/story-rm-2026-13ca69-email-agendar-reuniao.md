# RM-2026-13CA69 — E-mail na etapa Agendar Reunião

## Status

Concluída — aguardando testes de homologação.

## Objetivo

Adicionar ao formulário existente de **Agendar Reunião** um e-mail obrigatório do cliente e enviar esse destinatário como participante do evento Google Calendar, tanto no primeiro agendamento quanto no reagendamento.

## Escopo confirmado

- Reutilizar `PainelReuniao`, `AgendarReuniaoGoogleMeetBpm` e `ReagendarReuniaoBpm`.
- Expor no detalhe autorizado do card somente um e-mail inicial inequívoco:
  - o único vínculo ativo marcado como principal e com e-mail válido; ou
  - na ausência de principal, o único vínculo ativo com e-mail válido.
- Permitir correção manual do endereço antes de enviar.
- Normalizar com `trim` e letras minúsculas e validar no cliente e no servidor.
- Criar e reagendar o evento com o e-mail informado entre os participantes, sem duplicação e preservando os participantes existentes no reagendamento.
- Manter os guards atuais de autenticação, ownership, etapa, transcrição, ETag/CAS, histórico e realtime.

## Fora de escopo

- Alterar `Pessoa.email` ou escolher automaticamente entre vários contatos ambíguos.
- Criar tabela, coluna, migration ou persistir o e-mail no `BpmCard`.
- Criar outro formulário ou outro fluxo de Calendar/Meet.
- Alterar regras de transição de etapa.

## Banco de dados

`DATABASE_CHANGE_NOT_REQUIRED`: `Pessoa.email`, `PessoaClienteVinculo.principal` e `PessoaClienteVinculo.ativo` já suportam o preenchimento inicial. Nenhuma migration, backup ou mutação de dados é necessária.

## Critérios de aceite

1. O formulário de Agendar Reunião mostra o campo **E-mail do cliente** com `type="email"`, autocomplete, label associada, estado inválido e mensagem de erro.
2. Um e-mail inequívoco de pessoa ativa vinculada à empresa preenche inicialmente o campo; casos ambíguos permanecem vazios.
3. E-mail vazio ou inválido impede a chamada externa e retorna erro também em chamada direta à Server Action.
4. O e-mail é normalizado e enviado em `participantes` ao criar o evento.
5. O reagendamento inclui o e-mail normalizado, elimina duplicatas e preserva os participantes já existentes no evento.
6. Os bloqueios existentes de sessão, ownership, etapa, reunião duplicada, transcrição e concorrência permanecem ativos.
7. Testes cobrem seleção inequívoca, validação, normalização e payload de criação/reagendamento.
8. Gates relevantes (`eslint` escopado, typecheck, testes e build) são executados e registrados.

## Plano por fase

- [x] Fase 0 — Auditoria somente leitura e confirmação do fluxo real.
- [x] Fase 1 — Blueprint técnico e critérios de aceite.
- [x] Fase 2 — Story e mapa de integração.
- [x] Fase 3 — Vault: `DATABASE_CHANGE_NOT_REQUIRED`.
- [x] Fase 4 — Backend, validação e participantes do Calendar.
- [x] Fase 5 — UI acessível, preenchimento inicial e estados.
- [x] Fase 6 — Forge: lint, tipos, testes e build.
- [x] Fase 7 — Probe: testes funcionais e de regressão.
- [x] Fase 8 — Anubis: revisão de segurança.
- [x] Fase 9 — Lens: revisão de qualidade e contrato.
- [x] Fase 10 — Sage: verificação de aceite.
- [x] Fase 11 — Scribe: documentação e memória.
- [x] Fase 12 — Kowalski: journal e fechamento.

## Evidências dos gates

- `git diff --check`: aprovado.
- ESLint escopado: zero erros; um warning preexistente em `Cards.ts:1486`, fora das linhas da RM.
- Testes relevantes: 13 arquivos, 98 testes aprovados.
- Build de produção: aprovado (`next build`, 78 páginas estáticas geradas).
- Typecheck global: sem diagnóstico nos arquivos desta RM; falhou por débitos já existentes em Exclusão Fiscal, Gerador de Documentos, Calendário e testes legados.
- Suíte global: 2.333/2.383 testes aprovados; 50 falhas fora do escopo, reproduzidas em módulos e arquivos não alterados pela RM.

## Revisões finais

- Segurança: aprovado; leitura de e-mail ocorre após sessão/ownership, o payload é validado novamente no servidor e o endereço não entra em logs ou histórico.
- Arquitetura: aprovado; reutiliza o formulário, as actions e o cliente Calendar existentes, sem endpoint ou persistência paralela.
- Aceite: aprovado; validação, preenchimento inequívoco, criação, reagendamento, deduplicação, preservação de convidados e notificação Google possuem cobertura automatizada.

## File list

- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/lib/bpm/email-reuniao.ts`
- `src/lib/google-calendar/client.ts`
- `tests/bpm/email-reuniao.test.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `tests/bpm/card-campos-agendar-reuniao.test.ts`
- `tests/google-calendar/client-etag.test.ts`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/stories/story-rm-2026-13ca69-email-agendar-reuniao.md`
