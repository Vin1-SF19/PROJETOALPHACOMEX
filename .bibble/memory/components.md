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

### enderecoResumo (helper local)
**Arquivo:** `src/components/Parceiros/ModalPreCadastros.tsx`
**Tipo:** função pura (não componente)
**Uso:** `enderecoResumo(preCadastro)` — monta endereço completo (`logradouro, número - complemento - bairro - cidade/UF`) se os campos estruturados novos estiverem presentes, com fallback para `município/UF` legado.
**Notas:** Usada na listagem de pré-cadastros pendentes para o admin ver o endereço coletado no wizard antes de aprovar.
