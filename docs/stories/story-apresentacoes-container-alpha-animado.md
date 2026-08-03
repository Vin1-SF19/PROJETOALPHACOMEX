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

### Completion Notes List

- Novo item `Container Alpha` disponível na categoria 3D, com persistência Zod e defaults válidos.
- Modelo procedural e movimento de abertura foram adaptados do site institucional sem copiar ou alterar assets.
- Câmera e palco de apresentação agora se adaptam ao tamanho/proporção disponíveis sem deformação.
- No player, o container ignora x/y/w/h do editor e usa uma camada própria sobre 100% do viewport; os controles ficam sobrepostos à capa.
- A abertura medida no viewport é convertida para as coordenadas lógicas do slide antes da transição para o próximo conteúdo.
- O primeiro slide pode salvar `entradaApresentacao` no próprio JSON; a capa reutiliza o modelo existente e revela o conteúdo já montado ao terminar o zoom.
- O painel de entrada oferece seletor, prévia 16:9 reproduzível e os mesmos controles visuais/sonoros, sem exigir que o container seja adicionado ao canvas.
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
- `src/lib/apresentacoes/entrada-apresentacao.ts`
- `src/components/Apresentacoes/Editor/registry/registry-3d.ts`
- `src/components/Apresentacoes/Editor/ModalReproducaoApresentacao.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaModel.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/ContainerCargaCameraRig.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/PainelPropriedades.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/EntradaApresentacaoProps.tsx`
- `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/ContainerCargaProps.tsx`
- `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`
- `src/components/Apresentacoes/ModoApresentacao/EntradaContainerAlphaLayer.tsx`
- `src/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer.tsx`
- `src/lib/apresentacoes/container-intro.ts`
- `tests/apresentacoes/container-alpha.test.ts`

## QA Results

- ESLint direcionado: aprovado sem avisos.
- TypeScript direcionado: aprovado.
- Testes de container e Central Criativa: 24/24 aprovados.
- Validação visual automatizada indisponível por ausência de navegador conectado ao ambiente.
