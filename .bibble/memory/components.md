# COMPONENTS — Catálogo de Componentes

> Mantido por: Nova (frontend) e Scribe (cartógrafo)
> Consultar SEMPRE antes de criar um novo componente.

---

## Template de entrada

```
### [NomeDoComponente]
**Arquivo:** `src/components/[caminho].tsx`
**Tipo:** Server Component | Client Component
**Props:** [lista das props principais]
**Uso:** `<NomeDoComponente prop1="..." />`
**Notas:** [quando usar, variantes disponíveis]
```

---

## Componentes

<!-- Adicionar aqui conforme o projeto cresce -->

### ComissoesDashboard (+ Cabecalho/EventoCard/MiniCard/ModalDetalhes)
**Arquivo:** `src/components/Comissoes/ComissoesDashboard.tsx`
**Tipo:** Client Component (orquestrador)
**Props:** `temaName: string`
**Uso:** `<ComissoesDashboard temaName={temaName} />` em `src/app/PainelAlpha/Comissoes/page.tsx`
**Notas:** Orquestra `CabecalhoComissoes` (Sincronizar/Simulador/Exportar/Configurações/Divergências), `CardsIndicadores`, `FiltrosComissoes`, `EventoComissaoCard` (Big Card por evento, agrupa `SetorColaboradores`), `LancamentoColaboradorCard` (mini card por colaborador), `ModalDetalhesLancamento` (7 abas). Padrão "Ledger Vivo" (ver `design-tokens.md`/`patterns.md`). Paginado (`PAGE_SIZE = 25`).

### ModalDetalhesLancamento
**Arquivo:** `src/components/Comissoes/ModalDetalhes/ModalDetalhesLancamento.tsx`
**Tipo:** Client Component
**Props:** `entryId: string | null`, `onOpenChange: (open: boolean) => void`, `onAtualizar?: () => void`
**Uso:** montado 1x no `ComissoesDashboard`, controlado por `entryIdSelecionado`.
**Notas:** 7 abas (Resumo/Memória/Regra/Pagamentos/Ajustes/Histórico/Auditoria). Aba Ajustes tem formulário de `CriarAjusteManual` (adicionado Fase 16) — bloqueado quando `entry.status` é "Pago"/"Estornado", mesma regra da Server Action. Ações de pagamento (Marcar como pago/Programar/Estornar) todas com `AlertDialog` de confirmação antes de executar.

### ConstrutorRegras / AbaCargos / AbaTarifarios
**Arquivo:** `src/components/Comissoes/Configuracoes/`
**Tipo:** Client Component
**Uso:** abas de `ConfiguracoesComissoes.tsx` (`/PainelAlpha/Comissoes/Configuracoes`)
**Notas:** `ConstrutorRegras` monta `CommissionRuleVersion` (condições/cálculo/agenda de pagamento) e chama `SalvarRascunhoRegra`/`PublicarRegra`/`CriarVersaoRegra` — versionamento imutável, nunca sobrescreve versão PUBLISHED. Conversões reais→centavos (`Math.round(parseFloat(...) * 100)`) isoladas na borda de input, nunca circulam como `Float`.

### SimuladorRegras
**Arquivo:** `src/components/Comissoes/Simulador/SimuladorRegras.tsx`
**Tipo:** Client Component
**Uso:** `/PainelAlpha/Comissoes/Simulador`
**Notas:** Reusa o MESMO motor de regras real (`evaluateRules`/`calculateAmountCents`/`calculateCommissionableBase` via `SimularRegra`), sem duplicar lógica financeira na UI — só simula contra seed-rules, não contra regras publicadas (TODO documentado).

### ImagemNode (Canvas do Alpha Blueprint)
**Arquivo:** `src/components/AlphaBlueprint/canvas/CanvasNodes.tsx`
**Tipo:** Client Component (node customizado do `@xyflow/react`)
**Props:** `NodeProps<Node<DadosImagemNode>>` — `data: { url?, nomeArquivo?, legenda?, cor? }`
**Uso:** registrado em `CANVAS_NODE_TYPES.imagemNode`; criado pela toolbar via tipo `"imagem"` em `criarNode()` (`BlueprintCanvas.tsx`).
**Notas:** upload real (não placeholder) via `POST /api/blueprint/upload`, reaproveitando a mesma rota do `FileUploadDropzone.tsx`. Precisa do `projectId`, fornecido via `CanvasProjectIdContext` (novo Context, provido em `BlueprintCanvas.tsx` ao lado do `CanvasDataChangeContext`) — sem ele o upload falha com 400 (`projectId` ausente), nunca silenciosamente. Estado vazio mostra dropzone clicável; com `data.url` preenchido, mostra a imagem via `next/image` (domínio `*.blob.vercel-storage.com` já liberado em `next.config.ts`) com botão "Substituir" no hover. `descreverCanvasProjeto()` (`ai-context.ts`) tem um case dedicado para `imagemNode` no "Gerar prompt".

### ConviteWizard (+ Step* + shared)
**Arquivo:** `src/components/Parceiros/Convite/ConviteWizard.tsx`
**Tipo:** Client Component
**Props:** `token: string`, `termo: { versao: string; conteudo: string } | null`
**Uso:** `<ConviteWizard token={token} termo={resultado.termo} />` em `src/app/convite/parceiro/[token]/page.tsx`
**Notas:** Wizard multi-step (7 telas) do convite público de parceiro, substituiu o form single-page `FormConviteParceiro.tsx` (deletado). Reaproveita o padrão de stepper visual do onboarding do AlphaParceiros (`OnboardingWizard.tsx`) e a lógica de busca de CEP do `ModalEndereco.tsx`. Estado do formulário inteiro num único `useState<ConviteFormData>` (tipo e helpers em `shared.tsx`: `Campo`, `inputCls`, `CardSecao`, `BotoesNavegacao`, `UFS`, `AREAS`). A etapa de Termos (`StepTermos.tsx`) só aparece se houver `ParceiroTermo` ativo — senão o submit ocorre direto ao fim de `StepEmpresa.tsx`. Ver fluxo completo em `integration-points.md`.

### StepPin
**Arquivo:** `src/components/Parceiros/Convite/StepPin.tsx`
**Tipo:** Client Component
**Props:** `pin: string`, `onChange: (patch: { pin: string }) => void`, `onNext: () => void`
**Uso:** primeira tela do `ConviteWizard` (step -1), antes da Apresentação.
**Notas:** só valida FORMATO (4 dígitos numéricos) client-side — a validação real do PIN contra o banco acontece no backend, na primeira tentativa de busca automática de CPF (`/api/convite/consulta-cpf`). Decisão consciente: evita gastar uma chamada paga só para validar o PIN isoladamente.

### ModalMensagemConvite
**Arquivo:** `src/components/Parceiros/ModalMensagemConvite.tsx`
**Tipo:** Client Component
**Props:** `open: boolean`, `onClose: () => void`, `link: string`, `pin: string`, `template: { id, nome, mensagem } | null`
**Uso:** `<ModalMensagemConvite open onClose={...} link={...} pin={...} template={templateConvite} />` — montado como irmão independente em `ParceirosClient.tsx`, nunca dentro de `ModalConvidarParceiro`.
**Notas:** Espelha visualmente o `ModalCredenciais.tsx` (bloco "Mensagem de Boas-vindas" + botão copiar). Usa `substituirPlaceholders` para trocar `[LINK]`/`[PIN]`. Sem template ativo, cai em mensagem de fallback hardcoded.

### substituirPlaceholders (helper compartilhado)
**Arquivo:** `src/lib/onboarding-placeholders.ts`
**Tipo:** função pura (não componente, sem "use server" — importável por client e server)
**Uso:** `substituirPlaceholders(mensagem, { LOGIN: "...", SENHA: "..." })` ou `substituirPlaceholders(mensagem, { LINK: "...", PIN: "..." })`
**Notas:** Substitui `[CHAVE]` (formato atual) E `{chave}` minúsculo (formato legado, retrocompatibilidade). Usado por `ModalCredenciais.tsx` e `ModalMensagemConvite.tsx`. Se um novo tipo de template precisar de novos placeholders, basta passar o `Record<string,string>` correspondente — não precisa alterar o helper.

### Módulo Extratos Bancários (reescrito em 2026-07-09)
**Arquivo:** `src/components/Extratos/` (ExtratosListagem.tsx, ExtratoDetalhe.tsx, ModalNovaEmpresa.tsx, ModalVincularBanco.tsx, ModalNovoPeriodo.tsx, ModalUploadExtrato.tsx, ModalConferencia.tsx, ModalTransacoesSalvas.tsx, TabelaTransacoesPaginada.tsx, lib/{exportar-excel,bancos-catalogo,formatters}.ts)
**Tipo:** Client Components
**Uso:** `src/app/PainelAlpha/ExtratosBancarios/page.tsx` e `[Id]/page.tsx` ficam finos, só renderizam `<ExtratosListagem />`/`<ExtratoDetalhe extratoId={Id} />`.
**Notas:** Substitui completamente a estrutura antiga em `[Id]/Modais/` e `ModalCadastros/` (deletada). Primeiro módulo do painel a usar `AlertDialog` (exclusão de banco) e `Badge` (indicador "data incerta") do shadcn — ambos existiam mas nunca tinham sido adotados. `TabelaTransacoesPaginada` é o primeiro componente do painel com paginação server-side real (skip/take via Prisma) — reutilizável para outros módulos que precisem do mesmo padrão. `AnimatedShaderBackground` (`src/components/ui/animated-shader-background.tsx`) é o background de aurora shader (Three.js) usado atrás da listagem — pausa quando a aba não está visível, usa `ResizeObserver`, cores calibradas em indigo/slate. `Transacao.data` agora é `DateTime | null` — qualquer novo código que exiba transações deve tratar null com fallback pra `dataOriginalTexto` (ver `formatarDataTransacao` em `lib/formatters.ts`).

### Módulo Alpha Presentation Studio — Dashboard (Onda 1, 2026-07-09)
**Arquivo:** `src/components/Apresentacoes/Dashboard/` (ApresentacoesDashboard.tsx, CardApresentacao.tsx, ModalNovaApresentacao.tsx)
**Tipo:** Client Components
**Uso:** `src/app/PainelAlpha/Apresentacoes/page.tsx` fica fino, só renderiza `<ApresentacoesDashboard temaName={...} />`.
**Notas:** Primeira fatia (Onda 1 de 6) do módulo — só Dashboard (listar/criar/duplicar/excluir), sem Editor ainda. Segue o padrão visual "Aurora Financeira" de forma mais enxuta que Extratos (sem shader de fundo, sem filtros de ordenação — grid simples + busca debounced). `CardApresentacao` usa `Badge` (DRAFT=secondary, PUBLICADA=default, ARQUIVADA=outline) e `AlertDialog` para confirmação de exclusão (nunca `confirm()` nativo). Botão "Editar"/clique no card navega para `/PainelAlpha/Apresentacoes/[id]/editor` — **agora existe** (Onda 2, ver entrada abaixo).

### Módulo Alpha Presentation Studio — Editor (Onda 2, 2026-07-09)
**Arquivo:** `src/components/Apresentacoes/Editor/` (ApresentacaoEditor.tsx + subpastas SidebarEsquerda/, Canvas/, PainelDireito/, BarraSuperior/, Timeline/, RenderEngine/, registry/, store/)
**Tipo:** Client Components
**Uso:** `src/app/PainelAlpha/Apresentacoes/[id]/editor/page.tsx` fica fino (auth + ownership + busca apresentação/slides), renderiza `<ApresentacaoEditor apresentacaoId titulo slidesIniciais slideAtivoIdInicial componentesIniciais />`.
**Notas:**
- **`RenderEngine/RenderComponente.tsx` é a ÚNICA função que traduz o JSON (`ComponenteSlide`) em JSX** — recursiva para `card`/`grid.filhos`. Reutilizada obrigatoriamente pelas Ondas futuras (Modo Apresentação, Export) — nunca duplicar esta lógica em outro lugar.
- **`Canvas/ComponenteNoCanvas.tsx` envolve o RenderComponente com seleção e drag/resize** — a seleção é responsabilidade deste componente, não do RenderComponente (que fica puro/genérico). Implementa a decisão de UX confirmada com o usuário: clique simples seleciona diretamente o filho mais profundo dentro de Card/Grid (`stopPropagation` em cada nível), não o container pai primeiro.
- **Drag/resize livre é feito com mouse events próprios** (`Canvas/useCanvasDragResize.ts`), não com `@dnd-kit` — `@dnd-kit` é usado só para arrastar da paleta (sidebar) para dentro do canvas (`useDraggable`/`useDroppable`) e para reordenar a lista de slides (`useSortable`, mesmo padrão do Kanban de `PipelineClient.tsx` do CRM). Decisão de arquitetura de Scout: @dnd-kit não é o encaixe certo para posicionamento livre X/Y com resize.
- **`store/useEditorStore.ts`** (Zustand, sem middleware, padrão simples do projeto) guarda a árvore de componentes do slide ativo como espelho local editável; autosave via `useEffect` com debounce de 1.5s chamando `AtualizarSlide`.
- **`registry/componentes-registry.ts`** é o mapa único tipo→{label, ícone lucide, `criarComponentePadrao(x,y)`} — usado pela paleta da sidebar E por qualquer lugar que precise saber os defaults de um tipo novo. Usa `crypto.randomUUID()` nativo para gerar IDs (sem dependência nova tipo `nanoid`).
- **Biblioteca desta onda: 7 tipos** (texto, imagem, botão, card, grid, ícone, divisor) — `card`/`grid` são containers recursivos com `filhos: ComponenteSlide[]`.
- **Limitações conhecidas, ficam para a Onda 3**: sem animações reais (campo `animacao` reservado no schema, não usado), Timeline é só uma lista de camadas por zIndex (sem keyframes), sem undo/redo (histórico completo é Onda 3), zoom não afeta o cálculo de drop da paleta (só o drag/resize dentro do canvas considera o zoom).
- **⚠️ Schema Zod endurecido DEPOIS deste registro (Sage, mesma sessão)**: `src/lib/validations/slide-componentes.ts` ganhou `w`/`h` com `.min(1)` (era `z.number()` puro — permitia tamanho zero/negativo, componente invisível) e um `.refine()` em `dadosSlideSchema` exigindo IDs únicos em toda a árvore (incluindo filhos recursivos de card/grid). Se for reler o schema, ele é ligeiramente mais restrito do que o que Echo implementou originalmente.
- **Testado em browser real (Probe)**: login com credenciais reais, navegação real via clique no card do Dashboard → Editor abriu sem 404/crash, autosave confirmado funcional ("Salvo" → "Salvando..." → "Salvo"), zoom confirmado interativo (100%→125% via clique real). Drag-and-drop físico da paleta pro canvas NÃO pôde ser confirmado por automação (limitação de simular `PointerEvent` sintético contra `@dnd-kit`) — recomendado teste manual humano.

### Módulo Alpha Presentation Studio — Temas + Animações + Timeline (Onda 3, 2026-07-09)
**Arquivo:** editado `RenderEngine/RenderComponente.tsx`, `PainelDireito/PainelPropriedades.tsx`; criados `PainelDireito/camposPorTipo/AnimacaoProps.tsx`, `Timeline/TimelineReal.tsx` (substitui `TimelinePlaceholder.tsx`, removido), `Timeline/useTimelineDrag.ts`, `BarraSuperior/SeletorTema.tsx`
**Tipo:** Client Components
**Notas:**
- **13 tipos de animação de entrada** (fade, slide-up/down/left/right, zoom-in/out, flip, bounce, blur, stagger, typing, counter) aplicados de forma **puramente declarativa** a partir de `componente.animacao?.entrada` — se ausente (dados das Ondas 1/2), renderiza estático, zero regressão.
- **`RenderComponente.tsx` ganhou `TextoAnimado` como componente próprio** para o `case "texto"` — necessário porque os hooks de `typing`/`counter` (`useTypingText`/`useCounterValue`) não podem rodar condicionalmente dentro de um `case` de switch (regra dos hooks do React). `AnimacaoWrapper` genérico cobre os demais 10 tipos via `<motion.div>` declarativo.
- **`typing`**: revela texto caractere a caractere via `useEffect`+`setInterval` (uso legítimo de `useEffect` — sincroniza com o "relógio" da animação, não é fetch). Alternativa CSS `steps()` descartada por exigir fonte monoespaçada.
- **`counter`**: contador numérico via `useMotionValue`/`animate()` imperativo do Framer Motion (não é `initial`/`animate` declarativo simples).
- **`stagger`**: só disponível em `card`/`grid` — anima os filhos em cascata via `staggerChildren` do Framer Motion (`FilhosContainer` interno do RenderComponente).
- **`AnimacaoProps.tsx`** é seção COMUM a todos os tipos (diferente dos `camposPorTipo/*` específicos) — sempre anexada no fim do `PainelPropriedades.tsx`. Mostra campos extras (`staggerDelay`/`velocidadeDigitacao`/`valorFinal`) só quando o tipo de animação selecionado os usa.
- **`TimelineReal.tsx`** substitui o placeholder da Onda 2 (removido do repo) — régua de tempo (0-5s) + barra arrastável de delay/duração por camada, reaproveitando o padrão de mouse-events-próprios de `Canvas/useCanvasDragResize.ts` adaptado para 1 eixo (`Timeline/useTimelineDrag.ts`). Componentes sem animação mostram barra cinza "sem animação".
- **`SeletorTema.tsx`**: modal na Barra Superior, lista temas via `ListarTemas()` (templates do sistema + temas próprios do usuário), aplica via `AplicarTema`. **5 templates seedados no banco real** (Alpha Premium, Dark Glass, Corporate, Minimalista, Apple-style).
- **Tema aplicado ao Canvas via CSS custom properties** (`--tema-cor-primaria/secundaria/accent` em `CanvasArea.tsx`) — infraestrutura disponível, mas **opt-in**: os 7 tipos de componente existentes não foram forçados a usar essas variáveis, continuam com cor explícita se já configurada.
- **GSAP instalado** (`npm install gsap`) nesta onda, decisão do usuário — sem uso de código ainda (Framer Motion cobriu os 13 tipos), disponível para ondas futuras (scroll-triggered, morph de SVG).
- **Limitações conhecidas, ficam para expansão futura**: efeitos avançados do prompt original (morph, glitch, liquid, portal, curtain, book, parallax) não implementados; transições ENTRE slides (`Slide.transicaoEntrada`) ainda sem UI de escolha nem renderização real (depende do Modo Apresentação, Onda 6); câmera virtual não iniciada.
- **⚠️ Lacuna de UX registrada por Lens**: `ComponenteNoCanvas.tsx` (Onda 2) não replica a lógica de `stagger` que `FilhosContainer` dentro do `RenderComponente.tsx` puro ganhou nesta onda — um Card/Grid configurado com animação `stagger` não mostra a cascata visualmente DENTRO do Editor (só vai aparecer no Modo Apresentação/Export, Onda 6, que usa o RenderComponente puro direto). Não é bug, mas é uma lacuna que o usuário vai notar ("configurei stagger e não vejo nada"). **Resolver antes ou durante a Onda 6** — ou fazer `ComponenteNoCanvas` também aplicar stagger visualmente, ou adicionar um preview/aviso explícito no Editor.

### Módulo Alpha Presentation Studio — Componentes 3D (Onda 4, 2026-07-10)
**Arquivo:** `src/components/Apresentacoes/Editor/RenderEngine/{useVisibilidadeIframe.ts,GloboRender.tsx,ParticulasRender.tsx,ObjetoGlbRender.tsx}`, `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/{GloboProps,ParticulasProps,ObjetoGlbProps}.tsx`
**Tipo:** Client Components
**Uso:** integrados via `RenderComponente.tsx` (case `"globo"`/`"particulas"`/`"objeto3d"`) e `PainelPropriedades.tsx` — nunca importados diretamente fora do RenderEngine.
**Notas:**
- **`useVisibilidadeIframe<T>()`** — hook genérico (`{ ref, visivel }`) via `IntersectionObserver`, usado pelos 3 componentes de Canvas para pausar o `frameloop` do R3F (`"always"`/`"never"`) quando o componente está fora de tela dentro do iframe do painel.
- **`GloboRender`** — `props: { componente: GloboComponente }`. Esfera com textura opcional (`useTexture`, protegida por Error Boundary `LimiteDeErroTextura`), marcadores lat/lng convertidos para posição 3D (`latLngParaVetor3`), rotação automática via `useFrame`. Sem `OrbitControls` (removido — competia com drag do canvas 2D).
- **`ParticulasRender`** — `props: { componente: ParticulasComponente }`. `<Points>`/`<PointMaterial>` do drei, posições aleatórias via `useMemo`.
- **`ObjetoGlbRender`** — `props: { componente: Objeto3dComponente }`. `useGLTF` do drei dentro de `Suspense`, protegido por Error Boundary `LimiteDeErroGlb` (mesmo template de `LimiteDeErroTextura`); placeholder de cubo wireframe se `url` vazia ou load falhar.
- **Padrão novo no projeto**: Error Boundary de classe (`LimiteDeErroTextura`/`LimiteDeErroGlb`) — primeira vez que o projeto precisa disso (React não tem hook nativo equivalente). Template minúsculo e reaproveitável: `getDerivedStateFromError` + `componentDidCatch` (log) + render condicional de fallback.
- **`GloboProps`/`ParticulasProps`/`ObjetoGlbProps`** — seguem exatamente o padrão visual/estrutural de `ImagemProps.tsx` (labels + inputs com a mesma classe Tailwind). `GloboProps` tem um mini-editor de lista para `marcadores[]` (adicionar/remover, campos lat/lng/cor).
- **Limitação conhecida**: cada componente 3D monta seu próprio `<Canvas>` R3F independente — WebGL contexts são caros, sem hard-limit de UI para quantos componentes 3D cabem por slide (ver `known-errors.md`).

### ModalGerarComIA (Onda 5, 2026-07-10)
**Arquivo:** `src/components/Apresentacoes/Editor/BarraSuperior/ModalGerarComIA.tsx`
**Tipo:** Client Component
**Props:** `open: boolean`, `onOpenChange: (open: boolean) => void`, `apresentacaoId: string`, `onAplicar: (componentes: ComponenteSlide[]) => void`
**Uso:** `<ModalGerarComIA open onOpenChange={...} apresentacaoId={...} onAplicar={...} />` — montado em `BarraSuperiorEditor.tsx`, aberto pelo botão "Gerar com IA" (ícone `WandSparkles`).
**Notas:**
- Consome `POST /api/apresentacoes/gerar-slide` via `fetch`+`ReadableStream.getReader()` no client, parseando frames `data: {...}\n\n` manualmente (mesmo estilo do server, mas implementação própria no client — 3ª/4ª cópia dessa lógica no projeto, candidata a hook compartilhado `useSSEStream` se um 3º consumidor client-side aparecer).
- Preview do slide gerado renderizado com `RenderComponente` REAL (não uma simulação) — escalado visualmente via CSS `transform: scale()` a partir do tamanho real do canvas (`CANVAS_DIMENSOES`). Funciona também com componentes 3D (R3F renderiza na resolução real do container antes da escala CSS — funciona, mas gasta mais GPU que o necessário para um preview pequeno; não relevante hoje porque os 5 templates de IA só geram texto/imagem/card/grid).
- `AbortController` cancela o fetch em andamento se o modal for fechado no meio da geração.
- **Aplicar ADICIONA os componentes ao slide ativo, nunca substitui** — decisão documentada em `ApresentacaoEditor.tsx` (`handleSlideGeradoAplicado`), consistente com o comportamento de "adicionar componente" já usado no resto do Editor.
- **2 bugs reais encontrados e corrigidos nesta rodada de revisão** (Lens + Sage) — ver detalhe em `integration-points.md` seção Onda 5: (1) fechar o modal não limpava estado local, causando preview/erro "fantasma" ao reabrir; (2) erro HTTP 400/401/403 do backend (resposta JSON simples, não SSE) era silenciosamente ignorado pelo parser de stream, sem feedback ao usuário.

### Alpha Presentation Studio — Frente 1: Expansão de Componentes (24 tipos, 2026-07-10)
**Arquivo:** validações fatiadas em `src/lib/validations/slide-componentes{-base,-basicos,-3d,-dados,-business,-ia}.ts` (+ combinador `slide-componentes.ts`); registry fatiado em `src/components/Apresentacoes/Editor/registry/{registry-tipos,registry-basicos,registry-3d,registry-dados,registry-business,registry-ia,componentes-registry}.ts`; RenderEngine fatiado em `RenderEngine/{nucleo.tsx,RenderComponente.tsx,render/RenderBasicos.tsx,render/RenderDados.tsx,render/RenderBusiness.tsx,render/RenderIA.tsx}`; 14 novos `PainelDireito/camposPorTipo/*.tsx`
**Tipo:** Client Components
**Notas:**
- Motivada por feedback do usuário de que a entrega (10 tipos) estava muito aquém do prompt original (dezenas de tipos pedidos). Biblioteca cresceu de 10 para **24 tipos**, agrupados em 5 categorias na sidebar (`CATEGORIAS_COMPONENTE`, accordion `<details>`/`<summary>` nativo, "Básicos" aberta por padrão).
- **14 tipos novos**: `video` (Básicos), `container` (Básicos — substitui a ideia de Colunas/Stack/Flex separados, único tipo com `layout: "grid"|"flex-row"|"flex-col"|"stack"`, recursivo como `card`/`grid`), `grafico`/`tabela`/`kpi`/`progresso`/`roadmap`/`comparacao`/`faq`/`checklist` (Dados, categoria nova), `grafo`/`diagrama` (Business, categoria nova), `chatIlustrativo` (IA, decorativo).
- **`grafo`** unifica organograma/fluxograma/mapa mental num único tipo (`estilo: "organograma"|"fluxograma"|"mapamental"`, só muda cor/aparência padrão), renderizado via **`@xyflow/react@12.11.2`** (nova dependência) em `RenderBusiness.tsx`. `nodesDraggable={false}`/`nodesConnectable={false}`/`panOnDrag={false}` no preview — é visualização, não editável por drag; edição é via `GrafoProps.tsx` com lista simples de nós/conexões.
- **`diagrama`** unifica SWOT/matriz2x2/pirâmide/funil via `formato`. SWOT/matriz2x2 usam `itens.slice(0, 4)` (mais de 4 itens são ignorados silenciosamente — risco de UX conhecido, não bloqueante). Pirâmide/funil protegidos contra divisão por zero (`itens.length || 1`).
- **`grafico`** usa Recharts (já instalado, mesma lib do resto do projeto) — barra/linha/pizza, gracioso com `dados: []`.
- **Extensão do `globo`** (Onda 4): novo campo `rotas: {origemIndex, destinoIndex, cor?}[]` desenha linha conectando 2 marcadores pelo índice — reaproveita o componente 3D existente para mapas de rotas/comex em vez de criar tipo novo.
- **`nucleo.tsx`**: `FilhosContainer` (usado por `card`/`grid`/`container`) recebe `renderFilho: (filho) => ReactNode` como callback em vez de importar `RenderComponente` diretamente — evita import circular (`RenderComponente.tsx` importa de `nucleo.tsx`).
- **`RenderFaq`** usa `useState` local (`abertoIndex`) para o accordion — estado de interação, não persiste no schema (intencional).
- **SVG só via URL**, nunca inline/`dangerouslySetInnerHTML` — mesma decisão de segurança do tipo `imagem`.
- **⚠️ Dívida técnica que CRESCEU nesta frente (Lens)**: a duplicação de renderização de containers entre `RenderComponente.tsx` (RenderEngine puro) e `ComponenteNoCanvas.tsx` (Editor, com seleção) já existia desde a Onda 2 (Card/Grid). Com o novo tipo `container` (4 variações de `layout`), a mesma lógica condicional de `styleLayout` agora precisa ficar sincronizada em 2 arquivos para 3 tipos de container (card/grid/container) — complexidade de manutenção maior que antes. Candidata a unificação futura (extrair `styleLayout` para função compartilhada, mesmo espírito de `posicionamento.ts` extraído na Onda 6 Fase 1). Ver detalhe em `integration-points.md`.
- **Limitação conhecida (Lens)**: `TabelaProps.tsx` edita colunas/linhas via mini-DSL de texto com separador "|" — frágil se o texto de uma célula contiver "|" literal. Aceitável para v1.
- **Fix aplicado (Sage)**: `GrafoProps.tsx` — `removerNo` agora também filtra `conexoes` que referenciam o nó removido, evitando conexões órfãs acumulando no JSON salvo (o `@xyflow/react` não valida integridade referencial entre `nos`/`conexoes`, apenas ignora silenciosamente arestas órfãs).
- Pipeline completo: Vault (aprovado, sem mudança de schema) → Echo → Forge (tsc/lint/build limpos) → Lens (aprovado, 2 sugestões não-bloqueantes) → Sage (aprovado, 1 fix aplicado) → Scribe.

### formas-pagamento (helpers compartilhados)
**Arquivo:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/formas-pagamento.ts`
**Tipo:** módulo de constantes/função pura (não componente)
**Uso:** `formatarFormaPagamento(valor)` → label legível; `FORMAS_PAGAMENTO`/`FORMAS_LABEL` para dropdowns
**Notas:** Replica (não importa) os mesmos valores usados no Painel de Metas (`ModalGerenciamentoLeads.tsx`) — decisão deliberada de não acoplar CS&NPS ao módulo comercial, já que são domínios diferentes com o mesmo vocabulário de negócio. Usado em `modal.tsx` (cadastro manual) e `modalDados.tsx` (exibição nos cards de "Serviços Contratados").

### DropdownSelecaoComCriacao
**Arquivo:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/DropdownSelecaoComCriacao.tsx`
**Tipo:** Client Component
**Props:** `label: string`, `valorAtual: string`, `opcoes: string[]`, `onSelecionar: (valor: string) => void`, `disabled?: boolean`, `permiteCriarNovo?: boolean`, `placeholder?: string`, `labelDesbloqueio?: string`
**Uso:** `<DropdownSelecaoComCriacao label="Analista Responsável" valorAtual={form.analistaResponsavel} opcoes={listaAnalistas} onSelecionar={(v) => ...} disabled={!editandoDados} permiteCriarNovo />`
**Notas:** Extraído de `modalDados.tsx` (2026-07-13) para evitar triplicar ~50 linhas de JSX (dropdown com opção "criar novo") ao migrar Analista/Embasamento/Origem do Lead para dentro de cada card de "Serviços Contratados" (múltiplos cards por CNPJ). Estilo indigo padrão do CS&NPS. `labelDesbloqueio` mostra um badge pequeno ao lado do label quando `disabled` (ex: "150K/Ilimitado" no campo Embasamento).

### Módulo CS&NPS — mesclagem de registros por CNPJ (2026-07-13)
**Arquivo:** `src/app/PainelAlpha/CadastroClientes/page.tsx` (agrupamento) + `ModalCadastro/modalDados.tsx` (seção "Serviços Contratados")
**Tipo:** Client Components
**Notas:** Primeira vez que este módulo permite múltiplos registros de `clientes` para o mesmo CNPJ (um por serviço contratado — ver `decisions.md` 2026-07-13). `page.tsx` agrupa client-side via `useMemo` (`gruposPorCnpj`), escolhendo o registro de `createdAt` mais recente como "principal" na linha da tabela; badge `Layers` + contagem aparece quando há >1 serviço. `ModalGestaoCliente` (`modalDados.tsx`) recebe agora `cliente` como ARRAY do grupo inteiro (não mais um objeto único) — internamente deriva `cliente = clienteGrupo[0]` (principal, preenche os campos editáveis já existentes) e `outrosServicos`. Nova seção "Serviços Contratados (N)" (só aparece quando há >1 registro) lista cada serviço com status/data individual + card de dados do Painel de Metas (Forma de Pagamento, Valor do Contrato, Closer), resolvidos via `buscarServicoContratadoPorCliente` (Server Action) num `useEffect` disparado pela abertura do modal — não é fetch de rede, é Server Action, padrão já aceito no projeto para popular estado local a partir de props. Campo "Serviço Contratado" também foi reposicionado para o topo do bloco de status/analista/embasamento (pedido do usuário), grid mudou de `xl:grid-cols-6` para `xl:grid-cols-7` com o campo ocupando `xl:col-span-2`.

### CsNpsMotion
**Arquivo:** `src/app/PainelAlpha/CadastroClientes/CsNpsMotion.tsx`
**Tipo:** Client Component
**Props:** `children: ReactNode`, `className?: string`, `delay?: number`
**Uso:** `<CsNpsHero3DCard />`, `<CsNpsSurface3DCard />`, `<CsNpsModal3DShell />` em cards e modais do CS&NPS.
**Notas:** Wrappers Framer Motion de profundidade 3D sutil para dar aspecto vivo ao card principal, tabela e modais do CS&NPS sem alterar lógica de formulário/listagem. Segue o padrão "Aurora Financeira" de tilt leve e entrada spring.

### IAlphaCosmicBackground
**Arquivo:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`
**Tipo:** Client Component
**Props:** `accent: string`, `currentHour: number`
**Uso:** `<IAlphaCosmicBackground accent={tema.accent} currentHour={currentHour} />` dentro de `BibbleChatWindow`.
**Notas:** Sistema solar sideral da página principal do IAlpha. Os 8 planetas partem das **longitudes heliocêntricas reais** do momento do load, calculadas com elementos orbitais keplerianos J2000 do JPL (válidos 1800–2050) — sem API externa. A partir daí o tempo da cena avança acelerado (`ORBIT_TIME_LAPSE = 80000`, padrão planetário) para a órbita ser VISÍVEL: Mercúrio dá a volta em ~1,6min, Terra ~6,6min, Júpiter ~1,3h, Lua orbita a Terra em ~29s; recarregar ressincroniza com o céu real. Tick da cena a cada 2s via `useSyncExternalStore` (SSR renderiza sem planetas) com `transition: left/top 2s linear` interpolando entre ticks (movimento contínuo). Com `prefers-reduced-motion`, o tempo volta a ser real (estático). Realismo por CSS puro: iluminação direcional coerente com o sol da cena (highlight + terminador calculados por `atan2` da posição relativa), texturas procedurais SVG `feTurbulence` inline (tileáveis) com **rotação própria ancorada no relógio real**: períodos siderais reais por planeta (Júpiter 9,93h o mais rápido; Vênus e Urano retrógrados) acelerados por `SPIN_TIME_LAPSE` (1s = 15min simulados), fase determinística de `Date.now()` aplicada via `animation-delay` negativo em keyframes CSS (mesma data/hora → mesma face visível; timeline do documento mantém sincronia mesmo com aba em background), faixas de gás em Júpiter/Saturno com noise anisotrópico, Grande Mancha, anéis de Saturno em gradiente translúcido com divisão de Cassini, nuvens da Terra em camada própria com velocidade diferente, rim atmosférico via `inset box-shadow` apontando para o sol, profundidade por blur+dessaturação+contraste conforme a metade da elipse, estrelas com variação de temperatura de cor. Lua da Terra na fase/ângulo real. Não intercepta cliques, respeita `useReducedMotion`, usa a cor do tema como nebulosa e mantém vinheta central para legibilidade do chat.

### Importação em lote do CS & NPS
**Diretório:** `src/app/PainelAlpha/CadastroClientes/importacao/`
**Tipo:** conjunto de Client Components e helpers puros
**Uso:** `<BotaoImportarLote onImportado={carregarDados} />`, renderizado ao lado das ações administrativas em `page.tsx`.
**Notas:** `BotaoImportarLote` controla somente a abertura. `ModalImportacaoLote` orquestra quatro etapas e concentra os estados de tipos selecionados, arquivo, prévia, destinos escolhidos, linhas mantidas e resultado. `SelecaoTiposImportacao` permite qualquer combinação de Sócios/CS/Feedbacks; `EtapaArquivoImportacao` baixa o modelo e envia o `.xlsx`; `ResumoImportacao` agrupa por empresa/serviço, filtra e renderiza `LinhaImportacaoCard`; cada cartão mostra os dados, mensagens, destino e a ação de remover; `ResultadoImportacao` apresenta totais e linhas de origem por empresa após a transação. O callback `onImportado` recarrega a listagem somente depois do salvamento bem-sucedido.

**Helpers associados:** `api-importacao.ts` encapsula os três contratos HTTP e normaliza respostas de erro; `calculos.ts` recalcula status/totais após escolhas ou remoções e constrói somente linhas válidas para salvar; `constantes.ts` mantém rótulos semânticos. Os contratos compartilhados ficam em `src/lib/cs-nps/importacao-tipos.ts` para que servidor e client concordem sobre tipos, candidatos, status e resumo.

**Regra de destino:** o seletor aparece quando a empresa tem mais de um cadastro/serviço possível. A UI guarda o `clienteId`, mas essa escolha não é considerada autorização; o servidor refaz o matching no `POST /salvar`. Linhas inválidas nunca entram no payload construído por `calculos.ts`, e o botão de confirmação permanece bloqueado enquanto houver linha ambígua ou inválida entre as linhas mantidas.

**Última atualização:** 2026-07-15 por Scribe

### enderecoResumo (helper local)
**Arquivo:** `src/components/Parceiros/ModalPreCadastros.tsx`
**Tipo:** função pura (não componente)
**Uso:** `enderecoResumo(preCadastro)` — monta endereço completo (`logradouro, número - complemento - bairro - cidade/UF`) se os campos estruturados novos estiverem presentes, com fallback para `município/UF` legado.
**Notas:** Usada na listagem de pré-cadastros pendentes para o admin ver o endereço coletado no wizard antes de aprovar.

### Alpha Blueprint (módulo novo, MVP completo, 2026-07-27)
**Arquivo:** `src/components/AlphaBlueprint/` (~25 componentes)
**Tipo:** Client Components (exceto as 2 páginas Server Component em `src/app/PainelAlpha/AlphaBlueprint/`)
**Uso:** `<BlueprintDashboard temaName userId onboardingVisto />` (Dashboard/Kanban) e `<ProjectWorkspace projeto temaName userId />` (workspace interno de 1 projeto).
**Notas:**
- `BlueprintDashboard.tsx` + `BlueprintKanban.tsx` + `BlueprintColumn.tsx` + `BlueprintProjectCard.tsx` — Kanban de 7 colunas (status `ARQUIVADO` fica fora da visão padrão), drag-and-drop via `@dnd-kit` (mesmo padrão do Kanban do CRM, `PipelineClient.tsx`), com **optimistic update** (`onMoverOtimista`) para o card não "saltar de volta" à coluna original durante o round-trip do servidor.
- `ProjectWorkspace.tsx` orquestra 8 abas via estado local (`AbaProjeto`): Visão geral, Especificação, Canvas, Arquivos, Requisitos, Comentários, Assistente IA, Atividade (+ Perguntas acessível via badge de pendências).
- `SpecificationEditor.tsx` — editor Tiptap (`@tiptap/react` + `StarterKit`/`Underline`/`Link`/`Image`/`Placeholder`/`TaskList`/`Table`), toolbar própria, autosave debounce 1.5s, indicador de status (Salvando/Salvo/Pendente/Erro).
- `BlueprintCanvas.tsx` + `CanvasToolbar.tsx` — canvas via `@xyflow/react` em modo totalmente editável (drag/pan/zoom/conectar), autosave com controle de conflito de versão otimista (`version: { increment: 1 }`, rejeita save se `version` client-side estiver desatualizada).
- `ProjectFiles.tsx` + `FileUploadDropzone.tsx` — upload drag-and-drop + colar imagem, preview por tipo (imagem via `next/image unoptimized`, ícone para vídeo/áudio/PDF/outros).
- `RequirementsPanel.tsx`, `QuestionsPanel.tsx`, `CommentsPanel.tsx`, `ProjectActivity.tsx` — CRUD simples por domínio, cada um com seu próprio `useEffect` de carga inicial (padrão `void carregar()` + `// eslint-disable-next-line react-hooks/set-state-in-effect`, ver nota abaixo).
- `BlueprintAIPanel.tsx` — chat contextual, consome `POST /api/blueprint/chat` via `fetch`+`ReadableStream`, parse manual de frames SSE (mesmo estilo de `ModalGerarComIA.tsx` do Apresentation Studio).
- `BlueprintOnboarding.tsx` — tour guiado com spotlight (`data-onboarding="..."` como seletor de ancoragem), 3 passos no MVP (cobre só o Dashboard), progresso via dots, `usuarios.onboarding_blueprint_visto` para persistência de "não mostrar novamente".
- `ProjectMaturity.tsx` — checklist de maturidade da especificação (8 itens), progresso calculado a partir de campos preenchidos/contadores (`_count`), nunca bloqueia o usuário.

**⚠️ Padrão a repetir: `void funcaoAsync(); // eslint-disable-next-line react-hooks/set-state-in-effect`** — a regra de lint do React Compiler (`react-hooks/set-state-in-effect`) bloqueia chamar uma função que faz `setState` diretamente dentro do corpo de um `useEffect`, mesmo através de uma função wrapper (`carregar()`, `carregarDados()`). O fix já era usado em `ApresentacoesDashboard.tsx`/`SeletorTema.tsx` antes deste módulo: prefixar a chamada com `void` E manter o comentário de disable na linha anterior — os dois juntos, não um ou outro.

### Alpha Blueprint — Canvas expandido (melhorias, 2026-07-27)
**Arquivo:** `src/components/AlphaBlueprint/canvas/` (`tipos-node.ts`, `CanvasNodes.tsx`, `CanvasPropertiesPanel.tsx`)
**Tipo:** Client Components
**Notas:**
- 4 nodes customizados do `@xyflow/react` (`textoNode`, `stickyNode`, `formaNode`, `telaNode`) substituindo o `type: "default"` genérico usado no MVP inicial — todos com edição de texto inline (`<textarea>` auto-altura) e `NodeResizer` para redimensionar por arrasto.
- **`CanvasDataChangeContext`** (React Context) é como a edição inline chega até o autosave — nunca usar `useReactFlow().updateNodeData()` aqui, pois não dispara `onNodesChange` (ver `known-errors.md`, achado real desta sessão que quebrava a persistência silenciosamente).
- **Handles nas 4 bordas** (`HandlesQuatroLados`, cada lado com `source`+`target`) são obrigatórios em todo node customizado do xyflow — nodes customizados NÃO herdam os pontos de conexão do `type: "default"` nativo (2ª regressão real encontrada e corrigida nesta sessão, reportada pelo usuário em teste manual). Handles ficam com opacidade 0 e só aparecem no hover (`group-hover`) ou quando o node está selecionado.
- `CanvasPropertiesPanel.tsx` — painel de ajuste (cor, tamanho de fonte, variante de forma, plataforma da tela, duplicar/excluir), inspirado no `PainelPropriedades.tsx` do Apresentation Studio mas adaptado à API nativa do xyflow.
- `CanvasToolbar.tsx` expandida de 5 para 8 ferramentas (Texto, Retângulo, Círculo, Losango, Container/Frame, Sticky, Tela Desktop, Tela Mobile).

### Alpha Blueprint — Background "Mesa de Trabalho" (2026-07-27)
**Arquivo:** `src/components/AlphaBlueprint/BlueprintBackground.tsx` + `src/app/PainelAlpha/AlphaBlueprint/layout.tsx`
**Tipo:** Client Component + Server Component (layout)
**Notas:** Variação temática do padrão "fundo vivo por módulo" (ver `ChecklistBackground.tsx`/`patterns.md`) — grade de papel milimetrado estática + "âncoras" (cotas de medição pulsando) + linhas de régua diagonal + glows accent contidos. Aplicado SOMENTE no `layout.tsx` do módulo — o `BlueprintCanvas.tsx` mantém fundo sólido próprio por decisão explícita do usuário (canvas não deve competir visualmente com os elementos). `BlueprintDashboard.tsx`/`ProjectWorkspace.tsx` tiveram `bg-[#020617]` sólido removido para o background do layout aparecer atrás.

### Alpha Blueprint — Responsáveis e prazo editáveis (2026-07-27)
**Arquivo:** `src/components/AlphaBlueprint/UserSelect.tsx` (novo), `EditProjectDialog.tsx` (novo), `CreateProjectDialog.tsx` (editado)
**Tipo:** Client Components
**Notas:**
- **Achado real:** `ownerId`/`developerId`/`dueDate` já existiam no schema e na Visão Geral (exibidos como "Não definido"), mas nunca tinham campo de preenchimento em lugar nenhum — nem na criação, nem depois. Mesmo problema para `objective`, exibido no checklist de maturidade sem nenhuma UI de edição.
- `UserSelect.tsx` — dropdown compacto reaproveitando `BuscarTodosUsuarios()` (`src/actions/RecursosHumanos.ts`), com cache em memória simples (módulo-level, evita refetch a cada abertura de diálogo) e filtro por `status === "ATIVO"`. Não é o mesmo componente que `ModalSelecionarUsuario.tsx` (CS&NPS) — aquele é um modal de busca acoplado ao 3D shell daquele módulo e retorna `nome` (string), não `id`; o Blueprint precisa do ID para gravar a FK.
- `EditProjectDialog.tsx` — modal de edição de dados gerais (resumo, problema, objetivo, setor, prioridade, os 2 responsáveis, prazo), acionado por um botão "Editar" no card "Sobre o projeto" da Visão Geral. Usa `AtualizarProjetoBlueprint` (já suportava esses campos desde o Echo) e `router.refresh()` para atualizar o Server Component pai sem perder a aba ativa do workspace.
- `dataInputParaDate()` (`tipos.ts`) — helper que interpreta a string `YYYY-MM-DD` de um `<input type="date">` como meio-dia local, evitando o deslocamento de um dia por fuso horário que `new Date("2026-07-30")` puro causaria em fusos negativos.

**Última atualização:** 2026-07-27 por Scribe

### Barra global de abas do Painel Alpha

**Arquivos:** `src/components/layout/TabBar.tsx`, `src/components/layout/PainelLayoutClient.tsx`, `src/lib/painel-tabs.ts`
**Tipo:** Client Components + helpers puros
**Uso:** o layout global mantém uma iframe montada por módulo aberto e renderiza uma aba correspondente na barra superior. Abas não fixadas usam `@dnd-kit/sortable` para reordenação horizontal por ponteiro, toque ou teclado. A ação de fechar é um botão separado da ação de ativar/arrastar.

**Contrato visual do arraste:** a transformação sortable deve manter `y = 0`. O container usa rolagem horizontal e pode recortar a aba se o item ativo acompanhar o deslocamento vertical do ponteiro.

**Persistência:** ordem, abas abertas e aba ativa são armazenadas no `localStorage` após a hidratação, em `painel_alpha_tabs_v2_user_<userId>`. `IAlpha` é sempre normalizada como aba fixa, canônica e primeira. Dados duplicados, externos a `/PainelAlpha` ou malformados são ignorados defensivamente.

**Limite:** o estado acompanha logout/login no mesmo navegador e usuário; não sincroniza entre navegadores ou dispositivos.

**Última atualização:** 2026-08-03 por Scribe

### ContainerCargaRender (Container Alpha animado)

**Arquivos:** `src/components/Apresentacoes/Editor/RenderEngine/ContainerCarga{Render,Model,CameraRig}.tsx`
**Tipo:** Client Component / React Three Fiber
**Props principais:** `componente: ContainerCargaComponente`, `modo: "editor" | "apresentacao"`
**Uso:** registrado como `containerCarga` na categoria 3D do Alpha Presentation Studio e renderizado exclusivamente pelo `RenderComponente` compartilhado. O mesmo modelo também pode ser selecionado como entrada da apresentação sem remover nem exigir uma instância no canvas.

**Notas:** adaptação do container procedural da seção Sobre do site Alpha Comex. Preserva portas com pivôs nas dobradiças, travas, textura corrugada, marca `/A.PNG` e iluminação cinematográfica. O host e o Canvas são transparentes: somente o modelo 3D e a prévia dentro da abertura são renderizados, sem painel ou gradiente atrás do elemento. O componente nasce em 640×360 (16:9, padrão de imagem/vídeo), mas mantém resize livre. A câmera calcula a bounding box real e reage ao tamanho observado pelo R3F, portanto o modelo permanece enquadrado após resize livre e em proporções extremas. No editor, `estadoEditor` alterna preview fechado/aberto; na apresentação, a sequência trava → abertura → zoom ocorre sem intervalo artificial e promove o próximo slide ao terminar. `prefers-reduced-motion` continua respeitado e `useVisibilidadeIframe` pausa o frameloop fora da viewport.

**Propriedades editáveis:** `corPrincipal`, `corMetal`, `corInterior`, `anguloAbertura`, `duracaoAbertura`, `atrasoAbertura`, `mostrarLogo`, `estadoEditor`, além de x/y/w/h/rotação/animação comuns a todos os componentes. Os botões `Centralizar` e `Aplicar 16:9` usam as dimensões reais do canvas ativo; assim, instâncias antigas também podem assumir imediatamente o formato de imagem/vídeo sem serem recriadas.

**Última atualização:** 2026-08-03 por Nova

### EntradaApresentacaoProps (Container Alpha como capa)

**Arquivos:** `src/components/Apresentacoes/Editor/PainelDireito/EntradaApresentacaoProps.tsx`, `src/components/Apresentacoes/ModoApresentacao/EntradaContainerAlphaLayer.tsx`, `src/lib/apresentacoes/entrada-apresentacao.ts`
**Tipo:** Client Components + schema/helper puro
**Uso:** no primeiro slide, desmarque o componente atual ou use o botão `Entrada` do painel direito; selecione `Container Alpha` em “Entrada da apresentação”.
**Notas:** persiste em `dadosJson.entradaApresentacao`, sem migration. O painel mostra uma prévia 16:9 reproduzível e reutiliza `ContainerCargaProps` em modo de entrada para editar cores, ângulo, tempos, zoom, logo e som. No player, a primeira tela já fica montada atrás da capa e também aparece dentro do container; o overlay é removido pelo término real do zoom. O botão de reiniciar reproduz novamente a entrada. O Container Alpha continua disponível normalmente como componente editável da biblioteca.

**Última atualização:** 2026-08-03 por Nova

### CentralCriativaModal (Alpha Presentation Studio)

**Arquivos:** `src/components/Apresentacoes/Editor/CentralCriativa/`, `src/app/api/apresentacoes/assets/route.ts`, `src/actions/apresentacao-assets.ts`, `src/lib/apresentacoes/{assets,canvas,exportacao,remover-fundo}.ts`
**Tipo:** Client Components + Route Handler + Server Action + helpers puros
**Uso:** aberta pelo botão "Central Criativa" da barra superior do editor. Reúne biblioteca de mídias, Brand Kit, formatos responsivos e exportação do slide ativo.

**Biblioteca:** aceita imagem, vídeo, áudio e GLB/GLTF, valida até 50 MB, persiste no `ApresentacaoAsset` existente e insere a mídia no centro do canvas como componente editável. A exclusão verifica permissão e recusa assets ainda usados em slides. A remoção de fundo é local, baseada nas bordas da imagem, e salva o PNG processado como um novo asset.

**Brand Kit:** usa `ApresentacaoTema` existente para nome, cores, fontes e logo. A aplicação atualiza o tema da apresentação; a cor secundária também pode se tornar o fundo do slide ativo.

**Canvas e exportação:** formatos 16:9, 4:3, quadrado, vertical e personalizado são persistidos em `Slide.dadosJson.canvas`. A troca de dimensões escala e reposiciona recursivamente os componentes. O player calcula o enquadramento pelo tamanho real de cada slide. Exporta PNG em 1x/2x/3x e JSON versionado sem os controles do editor. O modal usa um workspace quase fullscreen, cabeçalho compacto, tabs roláveis em telas estreitas e conteúdo com overflow próprio para não ser recortado dentro do iframe do Painel Alpha.

**Compatibilidade:** slides antigos continuam em 1280x720 por fallback. Nenhuma migration ou alteração de schema foi criada.

**Última atualização:** 2026-08-03 por Nova

### ModalReproducaoApresentacao

**Arquivo:** `src/components/Apresentacoes/Editor/ModalReproducaoApresentacao.tsx`
**Tipo:** Client Component / Dialog com player isolado
**Uso:** aberto pelo botão “Apresentar” da barra do Alpha Presentation Studio após salvar o slide ativo.

**Notas:** monta a rota `/apresentar?modal=1` em iframe responsivo dentro de um Dialog. O Dialog sobrescreve explicitamente o limite `sm:max-w-lg` do componente-base e usa uma superfície horizontal 16:9 de até 1440 px, evitando a aparência de celular em telas desktop. O player usa todo o viewport do iframe; a barra de controles é sobreposta na base e não reduz a área da capa. Oferece reiniciar, anterior, pausar/reproduzir, próximo e fechar; Escape dentro do iframe solicita o fechamento ao modal por `postMessage` restrito à mesma origem.

**Camada de capa:** durante a reprodução, `ModoApresentacaoClient` fornece um host absoluto sobre 100% do viewport e `ContainerCargaRender` usa portal para esse host. Assim, o Container Alpha ignora a posição e o tamanho salvos no editor e cobre a apresentação inteira; no editor ele continua inline e livremente redimensionável.

**Composição responsiva:** no player, a câmera ajusta a escala horizontal do modelo ao aspect ratio real do viewport e usa preenchimento de 98,5%, mantendo as bordas visíveis sem deixar o container pequeno. As coordenadas da abertura fullscreen são normalizadas para o canvas lógico antes de revelar o próximo slide. A barra de controles inclui slider para navegação direta por slide.

**Última atualização:** 2026-08-03 por Nova

### Container Alpha — modo introdução
**Arquivos:** `ContainerCargaRender.tsx`, `ContainerCargaCameraRig.tsx`, `SlideApresentacaoLayer.tsx`, `src/lib/apresentacoes/container-intro.ts`, `container-carga-audio.ts`
**Tipo:** Client Components + helpers puros
**Uso:** habilitar "Transição pelo interior" nas propriedades do `containerCarga`; no modo apresentação, a abertura promove o slide seguinte através do recorte interno.

**Notas:** o componente emite `ContainerIntroEvent`, mas não altera a navegação. `ModoApresentacaoClient` mantém o slide anterior e o próximo como irmãos com `key={slide.id}`; o próximo é montado no começo do zoom e preservado quando vira a única camada. A consolidação definitiva do próximo slide é acionada pelo `onComplete` da própria animação de zoom da câmera, sem um segundo temporizador ou callback da animação CSS. A câmera interpola do enquadramento responsivo até o interior. O áudio usa Web Audio procedural com presets `industrial` e `hidraulico`, sem arquivos externos, e degrada silenciosamente quando autoplay for bloqueado.

**Portal interior:** quando existe próximo slide, o plano branco `Transition_Backdrop` é omitido. `ContainerCargaCameraRig` projeta a abertura 3D em pixels, e `ContainerCargaRender` usa esse retângulo para renderizar uma prévia `cover` do próximo slide atrás do Canvas transparente; portas e moldura continuam por cima no WebGL. O mesmo retângulo vira a origem exata do `clip-path` de transição.

**Novas propriedades:** `transicaoProximoSlide`, `duracaoZoom`, `somHabilitado`, `somAbertura`, `volumeSom`. O botão "Centralizar no slide" calcula x/y no palco canônico 1280×720.

**Última atualização:** 2026-08-03 por Nova
