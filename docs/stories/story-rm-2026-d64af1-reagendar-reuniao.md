# RM-2026-D64AF1 — Corrigir reagendamento de reunião

Status: Ready for Review (validação local; gates globais com limitações)

## Objetivo e diagnóstico
Corrigir o erro de confirmação do organizador/espaço no Alpha CRM. O cache era exigido com igualdade de link e calendário gravável; cache ausente/desatualizado impede consultar o evento real. Não há evidência de qual desses estados ocorreu em produção.

## Blueprint recebido e reinspecionado
Contexto da fase anterior: PainelReuniao → AgendarReuniaoGoogleMeetBpm/ReagendarReuniaoBpm → cache/cliente Google. Reutilizar obterUsuarioGoogleAtivoPorCalendario e dadosCacheDeEvento. Recuperar cache ausente somente com calendário gravável único; confirmar link no Google antes de PATCH. Manter auth, ownership, etapa, conexão ativa, ETag e CAS. Não remover gravavel: é permissão/configuração existente. Ambiguidade deve falhar explicitamente. Nenhuma mudança de schema ou operação em massa.

## Aceites / checklist
- [x] Inspecionar código e blueprint da fase anterior.
- [x] Recuperar cache ausente/desatualizado sem trocar evento/Meet/organizador arbitrariamente.
- [x] Distinguir ausência, calendário somente leitura e ambiguidade.
- [x] Testar sucesso e bloqueios antes de qualquer PATCH.
- [x] Executar lint, typecheck, test e build; registrar limites.
- [x] Registrar caminho de entrega e arquivos.

## Entrega
Consumidor: usuário autorizado do Alpha CRM. /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card em Agendar Reunião → Formulário da Etapa → PainelReuniao → Agendar/Reagendar. Componentes/action já existentes; não é necessário novo visualizador.

## File list
- src/actions/bpm/GoogleMeet.ts
- tests/bpm/google-meet-etapa-guard.test.ts
- docs/stories/story-rm-2026-d64af1-reagendar-reuniao.md
- docs/qa/rm-2026-d64af1/ (logs de gates)
- .bibble/memory/journal.md

## Resultado e gates reais
- Focados: 22/22 testes em google-meet-etapa-guard e reuniao-transcricao passaram.
- ESLint dos dois arquivos alterados: exit 0. git diff --check: passou.
- npm run lint e npm run typecheck: limite de 240s (exit 124), sem aprovação global.
- npm run build: EACCES ao ler .env; também terminou por limite de 240s. Nenhum segredo foi lido e permissões não foram alteradas.
- npm test: falhou por EBUSY no diretório coverage. Reexecução com --coverage.reportsDirectory=docs/qa/rm-2026-d64af1/coverage concluiu: 469 arquivos passaram, 17 falharam; 3662 testes passaram, 22 falharam, 1 todo. Não declarar gate global aprovado. Falhas em módulos fora dos arquivos alterados devem seguir para verificação; não há evidência de regressão nos 22 testes pertinentes. Logs anteriores de outras RMs já registram falhas/limites globais, mas isso não comprova individualmente a preexistência de cada falha atual.

## Compatibilidade e segurança
Mantidas sessão, Zod, ownership, etapa, conexão ativa, calendário gravável, conferência do Meet remoto, ETag e CAS. Identidade vem do card persistido; nenhuma identidade de organizador vem do cliente. Não escolher calendário quando houver mais de um candidato. Cache ausente recuperado por upsert unitário; confirmação tardia do Meet no agendamento também usa upsert. Não houve migration, mutação em massa nem acesso ao banco de produção.

DELIVERY_READY: /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card → Formulário da Etapa → CardOpenFormSlot → PainelReuniao → ReagendarReuniaoBpm. Integração confirmada no código e actions testadas com mocks; smoke autenticado Google/navegador permanece manual. Não foi comprovado qual estado do cache causou o incidente em produção.


## Revalidação local — Nova, 2026-09-23
- [x] Correção e blueprint existentes reinspecionados; código e testes anteriores preservados integralmente. Nenhum componente novo.
- [x] 22/22 testes pertinentes passaram (google-meet-etapa-guard e reuniao-transcricao); ESLint dos dois arquivos passou; diff --check do escopo passou.
- [x] Typecheck global passou (exit 0).
- [x] Suíte completa executada com diretório de coverage isolado: 470 arquivos aprovados, 16 com falha; 3663 testes aprovados, 21 falhas, 1 todo. As 21 identificações completas de falha já constam em test-isolated.log; nenhuma nova identificação de falha.
- [x] Lint global executado: 2417 erros e 1218 warnings, fora dos dois arquivos da correção; log anterior desta RM havia terminado por timeout, portanto não comprova individualmente preexistência dos diagnósticos de lint.
- [x] Build executado: exit 0. Aprovado.
- [x] Caminho UI reinspecionado: rota pipeline/[pipelineId] → card → Formulário da Etapa → CardOpenFormSlot → PainelReuniao → AgendarReuniaoGoogleMeetBpm/ReagendarReuniaoBpm. Consumidor: usuário autorizado do CRM.
- [ ] Smoke autenticado Google real e revisões independentes permanecem para verificação; delegação Forge indisponível nesta execução. Nenhuma aprovação independente emitida.

Causa verificável: a condição antiga dependia do cache exato; recuperação agora usa calendário gravável único e confirma o Meet remoto. Não foi determinado o estado exato dos dados do incidente em produção. Permissões, auth, ownership, etapa, ETag e CAS preservados. Sem banco de produção, migration ou Git mutável.

Arquivos realmente alterados nesta retomada: esta story, .bibble/memory/journal.md e docs/qa/rm-2026-d64af1/revalidation-* (logs, resultados e coverage). Build também regenerou src/generated/apresentacoes-player-bundle.ts pelo script existente; não houve edição manual nesse artefato.

DELIVERY_READY: /PainelAlpha/AlphaCRM/pipeline/[pipelineId] → card em Agendar Reunião → Formulário da Etapa → PainelReuniao → Agendar/Reagendar. Integração comprovada no código e 22 testes locais com mocks; não equivale a smoke remoto.

## Revalidação terminal de 2026-09-23

Retomada da fase 2: os testes de reagendamento e transcrição passaram **22/22**; ESLint dos arquivos de ação/testes e typecheck completo passaram. A implementação conserva sessão, autorização, calendário gravável, confirmação do evento remoto, ETag e controle de concorrência. O teste com conta Google real fica para Testes. A atribuição do `journal.md` compartilhado ainda impede staging automático isolado; nenhuma credencial ou calendário real foi usado.

## Ajuste solicitado — agenda de quem reagenda

O usuário confirmou que o reagendamento deve usar a API do Google na agenda da pessoa que solicita a ação e enviar o e-mail digitado do cliente como convidado. A busca global por `googleCalendarId` podia gerar falsa ambiguidade entre contas quando o cache do evento não existia, especialmente para o identificador `primary`.

### Aceites
- [x] Resolver o calendário gravável pelo usuário autenticado e pelo ID de calendário persistido no card.
- [x] Consultar o evento no Google com a conta desse usuário e conferir o link do Meet antes do PATCH.
- [x] Preservar os convidados existentes, incluir o e-mail do cliente uma única vez e solicitar notificações via Google Calendar.
- [x] Recusar calendário ausente, conexão de outra conta, evento ausente e identidade do Meet divergente sem alterar o evento.
- [x] Manter ETag, CAS, compensação e cache como resultado da atualização, sem exigir cache prévio.
- [x] Executar gates globais e registrar resultados abaixo.

### File list deste ajuste
- `src/actions/bpm/GoogleMeet.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `docs/stories/story-rm-2026-d64af1-reagendar-reuniao.md`

### Validação deste ajuste
- Teste focado: 16/16 passaram; ESLint dos arquivos alterados: sem erros; `git diff --check`: passou.
- `npm run typecheck`: passou.
- `npm run lint`: passou com 0 erros e 1192 avisos no repositório.
- `npm test`: 500 arquivos passaram; 3766 testes passaram, 4 ignorados e 1 todo.
- `npm run build`: passou.
- A verificação com conta Google real ainda depende de smoke autenticado; os testes locais usam mocks da API.

## Ajuste posterior — identidade do espaço Meet

O usuário reportou o bloqueio "O espaço do Google Meet foi alterado fora do painel" após o ajuste da conta solicitante. A comparação literal de URLs não representa a identidade do espaço quando parâmetros de consulta diferem. O recurso `Events` do Google também pode fornecer `hangoutLink` sem um `conferenceData.entryPoints` de vídeo.

### Aceites e checklist
- [x] Comparar o código Meet validado de ambos os links antes e depois do PATCH.
- [x] Usar `hangoutLink` da resposta da API quando o entry point de vídeo estiver ausente.
- [x] Continuar bloqueando código Meet diferente, link inválido ou evento cancelado antes de alterar o evento.
- [x] Cobrir URLs equivalentes e fallback da API com testes.
- [x] Registrar gates da execução deste ajuste.

### File list deste ajuste
- `src/actions/bpm/GoogleMeet.ts`
- `src/lib/google-calendar/client.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `tests/google-calendar/client-etag.test.ts`
- `docs/stories/story-rm-2026-d64af1-reagendar-reuniao.md`

### Validação deste ajuste
- Testes focados: 29/29 passaram, incluindo o código Meet realmente diferente; ESLint dos arquivos alterados: sem erros.
- `npm run typecheck`: passou.
- `npm run lint`: passou com 0 erros e 1192 avisos no repositório.
- `npm test`: 500 arquivos passaram; 3768 testes passaram, 4 ignorados e 1 todo.
- `npm run build`: passou; `git diff --check`: passou.
- Ainda não há evidência do conteúdo do evento Google específico que gerou a mensagem em produção; é necessário smoke autenticado para confirmar esse caso.
