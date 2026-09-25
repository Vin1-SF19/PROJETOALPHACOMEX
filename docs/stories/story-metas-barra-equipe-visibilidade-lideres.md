# Story: Termômetro lateral, super metas e visibilidade de líderes comerciais

**ID:** STORY-METAS-BARRA-EQUIPE-LIDERES
**Módulo:** Alpha Metas
**Status:** InProgress
**Prioridade:** Média
**Data de criação:** 2026-09-16

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools:
  - lint
  - typecheck
  - tests
  - build
```

## Story

**Como** responsável pelo acompanhamento das metas comerciais,
**quero** configurar metas e super metas individuais e coletivas, visualizá-las em barras e em um termômetro vertical e controlar também a exibição das líderes comerciais,
**para** acompanhar a meta base, o objetivo extraordinário e decidir quem aparece na tela.

## Contexto

A evolução final adiciona uma super meta mensal persistida para cada integrante e para a equipe. A meta geral parte automaticamente da soma das metas individuais, aceita substituição manual e pode ser restaurada à soma. As barras individuais passam a progredir até a super meta, mantendo a meta normal junto ao nome. O termômetro mostra somente o realizado no bulbo, uma linha intermediária para a meta e uma linha superior para a super meta. A meta normal deixa o termômetro pulsante e vermelho-sangue; a super meta possui som e celebração coletiva mais exuberantes e independentes.

## Acceptance Criteria

1. O widget compacto `Meta Equipe` permanece fora do cabeçalho do Alpha Metas, tanto na visualização normal quanto no modo TV.
2. A barra horizontal coletiva é removida e a meta da equipe passa a ocupar uma coluna lateral do placar, ao lado das fotos/linhas das closers, com aparência de termômetro vertical.
3. O preenchimento do termômetro representa proporcionalmente o progresso coletivo e cresce visualmente de baixo para cima; ao ultrapassar a meta, o preenchimento permanece contido no limite visual do componente.
4. O círculo/ícone azul de grupo da representação coletiva é substituído somente pela quantidade realizada, sem sufixo `/meta`.
5. O termômetro mantém identificação clara de que representa a meta geral da equipe e apresenta estado compreensível quando não houver meta configurada.
6. Ao atingir ou ultrapassar a meta coletiva, o termômetro inteiro pulsa e assume vermelho-sangue vivo sem perder a quantidade realizada.
7. O termômetro funciona nas visualizações normal e TV, permanece lateralmente alinhado ao conjunto de fotos/linhas das closers e não introduz sobreposição, corte ou rolagem na área do placar nos cenários suportados.
8. A celebração coletiva da meta normal permanece funcional; a super meta coletiva possui som e tela próprios, visualmente mais exuberantes, com deduplicação independente por sessão.
9. A tela `Configurar Metas` lista usuários com role `COMERCIAL` e `Lider Comercial`, preservando para cada linha o controle existente de mostrar/ocultar no painel.
10. Ao ocultar uma líder comercial, sua barra individual deixa de aparecer no placar após a atualização dos dados; ao reexibi-la, a barra volta a aparecer. A alteração não modifica a visibilidade dos demais usuários.
11. O estado visual, o título acessível e o feedback de carregamento/erro do controle de visibilidade das líderes seguem o mesmo comportamento já aplicado às closers.
12. As regras atuais de autorização para abrir a configuração e alterar metas/visibilidade permanecem inalteradas.
13. A entrega reutiliza `usuarios.meta_visivel_painel` e adiciona somente `superMetaMensal`, com padrão zero, a `meta_usuario` e `meta_equipe`, sem nova tabela, rota, item de menu, variável de ambiente ou permissão.
14. Testes automatizados cobrem as duas roles, visibilidade, persistência/validação das super metas, termômetro lateral e celebrações normal e extraordinária.
15. Cada linha da configuração apresenta a meta normal e a super meta lado a lado; super meta zero significa desativada e qualquer valor positivo deve ser igual ou maior que a meta normal.
16. A configuração coletiva apresenta meta normal e super meta; a meta normal é sincronizada com a soma individual até receber edição manual e oferece a ação `Usar soma` para restaurar o cálculo.
17. Nas barras individuais, a leitura à direita é `realizado/super meta`; quando a super meta estiver desativada, o denominador é exibido como `—`.
18. A meta normal individual permanece junto ao nome mesmo depois de atingida, acompanhada do estado de meta ou super meta batida.
19. O preenchimento individual usa a super meta como limite; por compatibilidade, usa a meta normal enquanto a super meta estiver desativada.
20. O termômetro usa a super meta como topo, marca a meta normal proporcionalmente no corpo e marca a super meta no topo; sem super meta, usa a meta normal como limite de compatibilidade.
21. O backup completo pré-mudança é criado e validado antes da migration, conforme a política Vault.
22. Registros históricos existentes recebem `superMetaMensal = 0`, sem alteração de seus valores de meta normal.
23. Ocultar uma closer ou líder remove apenas sua linha individual; vendas válidas do usuário oculto continuam nos totais coletivos e no progresso dos termômetros correspondentes.

## Tasks / Subtasks

- [x] Task 1 — Adaptar a consulta do placar e da configuração (AC: 9, 10, 12, 13)
  - [x] Incluir `Lider Comercial` no conjunto de usuários retornado por `getDadosMetas` e `getColaboradoresParaConfigurar`, sem ampliar as permissões de gestão.
  - [x] Aplicar `meta_visivel_painel` somente às linhas individuais do placar e manter todos os usuários elegíveis disponíveis na configuração.
  - [x] Reutilizar `toggleMetaVisibilidade` e o campo existente `usuarios.meta_visivel_painel`, sem alteração estrutural de banco.
- [x] Task 2 — Substituir a barra coletiva pelo termômetro lateral (AC: 1–6)
  - [x] Manter `Meta Equipe` fora dos cabeçalhos normal e TV.
  - [x] Remover a linha horizontal coletiva atualmente inserida na área principal.
  - [x] Implementar uma única representação coletiva vertical, em formato de termômetro, na lateral das fotos/linhas das closers.
  - [x] Fazer o preenchimento proporcional crescer de baixo para cima, limitado visualmente ao componente quando a meta for ultrapassada.
  - [x] Substituir o círculo/ícone azul de grupo pela quantidade realizada, preservando os estados sem meta e meta batida.
- [x] Task 3 — Readequar o dimensionamento do placar (AC: 7)
  - [x] Retirar a barra coletiva horizontal do cálculo de linhas e reservar espaço lateral para o termômetro sem comprimir, sobrepor ou cortar as fotos/linhas individuais.
  - [x] Verificar cenários com zero, um e vários integrantes visíveis nas visualizações normal e TV, preservando o termômetro e o comportamento sem rolagem.
- [x] Task 4 — Estender a configuração para líderes comerciais (AC: 9–11)
  - [x] Exibir líderes comerciais na mesma lista configurável das closers, com identificação clara e o controle de visibilidade já existente.
  - [x] Atualizar o estado local da visibilidade somente após sucesso da action e manter o toast de erro em falhas.
  - [x] Ajustar rótulos e estados vazios da configuração e do placar para representar as duas roles elegíveis, sem manter mensagens exclusivas de `COMERCIAL`.
  - [x] Preservar o salvamento das metas do período para as linhas apresentadas pela configuração.
- [x] Task 5 — Preservar a celebração coletiva (AC: 8)
  - [x] Garantir que a mudança de componente/local não altere o gatilho existente de meta coletiva batida.
  - [x] Confirmar a continuidade do som e da tela de parabenização, incluindo as regras atuais de ordem e não repetição.
- [ ] Task 6 — Testes e quality gates (AC: 1–22)
  - [x] Adicionar testes focados em `tests/metas/` para as consultas e a action de visibilidade.
  - [x] Atualizar o teste de regressão do componente para assegurar `Meta Equipe` fora dos cabeçalhos, ausência da barra horizontal coletiva e um único termômetro na lateral do placar.
  - [x] Cobrir a orientação de baixo para cima, a leitura somente do realizado, os dois marcadores e o estado de meta batida.
  - [x] Cobrir ou validar de forma reproduzível que o som e a tela de parabenização continuam ligados ao atingimento da meta coletiva.
  - [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar a única falha de teste fora de Metas.
  - [x] Atualizar checklist, Completion Notes e File List desta story após a implementação do refinamento.
- [x] Task 7 — Persistir super metas com segurança (AC: 13, 21, 22)
  - [x] Criar e validar backup completo pré-mudança do Turso de produção.
  - [x] Obter confirmação explícita e aplicar somente dois `ALTER TABLE ADD COLUMN`, ambos com `NOT NULL DEFAULT 0`.
  - [x] Validar colunas, valores padrão e chaves estrangeiras no banco remoto.
- [x] Task 8 — Configurar metas normais e super metas (AC: 15, 16)
  - [x] Adicionar campos individuais lado a lado e campos gerais no modal.
  - [x] Sincronizar a meta geral com a soma individual até edição manual e oferecer `Usar soma`.
  - [x] Validar no cliente e no servidor que uma super meta positiva não seja inferior à meta normal.
- [x] Task 9 — Evoluir barras e termômetro (AC: 4, 6, 17–20)
  - [x] Fazer barras individuais progredirem até a super meta e manter a meta normal junto ao nome.
  - [x] Exibir somente o realizado no bulbo do termômetro e adicionar os dois marcadores.
  - [x] Aplicar pulso e vermelho-sangue ao atingir a meta normal.
- [x] Task 10 — Celebrar a super meta (AC: 8)
  - [x] Criar som e apresentação extraordinários para a super meta coletiva.
  - [x] Manter deduplicação e sequência independentes das celebrações individuais e da meta normal.
- [x] Task 11 — Preservar vendas de usuários ocultos nos totais (AC: 23)
  - [x] Consultar closers e líderes independentemente da visibilidade e filtrar somente as linhas individuais.
  - [x] Cobrir closer e líder ocultos no cálculo dos dois termômetros.

## Dev Notes

### Comportamento atual confirmado

- Antes desta story, `getDadosMetas` consultava somente `role: "COMERCIAL"` com `meta_visivel_painel: true`; o pedido de 2026-09-25 substitui o filtro na consulta: `COMERCIAL` e `Lider Comercial` entram nos totais, enquanto a visibilidade controla somente as linhas individuais. [Source: `src/actions/Metas.ts#getDadosMetas`]
- Antes desta story, `getColaboradoresParaConfigurar` limitava a listagem a `role: "COMERCIAL"`; a implementação corrente já inclui `Lider Comercial` sem filtrar `meta_visivel_painel`, permitindo que usuários ocultos continuem configuráveis. Esse comportamento deve ser preservado. [Source: `src/actions/Metas.ts#getColaboradoresParaConfigurar`]
- `toggleMetaVisibilidade` já autoriza por `podeGerenciarMetas` e atualiza `usuarios.meta_visivel_painel`; não é necessária nova action ou alteração de schema. [Source: `src/actions/Metas.ts#toggleMetaVisibilidade`; `prisma/schema.prisma#model-usuarios`]
- O modal `ModalConfigurar` usa `Eye`/`EyeOff`, estado `togglingId`, título dinâmico e toast de erro. As líderes devem passar pelo mesmo fluxo, sem controle paralelo. [Source: `src/app/PainelAlpha/Metas/MetasClient.tsx#ModalConfigurar`]
- `LinhaColaborador` continua sendo a referência para os estados `Sem meta`, `FALTA` e `META BATIDA`, mas o elemento coletivo deixa de repetir seu formato horizontal: ele deve traduzir esses estados para um termômetro vertical lateral, sem avatar pessoal ou ranking. [Source: `src/app/PainelAlpha/Metas/MetasClient.tsx#LinhaColaborador`]
- A implementação corrente desta story já removeu o widget dos cabeçalhos e criou `LinhaMetaEquipe` como primeira linha horizontal do placar. O refinamento deve substituir essa linha, não criar uma segunda representação coletiva. `metaEquipePct` já limita o percentual visual a 100%, e `equipeBateuMeta` preserva o estado de atingimento quando o realizado ultrapassa a meta. [Source: `src/app/PainelAlpha/Metas/MetasClient.tsx#LinhaMetaEquipe`; `src/app/PainelAlpha/Metas/MetasClient.tsx#MetasClient`]
- O placar mede a altura real do container com `ResizeObserver`; a implementação corrente contabiliza a linha coletiva horizontal no total de linhas. Com o termômetro na lateral, o cálculo deve voltar a considerar somente as linhas individuais no eixo vertical e reservar no eixo horizontal o espaço necessário para o termômetro, preservando a ausência de scroll e sobreposição. [Source: `src/app/PainelAlpha/Metas/MetasClient.tsx#MetasClient`]
- A celebração coletiva é um comportamento independente da forma visual do progresso. A troca de barra por termômetro não deve alterar seu gatilho, som, tela de parabenização, ordem, duração ou regra de repetição. [Source: comportamento existente confirmado pelo usuário e pela implementação do módulo]
- A página já concede gerenciamento a Admin/CEO/Lider Comercial e as actions centralizam a decisão em `podeGerenciarMetas`; esta story não altera esse limite de autoridade. [Source: `src/app/PainelAlpha/Metas/page.tsx`; `src/lib/metas-permissoes.ts`]

### Limites de escopo

- Não alterar o gerenciamento de leads ou o fluxo de justificativa de meta.
- Não criar configuração separada por role: closers e líderes usam o mesmo controle de visibilidade já existente.
- Não definir nova ordenação, rota, permissão ou dependência.
- Rollback funcional: voltar o código e manter as colunas aditivas sem uso. Rollback integral: restaurar o backup Vault validado, considerando dados gravados depois do checkpoint.

### Project Structure Notes

- Arquivos principais esperados: `src/app/PainelAlpha/Metas/MetasClient.tsx` e `src/actions/Metas.ts`.
- Testes focados devem permanecer em `tests/metas/`, conforme a organização já usada pelo módulo.
- Não há documentação de arquitetura de frontend, árvore de origem ou estratégia de testes disponível em `docs/architecture/` ou `docs/framework/`; as referências técnicas desta story vêm do comportamento observado no código atual.
- O arquivo `accumulated-context.md` exigido pelo protocolo SM não está presente no repositório; a coerência entre stories foi verificada pelas stories existentes de Metas e pelo código atual.

### Testing

- Testes de action com mocks devem confirmar que a consulta usa as roles `COMERCIAL` e `Lider Comercial`, mantém ocultos fora das linhas individuais e inclui suas vendas nos totais.
- A consulta da configuração deve retornar líderes visíveis e ocultas, expondo o valor atual de `visivelNoPainel`.
- A alternância deve atualizar somente o `id` recebido e retornar erro sem refletir o novo estado no cliente quando a persistência falhar.
- O teste de UI/regressão deve distinguir cabeçalho, coluna lateral e linhas individuais, evitando uma validação frágil baseada apenas na presença textual de `Meta Equipe`.
- O teste do termômetro deve verificar uma única representação coletiva, ausência da antiga linha horizontal, orientação de preenchimento de baixo para cima, realizado sem denominador e os marcadores normal/super.
- Validar os estados sem meta, em progresso e meta batida, confirmando que o preenchimento não ultrapassa o limite visual do termômetro.
- Validar de forma automatizada ou reproduzível que atingir a meta coletiva ainda aciona o som e a tela de parabenização conforme as regras existentes.
- Validar manualmente a distribuição nos modos normal e TV com nenhuma, uma e várias pessoas visíveis, incluindo uma líder oculta e depois reexibida, sem corte, sobreposição ou scroll.

### Decisões autônomas do draft

- `[AUTO-DECISION] Qual identificador usar sem epic/PRD específico? → STORY-METAS-BARRA-EQUIPE-LIDERES e nome descritivo não numerado (reason: as stories recentes deste produto usam IDs por domínio e não há epic do pedido em docs/prd).`
- `[AUTO-DECISION] O widget deve sair de qual cabeçalho? → Dos cabeçalhos normal e TV (reason: o mesmo widget é renderizado nos dois e manter um deles contrariaria a transformação solicitada em barra).`
- `[AUTO-DECISION] Onde posicionar o indicador coletivo após o refinamento? → Em uma coluna lateral do placar, ao lado das fotos/linhas das closers (reason: o usuário substituiu explicitamente a direção anterior de barra horizontal por um termômetro lateral).`
- `[AUTO-DECISION] Como persistir a super meta? → Campo aditivo `superMetaMensal` com padrão zero nos dois modelos existentes (reason: preserva histórico e compatibilidade sem criar entidades paralelas).`
- `[AUTO-DECISION] Como tratar as tarefas já concluídas que foram invalidadas pela nova direção? → Reabrir somente layout, dimensionamento, celebração regressiva e testes de UI; manter concluídas as consultas e a configuração de líderes (reason: a mudança não altera o fluxo de dados nem a autorização).`
- `[AUTO-DECISION] Sincronizar no ClickUp? → Não nesta sessão (reason: não há conector ClickUp disponível; o protocolo permite preservar a story local e registrar a ausência da sincronização).`

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Frontend
**Secondary Type(s):** API interna / consulta de dados
**Complexity:** Média — as consultas já foram adaptadas; o refinamento pendente altera a composição lateral do placar, o cálculo responsivo e a regressão da celebração coletiva.

### Specialized Agent Assignment

**Primary Agents:**

- `@dev` — implementação e revisão pre-commit.
- `@ux-design-expert` — consistência visual, responsividade e acessibilidade do termômetro lateral.

**Supporting Agent:**

- `@qa` — cobertura de consultas, visibilidade e regressão do layout.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): executar CodeRabbit para mudanças não commitadas antes de marcar a story como concluída.
- [ ] Pre-PR (`@devops`): executar revisão CodeRabbit contra `main` antes de criar o pull request.
- [ ] Pre-Deployment: N/A — esta story não define operação de deploy.

### Self-Healing Configuration

**Expected Self-Healing:**

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

**Predicted Behavior:**

- CRITICAL: `auto_fix`, até 2 iterações.
- HIGH: `document_only` nas notas da story.
- MEDIUM e LOW: não entram no ciclo automático light.

### CodeRabbit Focus Areas

**Primary Focus:**

- Acessibilidade e leitura do termômetro lateral nos modos normal e TV, incluindo realizado isolado e os dois marcos.
- Responsividade e ausência de overflow/scroll no placar.

**Secondary Focus:**

- Seleção correta das roles sem ampliar autorização.
- Reutilização do estado de visibilidade e segurança da migration aditiva.

## Story Refinement Checklist Validation

**Readiness:** GO — refinamento pronto para continuidade do desenvolvimento
**Clarity score:** 9/10
**Blocking gaps:** Nenhum. A validação visual fina depende da implementação, mas os estados e limites estão definidos.

| Categoria | Status | Evidência / observação |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Objetivo, valor, fluxo atual e limites estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Consultas, componente, campo persistido, integração e arquivos principais foram identificados. |
| 3. Reference Effectiveness | PASS | Todas as referências apontam para símbolos ou modelos específicos do repositório. |
| 4. Self-Containment Assessment | PASS | Requisitos, semântica de visibilidade, estados e fora de escopo estão no próprio documento. |
| 5. Testing Guidance | PASS | Há cenários de action, UI, erro, layout e validação manual mensuráveis. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão preenchidos conforme a configuração ativa. |
| 7. Executor Assignment | PASS | `@dev` executa e `@architect` atua como quality gate independente, com lint, typecheck, testes e build. |
| 8. Brownfield Integration | PASS | Pontos de integração, autorização, migration aditiva, backup e rollback estão explícitos. |

### PO Master Checklist — aplicação proporcional à story

- [x] Brownfield com UI identificado; seções de scaffolding greenfield e dependências externas não aplicáveis foram desconsideradas.
- [x] Integrações existentes, compatibilidade de autorização e ausência de alteração estrutural de banco foram verificadas no código atual.
- [x] Fluxo visual do termômetro, estados sem meta/meta batida, progressão de baixo para cima, responsividade, modo TV, carregamento e erro estão cobertos por ACs e tarefas.
- [x] Sequência do refinamento é coerente: substituir linha horizontal → reservar coluna lateral → preservar celebração → atualizar testes/gates.
- [x] Riscos principais estão mitigados: overflow lateral, duplicação do indicador coletivo, regressão da celebração/autorização, ocultação de usuário incorreto e cópias exclusivas de `COMERCIAL`.
- [x] Rollback é localizado e não envolve restauração de dados.
- [x] Escopo permanece mínimo: reutiliza action e campo existentes, sem rota, permissão, menu, schema ou dependência nova.
- [x] Handoff definido para `@dev`, condicionado aos gates e à revisão independente por `@architect`.

**Developer perspective:** O refinamento está implementável sem decisão externa. O principal cuidado é remover a linha horizontal do cálculo vertical, reservar espaço lateral para o termômetro e preservar o gatilho de som/tela da celebração coletiva.

**PO verdict:** GO para o refinamento (9/10, confiança alta). Nenhum bloqueador; a story permanece `InProgress` porque a implementação visual e seus testes foram reabertos.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-16 | 1.0.0 | Draft criado a partir do pedido do usuário e do comportamento atual do Alpha Metas | River (SM) |
| 2026-09-16 | 1.0.1 | Validated GO (9/10) — Status: Draft → Ready; quality gate, prioridade, cópias inclusivas, cenário sem integrantes e rollback refinados | @po |
| 2026-09-16 | 1.1.0 | Development started (autonomous mode) — Status: Ready → InProgress | @dev |
| 2026-09-16 | 1.2.0 | Refinamento solicitado: barra horizontal coletiva substituída na especificação por termômetro lateral, com progresso de baixo para cima e leitura `realizado/meta`; celebração, líderes, autorizações e ausência de migration preservadas. Status mantido em InProgress | @po |
| 2026-09-16 | 2.0.0 | Super metas individuais e coletiva adicionadas; termômetro passa a usar dois marcos e realizado isolado; migration autorizada, respaldada e aplicada | @dev |
| 2026-09-25 | 2.0.1 | Visibilidade passa a afetar somente linhas individuais; vendas de closers e líderes ocultos permanecem nos totais coletivos | @dev |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5).

### Debug Log References

- `npx vitest run tests/metas/metas-painel-equipe.test.ts` — 6/6 testes aprovados.
- `npx eslint src/actions/Metas.ts src/app/PainelAlpha/Metas/MetasClient.tsx src/lib/shared/module-knowledge/metas.ts tests/metas/metas-painel-equipe.test.ts` — aprovado sem erros ou warnings.
- `npx vitest run tests/metas/metas-painel-equipe.test.ts tests/metas/metas-permissoes.test.ts tests/bibble/module-knowledge.test.ts` — 34/34 testes aprovados após a inclusão das super metas.
- `npx vitest run tests/metas/metas-painel-equipe.test.ts tests/metas/metas-permissoes.test.ts` — 26/26 testes aprovados após centralizar os marcadores dentro do tubo e mover a meta normal para o bloco numérico da closer.
- `npm run build` — build de produção aprovado; o build informa que a validação de tipos é ignorada pela configuração atual.
- `npm run typecheck` — falha em 12 erros preexistentes fora desta story (`ExclusaoFiscal`, `gerador-documentos`, `BibbleEmptyState.orig`, `HabilitacaoRadarClient`, `ChamadosOperacionaisPainel` e `node:sqlite`); nenhum erro nos arquivos de Metas.
- `npm run lint` — baseline global falha com 3.711 ocorrências em arquivos fora desta story; o lint focado dos arquivos alterados passa.
- `npm test -- --run` — 3.276 testes aprovados, 1 todo e 20 falhas em 12 arquivos fora desta story; a suíte de Metas passa integralmente.
- CodeRabbit CLI não está instalado em `~/.local/bin/coderabbit`; revisão automática não pôde ser executada.
- 2026-09-25: `npx vitest run tests/metas/metas-painel-equipe.test.ts` — 14/14 aprovados, inclusive closer e líder ocultos.
- 2026-09-25: `npm run lint` — concluído sem erros, com 1.192 warnings preexistentes; lint focado dos arquivos alterados sem warnings.
- 2026-09-25: `npm run typecheck` — aprovado após o build; execução simultânea ao build falhou por arquivos transitórios de `.next/types`.
- 2026-09-25: `npm run build` — aprovado.
- 2026-09-25: `npm test` — 3.840 aprovados, 4 ignorados, 1 todo e 1 falha em `tests/notas/acesso-e-lixeira.test.ts` por URL de banco vazia (`URL_INVALID`); testes de Metas aprovados.

### Completion Notes List

- O widget coletivo permanece fora dos cabeçalhos normal e TV; a barra horizontal intermediária foi removida e substituída por um único termômetro na lateral esquerda do placar.
- O termômetro preenche de baixo para cima até a super meta, mostra somente o realizado no bulbo e possui linhas para meta normal e super meta.
- Os estados sem meta, em progresso e meta batida possuem leitura textual e semântica acessível; o estado de meta batida mantém os números realizados sem truncamento.
- O cálculo responsivo voltou a distribuir a altura somente entre as linhas individuais, enquanto a coluna lateral usa larguras adaptativas e preserva as fotos/linhas em zero, um ou vários integrantes.
- A celebração normal foi preservada; a super meta coletiva recebeu som, tela extraordinária e deduplicação próprios, respeitando a fila de comemorações.
- O modal salva meta/super meta individual e coletiva, mantém a soma automática até edição manual e permite restaurá-la por `Usar soma`.
- As barras individuais progridem até a super meta e exibem a meta normal imediatamente à esquerda de `realizado/super meta`.
- Refinamento visual: a meta normal saiu do subtítulo do nome e passou a ficar imediatamente à esquerda de `realizado/super meta`; os rótulos dos marcos coletivo normal e super foram centralizados acima de suas linhas, dentro do tubo.
- Consultas do placar e da configuração agora incluem `COMERCIAL` e `Lider Comercial`; autorização e persistência continuam usando os fluxos existentes.
- Ocultar uma closer ou líder mantém suas vendas nos termômetros coletivos, incluindo o realizado da equipe e o total geral; somente a linha individual deixa de aparecer.
- Rótulos, estado vazio e manual interno foram atualizados para representar closers e líderes comerciais.
- A migration aditiva foi aplicada após backup completo validado; 39 registros individuais e 5 coletivos receberam `superMetaMensal = 0`, sem violações de chave estrangeira.
- A implementação e os testes focados estão concluídos, mas a story permanece InProgress porque os gates globais de lint, typecheck e regressão já estão vermelhos fora do escopo desta entrega.
- No ajuste de 2026-09-25, lint, typecheck e build passaram; o gate `npm test` permanece vermelho por uma falha em Notas ligada à configuração de banco de testes, fora dos arquivos de Metas.

### File List

- `docs/stories/story-metas-barra-equipe-visibilidade-lideres.md` (novo — story)
- `plan/self-critique-metas-barra-equipe.json` (novo — autocritique do desenvolvimento)
- `prisma/schema.prisma` (modificado — campos `superMetaMensal`)
- `prisma/migrations/20260916220000_add_super_meta_mensal/migration.sql` (novo — migration aditiva aplicada)
- `src/actions/Metas.ts` (modificado — totais incluem usuários ocultos)
- `src/app/PainelAlpha/Metas/MetasClient.tsx` (modificado)
- `src/lib/bibble/tool-executor.ts` (modificado — leitura de super metas)
- `src/lib/shared/module-knowledge/metas.ts` (modificado)
- `tests/metas/metas-painel-equipe.test.ts` (modificado — regressão de closer e líder ocultos)

## QA Results

A preencher pelo agente de QA.
