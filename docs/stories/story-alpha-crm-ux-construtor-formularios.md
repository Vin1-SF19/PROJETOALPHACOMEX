# Story — UX da configuração de pipeline e do construtor de formulários

## Status

Ready for Review

## Executor Assignment

- Executor: `@dev`
- Quality gate: `@qa`
- Apoio visual: `@ux-design-expert`
- Quality gate tools: testes de UI, lint, typecheck, suíte, build e revisão visual responsiva

## Story

**Como** administrador do CRM, **quero** uma configuração de pipeline compacta e um construtor visual de formulários claro, **para** identificar a etapa, organizar seções, campos e blocos, inspecionar propriedades, conferir a prévia e publicar sem perder espaço ou me confundir com ações de rascunhos diferentes.

## Contexto e limites

O pedido do usuário em 2026-09-29 é uma reformulação **exclusivamente visual e de UX** da área interna de configuração de qualquer pipeline. O header, a sidebar, as abas superiores e toda a navegação global são intocáveis. A lógica, os eventos, as permissões, os endpoints, as validações, os modelos de dados e as duas publicações já existentes permanecem os mesmos. A configuração do pipeline tem um rascunho principal; a aba Campos e formulários publica uma composição por etapa. As ações devem continuar claramente distintas.

O cabeçalho local grande de `AdminPipelineClient.tsx` ocupa o topo do conteúdo em todas as abas. Seus controles `Publicado`, `Descartar alterações` e `Publicar rascunho principal` devem virar um dock fixo no canto inferior direito **somente quando o rascunho principal tiver alterações reais**. O estado publicado pode ser comunicado de modo compacto no contexto da página, sem exibir o dock inativo. Erros e conflitos devem continuar visíveis e operáveis mesmo quando o dock estiver oculto.

O editor existente em `FormularioEtapaWorkspace.tsx` já oferece seleção de etapa, criação/ordenação de seções, catálogo de campos, blocos operacionais, propriedades, publicação e prévia real. O trabalho aproveita esses estados e handlers; não cria uma segunda implementação.

## Critérios de aceitação

1. Em qualquer pipeline, o cabeçalho **local** grande do editor deixa de ocupar o topo. O header e a sidebar globais, as abas superiores, rotas e identidade global permanecem intactos. O conteúdo conserva contexto suficiente para identificar pipeline e aba.
2. Os controles do rascunho principal (`Publicado`/estado, `Descartar alterações`, `Publicar rascunho principal`) aparecem em dock fixo no canto inferior direito apenas quando há diferença real entre estado local e estado confirmado. O dock desaparece após descarte ou publicação bem-sucedida; não aparece ao apenas abrir, selecionar aba/etapa ou salvar composição independente. O estado de publicação, erro, conflito e desabilitação preserva os handlers e mensagens atuais. O dock não cobre conteúdo/ações em telas pequenas, com espaço inferior quando necessário.
3. Na aba Campos e formulários, o contexto compacto identifica pipeline, etapa selecionada, formulário ativo/inativo, contagem real de seções/componentes e alterações não publicadas da composição. A ação `Publicar composição` continua chamando `salvar()` e respeitando `publicationBlocked`, `sujo`, salvamento em curso e demais guardas atuais.
4. Em desktop, a aba organiza o conteúdo em três áreas distinguíveis: etapas do pipeline, construtor central e inspector de propriedades. Em larguras menores, a mesma informação e ações ficam acessíveis sem sobreposição nem rolagem horizontal global. A etapa selecionada tem destaque evidente; contagens vêm dos dados reais. A seleção continua respeitando a proteção atual contra troca com rascunho não publicado.
5. A área central mostra seções como cards, com os componentes de cada seção e ações existentes de criar, editar título, reordenar e remover. Campos exibem nome, tipo e estado selecionado; blocos operacionais são visualmente distintos. Drag-and-drop, botões alternativos de ordem, rótulo editável, exclusão/aviso de uso e restrições existentes continuam operando.
6. O formulário vazio apresenta orientação curta e botão `Adicionar seção` conectado ao handler existente. Em seção vazia, há orientação para incluir campo ou bloco. Nenhuma seção, campo ou bloco fictício é criado.
7. O catálogo de campos existentes e tipos de novos campos deixa de ocupar uma lista técnica permanente; passa a ser acessado por ação clara `Adicionar campo` junto ao contexto da seção. A busca, seleção de seção, reuso de campo, criação de campo e tipos atuais permanecem disponíveis. Blocos operacionais têm entrada visual separada e preservam disponibilidade, estado de uso e ação atuais.
8. O inspector mostra orientação quando nada está selecionado; ao selecionar campo ou bloco, mostra somente controles e regras já existentes para esse alvo. Nome, opções, visibilidade, obrigatoriedade, condições, mover de seção, exclusão segura e demais propriedades aplicáveis continuam acessíveis, com estado selecionado inequívoco.
9. A prévia usa o `FormularioEtapaRenderer` e os dados/estado reais já usados hoje. O controle Editar/Visualizar ou `Ver prévia` deixa claro qual modo está ativo; a prévia continua sinalizando alterações não salvas e respeitando formulário ativo/inativo.
10. Todas as funcionalidades atuais da aba, inclusive controles específicos das etapas Radar, edição das perguntas de follow-up, editor do card do Kanban, formulários, campos, blocos, publicação, confirmação de remoção e tratamento de erro, permanecem alcançáveis e executam os mesmos callbacks/actions.
11. Interações visuais têm hover, foco visível, seleção, feedback de publicação e drag-and-drop claros, com semântica e navegação por teclado preservadas. O layout é verificável em desktop e celular, inclusive dock, modais e conteúdo extenso.
12. Nenhum arquivo de backend, API, schema/migration ou componente global precisa ser alterado. Os testes focados de UI, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; diferenças na interface são verificadas visualmente quando houver ambiente local de renderização.

## Tasks / Subtasks

- [x] Mapear os estados, handlers e ações existentes nos três componentes de UI indicados abaixo; registrar como cada controle aparece após a mudança. (AC 1–10)
- [x] Compactar o topo local de `AdminPipelineClient` e mover apenas os controles do rascunho principal para dock fixo condicionado à diferença real; manter alertas de erro/conflito acessíveis. (AC 1–2)
- [x] Reorganizar `FormularioEtapaWorkspace` em contexto compacto, trilha de etapas, canvas de seções/componentes e inspector responsivo; preservar estados/hooks e callbacks. (AC 3–6, 8)
- [x] Apresentar o catálogo atual em painel/drawer/modal acionado por `Adicionar campo` e entrada separada para blocos, sem perder busca, tipos ou aplicação por seção. (AC 7)
- [x] Ajustar `ListaCamposFormulario` apenas para apresentação e seleção perceptível; preservar DnD, botões de ordem, rótulo e remoção. (AC 5, 11)
- [x] Clarificar prévia e publicação independente do formulário com os componentes existentes. (AC 3, 9–10)
- [x] Verificar todos os fluxos existentes com testes focados e revisão responsiva; executar gates obrigatórios. (AC 10–12)
- [x] Atualizar checklist, File List, notas de conclusão e repassar à QA. (AC 12)

## Dev Notes

- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` contém cabeçalho local, `alteracoesPendentes`, estados `erro`, `operacao`, `conflitoPublicacao`, handlers `descartarAlteracoes`/`publicarAlteracoes` e abas. Não confundir rascunho principal com `sujo` da composição.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` contém `secoes`, `ativo`, `sujo`, `salvando`, seleção persistida por etapa, `salvar()`, catálogo, controles de seção e inspector. Reusa `SalvarFormularioEtapaBpm`, `CriarCampoBpm`, `AtualizarCampoBpm`, `ExcluirCampoBpm` e `ObterUsoCamposBpm`; esses contratos não mudam.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario.tsx` contém DnD com `@dnd-kit`, teclado, anúncios acessíveis e callbacks de mover/rotular/remover/selecionar. `FormularioEtapaRenderer` já fornece prévia real; não duplicar.
- O estado vazio atual já existe, assim como select de etapa, busca de campos, diálogo de criação/exclusão, proteção de navegação com rascunho e mensagens `toast`. A mudança é de disposição e hierarquia.
- Story relacionada: `story-rm-2026-20feeb-workspace-configuracao-pipeline.md`, que criou o workspace atual. O arquivo `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no checkout; esta story usa o código atual e a story anterior como referência.
- [AUTO-DECISION] O dock representa exclusivamente o rascunho principal, pois os botões citados pelo usuário publicam esse estado; `Publicar composição` permanece no contexto do construtor.

## Testing

- Testes de UI relevantes em `tests/bpm/pipeline-editor-react.test.ts`, `tests/bpm/formulario-etapa.test.ts`, `tests/bpm/formulario-lista-plana.test.ts`, `tests/bpm/pipeline-config-workspace.test.ts` e `tests/bpm/pipeline-config-publicacao.test.ts`.
- Testar dock ausente sem edição, presente após mudança real, ausente após descarte/publicação, e independente do estado `sujo` do formulário; preservar erro/conflito.
- Testar seleção de etapa/seção, inclusão e reutilização de campos, tipos, blocos, propriedades, remoção, DnD/teclado, prévia e publicação com handlers existentes.
- Conferir foco e acesso por teclado, mobile e desktop. Rodar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend/UX; complexidade média/alta pela densidade do editor, sem mudança de domínio/backend.
- **Specialized Agent Assignment:** `@dev` implementa; `@ux-design-expert` revisa hierarquia, responsividade e acessibilidade; `@qa` valida regressões.
- **Quality Gates:** Pre-Commit `@dev` revê fluxo funcional e executa gates; Pre-PR `@github-devops` se houver PR; Pre-Deployment `@github-devops` se houver deploy.
- **Self-Healing Configuration (Story 6.3.3):** `@dev` light (até 2 iterações/15 min; CRITICAL corrige, HIGH documenta); `@qa` full (até 3 iterações/30 min; CRITICAL/HIGH corrige); `@github-devops` check/report only. MEDIUM vira débito documentado na QA; LOW é informativo.
- **Focus Areas:** preservação de callbacks/guards, acessibilidade por teclado, responsividade do dock/painéis, estados vazio/selecionado/erro/rascunho e ausência de alterações em APIs ou lógica.

## Checklist da story

- [x] Pedido do usuário traduzido em AC testáveis sem inventar regra de negócio.
- [x] Limite global vs. cabeçalho local explicitado.
- [x] Rascunho principal distinguido da composição do formulário.
- [x] Código, callbacks, preview e testes existentes identificados.
- [x] Implementação e teste de regressão concluídos.
- [x] QA validou os AC e comportamento preservado.

## File List

- `docs/stories/story-alpha-crm-ux-construtor-formularios.md` (story)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` (topo local compacto e dock do rascunho principal)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` (layout do construtor e catálogo lateral)
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario.tsx` (cartões de campo e bloco)
- `tests/bpm/pipeline-editor-react.test.ts` (interações do construtor)
- `tests/bpm/pipeline-config-workspace.test.ts` (dock condicionado ao rascunho)
- `tests/bpm/crm-configuracoes-centralizadas.test.ts` (hierarquia e cópias visuais)
- `tests/bpm/relacionamento-ui.test.ts` (reuso de campo pelo catálogo)

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Story inicial para reformulação visual do editor. | River (SM) |
| 2026-09-29 | 0.2 | Construtor visual, dock condicional, testes e gates concluídos. | Codex (Dev) |

## Dev Agent Record

### Agent Model Used

GPT-6 (Codex).

### Debug Log References

- `npx vitest run tests/bpm/pipeline-editor-react.test.ts tests/bpm/formulario-lista-plana.test.ts tests/bpm/pipeline-config-workspace.test.ts`: 34 testes passaram.
- `npx vitest run tests/bpm/crm-configuracoes-centralizadas.test.ts tests/bpm/relacionamento-ui.test.ts tests/bpm/pipeline-editor-react.test.ts`: 31 testes passaram.
- `npm run lint`: 0 erros; 1191 avisos preexistentes.
- `npm run typecheck`: passou após o build.
- `npm test`: 553 arquivos, 4064 testes passaram, 4 ignorados e 1 todo. A primeira execução no sandbox teve bloqueio `EPERM` em quatro testes CLI; a execução autorizada fora do sandbox passou.
- `npm run build`: passou.
- `git diff --check`: passou.

### Completion Notes List

- Cabeçalho local compactado; header, sidebar e abas globais não foram alterados.
- Dock fixo exibe as mesmas ações de publicação/descarte apenas quando `alteracoesPendentes > 0`; mensagens de erro e conflito continuam no fluxo da página.
- Construtor usa as mesmas seções, campos, blocos, handlers de reordenação, inspector e `FormularioEtapaRenderer` da prévia existente.
- Catálogo passou para drawer com os mesmos tipos, busca, reuso e inclusão; nenhum contrato de dados, API ou regra de domínio mudou.
- Revisão visual baseada no código e na imagem de referência; não houve captura em navegador nesta execução.

### File List

Corresponde ao File List acima.

## QA Results

### Revisão: 2026-09-29 — Quinn (QA)

**Veredito: APPROVED.** Revisei o diff dos três componentes de UI e dos testes desta story. Os 12 critérios de aceitação estão atendidos no código: topo local compacto, dock condicionado a `alteracoesPendentes`, construtor responsivo em três áreas, catálogo em drawer, inspector contextual, prévia existente e callbacks de edição/publicação preservados. Header, sidebar, rotas, APIs e backend não foram alterados neste escopo.

**Rastreabilidade:** AC 1–2: `AdminPipelineClient` e `pipeline-config-workspace.test.ts`; AC 3–10: `FormularioEtapaWorkspace`, `ListaCamposFormulario` e `pipeline-editor-react.test.ts`; AC 11: semântica, estados de foco, DnD por teclado e layout responsivo inspecionados no código; AC 12: gates gerais e testes focados abaixo. Os controles de seção/campo/bloco, busca, reuso, exclusão, rótulo, ordenação, prévia e publicação continuam ligados aos handlers anteriores.

**Evidência:** 5 arquivos de teste focados passaram (53 testes). Gates informados pelo Dev: lint com 0 erros, typecheck, suíte completa (553 arquivos, 4.064 testes aprovados, 4 ignorados, 1 todo), build e `git diff --check` aprovados. CodeRabbit CLI indisponível no ambiente; revisão manual substituiu essa etapa.

**Risco residual:** não houve captura ou interação em navegador real nesta execução. A avaliação de celular/desktop foi estática, com breakpoints e limites de largura revisados; recomenda-se inspeção visual após publicar. Nenhum problema bloqueante foi encontrado. Nenhum código foi alterado pela QA.
