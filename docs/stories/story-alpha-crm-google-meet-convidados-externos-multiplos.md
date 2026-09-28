# Story: Alpha CRM — convidados externos e múltiplos e-mails no Google Meet

## Status

In Progress — implementação concluída; gates e homologação de entrega externa em andamento.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: testes de integração Google Calendar, `lint`, `typecheck`, `test`, `build` e CodeRabbit.

## Story

**Como** usuário comercial na etapa **Agendar Reunião** do Alpha CRM, **quero** convidar pessoas de domínios externos, como Gmail e Hotmail, e informar vários e-mails pressionando Enter, **para que** todos recebam o convite da reunião pelo Google Meet.

## Contexto e dependências

O usuário relata falha ao agendar com e-mails externos Gmail/Hotmail e pede entrada de múltiplos convidados. A causa ainda não está comprovada. O diagnóstico deve distinguir rejeição de validação local, falha de autenticação/permissão do Calendar, política da conta ou do Google Workspace e erro retornado pela API. Não atribuir a falha ao domínio externo sem evidência da resposta real.

O fluxo atual usa `PainelReuniao.tsx` → `AgendarReuniaoGoogleMeetBpm`/`ReagendarReuniaoBpm` → `src/lib/google-calendar/client.ts`. A entrada atual `emailCliente` é única, validada em `email-reuniao.ts`, e o agendamento envia `participantes: [emailCliente]`. O reagendamento já combina o cliente com convidados do evento. O e-mail principal/efetivamente usado fica em `BpmCardReuniao.emailCliente` e é recuperado ao reabrir o card. Preservar essa semântica, conforme `story-rm-2026-13ca69-email-agendar-reuniao.md` e `story-rm-2026-email-reuniao-procedimento-card.md`: e-mails adicionais não substituem automaticamente o e-mail principal canônico. O modelo de participantes do evento Google Calendar já suporta uma lista de attendees; confirmar isso no contrato atual antes de propor nova persistência.

## Acceptance Criteria

1. Antes de alterar o fluxo, reproduzir ou rastrear a falha com endereço externo de teste em ambiente autorizado e registrar em diagnóstico sem expor endereço completo, token ou dados pessoais: etapa da falha, operação (criar/reagendar), classe/status da resposta Google quando houver, calendário selecionado e diferença entre Gmail/Hotmail e endereço do próprio domínio. Se a falha não for reproduzível, registrar evidência e manter testes que provem o caminho esperado.
2. O formulário de **Agendar Reunião** mantém o e-mail principal obrigatório e permite adicionar **múltiplos convidados**: ao digitar um e-mail válido e pressionar Enter, o endereço vira item individual visível; o usuário pode removê-lo antes do envio. Enter não submete o formulário prematuramente. A lista tem rótulos, estado inválido e interação por teclado acessíveis.
3. Cliente e servidor normalizam `trim` e letras minúsculas, rejeitam e-mails vazios ou inválidos e removem duplicatas sem distinção de maiúsculas/minúsculas, inclusive duplicata entre principal, adicionais e participantes já existentes. A UI indica qual endereço precisa de correção; uma chamada direta à action recebe a mesma validação e não chama o Google se os dados forem inválidos.
4. Ao criar o evento, a action envia o e-mail principal canônico e **todos os convidados adicionais válidos** como `attendees` no mesmo evento, uma vez cada. Endereços Gmail, Hotmail e outros domínios válidos seguem a mesma regra de validação, sem filtro local por domínio. A confirmação de sucesso depende de resposta válida do Google e do vínculo local concluído.
5. Ao reagendar, a action preserva os participantes já existentes no evento, inclui o principal e os convidados adicionais informados, deduplica o conjunto e mantém os guards existentes de sessão, autorização, etapa, transcrição, versão/concorrência, compensação, histórico e realtime. Um erro não cria segundo evento nem mostra dados locais como salvos antes da confirmação.
6. `BpmCardReuniao.emailCliente` continua representando somente o e-mail principal efetivamente usado. Ao reabrir o card, o campo principal mantém o valor persistido; a UI de convidados adicionais recupera os convidados do evento quando essa informação estiver disponível no contrato atual, sem confundi-los com o principal. Não criar migration apenas para duplicar a lista já armazenada pelo Calendar.
7. Falhas do Google chegam ao usuário com mensagem clara e acionável, distinguindo, quando a resposta permitir, conexão expirada/permissão, calendário não gravável, restrição de convidados externos e falha temporária. O diagnóstico técnico registra código/classe e contexto mínimo sem vazar e-mails, tokens ou payloads completos; não afirmar que o convite foi enviado quando o evento não foi confirmado.
8. Se o diagnóstico apontar configuração da conta ou do Google Workspace como causa, entregar ao usuário instruções específicas para a ação administrativa necessária e como verificar o resultado, identificando que a mudança externa exige administrador quando aplicável. Se nenhuma mudança for necessária, informar isso com a evidência correspondente. Não alterar configuração do Workspace sem autorização própria.
9. Testes cobrem Enter, remoção, principal obrigatório, inválidos e duplicatas em UI/action, criação com múltiplos attendees externos, reagendamento preservando participantes, reabertura, erro Google e ausência de atualização local indevida. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados, checklist e File List antes de concluir.

## Decisions and limits

- A causa dos endereços externos falharem é **hipótese em aberto**; AC 1 exige diagnóstico antes de correção específica.
- O e-mail principal permanece obrigatório e separado dos convidados adicionais.
- Não alterar contatos `Pessoa.email`, selecionar arbitrariamente entre contatos ambíguos, criar novo evento no reagendamento ou afrouxar autorização/guards existentes.
- O fluxo deve reutilizar o Calendar existente. Se a implementação realmente exigir coluna, migration, seed, backfill ou mutação em massa, seguir integralmente o protocolo Vault do `AGENTS.md` antes de executar a alteração.

## Tasks / Subtasks

- [x] 1. Mapear entrada UI, validações, actions e cliente Calendar; consultar o evento real e classificar o caso sem expor dados sensíveis (AC 1, 7–8).
- [x] 2. Implementar entrada acessível de convidados com Enter, remoção, validação e deduplicação, preservando o principal obrigatório (AC 2–3).
- [x] 3. Validar novamente no servidor e enviar todos os convidados como attendees no agendamento e no reagendamento, preservando participantes anteriores e guards (AC 3–5).
- [x] 4. Preservar `emailCliente` como principal e recuperar convidados adicionais do evento quando suportado pelo contrato atual (AC 6).
- [x] 5. Traduzir erros Google em mensagens claras e entregar diagnóstico com eventual ação de configuração da conta/Workspace (AC 7–8).
- [x] 6. Criar testes de domínio, UI, action e Calendar; executar lint, typecheck, test e build; atualizar checklist e File List (AC 9).
- [ ] 7. Homologar recebimento real de convite externo após publicação, com caixa destinatária e Email Log Search do administrador Workspace.

## Dev Notes

### Diagnóstico do caso informado em 2026-09-28

- Card GREEN COAST, pipeline Revisão de Radar, etapa Agendar Reunião: há evento vinculado no Google Calendar e e-mail principal do domínio `gmail.com` no registro da reunião.
- Consulta somente leitura à Google Calendar API: evento `confirmed`, Meet presente, agenda com papel `owner`, dois participantes (`alpha-comex.com` e `gmail.com`). O Gmail gravado no CRM consta no evento com status `needsAction`. Nenhum endereço completo ou identificador externo foi registrado neste diagnóstico.
- O código de criação já enviava `attendees` ao Calendar e usava `sendUpdates: "all"`; portanto, este caso não demonstra bloqueio local de domínio nem rejeição pela API. O status `needsAction` mostra ausência de resposta ao convite, mas não comprova entrega ou falta de entrega do e-mail. A verificação seguinte depende da caixa do destinatário e do Email Log Search do administrador Workspace.
- A mudança de código desta story permite vários convidados, melhora mensagens de erro da API e recupera a lista do evento; a entrega real de e-mail externo requer homologação após publicação.

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`: formulário atual de Data/Hora e e-mail único; chama agendar/reagendar.
- `src/actions/bpm/GoogleMeet.ts`: schemas e actions; criação envia `participantes: [emailCliente]`, reage ao erro e persiste `BpmCardReuniao.emailCliente` depois da confirmação.
- `src/lib/bpm/email-reuniao.ts`: validação e seleção do e-mail principal, normalização, recuperação e combinação de participantes.
- `src/lib/google-calendar/client.ts`: mapeamento de participantes para `attendees` no Calendar e merge de participantes no update.
- `src/actions/bpm/Cards.ts`: leitura do e-mail principal para reabertura do card.
- As stories anteriores citadas no contexto explicam o preenchimento inicial inequívoco e a persistência do principal. Não desfazer esses contratos.
- `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados durante a preparação; não foi inferido contexto de arquivos ausentes.

### Testing

- Preferir testes determinísticos com cliente Calendar mockado para payloads, erros, compensação e estado local. Usar ambiente autorizado com conta de teste apenas para diagnóstico e homologação da entrega real, sem registrar e-mails completos nos artefatos.
- Testar Gmail e Hotmail como exemplos de domínios externos, além de e-mails do domínio interno e variações de caixa/espaços. O resultado esperado é definido pela resposta real da API, sem presumir política do Google.
- Testar falha após criação remota e antes do vínculo local para confirmar compensação e ausência de evento órfão conforme fluxo atual.

## CodeRabbit Integration

**Primary Type:** Integration / Google Calendar. **Secondary Type(s):** Frontend, API, segurança de dados. **Complexity:** média/alta.

### Specialized Agent Assignment

- `@dev`: implementação e pre-commit.
- `@qa`: testes e revisão funcional.
- `@ux-design-expert`: componente de convidados e acessibilidade.
- `@architect`: somente se o diagnóstico exigir mudança de contrato/persistência.
- `@devops`: PR/deploy, se solicitados.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): lint, typecheck, test, build e revisão de payload/segredos.
- [ ] CodeRabbit: revisão automatizada não executada nesta iteração.
- [ ] Pre-PR (`@devops`): compatibilidade do Calendar e revisão dos erros expostos, se houver PR.
- [ ] Pre-Deployment (`@devops`): testar convite externo com conta de homologação e verificar configuração necessária, se houver deploy.

### Self-Healing Configuration

- `@dev`: light mode, até 2 iterações/15 minutos, corrigir CRITICAL e documentar HIGH.
- `@qa`: full mode, até 3 iterações/30 minutos, corrigir CRITICAL/HIGH; `@devops`: report only.

### CodeRabbit Focus Areas

- Validação no servidor e deduplicação entre principal, adicionais e attendees existentes.
- Preservação de CAS, compensação, vínculo do evento e `emailCliente` canônico.
- Exposição mínima de dados pessoais em mensagens/logs; nenhum token em histórico.
- Acessibilidade do input com Enter e itens removíveis; erros Google acionáveis.

## Initial File List

- `docs/stories/story-alpha-crm-google-meet-convidados-externos-multiplos.md` — story criada.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` — previsto: UI de convidados.
- `src/actions/bpm/GoogleMeet.ts` — previsto: contrato, attendees e erros.
- `src/lib/bpm/email-reuniao.ts` — previsto: validação/deduplicação.
- `src/lib/google-calendar/client.ts` — previsto apenas se necessário para classificação de erros ou payload.
- `src/actions/bpm/Cards.ts` — previsto apenas se necessário para leitura dos convidados na reabertura.
- `tests/bpm/` e `tests/google-calendar/` — previstos: testes de domínio, action, UI e integração.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story criada para diagnóstico de convidados externos e múltiplos e-mails no Google Meet. | River (`@sm`) |

## Dev Agent Record

### Completion Notes

Implementados múltiplos convidados com Enter, validação e deduplicação no cliente e no servidor, recuperação dos participantes do evento, mensagens de erro Google mais específicas e tolerância a falha do cache após evento confirmado. O caso real da GREEN COAST tem o Gmail entre os participantes confirmados pelo Calendar; entrega da mensagem ainda deve ser verificada fora da API do Calendar. `npm run lint`: 0 erros, 1191 warnings preexistentes. `npm run typecheck`: passou. `npm test`: 536 arquivos e 3959 testes aprovados (4 skipped, 1 todo). `npm run build`: passou. `git diff --check`: passou.

### File List

- `docs/stories/story-alpha-crm-google-meet-convidados-externos-multiplos.md`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/actions/bpm/GoogleMeet.ts`
- `src/actions/google-calendar-eventos.ts`
- `src/lib/bpm/email-reuniao.ts`
- `src/lib/google-calendar/errors.ts`
- `tests/bpm/autosave-fixed-recovery-react.test.ts`
- `tests/bpm/card-campos-agendar-reuniao.test.ts`
- `tests/bpm/email-reuniao.test.ts`
- `tests/bpm/google-meet-convidados-input-react.test.ts`
- `tests/bpm/google-meet-etapa-guard.test.ts`
- `tests/google-calendar/criar-evento-convidados-externos.test.ts`
- `tests/google-calendar/errors.test.ts`

## QA Results

Pendente.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Falha relatada e resultado esperado claros; causa tratada como hipótese. |
| Technical Implementation Guidance | PASS | UI, actions, Calendar e e-mail principal canônico identificados. |
| Reference Effectiveness | PASS | Stories anteriores resumidas nos contratos relevantes. |
| Self-Containment Assessment | PASS | Entrada, envio, reagendamento, diagnóstico e limites explícitos. |
| Testing Guidance | PASS | Casos de UI, domínio, erro Google e integração especificados. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes. |

**Final Assessment:** READY como rascunho para implementação. A causa da falha externa precisa ser comprovada no diagnóstico; mudança de Google Workspace, se necessária, será comunicada ao usuário.
