# Story — Painel Alpha: modo embedded determinístico e handshake por aba

## Status

Ready for Review

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build", "browser-smoke"]

## Story

Como usuário do Painel Alpha, quero que cada módulo aberto em uma aba interna carregue diretamente no modo embutido e só seja exibido quando estiver pronto, para nunca visualizar uma segunda sidebar ou outro shell duplicado durante o primeiro carregamento.

## Contexto e diagnóstico confirmado

O shell externo de `/PainelAlpha` mantém uma iframe por aba e conserva as iframes inativas montadas. Hoje cada iframe abre novamente uma URL sob `/PainelAlpha`; por isso, o HTML inicial da iframe passa pelo mesmo `src/app/PainelAlpha/layout.tsx` e renderiza `PainelLayoutClient`, `GlobalSidebar`, `TabBar` e camadas globais uma segunda vez.

O modo embutido atual não é conhecido no primeiro render. `PainelLayoutClient` inicializa `isEmbedded` como `false` e somente depois da hidratação executa `window !== window.top` em um `useEffect`. Até esse efeito terminar, a iframe pode pintar o shell completo. Em seguida, o ramo `isEmbedded` retorna apenas `children`, fazendo a sidebar interna desaparecer. Abas já abertas normalmente não exibem o problema porque suas iframes continuam montadas e já concluíram essa transição.

Esta story substitui a detecção tardia como fonte primária por um contrato explícito e determinístico de modo embedded no request inicial. O shell externo deve manter cada iframe oculta sob um fallback visual até receber da janela filha, por `postMessage` same-origin, a confirmação de que o conteúdo embedded foi hidratado e está pronto.

`[AUTO-DECISION] accumulated-context.md não existe no repositório → usar o código real, a story de abas persistentes e os mapas .bibble como contexto acumulado (razão: cumprir coerência cross-story sem inventar artefato ausente).`

`[AUTO-DECISION] a URL canônica persistida em PainelTab não deve receber parâmetros internos → derivar a URL embedded somente no atributo src da iframe (razão: preservar deduplicação, restauração, labels, notificações e comparação de rotas existentes).`

`[AUTO-DECISION] o marcador embedded controla exclusivamente composição visual → autenticação, status do usuário e permissões continuam sendo verificadas normalmente (razão: o modo embedded jamais pode se tornar bypass de acesso).`

## Escopo

### Incluído

- modo embedded explícito no request e no primeiro render da iframe;
- supressão determinística do shell interno antes da primeira pintura útil;
- estado de readiness independente por aba;
- handshake filho → pai via `postMessage` same-origin;
- fallback/skeleton compacto enquanto a aba ativa ainda não confirmou readiness;
- timeout defensivo com estado de erro e tentativa novamente;
- limpeza do readiness ao fechar, recarregar ou navegar de forma que recrie a iframe;
- compatibilidade com abas persistidas, reordenáveis e mantidas montadas;
- testes automatizados do contrato e smoke de navegador do primeiro carregamento.

### Fora de escopo

- remoção das iframes ou migração completa para rotas aninhadas;
- alteração funcional dos módulos;
- banco, Prisma, migrations, seeds ou backfills;
- backend, APIs de negócio, Railway ou webhooks;
- mudanças de permissões ou autenticação;
- redesenho da sidebar, da `TabBar` ou da navegação dos módulos.

## Acceptance Criteria

1. Toda iframe criada pelo shell para uma `PainelTab` recebe uma URL de renderização embedded explícita, enquanto `PainelTab.url`, o estado persistido e as comparações de rotas permanecem com a URL canônica sem o marcador interno.
2. O request embedded é reconhecido no servidor antes de renderizar `PainelLayoutClient`; o HTML inicial da iframe não contém `GlobalSidebar`, `TabBar`, notificações globais, onboarding, taskbar global nem o gerenciador de iframes do shell.
3. Acesso direto a qualquer URL canônica de `/PainelAlpha`, sem contexto embedded, continua renderizando exatamente um shell completo e mantém o comportamento atual de autenticação, bloqueio por status e permissões.
4. O marcador embedded não pula `auth()`, `statusPermiteAcessoPainel()`, permissões de módulo, redirects ou qualquer validação de acesso; ele só determina se o shell visual externo será montado.
5. Depois de hidratar no modo embedded, a janela filha envia `ALPHA_EMBED_READY` à janela pai usando `window.location.origin` como `targetOrigin`; a mensagem possui versão de protocolo e informação suficiente para o pai associá-la inequivocamente à iframe/aba emissora.
6. O shell pai aceita readiness somente quando `event.origin === window.location.origin`, `event.source` corresponde ao `contentWindow` da iframe registrada e o payload possui tipo/versão válidos; mensagens cross-origin, malformadas ou emitidas por outra aba são ignoradas.
7. O readiness é mantido por `tab.id`, não por um booleano global: uma aba pronta não libera outra aba ainda carregando, e fechar/recriar/recarregar uma iframe invalida o readiness anterior correspondente.
8. Uma iframe recém-criada ou recarregada permanece visualmente oculta até o handshake. A área de conteúdo apresenta skeleton/loader acessível, sem mostrar sidebar, header, fundo ou conteúdo parcial da iframe.
9. Ao receber o handshake válido da aba ativa, o shell remove o fallback e revela somente a iframe correspondente, sem flash, sobreposição ou mudança lateral causada por uma sidebar interna.
10. Se o handshake não chegar dentro do limite documentado, o usuário recebe um estado de erro compacto com ação “Tentar novamente”; a aplicação não fica eternamente vazia e não revela a iframe incompleta como fallback.
11. Trocar entre abas que já estão prontas é imediato e preserva o estado interno porque as iframes inativas continuam montadas; reordenar, ativar, fechar e restaurar abas após reload continuam funcionando.
12. A home fixa `IAlpha`, Agenda Alpha e módulos que já usam `postMessage` (`ALPHA_BIBBLE_CONTEXT`, `ALPHA_TV_MODE`, mensagens da Agenda e `ALPHA_OPEN_TAB`) continuam funcionando sem colisão de tipos ou regressão de origem/destino.
13. Navegação interna e redirects legítimos dentro de uma iframe preservam o modo embedded durante a vida da aba; um reload da iframe continua iniciando sem shell duplicado e exige novo handshake antes de reaparecer.
14. Não há divergência de hidratação, erro React/Next no console, sidebar duplicada ou layout shift lateral perceptível no primeiro carregamento de um módulo ainda não aberto.
15. Existem testes automatizados para derivação/normalização da URL embedded, reconhecimento do request, validação de mensagens, isolamento do readiness por aba, timeout/retry e preservação das URLs canônicas persistidas.
16. Um smoke em navegador cobre pelo menos: abrir módulo inédito; trocar para aba pronta; abrir duas abas em sequência; fechar durante carregamento; recarregar iframe/rota; restaurar abas persistidas; acesso direto sem embedded; e mensagem falsa/cross-origin rejeitada.
17. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados. Erros introduzidos por esta story são corrigidos, e débitos preexistentes eventualmente encontrados são registrados separadamente com evidência.
18. Nenhum arquivo ou estrutura de banco é alterado.

## Contrato técnico obrigatório

### 1. URL embedded

- Definir em helper puro um marcador reservado do shell, por exemplo `alphaEmbedded=1`; o nome definitivo deve ser único, documentado e coberto por testes.
- O helper deve preservar pathname, query de negócio e hash da URL canônica, substituir marcador duplicado e rejeitar URLs externas ao Painel Alpha.
- `PainelTab.url` permanece canônica. Somente `iframe.src` recebe a URL derivada.
- O marcador não pode aparecer como uma segunda aba nem alterar a chave de persistência/deduplicação.

### 2. Primeiro render determinístico

- O servidor deve receber um sinal inequívoco de que o request é embedded e repassar um booleano inicial ao limite client apropriado.
- A implementação pode usar o middleware existente para transformar o marcador de query em header interno de request, lido no layout, ou solução equivalente comprovadamente server-side no Next.js 16.1.6.
- Se usado header interno, ele deve ser sobrescrito pelo middleware a partir do request atual, nunca confiado cegamente como autorização.
- O layout ainda executa autenticação, status e obtenção das permissões necessárias antes de retornar o conteúdo; apenas os componentes globais do shell deixam de ser montados no ramo embedded.
- Não usar `useEffect`, `useSearchParams()` ou inspeção de `window` como fonte primária para decidir o primeiro HTML. Uma checagem client-side pode existir apenas como defesa/telemetria, sem produzir outra árvore entre SSR e hidratação.

### 3. Protocolo de readiness

Payload conceitual mínimo:

```ts
type AlphaEmbedReadyMessage = {
  type: 'ALPHA_EMBED_READY';
  version: 1;
  frameId: string;
};
```

- O identificador deve ser gerado/associado pelo pai e incluído no contexto da iframe sem contaminar a URL canônica persistida.
- O filho publica readiness uma vez após hidratação; reenvio idempotente é permitido.
- O pai associa a mensagem tanto pelo `frameId` quanto por `event.source === iframe.contentWindow`.
- Todo listener deve ser removido no cleanup.
- `iframe.onload` não equivale a “embedded pronto”; pode iniciar/resetar timeout e verificações, mas somente o handshake libera a exibição.

### 4. Estado visual e recuperação

- Controlar estados por aba: `loading`, `ready` e `error` (ou representação equivalente).
- O fallback deve ocupar somente o content area existente, possuir indicação acessível de carregamento e respeitar `prefers-reduced-motion`.
- Retry deve recriar/recarregar apenas a iframe afetada, reiniciar seu timeout e preservar as demais abas.
- Fechar uma aba durante loading deve remover timer, referência e estado sem atualização tardia de componente desmontado.

## Tasks / Subtasks

- [x] Task 1 — Criar os contratos puros de embedded e readiness (AC: 1, 5–7, 15)
  - [x] Definir constantes/tipos do protocolo e helper de URL no domínio do shell.
  - [x] Preservar queries/hashes canônicos e impedir URL externa/marcador duplicado.
  - [x] Criar validação defensiva do payload sem confiar em `event.data` arbitrário.
- [x] Task 2 — Tornar o modo embedded conhecido no servidor (AC: 2–4, 13–14)
  - [x] Propagar o marcador do request para o layout por mecanismo server-side compatível com Next.js 16.
  - [x] Renderizar somente `children` no ramo embedded desde o primeiro HTML, mantendo auth/status/permissões.
  - [x] Remover a dependência do `useEffect` como decisão primária sem reintroduzir mismatch de hidratação.
- [x] Task 3 — Implementar readiness isolado por aba no shell pai (AC: 5–10)
  - [x] Derivar `iframe.src` embedded a partir da URL canônica e do identificador da iframe.
  - [x] Registrar listener único de `message` com validação de origin, source, versão e frameId.
  - [x] Manter loading/ready/error e timers por `tab.id`, com cleanup em reload/close/unmount.
  - [x] Revelar a iframe somente após handshake válido.
- [x] Task 4 — Implementar fallback e retry acessíveis (AC: 8–10, 14)
  - [x] Reutilizar tokens/componentes visuais existentes para skeleton/loader compacto.
  - [x] Exibir erro por timeout e recarregar apenas a aba afetada no retry.
  - [x] Garantir ausência de layout shift e animação compatível com reduced motion.
- [x] Task 5 — Preservar integrações existentes do shell (AC: 11–13)
  - [x] Verificar home fixa, reordenação, persistência, Agenda, TV mode, open-tab e contexto do Bibble.
  - [x] Garantir que navegação/reload na iframe não retorne ao shell completo.
  - [x] Não sobrescrever alterações paralelas existentes em `PainelLayoutClient.tsx`; integrar sobre o conteúdo atual.
- [ ] Task 6 — Automatizar testes e executar quality gates (AC: 15–18)
  - [x] Cobrir helpers e reducer/máquina de estado do readiness em `tests/layout/`.
  - [x] Adicionar teste de integração do HTML/prop embedded onde o harness atual permitir.
  - [ ] Executar smoke autenticado de navegador e registrar ausência de duplicidade/console errors.
  - [x] Rodar lint, typecheck, testes e build; atualizar checklist, Change Log e File List.

## Dev Notes

### Código existente relevante

- `src/app/PainelAlpha/layout.tsx` é Server Component, autentica com `auth()`, valida usuário/status, carrega permissões/preferências e sempre monta `PainelLayoutClient`. O novo ramo embedded deve preservar as validações e evitar somente o shell visual/global. [Source: `src/app/PainelAlpha/layout.tsx#PainelLayout`]
- `PainelLayoutClient.tsx` detecta iframe em `useEffect` e retorna somente `children` depois que `isEmbedded` muda. Esse intervalo é a causa direta do flash. [Source: `src/components/layout/PainelLayoutClient.tsx#Embedded-detection`; `src/components/layout/PainelLayoutClient.tsx#Embedded-render-children-only`]
- O mesmo componente mantém `Map<tab.id, HTMLIFrameElement>`, já recebe mensagens, cria uma iframe por aba e mantém iframes inativas montadas via `display: none`. Evoluir esse fluxo; não criar segundo gerenciador de abas ou listeners independentes por iframe. [Source: `src/components/layout/PainelLayoutClient.tsx#Tab-state`; `src/components/layout/PainelLayoutClient.tsx#One-iframe-per-tab`]
- `middleware.ts` já cobre as rotas do painel, autentica sessão e protege `/PainelAlpha`; qualquer propagação server-side do modo visual precisa coexistir com esses redirects. [Source: `middleware.ts#middleware`; `middleware.ts#config`]
- `src/lib/painel-tabs.ts` contém tipos, normalização e persistência defensiva. Helpers puros do protocolo/URL podem ficar no mesmo domínio ou em arquivo coeso adjacente; não armazenar readiness no `localStorage`. [Source: `src/lib/painel-tabs.ts#PainelTab`; `src/lib/painel-tabs.ts#parseStoredTabsState`]
- A story `story-painel-abas-reordenaveis-persistentes.md` exige home fixa, isolamento por usuário, restauração e iframes persistentes. Esta story não pode regredir essas garantias. [Source: `docs/stories/story-painel-abas-reordenaveis-persistentes.md#Acceptance-Criteria`]
- O projeto usa Next.js 16.1.6, React 19.2.3, TypeScript, Tailwind e Vitest. Não adicionar biblioteca para implementar mensagem, timer ou máquina simples de readiness. [Source: `package.json#dependencies`; `package.json#scripts`]

### Restrições de segurança

- `alphaEmbedded`/equivalente é dica de apresentação, não autorização.
- Validar simultaneamente `origin`, `source`, `type`, `version` e identificador.
- Usar `window.location.origin`, nunca `'*'`, em `postMessage`.
- Não incluir sessão, role, permissões, tokens ou dados pessoais no payload.
- URLs externas não participam do protocolo de iframe interno.

### Compatibilidade e concorrência de alterações

O worktree já contém mudanças não relacionadas em `PainelLayoutClient.tsx`, especialmente contexto `ALPHA_BIBBLE_CONTEXT`. O executor deve preservar essas mudanças e adaptar o patch ao estado encontrado, sem restaurar o arquivo para uma versão anterior.

### Testing

- Testes puros e de integração do shell ficam em `tests/layout/`, executados por Vitest.
- O helper de URL deve cobrir URL simples, query existente, hash, marcador repetido, home, subrota e URL externa.
- O estado deve cobrir duas abas carregando fora de ordem, mensagem repetida, source incorreto, origin incorreta, aba fechada antes da mensagem, timeout e retry.
- Smoke de navegador deve observar o DOM da janela filha desde a navegação inicial; verificar apenas o estado final não detecta o flash que motivou a story.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Frontend
**Secondary Type(s):** Architecture, Integration, Security
**Complexity:** Medium/High — altera o shell global, SSR/hidratação, múltiplas iframes persistentes e protocolo entre janelas.

### Specialized Agent Assignment

**Primary Agents:**

- @dev
- @ux-expert

**Supporting Agents:**

- @architect
- @qa
- @github-devops para PR/deploy, quando solicitado

### Quality Gate Tasks

- [ ] Pre-Commit (@dev): validar SSR/hidratação, URL canônica, cleanup de listeners/timers e testes de protocolo.
- [ ] Pre-PR (@github-devops): revisar compatibilidade do middleware/layout e regressões do shell/abas.
- [ ] Pre-Deployment (@github-devops): smoke autenticado no ambiente-alvo e confirmação de rollback, se houver deploy.

### Self-Healing Configuration

**Expected Self-Healing:**

- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior:**

- CRITICAL issues: auto-fix.
- HIGH issues: documentar; encaminhar para QA em full mode quando afetarem segurança, hidratação ou navegação.

### CodeRabbit Focus Areas

**Primary Focus:**

- ausência de mismatch SSR/cliente e flash do shell interno;
- validação estrita de `postMessage` e impossibilidade de liberar aba errada;
- cleanup de timer/listener/ref ao fechar ou recarregar aba;
- preservação das URLs canônicas e da persistência existente.

**Secondary Focus:**

- acessibilidade do loading/erro/retry;
- regressões em Agenda, Bibble, TV mode e abertura de abas;
- nenhuma autorização baseada no marcador embedded;
- ausência de dependência ou mudança de banco.

## Checklist de conclusão

- [ ] Todos os Acceptance Criteria possuem evidência objetiva.
- [ ] Primeiro HTML embedded inspecionado sem shell duplicado.
- [ ] Acesso direto inspecionado com um único shell completo.
- [x] Handshake validado por origin, source, versão e frameId.
- [x] Loading, timeout, retry e fechamento durante loading testados.
- [x] Abas persistidas/reordenadas e mensagens existentes testadas.
- [ ] Console sem erros introduzidos e sem hydration mismatch.
- [x] `npm run lint` executado.
- [x] `npm run typecheck` executado.
- [x] `npm test` executado.
- [x] `npm run build` executado.
- [x] File List final atualizada pelo executor.
- [x] Nenhum arquivo de banco alterado.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-15 | 1.0 | Story criada a partir do diagnóstico da sidebar duplicada e da decisão por embedded determinístico com handshake por aba. | River |
| 2026-09-15 | 1.1 | Embedded server-side, handshake versionado, readiness por aba, timeout/retry, hardening de mensagens e testes implementados. | Nova / Codex |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run typecheck -- --pretty false`: executado com 8 GB; manteve erros preexistentes em ExclusaoFiscal, Gerador de Documentos, arquivo `.orig`, Radar e Alpha Explorer; nenhum diagnóstico nos arquivos desta story.
- `npm run lint`: executado com 8 GB; baseline global preexistente falha por incluir `.agents`, `.aiox-core` e código legado. Lint direcionado aos arquivos da story passou sem erros ou warnings.
- `npm test`: 412 arquivos passaram, 12 falharam (20 testes preexistentes fora do escopo); suíte direcionada passou com 16/16 testes.
- `NEXT_DIST_DIR=.next-embedded-verify npm run build`: passou; diretório temporário removido após a validação sem tocar no `.next` do stage.

### Completion Notes List

- O middleware remove headers embedded fornecidos pelo cliente e os recalcula a partir do request atual.
- O layout autentica e valida status/permissões antes de entregar o ramo content-only.
- Cada iframe usa URL derivada, `frameId` por tentativa e só fica visível após handshake válido.
- Reload e navegação são revalidados pelo pai no `onLoad`; documento sem marcador entra novamente em loading/timeout.
- Mensagens antigas do shell passaram a recusar origem externa, e `openTab` recusa URLs fora de `/PainelAlpha`.
- Smoke autenticado ficou pendente porque esta sessão não recebeu credenciais; o build de produção e os testes comportamentais do contrato passaram.

### File List final

- `docs/stories/story-painel-modo-embedded-handshake-abas.md` (criado/atualizado)
- `middleware.ts` (atualizado)
- `src/app/PainelAlpha/layout.tsx` (atualizado)
- `src/components/layout/PainelLayoutClient.tsx` (atualizado preservando mudanças concorrentes)
- `src/components/layout/PainelEmbeddedReady.tsx` (criado)
- `src/components/layout/PainelFrameFallback.tsx` (criado)
- `src/lib/painel-embedded.ts` (criado)
- `tests/layout/painel-embedded.test.ts` (criado)
- `.bibble/memory/components.md` (catálogo atualizado)

## QA Results

Gate arquitetural: PASS após correção da revalidação no `iframe.onload`. Risco residual não bloqueante: encerramento abrupto pode não emitir `beforeunload`, mitigado pela validação do marcador same-origin no próximo `onLoad`.

## Story Draft Checklist Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Causa, resultado e limites estão explícitos. |
| Technical Implementation Guidance | PASS | Contratos de URL, primeiro render, handshake e estado por aba estão definidos sem exigir biblioteca nova. |
| Reference Effectiveness | PASS | Referências apontam para arquivos e seções diretamente envolvidos. |
| Self-Containment Assessment | PASS | Termos, riscos, edge cases e coexistência com mensagens existentes estão explicados. |
| Testing Guidance | PASS | Há cenários unitários, integração, navegador e gates mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos. |

**Final Assessment:** READY — clareza 9/10. A story pode ser implementada sem decisão adicional do usuário. A única decisão interna permitida é o mecanismo server-side compatível com Next.js para propagar o marcador; ele precisa satisfazer integralmente os AC 2–4 e ser coberto por teste.
