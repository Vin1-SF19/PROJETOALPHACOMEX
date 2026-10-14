# Story: Desempenho do Kanban e visibilidade de leads e pipelines

## Status

Ready for Review — implementação e gates concluídos; publicação em preparação. Índices de produção aguardam confirmação específica do usuário.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - revisão de autorização no servidor e contratos de paginação
  - testes de regressão e medição de desempenho
```

## História

**Como** usuário do Alpha CRM,
**quero** trabalhar com centenas de cards sem travadas, visualizar os leads vinculados a mim e os leads ainda sem vínculo nos pipelines aos quais tenho acesso,
**para que** eu consiga acompanhar meu atendimento com rapidez e sem exposição indevida de informações de outros usuários.

**Como** administrador, quero configurar a visibilidade do pipeline em uma aba própria junto de “Visibilidade por coluna”, mantendo a visão administrativa de todos os cards.

## Origem e escopo autorizado

Pedido direto do usuário nesta conversa em 2026-10-14: aplicar as soluções da análise de desempenho, restringir a visualização aos leads vinculados ao usuário com exceção dos sem vínculo e acrescentar configuração de visibilidade do pipeline. O usuário confirmou que leads sem vínculo são visíveis a todos que tenham acesso ao pipeline e que administradores continuam vendo todos. Não há pendência dessas duas decisões.

A análise anterior encontrou 763 cards ativos em Revisão de Radar (381 em Stand By, 137 em Em tratativas, 123 em Lost e 122 nas demais etapas), além de quatro leads virtuais do site. A seleção principal produziu 14 consultas SQL, cerca de 775 KB serializados sem compressão e levou 3,4–4 segundos deste ambiente ao banco remoto. Esses números são referência diagnóstica, não uma medição de carregamento completo na Vercel. Todos os cards das colunas visitadas ficam montados e há recarga integral periódica a cada 30 segundos. Os índices declarados de `BpmCard` não estavam presentes no banco de produção na inspeção anterior.

O escopo inclui virtualização por coluna, seleção resumida e carregamento em lotes por coluna, atualização incremental e reconciliação dos índices necessários quando houver plano Vault autorizado. Preservar totais, busca global nos registros autorizados, filtros, ordenação, arrasto, histórico amigável e acentuação. Não apagar ou arquivar automaticamente cards para melhorar desempenho.

## Critérios de aceite

1. O Kanban monta somente os cards próximos da área visível, com margem de rolagem, por coluna. A quantidade de elementos montados não cresce com o total de centenas de cards já visitados; retornar a posições anteriores continua possível.
2. A abertura consulta resumos necessários aos cards e carrega lotes independentes por coluna; detalhes e históricos ficam sob demanda. Os totais das colunas representam todos os registros autorizados sob os filtros ativos, incluindo os ainda não carregados.
3. Busca e filtros são aplicados pelo servidor sobre todo o conjunto autorizado, não somente sobre os lotes presentes no navegador. Paginação tem ordenação estável e não duplica nem perde registros; troca de filtros/pipeline descarta respostas antigas.
4. Mudanças individuais atualizam ou invalidam somente os cards/colunas afetados. A verificação periódica usa metadados leves ou mecanismo incremental, sem baixar o funil inteiro a cada 30 segundos. Reconexão, perda de eventos e falhas transitórias possuem reconciliação segura e acionamento manual.
5. Arrastar e soltar continua funcionando nas colunas virtualizadas e parcialmente carregadas, inclusive entre etapas. Totais e posição são reconciliados após sucesso; falhas revertem a atualização otimista sem duplicar cards. Permissões atuais e de destino continuam validadas no servidor.
6. Usuários comuns só listam/abrem leads vinculados a eles ou sem vínculo, sempre dentro das permissões do pipeline e da coluna. Administradores mantêm visão de todos conforme o bypass administrativo centralizado existente. Identificar os vínculos reais no modelo existente; não criar associações artificiais ou reinterpretar ausência de responsável sem verificar membros.
7. O mesmo filtro de autorização vale para acesso direto, pesquisa, totais, paginação, detalhes, histórico e atualizações em tempo real. Uma nova atribuição que retire acesso remove o card da visão anterior. Leads virtuais seguem a regra equivalente e não permitem contornar restrições ao serem promovidos.
8. Configurações do CRM exibem a aba “Visibilidade do pipeline” junto da configuração por coluna, permitindo ao operador autorizado definir quem pode visualizar o pipeline usando os perfis e padrões existentes. Persistência, leitura de volta, validação e feedback de erro/sucesso funcionam. A listagem de pipelines e o acesso direto respeitam a configuração no servidor.
9. Regras de pipeline, coluna, vínculo e permissões de ação são compostas; habilitar visualização do pipeline não concede automaticamente ação sobre cards nem ignora as restrições de coluna. Preservar o bypass administrativo já existente e explicitar na interface o comportamento padrão de pipeline sem regra.
10. Mudanças de schema/índices só são executadas após relatório Vault, apresentação concreta de ambiente, comandos, impacto, riscos, alternativa e rollback, backup completo verificado de até 48 horas e confirmação específica do usuário. O pedido geral de implementar não autoriza esse gate por inferência.
11. Registrar medições comparáveis antes/depois de tempo de consulta, tamanho transferido, número de requisições e elementos montados. Verificar rolagem e arrasto em cenário representativo de 763 cards, sem prometer ganho percentual não medido. Diferenciar medição de banco, teste automatizado e perfil de navegador autenticado.
12. Executar testes pertinentes, lint, typecheck, suíte e build; documentar resultados e falhas preexistentes separadamente. Atualizar checklist e lista de arquivos reais antes de concluir.

## Notas técnicas e fontes

- Quadro: `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`.
- Seleção de cards: `src/actions/bpm/Cards.ts`; leads virtuais: `src/actions/bpm/NolossLeads.ts`.
- Fonte central de autorização: `src/lib/bpm/ownership.ts`; regras de coluna: `src/lib/bpm/visibilidade-etapa.ts` e `src/actions/bpm/VisibilidadeEtapas.ts`.
- Configurações: `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`, `VisibilidadeEtapasSection.tsx`, `src/actions/bpm/ConfiguracaoPipeline.ts` e `src/actions/bpm/Pipelines.ts`.
- Referência funcional existente: `docs/stories/story-rm-2026-1ea5c1-visibilidade-colunas-crm-bpm.md`. Perfis globais usam `usuarios.role`; bypass administrativo usa `isAdminRole`. Não codificar uma nova lista divergente de administradores.
- Preservação da migração/histórico: `docs/stories/story-alpha-crm-migracao-historico-rd-station-v1.md`.
- Segurança de banco e gates: `AGENTS.md`; estrutura declarada: `prisma/schema.prisma`.
- Os documentos genéricos de arquitetura/framework indicados no core-config não estão disponíveis nos caminhos examinados. O código e as stories existentes são as fontes de integração verificadas; não há nova biblioteca escolhida por esta story.
- A implementação deve determinar se a configuração pode reutilizar persistência existente. Se exigir estrutura nova, preparar mudança e seguir Vault. Não executar migrations nesta preparação.

## Plano e checklist

- [x] Registrar pedido e diagnóstico anterior sem converter estimativas em resultados de produção.
- [x] Registrar confirmação de leads sem vínculo e administradores.
- [x] Identificar contratos, pontos de integração e riscos de autorização/paginação.
- [x] Mapear vínculos, perfis e composição de regras existentes.
- [x] Implementar resumos, lotes por coluna e busca/totais completos com autorização no servidor.
- [x] Virtualizar colunas preservando arrasto, acessibilidade e estados vazios/carregando/erro.
- [x] Implementar atualização incremental e reconciliação de reconexão.
- [x] Implementar visibilidade de leads e aba de visibilidade do pipeline.
- [x] Preparar/revisar plano Vault para índices ou estrutura necessários, sem executar antes do gate.
- [x] Validar plano de consultas e medições antes/depois.
- [x] Executar testes e gates, registrar evidências e limitações.
- [x] Revisar autorização e regressões; atualizar lista de arquivos implementados.
- [ ] Publicar pelo fluxo @devops e verificar versão efetiva quando autorizado no fluxo principal.

## Estratégia de testes

- Autorização: usuário A/B, leads próprios/de terceiro/sem vínculo, múltiplos membros, administrador, pipeline negado, coluna negada, ação negada e acesso direto.
- Contratos: paginação estável, totais com filtros, busca de item ainda não carregado, colunas vazias, leads virtuais, troca de responsável e revogação de acesso.
- Atualizações: mudança pontual, entrada/saída de filtro, exclusão, duplicação de eventos, reconexão, erro/retry, resposta fora de ordem e ausência de recarga integral periódica.
- Interface: quantidade limitada de cards montados, rolagem longa, arrasto entre colunas, rollback em erro, navegação acessível e configuração persistida por perfil.
- Desempenho: cenário sintético representativo, sem dados pessoais versionados; comparar consulta, bytes e montagem. Se perfil real de navegador autenticado não for possível, informar a limitação explicitamente.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, build e testes direcionados dos caminhos alterados.

## CodeRabbit Integration

**Tipo:** Frontend, API, autorização e possível banco; complexidade alta.

- Pre-commit (@dev): revisar contratos incrementais, estabilidade da paginação, cancelamento de respostas e testes de autorização.
- Revisão (@architect/@qa): verificar composição das permissões em todas as leituras/ações e regressões de arrasto, filtros e configuração.
- Banco (Vault): somente se houver alteração estrutural, conforme gate obrigatório do projeto.
- Publicação (@devops): revisar escopo e evidências antes de operações remotas.
- CodeRabbit está habilitado no core-config; se o CLI não estiver instalado, registrar indisponibilidade e realizar revisão manual sem afirmar execução automatizada.

## Story Draft Checklist

- [x] Objetivo, escopo e contexto do usuário identificados.
- [x] Critérios verificáveis, inclusive falhas e restrições de acesso.
- [x] Requisitos de integração referenciados em código/stories existentes.
- [x] Testes e riscos de banco explicitados.
- [x] Decisões confirmadas separadas de escolhas técnicas ainda a implementar.

## Dev Agent Record

Implementado manifesto autorizado com revisão por card, lotes de 30 por coluna e virtualização com a dependência existente `@tanstack/react-virtual`. Busca normaliza acentos e consulta o conjunto autorizado completo. Poll a cada 30s consulta metadados; alterações genéricas do realtime forçam a hidratação dos resumos carregados, porque o evento não pode revelar IDs a outros membros do pipeline. Revalidação completa dos resumos carregados a cada 90s protege contra eventos perdidos e alterações de relações. Respostas antigas são descartadas; troca de pipeline remonta o quadro. Não há promessa de hidratar apenas um card em evento genérico.

A autorização considera responsável OU membro, acesso ao setor do pipeline e visibilidade da coluna. Administradores globais preservam o bypass existente; administrador de card preserva seu perfil de campos. `responsavelId` é obrigatório: ausência de linha em membros não torna um card livre. Leads NoLoss pendentes representam os leads sem vínculo e ficam compartilhados apenas nos pipelines/colunas acessíveis. Promoção reaplica acesso à origem e ao destino. Aba de pipeline reutiliza `BpmPipelineSetor`, com auditoria e controle de versão concorrente; não necessita schema novo.

### Evidências de validação

- `npm run lint`: 0 erros, 1193 avisos; `/tmp/crm-perf-lint2.log`.
- `npm run typecheck`: exit 0; `/tmp/crm-perf-typecheck-final.log`.
- `npm test`: 613 arquivos, 4532 testes aprovados, 4 ignorados e 1 todo; `/tmp/crm-perf-tests5.log`. Inclui arquivo concorrente ChatbotX fora deste patch.
- `npm run build`: exit 0; `/tmp/crm-perf-build2.log`. Primeira tentativa falhou ao copiar artefato Prisma gerado; nova geração/build concluídos. Typecheck foi repetido após build para evitar corrida nos arquivos `.next/types`.
- Testes React: 13 aprovados, incluindo 381 cards com menos de 20 cards montados, carga de 30 para 60 sem aumento proporcional do DOM, busca fora do lote, TTL, revogação e resposta antiga; `/tmp/crm-perf-board-tests4.log`.
- Índices: teste em SQLite descartável verifica confirmação, backup, seis criações, contagem, idempotência e rejeição de definição incompatível; nenhuma escrita remota nos testes.
- Revisão manual @qa corrigiu e validou perfil de responsável/administrador, arquivo e invalidação após cancelar arrasto. CodeRabbit CLI indisponível; nenhum scan automatizado alegado.

### Medição de desempenho somente leitura

Comparação no mesmo banco/dataset, desta máquina até Turso, seleção principal Prisma sem autenticação e sem executar server actions/mutações: `/tmp/crm-perf-measure2.log`.

| Consulta | Cards | SQLs | Tempo | Bytes JSON sem compressão |
|---|---:|---:|---:|---:|
| Seleção anterior completa | 763 | 14 | 4016 ms | 775238 |
| Resumos iniciais, até 30 por coluna | 184 | 14 | 1999 ms | 183630 |
| Metadados de sincronização | 763 | 6 | 2114 ms | 362074 |

O manifesto enviado ao cliente serializou 254984 bytes. A primeira carga combina manifesto e resumos; não se afirma que o tempo total caiu pela metade: estas duas consultas somam aproximadamente o tempo da seleção anterior nesta amostra, enquanto a quantidade de detalhes e elementos renderizados cai. O poll sem alterações evita as 14 consultas de resumos e a remontagem integral. Há quatro leads virtuais adicionais. Métricas são amostra diagnóstica, não medição HTTP comprimida nem perfil de navegador autenticado na Vercel. Não foi possível medir interação autenticada em produção nesta sessão.

### Vault e índices pendentes

Inspeção consistente confirmou somente PK em `BpmCard`; quatro índices de nomes antigos pertencem a `BpmCard_old_fixfk`. Preservar integralmente essa tabela. Plano aditivo: `BpmCard_board_empresaId_idx`, `BpmCard_board_pipelineId_idx`, `BpmCard_board_etapaId_idx`, `BpmCard_board_responsavelId_idx`, `BpmCard_board_status_idx`, `BpmCard_quadro_pagina_idx` (pipelineId/status/etapaId/createdAt/id).

Vault aprovou tecnicamente o artefato, condicionado à resposta específica do usuário. Fingerprint `0d7faef93c392324b414e917431a7cf03fb9fd643278a20f88fc74bbd1f213d9`. Backup completo verificado por restauração local, integridade, FK, contagens e hash: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-14T12-21-14-740Z.sql`, 336 tabelas, 252896 linhas, 316916207 bytes, SHA256 `c74d447596df814760aef0498c7f341c9e92d26d69d068cddeaad455a386b4fa`.

Após confirmação, executar exclusivamente `node scripts/crm-board-indexes.mjs apply --confirm=<fingerprint acima> --backup=<backup acima>`, seguido de `verify` e plano de consulta. Nenhum índice aplicado até este registro. `npm run build` não aplica migrations. O diff Prisma diagnóstico contém drops de nomes antigos e NÃO deve ser executado. Rollback só dos índices novos confirmados; recibo `prepared` representa intenção e exige reconciliar antes de qualquer rollback. Alternativa: publicar o aplicativo com índices pendentes.

### File List

Arquivos do escopo CRM (mudanças concorrentes do ChatbotX excluídas):

- `prisma/schema.prisma`
- `src/actions/bpm/Arquivados.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`
- `src/lib/bpm/cards-no-quadro.ts`
- `src/lib/bpm/ownership.ts`
- `tests/bpm/arquivados-action.test.ts`
- `tests/bpm/authorization-actions.test.ts`
- `tests/bpm/board-polling-react.test.ts`
- `tests/bpm/boas-vindas-acesso.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/cards-no-quadro.test.ts`
- `tests/bpm/drag-drop-rollback.test.ts`
- `tests/bpm/excluir-card-action.test.ts`
- `tests/bpm/membros-card-ownership.test.ts`
- `tests/bpm/ownership-security.test.ts`
- `tests/bpm/pendencias-motor.test.ts`
- `tests/bpm/promover-noloss-lead.test.ts`
- `tests/bpm/realtime-authorization.test.ts`
- `docs/stories/story-alpha-crm-performance-visibilidade-pipeline.md`
- `prisma/migrations/20261014123000_bpm_board_indexes/migration.sql`
- `scripts/crm-board-indexes.mjs`
- `src/actions/bpm/Quadro.ts`
- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/lib/bpm/quadro-paginado.ts`
- `src/lib/bpm/visibilidade-card.ts`
- `tests/bpm/crm-board-indexes.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/quadro-paginado.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`

## Change Log

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-10-14 | 1.0 | Story criada a partir do pedido autorizado e confirmação das regras de visibilidade | @sm |
