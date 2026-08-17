# PATTERNS — Padrões de UX e Visual

> Mantido por: Atlas (visual analyst) e Scribe (cartógrafo)
> Registrar padrões descobertos no projeto ou extraídos de sites de referência.

---

## Padrões de Layout

<!-- Adicionar aqui -->

---

## Padrões de Componentes

### Accordions → Tabs no painel esquerdo do card BPM
**Estreado em:** `PainelHistorico.tsx` (AlphaCRM/CardModal, 2026-08-15).

Quando um painel empilha múltiplos blocos de conteúdo relacionado mas mutuamente exclusivo (o usuário só quer ver um de cada vez, não vários simultaneamente), preferir `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`@/components/ui/tabs`, shadcn/Radix) a múltiplos `<details>` empilhados — troca "revelar tudo com scroll único" por "1 conteúdo visível por vez, navegação por clique". `Tabs value={x} onValueChange={setX}` sempre controlado (nunca não-controlado). Badge de contagem no `TabsTrigger` (`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300`, condicional a `count > 0`) substitui o badge que existia no header do accordion antigo. Cada `TabsContent` recebe `min-h-0 lg:h-full lg:overflow-y-auto` próprio — o scroll deixa de ser da coluna inteira e passa a ser por aba ativa; a `Tabs` raiz e o container pai precisam manter a cadeia de `min-h-0`/`flex` para o overflow funcionar em flexbox aninhado. Um subcomponente com título/accordion próprio (ex: `PainelResumoEtapas`, que já tinha seu accordion interno por item) ganha uma prop opcional (`ocultarTitulo`) para suprimir o cabeçalho duplicado quando o título passa a ser o label da própria aba — o accordion interno dele continua intocado, só o wrapper de título externo é condicional. Um helper de accordion pré-existente (`SectionCard`) que ainda serve outro consumidor no mesmo arquivo NUNCA deve ser removido só porque um novo consumidor parou de usá-lo — verificar todos os `import` antes de apagar.

Bloco de ação/estado sempre-visível e não mutuamente exclusivo com o resto (ex: requisitos de avanço da etapa atual) fica FORA da nova `Tabs`, como irmão fixo antes dela — não é candidato a virar aba só porque as abas vizinhas migraram.

### Accordion de ação em destaque (rodapé sticky com `<details>` + badge accent)
**Estreado em:** `PainelRegistrar.tsx` (AlphaCRM/CardModal, painel de Anotação, 2026-08-15).

Para um bloco de ação secundária que precisa (a) chamar atenção visualmente e (b) não ocupar espaço fixo na tela: usar `<details className="group">` no lugar de `div` estático. O `<summary>` funciona como "botão" — vira um badge pill com `background: linear-gradient(110deg, rgba(accent,0.4), rgba(accent,0.15))`, borda `rgba(accent,0.55)` e `boxShadow` de glow (`0 6px 18px -10px rgba(accent,0.9)`), mais um `ChevronDown` com `group-open:rotate-180`. O container recebe `border-t-2` + gradiente de fundo na cor do accent (`linear-gradient(180deg, rgba(accent,0.12), rgba(2,6,23,0.92) 65%)`) para se destacar do resto do painel. Fechado por padrão (sem atributo `open`). Ação de salvar usa botão explícito (`disabled` quando vazio/salvando) em vez de auto-save no `onBlur` — mais prevísivel para o usuário quando o campo está dentro de um accordion.

### Feed de histórico mesclado (eventos de sistema + conteúdo do usuário)
**Estreado em:** `PainelHistorico.tsx` (AlphaCRM/CardModal, seção "Histórico", 2026-08-15).

Quando uma ação do usuário (ex: Anotação) já gera uma entrada genérica em `BpmCardHistorico` (via `registrarHistoricoCard`) E os dados completos existem em outra tabela (ex: `BpmInteracaoCard`), não duplicar a exibição: filtrar a entrada genérica do histórico (`h.acao !== "ANOTACAO_REGISTRADA"`) e mesclar os itens ricos no mesmo array, normalizados para um tipo comum (`{ tipo, id, data, ... }`), ordenados por data desc. Cada tipo tem sua própria renderização (evento simples = 1 linha cinza; anotação = card com borda/fundo accent, ícone e texto completo), mas convivem na mesma lista cronológica em vez de seções separadas.



---

## Padrões de Animação

### Fundo vivo por módulo (padrão "1 background dedicado por layout.tsx")
**Estreado em:** CheckList (`ChecklistBackground.tsx`, céu estrelado + parallax) — **variação própria em:** Habilitação Radar (2026-07-21, `RadarBackground.tsx`, "Varredura Sonar").

Cada módulo pode ter seu próprio fundo animado com identidade visual própria, aplicado via `layout.tsx` da rota (não afeta o resto do painel). Regra: 100% Framer Motion + CSS (`conic-gradient`, `radial-gradient`), sem canvas/WebGL/Three.js — fundo é decorativo, não vale o custo de GPU. Sempre usa `accentRgb`/`visual.accent` do tema ativo do usuário (`src/lib/temas.ts`), nunca cor fixa. Sempre respeita `useReducedMotion()`.

**Variante "Varredura Sonar" (Habilitação Radar):** anéis concêntricos fixos em `rgba(${accent},0.06-0.12)` + linha de sweep rotativa via `conic-gradient(from Xdeg, transparent, rgba(${accent},0.25), transparent)` girando em loop linear (~6s) + blips (pontos) que picam opacidade 0→1→0 sincronizados com a passagem do sweep. Cards da tela ganham uma linha de scan vertical (accent) que desce no hover, simulando leitura/scanner de documento.

**Variante "Mesa de Trabalho" (Alpha Blueprint, 2026-07-27):** grade de papel milimetrado (2 escalas, 24px fina + 120px grossa, `rgba(255,255,255,0.025)`, ESTÁTICA — sem animação, é o elemento de "estrutura") + "âncoras" (círculos concêntricos tipo cota de desenho técnico, 8-12 unidades, pulso de opacidade lento e dessincronizado) + 1-2 linhas de "régua" diagonal sutis (`rgba(accent,0.08)`) como assinatura visual única do módulo + 2 glows radiais mais contidos que o padrão CheckList (`50vw/50vh` em vez de `70vw/70vh` — "luz de mesa", não "luz cósmica"). **Regra importante desta variante:** aplicado SOMENTE no `layout.tsx` do módulo (fora do Canvas em si) — o Canvas mantém fundo sólido `bg-[#020617]` próprio, nunca o background vivo atrás da área de trabalho com os elementos (decisão explícita do usuário, para não competir com a leitura dos nodes/conectores).

## Canvas do Alpha Blueprint — biblioteca de 38 tipos de elemento (2026-07-27)

Categorias colapsáveis (`<details>`/`<summary>`, mesmo padrão de `CATEGORIAS_COMPONENTE` do Apresentation Studio): **Básicos** (texto, sticky, container), **Formas** (retângulo, círculo, losango, triângulo, hexágono, estrela), **Linhas** (linha reta, seta), **Fluxograma** (início/fim, decisão, entrada/saída, conector, documento, banco de dados, subprocesso), **Wireframe** (botão, input, checkbox, radio, select, card, tabela, navbar, sidebar, imagem), **Anotações** (nota, alerta, check, x, numeração, tag, balão de comentário), **Telas** (desktop, mobile).

**Losango real (não gambiarra de quadrado rotacionado):** `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`. Como `clip-path` não permite `border` acompanhar o contorno poligonal, seleção/hover usam variação de `background`/`drop-shadow` em vez de borda. Mesmo princípio vale para triângulo/hexágono/estrela (todos via `clip-path`, não rotação de retângulo).

**Piso de redimensionamento universal:** `NodeResizer` com `minWidth={24} minHeight={24}` em todos os tipos, exceto Tela Desktop/Mobile (mínimo maior, 80/60, para preservar sentido de wireframe) e Linha Reta (`minHeight={2}`, propositalmente fininha).

---

## Padrões de Conteúdo

<!-- Adicionar aqui -->

---

## Estados vazios/erro parametrizados (novo padrão, Gestão de Comissões e Prêmios, 2026-07-28)

Componente único `EstadoVazioComissoes.tsx` parametrizado por `tipo` (`"sem-eventos" |
"sem-regra" | "integracao-indisponivel" | "divergencia" | "erro-exportacao" |
"erro-pagamento" | "dados-incompletos"`) — ícone lucide + título + descrição + identificador
técnico SEMPRE visível (`<code className="text-xs text-slate-500">`, nunca escondido atrás de
mensagem genérica) + botão de ação quando aplicável. Reaproveitável em qualquer módulo
financeiro/operacional futuro que precise de múltiplos estados vazios/erro parametrizados em
vez de 1 componente por estado.

---

## Guia Inteligente de Módulo (Bibble + tour de primeira visita)

**Estreado em:** Parceiros, 2026-08-07.
**Frase de ativação futura:** “Adicione o Guia Inteligente neste módulo.”

Funcionalidade reutilizável formada por três partes:

1. **Manual operacional sob demanda:** o módulo descreve suas funções em um catálogo tipado, dividido por tópicos e aliases. O Bibble consulta apenas o tópico necessário por uma tool somente leitura; o manual completo não é enviado em todas as mensagens.
2. **Tour sequencial de primeira visita:** spotlight ancorado por atributo `data-guia-*`, tooltip com Pular/Voltar/Avançar/Concluir, progresso, Escape, atualização em scroll/resize e `prefers-reduced-motion`.
3. **Replay:** botão “Tutoriais” reabre o tour sem apagar a preferência já gravada.

Persistência padrão: `localStorage` isolado por `usuarioId + módulo + versão`, no formato `painelalpha:guia-modulo:<modulo>:v<versao>:usuario:<id>`. Aumentar a versão reexibe o tour quando houver mudança material. Como a persistência é local, não sincroniza entre navegadores/dispositivos e não exige migration. Passos cujo seletor não exista por permissão ou estado da tela são removidos automaticamente.

**Referência visual real:** `AlphaBlueprint/BlueprintOnboarding.tsx`. Gestão de Comissões e Prêmios não possui tour sequencial no checkout de 2026-08-07; não citá-la como implementação de código até que isso mude.

**Última atualização:** 2026-08-07 por Scribe
