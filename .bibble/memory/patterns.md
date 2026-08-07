# PATTERNS — Padrões de UX e Visual

> Mantido por: Atlas (visual analyst) e Scribe (cartógrafo)
> Registrar padrões descobertos no projeto ou extraídos de sites de referência.

---

## Padrões de Layout

<!-- Adicionar aqui -->

---

## Padrões de Componentes

<!-- Adicionar aqui -->

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
