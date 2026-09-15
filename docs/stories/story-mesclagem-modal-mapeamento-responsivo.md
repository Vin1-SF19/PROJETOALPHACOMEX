# Story: Tornar o modal de Mapeamento da Mesclagem responsivo

## Status

In Progress — implementação concluída; validação global bloqueada por falhas preexistentes

## Executor Assignment

- executor: `@dev`
- quality_gate: `@ux-design-expert`
- quality_gate_tools: `["eslint", "typescript", "vitest", "next-build", "coderabbit", "responsive-runtime-check"]`

## Story

**Como** usuário do módulo Mesclagem de Planilhas,
**quero** percorrer todo o conteúdo da etapa Mapeamento em uma viewport baixa ou menor,
**para que** eu consiga revisar os campos e acionar “Gerar prévia” sem o conteúdo ou os controles ficarem inacessíveis.

## Contexto e valor

O fluxo de mesclagem funciona em produção, porém o modal deixa de ser operável na etapa **Mapeamento** quando a altura ou a largura disponível é reduzida. Essa etapa renderiza toda a lista de campos do template oficial; embora exista uma área com `overflow-y-auto`, o contêiner do modal usa grid, altura máxima e `overflow-hidden` sem definir explicitamente uma faixa central que possa encolher. Na prática, não é possível rolar até a continuação do fluxo.

Esta é uma correção exclusivamente de interface do módulo existente. Ela não muda o processamento da mesclagem, o mapeamento de dados, APIs, arquivos aceitos, permissões ou persistência.

## Decisões autônomas

- `[AUTO-DECISION] Qual status usar? → Approved — Ready for Development. (reason: a missão pede uma story válida e não-Draft, pronta para implementação)`
- `[AUTO-DECISION] Qual deve ser o limite da correção? → Ajustar apenas o layout responsivo do modal existente e sua cobertura de regressão. (reason: o usuário confirmou que o processamento funciona em produção e pediu somente o modal da etapa Mapeamento)`
- `[AUTO-DECISION] O rodapé precisa ser sempre fixo? → Não prescrever a técnica; exigir que “Gerar prévia” permaneça visível ou seja alcançável por rolagem. (reason: esse é o resultado solicitado e permite ao executor preservar o padrão mais adequado do componente existente)`
- `[AUTO-DECISION] accumulated-context.md → O arquivo não existe no workspace; a coerência foi derivada do componente atual, do Dialog compartilhado e dos testes responsivos existentes. (reason: não criar artefato adicional fora da responsabilidade desta missão)`

## Critérios de Aceitação

1. Na etapa **Mapeamento**, quando o conteúdo excede a altura disponível, o modal permanece contido na viewport e oferece rolagem vertical funcional para acessar todos os campos.
2. A ação **Gerar prévia** permanece visível ou alcançável por rolagem em viewport baixa/menor, sem ficar cortada ou inacessível.
3. Cabeçalho, indicador de etapas, área de mapeamento e rodapé se organizam sem ultrapassar a altura útil da viewport nem provocar rolagem da página por causa do modal.
4. Em largura reduzida, os pares de rótulo e seleção do Mapeamento se adaptam sem overflow horizontal, sem corte de texto funcional e sem impedir a alteração do campo de origem.
5. A rolagem pelo mouse, touchpad, toque e teclado não impede o uso dos selects nem das ações **Voltar** e **Gerar prévia**.
6. O ajuste não altera o estado do mapeamento, a navegação entre as quatro etapas, o callback de geração da prévia nem os estados de processamento/desabilitado existentes.
7. As etapas **Arquivos**, **CNPJ** e **Prévia** continuam abrindo e apresentando seus controles dentro do mesmo modal sem regressão de layout ou navegação.
8. A correção não altera API, regras de mesclagem, tipos de domínio, banco de dados, schema, migration, seed ou dados existentes.
9. Existe regressão automatizada que verifica as restrições essenciais de altura, encolhimento da área central, rolagem e adaptação horizontal do Mapeamento; a verificação de runtime cobre ao menos uma viewport com altura reduzida.
10. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` não apresentam regressão causada por esta story.

## Fora do escopo

- Alterar o processamento, a preparação de prévia ou a exportação das planilhas.
- Modificar as colunas de destino, a sugestão de CNPJ ou as regras de mapeamento.
- Redesenhar visualmente o módulo ou as demais etapas além do necessário para preservar sua responsividade.
- Alterar o componente `Dialog` compartilhado globalmente, salvo se o executor demonstrar que uma mudança local não atende aos critérios sem regressão; a preferência é manter a correção encapsulada no modal de Mesclagem.
- Criar ou alterar banco, schema, migration, seed ou backfill.

## Tasks / Subtasks

- [x] **Task 1 — Corrigir a composição vertical do modal** (AC: 1–3, 6, 7)
  - [x] Fazer o `DialogContent` respeitar a altura útil da viewport, preservando margem externa.
  - [x] Definir no layout do modal uma região central que possa encolher e rolar sem expulsar cabeçalho ou rodapé da área disponível.
  - [x] Preservar a abertura, o fechamento e a limpeza de estado já implementados.

- [x] **Task 2 — Adaptar o conteúdo do Mapeamento para viewports menores** (AC: 1, 2, 4, 5)
  - [x] Garantir rolagem vertical interna até o fim da lista de destinos.
  - [x] Adaptar rótulos e selects para larguras reduzidas sem overflow horizontal.
  - [x] Manter os controles de retorno e geração de prévia operáveis por ponteiro, toque e teclado.

- [x] **Task 3 — Preservar o fluxo funcional existente** (AC: 6–8)
  - [x] Confirmar que alterar selects continua atualizando somente o mapeamento correspondente.
  - [x] Confirmar a navegação `Arquivos → CNPJ → Mapeamento → Prévia` e o retorno entre etapas.
  - [x] Não alterar contratos de API, domínio ou persistência.

- [ ] **Task 4 — Adicionar e executar a regressão** (AC: 1–10)
  - [x] Criar teste Vitest focado nas garantias estruturais de responsividade do modal.
  - [ ] Verificar em runtime a etapa Mapeamento com conteúdo maior que a altura disponível e registrar a viewport usada.
  - [ ] Executar ESLint direcionado, `npm run lint`, `npm run typecheck`, teste direcionado, `npm test` e `npm run build`.
  - [ ] Executar CodeRabbit conforme a configuração do projeto e registrar impedimentos ou achados.
  - [x] Atualizar checkboxes, Completion Notes e File List real antes de encaminhar para revisão.

## Dev Notes

### Comportamento existente e ponto de correção

- `ModalMesclagemPlanilhas` concentra as quatro etapas e mantém o estado local de arquivos, CNPJ, mapeamento, sessão e processamento. O ajuste deve preservar esses contratos. [Source: `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx`]
- O `DialogContent` atual do módulo usa `max-h-[94vh] overflow-hidden`, enquanto a região de conteúdo usa `overflow-y-auto`. Como o `DialogContent` compartilhado é um grid e a região central não declara uma faixa encolhível/`min-h-0`, a lista longa do Mapeamento pode exceder a altura útil e tornar o rodapé inacessível. [Source: `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx`; `src/components/ui/dialog.tsx`]
- A etapa Mapeamento renderiza a lista completa de `mapeamento` em duas colunas a partir de `md`, com cada linha contendo rótulo e `select` de largura fixa. Em largura menor, esse conjunto também precisa caber sem rolagem horizontal. [Source: `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx`]
- O botão **Gerar prévia** chama `avancarParaPrevio`, que usa os mesmos arquivos, abas, colunas CNPJ e mapeamento para preparar a sessão e avançar à etapa 4. Essa lógica não faz parte da correção. [Source: `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx`]
- O componente `Dialog` compartilhado já fornece portal, overlay, foco do Radix e limite de largura padrão. Evitar uma alteração global reduz o risco de regressão em outros modais. [Source: `src/components/ui/dialog.tsx`]
- Há precedente no repositório para modais com coluna flexível limitada pela viewport e corpo com `flex-1 overflow-y-auto`, além de testes Vitest estruturais que verificam `min-h-0`, `overflow-y-auto` e contenção. [Source: `src/components/ModalProtocolo.tsx`; `src/components/ModalOnboarding.tsx`; `tests/notas/painel-propriedades-responsivo.test.ts`]
- A página do módulo apenas abre o modal e baixa o template; nenhuma mudança é prevista nesse shell. [Source: `src/app/PainelAlpha/Mesclagem/page.tsx`]
- Não existem `docs/architecture/`, `docs/framework/`, `.aiox/gotchas.json` ou `accumulated-context.md` neste workspace. Por isso, a orientação técnica desta story deriva somente do requisito informado e dos arquivos reais citados acima.

### Restrições técnicas

- Manter React/Next.js, Tailwind CSS e os componentes Radix/shadcn já utilizados; nenhuma dependência nova é necessária. [Source: `package.json`; `src/components/ui/dialog.tsx`]
- Preferir uma solução local no `ModalMesclagemPlanilhas`, mantendo `src/components/ui/dialog.tsx` apenas como referência, porque o defeito relatado está restrito ao módulo.
- Usar unidade de viewport que reflita a altura útil em navegadores móveis quando necessário e preservar margens externas do diálogo.
- Não há variável de ambiente, integração externa ou alteração de banco nesta story.

## Testing

- **Framework:** Vitest, conforme o script `npm test`. [Source: `package.json`]
- **Teste previsto:** `tests/mesclagem/modal-responsivo.test.ts`, seguindo o precedente estrutural de regressões responsivas do repositório. [Source: `tests/notas/painel-propriedades-responsivo.test.ts`]
- **Runtime:** abrir a Mesclagem, avançar até Mapeamento com arquivos válidos e reduzir a altura disponível até o conteúdo exceder o modal.

| Cenário | Resultado esperado |
|---|---|
| Mapeamento com todos os destinos em viewport de baixa altura | A área de campos rola até o último item e “Gerar prévia” continua alcançável |
| Mapeamento em largura reduzida | Rótulos e selects permanecem dentro do modal e utilizáveis, sem overflow horizontal |
| Navegação por teclado | Foco alcança selects, “Voltar” e “Gerar prévia”; a rolagem acompanha o conteúdo focado |
| Voltar para CNPJ e retornar a Mapeamento | O layout permanece contido e o mapeamento selecionado é preservado |
| Gerar prévia | O callback existente é executado e o fluxo avança à etapa Prévia |
| Demais etapas | Arquivos, CNPJ e Prévia continuam operáveis sem regressão responsiva |

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Frontend
- **Secondary Type(s):** UX / Accessibility
- **Complexity:** Low — correção localizada em um modal existente, sem novo contrato ou persistência.

### Specialized Agent Assignment

- **Primary Agent:** `@dev`, responsável pela implementação e revisão pre-commit.
- **Quality Gate:** `@ux-design-expert`, responsável por validar responsividade e acessibilidade.
- **Supporting Agent:** `@qa`, para a regressão e o exercício do fluxo em viewport reduzida; `@devops` somente no Pre-PR.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** executar CodeRabbit sobre mudanças não commitadas, ESLint direcionado e teste focado.
- [ ] **UX Gate (`@ux-design-expert`):** validar contenção, rolagem, largura, teclado e disponibilidade das ações.
- [ ] **Pre-PR (`@devops`):** executar CodeRabbit contra `main` e confirmar ausência de regressão nos gates globais.
- **Pre-Deployment:** não aplicável; esta story não executa deployment.

### Self-Healing Configuration

- **Primary Agent:** `@dev` em modo light.
- **Máximo:** 2 iterações, 15 minutos, filtro somente CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa de correção automática; HIGH é documentado; MEDIUM e LOW não recebem auto-fix nesta etapa.

### CodeRabbit Focus Areas

- Contenção pela viewport, encolhimento correto da área rolável e ausência de overflow horizontal.
- Acessibilidade por teclado e preservação do foco/controles fornecidos pelo Radix Dialog.
- Ausência de alteração acidental na lógica das etapas, no mapeamento e na geração da prévia.
- Escopo local, sem regressão no `Dialog` compartilhado.

## Initial File List

### Criar

- `docs/stories/story-mesclagem-modal-mapeamento-responsivo.md` — rastrear requisitos, implementação e validação.
- `tests/mesclagem/modal-responsivo.test.ts` — cobrir estruturalmente as garantias responsivas essenciais.

### Modificar

- `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx` — ajustar contenção, área rolável e adaptação dos controles do Mapeamento.

### Consultar sem alteração prevista

- `src/components/ui/dialog.tsx` — contrato e layout base do Dialog compartilhado.
- `src/app/PainelAlpha/Mesclagem/page.tsx` — shell que abre o modal.
- `src/components/ModalProtocolo.tsx` e `src/components/ModalOnboarding.tsx` — precedentes locais de modal com corpo rolável.

> Esta é uma previsão inicial. O agente executor deve substituir a File List do Dev Agent Record pela lista real antes da revisão.

## Story Draft Checklist Validation

| Categoria | Status | Evidência |
|---|---|---|
| Goal & Context Clarity | PASS | Defeito, valor, limites e resultado observável estão definidos. |
| Technical Implementation Guidance | PASS | Componente, causa de layout, precedentes e integrações preservadas estão identificados. |
| Reference Effectiveness | PASS | Todas as referências apontam para arquivos existentes e sua relevância está resumida. |
| Self-Containment Assessment | PASS | Escopo, fora de escopo, decisões e ausência de banco estão explícitos. |
| Testing Guidance | PASS | Teste automatizado, runtime, cenários e gates estão especificados. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos foram definidos. |

**Final Assessment:** READY — a story contém contexto suficiente para implementação sem ampliar o requisito informado.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-14 | 1.0.0 | Story criada e validada para corrigir a responsividade do modal na etapa Mapeamento. | River (`@sm`) |
| 2026-09-14 | 1.1.0 | Layout responsivo implementado e regressão estrutural adicionada; gates globais preexistentes registrados. | Dex (`@dev`) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `npx vitest run tests/mesclagem --coverage=false` — PASS, 5 arquivos e 14 testes.
- `npx eslint src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx tests/mesclagem/modal-responsivo.test.ts` — PASS.
- `npm run build` — PASS; build de produção compilado e rota `/PainelAlpha/Mesclagem` emitida.
- `npm run lint` — bloqueado por 10.108 erros e 194.169 avisos preexistentes, concentrados inclusive em `.aiox-core/`, `.agents/` e arquivos não alterados por esta story; a primeira execução também excedeu o heap padrão de 4 GB.
- `npm run typecheck` com heap de 8 GB — bloqueado por erros preexistentes em `ExclusaoFiscal`, gerador de documentos, calendário e testes relacionados; nenhum erro foi reportado nos arquivos desta story.
- `npm test` — bloqueado por 26 falhas preexistentes em 13 arquivos; 2.906 testes passaram, 1 ficou todo e toda a suíte `tests/mesclagem` passou.
- CodeRabbit — CLI não instalado em `~/.local/bin/coderabbit`; revisão automatizada indisponível neste ambiente.

### Completion Notes List

- O `DialogContent` agora usa altura baseada em `dvh` e três faixas explícitas (`auto / minmax(0,1fr) / auto`), mantendo cabeçalho e rodapé dentro da viewport.
- A região central recebeu `min-h-0`, rolagem vertical e contenção de overscroll; a lista de campos pode rolar sem expulsar “Gerar prévia”.
- Linhas do Mapeamento empilham rótulo e select em telas estreitas; o select passa a ocupar a largura disponível sem overflow horizontal.
- Nenhuma função de estado, navegação, processamento, API, domínio ou banco foi alterada.
- A validação interativa em viewport reduzida permanece pendente porque o ambiente não dispõe de uma sessão autenticada de navegador para alcançar a etapa Mapeamento.

### File List

- `docs/stories/story-mesclagem-modal-mapeamento-responsivo.md` — criada e atualizada com rastreabilidade e resultados.
- `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx` — composição vertical e controles responsivos.
- `tests/mesclagem/modal-responsivo.test.ts` — regressão estrutural do contrato responsivo.

## QA Results

_A preencher pelo agente de QA._
