# Story: Instagram — data original do formulário no card pequeno do CRM

## Status e responsáveis

Ready for Review — implementação e gates locais concluídos; revisão QA e publicação em staging em andamento. Produção permanece sem autorização.

## Story

**Como** usuário do Alpha CRM, **quero** ver no card pequeno a data original em que o lead preencheu o formulário, **para que** eu saiba quando ele foi captado, inclusive depois de alguém assumi-lo.

Texto solicitado: **Preencheu formulário em: dd/mm/aaaa**.

## Fonte e limites

- Fonte da data: `created_time` da planilha Instagram. O fluxo permanece **planilha → NoLoss → CRM**. NoLoss já preserva essa data em `capturedAt`/`occurredAt`, conforme reconhecimento informado pelo agente principal; confirmar esse transporte sem substituí-la pela hora de recebimento.
- CRM `src/lib/bpm/instagram-leads.ts` já normaliza `linha.created_time` para `dados.captadoEm`; a anotação de assunção também registra essa data. `InstagramLeadCard.tsx` tem resumo com data/hora `pt-BR` e fuso `America/Sao_Paulo`; o pedido atual é a data visível no **card pequeno**, sem depender de abrir o resumo/modal.
- O card nativo depois da assunção não pode usar sua `createdAt` como se fosse a data original do formulário. Conferir o vínculo/envelope original persistido da integração e projetar somente a data comercial necessária, mantendo ACL e eficiência da leitura.
- Sem alteração de schema/migration/backfill, dados históricos, env, gatilhos ou ativação de Apps Script. Não reenviar/importar leads para preencher a data. A story anterior de aparência/origem continua preservada, inclusive sua alteração documental local pendente.
- Não acrescentar publicidade/UTMs ao CRM para transportar a data. Manter card Instagram, cores de origem, composição configurada, ações por etapa, ACL e fluxo de assunção existentes. Nenhum redesenho de modal ou mudança de calendário/Meet.

## Acceptance Criteria

1. Data recebida da planilha mantém a identidade semântica de `created_time` ao passar pelo NoLoss e pela API CRM. Não substituir por `receivedAt`, `recebidoEm`, timestamp de importação, data de criação do contato/card ou relógio atual.
2. Card pequeno virtual Instagram mostra **Preencheu formulário em: dd/mm/aaaa** quando há data original válida, com formatação `pt-BR` e fuso explícito **America/Sao_Paulo**. Não depende do timezone do navegador/servidor nem mostra hora nesse texto.
3. Depois de assumir, o card pequeno nativo conserva a mesma data original e o mesmo texto, inclusive após atualização do quadro, recarga e mudança de etapa. A projeção usa o vínculo/origem persistida existente; não procurar data em nome, texto livre ou payload local adulterável.
4. Origem sem data original ou com valor inválido não recebe data inventada/fallback e não quebra a renderização. Não mostrar `Invalid Date` nem uma data atual silenciosa; omitir a informação quando não for verificável.
5. Data aparece de forma legível no card pequeno junto aos dados comerciais existentes, respeitando largura do Kanban e sem duplicar a mesma informação. Continua coerente com o detalhe já existente e não altera composição/campos escolhidos, identidade visual ou widget de Agendar reunião.
6. Projeção nativa e virtual preserva isolamento do pipeline e ACL existentes. Não expor campanha, anúncio, adset, formulário de publicidade, UTMs, dados pessoais adicionais ou envelope bruto para mostrar uma única data.
7. Testes cobrem data original diferente de recebimento/criação, cruzamento de dia UTC versus São Paulo, offset explícito e ano bissexto válido; ausência/inválido sem fallback; virtual e nativo após assunção/projeção/reload. Cobrir o contrato de transporte da data e a saída DOM do card, sem depender apenas de fixtures de `createdAt`.
8. Executar `npm run lint`, `npm run typecheck`, `npm test` e build requerido, registrando comando/resultado real e eventual limite de memória. Atualizar checklist/File List e obter revisão de QA. Validar entrega primeiro em staging; produção somente mediante pedido explícito posterior.

## Tasks / Subtasks

- [x] Reler AGENTS e Constitution; preservar staging primeiro e a story anterior.
- [x] Registrar pedido e localizar transporte `created_time → captadoEm`, resumo atual e anotação de assunção.
- [x] Confirmar data original no NoLoss e vínculo persistido do card nativo, sem mutação remota.
- [x] Projetar a data original necessária e exibi-la nos cards pequeno virtual/nativo com fuso explícito.
- [x] Cobrir transporte/projeção/formatação e regressões visuais/ACL com testes pertinentes.
- [ ] Executar gates, obter QA e validar em staging quando autorizado.
- [ ] Produção permanece pendente de autorização específica; não integra esta implementação.

## File List

- `docs/stories/story-crm-data-formulario-instagram-card-20261022.md` — nova story; atualizar com os arquivos efetivamente implementados.
- `src/lib/bpm/instagram-leads.ts` — formatação defensiva da captura original em São Paulo.
- `src/lib/bpm/instagram-leads-server.ts` — leitura em lote das capturas dos cards autorizados pelo vínculo de assunção, inclusive com endpoint desativado.
- `src/actions/bpm/Cards.ts` — projeção somente de `instagramCaptadoEm`, sem enviar o envelope bruto ao navegador.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/InstagramLeadCard.tsx` — componente de data compartilhado e inclusão no card virtual.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — data no card nativo após assunção e nas etapas seguintes.
- `tests/bpm/instagram-leads.test.ts` — data original, fuso, offsets, ano bissexto e valores inválidos.
- `tests/bpm/instagram-leads-server.test.ts` — consulta em lote, escopo, data canônica e ausência sem fallback.
- `tests/bpm/cards-ordenacao-actions.test.ts` — projeção real na carga inicial e atualização parcial do quadro.
- `tests/bpm/kanban-card-origem-agendar-react.test.ts` — DOM virtual/nativo, etapas e ausência de data original.

## Implementação e evidências

- NoLoss já persiste `created_time` integralmente em `payload.attribution.capturedAt`, `payload.input.lead.created_time` e `occurredAt`. Não foi necessário alterar API, Apps Script, env, schema ou dados. Leitura do teste fictício existente confirmou a captura `2026-10-22T12:33:22.685Z` idêntica no NoLoss e em `captadoEm`/`linha.created_time` no CRM; recebimentos separados em `12:33:23.357Z` e `12:33:24.047Z`. Evidência privada `manual-test-staging/form-date-verification.private.json`, sem mutações.
- Leitura nativa usa endpoint Instagram conhecido, status PROCESSADO e vínculo evento → card, limitada aos IDs retornados pela consulta autorizada do pipeline. Reconstrói o envelope pela linha validada; não usa campos derivados adulteráveis, data do card nem texto livre da anotação. Uma consulta em lote retorna mapa de data; só a data é projetada. Não depende de endpoint ativo para ler o histórico já assumido.
- O helper real foi executado contra o banco isolado de staging e retornou a data original do card `cmvjj91qw000008l0ilvze09h`, sem alteração de dados. A primeira tentativa CLI não carregou o ID do endpoint (ausente no arquivo local, configurado no runtime Vercel); o reteste usou o ID original da entrada e passou. Evidência privada `manual-test-staging/form-date-projection.private.json`.
- Testes focados: 4 arquivos/48 testes PASS. Suíte completa `npm test`: 711 arquivos/5.663 testes PASS, 4 skipped e 1 todo, exit0. Lint exit0, sem erros, 1.193 avisos legados. Typecheck exit0. Build equivalente com geração Prisma/player e Next CLI com heap 8 GB exit0; o heap ampliado segue o procedimento já validado da entrega anterior, sem alterar configuração do projeto. Logs `/tmp/crm-instagram-form-date-{focused,lint,typecheck,tests,build}.log`.
- QA e validação visual autenticada em staging ainda pendentes. Produção não faz parte desta entrega.

## CodeRabbit Integration

Tipo: UI e projeção de dados existentes. QA deve revisar fonte canônica da data, preservação após assunção, fuso/virada de dia, ausência sem fallback, ACL e não exposição de marketing. Nenhum teste de código ou aprovação QA foi executado na criação documental.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Data original do formulário nos cards virtual e nativo; staging apenas | `@sm` |
