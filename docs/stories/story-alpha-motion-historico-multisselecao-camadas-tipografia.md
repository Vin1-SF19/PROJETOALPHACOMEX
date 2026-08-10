# Story: Histórico, multisseleção, camadas e tipografia no Alpha Motion

## Status

Ready for Review

## Story

**Como** usuário do Alpha Motion,  
**quero** editar slides e elementos com histórico, seleção múltipla, controle de camadas e texto rico confiável,  
**para** produzir apresentações com precisão e recuperar mudanças sem retrabalho.

## Acceptance Criteria

1. `Ctrl+Z`/`Cmd+Z` desfaz a última mudança do slide ativo e `Ctrl+Y`, `Cmd+Shift+Z` ou `Ctrl+Shift+Z` refaz a mudança, sem interceptar o histórico nativo de inputs e editores de texto.
2. A barra superior possui botões Desfazer e Refazer com estado desabilitado coerente com as pilhas de histórico.
3. O histórico é isolado por carregamento de slide, marca o slide como alterado após desfazer/refazer e não cria centenas de passos durante um único gesto de mover, redimensionar ou rotacionar.
4. Os slides podem ser reordenados manualmente por drag-and-drop, com alça explícita, suporte de teclado e rollback visual se a persistência falhar.
5. A timeline de elementos permite reordenar as camadas por drag-and-drop; a ordem visual e os `zIndex` persistidos correspondem à ordem apresentada.
6. Cada elemento da timeline possui botão de exclusão direta, removendo também animações ligadas ao elemento.
7. Segurar Ctrl/Cmd ao clicar alterna elementos na multisseleção; clicar num item já pertencente ao grupo permite mover todos juntos preservando suas posições relativas.
8. O painel informa quantos elementos estão selecionados e excluir/centralizar opera sobre toda a seleção.
9. Todo elemento de nível superior possui alça visual de rotação e campo numérico de rotação; a operação é persistida e pode ser desfeita/refeita.
10. Todo tipo de componente possui botão para centralizar no slide; em seleção múltipla, o conjunto é centralizado preservando distâncias relativas.
11. Texto mantém as mesmas cores no editor, modo apresentação, link público e HTML exportado; alterações globais de cor/fonte/tamanho sincronizam os runs ricos em vez de serem sobrescritas por estilos importados antigos.
12. O painel de texto oferece catálogo claro de fontes, tamanho, cor, negrito, itálico, sublinhado, alinhamento horizontal/vertical, espaçamento de linha e letras.
13. O usuário pode selecionar um intervalo no campo de texto e aplicar cor, fonte, tamanho ou estilos somente àquele trecho; sem intervalo, a alteração é aplicada ao texto inteiro.
14. As fontes oferecidas são carregadas tanto no painel quanto no player compartilhado usado em apresentação, link público e exportação HTML.
15. Não é introduzida tabela, coluna, migration ou mutação em massa de banco.

## Blueprint de Integração

### Criar

- [ ] Atalhos globais do editor.
- [ ] Catálogo tipográfico do Alpha Motion.
- [ ] Testes de histórico, multisseleção, camadas e formatação por intervalo.

### Editar — integration points obrigatórios

- [ ] `useEditorStore.ts` — histórico, seleção múltipla e ações em lote.
- [ ] `ApresentacaoEditor.tsx` e `BarraSuperiorEditor.tsx` — atalhos e controles de histórico.
- [ ] `ComponenteNoCanvas.tsx` e `useCanvasDragResize.ts` — seleção, movimento, resize e rotação transacionais.
- [ ] `CanvasArea.tsx` e `PainelPropriedades.tsx` — limpeza da seleção e operações universais.
- [ ] `TimelineReal.tsx` — reordenação de camadas e exclusão.
- [ ] `SidebarSlides.tsx` — drag acessível e rollback.
- [ ] `TextoProps.tsx`, `rich-text-edit.ts` e `RenderBasicos.tsx` — edição por trecho e render estável.
- [ ] `globals.css` e `player.css` — fontes disponíveis nos dois runtimes.

### Consultar — precedentes

- `SidebarSlides.tsx` e `TabBar.tsx` — sortable com `@dnd-kit`.
- `NotesGlobalTaskbar.tsx` — ordenação persistente com rollback.
- `rich-text-edit.test.ts` — preservação de runs importados.
- `PlayerStandalone.tsx` — player compartilhado por apresentação, link e HTML.

## Tasks / Subtasks

- [x] Implementar histórico Undo/Redo e atalhos.
- [x] Implementar multisseleção e transformações em grupo.
- [x] Implementar rotação e centralização universal.
- [x] Implementar controle de camadas/exclusão e endurecer reordenação de slides.
- [x] Corrigir render de texto e implementar tipografia por trecho.
- [x] Adicionar testes e executar quality gates.
- [x] Atualizar checklist, file list e mapas técnicos.
- [x] Corrigir carregamento das fontes com WOFF2 local e incorporação no HTML exportado.
- [x] Corrigir resolução da folha de fontes pelo Turbopack no `globals.css`.

## Testing

- Vitest para histórico, seleção, camadas e aplicação de estilo por intervalo.
- Suíte `tests/apresentacoes` completa.
- ESLint direcionado, typecheck, testes e build do projeto.
- Teste manual no navegador autenticado quando houver sessão disponível.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-10 | 1.0 | Story criada após reconhecimento do store, canvas, timelines e renderer compartilhado. | Dex |
| 2026-08-10 | 2.0 | Undo/Redo, multisseleção, rotação, centralização, camadas, reordenação acessível de slides e tipografia rica implementados e validados. | Dex |
| 2026-08-10 | 2.1 | Fontes remotas substituídas por 32 arquivos WOFF2 locais e incorporação base64 no HTML exportado. | Dex |
| 2026-08-10 | 2.2 | Folha gerada movida para `src/app`, imports corrigidos e grafo do `next dev` reiniciado para eliminar o erro de resolução do Turbopack. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/apresentacoes`: 23 arquivos e 268/268 testes aprovados.
- ESLint direcionado aos 18 arquivos TypeScript/TSX alterados: aprovado sem erros ou avisos.
- `git diff --check` no escopo da entrega: aprovado; somente avisos de conversão LF/CRLF do Git no Windows.
- `npx tsc --noEmit`: nenhuma falha nova; permanecem erros preexistentes em `.next/*/validator.ts`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- `npm test`: 978/979 testes aprovados; única falha preexistente por timeout em `tests/google-calendar/cli.test.ts`.
- `npm run lint`: gate global bloqueado por milhares de erros preexistentes em `.agents`, `.aiox-core` e `.claude/worktrees`; lint do escopo aprovado.
- `npm run build`: bloqueado no `prisma generate` por `EPERM` no DLL do engine mantido por processo local; `npx next build` aprovado com 70 páginas.
- `npm run build:player`: aprovado; bundle compartilhado do player regenerado.
- Browser autenticado: bloqueado pela tela de login sem credenciais disponíveis nesta tarefa.
- CodeRabbit: indisponível porque o WSL não está instalado no ambiente Windows.
- Correção de fontes: `npm run fonts:alpha-motion` baixou 32 WOFF2 latinos (1,3 MB); `npm run build:player` aprovou e gerou CSS de 1,8 MB com fontes incorporadas.
- Correção de fontes: `npx vitest run tests/apresentacoes` aprovou 24 arquivos e 285/285 testes; ESLint direcionado aprovado.
- Correção de fontes: `npx next build` aprovado com 70 páginas; o servidor local respondeu `font/woff2` com HTTP 200 e 48.256 bytes para Inter.
- Correção de fontes: o bundle foi verificado com `data:font/woff2;base64`, sem `fonts.googleapis.com` e sem caminhos `/fonts/alpha-motion/` residuais.
- Correção Turbopack: `npx next build` compilou com sucesso em 47s e gerou 70 páginas usando Next 16.1.6.
- Correção Turbopack: `next dev` reiniciado somente para os processos do workspace; `/PainelAlpha/Apresentacoes` respondeu HTTP 200, sem erro de resolução CSS.
- Correção Turbopack: 17/17 testes de fontes, ESLint direcionado e `git diff --check` aprovados.

### Completion Notes List

- Histórico de até 100 snapshots, isolado por slide e agregado por gesto de mover, redimensionar ou rotacionar.
- Multisseleção com Ctrl/Cmd, movimento conjunto, exclusão em lote e centralização preservando posições relativas.
- Timeline ordenável com alça de camada e exclusão direta; remoção limpa animações e grupos órfãos.
- Gaveta de slides ordenável por ponteiro ou teclado, com rollback se a persistência falhar.
- Texto rico editável por intervalo, catálogo de 15 fontes e defaults explícitos compartilhados entre editor e player.
- As 15 famílias deixaram de depender da rede: são servidas localmente pelo painel e incorporadas no HTML exportado para funcionar offline.
- A folha gerada passou a ficar ao lado de `globals.css`; o servidor de desenvolvimento precisa ser reiniciado quando esse arquivo é criado pela primeira vez, pois o Turbopack pode manter o grafo anterior em memória.
- Nenhuma migration, dependência ou alteração estrutural de banco foi necessária.
- Validação visual autenticada deve ser repetida por um usuário com sessão válida antes da aprovação final de QA.
- DoD: requisitos funcionais, estrutura, segurança, testes direcionados, documentação e build Next aplicáveis estão concluídos; os gates globais `npm run lint`, `npm test` e `npm run build` permanecem marcados como bloqueados exclusivamente pelas falhas preexistentes descritas no Debug Log.
- DoD: revisão manual autenticada permanece não concluída por ausência de credenciais; nenhum aceite visual foi presumido.

### File List

- `docs/stories/story-alpha-motion-historico-multisselecao-camadas-tipografia.md`
- `plan/self-critique-alpha-motion-historico-multisselecao-tipografia.json`
- `plan/self-critique-alpha-motion-fontes-locais.json`
- `plan/self-critique-alpha-motion-turbopack-font-css.json`
- `package.json`
- `scripts/download-alpha-motion-fonts.mjs`
- `scripts/build-apresentacoes-player.mjs`
- `public/fonts/alpha-motion/*.woff2` (32 arquivos)
- `src/app/alpha-motion-fonts.css`
- `src/app/globals.css`
- `src/apresentacoes-player/player.css`
- `src/generated/apresentacoes-player-bundle.ts`
- `src/components/Apresentacoes/Editor/EditorKeyboardShortcuts.tsx`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/Canvas/useCanvasDragResize.ts`
- `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/TextoProps.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/render/RenderBasicos.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`
- `src/components/Apresentacoes/Editor/Timeline/TimelineReal.tsx`
- `src/components/Apresentacoes/Editor/Timeline/useTimelineDrag.ts`
- `src/components/Apresentacoes/Editor/Timeline/useTimelineDragV2.ts`
- `src/components/Apresentacoes/Editor/registry/registry-basicos.ts`
- `src/components/Apresentacoes/Editor/store/useEditorStore.ts`
- `src/lib/apresentacoes/fontes.ts`
- `src/lib/apresentacoes/rich-text-edit.ts`
- `tests/apresentacoes/editor-history-selection.test.ts`
- `tests/apresentacoes/fontes-locais.test.ts`
- `tests/apresentacoes/rich-text-edit.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/session-draft.md`
- `.bibble/memory/known-errors.md`

## QA Results

- Pendente.
