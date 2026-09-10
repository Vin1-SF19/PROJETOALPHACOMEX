# Story: Alpha CRM — configurações centralizadas e editor do card

## Status

Review

## Contexto

A administração do CRM expõe um editor de “Campos Personalizados” que concorre visualmente com o formulário canônico por etapa, enquanto a aba “Card do Kanban” oferece apenas leitura. Automações, checklists, base de conhecimento e cadências também aparecem como entradas independentes na sidebar, fragmentando a configuração administrativa.

O pedido aprovado é simplificar essa experiência sem alterar schema ou dados: manter o formulário canônico por etapa, tornar a composição do card realmente editável, remover a simulação administrativa de SLA e concentrar os módulos administrativos sob Configurações.

## Story

**Como** administrador do Alpha CRM,
**quero** configurar formulários, cards e módulos auxiliares em um único espaço administrativo,
**para que** toda alteração disponível seja funcional, persistida e encontrada sem atalhos redundantes na sidebar.

## Escopo

1. Remover da aba “Campos e formulários” toda a área de “Campos Personalizados” e seus agrupamentos por etapa, preservando “Formulário — {etapa}” e os dados existentes.
2. Tornar a aba “Card do Kanban” editável usando a composição canônica do formulário, com criação, renomeação, exclusão e movimentação de seções e componentes, além do preview publicado.
3. Permitir mover componentes entre seções e definir rótulo de apresentação sem alterar a identidade canônica do campo/capability.
4. Remover da tela de SLA apenas o bloco “Simulação real do runtime”; o runtime de SLA permanece intacto.
5. Criar navegação administrativa por abas para Pipelines, Automações, Checklists, Base de Conhecimento e Cadências.
6. Mover o acesso de Automações para `/PainelAlpha/AlphaCRM/admin/automacoes`, preservando redirecionamento da URL anterior.
7. Remover da sidebar do CRM os atalhos independentes para Automações, Checklists, Base de Conhecimento e Cadências.

## Fora de escopo

- Alterações de schema, migration, seed, backfill ou escrita direta no banco.
- Exclusão de campos, formulários, valores de cards, automações, checklists, artigos ou cadências existentes.
- Mudanças no motor de SLA, automações, checklists ou cadências.
- Renomear a identidade canônica de campos e capabilities; o editor altera apenas o rótulo visual do componente.
- Commit, push, PR ou deploy.

## Critérios de aceite

- [ ] **AC1:** “Campos e formulários” inicia no editor “Formulário — {etapa}” e não renderiza o editor antigo de Campos Personalizados nem os grupos “Campos aplicáveis nesta etapa”.
- [ ] **AC2:** a aba “Card do Kanban” permite adicionar, renomear, remover e reordenar seções; adicionar, renomear, remover e mover componentes na mesma seção ou entre seções.
- [ ] **AC3:** salvar a composição usa `SalvarFormularioEtapaBpm`, mantém IDs existentes e atualiza o preview/runtime canônico.
- [ ] **AC4:** rótulos personalizados de componentes são validados, persistidos em `configJson` e exibidos no preview e no card real sem trocar campoId/capability.
- [ ] **AC5:** a aba SLA não contém a simulação do runtime e mantém CRUD, ativação e exclusão de SLA.
- [ ] **AC6:** Configurações possui abas funcionais para Pipelines, Automações, Checklists, Base de Conhecimento e Cadências, respeitando autorização administrativa.
- [ ] **AC7:** a sidebar não contém atalhos independentes para os quatro módulos movidos; URLs antigas de automações continuam funcionando via redirecionamento.
- [ ] **AC8:** não há alteração estrutural ou mutation em massa de banco.
- [ ] **AC9:** testes focados, lint e typecheck aplicáveis passam; regressões externas, se existentes, são discriminadas.

## Tasks / Subtasks

- [x] Remover a UI e o estado exclusivo do editor legado de campos (AC1, AC8).
- [x] Evoluir o builder canônico para edição integral da composição e rótulos (AC2–AC4).
- [x] Integrar builder e preview na aba Card do Kanban (AC2–AC4).
- [x] Remover a simulação da tela de SLA (AC5).
- [x] Centralizar rotas administrativas e limpar a sidebar (AC6–AC7).
- [x] Adicionar/ajustar testes e executar quality gates (AC9).

## Dev Notes

- A composição canônica já reside em `BpmEtapaFormulario` e é salva diferencialmente por `SalvarFormularioEtapaBpm`; preservar esse contrato e a proteção por versão. [Source: `docs/stories/story-rm-2026-045cc0-crm-stage-form-migration.md`]
- Preview administrativo e card real já compartilham `FormularioEtapaRenderer`; qualquer rótulo de apresentação deve atravessar esse renderer único. [Source: `docs/stories/story-rm-2026-40526e-crm-canonical-renderer.md`]
- Publicações administrativas independentes avançam `configVersion`; não criar outro mecanismo de concorrência. [Source: `docs/stories/story-rm-2026-eb2898-crm-config-save-consistency.md`]
- A story é Frontend + Integration, complexidade média, sem banco.

## Testing

- Testar ausência do editor antigo e presença do formulário canônico.
- Testar renomeação, exclusão, reordenação e movimentação entre seções.
- Testar validação e resolução do rótulo persistido.
- Testar navegação administrativa e ausência dos atalhos removidos na sidebar.
- Testar remoção apenas da simulação de SLA.
- Executar `npm run lint`, `npm run typecheck` e testes focados/globais conforme viabilidade do repositório.

## CodeRabbit Integration

**Primary Type:** Frontend
**Secondary Type:** Integration
**Complexity:** Medium

**Primary Agents:** @dev, @ux-design-expert

**Quality Gates:**

- [ ] Pre-Commit: revisão de código não commitado.
- [ ] Pre-PR: revisão do diff contra `main` quando houver PR.

**Self-Healing:** @dev em modo light, até 2 iterações, 15 minutos, severidade CRITICAL.

**Focus Areas:** acessibilidade de controles, persistência sem perda de identidade, navegação consistente e ausência de regressões no renderer canônico.

## Dev Agent Record

### Completion Notes

- Removido o editor concorrente de Campos Personalizados sem excluir campos, formulários ou valores persistidos.
- O builder canônico agora edita títulos de seções, rótulos visuais, ordem, exclusão e movimento de componentes entre seções; o save diferencial e o CAS existentes foram preservados.
- Rótulos são validados em `configJson` e atravessam o renderer compartilhado até o preview e o card real.
- Automações, Checklists, Base de Conhecimento e Cadências foram centralizados nas abas de Configurações; a URL antiga de Automações redireciona para a nova rota.
- SLA manteve CRUD/ativação/exclusão e perdeu apenas a simulação administrativa solicitada.
- Testes focados: 109/109 verdes. Suíte BPM: 909/915 verdes; as 6 falhas restantes estão em três arquivos não alterados por esta story. ESLint do escopo: verde.
- Gates globais permanecem bloqueados por baseline externo: lint (21.203 ocorrências no repositório), typecheck (rotas/Agenda/Radar/testes fora do escopo), testes (28 falhas em 14 arquivos) e build (download da fonte Google Geist).
- CodeRabbit não executado porque o CLI não está instalado neste ambiente; revisão manual do diff concluída sem finding crítico.
- Nenhuma migration, seed, backfill ou mutation em massa foi criada ou executada.

### File List

- [x] `docs/stories/story-alpha-crm-configuracoes-centralizadas-editor-card.md`
- [x] `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/AdminConfigTabs.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/automacoes/page.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/layout.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/SlaConfigSection.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/automacoes/page.tsx`
- [x] `src/lib/bpm/formularios-etapa.ts`
- [x] `tests/bpm/automacoes.test.ts`
- [x] `tests/bpm/campos-agrupados-por-coluna.test.ts`
- [x] `tests/bpm/checklists-entrega-shell.test.ts`
- [x] `tests/bpm/cnpj-mascara.test.ts`
- [x] `tests/bpm/crm-configuracoes-centralizadas.test.ts`
- [x] `tests/bpm/formulario-renderer.test.ts`
- [x] `tests/bpm/formularios-etapa-save.test.ts`
- [x] `tests/bpm/pipeline-config-publicacao.test.ts`
- [x] `tests/bpm/pipeline-config-workspace.test.ts`

### Change Log

- 2026-09-10: story criada e aprovada a partir da solicitação direta do usuário.
- 2026-09-10: implementação concluída e movida para Review, sem alterações de banco.
