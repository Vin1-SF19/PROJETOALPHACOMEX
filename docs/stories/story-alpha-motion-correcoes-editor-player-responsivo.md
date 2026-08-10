# Story: Correções de texto, animações, responsividade e sidebar do Alpha Motion

## Status

Ready for Review

## Story

**Como** usuário do Alpha Motion,  
**quero** editar corretamente textos importados, visualizar no resultado as animações escolhidas, abrir o HTML em qualquer tela e acessar slides/componentes sem rolagem excessiva,  
**para** que o fluxo de criação e apresentação seja consistente do editor até a exportação.

## Acceptance Criteria

1. Editar o texto completo de um componente PPTX com `richText` atualiza imediatamente o conteúdo visível, preservando estilos dos trechos não alterados.
2. Textos importados mantêm negrito por run e o painel permite aplicar/remover negrito, itálico e sublinhado no texto completo ou em trechos importados.
3. Animações configuradas em `Slide.animacaoConfig.timeline` são executadas com o tipo escolhido no editor, modo apresentação e HTML exportado, mantendo compatibilidade com animações legadas.
4. O player exportado ocupa todo o viewport sem margens ou scrollbars e recalcula escala ao redimensionar, rotacionar ou entrar em tela cheia.
5. A lista de slides vira uma gaveta recolhível com rolagem própria e altura limitada, sem empurrar a biblioteca de componentes para fora da tela.
6. Todas as categorias da biblioteca de componentes iniciam fechadas, inclusive “Básicos”.
7. Nenhuma migration, alteração de permissão ou nova dependência é introduzida.

## Blueprint de Integração

### Criar

- [ ] Helper puro para sincronizar texto plano e runs ricos.
- [ ] Wrapper compartilhado de execução de `ElementAnimation`.
- [ ] Testes de regressão do editor rico e das variants novas.

### Editar — integration points obrigatórios

- [ ] `TextoProps.tsx` — edição sincronizada e controles de formatação.
- [ ] `ComponenteNoCanvas.tsx` — preview das animações do modelo novo.
- [ ] `SlideApresentacaoLayer.tsx` e página de apresentação — propagar timeline no player interno.
- [ ] `PlayerStandalone.tsx` e CSS/HTML exportado — animações e viewport responsivo.
- [ ] `SidebarSlides.tsx`, `SidebarComponentes.tsx` e layout do editor — gavetas/rolagens independentes.
- [ ] Bundle offline do player — reconstruir após as mudanças.

### Consultar — precedentes

- `variantsNovoModelo.ts` — tradução existente de tipos para Framer Motion.
- `resolver.ts` — fonte única de animações por elemento.
- `viewport.ts` — escala uniforme do slide.
- `RenderComponente.tsx` — render compartilhado e compatibilidade legada.

## Tasks / Subtasks

- [x] Corrigir edição e formatação de rich text importado.
- [x] Executar animações da timeline nos três contextos de render.
- [x] Garantir viewport integral e responsivo no HTML exportado.
- [x] Implementar gaveta de slides e categorias fechadas por padrão.
- [x] Adicionar regressões e executar quality gates.

## Testing

- Testes unitários do sincronizador de rich text e variants do novo modelo.
- Testes Alpha Motion/PPTX existentes.
- Build do player offline, lint direcionado, typecheck, testes e build conforme disponibilidade do baseline.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-10 | 1.0 | Story criada após reconhecimento dos quatro bugs relatados. | Dex |
| 2026-08-10 | 2.0 | Correções implementadas no editor, timeline, players, exportação HTML e sidebar; regressões adicionadas. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run build:player` — aprovado; bundle offline regenerado.
- `npx next build` — aprovado após a alteração final do resolver.
- Testes direcionados Alpha Motion — 54/54 aprovados; rodada final do resolver/rich text/variants — 11/11 aprovados, incluindo regressão Unicode.
- ESLint direcionado aos arquivos da story — aprovado sem avisos.
- `npm test` — 960/961 testes aprovados; única falha preexistente por timeout em `tests/google-calendar/cli.test.ts`.
- `npx tsc --noEmit` — bloqueado somente por erros preexistentes em tipos gerados, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- `npm run lint` — bloqueado pelo baseline global em `.agents`, `.aiox-core` e worktrees; escopo alterado aprovado no lint direcionado.
- `npm run build` — bloqueado no `prisma generate` por `EPERM` no DLL do engine em uso pelo servidor local; o build direto do Next foi aprovado.
- Validação visual autenticada ficou pendente: o navegador local redirecionou para login e não havia credenciais disponíveis.
- CodeRabbit não executado porque WSL não está instalado no ambiente.

### Completion Notes List

- A edição de texto importado agora sincroniza texto plano e rich text sem descartar runs preserváveis; o painel permite formatação global e por trecho.
- A timeline `ElementAnimation` passou a ser a fronteira compartilhada entre canvas, apresentação interna e player offline, com delays efetivos entre elementos e fallback legado.
- O HTML exportado ocupa o viewport integral e mantém a escala do palco responsiva a resize, rotação e fullscreen.
- A lista de slides virou gaveta recolhível com rolagem própria; a biblioteca de componentes usa o espaço restante e todas as categorias começam fechadas.
- Não houve migration, alteração de permissão, nova dependência ou mutação de banco.
- Auto-crítica registrada em `plan/self-critique-alpha-motion-bugfixes.json` com resultado `PASSED`.

### File List

- `docs/stories/story-alpha-motion-correcoes-editor-player-responsivo.md`
- `plan/self-critique-alpha-motion-bugfixes.json`
- `src/app/PainelAlpha/Apresentacoes/[id]/apresentar/page.tsx`
- `src/app/api/apresentacoes/[id]/exportar-html/route.ts`
- `src/apresentacoes-player/PlayerStandalone.tsx`
- `src/apresentacoes-player/player.css`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/TextoProps.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/AnimacaoElementoWrapper.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarComponentes.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`
- `src/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer.tsx`
- `src/lib/apresentacoes/animacao/resolver.ts`
- `src/lib/apresentacoes/animacao/variantsNovoModelo.ts`
- `src/lib/apresentacoes/rich-text-edit.ts`
- `tests/apresentacoes/animacao-resolver.test.ts`
- `tests/apresentacoes/animacao-variants-runtime.test.ts`
- `tests/apresentacoes/rich-text-edit.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/session-draft.md`

## QA Results

- Pendente.
