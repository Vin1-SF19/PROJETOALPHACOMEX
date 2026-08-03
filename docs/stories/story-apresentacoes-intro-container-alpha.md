# Story: Container Alpha como introdução de apresentação

## Status

Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `vitest`, `eslint`, `next build`, `CodeRabbit`

## Story

**Como** usuário do Alpha Presentation Studio,
**quero** usar o Container Alpha como uma abertura cinematográfica centralizada,
**para que** a apresentação avance visualmente para o próximo slide através do interior do container, com marca e som opcionais.

## Acceptance Criteria

1. O painel de propriedades do Container Alpha oferece um botão de centralização automática que posiciona o componente exatamente no centro do palco canônico de 1280×720, preservando suas dimensões.
2. A marca Alpha fica visualmente centralizada na junção das duas portas quando o container está fechado.
3. No modo apresentação, após a abertura das travas e portas, a câmera aproxima-se do interior do container quando a transição para o próximo slide estiver habilitada.
4. O próximo slide é montado e inicia suas animações no começo do zoom; sua prévia aparece recortada na abertura do container e expande até ocupar todo o palco, sem reiniciar ao final da transição.
5. O editor permite habilitar/desabilitar som, escolher entre dois sons de exemplo e ajustar volume; também oferece prévia auditiva acessível.
6. A transição funciona de forma responsiva, respeita `prefers-reduced-motion` e não cria avanço duplicado por clique/teclado durante a sequência.
7. Se não existir próximo slide, o container abre normalmente e não tenta executar a transição/zoom.
8. As novas configurações são validadas pelo schema Zod, persistidas no JSON do slide e possuem defaults retrocompatíveis.
9. Já no editor, o interior aberto do container mostra a prévia real do próximo slide; quando ele não existe, mostra “Adicione um slide para ver a prévia”.
10. No modo apresentação, o Container Alpha ignora a caixa livre do editor e ocupa todo o palco 1280×720, centralizado e sem recorte, mantendo o zoom alinhado à abertura real.
11. O editor abre a reprodução em modal responsivo, salva o slide ativo antes de iniciar e oferece controles acessíveis para reiniciar, retroceder, pausar/reproduzir, avançar e fechar; a pausa preserva o progresso da abertura do container.
12. Na reprodução, o Container Alpha é promovido para uma camada de capa que cobre todo o palco, mesmo quando estiver aninhado em card, grid ou container com recorte/posicionamento próprio.
13. A composição 3D da capa ocupa aproximadamente 90% da largura e 94% da altura do palco, e o player oferece uma barra deslizante para saltar diretamente ao slide escolhido.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Frontend
- **Secondary Type:** Integration
- **Complexity:** High — coordena React Three Fiber, Framer Motion, Web Audio e ciclo de navegação entre slides.

### Specialized Agent Assignment

- **Primary Agents:** `@dev`, `@ux-expert`
- **Supporting Agents:** `@qa`

### Quality Gate Tasks

- [x] Pre-Commit: revisão manual concluída; CLI indisponível por ausência de WSL.
- [ ] Pre-PR: validar integração e retrocompatibilidade.

### Self-Healing Configuration

- Primary Agent: `@dev` — light mode
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

### CodeRabbit Focus Areas

- Acessibilidade dos controles e preferência por movimento reduzido.
- Preservação da identidade do próximo slide durante a transição.
- Limpeza de timers, animações R3F e nós Web Audio.
- Responsividade do recorte entre coordenadas canônicas e viewport escalado.

## Tasks / Subtasks

- [x] Expandir o contrato do componente e seus defaults (AC: 5, 8).
- [x] Adicionar centralização automática e controles de transição/áudio no painel (AC: 1, 5).
- [x] Centralizar a logo e estender o rig da câmera para o zoom de entrada (AC: 2, 3, 7).
- [x] Integrar o evento do container ao modo apresentação e revelar o próximo slide preservando a montagem (AC: 3, 4, 6, 7).
- [x] Implementar dois presets sonoros sem dependência externa e com fallback de autoplay (AC: 5).
- [x] Cobrir schema, geometria, defaults e transição com testes; executar gates do projeto (AC: 1-9).
- [x] Carregar e manter sincronizados os componentes dos slides para renderizar a prévia no editor, com estado vazio explícito (AC: 9).
- [x] Tratar o Container Alpha como capa de palco inteiro no apresentador e alinhar o recorte do zoom à caixa renderizada (AC: 10).
- [x] Integrar um player modal ao editor com controles de navegação e pausa real da sequência 3D (AC: 11).
- [x] Promover o Container Alpha para uma camada de capa via portal, escapando de ancestrais com dimensões ou `overflow` (AC: 12).
- [x] Aplicar escala widescreen ao modelo 3D somente na reprodução e adicionar navegação direta por slider (AC: 13).
- [x] Atualizar a memória do codebase, checklist e File List.

## Dev Notes

- `RenderComponente.tsx` é a fonte única usada pelo editor e pela apresentação; eventos de apresentação devem ser opcionais para manter o editor desacoplado. [Source: `.bibble/memory/components.md`, Alpha Presentation Studio]
- O palco usa coordenadas canônicas 1280×720 e escala uniforme na apresentação. [Source: `src/lib/apresentacoes/viewport.ts`]
- O componente existente já controla portas e travas por um objeto mutável consumido em `useFrame`; o zoom deve estender esse mesmo fluxo. [Source: `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaModel.tsx`]
- A navegação por slide pertence ao `ModoApresentacaoClient`; o container apenas deve emitir o início da introdução. [Source: `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`]
- Não há alteração de banco, API, permissão, menu ou rota nesta story.

### Testing

- Estender `tests/apresentacoes/container-alpha.test.ts` para defaults, limites do schema, centralização e máscara inicial.
- Executar ESLint focado, Vitest focado, `npm run lint`, `npm run typecheck`, `npm test` e build.
- Validar que a camada do próximo slide mantém a mesma `key` durante a promoção de prévia para slide ativo.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-03 | 1.0 | Story criada a partir da solicitação do usuário. | River |
| 2026-08-03 | 1.1 | Implementação, testes e revisão manual concluídos. | Nova |
| 2026-08-03 | 1.2 | Corrigido o interior branco: próximo slide renderizado atrás das portas com abertura projetada pela câmera. | Nova |
| 2026-08-03 | 1.3 | Prévia do próximo slide integrada ao editor e mensagem adicionada quando não há slide seguinte. | Nova |
| 2026-08-03 | 1.4 | Container tratado como capa centralizada de tela inteira no modo apresentação, sem cortes. | Nova |
| 2026-08-03 | 1.5 | Reprodução movida para modal responsivo com controles e pausa preservando a animação do container. | Nova |
| 2026-08-03 | 1.6 | Container promovido para camada de capa real no player, inclusive quando aninhado. | Nova |
| 2026-08-03 | 1.7 | Modelo 3D ampliado para composição widescreen e player recebeu barra de navegação direta. | Nova |

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- `npx vitest run tests/apresentacoes/container-alpha.test.ts` — 17/17 aprovados após o enquadramento de capa no apresentador.
- `npx vitest run tests/google-calendar/cli.test.ts tests/apresentacoes/container-alpha.test.ts --coverage=false` — 16/16 aprovados.
- ESLint focado nos arquivos da story — aprovado sem warnings.
- `npx next build` — aprovado; 68 páginas geradas.
- `npm run typecheck` — mantém cinco erros preexistentes fora do escopo (`ExclusaoFiscal`, `ModalPerfilColaborador`, `HabilitacaoRadarClient`, `sync-queue.test.ts`).
- `npm test` — 607/608 aprovados; único timeout em `google-calendar/cli.test.ts`, aprovado isoladamente.
- `npm run lint` — falha na varredura global de `.agents/`, `.aiox-core/` e `.claude/worktrees/`; lint focado aprovado.
- `npm run build` — Prisma bloqueado por `EPERM` no rename da DLL; `npx next build` aprovado.
- CodeRabbit CLI — WSL não instalado; fallback manual registrado em `docs/qa/coderabbit-reports/story-apresentacoes-intro-container-alpha.md`.

### Completion Notes List

- Botão de centralização calcula `(1280 - w) / 2` e `(720 - h) / 2`.
- Logo reposicionada para o centro vertical e horizontal da junção das portas.
- A câmera executa zoom após a abertura e só atualiza depois do primeiro enquadramento válido.
- O próximo slide é montado no início do zoom, revelado dentro do container e preservado pela chave ao tornar-se ativo.
- O plano branco do WebGL é removido quando existe próximo slide; uma cópia responsiva do próximo slide é renderizada atrás das portas, alinhada pela projeção 3D real da abertura.
- O editor recebe os componentes de todos os slides, resolve o próximo pela ordem atual e mostra a prévia imediatamente; sem slide seguinte, o portal exibe “Adicione um slide para ver a prévia”.
- Novos Containers Alpha entram abertos no editor para tornar o interior editável/inspecionável, sem alterar a abertura fechada no modo apresentação.
- Na apresentação, o Container Alpha ocupa 1280×720 independentemente do tamanho/posição editados; a posição livre continua preservada no editor e no JSON.
- O botão Apresentar salva o slide ativo e abre um modal isolado; o player contém o palco sem recortes e oferece reinício, anterior, pausa/reprodução, próximo e fechar.
- O Container Alpha usa portal para uma camada 100% do palco durante a reprodução, impedindo que wrappers, grupos ou `overflow` mantenham o modelo pequeno ou deslocado.
- A escala horizontal de capa é 2,3× e o enquadramento usa 94% do palco; o slider do player permite escolher diretamente qualquer slide.
- Foram adicionados presets procedurais Industrial metálico e Hidráulico suave, com volume e prévia no editor.
- Não houve alteração de banco, rota, API, permissão ou dependência.
- Validação visual autenticada no navegador continua recomendada antes do uso em uma apresentação real.

### File List

**Criados**

- `src/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer.tsx`
- `src/lib/apresentacoes/container-intro.ts`
- `src/lib/apresentacoes/container-carga-audio.ts`
- `src/lib/apresentacoes/proximo-slide.ts`
- `src/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview.tsx`
- `src/components/Apresentacoes/Editor/ModalReproducaoApresentacao.tsx`
- `docs/qa/coderabbit-reports/story-apresentacoes-intro-container-alpha.md`
- `docs/stories/story-apresentacoes-intro-container-alpha.md`

**Modificados**

- `src/lib/validations/slide-componentes-3d.ts`
- `src/components/Apresentacoes/Editor/registry/registry-3d.ts`
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx`
- `src/components/Apresentacoes/Editor/store/useEditorStore.ts`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/BarraSuperior/BarraSuperiorEditor.tsx`
- `src/app/PainelAlpha/Apresentacoes/[id]/apresentar/page.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaModel.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaCameraRig.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/ContainerCargaProps.tsx`
- `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`
- `src/components/Apresentacoes/ModoApresentacao/TransicaoSlide.tsx`
- `tests/apresentacoes/container-alpha.test.ts`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/codebase-map.md`

## QA Results

- **PASS focado:** 17 testes, ESLint e build Next aprovados.
- **Baselines globais:** typecheck, lint global, Prisma generate e um timeout intermitente externo permanecem documentados acima.
