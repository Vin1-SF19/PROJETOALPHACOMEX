# Story: Visão dos próprios leads e da equipe por pipeline

## Status

Ready for Review — implementação concluída, coluna autorizada e aplicada; gates finais e publicação em preparação.

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
- [ ] Executar testes direcionados, lint, typecheck, suíte e build.
- [ ] Registrar revisão, resultados, file list e situação de publicação com evidências.

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

### Validação em andamento

Testes direcionados aprovados: configuração salva/leitura de volta, seleção e persistência via UI, supervisor/coluna/pipeline, ações negadas, revogação, setor alterado, manifesto e filtros adulterados, modos da UI, projeção SLA sem efeitos, Callix negado e migration em SQLite descartável com confirmação/backup/idempotência. Testes completos no workspace: somente três falhas do Builder concorrente fora deste patch; será repetido em checkout isolado do CRM. Typecheck passou; erro inicial de dependências de memoização foi corrigido e lint do componente passou. Gates finais do artefato isolado serão registrados antes de publicação.

Revisão manual @qa sem novos bloqueios de autorização após correções; veredito final depende dos gates isolados. CodeRabbit CLI indisponível. Não houve sessão autenticada de navegador na Vercel; não afirmar teste manual de conta real.

### File List

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
