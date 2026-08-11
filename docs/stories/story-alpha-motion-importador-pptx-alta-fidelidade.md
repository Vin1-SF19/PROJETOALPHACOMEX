# Story: Importador PPTX OOXML de alta fidelidade do Alpha Motion

## Status

In Progress — implementação concluída; validação visual do fixture real pendente por ausência do PPTX anexado

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, `CodeRabbit`, regressão PPTX

## Story

**Como** usuário do Alpha Motion que importa apresentações do PowerPoint,  
**quero** que o importador preserve a estrutura e a aparência OOXML por meio de um modelo intermediário completo,  
**para** continuar editando os elementos no Alpha Motion com alta fidelidade visual e fallback apenas quando o formato não puder ser representado nativamente.

## Origem e restrição central

Esta story deriva integralmente da especificação anexada pelo usuário em 2026-08-07. O arquivo real de 18 slides é um fixture de regressão, nunca uma fonte de regras por nome, número do slide ou offsets hardcoded.

Pipeline alvo:

`PPTX -> pacote OOXML -> PptxIntermediateModel -> EffectiveSlideTree -> AlphaMotionModel -> canvas/preview`

## Acceptance Criteria

1. O parser preserva árvore, source metadata, coordenadas EMU, Z-order e transforms locais/mundiais antes do mapeamento para componentes Alpha Motion.
2. Background efetivo segue `slide -> layout -> master -> theme -> default PresentationML`; ausência de `p:bg` resulta em branco quando nenhuma definição efetiva existir, nunca no fundo escuro da UI.
3. A cadeia Slide/Layout/Master/Theme resolve `clrMap`, placeholders, formas visuais, estilos, fontes, fills, linhas e efeitos sem renderizar textos de edição do Master.
4. `ColorResolver` único suporta `srgbClr`, `schemeClr`, `sysClr/lastClr`, `scrgbClr`, `prstClr`, `hslClr` e transformações de alpha/tint/shade/luminância/saturação.
5. Grupos, inclusive aninhados, usam composição matricial para translate/scale/rotate/flip com `off/ext/chOff/chExt` e não achatam coordenadas prematuramente.
6. Imagens em `p:pic` e `p:sp/a:blipFill` resolvem relationships, preferem SVG, preservam `srcRect`, stretch/tile, rotação, flip, opacidade e aspect ratio sem `object-fit: cover` indiscriminado.
7. `custGeom` preserva paths OOXML e usa SVG/clipPath/mask como fallback localizado quando não houver equivalente nativo.
8. Texto preserva `TextBody -> Paragraph -> Run`, estilos por run, métricas em centésimos de ponto, margens, alinhamento, spacing, indentação, bullets/tabs, wrap/anchor/vert e os três modos de autofit.
9. `FontResolver` aplica fonte/peso/estilo quando disponível, aguarda `document.fonts.ready` para medições e reporta substituições sem fazê-las silenciosamente.
10. Fills transparentes/ausentes e TextBoxes whitespace-only sem efeito visual são tratados como conteúdo válido/ignorado silenciosamente, não como erro.
11. Style references `lnRef/fillRef/effectRef/fontRef`, linhas/bordas e efeitos principais (ao menos outer shadow) são resolvidos pelo Theme e renderizados.
12. Ordem de `spTree` é preservada entre tipos e dentro de grupos; elementos visuais de Master/Layout são mesclados sem duplicar placeholders.
13. Elementos sem suporte nativo usam fallback por elemento/grupo (SVG ou imagem bloqueada); nenhum elemento visual relevante é descartado silenciosamente.
14. Diagnósticos usam severidades `INFO/WARNING/FALLBACK/ERROR`, incluem source path, shape, parent, transform, crop, resultado e motivo; o editor oferece `Debug PPTX` opcional com bounding boxes e metadata.
15. O processamento mantém validações contra ZIP traversal/bomb, XML malicioso, referências externas, paths inválidos, tamanho excessivo e falhas isoladas por slide/elemento, com caches de XML/relationships/theme/assets.
16. O PPTX original é preservado como asset da apresentação e cada componente importado mantém metadata de origem e versão do importador sem migration de banco.
17. Quando um renderer independente estiver disponível, são geradas referências por slide e um visual diff localiza diferenças; indisponibilidade deve ser reportada explicitamente, não simulada pelo próprio parser.
18. O fixture real importa 18/18 slides, resolve os assets esperados e satisfaz as validações visuais descritas para slides 1–8; testes sintéticos cobrem os recursos genéricos sem hardcodes do fixture.
19. Compatibilidade com slides existentes e editabilidade dos tipos já suportados são preservadas; nenhuma reescrita do editor ou migration de banco é introduzida.
20. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; falhas preexistentes ou ambientais são separadas das regressões desta story.

## Blueprint de Integração

### Criar

- [x] `src/lib/apresentacoes/pptx/modelo-intermediario.ts` — contratos OOXML preservados antes da conversão.
- [x] `src/lib/apresentacoes/pptx/matriz-transformacao.ts` — transforms locais/mundiais recursivos.
- [x] `src/lib/apresentacoes/pptx/color-resolver.ts` — resolução única de cores e alpha.
- [x] `src/lib/apresentacoes/pptx/heranca.ts` — EffectiveSlideTree, placeholders e style refs.
- [x] `src/lib/apresentacoes/pptx/texto.ts` — paragraphs/runs, métricas, autofit e fontes.
- [x] `src/lib/apresentacoes/pptx/diagnostico.ts` — severidades e rastreabilidade estruturada.
- [x] `src/lib/apresentacoes/pptx/seguranca.ts` — limites e validação defensiva do pacote.
- [x] `src/lib/apresentacoes/pptx/reference-renderer.ts` e `visual-diff.ts` — referência independente e diff localizado.
- [x] testes direcionados nos módulos novos e regressões no parser.

### Editar — integration points obrigatórios

- [x] `src/lib/apresentacoes/pptx/parser.ts` — construir o modelo intermediário/árvore efetiva em vez de perder dados na extração direta.
- [x] `src/lib/apresentacoes/pptx/tema.ts`, `xml-utils.ts`, `geometria.ts`, `tipos.ts` — integrar herança, cache, estilos, transforms e fallbacks.
- [x] `src/lib/apresentacoes/pptx/mapear.ts` — converter somente na borda para o modelo Alpha Motion.
- [x] `src/lib/validations/slide-componentes-base.ts`, `slide-componentes-basicos.ts`, `slide-componentes.ts` — propriedades opcionais e retrocompatíveis de origem, rich text, imagem, linha e efeitos.
- [x] `src/components/Apresentacoes/Editor/RenderEngine/` — renderizar as propriedades preservadas e o overlay de debug sem criar um segundo motor.
- [x] `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx` e store/editor — separar background do slide do viewport e controlar `Debug PPTX`.
- [x] `src/components/Apresentacoes/Editor/SidebarEsquerda/ModalPreImportarPptx.tsx` — relatório, fontes/fallbacks e comparação visual.
- [x] rotas `pptx-preview` e `importar-pptx` — segurança, metadata, preservação do original e resultados estruturados.
- [x] `tests/apresentacoes/pptx-parser.test.ts` e `pptx-ooxml-core.test.ts` — regressão OOXML genérica.

### Consultar — precedentes

- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx` — renderizador único do editor/player/export.
- `src/lib/apresentacoes/canvas.ts` — canvas e background persistidos em `Slide.dadosJson`.
- `src/lib/apresentacoes/assets.ts` — upload/registro de assets sem alterar schema.
- `.bibble/memory/integration-points.md#Importação-de-PPTX` — pipeline anterior, limitações e regressão de 18 slides.

## Padrões e riscos

- Preservar o isolamento `try/catch` por elemento e slide.
- Não alterar Prisma/schema; qualquer necessidade de migration exige ciclo Vault separado.
- Não duplicar o render engine: editor, preview e export continuam usando `RenderComponente`.
- O arquivo PPTX real não está presente no workspace nesta execução; AC-18 só pode ser fechado após o usuário anexá-lo novamente.
- Render de referência depende de LibreOffice/Aspose/ONLYOFFICE disponível no ambiente; a ausência deve produzir estado informativo.
- O worktree já contém mudanças não relacionadas; esta story não pode revertê-las nem incluí-las acidentalmente.

## Tasks / Subtasks

- [x] Modelar OOXML intermediário e segurança/caches (AC: 1, 15, 16)
- [x] Resolver herança, background, placeholders, cores e style refs (AC: 2, 3, 4, 11, 12)
- [x] Implementar matrices de grupo e imagem/crop/geometry (AC: 5, 6, 7)
- [x] Implementar rich text, fonte e autofit retrocompatíveis (AC: 8, 9, 10)
- [x] Mapear/renderizar efeitos, linhas, fallback e metadata (AC: 11, 13, 14, 19)
- [x] Integrar APIs/modal, preservação do original e diagnóstico (AC: 14, 15, 16, 17)
- [x] Remover o `413` de produção com upload direto multipart e conectar todos os blobs do Alpha Motion ao store `MOTION` (AC: 15, 16)
- [ ] Validar o fixture real de 18 slides quando o arquivo for disponibilizado (AC: 18)
- [x] Executar quality gates e atualizar esta checklist/File List (AC: 20)

## Testing

- Vitest em `tests/apresentacoes/pptx-parser.test.ts` e arquivos adicionais em `tests/apresentacoes/`.
- Casos sintéticos para background `bg1 -> lt1 -> sysClr/lastClr`, color transforms, placeholders, grupos rotacionados/flipados, crop, rich text, whitespace, style refs, shadow, linhas, z-order e fallback.
- Regressão real: 18 slides e comparação com renderer independente, condicionada à disponibilidade do fixture e renderer.

## CodeRabbit Integration

- Tipo primário: Architecture; secundários: API, Frontend, Security; complexidade alta.
- Agentes previstos: `@dev`, `@architect`, `@qa`; `@github-devops` somente para PR/push.
- Pre-Commit: revisão uncommitted; Pre-PR: revisão contra `main`.
- Foco: perda de dados OOXML, segurança de ZIP/XML, compatibilidade de schema, render consistente e ausência de hardcodes por fixture.
- Self-healing Dev: light, até 2 iterações/15 min para CRITICAL.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-07 | 1.0 | Story criada a partir da especificação integral do usuário e do reconhecimento do pipeline existente. | River |
| 2026-08-07 | 2.0 | Pipeline OOXML intermediário, render fiel, referência independente, diff visual, segurança e regressões sintéticas implementados. | Dex |
| 2026-08-11 | 2.1 | Upload PPTX direto/multipart, prévia sem base64 e store dedicado `MOTION` aplicados para eliminar o limite 413 em produção. | Dex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/apresentacoes/pptx-parser.test.ts tests/apresentacoes/pptx-ooxml-core.test.ts` — 25/25.
- `npm test` — 1033/1034; uma falha preexistente por timeout em `tests/google-calendar/cli.test.ts`.
- `npm run typecheck` — sem erro nos arquivos da story; falhas preexistentes em `ExclusaoFiscal`, Radar e testes Google Calendar.
- ESLint direcionado a todos os arquivos da correção — PASS; `npm run lint` global não concluiu dentro do teto de 180 segundos.
- `npm run build:player` — PASS.
- `npm run build` — bloqueado antes do Next build por `EPERM` ao substituir `node_modules/.prisma/client/query_engine-windows.dll.node` (arquivo em uso no ambiente).
- `npm run build:player` e `npx next build` — PASS; 70/70 páginas geradas e a nova rota `/api/apresentacoes/[id]/pptx-upload` incluída no build de produção.
- Smoke do renderer independente — PowerPoint COM exportou 1/1 slide sintético para PNG.
- `npx vitest run tests/apresentacoes/pptx-upload.test.ts tests/apresentacoes/pptx-parser.test.ts tests/apresentacoes/pptx-ooxml-core.test.ts` — 28/28.
- ESLint direcionado aos 10 arquivos alterados na correção de produção — PASS.
- `npx tsc --noEmit --pretty false` — nenhum erro novo; permanecem erros preexistentes em `ExclusaoFiscal`, Radar e testes Google Calendar.
- Smoke real do store configurado em `.env.local` — listagem, escrita e remoção aprovadas sem resíduo.

### Completion Notes List

- Background implícito agora é branco no canvas; background explícito/herdado e gradiente são preservados separadamente do viewport escuro.
- O modelo intermediário preserva árvore de grupos, EMU, transformações local/world, source metadata, z-order e nós de fallback.
- Rich text por run, herança de placeholder, quebras intercaladas, métricas de fonte, crop/tile, flip, opacidade, linhas e sombras foram propagados ao render compartilhado.
- O PPTX original e referências PowerPoint são preservados; assets repetidos são deduplicados por SHA-256.
- A prévia aguarda fontes, reporta substituições e produz Original/Importado/Diferença quando o renderer independente está disponível.
- A validação visual do arquivo real e a lista real de fontes ausentes permanecem pendentes porque somente a especificação textual foi anexada, sem o `.pptx`.
- O binário PPTX agora vai direto do navegador ao Vercel Blob com multipart; as APIs recebem somente uma referência JSON validada por store, caminho e apresentação.
- Imagens da prévia usam blobs temporários em vez de `data:` URIs, mantendo também a resposta abaixo do limite da Function; cancelamento e confirmação executam limpeza protegida.
- Assets, fontes, imagens extraídas, referências e originais novos usam `MOTION_READ_WRITE_TOKEN`; exclusões e catálogo de fontes preservam compatibilidade com o store legado.

### File List

- `docs/stories/story-alpha-motion-importador-pptx-alta-fidelidade.md`
- `scripts/render-pptx-reference.ps1`
- `src/actions/slides.ts`
- `src/actions/apresentacao-assets.ts`
- `src/app/api/apresentacoes/[id]/importar-pptx/route.ts`
- `src/app/api/apresentacoes/[id]/pptx-preview/route.ts`
- `src/app/api/apresentacoes/[id]/pptx-upload/route.ts`
- `src/app/api/apresentacoes/assets/route.ts`
- `src/app/api/apresentacoes/fontes/route.ts`
- `src/apresentacoes-player/PlayerStandalone.tsx`
- `src/components/Apresentacoes/Editor/Canvas/CanvasArea.tsx`
- `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`
- `src/components/Apresentacoes/Editor/CentralCriativa/ResizeExportPanel.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/RenderComponente.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/nucleo.tsx`
- `src/components/Apresentacoes/Editor/RenderEngine/posicionamento.ts`
- `src/components/Apresentacoes/Editor/RenderEngine/render/RenderBasicos.tsx`
- `src/components/Apresentacoes/Editor/SidebarEsquerda/ModalPreImportarPptx.tsx`
- `src/components/Apresentacoes/Editor/store/useEditorStore.ts`
- `src/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient.tsx`
- `src/lib/apresentacoes/canvas.ts`
- `src/lib/apresentacoes/blob.ts`
- `src/lib/apresentacoes/fontes-globais.ts`
- `src/lib/apresentacoes/pptx/color-resolver.ts`
- `src/lib/apresentacoes/pptx/diagnostico.ts`
- `src/lib/apresentacoes/pptx/geometria.ts`
- `src/lib/apresentacoes/pptx/heranca.ts`
- `src/lib/apresentacoes/pptx/mapear.ts`
- `src/lib/apresentacoes/pptx/matriz-transformacao.ts`
- `src/lib/apresentacoes/pptx/modelo-intermediario.ts`
- `src/lib/apresentacoes/pptx/parser.ts`
- `src/lib/apresentacoes/pptx/reference-renderer.ts`
- `src/lib/apresentacoes/pptx/seguranca.ts`
- `src/lib/apresentacoes/pptx/tema.ts`
- `src/lib/apresentacoes/pptx/texto.ts`
- `src/lib/apresentacoes/pptx/tipos.ts`
- `src/lib/apresentacoes/pptx/upload.ts`
- `src/lib/apresentacoes/pptx/visual-diff.ts`
- `src/lib/apresentacoes/pptx/xml-utils.ts`
- `src/lib/validations/slide-componentes-base.ts`
- `src/lib/validations/slide-componentes-basicos.ts`
- `src/lib/validations/slide-componentes.ts`
- `tests/apresentacoes/pptx-ooxml-core.test.ts`
- `tests/apresentacoes/pptx-parser.test.ts`
- `tests/apresentacoes/pptx-upload.test.ts`

## QA Results

- **CONCERNS:** regressões sintéticas e renderer independente aprovados; aceite visual final permanece bloqueado até o `.pptx` real de 18 slides ser anexado nesta tarefa. Gates globais também contêm falhas preexistentes documentadas acima.
