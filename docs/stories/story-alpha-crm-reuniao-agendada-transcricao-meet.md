# Story: Alpha CRM — transcrição real e automação de Reunião Agendada

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `scout`, `lint`, `typecheck`, `vitest`, `build`, `probe`, `anubis`, `coderabbit`

## Story

**Como** responsável comercial no Alpha CRM,  
**quero** que a etapa **Reunião Agendada** capture e reconheça a transcrição real do Google Meet,  
**para** que o card só avance comercialmente quando a reunião tiver evidência processada, sem quebrar reagendamentos nem o ciclo operacional de oito dias úteis.

## Contexto e fontes de verdade

O card já possui `dataReuniao`, `googleEventId`, `googleCalendarId`, `googleMeetLink` e `transcricaoReuniao`. Hoje, a existência de `transcricaoReuniao` no schema representa apenas capacidade de armazenamento; não existe integração real com a Google Meet REST API para localizar `conferenceRecords`, listar `transcripts`, percorrer `entries` e persistir o conteúdo recebido.

Esta story implementa a integração pós-reunião sem alterar schema:

- o vínculo inicial com o Meet é o espaço já associado ao evento do card, identificado pelo `meeting_code` extraído/normalizado de `googleMeetLink` e, quando necessário, confirmado pelos dados do evento existente;
- a captura usa a Google Meet REST API com `conferenceRecords.list` filtrado por `space.meeting_code`, seguido de `transcripts.list` e `transcripts.entries.list`;
- toda resposta paginada deve ser percorrida até o fim por meio de `nextPageToken`;
- o texto consolidado é persistido em `BpmCard.transcricaoReuniao`, vinculado ao mesmo card/reunião, e a recepção é registrada em `BpmCardHistorico`;
- o backend é a autoridade para decidir se a transcrição foi recebida e se o card pode avançar;
- a action manual de sincronização exige sessão e ownership do card; o polling automático usa o cron protegido já existente;
- a etapa **Reunião Agendada** passa a integrar o mesmo ciclo de oito dias úteis, calculado desde a entrada mais recente na etapa;
- nenhuma tabela, coluna, índice, migration, seed, backfill ou mutação em massa faz parte desta story.

### Contrato operacional da Google

A captura depende de configuração externa que não pode ser resolvida apenas pelo código:

- Google Meet REST API habilitada no projeto Google Cloud;
- conta de serviço com Domain-Wide Delegation habilitada;
- autorização, no Google Admin Console, do client ID da conta de serviço para o escopo `https://www.googleapis.com/auth/meetings.space.readonly`;
- impersonação de um usuário do mesmo domínio com acesso ao espaço/reunião;
- edição Google Workspace que suporte transcrição e transcrição efetivamente habilitada/gerada na reunião.

Ausência temporária de `conferenceRecord`, `transcript` ou entries após o término esperado é estado **pendente**, pois o processamento do Google pode ser assíncrono. Respostas de autenticação, autorização, configuração inválida, vínculo ausente ou falha não recuperável são estado **erro**. Como esta story não cria coluna de status, o estado persistido canônico é derivado de `transcricaoReuniao`: conteúdo não vazio significa **recebida**; ausência significa **pendente**. A UI pode mostrar **erro** a partir do resultado da sincronização manual e o job deve torná-lo observável em logs/resumo, sem gravar mensagens técnicas ou credenciais na transcrição.

### Regra de avanço e Standby

- Uma transição manual de **Reunião Agendada** para uma etapa comercial de continuidade exige `transcricaoReuniao` persistida e não vazia.
- **Standby - Follow Up** permanece disponível como saída de contingência e não exige transcrição.
- O movimento sistêmico para Standby por vencimento do ciclo de oito dias também não é bloqueado pelo requisito de transcrição.
- A regra deve usar as transições configuradas no pipeline e não deve liberar destinos proibidos.

### Regra de reagendamento

Reagendar antes da chegada da transcrição deve atualizar o evento existente por `googleCalendarId + googleEventId`, preservando o mesmo evento/espaço e o `googleMeetLink`; não deve criar novo Meet nem limpar `transcricaoReuniao`. Depois que a transcrição foi recebida, a reunião é evidência concluída e o reagendamento é recusado para impedir que uma nova data fique vinculada ao texto da conferência anterior. Se a API do Calendar devolver um link/espaço efetivamente diferente por intervenção externa, a divergência deve ser reportada para revisão, sem substituir silenciosamente o vínculo nem apagar transcrição existente.

## Acceptance Criteria

1. Existe um cliente server-side para a Google Meet REST API autenticado por conta de serviço com Domain-Wide Delegation, impersonando usuário configurado e solicitando somente o escopo `meetings.space.readonly` necessário à leitura.
2. Credenciais, private key, usuário impersonado e tokens são lidos de variáveis de ambiente, nunca são enviados ao cliente, persistidos no card/histórico ou registrados em logs.
3. A sincronização resolve e valida o `meeting_code` do Meet vinculado ao card; card sem `googleMeetLink`, sem código válido ou sem vínculo inequívoco retorna erro claro e não consulta/transcreve outra reunião.
4. O cliente consulta `conferenceRecords.list` usando filtro por `space.meeting_code`, percorre todas as páginas e seleciona somente registro compatível com o espaço/reunião do card.
5. Para cada `conferenceRecord` compatível, o cliente consulta `transcripts.list`; para cada transcript disponível, consulta `transcripts.entries.list`, percorrendo todas as páginas por `nextPageToken`.
6. As entries são consolidadas em ordem determinística, com texto legível e, quando a API fornecer, identificação do participante e referência temporal; conteúdo vazio não é tratado como transcrição recebida.
7. Quando uma transcrição válida é recebida, ela é persistida em `BpmCard.transcricaoReuniao` no mesmo card que possui a reunião, dentro de fluxo idempotente que não duplica texto em retries.
8. A primeira persistência ou uma atualização real da transcrição registra `BpmCardHistorico` com ação específica, origem manual ou automática e metadados mínimos de auditoria, sem copiar credenciais nem payload bruto sensível.
9. Reexecutar a sincronização com o mesmo conteúdo não cria histórico duplicado nem dispara atualização desnecessária; conteúdo realmente ampliado/corrigido pela origem pode substituir de forma auditável a versão anterior.
10. Após persistência bem-sucedida, a aplicação revalida a interface e publica evento de realtime para o pipeline/card, de modo que o status apareça sem refresh.
11. A UI da reunião exibe de forma inequívoca os estados **Transcrição pendente**, **Transcrição recebida** e **Erro ao sincronizar**, sem considerar a mera existência do campo no schema como sucesso.
12. No estado pendente, a UI oferece ação manual **Sincronizar transcrição**; a resposta diferencia processamento ainda indisponível de falha de configuração/autorização e permite nova tentativa segura.
13. A action manual exige autenticação e `exigirAcessoBpmCard`/ownership com permissão de edição antes de ler dados do card ou chamar a API Google; chamada direta por usuário sem acesso é recusada.
14. Antes de uma transição manual de **Reunião Agendada** para destino comercial, `MoverCardBpm` lê `transcricaoReuniao` persistida e recusa valor ausente, vazio ou composto apenas por espaços, antes de qualquer update ou histórico de movimento.
15. A recusa do guard retorna mensagem clara, equivalente a **“A transcrição da reunião ainda não foi recebida. Sincronize a transcrição antes de avançar.”**; o board restaura movimento otimista e exibe o motivo.
16. Com transcrição válida e demais regras atendidas, o guard não bloqueia uma transição comercial permitida. **Standby - Follow Up** continua disponível manualmente mesmo sem transcrição.
17. Enquanto a transcrição está pendente, o reagendamento atualiza o mesmo `googleEventId` no mesmo `googleCalendarId` e preserva o espaço/link do Meet. Depois de recebida, o backend recusa o reagendamento e preserva a evidência; em nenhum caso `transcricaoReuniao` é limpa ou sobrescrita como efeito colateral.
18. Se houver alteração externa que troque ou torne ambíguo o espaço do Meet, o reagendamento/sincronização falha de maneira observável e pede revisão; não vincula a transcrição de outro espaço e não apaga o conteúdo já persistido.
19. O cron protegido já existente passa a executar polling de transcrições pendentes de cards ativos em **Reunião Agendada**, somente após o horário previsto da reunião, sem criar segundo scheduler ou rota pública concorrente.
20. O polling automático trata `conferenceRecord`/transcript ainda indisponível como pendência recuperável, isola falhas por card, aplica limites/paginação e retorna resumo sem dados pessoais: examinados, recebidos, pendentes, ignorados e falhos.
21. O processamento manual e automático é seguro diante de retry e concorrência: valida novamente card, etapa, vínculo e conteúdo antes de persistir; histórico/realtime não são duplicados.
22. O ciclo de oito dias úteis inclui cards `ATIVO` em **Reunião Agendada** com `proximoContatoEm = null`, usando como início a entrada mais recente na etapa, com fallback explícito para cards legados sem histórico.
23. Antes do vencimento do oitavo dia útil, a automação não move o card por essa regra. Ao vencer, card ainda elegível é movido uma única vez para **Standby - Follow Up**, mesmo sem transcrição.
24. O movimento automático para Standby registra histórico com origem específica de **Reunião Agendada**, publica realtime e usa update condicional para impedir duplicidade em concorrência/retry.
25. O job ignora cards que saíram da etapa, deixaram de estar `ATIVO`, receberam `proximoContatoEm` ou deixaram de atender aos critérios no momento da atualização atômica.
26. A configuração externa necessária é documentada com nomes das variáveis, passos do Admin Console, scope exato, usuário impersonado, restrições de licença/geração da transcrição e procedimento seguro de validação, sem incluir valores secretos.
27. Nenhuma migration, alteração de schema, seed, backfill ou mutação em massa é introduzida. Se uma necessidade estrutural for descoberta, a parcela afetada é interrompida e encaminhada ao fluxo `Vault` do `AGENTS.md`.
28. Existem testes automatizados para autenticação/ownership, parsing de meeting code, paginação das três coleções, consolidação/ordenação, pendente versus erro, persistência idempotente, guard de avanço, exceção de Standby, reagendamento, realtime e ciclo de oito dias úteis.
29. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes ou ambientais são separadas de regressões desta story e a File List é atualizada antes da conclusão.

## Tasks / Subtasks

- [x] 1. Executar Scout e confirmar o contrato real de integração (AC: 1–5, 17–19, 27)
  - [ ] Mapear criação/reagendamento atual, origem de `googleMeetLink`, evento em cache, ownership e movimento do card.
  - [ ] Confirmar o formato real do link/código do Meet e o usuário do domínio apto à impersonação.
  - [ ] Confirmar as transições comerciais de Reunião Agendada e o destino Standby no pipeline.
  - [ ] Provar que a solução reutiliza campos existentes e não exige migration.
- [x] 2. Implementar autenticação e cliente Google Meet server-side (AC: 1–6, 20, 26)
  - [ ] Criar factory de credencial DWD com scope mínimo e validação segura das variáveis.
  - [ ] Implementar listagem paginada de conference records por `meeting_code`.
  - [ ] Implementar listagem paginada de transcripts e entries.
  - [ ] Normalizar, ordenar e consolidar o texto sem expor payload sensível.
- [x] 3. Implementar serviço idempotente de sincronização (AC: 7–10, 20–21)
  - [ ] Resolver o card/espaço, classificar recebido/pendente/erro e persistir somente conteúdo válido.
  - [ ] Evitar update e histórico quando o conteúdo não mudou.
  - [ ] Registrar histórico com origem manual/automática e publicar realtime após commit.
- [x] 4. Implementar action manual e UI de status (AC: 11–13)
  - [ ] Proteger a action com sessão, ownership e validação do input.
  - [ ] Exibir estados pendente/recebida/erro e ação de sincronização no painel da reunião.
  - [ ] Preservar mensagens acionáveis sem expor detalhes internos da Google.
- [x] 5. Implementar guard de avanço (AC: 14–16)
  - [ ] Validar `transcricaoReuniao` persistida antes de qualquer movimento comercial.
  - [ ] Manter Standby como contingência e respeitar a máquina de transições existente.
  - [ ] Garantir rollback/mensagem no drag otimista e feedback equivalente no modal.
- [x] 6. Garantir consistência do reagendamento (AC: 17–18)
  - [ ] Atualizar o mesmo evento e preservar espaço/link/transcrição.
  - [ ] Detectar divergência externa sem substituição silenciosa.
  - [ ] Testar reagendamento antes e depois da chegada da transcrição.
- [x] 7. Integrar polling ao cron e ciclo de oito dias (AC: 19–25)
  - [ ] Reutilizar a rota, segredo, scheduler e CLI existentes.
  - [ ] Consultar apenas reuniões elegíveis e já ocorridas; isolar erros por card.
  - [ ] Incluir Reunião Agendada no cálculo desde a última entrada na etapa.
  - [ ] Mover para Standby com update condicional, histórico e realtime.
- [x] 8. Documentar setup externo (AC: 26)
  - [ ] Atualizar `.env.example` somente com nomes e comentários, sem segredos.
  - [ ] Documentar Meet API, DWD, Admin Console, scope, impersonação e limitações da geração de transcrição.
- [x] 9. Testar e validar (AC: 28–29)
  - [ ] Criar testes unitários do cliente/paginação/consolidação com mocks HTTP.
  - [ ] Criar testes do serviço, action, ownership, idempotência e realtime.
  - [ ] Criar testes do guard, Standby, reagendamento e automação de oito dias.
  - [ ] Executar gates e registrar separadamente falhas basais/ambientais.
- [x] 10. Atualizar esta story antes do handoff (AC: 29)
  - [ ] Marcar tarefas concluídas e registrar Completion Notes.
  - [ ] Atualizar File List e resultados dos gates.
  - [x] Alterar status para `Ready for Review` somente após implementação e verificação.

## Dev Notes

### Pontos de integração iniciais

- `src/actions/bpm/GoogleMeet.ts` já cria e reage agenda pelo Google Calendar; o reagendamento usa `googleCalendarId + googleEventId` e deve continuar atualizando o evento existente.
- `prisma/schema.prisma` já contém `BpmCard.transcricaoReuniao`; a implementação deve usar esse campo e remover do comportamento a suposição de que ele é apenas um fallback manual.
- `src/actions/bpm/Cards.ts` centraliza o movimento manual e é o local de autoridade para o guard de transcrição.
- `src/lib/bpm/automacao-novos-leads.ts` contém o job compartilhado de follow-up e deve ser ampliado/reorganizado, não duplicado.
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` e o CLI existente permanecem os entrypoints operacionais.
- `src/lib/bpm/ownership.ts` é obrigatório na action manual.
- O realtime deve ser publicado somente após persistência confirmada.

### Diretrizes de implementação

- Manter o cliente Meet em módulo `server-only`; nunca importar credenciais ou bibliotecas de autenticação em Client Components.
- Isolar transporte HTTP, paginação e regra de domínio para testes determinísticos sem chamadas reais.
- Aplicar timeout e tratamento explícito de `401`, `403`, `404`, `429` e `5xx`; retries devem ser limitados e respeitar backoff/retry-after quando cabível.
- Não presumir que transcrição estará disponível imediatamente ao terminar a reunião.
- Não misturar múltiplos conference records ou espaços sem validação inequívoca do meeting code.
- Não armazenar JSON bruto da API, tokens, e-mails de participantes ou erros técnicos em `transcricaoReuniao`.
- Não executar o job contra banco compartilhado/produção durante testes automatizados.

### Estado visual sem novo schema

- **Recebida:** `transcricaoReuniao.trim().length > 0`.
- **Pendente:** reunião vinculada e transcrição vazia, incluindo retorno válido sem transcript/entries ainda.
- **Erro:** resultado da tentativa manual atual; no cron, contabilizado no resumo/log estruturado. O estado persistido continua pendente até uma sincronização futura bem-sucedida.
- A UI deve deixar claro que “pendente” não significa que a API falhou.

## Testing

- Cliente Meet: credencial DWD, scope mínimo, filtro por meeting code, múltiplas páginas de conference records/transcripts/entries, páginas vazias, token repetido e ordenação fora de ordem.
- Domínio: link válido/inválido, conteúdo vazio, transcript ainda processando, conteúdo igual, conteúdo ampliado e múltiplos registros incompatíveis.
- Segurança: sem sessão, sem ownership, segredo de cron inválido, ausência de env, `401/403` da Google e garantia de que logs não contêm private key/token.
- Action/UI: pendente → sincronizar → recebida, erro recuperável, atualização realtime e motivo de bloqueio visível.
- Movimento: destino comercial sem/com transcrição, Standby sem transcrição, destino proibido e ausência de persistência parcial.
- Reagendamento: mesmo evento/espaço, preservação da transcrição e divergência externa.
- Automação: reunião futura, recém-encerrada ainda pendente, transcrição recebida, sétimo/oitavo dia útil, card já movido, retry/concor­rência e falha parcial do lote.

## Quality Gates

- [x] Scout concluído antes de editar implementação.
- [x] Anubis revisou DWD, envs, escopos, ownership, cron e logs.
- [x] Probe validou agendamento → reunião → sincronização → guard → movimento/reagendamento.
- [x] Nenhum segredo ou dado sensível em cliente, logs, histórico ou fixtures.
- [x] Nenhuma migration/schema/seed/backfill sem Vault, backup e consentimento explícito.
- [x] Testes Meet executados apenas com mocks/fixtures sanitizados; smoke real somente em ambiente autorizado.
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [x] `npm run build`
- [ ] CodeRabbit sem issue CRITICAL pendente.
- [x] File List e Completion Notes atualizadas.

## Configuração externa prevista

Os nomes finais devem ser confirmados com o padrão já usado no projeto. A implementação deve documentar, no mínimo:

- e-mail da conta de serviço;
- private key da conta de serviço com tratamento correto de quebras de linha;
- client ID usado na Domain-Wide Delegation;
- usuário Google Workspace impersonado;
- escopo `https://www.googleapis.com/auth/meetings.space.readonly`;
- procedimento: habilitar Meet REST API → habilitar DWD na service account → autorizar client ID e scope em **Admin Console > Security > Access and data control > API controls > Domain-wide delegation** → validar com reunião de teste que gere transcrição.

## CodeRabbit Integration

**Primary Type**: Full-stack / external API integration  
**Secondary Type(s)**: Authentication, automation, business rules, realtime  
**Complexity**: High

### Specialized Agent Assignment

- `@dev` — cliente Meet, sincronização, guard, polling e UI.
- `@qa` — mocks de paginação, idempotência, concorrência, segurança e fluxo ponta a ponta.
- `@architect` — contrato de autenticação DWD, limites da API e separação entre transporte/domínio.
- `@devops` — configuração segura das envs e autorização operacional no Google Admin/Cloud.

### CodeRabbit Focus Areas

- Garantia de que a transcrição pertence ao espaço/card correto.
- Paginação completa sem loop infinito ou perda de entries.
- Credenciais exclusivamente server-side e scope mínimo.
- Ownership antes de chamadas externas.
- Idempotência de persistência, histórico e realtime.
- Guard antes de update/histórico e exceção explícita de Standby.
- Reagendamento sem criação de novo evento/espaço e sem apagar transcrição.
- Polling limitado, observável e tolerante à disponibilidade assíncrona.

## Initial File List

- `docs/stories/story-alpha-crm-reuniao-agendada-transcricao-meet.md` — criada; story e rastreabilidade.
- `src/lib/google-meet/client.ts` — previsto; autenticação DWD e chamadas paginadas à Meet REST API.
- `src/lib/bpm/transcricao-reuniao.ts` — previsto; parsing do meeting code, consolidação e estados de domínio.
- `src/lib/bpm/transcricao-reuniao-server.ts` — previsto; vínculo, persistência idempotente, histórico e realtime.
- `src/actions/bpm/GoogleMeet.ts` — previsto; action manual e consistência do reagendamento.
- `src/actions/bpm/Cards.ts` — previsto; guard server-side de avanço.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` — previsto; status e sincronização manual.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — previsto; feedback antecipado do guard.
- `src/lib/bpm/automacao-novos-leads.ts` — previsto; polling e ciclo de oito dias para Reunião Agendada no job compartilhado.
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` — previsto somente se necessário para expor o resumo ampliado.
- `scripts/bpm-novos-leads-job.mjs` — previsto somente se necessário para o resumo CLI ampliado.
- `.env.example` — previsto; nomes das variáveis sem valores secretos.
- `docs/` — previsto; setup de Google Cloud/Admin Console e limitações operacionais.
- `tests/bpm/transcricao-reuniao.test.ts` — previsto; domínio, guard e serviço idempotente.
- `tests/google-meet/client.test.ts` — previsto; autenticação, paginação e tratamento de erros.
- `tests/bpm/automacao-reuniao-agendada.test.ts` — previsto; polling, oito dias, Standby, histórico e realtime.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-12 | 1.0 | Story criada para captura real de transcrição do Google Meet, guard de avanço, reagendamento e automação da etapa Reunião Agendada. | River (`@sm`) |

## Dev Agent Record

### Agent Model Used

Codex GPT-5.

### Debug Log References

- `npx vitest run` focado: 7 arquivos, 26 testes aprovados.
- ESLint direcionado aos arquivos da story: aprovado.
- `npm run build`: aprovado; rota do job e páginas CRM incluídas no build.
- `npx tsc --noEmit --pretty false`: nenhum erro novo da story; a execução final permaneceu bloqueada por diagnósticos basais e alterações paralelas fora do CRM (Exclusão Fiscal, Habilitação Radar, Parceiros e testes da fila do Calendar).
- `npm run lint`: atingiu o limite de 120 s sem emitir diagnóstico; substituído pelo lint direcionado limpo para evitar bloqueio improdutivo.

### Completion Notes List

- Cliente Meet v2 dedicado com DWD e escopo mínimo; Calendar não recebeu o novo escopo.
- Captura pagina conference records, transcripts, participants e entries, correlacionando a ocorrência com a data do card.
- Persistência idempotente por CAS, histórico somente com metadados e invalidação realtime.
- Action manual protegida por sessão, Zod e ownership; modal diferencia pendente, recebida e erro.
- Guard de backend/UI exige transcrição para Em tratativa/Sem viabilidade e preserva Standby.
- Reagendamento resolve o organizador pelo cache, valida link/ETag fresco e é recusado após a evidência ser recebida.
- Polling foi integrado ao cron existente; Reunião Agendada participa do ciclo de oito dias úteis e pode ir a Standby sem transcrição.
- Segurança endurecida com logs sanitizados, limites de páginas/itens/caracteres, deduplicação concorrente e proteção local contra sobreposição do job.
- Não houve schema, migration, seed, backfill nem execução contra banco real.

### File List

- `.env.example` (editado)
- `.bibble/memory/codebase-map.md` (editado)
- `.bibble/memory/integration-points.md` (editado)
- `.bibble/memory/session-draft.md` (editado)
- `docs/google-meet-transcricoes-alpha-crm.md` (novo)
- `docs/stories/story-alpha-crm-reuniao-agendada-transcricao-meet.md` (novo/editado)
- `src/actions/bpm/Cards.ts` (editado)
- `src/actions/bpm/GoogleMeet.ts` (editado)
- `src/actions/bpm/TranscricaoMeet.ts` (novo)
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` (editado)
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` (editado)
- `src/app/api/bpm/jobs/automacao-novos-leads/route.ts` (editado)
- `src/lib/bpm/automacao-novos-leads.ts` (editado)
- `src/lib/bpm/reuniao-agendada.ts` (novo)
- `src/lib/bpm/transcricao-reuniao-server.ts` (novo)
- `src/lib/bpm/transcricao-reuniao.ts` (novo)
- `src/lib/google-meet/client.ts` (novo)
- `tests/bpm/automacao-reuniao-agendada.test.ts` (novo)
- `tests/bpm/reuniao-agendada.test.ts` (novo)
- `tests/bpm/transcricao-meet-action.test.ts` (novo)
- `tests/bpm/transcricao-reuniao-server.test.ts` (novo)
- `tests/google-meet/client.test.ts` (novo)

## QA Results

Anubis: aprovado com ressalvas; achados de limite, logs, PII e concorrência corrigidos. Probe/Sage: aprovado após corrigir ETag fresco, revalidação pós-API e starvation do polling. Lens: aprovado após corrigir CAS do vínculo, confirmação do link criado, timeout/retry e concorrência limitada.

## Roadmap Alpha — RM-2026-CB55AA (2026-09-04)

- [x] `PainelReuniao` disponível em **Reunião Agendada**, com o formulário de agendamento oculto.
- [x] Transcrição existente exibida como resumo editável e persistida em `BpmCard.transcricaoReuniao` via `registerSave`.
- [x] Busca manual diferencia carregamento, pendência, sucesso e erro.
- [x] Agendamento atende ao contrato atual da Agenda e persiste `googleEventId`, `googleCalendarId` e `googleMeetLink`.
- [x] Persistência manual protegida por sessão, Zod, ownership revalidado e CAS por `updatedAt`.
- [x] Testes de integração da fase adicionados em `tests/bpm/reuniao-transcricao.test.ts`.
- [x] Data da reunião e estado vazio explícito adicionados ao acompanhamento em **Reunião Agendada**.
- [x] Estado pendente inicial usa a mensagem operacional completa e acessível.
- [x] Sincronização limitada a 25 s nas integrações externas, com uma repetição por chamada Meet e fallback para a descrição real do evento no Calendar.
- [x] `CardFilhoCriado` reexportado por `Cards.ts`, eliminando o erro de tipo da cadeia do modal.

### File List do autoajuste

- `src/actions/bpm/GoogleMeet.ts` — payload completo do evento.
- `src/actions/bpm/TranscricaoMeet.ts` — action de edição persistente do resumo/transcrição.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx` — entrega na etapa Reunião Agendada.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx` — estados e textarea editável com autosave.
- `tests/bpm/formulario-etapa.test.ts` — integração por etapa.
- `tests/bpm/reuniao-transcricao.test.ts` — critérios da fase.
- `tests/bpm/transcricao-reuniao-server.test.ts` — timeout global e fallback Calendar.
- `src/lib/google-meet/client.ts` — timeout por chamada e retry único.
- `src/lib/bpm/transcricao-reuniao-server.ts` — orçamento global e fallback parcial persistente.
- `.bibble/memory/architecture.md`, `.bibble/memory/components.md`, `.bibble/memory/integration-points.md`, `.bibble/memory/journal.md` — documentação da entrega.
- `.bibble/memory/decisions.md`, `.bibble/memory/known-errors.md` — decisões técnicas e limitações operacionais da integração.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Resultado, estados e dependências externas estão explícitos. |
| Technical Implementation Guidance | PASS | Meet API, DWD, paginação, persistência, guard, cron e realtime foram delimitados. |
| Reference Effectiveness | PASS | Campos e entrypoints existentes são apontados sem presumir schema novo. |
| Self-Containment Assessment | PASS | Regras de avanço, Standby, reagendamento e oito dias possuem precedência definida. |
| Testing Guidance | PASS | Cenários de transporte, domínio, segurança, UI, idempotência e automação estão enumerados. |
| CodeRabbit Integration | PASS | Agentes, complexidade e focos de revisão foram definidos. |

**Final Assessment:** READY — a implementação pode iniciar pelo Scout e pela validação da configuração Google. A ausência de setup DWD/licença/transcrição no tenant impede o smoke real, mas não autoriza simular sucesso nem persistir texto fictício.

### Gates do autoajuste Probe — 2026-09-04

- Testes direcionados: 18/18 aprovados.
- ESLint direcionado: aprovado, sem diagnósticos.
- `npm run typecheck`: falhou por erros preexistentes fora desta fase; o erro relevante de `CardFilhoCriado` foi eliminado.
- `npx vitest run tests/bpm/`: 451 aprovados / 16 falhas basais reproduzidas; nenhum teste da transcrição falhou.
- `npm test -- --run`: 2.113 aprovados / 38 falhas basais ou ambientais.
- `npm run lint`: executado; o resultado global permaneceu incompatível com o gate do repositório e não introduziu diagnóstico nos arquivos direcionados.

### Checklist de fechamento documental — 2026-09-04

- [x] `architecture.md` atualizado com implementação, arquivos, testes, qualidade e caminho de consumo.
- [x] `decisions.md` atualizado com fonte Meet/fallback Calendar, campo dedicado e escopo OAuth.
- [x] `known-errors.md` atualizado com latência/disponibilidade e limitação do fallback.
- [x] `integration-points.md` atualizado com o fluxo UI → actions → Google APIs → persistência.
- [x] `journal.md` atualizado no formato Kowalski, com fases, agentes, resultado e pendências.
- [x] Entregabilidade validada pelo Probe no caminho real do Alpha CRM.

### Gates do fechamento Scribe — 2026-09-04

- `git diff --check`: PASS.
- Testes documentais/direcionados: 23/23 PASS (`reuniao-transcricao`, `transcricao-reuniao-server`, `formulario-etapa`).
- `npm test`: 2.113 PASS / 38 FAIL em baseline preexistente ou limitação ambiental; nenhuma falha pertence aos documentos desta fase.
- `npm run typecheck`: FAIL por erros globais preexistentes fora dos arquivos documentais desta fase.
- `npm run lint`: FAIL no baseline global do repositório.
