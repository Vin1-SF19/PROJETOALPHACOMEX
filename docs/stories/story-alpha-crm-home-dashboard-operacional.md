# Story: Alpha CRM — Home operacional

## Status

In Progress — implementação concluída; validação autenticada e gates globais pendentes.

## Story

Como usuário autorizado do Alpha CRM, quero uma Home operacional que reúna indicadores, meu pipeline, tarefas e atividade recente, para entender prioridades e acessar o trabalho permitido ao meu perfil.

**Origem:** solicitação do usuário nesta sessão. Esta story substitui como direção funcional o visual da Home descrito em `story-alpha-crm-corrigir-home-visual-sem-alterar-pipelines.md`; essa story anterior não deve ser alterada nem usada para manter os três cards de navegação em lugar dos quatro indicadores solicitados.

## Critérios de aceite

1. A Home de `/PainelAlpha/AlphaCRM` apresenta o título **Alpha CRM** e o subtítulo **Centralize seus processos e acompanhe suas operações em tempo real.** O cabeçalho contém somente esses dois elementos, sem busca, notificações, perfil ou atalhos.
2. A primeira linha apresenta quatro cards: **Tarefas hoje**, **Pendências críticas**, **Cards ativos** e **Configurações**. Os três primeiros exibem seus valores atuais e a variação/comparativo solicitados, usando somente dados reais do CRM e períodos comparáveis; quando não houver base comparável ou o cálculo não for definido (por exemplo, denominador zero), a interface indica indisponibilidade do comparativo em vez de inventar um percentual. Os cards usam apoio visual discreto, sem efeitos de neon ou brilho excessivos.
3. O card **Configurações** apresenta a descrição “Gerencie preferências, permissões e parâmetros do sistema” (ou texto equivalente), leva à rota administrativa existente e só é renderizado para perfis com a permissão administrativa correspondente. A rota e suas ações continuam validando autorização no servidor; ocultar o card não é controle de acesso.
4. A área principal de pipeline é um card amplo, com nome real do pipeline, contagem de cards visíveis, descrição operacional e CTA discreto **Acessar módulo**. Cada etapa usa o nome e a ordem configurados para o pipeline e mostra contagem de cards visíveis, barra discreta e percentual calculado sobre o total visível daquele pipeline; não se fixam nomes de etapa de exemplo no código. O CTA abre a rota existente do pipeline.
5. O escopo de leitura do pipeline e das contagens obedece à regra do pedido: usuário comum vê somente o pipeline de seu setor e recebe o selo **Meu setor**; Admin e TI podem ver a visão consolidada dos pipelines autorizados, identificada discretamente. A autorização é aplicada nas consultas server-side, em conjunto com as permissões atuais de pipeline, etapa, card e setor; dados de outro setor não podem aparecer apenas por terem sido filtrados no cliente. Qualquer regra explícita de visibilidade mais restritiva continua valendo.
6. A seção **Tarefas pendentes** mostra quantidade, link **Ver todas**, filtros **Todas**, **Atrasadas**, **Hoje** e **Próximas**, e uma listagem/tabela com tarefa, empresa/cliente, prioridade, prazo, responsável e ação. Cada filtro produz itens coerentes com o prazo e o estado atuais. Linhas e tags mantêm contraste e legibilidade em desktop e telas estreitas; as ações apontam para operações e destinos existentes e respeitam as permissões do card.
7. A seção **Atividade recente** mostra quantidade, link **Ver todas** e eventos existentes com horário, ação, usuário responsável e módulo/pipeline relacionado. O feed é limitado ao escopo que o usuário pode ler e não cria eventos fictícios.
8. A página adapta as quatro áreas à largura disponível, preserva hierarquia, foco de teclado e leitura por tecnologias assistivas, com base azul-escura/preto azulado, superfícies e bordas suaves e animação/hover discretos. O resultado mantém a identidade operacional do CRM e não altera o estilo nem o comportamento do board do pipeline.
9. Indicadores, tarefas, pendências e atividade são derivados de registros e regras já existentes, sem migrations, mudanças de schema, seeds/backfills, mutações em massa ou alteração de dados. Não se cria uma nova definição de criticidade: o contador **Pendências críticas** usa apenas condições objetivas já representadas pelo CRM (por exemplo, prazo/SLA vencido ou prioridade existente), conforme as regras atuais.

## Tarefas / subtarefas

- [x] Mapear a resposta e as consultas atuais do dashboard e as rotas já existentes para tarefas, pendências, configurações e pipelines (AC: 2–7).
- [x] Ajustar a leitura server-side da Home para compor os indicadores, comparativos, etapas e listagens a partir dos dados existentes, respeitando autorização por pipeline, etapa, card e setor (AC: 2–7, 9).
- [x] Atualizar a Home para o tema dark clean, cabeçalho institucional e quatro cards de resumo, incluindo a visibilidade autorizada de Configurações (AC: 1–3, 8).
- [x] Implementar o card principal de pipeline com etapas reais, contagens, percentuais, CTA e apresentação de escopo individual ou consolidado conforme o perfil (AC: 4–5, 8).
- [x] Implementar filtros e tabela de tarefas e feed de atividade, com links/destinos existentes e estados vazios/indisponíveis honestos (AC: 6–7).
- [ ] Validar autorização e dados exibidos com perfis comuns de setores distintos, Admin, TI e demais perfis administrativos atualmente reconhecidos; cobrir comparativos ausentes, filtros de prazo, etapa sem cards e viewport estreita (AC: 2–9).
- [ ] Executar verificações de qualidade do projeto e registrar resultados, checklist e File List na conclusão da implementação.

## Dev Notes

- **Home e contrato atual:** `src/app/PainelAlpha/AlphaCRM/page.tsx` carrega `ObterDashboardBpm()` e `DashboardClient.tsx` renderiza a Home. Hoje a resposta já inclui pipelines autorizados, contagens por status, total de cards ativos, tarefas pendentes (até 50), contagem de tarefas atrasadas, eventos recentes (até 20) e conclusões da semana. Não inclui comparação do período anterior nem todos os campos necessários para etapas e tabela. Ajustar a leitura/agregação usando os modelos existentes; não presumir que os limites atuais de 50/20 sejam totais para indicadores.
- **Fontes de dados e destinos existentes:** `src/actions/bpm/Dashboard.ts`, `src/actions/bpm/Pendencias.ts`, `src/lib/bpm/pendencias/motor.ts`, `src/app/PainelAlpha/AlphaCRM/tarefas/page.tsx`, `src/app/PainelAlpha/AlphaCRM/pendencias/page.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/page.tsx` e `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`. O motor de pendências já retorna tipos como `TAREFA_PENDENTE`, `PROXIMO_CONTATO_VENCIDO`, `SLA_PROXIMO` e `SLA_VENCIDO`, além de pipeline, etapa e responsável; use sua semântica existente e não crie uma nova classificação persistida.
- **Autorização:** `src/lib/bpm/ownership.ts`, `src/lib/bpm/visao-equipe-server.ts`, `src/lib/bpm/visibilidade-etapa.ts` e `src/lib/roles.ts` contêm verificações e escopos usados pelo módulo. A Home atual usa verificações de acesso a pipelines e a Configurações. A nova regra setorial precisa ser imposta no servidor sem enfraquecer restrições explícitas de pipeline/etapa/card. O helper atual `isAdminRole` inclui Admin, CEO e TI, enquanto o texto do pedido nomeia Admin e TI para visão consolidada; conferir essa diferença na implementação e evitar conceder novas permissões ou remover uma autorização existente sem resolver o mapeamento com as verificações já estabelecidas.
- **Criticidade e comparativos:** os itens de pendência não carregam um campo genérico de severidade e tarefas usam prioridades existentes (incluindo `BAIXA`, `NORMAL` e `ALTA`). Reutilizar somente critérios existentes de atraso/SLA/prioridade; se não houver critério que classifique um item como crítico, apresentar a indisponibilidade de forma honesta e não inventar regra. Comparativos precisam usar intervalos equivalentes derivados de timestamps disponíveis e respeitar o mesmo escopo de autorização.
- **Compatibilidade de escopo:** o documento `docs/stories/story-alpha-crm-corrigir-home-visual-sem-alterar-pipelines.md` está em conflito com este pedido por exigir três cards de navegação. Foi deliberadamente preservado; esta story requer os quatro cards e a nova composição da Home. A story anterior também registra que alterações no layout compartilhado podem afetar rotas internas; limitar alterações ao necessário para a Home e preservar o board.
- **Arquitetura/documentação:** `.aiox-core/data/technical-preferences.md` indica o preset `nextjs-react`. Não foi encontrado guia específico de frontend/testing em `docs/architecture/`; o único arquivo listado nessa pasta é `adr-alpha-explorer-identidade-smb.md`, sem relação direta com esta Home. `accumulated-context.md` e `.aiox/gotchas.json` também não foram encontrados no workspace.
- **Limite de persistência:** nenhuma mudança de banco é autorizada por esta story. Caso implementação identifique necessidade de nova estrutura, interromper esse escopo e seguir o processo Vault/backup/aprovação explícita do `AGENTS.md` antes de propor ou executar qualquer migração.

## Testes e qualidade

- Testes direcionados da composição/contagem verificam as métricas, o tratamento de ausência de período comparável e a derivação das etapas dos dados visíveis.
- Matriz de autorização verifica usuário comum de setores diferentes, Admin e TI; confirma que consulta, contagens, atividades, tarefas, pipeline consolidado e acesso a Configurações não revelam conteúdo fora do escopo. Verificar também os perfis administrativos já aceitos atualmente, sem inferir permissões pelo rótulo exibido.
- Validar filtros Todas/Atrasadas/Hoje/Próximas com itens vencidos, com prazo de hoje, futuro e sem prazo, e validar ações e links para os destinos existentes.
- Conferir feed com e sem eventos, tarefa/pipeline sem dados, erros de carregamento e ausência de comparativo; nada deve virar indicador ou atividade fictícia.
- Revisão responsiva e de acessibilidade: viewport estreita e desktop, contraste, foco/teclado, semântica de tabela/lista, rótulos de filtros, prefers-reduced-motion e ausência de efeitos visuais excessivos.
- Quality gates do repositório na implementação: `npm run lint`, `npm run typecheck` e `npm test`; registrar resultados reais, sem marcar como executados antes da implementação.

## 🤖 CodeRabbit Integration

**Story Type Analysis**

- Tipo primário: Frontend
- Tipos secundários: autorização/leitura de dados (sem mudança de schema)
- Complexidade: média — dashboard, agregação server-side, filtros e validação de escopo entre perfis.

**Agentes especializados**

- Primários: @dev, @ux-design-expert
- Apoio: @qa

**Quality gates**

- [ ] Pre-Commit (@dev): revisar qualidade, acessibilidade, responsividade e autorização server-side.
- [ ] Pre-PR (@github-devops): revisar integração e compatibilidade com rotas existentes.

**Foco de revisão**

- Integridade do escopo setorial e filtros de autorização na origem dos dados.
- Métricas sem números, percentuais ou eventos fictícios.
- Acessibilidade, responsividade e consistência visual sem regressão no board.

**Self-healing:** @dev, modo light, até 2 iterações/15 minutos, CRITICAL auto-fix; HIGH documentado.

## Checklist da story

- [x] Objetivo e valor para o usuário estão explícitos.
- [x] Critérios cobrem todos os componentes e regras de permissão pedidos, com resultados verificáveis.
- [x] Contexto das fontes e rotas existentes foi registrado; limitações e conflito de autorização foram explicitados.
- [x] Dados e semântica são derivados do CRM existente; nenhuma mudança de schema foi incluída.
- [x] Testes e quality gates estão especificados sem alegar execução.
- [x] Tarefas permanecem desmarcadas para a implementação.
- [x] Dev Agent Record e File List estão reservados para o agente de implementação.

**Validação do checklist de rascunho:** READY para desenvolvimento; objetivo claro, referências relevantes, escopo autocontido e cenários testáveis. Riscos em aberto para implementação: mapeamento CEO versus “Admin e TI” e critério de negócio para o rótulo “críticas”, que não existe como severidade genérica no retorno atual.

## Dev Agent Record

### Agent Model Used

Codex GPT-6

### Debug Log References

Lint direcionado passou sem erros nem warnings para `Dashboard.ts`, `DashboardClient.tsx`, `page.tsx` e `cards-no-quadro.ts`. `npm run typecheck` foi executado e falhou em `scripts/importar-sla-rd-alpha.mts` (dois `@ts-expect-error` não utilizados e duas referências a `id` ausente); não apresentou erros nos arquivos desta story. `npm test` não foi executado.

### Completion Notes List

- A Home usa indicadores derivados das tarefas/cards existentes; comparativos sem período anterior válido são exibidos como indisponíveis.
- “Pendências críticas” usa o critério objetivo já disponível de tarefas pendentes com prazo vencido. Não foi criada severidade nova.
- Pipelines, etapas, tarefas e eventos permanecem filtrados no servidor por permissões existentes, etapa visível, pipeline/setor e escopo de cards.
- Não houve alteração de schema, migration ou dados.
- Validação de UI autenticada e testes permanecem pendentes.

### File List

- `docs/stories/story-alpha-crm-home-dashboard-operacional.md` — story e registro do andamento.
- `src/actions/bpm/Dashboard.ts` — métricas reais, comparativos, etapas e escopo setorial no payload do dashboard.
- `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx` — Home, cards, pipeline, filtros, listagem e atividade recente.
- `src/app/PainelAlpha/AlphaCRM/page.tsx` — skeleton de carregamento alinhado ao novo layout.
- `src/lib/bpm/cards-no-quadro.ts` — distribuição dos cards visíveis por etapa com a mesma regra do quadro.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-10-14 | 1.0 | Nova story da Home operacional do Alpha CRM, conforme pedido atual | @sm |
