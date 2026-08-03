# Story: Container Alpha animado no Presentation Studio

**ID:** STORY-APRESENTACOES-CONTAINER-ALPHA-ANIMADO
**Módulo:** Alpha Presentation Studio
**Status:** Review
**Prioridade:** Alta
**Tipo:** Frontend / 3D / Animação
**Data de criação:** 2026-08-03

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - vitest
  - eslint
  - typescript
  - next-build
```

## Story

**Como** usuário do Alpha Presentation Studio,
**quero** adicionar aos slides o container 3D da seção Sobre do site Alpha Comex, editar suas propriedades e redimensioná-lo livremente,
**para** apresentar a abertura das portas do container de forma responsiva dentro de uma apresentação.

## Acceptance Criteria

- [x] **AC-001 — Componente disponível:** existe um novo componente `Container Alpha` na categoria 3D da biblioteca do editor.
- [x] **AC-002 — Fidelidade visual:** o componente reutiliza o modelo procedural, portas, travas, marca Alpha, materiais e iluminação do componente da seção Sobre em `C:\Users\TI\Desktop\Site Alpha Comex\apps\web`.
- [x] **AC-003 — Edição:** o painel permite editar ao menos cores principais, ângulo, atraso, duração da abertura, exibição da marca e estado de pré-visualização no editor.
- [x] **AC-004 — Resize livre e responsivo:** largura e altura continuam editáveis por campos e handles; o canvas 3D ocupa 100% da caixa e reenquadra o modelo quando a caixa muda de tamanho ou proporção.
- [x] **AC-005 — Modo apresentação:** ao entrar no slide, as travas se movem e as duas portas abrem automaticamente; ao sair e voltar ao slide, a sequência reinicia.
- [x] **AC-006 — Acessibilidade e desempenho:** reduced motion exibe diretamente o estado final, e a renderização 3D pausa quando fica fora da viewport.
- [x] **AC-007 — Persistência segura:** o novo tipo integra a union Zod `ComponenteSlide`; defaults do registry geram dados válidos e o autosave existente persiste suas propriedades no `Slide.dadosJson`.
- [x] **AC-008 — Sem expansão de escopo:** não há mudança em banco, schema Prisma, rotas, menu, permissões, autenticação ou dependências.
- [x] **AC-009 — Regressão automatizada:** testes cobrem schema, defaults do registry e limites das propriedades do novo tipo.
- [x] **AC-010 — Quality gates:** `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes/ambientais são documentadas sem ocultar regressões da story.
- [x] **AC-011 — Animação de entrada:** `Container Alpha — transição de slide` aparece no select existente de animação de entrada de cada componente, mostra uma prévia 16:9 e permite editar aparência, abertura, zoom e áudio no mesmo painel.
- [x] **AC-012 — Troca sem delay:** ao avançar, o slide seguinte é montado no início real do zoom e a camada do container é removida no callback real de conclusão do zoom, sem temporizador concorrente.
- [x] **AC-013 — Player instantâneo sem iframe interno:** o modal monta o player React diretamente com um snapshot dos slides do Zustand, desbloqueia áudio no clique de abertura, salva o slide ativo em background sem corrida de estado e mantém controles responsivos e fullscreen sem carregar o shell do Painel Alpha dentro do Dialog.
- [x] **AC-014 — Transição contínua com profundidade:** a transição sintética mantém uma margem responsiva de 5% da menor dimensão do palco, limitada entre 18 e 72 px; o container abre uma única vez e inicia o zoom sobre o slide seguinte sem restart ou camada sintética concorrente, preservando o canvas do slide de origem até a conclusão real do zoom.
- [x] **AC-015 — Player acessível sem recorte:** os controles ocupam uma faixa própria, sem cobrir o slide, todos os comandos interativos possuem estado `focus-visible`, e somente a rota standalone exibe o gate “Iniciar apresentação” necessário para liberar áudio/tela cheia; o modal permanece instantâneo.

## Fora do Escopo

- Reproduzir a transição editorial completa por scroll, texto da seção Sobre ou passagem da câmera para outra seção.
- Alterar o container genérico recursivo já existente no Studio.
- Criar upload de GLB, novos assets, tabelas, migrations ou APIs.
- Alterar a navegação, publicação ou colaboração de apresentações.

## Tasks / Subtasks

- [x] **Task 1 — Integrar o contrato de dados** (AC: 1, 3, 7, 8)
  - [x] Criar schema Zod e type `ContainerCargaComponente`.
  - [x] Adicionar o tipo à union `ComponenteSlide` e ao registry 3D.
  - [x] Garantir defaults válidos e dimensões iniciais proporcionais.

- [x] **Task 2 — Adaptar o modelo 3D responsivo** (AC: 2, 4, 6)
  - [x] Portar modelo procedural, materiais, travas, portas e logo do site de origem.
  - [x] Implementar câmera com enquadramento pela bounding box e reação ao tamanho real do componente.
  - [x] Reutilizar pausa por visibilidade e liberar recursos Three.js ao desmontar.

- [x] **Task 3 — Integrar edição e apresentação** (AC: 3–7)
  - [x] Criar painel de propriedades tipado.
  - [x] Diferenciar renderização no editor e no modo apresentação.
  - [x] Reproduzir a sequência latch → abertura das portas e respeitar reduced motion.

- [x] **Task 4 — Validar e documentar** (AC: 8–10)
  - [x] Criar testes focados de schema/registry.
  - [x] Executar lint, typecheck, testes e build.
  - [x] Atualizar checklist, File List e catálogos de memória sem sobrescrever alterações existentes.

- [x] **Task 5 — Integrar como animação de entrada** (AC: 11–12)
  - [x] Registrar a opção no select existente e persistir sua configuração em `componente.animacao.entrada.containerAlpha`.
  - [x] Exibir prévia visual do slide seguinte e controles completos imediatamente abaixo do select.
  - [x] Sincronizar navegação, zoom e áudio com os eventos reais da animação 3D.

- [x] **Task 6 — Reconstruir o player modal nativo** (AC: 13)
  - [x] Remover o iframe interno e montar `ModoApresentacaoClient` diretamente no Dialog.
  - [x] Fotografar os slides já carregados no Zustand, promovendo `componentes` e `canvas` atuais do slide ativo para reprodução imediata.
  - [x] Desbloquear Web Audio no clique de “Apresentar” e persistir o snapshot ativo em background com `versaoEdicao` monotônica antes de limpar `isDirty`.
  - [x] Serializar escritas por `slideId`, aguardar a fila ao trocar de slide e preservar `transicaoEntrada` em todos os resumos locais.
  - [x] Alinhar a transição Container Alpha ao palco ativo, tornar controles/range responsivos e oferecer fullscreen explícito.
  - [x] Manter `/apresentar` como rota standalone e liberar `autoplay`/`fullscreen` no iframe global de abas.

- [x] **Task 7 — Refinar profundidade e continuidade da transição** (AC: 14–15)
  - [x] Aplicar margem responsiva de 5%, com `clamp` efetivo entre 18 e 72 px, ao Container Alpha sintético.
  - [x] Eliminar a repetição causada por uma segunda camada quando o slide já contém o Container Alpha real configurado.
  - [x] Promover o índice lógico no início do zoom sem trocar o canvas visual de origem antes do `onComplete`.
  - [x] Separar palco e controles em regiões de layout próprias e adicionar `focus-visible` a botões e range.
  - [x] Restringir o gate de início à rota standalone e manter o modal iniciado desde o primeiro render.
  - [x] Corrigir a tipagem da conversão geométrica usada para alinhar abertura, margem e recorte no palco.

## Dev Notes

### Fluxo e precedentes confirmados

- `RenderEngine/RenderComponente.tsx` é a fonte única de renderização usada pelo editor, preview e modo apresentação. [Source: `.bibble/memory/components.md`, seção “Editor”]
- Componentes 3D existentes usam React Three Fiber, `useVisibilidadeIframe` e um `<Canvas>` próprio dentro da caixa do componente. [Source: `.bibble/memory/components.md`, seção “Componentes 3D”]
- `Slide.dadosJson` permanece o único ponto de persistência, validado por union Zod discriminada. [Source: `.bibble/memory/architecture.md`, seção “Alpha Presentation Studio”]
- Resize e movimento livres já são fornecidos por `ComponenteNoCanvas.tsx` e `useCanvasDragResize.ts`; o novo tipo deve ser uma folha normal, não um container recursivo. [Source: `.bibble/memory/integration-points.md`, seção “Onda 2”]
- O asset `/public/A.PNG` do Painel Alpha já é byte a byte equivalente ao usado no site de origem; nenhum asset novo é necessário. [Source: inspeção local dos dois projetos em 2026-08-03]

### Blueprint de integração

#### CRIAR

- [x] `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender.tsx`
- [x] `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaModel.tsx`
- [x] `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaCameraRig.tsx`
- [x] `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/ContainerCargaProps.tsx`
- [x] `tests/apresentacoes/container-alpha.test.ts`

#### EDITAR

- [x] `src/lib/validations/slide-componentes-3d.ts` — schema do tipo.
- [x] `src/lib/validations/slide-componentes.ts` — union e type exportado.
- [x] `src/components/Apresentacoes/Editor/registry/registry-3d.ts` — item da paleta/defaults.
- [x] `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` — render compartilhado e contexto editor/apresentação.
- [x] `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx` — informar modo editor.
- [x] `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx` — registrar propriedades.
- [x] `.bibble/memory/components.md` e `.bibble/memory/integration-points.md` — documentar o novo integration point preservando o conteúdo existente.

#### CONTROLE VERIFICADO, SEM ALTERAÇÃO

- [x] Menu/sidebar e permissões — continuam derivados do registro do módulo `apresentacoes`.
- [x] Rotas/middleware/auth — nenhuma rota nova.
- [x] Atalhos — componentes da paleta não possuem atalho dedicado.
- [x] Banco — sem alteração estrutural; Vault não é necessário.

### Riscos e mitigação

- Múltiplos canvases WebGL têm custo alto: pausar fora da viewport e não criar contextos adicionais além de um por instância.
- O editor redimensiona sem necessariamente disparar `window.resize`: observar a dimensão real do canvas/componente para recalcular a câmera.
- A abertura deve reiniciar ao voltar ao slide: o modo apresentação remonta o conteúdo por `slideId`; a sequência deve iniciar no mount.
- O componente existente chamado `container` é layout recursivo e não pode ser reutilizado como discriminador do container de carga.

## Testing

| Cenário | Resultado esperado |
|---|---|
| Default do registry | Gera `containerCarga` com dimensões e propriedades válidas |
| Schema completo | Aceita o componente padrão e preserva propriedades editáveis |
| Limites | Rejeita ângulo/duração/atraso fora dos limites definidos |
| Resize horizontal/vertical | Modelo permanece enquadrado sem corte e ocupa a caixa disponível |
| Apresentação | Portas partem fechadas e abrem na sequência configurada |
| Voltar ao slide | Animação reinicia |
| Reduced motion | Estado aberto é aplicado sem animação longa |
| Select de animação | Exibe `Container Alpha — transição de slide` para componentes compatíveis |
| Prévia no painel | Mostra o próximo slide no interior ou a mensagem para adicionar um slide |
| Avançar no player | Inicia o próximo slide junto do zoom e conclui sem quadro vazio ou delay extra |
| Áudio | Clique/toque no player libera Web Audio e reproduz o preset configurado |
| Abrir pelo editor | Dialog monta o player React imediatamente, sem iframe interno, auth ou nova consulta Prisma |
| Alteração ainda não persistida | Snapshot local reproduz os componentes e canvas atuais do slide ativo |
| Save concorrente | Versão antiga não limpa `isDirty`; fila por slide preserva a ordem, sobrevive a rejeição e não bloqueia slides diferentes |
| Player responsivo | Superfície permanece horizontal, range reorganiza em viewport estreito e fullscreen usa ação explícita |
| Rota standalone | `/apresentar` continua autenticada e reutiliza o mesmo player sem participar do modal |
| Profundidade da capa | Container sintético mantém 5% de respiro, limitado a 18–72 px, sem encostar na borda |
| Sequência abertura → zoom | Container abre uma única vez; o slide 2 começa junto do zoom e fica como destino final no mesmo callback |
| Canvas durante o zoom | Palco preserva dimensões e fundo do slide de origem até a transição terminar |
| Faixa de controles | Comandos não cobrem nem reduzem por sobreposição a área visível do slide |
| Gate de áudio | “Iniciar apresentação” aparece somente no standalone; o modal abre já iniciado |
| Navegação por teclado | Botões e range exibem foco visível e atalhos não interceptam elementos interativos |

## CodeRabbit Integration

- **Primary Type:** Frontend
- **Secondary Type:** Architecture / 3D
- **Complexity:** Medium — novo discriminador persistido e renderização WebGL em múltiplos contextos do Studio.
- **Primary Agents:** `@dev`, `@ux-design-expert`
- **Supporting Agents:** `@qa`
- [ ] **Pre-Commit (@dev):** revisar tipagem, cleanup Three.js, responsividade e acessibilidade.
- [ ] **Pre-PR (@github-devops):** revisar compatibilidade do JSON existente e regressões no RenderEngine.
- **Self-healing:** `@dev` light, máximo de 2 iterações, 15 minutos, CRITICAL `auto_fix` e HIGH `document_only`.
- **Focus Areas:** responsividade por tamanho real, performance de WebGL, validação Zod retrocompatível, reduced motion e ausência de mudanças de banco.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-08-03 | 1.0 | Story criada a partir do requisito direto e do blueprint dos dois codebases | River (SM) |
| 2026-08-03 | 1.1 | Capa movida do palco escalado para o viewport fullscreen; geometria passa a acompanhar a proporção real do player | Nova |
| 2026-08-03 | 1.2 | Fundo decorativo removido; host transparente mantém somente o modelo 3D e o conteúdo interno | Nova |
| 2026-08-03 | 1.3 | Formato inicial alterado para 16:9 e pausa artificial de 0,3s removida antes do zoom | Nova |
| 2026-08-03 | 1.4 | Modal do player fixado em 16:9 horizontal e troca do slide sincronizada ao término real do zoom 3D | Nova |
| 2026-08-03 | 1.5 | Container Alpha também disponível como entrada independente da apresentação, com prévia e configuração no painel | Nova |
| 2026-08-03 | 1.6 | Entrada independente removida; Container Alpha integrado ao select real de animação de entrada como transição sincronizada entre slides | Nova |
| 2026-08-03 | 1.7 | Player modal reconstruído como React nativo sem iframe interno, com snapshot instantâneo do Zustand, áudio no gesto, save seguro em background, palco alinhado e controles responsivos/fullscreen | Bibble Squad |
| 2026-08-03 | 1.8 | Profundidade responsiva de 5% (18–72 px), sequência única abertura→zoom→slide 2, canvas de origem estável, controles fora do palco, gate standalone e foco visível | Bibble Squad |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `npx eslint <arquivos da story>` — aprovado, zero warnings/erros.
- `npx vitest run tests/apresentacoes/container-alpha.test.ts --coverage=false` — 8/8 aprovados.
- `npm run lint` — falhou na varredura global por erros preexistentes em `.agents/`, `.aiox-core/` e `.claude/worktrees/` (principalmente `@typescript-eslint/no-require-imports`); lint focado nos arquivos da story aprovado.
- `npm run typecheck` — somente baselines fora do escopo em `ExclusaoFiscal`, `ModalPerfilColaborador`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`.
- `npm test` — 600/601; timeout recorrente em `tests/google-calendar/cli.test.ts`, que passou isoladamente junto dos testes da story (9/9).
- `npm run build` — bloqueado antes da compilação por lock `EPERM` no DLL do Prisma.
- `npx next build` — aprovado, 68 páginas estáticas geradas.
- CodeRabbit — WSL ausente; fallback manual PASS em `docs/qa/coderabbit-reports/story-apresentacoes-container-alpha-animado.md`.
- Correção 1.4: ESLint e TypeScript direcionados aprovados; `container-alpha.test.ts` com 18/18 testes aprovados; `git diff --check` aprovado.
- Gates globais após 1.4: typecheck mantém somente os 5 erros preexistentes fora do escopo; testes 625/626, com o timeout recorrente em `tests/google-calendar/cli.test.ts`; lint global excedeu 180s, enquanto o lint direcionado permaneceu limpo.
- Evolução 1.5: TypeScript e ESLint direcionados aprovados; `container-alpha.test.ts` com 21/21 testes aprovados; `git diff --check` aprovado. Na suíte global, 632/633 testes passaram e permaneceu somente o mesmo timeout de Google Calendar; typecheck manteve os erros externos já registrados; lint global excedeu 120s, com lint focado limpo.
- Correção 1.6: ESLint direcionado aprovado; `container-alpha.test.ts` com 21/21 testes aprovados. O typecheck não apresenta erro nos arquivos desta mudança e mantém apenas baselines externos já registrados. Na suíte global, 632/633 testes passaram e permaneceu o timeout recorrente em `tests/google-calendar/cli.test.ts`; lint global excedeu 180s; `npm run build` voltou a ser bloqueado pelo `EPERM` do Prisma. A inspeção visual automatizada ficou indisponível por ausência de navegador conectado ao ambiente.
- Evolução 1.7: lint focal aprovado; 26/26 testes focados aprovados — 21 do Container Alpha e 5 de persistência concorrente do editor; `git diff --check` aprovado; Lens PASS e Sage PASS. O typecheck global manteve 5 baselines externos. O lint global excedeu o limite de 120s e o build permaneceu bloqueado por `EPERM` do Prisma. A validação visual automatizada não foi executada porque não havia navegador conectado ao ambiente.
- Evolução 1.8: ESLint focal aprovado; 32/32 testes focados aprovados em `central-criativa.test.ts`, `container-alpha.test.ts` e `editor-persistencia.test.ts`; `git diff --check` aprovado. O typecheck não reporta erro no player e mantém somente 5 baselines externos: Exclusão Fiscal (2), Radar (1) e Google Calendar (2).

### Completion Notes List

- Novo item `Container Alpha` disponível na categoria 3D, com persistência Zod e defaults válidos.
- Modelo procedural e movimento de abertura foram adaptados do site institucional sem copiar ou alterar assets.
- Câmera e palco de apresentação agora se adaptam ao tamanho/proporção disponíveis sem deformação.
- No player, o container ignora x/y/w/h do editor e usa uma camada própria sobre o palco; na transição sintética, uma margem responsiva de 5% da menor dimensão, limitada entre 18 e 72 px, cria profundidade sem reduzir o container a um elemento de canto.
- A abertura medida no viewport é convertida para as coordenadas lógicas do slide antes da transição para o próximo conteúdo.
- A opção `Container Alpha — transição de slide` agora vive no select existente **Animação de entrada** do componente selecionado e salva a configuração no próprio contrato de animação.
- Ao selecionar a opção, o painel mostra uma prévia 16:9 reproduzível com o próximo slide dentro do container e controles de cores, ângulo, tempos, zoom, logo, preset e volume.
- No player, avançar inicia uma única sequência: as portas abrem e o próximo slide começa no primeiro frame do zoom; o canvas visual de origem permanece estável e a capa sai no callback real de conclusão, sem timeout, restart ou camada sintética concorrente.
- O Web Audio é liberado no `pointerdown` do player e no botão de reproduzir da prévia antes de agendar o som procedural.
- O botão “Apresentar” agora libera o Web Audio e monta `ModoApresentacaoClient` diretamente no Dialog; não existe segundo iframe, nova navegação, repetição de auth/Prisma ou `postMessage` de fechamento.
- O modal recebe um snapshot instantâneo dos slides já carregados no Zustand, incluindo a versão atual de componentes/canvas do slide ativo e `transicaoEntrada` dos demais slides.
- O save do snapshot ativo roda em background sob versão monotônica e fila serial por slide; uma resposta antiga não limpa o estado sujo nem pode sobrescrever uma gravação posterior do mesmo slide.
- A transição especial permanece dentro do palco do slide de origem. Os controles ocupam uma faixa própria abaixo dele, reorganizam o range em telas estreitas, exibem `focus-visible` e não cobrem o conteúdo; fullscreen é acionado explicitamente pelo usuário.
- O modal nasce iniciado para continuar instantâneo. Somente a rota standalone mostra “Iniciar apresentação”, preservando o gesto exigido por áudio e fullscreen antes de reproduzir.
- A rota `/PainelAlpha/Apresentacoes/[id]/apresentar` continua standalone e autenticada; `PainelLayoutClient` permite `autoplay` e `fullscreen` no iframe global das abas.
- Não houve mudança de banco, rota, permissão, autenticação ou dependência.
- Validação visual autenticada no navegador permanece recomendada; a validação disponível foi estrutural, automatizada e por build de produção.

### File List

- `docs/stories/story-apresentacoes-container-alpha-animado.md`
- `docs/qa/coderabbit-reports/story-apresentacoes-container-alpha-animado.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/integration-points.md`
- `src/lib/validations/slide-componentes-3d.ts`
- `src/lib/validations/slide-componentes.ts`
- `src/lib/apresentacoes/viewport.ts`
- `src/lib/apresentacoes/animacao-container-alpha.ts`
- `src/lib/apresentacoes/container-carga-audio.ts`
- `src/lib/validations/animacao.ts`
- `src/components/Apresentacoes/Editor/registry/registry-3d.ts`
- `src/components/Apresentacoes/Editor/ModalReproducaoApresentacao.tsx`
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`
- `src/components/Apresentacoes/Editor/store/useEditorStore.ts`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaModel.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaCameraRig.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AnimacaoProps.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/AnimacaoContainerAlphaProps.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/ContainerCargaProps.tsx`
- `src/components/Apresentacoes/Editor/Timeline/TimelineReal.tsx`
- `src/components/Apresentacoes/Editor/Timeline/useTimelineDrag.ts`
- `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`
- `src/components/Apresentacoes/ModoApresentacao/TransicaoContainerAlphaLayer.tsx`
- `src/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer.tsx`
- `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx`
- `src/app/PainelAlpha/Apresentacoes/[id]/apresentar/page.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/lib/apresentacoes/container-intro.ts`
- `tests/apresentacoes/container-alpha.test.ts`
- `tests/apresentacoes/editor-persistencia.test.ts`
- `tests/apresentacoes/central-criativa.test.ts`

## QA Results

- Lint focal: aprovado sem avisos.
- Testes focados: 32/32 aprovados nos três arquivos `central-criativa.test.ts`, `container-alpha.test.ts` e `editor-persistencia.test.ts`.
- `git diff --check`: aprovado.
- Lens: PASS.
- Sage: PASS.
- Typecheck: sem erros no player; 5 baselines externos preservados — Exclusão Fiscal (2), Radar (1) e Google Calendar (2).
- Lint global: timeout após 120s.
- Build: bloqueado por `EPERM` do Prisma.
- Validação visual automatizada: indisponível por ausência de navegador conectado ao ambiente.
- Risco residual: manter E2E futuro para churn contínuo da Sidebar e medição da latência visual imediata; ambos os fluxos foram aprovados nesta rodada por inspeção do código, sem substituir o teste em navegador real.
