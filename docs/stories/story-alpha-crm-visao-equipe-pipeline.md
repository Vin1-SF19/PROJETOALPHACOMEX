# Story: Visão dos próprios leads e da equipe por pipeline

## Status

Done — filtro único publicado e configuração da conta de teste ajustada com autorização explícita; escopo confirmado por verificação independente. Não houve teste visual autenticado em produção.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - revisão de autorização de leitura e ação
  - testes de isolamento entre usuários e equipes
  - regressão do quadro paginado e incremental
```

## História

**Como** administrador autorizado do CRM,
**quero** configurar por pipeline a visão de leads próprios e de equipes por setor para líderes e administradores,
**para que** a supervisão tenha acesso ao conjunto necessário sem ampliar indevidamente a visibilidade ou as permissões de alteração.

**Como** usuário autorizado do pipeline, quero que o filtro de responsáveis reflita o conjunto que posso consultar, com rótulos claros para visão individual e de equipe.

## Origem e contexto

Pedido direto do usuário após a entrega de desempenho e visibilidade documentada em `docs/stories/story-alpha-crm-performance-visibilidade-pipeline.md`. A nova solicitação amplia a configuração por pipeline para líderes/administradores e requer atualização do filtro “Todos responsáveis”. Não modifica Builder ou ChatbotX; mudanças concorrentes nesses módulos ficam fora desta story.

O comportamento vigente limita o usuário comum a cards em que é responsável ou participante, além dos leads virtuais sem vínculo nos pipelines/colunas autorizados. O bypass administrativo existente permite a visão global. A visibilidade do pipeline usa setores e a configuração por coluna continua independente. A nova visão de equipe precisa compor essas regras sem converter acesso de leitura em autorização para editar ou mover cards de terceiros.

## Decisões confirmadas

1. **Visão inicial:** todos os usuários, inclusive líderes e administradores, iniciam em “Meus leads + sem vínculo”. A seleção da visão inicial não remove o bypass administrativo existente.
2. **Abrangência da equipe:** setores são escolhidos explicitamente por pipeline e por supervisor. A supervisão não é inferida do próprio setor nem do simples acesso ao pipeline.
3. **Configuração por pessoa:** administrador configura quais usuários supervisores podem consultar quais setores naquele pipeline. A ampliação concede somente leitura; permissões de ação existentes continuam independentes.

## Arquitetura aprovada e gate de banco

Adicionar o campo nullable `BpmPipeline.visualizacaoConfigJson`, com conteúdo validado no formato `{version: 1, supervisores: [{usuarioId, setorIds}]}`. Cada entrada explicita a pessoa supervisora e os setores consultáveis naquele pipeline. Valor `NULL` ou inválido não concede supervisão; não há fallback permissivo. Preservar o bypass administrativo existente e aplicar o padrão inicial “Meus leads + sem vínculo” também a administradores.

A coluna foi aplicada após revisão Vault e resposta específica do usuário: “Sim, autorizo adicionar esse campo”. A definição nullable foi verificada e os três pipelines preservados. Evidências abaixo.

## Critérios de aceite

1. A configuração de visibilidade de cada pipeline permite controlar a visão individual e a visão ampliada de equipe conforme a decisão registrada do usuário. A interface distingue quem pode acessar o pipeline de quais leads essa pessoa pode consultar dentro dele.
2. Somente usuários já autorizados a configurar pipelines podem salvar essas regras. Entradas inválidas, setores inexistentes e concorrência de edição são tratados sem gravação parcial; manter auditoria e versionamento de configuração existentes.
3. O servidor calcula a leitura efetiva a partir da sessão, configuração do pipeline, elegibilidade de líder/administrador, vínculo do card e regras de coluna. IDs de usuário, equipe ou setor enviados pelo navegador nunca concedem acesso por si sós.
4. A visão ampliada concede leitura conforme a regra configurada. Editar, mover, excluir, anexar, criar tarefas, promover lead e demais mutações continuam exigindo autorização própria. Não tornar líder membro/responsável artificialmente nem habilitar ações de terceiros por efeito colateral de uma consulta.
5. A relação de equipe é derivada do modelo real verificado na implementação. Registrar como responsável, participantes e setor determinam inclusão, incluindo múltiplos vínculos e usuários sem setor; não usar similaridade de nomes ou lista fixa de pessoas.
6. O filtro “Todos responsáveis” passa a representar apenas o universo autorizado da visão selecionada. As opções não revelam usuários nem contagens de equipes proibidas. Selecionar responsável continua restringindo a visão efetiva, nunca a ampliando.
7. A abertura usa “Meus leads + sem vínculo” para todos, inclusive administradores e líderes; as opções de alternância respeitam os setores explicitamente autorizados para a pessoa naquele pipeline. Trocar pipeline ou visão elimina seleção incompatível e cancela/ignora respostas antigas. A interface explica de forma amigável a diferença entre meus leads, equipe e responsáveis filtrados, sem termos técnicos de permissão.
8. Busca, totais por coluna, manifesto, paginação, resumo de cards, detalhes, histórico, arquivados e canais de atualização aplicam o mesmo escopo de leitura. Acesso direto ao ID de um card fora do escopo deve falhar mesmo se o usuário já tiver recebido esse ID em uma sessão anterior.
9. Leads sem vínculo mantêm a regra previamente confirmada: disponíveis a todos com acesso ao pipeline e à coluna. Cards reais com responsável e nenhum participante adicional não são classificados como sem vínculo. Leads virtuais não podem contornar o escopo após promoção.
10. Alterações de configuração, setor, atribuição e permissões revogam dados que deixam de ser autorizados na próxima reconciliação segura; eventos incrementais não introduzem cards fora da visão. Falhas de leitura/configuração não provocam fallback permissivo.
11. Preservar virtualização, lotes por coluna, busca em todo o conjunto autorizado, totais completos, arrasto autorizado e atualização incremental existentes. A nova visão não reintroduz download integral periódico de detalhes do pipeline.
12. Implementar a persistência aprovada em `BpmPipeline.visualizacaoConfigJson`, nullable e validada conforme o contrato acima; `NULL` e conteúdo inválido não concedem supervisão. A inclusão da coluna exige plano concreto, Vault, backup verificado de até 48 horas e autorização específica antes de executar; autorização geral de implementação não substitui esse gate.
13. Registrar testes e revisão de autorização, executar os gates do projeto e documentar limitações de validação visual/produção. Não declarar como publicado ou verificado um estado que não tenha evidência.

## Correção solicitada após publicação

O usuário pediu usar **somente o select de responsáveis já existente**, sem criar outro seletor para visão. Também relatou que a conta de teste **Líder Comercial** não visualiza todos os cards esperados. O relato é um sintoma a investigar; não comprova defeito na consulta nem autoriza conceder acesso irrestrito por nome de cargo.

### Critérios adicionais de aceite

14. A barra do quadro utiliza apenas o select existente de responsáveis para as escolhas pertinentes de visão e responsável. Remover o segundo seletor de visão, preservando o padrão inicial confirmado “Meus leads + sem vínculo”, a possibilidade de escolher o conjunto autorizado e a filtragem por responsável específico. Rótulos devem tornar o efeito de cada opção inequívoco.
15. O valor escolhido no select único determina um estado coerente de visão/filtro enviado ao servidor; não manter combinações ocultas de dois seletores que limitem silenciosamente o resultado. Troca de opção limpa filtros incompatíveis, descarta respostas antigas e atualiza totais, manifesto e lotes de modo consistente.
16. Investigar a configuração efetiva da conta de teste Líder Comercial em leitura: identidade da sessão, pipeline consultado, entrada explícita de supervisor, setores selecionados, vínculo real dos responsáveis/participantes, restrições de coluna e modo/responsável selecionado. Registrar contagens agregadas esperadas versus retornadas por etapa e motivo de exclusão, sem versionar dados pessoais ou credenciais.
17. Corrigir divergências entre o conjunto autorizado e o conjunto retornado/exibido. Se a causa for ausência ou insuficiência de configuração, apresentar o diagnóstico e a configuração necessária; não cadastrar supervisão automaticamente nem converter o cargo Líder Comercial em bypass global. “Todos” corresponde ao conjunto que a pessoa está autorizada a consultar naquele pipeline.
18. Preservar a separação entre leitura ampliada e ação, o bypass administrativo existente e as restrições de pipeline/coluna. A correção visual não pode conceder acesso adicional por adulteração do valor do select, por estado antigo ou por um evento de atualização.
19. Testes cobrem select único, padrão inicial, escolha do universo autorizado, responsável específico, mudança de opção, configuração nula/inválida, supervisor com setores e conta sem configuração. Comparar dados, totais e opções da interface com o escopo do servidor; registrar explicitamente se não houver validação autenticada da conta real em produção.

### Checklist da reabertura

- [x] Registrar a exigência de select único e o relato da conta Líder Comercial.
- [x] Diagnosticar configuração e escopo efetivos da conta/pipeline, somente em leitura.
- [x] Registrar causa encontrada e diferença entre expectativa, autorização e resultado.
- [x] Consolidar visão/responsável no select existente e remover o seletor adicional.
- [x] Corrigir eventual divergência funcional sem ampliar permissões indevidamente.
- [x] Validar testes de filtro, isolamento, totais, atualizações e leitura versus ação.
- [x] Executar gates aplicáveis e registrar evidências reais da correção/publicação.
- [x] Atualizar file list da correção preservando o histórico da entrega anterior.

### File list da preparação da correção

- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md` (reabertura e critérios; nenhum código alterado por @sm).

## Pontos de integração verificados

- `src/actions/bpm/VisibilidadePipeline.ts`: configuração atual de setores, `configVersion`, auditoria e notificação pós-gravação.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`: interface atual de visibilidade.
- `src/lib/bpm/ownership.ts`: fonte central de acesso a pipeline/card e ações.
- `src/lib/bpm/visibilidade-card.ts`: filtro atual de responsável ou participante; administradores recebem filtro global.
- `src/lib/bpm/quadro-paginado.ts`: filtro de responsável no contrato do quadro.
- `src/actions/bpm/Quadro.ts`, `Cards.ts`, `NolossLeads.ts`, `Arquivados.ts`, `Dashboard.ts`: leituras que devem ser avaliadas para coerência do escopo.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: seleção da visão, filtro de responsáveis e reconciliação.
- `docs/stories/story-alpha-crm-performance-visibilidade-pipeline.md`: comportamento entregue e testes de regressão.
- `docs/stories/story-rm-2026-1ea5c1-visibilidade-colunas-crm-bpm.md`: composição com restrições de coluna.
- `AGENTS.md`: gates de qualidade e de banco.

Os caminhos são pontos de investigação/integração, não uma lista de arquivos já alterados. A supervisão é configurada explicitamente por pessoa; a relação real usuário–setor deve ser verificada no código, sem criar perfil implícito ou conceder supervisão por nome de cargo.

## Checklist de implementação

- [x] Registrar pedido e limites do escopo.
- [x] Identificar contexto da ACL e arquivos atuais.
- [x] Registrar resposta sobre visão inicial: meus leads + sem vínculo para todos.
- [x] Registrar resposta sobre setores: escolhidos por pipeline e por pessoa supervisora.
- [x] Registrar arquitetura aprovada: campo nullable `visualizacaoConfigJson`, configuração explícita por pessoa e setores.
- [x] Verificar relação real usuário–setor usada na consulta de equipe.
- [x] Definir contrato único de leitura e integração com permissões de ação existentes.
- [x] Implementar configuração, auditoria/versionamento e interface clara.
- [x] Atualizar visão/filtro de responsáveis e consultas de todos os caminhos pertinentes.
- [x] Validar revogação, eventos, paginação e totais sem regressão de desempenho.
- [x] Concluir gate Vault específico antes de incluir a coluna `visualizacaoConfigJson` no banco.
- [x] Executar testes direcionados, lint, typecheck, suíte e build.
- [x] Registrar revisão, resultados, file list e situação de publicação com evidências.

## Estratégia de testes

- Matriz de autorização: usuário comum, líder elegível/não elegível, administrador; próprio card, participação, terceiro da equipe, outro setor e lead sem vínculo.
- Composição: pipeline negado, coluna negada, leitura permitida/ação negada, setores vazios/inexistentes, múltiplos vínculos, usuário sem setor e acesso direto a card.
- API: tentativa de adulterar usuário/responsável/setor/visão, total sem vazamento, busca de card ainda não carregado, mesma regra em detalhes/histórico e paginação.
- Configuração: salvamento autorizado, ator proibido, versão antiga, atomicidade, auditoria, leitura de volta e erro sem abertura de permissões.
- Interface/eventos: alternância de visão, responsável incompatível, resposta fora de ordem, revogação de acesso, transferência de setor, reatribuição, reconexão e deduplicação.
- Regressão: virtualização, limites por coluna, contagens completas, arrasto e rollback; mutações continuam bloqueadas quando houver somente visão de equipe.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, build e testes direcionados. Falhas preexistentes devem ser distinguidas de regressões desta story.

## CodeRabbit Integration

**Tipo:** autorização, API, frontend e coluna nullable de configuração.

- Pre-commit (@dev): foco em isolamento horizontal, composição de filtros, concorrência e validação de entradas.
- Revisão (@architect/@qa): leitura versus ação, consistência entre caminhos, revogação e desempenho.
- Vault: acionado antes de qualquer necessidade estrutural; não executar mudanças nesta preparação.
- @devops: operações remotas/publicação no fluxo próprio, excluindo mudanças concorrentes fora do escopo.
- CodeRabbit habilitado no core-config; registrar indisponibilidade do CLI se aplicável e revisão manual efetivamente realizada, sem alegar execução inexistente.

## Story Draft Checklist

- [x] Objetivo e contexto identificados.
- [x] Limites de segurança de leitura e ação explícitos.
- [x] Integrações atuais referenciadas.
- [x] Testes e riscos de persistência descritos.
- [x] Decisões funcionais confirmadas registradas sem pendências; gate de banco separado da autorização funcional.

## Dev Agent Record

Implementação: resolvedor central `carregarEscopoLeituraBpm` compõe próprios vínculos com concessões por pipeline; setores são resolvidos pela igualdade normalizada de `usuarios.role` e `Setor.nome`, sem inferir chefia de cargo. Responsável ou participante do setor inclui o card na equipe. Administradores preservam o máximo global; a visão inicial de todos é MEUS. Setor sem usuários não libera outros setores; JSON ausente/inválido não concede supervisão.

Novo papel calculado `VISUALIZADOR` existe somente no resultado do guard, sem atribuir membros ou gravar vínculos. Permite visualizar/histórico e retorna `podeAgirEtapa: false`. Consulta de supervisão não marca primeira visualização, inicia SLA nem persiste status/disparos/eventos de SLA; Callix exige ação de edição. CTA de agendamento fica oculto em cards somente de leitura. Mutações existentes continuam usando autorização central.

A configuração reutiliza CAS de `configVersion`, auditoria e notificação; o payload antigo sem configuração de equipe preserva a regra já salva. A UI permite selecionar pessoas ativas com acesso ao CRM e setores, deixando explícita a separação entre entrada no pipeline e consulta da equipe. Supervisores precisam também de acesso ao pipeline/coluna.

O manifesto contém somente o máximo autorizado; MEUS/EQUIPE/SETOR/TODOS e responsável são filtros restritivos. Admin oferece meus/todos/setor; supervisor oferece meus/equipe/setores permitidos. Revogação de uma visão limpa o quadro/modal e volta a MEUS. O polling e a hidratação limitada permanecem iguais; duas consultas de setores/usuários são necessárias quando há visão de equipe ou opções administrativas. Sem benchmark novo de latência ou promessa de ganho de velocidade.

### Banco — Vault aprovado e aplicado

- Única mudança: `ALTER TABLE "BpmPipeline" ADD COLUMN "visualizacaoConfigJson" TEXT`, nullable, sem default, update ou backfill.
- Fingerprint `eada075d57007935d72f08807b752d42badeb73b0df01ca164d0d2979d3c2826`; script `scripts/crm-pipeline-visao-equipe.mjs`.
- Backup completo `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-14T13-02-06-739Z.sql`, 336 tabelas, 253019 linhas, 316983168 bytes; SHA256 `762228113783f343434d2cc869d584763b14512c976d482412cc0ac55cab699f`. Vault verificou identidade do banco, restauração local, integridade, FKs e contagens.
- Usuário autorizou especificamente; execução às 13:05:50 UTC: coluna criada, três pipelines antes/depois, `verify` confirma definição; logs `/tmp/crm-equipe-apply.log`, `/tmp/crm-equipe-verify.log` e `/tmp/crm-equipe-db-check.log`. Não configuramos supervisores reais automaticamente.
- Rollback: reverter o aplicativo e manter o campo nullable sem uso; não remover configurações. Novo aplicativo depende da coluna e só pode publicar após verificação.

### Validação do artefato isolado

Testes direcionados aprovados: configuração salva/leitura de volta, seleção e persistência via UI, supervisor/coluna/pipeline, ações negadas, revogação, setor alterado, manifesto e filtros adulterados, modos da UI, projeção SLA sem efeitos, Callix negado e migration em SQLite descartável com confirmação/backup/idempotência. Testes completos no workspace: somente três falhas do Builder concorrente fora deste patch; será repetido em checkout isolado do CRM. Typecheck passou; erro inicial de dependências de memoização foi corrigido e lint do componente passou. O artefato `cfb5ba2d` foi então validado em worktree isolado `/tmp/crm-equipe-release`, com cópia privativa das dependências e sem os arquivos concorrentes do Builder/ChatbotX. Lint exit 0 (0 erros, 1.193 avisos), build exit 0, `npm test -- --maxWorkers=2` exit 0 (616 arquivos, 4.550 testes aprovados, 4 ignorados, 1 todo), typecheck pós-build exit 0. Logs: `/tmp/crm-equipe-isolated-lint.log`, `/tmp/crm-equipe-isolated-build.log`, `/tmp/crm-equipe-isolated-tests.log` e `/tmp/crm-equipe-isolated-typecheck.log`. Nenhuma das três falhas concorrentes do Builder ocorreu no artefato isolado.

Revisão manual @qa: PASS final, sem bloqueios de autorização após correções e confirmação dos quatro gates isolados do artefato final `8e9a51a0`. CodeRabbit CLI indisponível. Não houve sessão autenticada de navegador na Vercel; não afirmar teste manual de conta real.

### Proteção da configuração administrativa

O singleton Prisma omite `visualizacaoConfigJson` nas consultas comuns, incluindo relações e transações. Os leitores autorizados usam `select` explícito. A configuração é tipada como `Prisma.GlobalOmitConfig` para preservar compatibilidade com interfaces legadas de TransactionClient; a omissão é verificada em runtime com SQLite real. Não envolve nova alteração de banco. Gates do ajuste final `8e9a51a0` aprovados no mesmo worktree isolado: lint exit 0 (0 erros, 1.193 avisos), build exit 0, suíte exit 0 (617 arquivos, 4.551 testes aprovados, 4 ignorados, 1 todo), typecheck pós-build exit 0. Logs `/tmp/crm-equipe-omit-isolated-{lint,build,tests,typecheck}.log`. As cópias privadas de `.env` e `.env.local` foram removidas do worktree após os gates; arquivos originais preservados.

### Publicação final verificada

Código da funcionalidade `cfb5ba2d`, registro de gates `46eb3dd8` e ajuste final [`8e9a51a014b4a99cacf1e58b58d4b18a72404b67`](https://github.com/Vin1-SF19/PROJETOALPHACOMEX/commit/8e9a51a014b4a99cacf1e58b58d4b18a72404b67) publicados em main, excluindo integralmente mudanças concorrentes do Builder/ChatbotX. Deployment final Production `7066704353` / `dpl_CahYtzywxRmAa5NFbXRxwwfcd7Bj` concluiu com sucesso às 13:29:08 UTC de 14/10/2026.

[Deployment publicado](https://painel-alpha-projeto-aeh0ih5d8-alpha-comexs-projects.vercel.app) e [CRM em produção](https://painel-alpha-projeto.vercel.app/PainelAlpha/AlphaCRM). Alias conferido com parâmetro único e `Cache-Control: no-cache`: HTTP 200 na entrada, UTF-8, assets com o ID exato do deployment final. A rota CRM preserva HTTP 307 para `/?acesso=bloqueado` sem sessão. Nenhuma configuração real de supervisores foi criada automaticamente.

### File List

- `src/lib/prisma.ts`
- `tests/bpm/visao-equipe-prisma-omit.test.ts`
- `prisma/schema.prisma`
- `src/actions/bpm/Arquivados.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Dashboard.ts`
- `src/actions/bpm/Empresas.ts`
- `src/actions/bpm/Quadro.ts`
- `src/actions/bpm/Sla.ts`
- `src/actions/bpm/Tarefas.ts`
- `src/actions/bpm/VisibilidadePipeline.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/lib/bpm/cards-no-quadro.ts`
- `src/lib/bpm/ownership.ts`
- `src/lib/bpm/quadro-paginado.ts`
- `src/lib/bpm/sla.ts`
- `src/lib/bpm/visibilidade-card.ts`
- `tests/bpm/authorization-actions.test.ts`
- `tests/bpm/card-modal-integration.test.ts`
- `tests/bpm/card-telefones.test.ts`
- `tests/bpm/filtro-responsavel-board.test.ts`
- `tests/bpm/membros-card-ownership.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/sla-alertas-automacao.test.ts`
- `tests/bpm/visibilidade-pipeline-actions.test.ts`
- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md`
- `prisma/migrations/20261014130000_bpm_pipeline_visao_equipe/migration.sql`
- `scripts/crm-pipeline-visao-equipe.mjs`
- `src/lib/bpm/visao-equipe-server.ts`
- `src/lib/bpm/visao-equipe.ts`
- `tests/bpm/board-visao-equipe-react.test.ts`
- `tests/bpm/crm-pipeline-visao-equipe-migration.test.ts`
- `tests/bpm/visao-equipe-config-react.test.ts`
- `tests/bpm/visao-equipe.test.ts`

## Change Log

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-10-14 | 1.0 | Story preparada com duas decisões funcionais pendentes no fluxo principal | @sm |
| 2026-10-14 | 1.1 | Ready: setores por supervisor/pipeline, visão inicial individual para todos e contrato nullable aprovados; gate Vault pendente | @sm |
| 2026-10-14 | 1.2 | Gates isolados e QA PASS; coluna aplicada e publicação final 8e9a51a0 confirmada na Vercel | @devops |
| 2026-10-14 | 1.3 | Reaberta: select único de responsáveis e diagnóstico da visão da conta Líder Comercial, sem ampliar autorização por inferência | @sm |

### Diagnóstico e correção do filtro único — 14/10

Leitura de produção pelo arquiteto: Revisão Radar possui um supervisor configurado para COMERCIAL; os 763 cards ativos estão vinculados a TI (736) e OPERACIONAL (27), tanto pelo responsável quanto pelos membros. Não há vínculo COMERCIAL nesses cards. O perfil Líder Comercial, por si só, não concede supervisão; quatro usuários têm esse perfil. A conta de teste ainda precisa ser identificada pelo usuário. Nenhum vínculo ou configuração foi alterado durante o diagnóstico.

O filtro existente agora reúne Meus leads e sem vínculo (padrão), Todos os responsáveis (máximo autorizado), setores autorizados e pessoas. Não há um segundo select de visão. A seleção de pessoa consulta diretamente o máximo autorizado, sem continuar presa ao filtro Meus. A visão EQUIPE inclui próprios e setores, mantendo o mesmo limite de leitura do servidor; TODOS continua exclusivo do administrador no contrato servidor.

Testes direcionados iniciais: 4 arquivos, 16 testes aprovados; QA adicionou e aprovou a cobertura React do filtro único. Artefato isolado `0b0f8a45`: lint exit 0 (0 erros, 1.193 avisos), build exit 0, typecheck pós-build exit 0 e suíte completa exit 0 (617 arquivos, 4.553 testes aprovados, quatro ignorados e um todo). Logs `/tmp/crm-unified-isolated-{lint,build,typecheck,tests}.log`; QA final PASS para a correção de UI. Publicação confirmada abaixo. A ampliação de setores foi realizada somente após identificação da conta e autorização explícita do usuário, sem bypass de perfil.

### Conclusão da correção e acesso da conta de teste

Após o usuário identificar a conta de teste e autorizar TI e OPERACIONAL mantendo COMERCIAL, o fluxo principal atualizou somente a configuração do pipeline Revisão de Radar, com CAS de versão 25 para 26. Não houve alteração de leads, responsáveis ou membros; contagem e maior data de atualização dos cards permaneceram iguais. Recibo privado, não versionado: `database-backups/pre-change/crm-pipeline-visao-equipe/usuario-teste-config-receipt.json`.

Verificação independente do arquiteto, somente leitura: configuração versão 26 com três setores; acesso ao pipeline permitido, 9 de 9 colunas visíveis e 763 de 763 cards ativos dentro do escopo da conta de teste. Esses resultados validam as regras no servidor; não equivalem a um teste visual autenticado de navegador.

Publicação final do filtro único: commit [`0b0f8a45d71fbbb2673dce96c45f5a0bd3aa9aa4`](https://github.com/Vin1-SF19/PROJETOALPHACOMEX/commit/0b0f8a45d71fbbb2673dce96c45f5a0bd3aa9aa4), deployment Production `7067119608`, Vercel `dpl_Ae3kdLEdSEBNB1SKU9FuiXTmBJyv`, sucesso às 13:46:17 UTC de 14/10/2026. [Deployment publicado](https://painel-alpha-projeto-khiq4os86-alpha-comexs-projects.vercel.app). Alias canônico conferido com parâmetro único e `Cache-Control: no-cache`: HTTP 200 UTF-8 na entrada e assets com o ID exato; CRM mantém 307 para login sem sessão. Builder/ChatbotX concorrentes excluídos dos commits. Cópias privadas de ambiente removidas do checkout isolado após validação.
