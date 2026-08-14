# JOURNAL — Histórico Cronológico de Sessões

> Mantido por: Kowalski (cronista)
> Registrar ao FINAL de toda sessão com trabalho real.

---

## Template de entrada

```
## [Data] — [Título resumido da sessão]

### O que foi feito
- [lista de mudanças reais]

### Decisões tomadas
- [decisões importantes e motivos]

### Arquivos criados/modificados
- `[caminho]` — [o que mudou]

### Erros encontrados e fixes
- [erro]: [fix aplicado]

### Pendências para próxima sessão
- [o que ficou para fazer]
```

---

## Sessões

<!-- Kowalski adiciona aqui ao final de cada sessão -->

---

## [2026-08-14] — Alpha Motion: diagnóstico e correção de 2 causas reais de travamento (Dashboard + Editor)

**Tags:** #bugfix #performance #webgl #diagnosis

**Agentes envolvidos:** Bibble (orquestração direta) → Scout (reconhecimento) → Explore agent (investigação profunda do RenderEngine) → Forge (tsc/lint/build reais) — sessão conduzida sem squad completa por ser predominantemente investigação + correção cirúrgica, não feature nova.

### O que foi feito
- Diagnosticado e corrigido o travamento do Chrome inteiro ao abrir o módulo Alpha Motion: Dashboard renderizava miniaturas via motor de renderização ao vivo (incluindo `<Canvas>` WebGL para Globo/Partículas/Objeto3D), sem limite de contextos simultâneos.
- Diagnosticado e corrigido um segundo travamento (lentidão sustentada, sem erro, só normalizava ao fechar a aba): fundos animados do Editor (Cosmos/Estelar/Radar/Blueprint) rodavam animações `repeat: Infinity` sem parar mesmo com o módulo escondido (mas montado) atrás de outra aba do painel.
- Descartada, com confirmação do usuário, a hipótese inicial de que o componente Container Alpha (porta 3D) fosse a causa do segundo travamento — não estava em uso nos slides atuais, mas o bug real nesse componente (double live-render do próximo slide) foi documentado como achado válido, não corrigido (fora do escopo pedido).

### Decisões tomadas
- Ver `decisions.md`, entradas 2026-08-13/14 (miniatura estática) e 2026-08-14 (gate de visibilidade nos fundos animados) para o detalhe técnico completo.

### Arquivos criados/modificados
- `src/app/api/apresentacoes/[id]/miniatura/route.ts` — novo, upload da miniatura estática.
- `src/lib/apresentacoes/miniatura-captura.ts` — novo, captura client-side via `html-to-image`.
- `src/lib/apresentacoes/proximo-slide.ts` — `ehPrimeiroSlide()` adicionada.
- `src/components/Apresentacoes/Editor/ApresentacaoEditor.tsx` — dispara captura após autosave do primeiro slide.
- `src/actions/apresentacoes.ts` (`ListarApresentacoes`) — parou de buscar `slides`/`dadosJson`.
- `src/components/Apresentacoes/Dashboard/CardApresentacao.tsx` — usa `thumbnailUrl` + fallback estático, sem live-render.
- `src/components/Apresentacoes/Dashboard/MiniaturaSlideApresentacao.tsx` — **deletado** (código morto/causa raiz).
- `src/lib/apresentacoes/miniatura-slide.ts` — **deletado** (só usado pelo componente acima).
- `tests/apresentacoes/miniatura-slide.test.ts` — **deletado** (teste órfão do lib acima).
- `src/components/Apresentacoes/Editor/RenderEngine/{CosmosIAlphaFundo,EstelarFundo,RadarFundo,BlueprintFundo}.tsx` — gate de visibilidade via `useVisibilidadeIframe`.

### Erros encontrados e fixes
- EPERM em `query_engine-windows.dll.node` durante `npm run build` (2x nesta sessão) — fix já catalogado em `known-errors.md`, aplicado com autorização explícita do usuário (`taskkill //F //IM node.exe`) nas duas ocorrências.
- `tsc --noEmit` mostrou 3 erros novos em `ModalGerenciamentoLeads.tsx` — confirmado via `git status` que já estavam modificados/pendentes ANTES desta sessão (não introduzidos por este trabalho); não corrigidos por estarem fora de escopo.

### Pendências para próxima sessão
- `ContainerCargaRender.tsx`/`SlidePortalPreview.tsx`: o componente Container Alpha (porta 3D) faz live-render completo do próximo slide o tempo todo que a porta está com `estadoEditor: "aberto"` (que é o padrão ao criar um novo — `registry-3d.ts`), sem gate de `pausado`/visibilidade. Não corrigido porque o usuário não usa esse componente atualmente — reavaliar se/quando alguém passar a usar.
- Probe/Lens/Sage completos não foram executados como agentes formais separados nesta sessão (Forge real rodou; revisão de qualidade foi feita inline pelo Bibble). Considerar rodar `/probe` e `/sage` numa sessão futura se o padrão precisar de validação mais formal (ex: teste automatizado cobrindo o novo endpoint de miniatura).
- Apresentações importadas de PPTX ANTES de 2026-08-14 (exceto "teste 2", apagada) ainda têm os SVGs de recorte pesados (base64 embutido) salvos em produção — se algum usuário reportar lentidão parecida em outra apresentação importada, ver a entrada de `decisions.md` desta data; corrigir exigiria backfill (Vault, mutação em massa).

### Continuação [2026-08-14, mesma sessão] — 3º achado real: importador PPTX embutia imagens em base64 dentro do SVG de recorte

**O que foi feito:**
- Consulta somente-leitura ao Turso de produção (script pontual, descartado) identificou que a apresentação "teste 2" (reportada pelo usuário como ainda lenta) tinha SVGs de até ~2 MB por imagem recortada — nada a ver com 3D/fundo animado, os 2 fixes anteriores não cobriam esse caso.
- Corrigido `src/lib/apresentacoes/pptx/{parser,tipos,mapear}.ts`: SVG de recorte agora referencia a URL real da imagem já enviada ao Blob, em vez de embutir a imagem inteira em base64. Ver `decisions.md` para o detalhe técnico completo.
- Apresentação "teste 2" excluída do banco de produção a pedido explícito do usuário (tinha o `.pptx` original, vai reimportar depois do fix) — `db.apresentacao.delete`, mesmo caminho de `ExcluirApresentacao` (CRUD normal do app, cascade do schema, sem Vault por não ser migration/mutação em massa).
- Forge real rodado de novo (tsc/lint/build) — baseline preservado, build OK.

**Arquivos modificados (3º fix):**
- `src/lib/apresentacoes/pptx/tipos.ts` — `FormaImagemExtraida.recorte?` novo.
- `src/lib/apresentacoes/pptx/parser.ts` — não monta mais o SVG com base64 embutido, só devolve imagem bruta + geometria do recorte.
- `src/lib/apresentacoes/pptx/mapear.ts` — envia imagem bruta primeiro, monta o SVG leve com a URL real depois.

**Erros encontrados e fixes:**
- EPERM em `query_engine-windows.dll.node` reincidiu mais uma vez (3ª vez nesta sessão) — mesmo fix já autorizado, aplicado sem perguntar de novo.
- `tsc` apontou `recorte.opacidade` como `number` obrigatório mas `lerOpacidadeBlip()` retorna `number | undefined` — corrigido tornando o campo opcional em `tipos.ts`.

### Continuação [2026-08-14, mesma sessão] — 4º achado: modal de prévia do PPTX ainda travava com deck real de 21 slides/101 imagens

**O que foi feito:**
- Usuário testou com o arquivo real (`Plano de Marketing.pptx`, em Downloads) e ainda travava. Rodei um script de diagnóstico pontual (vitest temporário, descartado) chamando `extrairApresentacaoPptx` direto no arquivo — confirmou 224 formas, 101 imagens (52 recortadas), 66 MB de imagem bruta somada, distribuídos em 21 slides. Confirmou que "teste 2" (apagada antes) era exatamente esse mesmo arquivo.
- Apresentei 4 recomendações ao usuário (sem implementar ainda) para reduzir o peso do modal de prévia sem perder fidelidade; usuário pediu pra implementar todas.
- Implementadas as 4: miniatura padrão passou a ser o PNG de referência real do PowerPoint (`reference-renderer.ts`, já existia, agora é o padrão visível em vez de só diff escondido); resize server-side (`sharp`, dependência nova) só nas imagens da prévia (nunca no commit real); paginação real (6 slides por página) substituindo scroll infinito com `useInView`; diff visual virou sob demanda (botão) em vez de automático. Também adicionado `loading="lazy"` nos `<img>` de `RenderImagem` (ganho universal).
- Forge: `tsc`/`eslint` limpos nos arquivos tocados. `next build` completo NÃO pôde ser verificado — bloqueado por um refactor não relacionado, já em andamento no schema/módulo CS&NPS (`ModalCadastro/modalDados.tsx` importando `salvarAlteracoesGeral`, que não existe mais em `actions/Clientes.ts` — claramente trabalho do usuário em outra sessão/ferramenta, fora do escopo do Alpha Motion).

**Arquivos modificados (4º fix):**
- `src/app/api/apresentacoes/[id]/pptx-preview/route.ts` — `prepararBytesParaPreview()` com `sharp`, resize só na prévia.
- `src/components/Apresentacoes/Editor/SidebarEsquerda/ModalPreImportarPptx.tsx` — reescrito: miniatura por referência + live-render sob demanda, paginação, diff sob demanda.
- `src/components/Apresentacoes/Editor/RenderEngine/render/RenderBasicos.tsx` — `loading="lazy"` nos 2 `<img>` de `RenderImagem`.
- `package.json` — nova dependência `sharp`.

**Pendência nova para próxima sessão:**
- Build de produção completo (`next build`) não foi validado nesta sessão por bloqueio alheio (refactor CS&NPS em andamento: `salvarAlteracoesGeral` não existe mais em `actions/Clientes.ts`, `ModalCadastro/modalDados.tsx` e outros arquivos de `CadastroClientes`/`cs-nps` com múltiplos erros de tipo). Rodar `npm run build` completo assim que esse refactor for concluído/commitado, pra confirmar que as mudanças do Alpha Motion desta sessão não têm nenhuma interação inesperada com o resto do projeto.

---

## [2026-07-28] — Gestão de Comissões e Prêmios: novo módulo completo, execução via fila de 17 fases

**Tags:** #feature #decision #prisma #security #critical #integration #nextjs #financeiro
**Agentes envolvidos:** Scout → Vault → Iris → Echo (x5 fases) → Nova (x5 fases) → Anubis → Forge → Probe → Lens → Sage → Scribe → Kowalski (pipeline serial completo, 17 fases, sem pular etapa, sem pausar entre fases a pedido explícito do usuário — "sem parar")
**Arquivos tocados:** ~50 arquivos novos (`src/lib/commissions/**` ~25 arquivos incl. `adapters/` e `export/`, `src/actions/Commission*.ts` x11 + `EligibilityOverrides.ts`, `src/components/Comissoes/**` ~18 arquivos, `src/app/PainelAlpha/Comissoes/**` 4 páginas, `tests/commissions/**` 17 arquivos) + `prisma/schema.prisma` (18 models + 4 colunas em `CargoColaborador`) + `src/lib/modulos-registry.ts` + `src/components/layout/GlobalSidebar.tsx` + `src/components/ui/tabs.tsx` (criado do zero)

### Contexto
Usuário colou um PROMPT MESTRE extenso pedindo um módulo completo de "Gestão de Comissões e Prêmios": controle de fatos geradores, cálculo de comissão/prêmio/DSR para CLT e PJ, integração com CS&NPS/Metas/Colaboradores, motor de regras versionado, dashboard com Big Cards por evento e mini cards por colaborador, pagamentos, exportação de espelhos (PDF/Excel), configurações (cargos/tarifários/regras), tudo com auditoria completa e proibição explícita de inventar dados/decisões financeiras sensíveis sem confirmação do usuário. Quebrado em 17 fases via `/prompt-phases`, executado sem pausar (exceto os gates de segurança/qualidade, nunca pulados).

### O que foi feito
- **Schema:** 18 models novos (`CommissionEvent`, `BusinessProcess`, `SyncRun`, `SyncError`, `CommissionRule`, `CommissionRuleVersion`, `EligibilityOverride`, `CommissionEntry`, `EntryComponent`, `ManualAdjustment`, `Payment`, `PaymentAllocation`, `TariffVersion`, `CommissionDivergence`, `ExportDocument`, `ExportDocumentItem`, `Holiday`, `CommissionAuditLog`) + 4 colunas em `CargoColaborador`, aplicados no Turso real via script Node pontual (removido após uso), aprovado por Vault com backup fresco validado.
- **Motor de regras** (`src/lib/commissions/`): determinístico, sem `eval`/`Function()` — 13 operadores de condição, 9 tipos de cálculo, preservação de tarifário em desconto ≤10%, 5 políticas configuráveis para desconto >10% (nunca decide sozinho), calendário de dias úteis/feriados, resolução de vínculo CLT/PJ com 4 estados de divergência explícitos.
- **Integração:** adapters para CS&NPS (`clientes`), Metas (`ContratoComercial`) e Colaboradores, com merge de fontes de contratação (decisão do usuário: nunca uma fonte só) e detecção de êxito via `clientes.dataExito`.
- **Backend:** 12 arquivos de Server Actions cobrindo sincronização, eventos, exceções de elegibilidade, pagamentos (simples/lote/programado/estorno), dashboard, lançamentos, simulador, divergências, exportação, cargos, tarifários e construtor de regras (versionamento imutável — nunca sobrescreve versão PUBLISHED).
- **Frontend:** dashboard "Ledger Vivo" com Big Card por evento + mini card por colaborador, modal de detalhes com 7 abas, simulador de regras (reusa o motor real, sem duplicação), painel de divergências, exportação com preview real antes de gerar, configurações (cargos/tarifários/construtor visual de regras).
- **Exportação:** XLSX (ExcelJS, 6 abas) e PDF (`@react-pdf/renderer`) com neutralização de Excel Formula Injection.
- **Testes:** 152 testes Vitest (`tests/commissions/`, 17 arquivos) cobrindo motor de regras, calendário, adapters, eventos/lançamentos, pagamentos, divergências, exportação (incl. teste de segurança), configurações e ajuste manual.
- **Verificação final (Fase 16):** `tsc --noEmit` no baseline de 4 erros pré-existentes (zero novo), lint escopado do módulo 100% limpo, `npm run build` sucesso completo com as 4 rotas do módulo, `npm run dev` boot confirmado.

### Decisões tomadas
- Cargo: `CargoColaborador` estendido (não tabela paralela) — evita duplicar fonte de verdade.
- Fonte de contratação: merge de `ContratoComercial` + `clientes`, nunca uma só (pedido explícito do usuário).
- Vínculo CLT/PJ: já literal em `ContratoColaborador.tipo`, confirmado pelo usuário.
- Êxito nasce de `clientes.dataExito`, não do Checklist RADAR nem registro manual — confirmado pelo usuário.
- RBAC do módulo é módulo-inteiro (não por ação) — TODO documentado em texto nos 12 arquivos de Server Actions, não implementado nesta entrega.
- Direção visual "Ledger Vivo" escolhida pelo usuário entre as opções apresentadas por Iris.

### Problemas encontrados / resolvidos
- **EPERM recorrente no `npx prisma generate`** (arquivo da DLL do query engine travado por processos concorrentes do Cursor/Codex do usuário no Windows) — usuário interrompeu os processos concorrentes; quando volta a ocorrer, `npx next build` direto (sem generate) funciona porque o client já está gerado e válido.
- **Bug real no filtro de regras seed** (Fase 07): não distinguia cargo real do colaborador — corrigido com mapeamento explícito extraído para `cargo-rule-matching.ts`, compartilhado entre `entry-generator` e o simulador.
- **Bug real: comissão/DSR/prêmio competiam na mesma precedência** em vez de gerar componentes separados — corrigido avaliando `evaluateRules` separadamente por `benefitType`, gerando um `EntryComponent` por tipo vencedor.
- **3 achados de segurança reais (Anubis, Fase 15):** Excel Formula Injection no `xlsx-generator.ts` (corrigido com `neutralizarFormula()`, testado com payload malicioso real), auditoria ausente em `CommissionDivergences.ts` e `CommissionRuleBuilder.ts` (corrigido, todas as ações sensíveis agora gravam `CommissionAuditLog`).
- **2 achados de lint em arquivos de teste (Forge, Fase 16):** import não usado em `calendar-engine.test.ts`, `any` explícito em `entry-generator.test.ts` — corrigidos.
- **1 lacuna real de escopo (Sage, Fase 16):** `ManualAdjustment` tinha schema e UI de leitura desde fases anteriores, mas nenhuma Server Action de escrita — ao contrário de "Novo Lançamento" (conscientemente marcado `BotaoEmBreve`), este ficou esquecido sem nota. Usuário escolheu implementar imediatamente: `CriarAjusteManual` adicionado com bloqueio em lançamento Pago/Estornado, transação atômica, auditoria — 7 testes novos.

### Pendências para próxima sessão / uso em produção
- Fórmula definitiva do DSR (placeholder documentado em `dsr-formula.ts`), natureza do valor do Diretor Operacional, feriados municipais (só nacionais implementados), tratamento de inadimplência — todas conscientemente deixadas configuráveis (seção 39 do prompt original), não decididas por invenção.
- RBAC granular por ação dentro do módulo — hoje é módulo-inteiro.
- Aprovação de ajuste manual (`aprovadoById`/`aprovadoEm` no schema, sem Server Action de aprovação).
- Sem teste de login real no browser nesta sessão (sem credenciais disponíveis) — recomenda-se validação manual humana antes de uso com dados reais de colaboradores/pagamentos.

---

## [2026-07-27 12:30] — Alpha Blueprint: novo módulo completo (MVP), execução via fila de fases

**Tags:** #feature #decision #prisma #security #critical #integration #nextjs
**Agentes envolvidos:** Scout → Vault (x2) → Iris → Echo → Nova → Cortex/Sync → Pulse → Anubis → Forge → Probe → Lens → Sage → Scribe → Kowalski (pipeline serial completo, sem pular etapa)
**Arquivos tocados:** ~40 arquivos novos (`src/actions/Blueprint*.ts` x9, `src/lib/blueprint/*.ts` x5, `src/lib/validations/blueprint.ts`, `src/components/AlphaBlueprint/*.tsx` x~25, `src/app/PainelAlpha/AlphaBlueprint/**`, `src/app/api/blueprint/{upload,chat}/route.ts`, `tests/blueprint/*.test.ts` x4) + `prisma/schema.prisma` (9 models + 1 coluna em `usuarios`) + `src/lib/modulos-registry.ts` + `src/components/layout/GlobalSidebar.tsx` + `.env.local`

### Contexto
Usuário pediu um módulo novo completo — "Alpha Blueprint": central progressiva de especificação de sistemas (Kanban + editor de texto rico + canvas visual + arquivos + requisitos/perguntas/comentários + IA + onboarding). Pedido veio como um prompt extenso e detalhado, que foi quebrado em 14 fases sequenciais salvas em `prompt-phases/` (uma por etapa do pipeline da squad) e executado do início ao fim sem pausar, a pedido explícito do usuário ("Execute sem parar").

### O que foi feito
- **Schema**: 9 models novos (`BlueprintProject`, `BlueprintMember`, `BlueprintDocument`, `BlueprintBoard`, `BlueprintFile`, `BlueprintRequirement`, `BlueprintQuestion`, `BlueprintComment`, `BlueprintActivity`) aplicados no Turso real via script pontual, aprovados por Vault como 🟢 (CREATE TABLE puro). Coluna nova `usuarios.onboarding_blueprint_visto` (ADD COLUMN, também 🟢, aprovada e aplicada na mesma sessão).
- **Backend**: 9 arquivos de Server Actions com ownership por projeto (`checarAcessoBlueprint`/`exigirAcessoBlueprint`, matriz de 5 roles × 14 ações), upload via Route Handler dedicada, chat de IA via Route Handler com streaming SSE.
- **Frontend**: Dashboard/Kanban (drag-and-drop `@dnd-kit`, optimistic update), workspace de projeto com 8 abas, editor rico Tiptap (instalado nesta sessão), canvas visual `@xyflow/react` (já instalado, reaproveitado em modo editável), central de arquivos, requisitos/perguntas/comentários, painel de IA, onboarding com tour guiado.
- **IA**: isolada por projeto, reaproveitando a infraestrutura REAL do Bibble (Ollama via `callCompletion`, não Anthropic — divergência do `CLAUDE.md` identificada e seguida conscientemente pela realidade do código).
- **Testes**: 49 testes Vitest novos (`tests/blueprint/`) cobrindo validação Zod, matriz de permissão, regressão de IDOR, transições de Kanban.
- **Verificação**: `tsc --noEmit` limpo (baseline de 4 erros pré-existentes inalterado), lint escopado 0 erros/warnings, `npm run build` 100% sucesso (todas as ~95 rotas do sistema, não só o módulo novo).

### Decisões tomadas
- FK de usuário em todo o schema novo é `Int` (não `String`/cuid) — corrigindo o schema conceitual do prompt original para bater com `usuarios.id: Int @autoincrement()` real.
- Upload via Vercel Blob com store DEDICADO (`BLUEPRINT_STORE_ID`/`BLUEPRINT_READ_WRITE_TOKEN`, fornecido pelo usuário no meio da implementação) — não UploadThing (nunca configurado no projeto real, apesar de estar no `package.json`).
- IA via Ollama real (`callCompletion`/`OllamaTool`), não Anthropic — segue a infraestrutura de produção real, não a arquitetura "futura" descrita no `CLAUDE.md`.
- Tiptap escolhido e instalado como editor rico (nenhum existia antes); `@xyflow/react` reaproveitado (já instalado, usado pelo Apresentation Studio em modo visualização).
- Permissão por PROJETO (`BlueprintMember`) é um conceito novo, adicional à permissão de módulo padrão do painel — primeira vez que um módulo tem granularidade de permissão por registro individual.

### Problemas encontrados / resolvidos
- **6 vulnerabilidades reais de IDOR cross-project** (Anubis): `AtualizarArquivoBlueprint`/`ArquivarArquivoBlueprint`/`SalvarDocumentoBlueprint`/`ExcluirDocumentoBlueprint`/`SalvarBoardBlueprint`/`ExcluirBoardBlueprint` validavam acesso ao `projectId` do cliente mas nunca confirmavam que a entidade (`fileId`/`documentId`/`boardId`) pertencia a esse projeto antes de mutar — corrigido exigindo `entidade.projectId === projectId`, com regressão coberta em teste automatizado.
- **Race condition no canvas** (Lens): `handleEdgesChange`/`onConnect` em `BlueprintCanvas.tsx` liam `nodes` do closure do render (potencialmente stale) em vez do valor mais atual — corrigido usando `setNodes` funcional para sempre ler o estado atual antes de agendar o autosave.
- **Falta de optimistic update no Kanban** (Lens): card "saltava de volta" à coluna original durante o round-trip do servidor — corrigido aplicando a mudança de status no estado local imediatamente, revertendo só em caso de falha.
- **`requesterId` sem validar existência** (Lens): `CriarProjetoBlueprint` aceitava qualquer ID numérico do cliente sem confirmar que o usuário existe — corrigido com `findUnique` antes do `create`.
- **6 erros ESLint `react-hooks/set-state-in-effect`** (Forge): padrão universal do projeto (chamar Server Action dentro de `useEffect`) precisa do fix `void fn(); // eslint-disable-next-line ...` — documentado em `known-errors.md` para futuras sessões.
- **Bug de idempotência em `MoverProjetoBlueprint`** (Sage, achado durante os testes): mover para o MESMO status regravava `update`+`activity` desnecessariamente — corrigido com early-return.
- **EPERM na DLL do Prisma Client** — erro já catalogado, resolvido matando processos `node.exe` antes de `prisma generate`.

### Pendências
- Fluxo autenticado ponta-a-ponta (criar projeto, arrastar card, editor, canvas, upload real, chat de IA) não testado por automação de browser — sem credenciais de usuário disponíveis nesta sessão. Recomendado teste manual humano.
- Camada 2 (evolução avançada do prompt original): IA proativa analisando projeto inteiro, geração automática de fluxos/wireframes, colaboração real-time, versionamento avançado (snapshots/branch), apresentação em slides, exportações avançadas, métricas gerenciais — nenhum implementado, conscientemente adiado.
- Onboarding cobre só o Dashboard (3 passos); não cobre tour dentro do workspace do projeto (editor/canvas/arquivos).
- Sem projeto demonstrativo/exemplo pré-populado.
- Sem rate limit em nenhuma action do módulo (mesmo padrão de dívida já aceito em outros módulos do painel).

### Refletido também em
- `decisions.md`: 2 entradas novas (divergências corrigidas do prompt original; fila de fases `prompt-phases/`)
- `architecture.md`: endpoints/Server Actions do Blueprint + env vars `BLUEPRINT_STORE_ID`/`BLUEPRINT_READ_WRITE_TOKEN`
- `codebase-map.md`: seção completa do módulo (schema, arquivos centrais, decisões de arquitetura, pendências)
- `integration-points.md`: checklist de integração + lição de IDOR para actions com `entityId`+`projectId` separados
- `components.md`: catálogo dos ~25 componentes + padrão de fix do `set-state-in-effect`
- `known-errors.md`: erro de lint `react-hooks/set-state-in-effect` documentado com fix exato

## [2026-07-13] — CS&NPS: multi-serviço por CNPJ, usuários reais, e reconstrução do log de auditoria (com incidente de perda de dados)

**Tags:** #feature #bugfix #decision #prisma #critical #integration
**Agentes envolvidos:** Scout (2x) → Echo (2x) → Vault (2x, 🟢🟢) → Nova (2x) → correções diretas do Bibble
**Arquivos tocados:**
- `prisma/schema.prisma` — `clientes.cnpj @unique` → `@@unique([cnpj, servicos])`; novo model `HistoricoAlteracaoCliente`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` — reposicionamento de campo, cards absorvendo bloco de gestão, edição inline, loading state do botão salvar
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx` — cadastro manual: UF separado do Regime, 3 campos novos, uso do `ModalSelecionarUsuario`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalLogAuditoria.tsx` — reescrito por completo (agrupamento por lote, reversão por campo, `AlertDialog`)
- `src/components/ModalSelecionarUsuario.tsx` *(CRIADO)* — modal reutilizável de seleção de usuário real por role
- `src/components/DropdownSelecaoComCriacao.tsx` — extensão com prop `onAbrirModalOutro`
- `src/actions/clientes.ts` (ou equivalente) — `reverterCampoHistorico` (nova), `salvarAlteracoesGestao` e `restaurarVersaoCliente` removidas
- Painel de Metas: `ModalGerenciamentoLeads.tsx` — fix de Zod em Forma de Pagamento

### Contexto
Sessão longa no módulo CS&NPS: permitir CNPJ duplicado por serviço diferente, sincronizar dados do Metas na confirmação de pagamento, resolver vários ajustes de UX/schema, trocar campos de texto livre (Analista/Closer) por seleção de usuários reais do banco, e — no meio do caminho — descobrir e responder a um incidente real de perda de dados causado por uma migration anterior desta mesma sessão.

### O que foi feito
- Campo "Serviço Contratado" reposicionado para o topo do bloco de gestão no modal de detalhe.
- CNPJ duplicado permitido quando o serviço contratado é diferente: migration `clientes.cnpj @unique` → `@@unique([cnpj, servicos])`, aplicada em produção (Vault, com backup, 238 registros preservados), com mesclagem visual por CNPJ na listagem.
- Sincronização Metas→CS&NPS movida da criação do contrato para a confirmação de pagamento, com reativação correta de registros arquivados.
- 5 ajustes de UX/schema: fix de timezone (-1 dia) na Data Contratação, campo Cidade/município no modal de detalhe, UF separado do Regime no cadastro manual, 3 campos manuais novos (Forma de Pagamento/Valor do Contrato/Closer), formatação de Forma de Pagamento nos cards igual ao Metas.
- Cards de "Serviços Contratados" absorveram o bloco de gestão (Status/Data Contratação/Data Êxito/Analista/Embasamento/Origem do Lead), cada card com botão Salvar próprio; "Editar Dados" ainda libera edição de tudo simultaneamente.
- Analista Responsável e Closer agora listam usuários reais do banco (filtrados por role — OPERACIONAL / COMERCIAL+Líder Comercial), com `ModalSelecionarUsuario.tsx` reutilizável para escolher "outro usuário" de qualquer setor, tanto no cadastro manual quanto na edição por card.
- Fix: toggle de Forma de Pagamento não deselecionava ao clicar de novo.
- Forma Pagto./Valor Contrato/Closer viraram editáveis dentro dos cards (antes sempre readonly), com prioridade de exibição: dado próprio editado > dado do Metas > vazio.
- Fix real no Painel de Metas: ao escolher "outro" em Forma de Pagamento, o texto digitado nunca era salvo (gravava sempre a string fixa "OUTRO") — Zod trocado de `z.enum` para `z.string().min(1)` + payload corrigido.
- Botão "Salvar Alterações" do rodapé do modal de detalhe ganhou loading state (`salvandoDadosFiscais`) para evitar clique duplo.

### Decisões tomadas
- Constraint composta `@@unique([cnpj, servicos])` em vez de `cnpj` sozinho: permite mesmo CNPJ com serviços diferentes, mesclado visualmente na listagem.
- Reconstruir o sistema de log de auditoria do zero (não restaurar o antigo), com granularidade por campo alterado (não mais snapshot JSON do cliente inteiro), `userId` real + `nomeUsuarioNaEpoca` congelado, agrupamento por `loteId`, e reversão por campo específico gerando nova linha `acao: "REVERSAO"` (preserva a cadeia de auditoria em vez de sobrescrever).
- `salvarAlteracoesGestao` (código morto confirmado) e `restaurarVersaoCliente` (sistema antigo) removidos em vez de migrados.
- Regra permanente adotada: sempre rodar `PRAGMA foreign_key_list` em TODAS as tabelas do banco antes de qualquer `DROP TABLE` em produção — não só nas tabelas que a migration pretende tocar.

### Problemas encontrados / resolvidos
- **INCIDENTE GRAVE (perda de dados):** a migration da constraint composta (rename `clientes`→`clientes_old`, drop) deixou FKs fantasma de 4 tabelas satélite (`logAlteracao`, `socios`, `log_cs`, `logFeedback`) apontando para o nome `clientes_old`. O `DROP TABLE clientes_old` cascateou e apagou TODO o conteúdo dessas 4 tabelas (confirmado: 239 clientes reais, 0 registros nas 4 satélites). Não havia backup dessas tabelas — dado histórico de sócios e logs de CS/feedback/alteração perdido permanentemente. Só a FK de `logAlteracao` foi corrigida nesta sessão (recriação de tabela com FK apontando para `clientes`); `socios`/`log_cs`/`logFeedback` continuam com a mesma FK fantasma, mas vazias (sem risco de nova perda).
- `prisma generate` travado por EPERM (DLL bloqueada) — resolvido matando `node.exe`.
- `tsc --noEmit` final: zero erros novos; só os 3 pré-existentes já catalogados (`validator.ts`, `HabilitacaoRadar/page.tsx:494`, `ModalPerfilColaborador.tsx:191`).

### Pendências
- Segurança JÁ registrada, ainda NÃO resolvida: dados financeiros do Metas (valorContrato/formaPagamento/closerNome) expostos no CS&NPS sem restrição de role — usuário adiou a decisão explicitamente.
- Corrigir a mesma FK fantasma para `clientes_old` em `socios`/`log_cs`/`logFeedback` (mesmo padrão usado em `logAlteracao`), numa próxima sessão.
- Pipeline formal de Forge/Anubis/Lens/Sage sobre TODO o escopo desta sessão ainda não rodou por completo (rodou parcialmente) — retomar se o usuário pedir revisão formal completa.

### Refletido também em
- `decisions.md`: 2 entradas novas em 2026-07-13 (incidente de perda de dados + reconstrução do log de auditoria com model `HistoricoAlteracaoCliente`)

---

## 2026-06-11 — Responsividade, Tema e Ajustes Visuais do Chat

### O que foi feito
- Removido botão de colapsar sidebar (`ChevronLeft`/`ChevronRight`) da GlobalSidebar — era inútil e sem função
- Rodapé da empresa no BibbleChatWindow: oculto em mobile (`hidden sm:flex`), tamanho reduzido (280→200px), opacidade menor (60→40%)
- BibbleChatInput: padding mobile reduzido (`px-3 pb-3 pt-2 sm:px-4 sm:pb-4`), textarea `min-h` reduzida em mobile (`min-h-[36px] sm:min-h-[40px]`)
- BibbleChatLayout: sidebar agora abre como overlay/drawer no mobile (Framer Motion, `fixed right-0`, backdrop com `bg-black/60`); desktop mantém comportamento inline. Estado inicial `sidebarOpen` mudou de `true` para `false`
- Sistema de temas integrado: `page.tsx` busca `tema_interface` do usuário no DB (`db.usuarios`), passa como `temaName` para `BibbleChatLayout` → `getTema()` → `tema` (TemaAlpha) propagado para `BibbleChatWindow`, `BibbleChatInput` e `BibbleEmptyState`. Cores do input (bordas, glow, status pill, botão de envio) respondem ao tema do usuário via `tema.accent`

### Decisões tomadas
- `onToggleCollapse` mantido como prop opcional na interface da GlobalSidebar (pai ainda pode passar, componente ignora)
- `sidebarOpen` inicial = `false` para evitar hydration mismatch (seguro para SSR)
- Mobile drawer usa `AnimatePresence` + `motion.div` do Framer Motion (já era dependência do projeto)
- `BibbleSidebarPanel` renderiza duas vezes no DOM quando aberto no mobile (uma no inline desktop — oculta — outra no overlay), porém é seguro pois o componente é prop-driven sem fetches próprios
- `db.usuarios` é o nome correto do modelo Prisma (não `db.user`)

### Arquivos criados/modificados
- `src/components/layout/GlobalSidebar.tsx` — botão removido, imports limpos, prop opcional
- `src/components/BibbleChatHome/BibbleChatWindow.tsx` — rodapé responsivo, prop `tema` adicionada
- `src/components/BibbleChatHome/BibbleChatInput.tsx` — padding mobile, min-h mobile, tema aplicado
- `src/components/BibbleChatHome/BibbleEmptyState.tsx` — prop `tema` adicionada e propagada ao input
- `src/components/BibbleChatHome/BibbleChatLayout.tsx` — overlay mobile, estado inicial, `temaName` prop, `getTema()`
- `src/app/PainelAlpha/page.tsx` — query `db.usuarios` para `tema_interface`, `temaName` passado ao layout

### Erros encontrados e fixes
- `db.user.findUnique` → erro TS: modelo chama `db.usuarios` no Prisma schema

### Pendências para próxima sessão
- BibbleSidebarPanel não usa o tema ainda (botão "Nova conversa" e sessão ativa ainda hardcoded indigo)
- Testar visualmente em viewport 375px e 768px no browser

---

## 2026-06-11 — Fix: Notificações de Chamados (som tocava mas visual não aparecia)

### O que foi feito
- Diagnóstico completo do sistema de notificações: Pusher hook (`useAdminChamadosNotifications`), store Zustand (`useChamadoNotificacoes`), componente toast (`NotificationToast`)
- Identificada e corrigida a causa raiz do bug: `NotificationToast` usava `notificacoes.length` como dep do `useEffect`, mas o store limita o array a 50 itens via `.slice(0, 50)`. Quando o array já estava cheio, uma nova notificação trocava a mais antiga mas o `length` permanecia 50 — o efeito nunca disparava, o som tocava mas o toast não aparecia
- Secundariamente: `lastCount` era state (não ref), criando risco de stale closure
- Fix: substituído `lastCount` state por `lastShownIdRef = useRef<string | null>(null)`, dep mudada de `[notificacoes.length]` para `[notificacoes]`, lógica simplificada para comparar o ID da notificação mais recente com o último mostrado

### Decisões tomadas
- Subscrever ao array `notificacoes` completo (não apenas `.length`) para capturar qualquer mutação, incluindo quando está no limite de 50 itens
- Usar `useRef` em vez de `useState` para `lastShownIdRef` — sem re-renders desnecessários, sem stale closure, sempre tem o valor atual

### Arquivos criados/modificados
- `src/components/chamados/NotificationToast.tsx` — lógica do useEffect reescrita, `lastCount` state removido, `lastShownIdRef` adicionado, deps corrigidas

### Erros encontrados e fixes
- Bug root cause: `.slice(0, 50)` no store mantém length constante quando cheio → dependência em `length` não detecta nova notificação quando array está no limite → fix: dep no array inteiro + comparação por ID

### Pendências para próxima sessão
- BibbleSidebarPanel não usa o tema ainda (botão "Nova conversa" e sessão ativa ainda hardcoded indigo)

---

## 2026-06-18 — Campo `tipo` nos Templates de Onboarding + Integração Template Parceiro

**Tags:** #feature #integration #prisma #nextjs
**Agentes envolvidos:** Scout → Vault → Echo → Nova → Forge → Probe → Lens → Scribe

### O que foi feito
- Aplicado campo `tipo String @default("USUARIO")` ao banco SQLite via `npx prisma db push` (campo já existia no schema mas não estava sincronizado com o banco)
- `criarTemplateOnboarding` e `atualizarTemplateOnboarding` em `src/actions/onboarding.ts` passaram a aceitar e salvar o campo `tipo`
- Nova action `getTemplateParadaoParceiro()` — busca template ativo do tipo `"PARCEIRO"` ordenado por `padrao desc, createdAt desc`
- `GestaoOnboardingClient.tsx` atualizado: `FormState` com `tipo`, Select "Tipo de Template" no formulário, `useEffect` para trocar mensagem default conforme tipo selecionado, badges visuais por tipo nos cards da listagem
- `src/app/PainelAlpha/Parceiros/novo/page.tsx` — substituída query inline `setor: "parceiros"` por `getTemplateParadaoParceiro()`; busca agora é por `tipo: "PARCEIRO"` via action dedicada
- Pipeline completo: Forge ✅ (70/70 páginas), Probe ✅ (10/10 itens), Lens ⚠️ aprovado com 2 ressalvas não-bloqueantes

### Decisões tomadas
- **SQLite sem enum nativo** → `String @default("USUARIO")` + validação Zod pendente (não bloqueante)
- **`getTemplateParadaoParceiro` sem `auth()`** — intencional: action read-only, chamada exclusivamente de Server Component que já verificou sessão via `auth()`. Lens recomendou adicionar por consistência, mas não bloqueante dado que dado retornado não é sensível
- **`db push` em vez de `migrate dev`** — dev local, campo com DEFAULT, SQLite: seguro e direto
- **`useEffect` para swap de mensagem** — permitido em `"use client"` pois não é fetch; muda estado derivado de outro estado. Lens sugeriu alternativa via `onValueChange` (opcional, não implementada)

### Arquivos criados/modificados
- `prisma/schema.prisma` — campo `tipo` aplicado ao banco (já existia no schema)
- `src/actions/onboarding.ts` — `criarTemplateOnboarding` e `atualizarTemplateOnboarding` com `tipo`; nova `getTemplateParadaoParceiro()`
- `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx` — `FormState` com `tipo`, Select, `useEffect`, badges
- `src/app/PainelAlpha/Parceiros/novo/page.tsx` — usa `getTemplateParadaoParceiro()` em paralelo com query de tema

### Erros encontrados e fixes
- `prisma generate` EPERM (rename query_engine-windows.dll.node) — DLL bloqueada pelo dev server. Não crítico; `prisma db push` concluiu com sucesso e build não foi afetado
- Erros TypeScript pré-existentes (`.next/types/validator.ts:657`, `HabilitacaoRadar/page.tsx:494`) — não introduzidos nesta sessão, já existiam antes

### Pendências para próxima sessão
- Adicionar `const session = await auth(); if (!session) return null;` em `getTemplateParadaoParceiro` (consistência de padrão)
- Adicionar `z.enum(["USUARIO","PARCEIRO","CLIENTE"])` na validação de `tipo` em `criarTemplateOnboarding` e `atualizarTemplateOnboarding`
- Tipo `CLIENTE` existe no banco e na UI mas sem lógica de busca/exibição implementada (reservado para futuro)

---

## [2026-06-19] — Integração Tika para leitura de PDF no Bibble e Onyx

**Tags:** #feature #bugfix #integration #nextjs #critical
**Agentes envolvidos:** Scout → Echo → Forge
**Arquivos tocados:**
- `src/lib/bibble/tika.ts` *(CRIADO)*
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/upload-to-blob/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `.env.local`

### Contexto
Bibble e agentes Onyx não conseguiam ler PDFs. O Tika (Apache Tika 3.3.1) já estava instalado no servidor Onyx (`http://192.168.35.113:9998`) mas não estava integrado ao PainelAlpha.

### O que foi feito
- **Diagnóstico**: `pdf-parse` atualizado para v2 quebrou a API — `(await import("pdf-parse")).default` retornava `undefined` (v2 exporta `{ PDFParse }` classe, não função). Código anterior causava `TypeError: pdfParse is not a function` silenciado no `catch`.
- **Criado `src/lib/bibble/tika.ts`**: helper centralizado com `extractTextFromBuffer` e `extractTextFromUrl`. Usa Tika como primário via `PUT /tika` com `Accept: text/plain`. Fallback automático para `pdf-parse v2` (`new PDFParse({ data: buffer }).getText()`) se Tika estiver fora do ar. Suporta PDF, DOCX, XLSX, PPTX, ODT, RTF, HTML, XML.
- **`upload-to-blob/route.ts`**: substituiu lógica de extração inline por `extractTextFromBuffer` do Tika. Ampliou tipos permitidos (PPTX agora aceito).
- **`bibble/chat/route.ts`**: função `extractFilesContent` reescrita — usa `extractTextFromUrl` do Tika para documentos; texto puro segue fetch direto; imagens/vídeos seguem caminho próprio. Removida dependência direta de `pdf-parse`.
- **`onyx/chat/route.ts`**: adicionado suporte completo a arquivos — interface `AttachedFile` com `url`, nova função `buildFileContext` que extrai texto via Tika/fallback e injeta no corpo da mensagem antes de enviar ao Onyx. `finalMessage` substitui `message` na chamada `sendChatMessageStream`.
- **`BibbleChatLayout.tsx`**: `handleSend` passa `filesForChat` também quando agente Onyx está ativo (antes só enviava para Bibble/Ollama).
- **`.env.local`**: adicionado `TIKA_SERVER_URL=http://192.168.35.113:9998`.

### Decisões tomadas
- **Tika como primário, pdf-parse como fallback**: Tika suporta muito mais formatos e já está no servidor; pdf-parse v2 é fallback só para PDFs quando Tika cair.
- **Body do fetch como `ArrayBuffer`** (não `Buffer` nem `Uint8Array`): TS target ES2017 + lib `dom` não reconhece `Buffer`/`Uint8Array` como `BodyInit`. Fix: `buffer.buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer`.
- **Onyx recebe texto extraído no corpo da mensagem**: Onyx não tem API de "documentos" como a Claude API — o texto vai concatenado na mensagem via `buildFileContext`, formato markdown com delimitadores.
- **`TIKA_SERVER_URL`** como env var: mesmo IP que o `ONYX_API_URL` (`192.168.35.113`), mas porta `9998` separada.

### Problemas encontrados / resolvidos
- **pdf-parse v2 API quebrada**: v1 exportava função; v2 exporta classe `PDFParse`. Fix: `new PDFParse({ data: buffer, verbosity: 0 }).getText()` + `parser.destroy()`.
- **TS2769 no tika.ts**: `Buffer` e `Uint8Array` rejeitados como `BodyInit` no tsconfig atual (target ES2017). Fix: cast para `ArrayBuffer` via `buffer.buffer.slice(...)`.
- **`prisma generate` EPERM**: DLL bloqueada pelo dev server (pré-existente, não desta sessão).

### Pendências
- Testar com PDF real enviado via UI para confirmar extração correta end-to-end.
- Considerar cache de extração: PDFs grandes enviados múltiplas vezes reprocessam do zero.

---

## [2026-06-19] — Tika e Onyx via Cloudflare (produção na Vercel)

**Tags:** #integration #decision #infra
**Agentes envolvidos:** Bibble
**Arquivos tocados:**
- `.env.local`
- `src/lib/bibble/tika.ts` *(comentário do topo atualizado)*

### Contexto
O Next.js do PainelAlpha roda na Vercel (nuvem externa), fora da rede `192.168.35.x`. Logo, IPs privados (`192.168.35.113:9998` Tika, `:3000` Onyx) são inalcançáveis de produção.

### O que foi feito
- Confirmado que o usuário expôs Tika e Onyx via Cloudflare Tunnel: `TIKA_SERVER_URL=https://tika.alpha-comex.com/` e `ONYX_API_URL=https://onyx.alpha-comex.com/`.
- Diagnóstico dos túneis: **Onyx responde 200** ✅; **Tika falha handshake SSL** (HTTP 000) — túnel do Tika ainda não funcional (falta entrada no config.yml do cloudflared ou cert SSL não propagado).

### Decisões tomadas
- **Cloudflare Tunnel é o caminho correto** (mesmo padrão de `studio-api.alpha-comex.com`): código não muda, só a env var. `tika.ts` normaliza barra final, então `https://tika.alpha-comex.com/` + `/tika` funciona.
- **Fallback pdf-parse cobre Tika fora do ar**: enquanto o túnel do Tika não sobe, PDFs continuam lidos via fallback; DOCX/XLSX/PPTX ficam indisponíveis até o túnel funcionar.

### Pendências
- Subir o túnel do Tika: adicionar `tika.alpha-comex.com → http://localhost:9998` no config.yml do cloudflared no servidor e reiniciar.

---

## [2026-06-19] — Fix: heartbeat P2025 (sessão órfã)

**Tags:** #bugfix #prisma
**Agentes envolvidos:** Bibble
**Arquivos tocados:**
- `src/app/api/heartbeat/route.ts`

### Contexto
O `/api/heartbeat` (chamado a cada 20s) lançava `PrismaClientKnownRequestError P2025` quando a sessão JWT tinha um email sem usuário correspondente no banco (usuário deletado/renomeado com sessão ativa).

### O que foi feito
- Trocado `db.usuarios.update()` (lança P2025) por `db.usuarios.updateMany()` (retorna `count: 0` sem lançar).
- Se `count === 0`, retorna 404 silencioso (sem `console.error`, sem 500).

### Decisões tomadas
- `updateMany` é o padrão correto para update idempotente onde "registro não existe" não é erro de servidor. O componente cliente `Heartbeat.tsx` já descarta a resposta — 404 não causa efeito colateral.

---

## [2026-06-19] — Fix da memória/contexto das IAs (Bibble e Onyx)

**Tags:** #bugfix #feature #critical
**Agentes envolvidos:** Bibble → Echo → Forge
**Arquivos tocados:**
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleMessageBubble.tsx` *(tipo Message ganhou fullContent)*
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`

### Contexto
As IAs perdiam o contexto logo após responder: enviava-se PDF → análise OK → pergunta de follow-up → IA pedia o PDF de novo. Também perdia o fio em conversas normais.

### O que foi feito
- **Bug 1 (principal): conteúdo do PDF não era persistido.** `saveMessages` salvava só `text` (digitado), não o conteúdo extraído. Agora salva `persistedContent` — mensagem + texto extraído dos arquivos. A bolha mostra label curto (`fullContent` vs `content` na interface Message); ao recarregar a sessão, `splitPersisted()` separa display do conteúdo completo.
- **Bug 2: Onyx ignorava histórico.** Adicionado `history` ao payload e `buildHistoryContext()` no route — injeta histórico só quando `onyxSessionId` é novo (zerou), evitando duplicar o que o Onyx já mantém.
- **Bug 3: histórico fixo em 10 msgs.** Substituído `slice(-10)` por janela com **orçamento de caracteres** proporcional ao `contextWindow` (`ctxTokens * 4 * 0.5`).
- **UI**: settings ganhou preset 256K (max 262144), título "Janela de Contexto · Bibble", texto de ajuda explicando que controla a memória de conversa e que é **só do Bibble** (Onyx gerencia próprio contexto).

### Decisões tomadas
- **Anexar conteúdo do PDF à mensagem persistida** (escolha do usuário) em vez de resumo separado: robusto, funciona igual nos dois sistemas, IA sempre reenxerga o doc.
- **Onyx NÃO tem janela de contexto configurável por agente pelo painel**: a API do Onyx só expõe `num_chunks` (RAG) e override de modelo. Janela real é fixada no servidor Onyx. Não criado controle falso no painel.

### Pendências
- Testar follow-up com PDF real no chat para validar end-to-end.

---

## [2026-06-19] — Conhecimento unificado Bibble ⇄ Onyx

**Tags:** #feature #integration #architecture
**Agentes envolvidos:** Bibble → Scout → Echo → Forge
**Arquivos tocados:**
- `src/lib/shared/painelalpha-knowledge.ts` *(CRIADO)*
- `src/lib/bibble/system-prompt.ts`
- `src/lib/onyx/system-knowledge.ts`
- `src/lib/onyx/client.ts` *(askOnyxOneShot)*
- `src/lib/bibble/tools.ts` *(tool consultar_base_onyx)*
- `src/lib/bibble/tool-executor.ts` *(case consultar_base_onyx)*

### Contexto
Usuário queria conhecimento completo nas duas IAs: agentes Onyx falhavam ao perguntar sobre processos internos (abrir chamado, qualificar lead, etapas da pré-análise); e o Bibble não acessava o que está no Onyx. O prompt que o usuário trouxe pedia RAG/Knowledge Graph/Pinecone — descartado por over-engineering (Onyx já é RAG; dados são vivos no banco, não PDFs estáticos).

### O que foi feito
- **Criada base de conhecimento compartilhada** (`painelalpha-knowledge.ts`): vocabulário interno + processos operacionais (chamado, fluxo lead→tarefa, etapas pré-análise, RADAR, CS&NPS). Fonte ÚNICA de verdade.
- **Direção 1 (Onyx aprende PainelAlpha)**: `system-knowledge.ts` injeta a base nos agentes Onyx (antes só recebiam lista de módulos). Tools em tempo real já existiam via `AGENT_TOOLS` registry.
- **Direção 2 (Bibble acessa Onyx)**: `askOnyxOneShot()` no client (consulta one-shot à base do Onyx, coleta resposta do stream NDJSON) + tool `consultar_base_onyx` no Bibble.
- Base injetada também no system-prompt do Bibble (mesma fonte).

### Decisões tomadas
- **Base de conhecimento de PROCESSOS (texto) + tools em tempo real, NÃO RAG vetorizado**: dados são vivos no banco; vetor desatualizaria. Tool sempre lê estado atual.
- **Fonte única `painelalpha-knowledge.ts`** consumida por Bibble e Onyx: atualizar um processo propaga aos dois.
- **`consultar_base_onyx` é exclusiva do Bibble** (não está no AGENT_TOOLS do Onyx) — evita Onyx consultar a si mesmo / loop. Import dinâmico no executor evita dependência circular.

### Pendências
- **Usuário deve revisar/expandir `painelalpha-knowledge.ts`** — os processos foram inferidos do código; critérios reais (qualificação de lead, etapas obrigatórias do CheckList) precisam de validação humana.

---

## [2026-06-23 18:30] — Parceiros: comprovantes, multi-responsável, termo-histórico + IAlpha: Quem é você?/fixar agentes

**Tags:** #feature #bugfix #integration #prisma #nextjs
**Agentes envolvidos:** Bibble, Kowalski
**Arquivos tocados:** src/actions/parceiros.ts, src/components/Parceiros/{NovoParceiro,DetalheParceiroClient,ModalComprovante,ModalTermo}.tsx, src/app/api/ConsultaCpf/route.ts, src/components/BibbleChatHome/{OnyxAgentsModal,BibbleChatLayout,BibbleSidebarPanel}.tsx, src/lib/onyx/browser.ts, src/app/api/onyx/agentes-fixados/route.ts, prisma/schema.prisma

### Contexto
Várias melhorias no módulo Parceiros e no chat IAlpha (Onyx), além de correção crítica da consulta de CPF que estava quebrada.

### O que foi feito
- **Comprovante de comissão**: envio no PainelAlpha (botão por empresa indicada → ModalComprovante, upload Vercel Blob com token COMISSOES_READ_WRITE_TOKEN, qualquer tipo, substituir/remover) → visto no portal do parceiro (Google Docs Viewer). Colunas comprovante* em `indicacoes`.
- **Termo de adesão editável + histórico**: ModalTermo com abas (Nova versão / Histórico imutável, ver versões antigas só-leitura). Card do parceiro mostra "Assinou: {termoVersao}". Tabela `parceiro_termo`.
- **Telefone 1 e 2** no parceiro (cadastro + detalhe).
- **Multi-responsável físico**: ParceiroResponsavel virou 1:N (removido @unique). UI em GAVETA no NovoParceiro (vários, botão +, um aberto por vez).
- **Data Contratação** no detalhe (vem de clientes.dataContratacao do CS&NPS, formatada).
- **IAlpha**: botão "Quem é você?" separado de "Conversar" (vazio); pino para fixar agentes (máx 3, tabela onyx_agente_fixado); seção "Fixados" no modal + "Seus agentes fixados" na sidebar (clique = conversa nova se vazio, senão adiciona à conversa).

### Decisões tomadas
- Agentes fixados no BANCO (não localStorage): seguem o usuário entre dispositivos.
- Termo: histórico IMUTÁVEL — atualizar sempre cria nova versão e desativa anteriores; versão duplicada bloqueada.
- Comprovante: Blob público (URL direta) + Google Docs Viewer p/ renderizar Word/Excel/PDF inline.
- Multi-responsável usa a tabela ParceiroResponsavel existente (1:N), não a de representantes.

### Problemas encontrados / resolvidos
- **CPF consulta 404 + nunca funcionava**: 2 bugs combinados na InfoSimples — (1) campo é `birthdate`, não `data_nascimento` (dava code 606); (2) formato é AAAA-MM-DD (ISO), não DD/MM/AAAA (dava code 607). Testado: 2003-10-25=code 200 ✓. O "404" no browser era a rota retornando status 404 em erro de consulta → trocado p/ 422.
- **"Erro ao atualizar termo" sem log**: catch vazio engolia + Prisma Client stale (db.parceiroTermo undefined). Fix: prisma generate + restart + catch loga erro real.
- **Status do portal "front igualzinho"**: corStatus não mapeava "Deferido"/"Stand By" (status reais do CS&NPS) → caíam no cinza. Corrigido com status reais.
- **Tooltip atrás da gaveta**: era overflow-hidden do card cortando, não z-index. Removido overflow + z-50.
- **Regra de nível no aviso**: corrigido — indicar SOBE o nível (PLATINUM→BLACK 15%), não "mantém".

### Pendências
- Reiniciar dev servers (Prisma Client regenerado várias vezes: parceiro_termo, telefone2, multi-responsável, onyx_agente_fixado).
- Texto oficial do termo (hoje placeholder, editável via UI).
- DetalheParceiroPage.tsx órfão (import quebrado, não usado) polui tsc — não removido (não foi criado por nós).

### Refletido também em
- Memória de sessão (Claude): project_parceiros.md, project_integracao_onyx.md, project_alphaparceiros_portal.md atualizados.
- Banco Turso (já aplicado): +5 colunas comprovante* em indicacoes, parceiro_termo, parceiro_responsavel índice unique→normal, parceiros +telefone/telefone2, onyx_agente_fixado.

---

## [2026-06-23 19:10] — Metas: Habilitação RADAR 50K contabilizava venda indevidamente

**Tags:** #bugfix #critical #prisma
**Arquivos tocados:** src/actions/ContratoComercial.ts

### Contexto
No módulo de Metas, Habilitação RADAR 50K estava contando como venda. Regra: só Revisão RADAR 150K e ILIMITADO contam.

### O que foi feito
- `confirmarFechamento` setava `contaComVenda: true` HARDCODED. Agora usa helper `servicoContaComoVenda(servico)` — lista de inclusão estrita: só "Revisão RADAR" + (150K ou ILIMITADO).
- Corrigidos dados no Turso (1 ILIMITADO estava conta=0 inconsistente → 1). Estado final: 50K=0, 150K=1, ILIMITADO=1.

### Decisões tomadas
- Lista de inclusão ESTRITA: qualquer serviço que não seja Revisão RADAR 150K/ILIMITADO NÃO conta (inclui 50K, TTD, AFRMM futuros).
- Metas.ts:50 e tool-executor.ts:592 já filtravam `where: contaComVenda:true` corretamente — o bug era só na ESCRITA (fechamento).

### Problemas encontrados / resolvidos
- **Helper inicial bugado**: usei `.replace(/[^a-z0-9]/g,"")` para normalizar → removia acentos ("revisão"→"reviso") e o `includes("revisao")` nunca casava → retornava false p/ TUDO. Fix: `.normalize("NFD").replace(/diacríticos/,"")` ANTES de filtrar.
- **Quase corrompi dados**: primeiro UPDATE ia marcar 150K/ILIMITADO como 0 (helper bugado) — salvou que os IDs são cuid (string) e o UPDATE sem aspas falhou. Sempre testar helper isolado ANTES de UPDATE em massa.

### Refletido também em
- known-errors.md: bug do normalize de acentos.

---

## [2026-06-23 20:30] — Chat IAlpha: visão (modelo lê imagens) + preview visual de anexos (estilo GPT)

**Tags:** #feature #integration #claude-api
**Arquivos tocados:** src/app/api/bibble/chat/route.ts, src/app/api/onyx/chat/route.ts, src/lib/bibble/client.ts, src/lib/onyx/client.ts, src/components/BibbleChatHome/{BibbleChatLayout,BibbleMessageBubble}.tsx

### Contexto
Chat (Bibble e agentes Onyx) não lia imagens — imagem virava só texto-link pro modelo. Pedido: modelo enxergar a imagem + preview bonito na conversa (inline, lightbox sem nova aba, baixar), igual ao GPT.

### O que foi feito
- **Bibble (visão)**: `/api/bibble/chat` — imagem deixou de ser texto-link; agora `content` da msg do user vira ARRAY multimodal `[{type:text},{type:image_url:{url:data-base64}}]` (OpenAI-compat). `coletarImagensBase64` baixa do Blob público e converte. Helper `modelSupportsVision(modelId)` em client.ts; se modelo sem visão → injeta aviso "troque de modelo ou contate admin".
- **Onyx (visão)**: `uploadChatFiles()` (POST /api/chat/file → file_descriptors) + `fileDescriptors` no `sendChatMessageStream`. Rota faz upload das imagens pro Onyx e passa os descriptors → agente enxerga.
- **Preview visual** (`BibbleMessageBubble`): `Message.files` ganhou url/size. Componente `AnexoPreview` — imagens inline (grid, hover com ampliar/baixar) + lightbox modal full no próprio chat (ESC fecha, sem nova aba) + docs como chip clicável. Resposta do assistente: `ImagemRespostaMarkdown` (img do markdown) também com lightbox+baixar (antes abria em nova aba). `baixarArquivo()` força download via blob.
- handleSend passa `filesForBubble` (url do Blob) no userMsg; texto da bolha ficou limpo (sem prefixo "[Arquivos:...]").

### Decisões tomadas
- Base64 inline pra imagem (robusto, funciona com Blob privado/offline).
- Modelos com visão: GPT-4o/4.1, todos Claude, todos Gemini, e Ollama só gemma3/llava/llama3.2/vision/minicpm/-vl. Resto não tem visão.
- Onyx usa file_descriptors (mecanismo nativo dele), não base64.

### Pendências
- Testar o endpoint /api/chat/file do Onyx com a API real (assumido o formato padrão {files:[{id,type,name}]}).

### Refletido também em
- known-errors.md: imagem como texto-link não funciona (precisa content multimodal).

---

## [2026-06-26] — Identidade Onyx por usuário (token_onyx)

**Tags:** #feature #security #auth #prisma #integration
**Agentes envolvidos:** Bibble → Vault → Echo → Anubis
**Arquivos tocados:**
- `prisma/schema.prisma` (campo token_onyx em usuarios)
- `src/lib/onyx/client.ts`, `src/lib/onyx/user-token.ts` *(CRIADO)*
- `src/app/api/onyx/chat/route.ts`, `src/app/api/onyx/agents/route.ts`, `src/app/api/onyx/agents/[id]/route.ts`, `src/app/api/onyx/agents/upload-image/route.ts`
- `src/actions/CreateAction.ts`, `src/actions/ColaboradorRH.ts`, `src/actions/get-user.ts`
- `src/components/FormCadastro.tsx`, `src/components/Colaboradores/ModalPerfilColaborador.tsx`

### Contexto
Usuário queria que cada usuário do Painel falasse com o Onyx pela conta DELE (não pela conta de serviço admin ti@alpha-comex.com). Diagnóstico: modelo era conta de serviço única (PAT em ONYX_API_KEY); só a memória era separada via texto.

### O que foi feito
- Campo `token_onyx String?` (opcional) em `usuarios`. Helper `getUserOnyxToken(sessionUserId)` resolve o token pelo id da SESSÃO (nunca do corpo).
- Client Onyx (`authHeaders`/`onyxFetch`) aceita `userToken` que sobrescreve o PAT de serviço. Propagado em chat, createAgent, updateAgent, deleteAgent, uploadAgentImage, uploadChatFiles.
- Campo no cadastro (FormCadastro) E na edição (ModalPerfilColaborador). Token NUNCA volta ao cliente — só booleano `tem_token_onyx`. Edição só admin/CEO.
- Anubis achou e corrigiu vazamento PRÉ-EXISTENTE em `get-user.ts` (findMany sem select expunha senha/reset_token/token_onyx ao client).

### Decisões tomadas
- **PAT por usuário guardado no banco** (escolha do usuário) em vez de SSO/OAuth (mais correto mas é infra no servidor Onyx, fora do código).
- **Provado por teste real**: token individual → Onyx `/api/me` retorna o usuário certo; criar agente → `owner` é o usuário, não admin. Backend 100% funcional.
- **Operações admin globais** (criar skill custom, modelo de imagem global) seguem no token de serviço — não fazem sentido por usuário.

### Problemas encontrados / resolvidos
- Diagnóstico crítico: o app NÃO usa o `dev.db` (DATABASE_URL) — usa adapter `PrismaLibSql` direto no Turso via `TURSO_DATABASE_URL`. `prisma db push` atinge só o dev.db local (vazio). Para produção, ALTER TABLE manual no Turso.

### Pendências
- **Rodar no Turso**: `ALTER TABLE usuarios ADD COLUMN token_onyx TEXT;`

---

## [2026-06-26] — Imagens no chat: reidratação, upload (307), lightbox + edição/interrupção

**Tags:** #feature #bugfix #integration #critical
**Agentes envolvidos:** Bibble → Scout → Vault → Echo → Nova → Forge
**Arquivos tocados:**
- `prisma/schema.prisma` (onyxSessionId em BibbleSession)
- `src/lib/onyx/client.ts` (getChatSession, uploadChatFiles novo endpoint)
- `src/app/api/onyx/session/[id]/route.ts` *(CRIADO)*, `src/app/api/onyx/chat/route.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `BibbleMessageBubble.tsx`, `BibbleMessageList.tsx`, `BibbleChatWindow.tsx`

### Contexto
Múltiplas dores de imagem no chat com agentes Onyx: conversa volta vazia ao recarregar; agente não lê imagem enviada; imagem gerada não renderiza; lightbox preso na bolha; pedido de editar mensagem e interromper.

### O que foi feito
- **Reidratação (CR#2)**: `onyxSessionId` na BibbleSession (Onyx = fonte de verdade). Rota `GET /api/onyx/session/[id]` lê histórico do Onyx (texto + imagens via files[]) e reidrata ao reabrir. Imagens viram markdown `![](/api/onyx/file/{id})`.
- **Upload quebrado (CR#1, a principal)**: `POST /api/chat/file` dá 307 (descontinuado). Trocado para `POST /api/user/projects/file/upload`; parsing `user_files`; descriptor agora carrega `user_file_id` (obrigatório, senão Onyx rejeita "no project_id"). VALIDADO por teste real: agente passa a ler a imagem.
- **Markdown de imagem quebrado**: alt com prompt gigante multi-linha quebrava `![](url)`. `sanitizeImageMarkdown` (front) + alt curto no backend.
- **Lightbox preso na bolha**: backdrop-filter da bolha criava containing block, prendendo o `position:fixed`. Componente `ImageLightbox` via `createPortal` no body. Preview `object-cover`→`object-contain`.
- **Editar mensagem (lápis)**: rebobina conversa até a msg, reenvia. **Interromper**: texto/arquivos voltam pra caixa, remove o par de mensagens.

### Decisões tomadas
- **Onyx = fonte de verdade do histórico** de conversas com agente (não duplicar no Prisma). Salva só onyxSessionId no Painel.
- **Defesa em 2 camadas** para markdown de imagem: backend sanitiza ao emitir, front sanitiza ao renderizar (cobre agente que ecoa o markdown no texto).
- **Lightbox via portal** é obrigatório quando o ancestral tem backdrop-filter/transform/overflow.

### Problemas encontrados / resolvidos
- 307 no upload → endpoint novo (catalogado em known-errors).
- Markdown de imagem com alt multi-linha → sanitização.
- `position:fixed` preso → portal.

### Pendências
- **Rodar no Turso**: `ALTER TABLE bibble_session ADD COLUMN onyxSessionId TEXT;`
- Reiniciar `npm run dev` para validar end-to-end (matei processos node na sessão).

### Refletido também em
- decisions.md: Onyx fonte de verdade do histórico; lightbox via portal.
- known-errors.md: upload 307 do Onyx.

---

## [2026-06-29] — Módulo Conectores IAlpha (UI de gestão de RAG do Onyx)

**Tags:** #feature #integration #onyx #nextjs
**Agentes envolvidos:** Scout → Echo → Nova/Iris → Forge → Probe → Anubis → Lens → Scribe

### Contexto
Pedido: UI completa e funcional no PainelAlpha para os Conectores do Onyx (192.168.35.113:3000 / onyx.alpha-comex.com), com as mesmas funcionalidades. Decisões do usuário: escopo CRUD completo · acesso via módulo próprio com permissão · rota dedicada /PainelAlpha/Conectores.

### O que foi feito
- **API do Onyx mapeada** via openapi.json (743KB). Descobertas-chave: indexing-status é POST (não GET), agrupado por source; reindex = run-once (connector_id + credential_ids); criar = credencial→connector→link (PUT connector/cred)→run-once; upload em /manage/admin/connector/file/upload.
- **client.ts** (+~330 linhas): seção Conectores — listConnectorIndexingStatus, getCCPair, setCCPairStatus, renameCCPair, runConnectorOnce, deleteCCPair, createConnector/updateConnector, linkConnectorCredential, listCredentials/createCredential/deleteCredential, listDocumentSets/createDocumentSet/updateDocumentSet/deleteDocumentSet, uploadConnectorFiles.
- **Guard** `connectors-guard.ts`: authorizeConnectors() — auth() + Admin/CEO ou permissão conectoresIAlpha. Usado em todas as rotas.
- **Rotas** `/api/onyx/connectors/{route,[ccPairId],credentials,document-sets,upload}` — proxy autorizado; PAT só no server.
- **Registry**: 1 entrada conectoresIAlpha (categoria admin, allowedRoles Admin/CEO, iconName Cable). Ícone Cable somado ao import + ICON_MAP da GlobalSidebar.
- **UI** `ConectoresClient.tsx`: abas (Conectores/Document Sets/Credenciais), tabela com status colorido + polling 15s, ações reindex/pause/resume/excluir, modais de detalhe/criação (File/Web/QNAP)/document-set. Página server com guard de permissão.

### Decisões tomadas
- **Criação focada em File/Web/QNAP** (tipos reais do servidor); gestão funciona p/ qualquer conector existente. OAuth (Drive/Slack) fora — exige redirect no servidor Onyx.
- **Acesso por permissão de módulo** conectoresIAlpha (não só admin) — afeta RAG global, por isso restrito.
- **Helper client separado** (connectors-browser.ts) com tipos espelhados — nunca importa client.ts (sem PAT no bundle).

### Problemas encontrados / resolvidos
- **indexing-status dava 405** com GET → é POST. Descoberto via openapi.json.
- **Tailwind v4: classes dinâmicas** `bg-${cor}-600/15` não são geradas → trocado por classes estáticas via prop `box`.
- **react-hooks/set-state-in-effect** (React Compiler) barrava o fetch+polling no useEffect → aplicada a convenção do projeto (eslint-disable-next-line com comentário), como em ChatChamado/PainelLayoutClient/ModalTermo etc.
- **EPERM no `prisma generate`** durante build (DLL travada pelo dev server, erro conhecido) → rodado `npx next build` direto. Build EXIT=0, rota /PainelAlpha/Conectores compilada.

### Aprendizado importante (Scribe)
- **CLAUDE.md desatualizado**: integração de módulo virou MODULOS_REGISTRY único (1 entrada), não os 3 arrays manuais (FormCadastro/Atalhos/PainelAlphaClient). FormCadastro não tem mais lista inline; Atalhos não tem MODULOS_BASE. Registrado na memória Claude (project_modulos_registry).

### Pendências
- Testar criação real de conector Web/QNAP end-to-end (File já é o padrão usado).
- Considerar trocar alert()/confirm() por toasts do projeto (não-bloqueante).
- Tsc tem 4 erros PRÉ-EXISTENTES (validator.ts, HabilitacaoRadar:494, DetalheParceiroPage órfão) — não desta feature.

---

## [2026-06-29] — Conectores IAlpha: galeria visual estilo Onyx (logos de marca + guia por conector)

**Tags:** #feature #ui #onyx #nextjs
**Agentes envolvidos:** Scout → Nova/Iris → Forge → Probe → Lens → Scribe

### Contexto
Usuário pediu que os conectores ficassem visíveis como no Onyx (Gmail, Drive, Discord, etc.), porque usuários leigos não entendem só os 3 tipos do form. Decisões: mostrar TODOS (~60), ícones de marca reais, e ao clicar explicar o que precisa ter no arquivo e como configurar + formulário funcional.

### O que foi feito
- **simple-icons** instalado (npm) para logos de marca reais. Componente `src/components/Conectores/BrandIcon.tsx` — renderiza o SVG da marca (import named tree-shakeable) ou um ícone lucide colorido de fallback (Slack/Salesforce/SharePoint/Teams/S3/Oracle não existem no simple-icons → fallback).
- **CONNECTOR_CATALOG** (connectors-browser.ts): ~60 sources do Onyx, cada um com label, categoria, brandSlug, cor, availability (ready/credential/server), descrição, requisitos, formato, passos, configFields, credentialFields. + CONNECTOR_CATEGORIES + availabilityMeta().
- **Galeria** no modal "Conectar uma fonte" (ConectoresClient): grid de cards com logo + selo de disponibilidade + busca + filtro por categoria. Ao clicar → `DetalheConector`: guia ("O que você precisa ter" / "Como o conteúdo deve estar" / "Passo a passo") + formulário funcional. SourceIcon da tabela também passou a usar catálogo+BrandIcon.

### Decisões tomadas
- **OAuth desabilitado no servidor** (confirmado via /api/connector/oauth/details/{source} → oauth_enabled:false para todos). Logo, conectores Google/Slack/etc. exigem credencial manual (token/JSON), não botão "conectar com Google". A UI marca como "server"/"credential" e explica como obter.
- **simple-icons em vez de 60 PNGs**: sem versionar assets; logos coloridos por hex da marca.
- **Mostrar todos (~60)** mas com selo honesto de disponibilidade — não promete criar na hora o que precisa do time técnico.

### Problemas encontrados / resolvidos
- Vários slugs simple-icons inexistentes (Slack, Salesforce, SharePoint, Teams, S3, Oracle — removidos por marca registrada) → BrandIcon cai no fallback lucide colorido.
- IDs duplicados/errados no catálogo por copy rápido (Discourse com id zendesk, Gong com id freshdesk, Egnyte-Sharepoint lixo) → corrigidos para o DocumentSource real.
- Build: EPERM no prisma generate (conhecido) → `npx next build` direto. EXIT=0, rota compilada.

### Gate
- Forge: tsc (só 4 erros PRÉ-EXISTENTES), lint limpo, build EXIT=0. ✅
- Probe/Lens: galeria integrada ao modal existente; sem novo integration point.

### Pendências
- Validar criação real de um conector "credential" (ex: Notion/Slack) com token de verdade end-to-end.

---

## [2026-07-02 00:00] — Extratos Bancários: pipeline de 2 agentes IA → 1 agente único (Organizador)

**Tags:** #refactor #integration #onyx
**Agentes envolvidos:** Scout, Echo, Forge
**Arquivos tocados:** `src/lib/onyx/extrato-agents.ts`, `src/app/api/onyx/extrato/route.ts`, `.env.local`, `.bibble/memory/decisions.md`

### Contexto
Usuário pediu para remover os agentes de IA do trabalho de extração/classificação de extratos bancários, usar Tika puro (OCR sem IA) para extrair o texto, e deixar o agente novo "Organizador de Extratos Bancários" (criado por ele no Onyx, ID 32) como único responsável por interpretar o texto do Tika e classificar cada valor na coluna correta.

### O que foi feito
- Removidas as constantes `AGENT_EXTRATOR_ID` (25) e `AGENT_NORMALIZADOR_ID` (26) — agentes já deletados do Onyx pelo usuário.
- Criada `AGENT_ORGANIZADOR_ID` (env `ONYX_AGENT_ORGANIZADOR_ID`, default `32`).
- Fundidos `PROMPT_EXTRACAO` + `PROMPT_NORMALIZACAO` em um único `PROMPT_ORGANIZACAO`.
- `processarExtratoPorAgentes` agora faz só 2 passos: Tika extrai texto bruto (inalterado) → 1 chamada ao agente Organizador → parse do JSON final.
- JSDoc de `src/app/api/onyx/extrato/route.ts` atualizado para refletir o novo fluxo.
- `ONYX_AGENT_ORGANIZADOR_ID=32` adicionado ao `.env.local`.

### Decisões tomadas
- Manter o nome da função `processarExtratoPorAgentes` (plural) para não quebrar o import na rota — decisão de mínima fricção, não trocado por singular.
- Contrato de saída (`[{data, descricao, valor}]`) mantido idêntico — zero mudança no frontend (`ModalUploadExtrato.tsx`, `SalvarTransacoesLote`).

### Problemas encontrados / resolvidos
- `npm run build` falhou com EPERM no Prisma Client DLL (processo `node.exe` antigo segurando o arquivo). Resolvido matando os processos Node.js fora do Cursor, com autorização explícita do usuário — depois `build` passou limpo.

### Gate
- Forge: tsc limpo nos arquivos alterados (3 erros pré-existentes em módulos não relacionados), eslint limpo, build EXIT=0 com `/api/onyx/extrato` compilado. ✅
- Sem mudança de schema Prisma → Vault não acionado. Sem mudança de UI/menu/permissões → Probe não acionado.

### Pendências
- Testar com um PDF de extrato real (múltiplas páginas) para confirmar que o agente único aguenta o volume de texto sem degradar a extração.

### Refletido também em
- `decisions.md`: entrada "2026-07-02 — Pipeline de Extratos Bancários: Tika puro (OCR) + 1 agente único (Organizador)".

---

## [2026-07-09 00:00] — Reescrita completa do módulo de Extratos Bancários

**Tags:** #feature #refactor #bugfix #critical #security #decision
**Agentes envolvidos:** Scout, Vault, Echo, Nova, Forge, Probe, Anubis, Lens, Sage, Scribe
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/{Extratos,transacao,bancos,periodos}.ts`, `src/lib/validations/extrato.ts` (novo), `src/lib/onyx/extrato-agents.ts`, `src/components/Extratos/*` (9 arquivos novos), `src/components/ui/animated-shader-background.tsx`, `src/app/PainelAlpha/ExtratosBancarios/page.tsx` e `[Id]/page.tsx`, `next.config.ts`

### Contexto
Usuário pediu para refazer o módulo de Extratos Bancários "de cabo a rabo" (páginas, modais, pipeline OCR/IA, background animado novo) após meses tentando acertar o sistema, delegando as decisões de arquitetura ao squad com o único critério "quero funcionando". Precedeu esta reescrita, na mesma sessão, o fix de 2 bugs em produção do pipeline OCR (polyfill de `DOMMatrix` + worker do `pdfjs-dist` ausente no bundle da Vercel — já commitados e deployados antes da reescrita começar).

### O que foi feito
- **Vault**: migrou `Transacao.data` de `String` para `DateTime?` + `dataOriginalTexto` direto em produção (Turso), com backup completo prévio (1015 registros em JSON+SQL).
- **Echo**: reescreveu as 4 Server Actions com Zod + paginação real (`skip`/`take`) + `auth()` (faltava em `bancos.ts`/`periodos.ts`); reforçou o prompt do agente Onyx contra confundir "saldo do dia" com transação; adicionou validação Zod item-a-item da resposta da IA.
- **Nova**: reescreveu 9 componentes em `src/components/Extratos/`, deletando a estrutura antiga (`[Id]/Modais/*`, `ModalCadastros/`); criou o primeiro componente de paginação server-side real do painel (`TabelaTransacoesPaginada`); integrou background shader Three.js (aurora); primeira adoção de `AlertDialog`/`Badge` do shadcn no projeto inteiro; trocou `<img>` por `next/image`.
- **Forge/Probe**: `tsc`/`lint`/`build` limpos; confirmado zero regressão de integração (menu/rotas/permissões via `MODULOS_REGISTRY` intactos).
- **Anubis**: 1 achado corrigido (log de dados financeiros reais — descrição/valor de transação — no console de `extrato-agents.ts`).
- **Lens**: 2 achados corrigidos (duplicação de lógica de exibição de data entre dois caminhos de código; floating promises em handlers de `ExtratoDetalhe.tsx`).
- **Sage**: testou edge cases contra o banco real de produção — 2 riscos confirmados e corrigidos.
- **Verificação E2E via browser**: 1 bug real encontrado e corrigido (canvas do shader nascia com `width:0` dentro do iframe de módulo do painel).
- **Scribe**: `codebase-map.md` preenchido pela primeira vez com estrutura real do projeto (estava só com template vazio desde a criação).

### Decisões tomadas
- **Arquitetura do pipeline OCR/IA**: mantida a extração determinística (Tika→pdf-parse→PDF24) + interpretação por IA (não voltou a parsers regex por banco, já rejeitados explicitamente pelo usuário em 2026-07-02) — reforçada com prompt few-shot e validação Zod estrita em vez de trocar de arquitetura pela 4ª vez.
- **Schema**: `Transacao.data` virou `DateTime?` (nullable), não `DateTime` obrigatório — decisão puxada pelos dados reais: 272 registros de produção (26,8%) não tinham ano recuperável (`mesReferencia` vazio, formato "DD/MM" só) e o usuário optou por preservar como texto (`dataOriginalTexto`) em vez de inventar um ano.
- **11 registros malformados excluídos**: linhas de "Saldo do dia" que a IA confundiu com transação em execuções passadas — aprovado explicitamente pelo usuário antes da exclusão.
- **Ordenação de transações com data nula**: `nulls: "last"` no Prisma — dados incertos vão para o fim da lista, não poluem a visão do analista.

### Problemas encontrados / resolvidos
- **`prisma generate` travando (EPERM)**: servidor `next dev` do próprio usuário segurando a DLL do Prisma Client — resolvido parando o processo com autorização explícita, regenerando o client, e subindo um novo servidor depois.
- **Ordenação SQL colocava dados "incertos" no topo**: confirmado contra o Turso real (`SELECT ... ORDER BY data ASC` retorna `NULL` primeiro no SQLite) — corrigido com `nulls: "last"`.
- **Paginação não se ajustava após exclusão em lote**: se a página atual ficasse além do novo total, a UI mostrava "nenhum resultado" em vez de voltar para a última página válida — corrigido em `TabelaTransacoesPaginada.tsx`.
- **Canvas Three.js com `width:0`**: `ResizeObserver` sozinho não bastou dentro do iframe de módulo do painel — corrigido com leitura de garantia via `requestAnimationFrame` complementar.

### Pendências
- **Nenhum commit/push feito ainda** — toda a reescrita está no working tree. Próximo passo natural: revisar o diff e acionar DevOps para commit/push (exclusivo dele, conforme regra do projeto).
- Baixar/hospedar localmente os logos de banco (hoje seguem como URLs externas de terceiros, só migradas para `next/image` com `remotePatterns` — ainda não removida a fragilidade da fonte externa).
- `/api/onyx/extrato/reprocessar` não valida o formato de `PaginaComErro[]` com Zod (pré-existente, fora do escopo desta sessão).

### Refletido também em
- `decisions.md`: 2 entradas novas ("2026-07-08 — Reescrita completa... decisão delegada a Bibble" e "2026-07-09 — Migration de Transacao.data executada").
- `architecture.md`: schema atualizado do módulo Extratos, nota sobre `data` nullable.
- `components.md`: catálogo do novo módulo, com destaque para `TabelaTransacoesPaginada` e `AnimatedShaderBackground`.
- `known-errors.md`: 3 entradas novas (DOMMatrix/worker do pdf-parse na Vercel — 2 partes; canvas Three.js width:0 em iframe).
- `codebase-map.md`: reescrito do zero (estava vazio), com padrão de módulo documentado usando Extratos como referência.
---

## [2026-07-14 10:47] — Alpha CheckList: edição, pastas e documentos ZIP

**Tags:** #feature #integration #prisma #nextjs #security #auth
**Agentes envolvidos:** Scout, Vault, Anubis, Forge, Sage, Scribe, Kowalski
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/checklist.ts`, `src/app/PainelAlpha/CheckList/*`, `src/app/api/checklist/[empresaId]/documentos/zip/route.ts`, `src/lib/checklist/items.ts`, `docs/stories/story-checklist-organizacao-e-edicao.md`

### Contexto
Usuário pediu edição global de empresas, alteração posterior de embasamento, filtros, pastas, remoção de dois status operacionais e download dos documentos em ZIP.

### O que foi feito
- Criado `PastaChecklist` e vínculo opcional em `OperacionalClientes`; migration aditiva foi aplicada e confirmada no Turso.
- Implementados edição global, filtros, criação/vínculo de pasta, troca de embasamento que preserva checklists e documentos anteriores, e rota autenticada de ZIP.
- Removidos `FALAR_ANDREW` e `FALAR_DR_EDVAN` do schema e da UI; registros legados foram normalizados para `PENDENTE` (nenhum existente).

### Decisões tomadas
- Troca de tipo ativa/cria o checklist correspondente e preserva o anterior: evita perda de documentos históricos.
- ZIP reúne somente documentos ativos, com limites de tamanho, nomes seguros e bloqueio de URLs não HTTPS/privadas.

### Problemas encontrados / resolvidos
- `npm run typecheck` não existe; o `tsc` encontra três erros preexistentes fora do módulo. `npm run build` continua bloqueado pela DLL do Prisma presa pelo servidor dev; build direto já havia passado.

### Pendências
- Fazer validação autenticada de ponta a ponta dos fluxos de edição e download quando houver sessão de teste disponível.

### Refletido também em
- `codebase-map.md`: Alpha CheckList atualizado.
- `integration-points.md`: rota ZIP, dados e permissões documentados.

---

## [2026-07-14 10:00] — Alpha CheckList: modelos configuráveis de embasamento

**Tags:** #feature #prisma #nextjs #security #integration
**Agentes envolvidos:** Scout, Vault, Anubis, Forge, Scribe, Kowalski
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/checklist{-modelos}.ts`, `src/app/PainelAlpha/CheckList/Embasamentos/*`, `src/lib/checklist/modelos.ts`

### Contexto
Usuário pediu que o responsável crie os documentos de cada embasamento pela interface, incluindo documentos globais, em vez de depender de uma lista fixa no código.

### O que foi feito
- Criado `ModeloItemChecklist`, inicialmente sem itens, e aplicada migration aditiva confirmada no Turso.
- Adicionada a área de configuração com quatro cards de embasamento e formulário de código, nome, descrição, seção, obrigatoriedade e escopo global/específico.
- Criação/troca de checklist passa a copiar os modelos persistidos do tipo escolhido e os globais, preservando checklists históricos.

### Decisões tomadas
- Modelo global usa `tipo = null`: o mesmo registro entra em todos os quatro embasamentos sem duplicação.

### Problemas encontrados / resolvidos
- A build inicial detectou Prisma gerado sem o adaptador; cliente foi regenerado normalmente com o servidor parado e a build passou.

### Pendências
- O responsável precisa cadastrar os primeiros documentos nos modelos; nenhum item padrão foi inserido.

### Refletido também em
- `codebase-map.md`: configuração de modelos documentada.
- `integration-points.md`: novas rotas e regra de cópia documentadas.

---

## [2026-07-14 14:30] — Modo Piadista do Bibble: banco curado substitui Ollama

**Tags:** #fix #bibble #api
**Agentes envolvidos:** Scout, Nova/Echo, Forge, Probe, Kowalski
**Arquivos tocados:** `src/lib/bibble/piadas-bank.ts` (novo), `src/app/api/bibble/piada/route.ts`, `.bibble/piadas-cache.json`

### Contexto
Usuário reclamou que as piadas do modo Piadista eram repetitivas e sem graça. Diagnóstico: o Ollama (gemma) gerava quase sempre a mesma piada — o cache tinha ~250 entradas, mais de 60 delas variações de "o livro de matemática estava triste" — e cada piada ainda repetia 4 vezes (MAX_SHOWN).

### O que foi feito
- Criado `src/lib/bibble/piadas-bank.ts` com **109 piadas curadas e distintas** em pt-BR (animais, objetos, charadas, comida, profissões, cúmulos, fantasia, tecnologia). Para adicionar novas, basta apendar strings no array.
- Rota `/api/bibble/piada` reescrita: sorteia do banco com **rotação sem repetição** — cache guarda índices `vistos` e uma piada só volta depois que o banco inteiro circular (e nunca duas vezes seguidas na virada do ciclo).
- Removida a dependência do Ollama nessa rota (resposta agora é instantânea).
- Cache antigo (`entries`) resetado para o formato novo (`{"vistos":[]}`); leitura tolera formato antigo.

### Decisões tomadas
- Banco estático curado > geração via LLM local para piadas: qualidade e variedade garantidas, zero latência, zero dependência de o Ollama estar de pé.
- Contrato da resposta mantido (`{ piada: string }`) — nenhuma mudança no front (`BibbleSpriteCompanion.tsx`).

### Verificação
- Forge: `tsc --noEmit` sem erros novos (4 erros pré-existentes em ExclusaoFiscal/HabilitacaoRadar/ModalPerfilColaborador, não relacionados); eslint limpo nos arquivos tocados.
- Probe: 6 chamadas reais na rota do dev server → 6 piadas distintas, cache rotacionando corretamente.

### Pendências
- Erros pré-existentes de typecheck citados acima seguem no projeto (fora do escopo desta sessão).

---

## [2026-07-15 12:59] — CS & NPS: importação em lote segura e revisável

**Tags:** #feature #integration #nextjs #prisma #security #auth
**Agentes envolvidos:** Scout, River, Echo, Nova, Anubis, Sage, Forge, Probe, Lens, Scribe, Kowalski
**Arquivos tocados:** `src/app/PainelAlpha/CadastroClientes/page.tsx`, `src/app/PainelAlpha/CadastroClientes/importacao/*`, `src/app/api/cs-nps/{exportar,importar}/*`, `src/lib/cs-nps/*`, `tests/cs-nps/*`, `scripts/smoke-cs-nps-zip-streaming.mjs`, `vitest.config.ts`, `package.json`, `package-lock.json`, `docs/stories/story-cs-nps-importacao-em-lote.md`

### Contexto
Após concluir e formatar a exportação completa do CS & NPS, o usuário pediu uma importação em lote de Sócios, CS e Feedbacks, combináveis livremente, com modelo de planilha, suporte a vários sócios por empresa, revisão detalhada e confirmação explícita antes de gravar.

### O que foi feito
- Criado modal em quatro etapas: seleção dos tipos, download/upload do modelo combinado, prévia revisável e resultado final. O modelo usa CNPJ ou razão social e representa múltiplos sócios em linhas separadas com o identificador da empresa repetido.
- A prévia classifica cada linha, mostra destino e serviço, permite remover itens e exige resolução manual quando há mais de um cadastro candidato; nenhuma empresa é criada automaticamente.
- As três entidades são persistidas em uma única transação Prisma, com revalidação do destino, allowlists, rollback total, resumo por empresa/tipo e auditoria somente de metadados.
- A autorização foi centralizada e aplicada à exportação, modelo, prévia e confirmação: sessão válida, usuário ativo, papel atual Admin/CEO e permissão efetiva `Cliente`.
- O upload recebeu limites explícitos, validação de origem/headers, bloqueio concorrente, rate limit por instância e preflight XLSX/ZIP com `yauzl` por streaming, contando bytes descompactados reais para bloquear zip bomb e metadados falsificados.
- Adicionados Vitest e smoke dedicado; 19/19 testes passaram, incluindo modelo, múltiplos sócios, ambiguidade, ID adulterado, rollback e arquivos hostis.

### Decisões tomadas
- Uma linha por sócio, com CNPJ/razão repetidos: preserva todos os sócios sem exigir colunas numeradas ou alterar o schema.
- Matching exato e escolha manual em ambiguidades: evita vincular dados ao serviço errado quando a empresa possui múltiplos registros.
- Prévia somente no cliente e gravação atômica no servidor: mantém o fluxo removível sem criar rascunhos persistentes ou sucessos parciais.
- Sem migration e sem idempotência persistente nesta entrega: a importação cria apenas filhos nos modelos existentes; uma nova confirmação manual válida pode repetir registros.
- Rate limit em memória por instância como defesa em profundidade: não foi tratado como limite distribuído nem como garantia de idempotência.

### Problemas encontrados / resolvidos
- Metadados ZIP podem mentir sobre o tamanho descompactado: o preflight passou a ler cada entrada por streaming e interromper ao exceder limites reais.
- `npm run typecheck` segue com três erros preexistentes fora do módulo e `npm run build` falhou no `prisma generate` por DLL bloqueada no Windows; os 19 testes, o smoke e `npx next build` passaram, sem erro novo da feature.
- Não havia navegador com sessão Admin/CEO para executar o fluxo visual autenticado; a integração foi validada por código, testes e build, e o teste visual ficou explícito para revisão manual.

### Pendências
- Executar o fluxo visual completo com uma sessão autenticada de Admin/CEO.
- Considerar idempotência persistente por lote se o produto passar a exigir proteção contra reimportações manuais independentes.
- Trocar o rate limit por armazenamento compartilhado caso a aplicação opere com múltiplas instâncias e precise de limitação distribuída.

### Refletido também em
- `codebase-map.md`: módulo de importação, componentes, serviços e testes documentados pelo Scribe.
- `integration-points.md`: novas rotas, autorização compartilhada, transação e hardening do XLSX documentados pelo Scribe.
- `docs/stories/story-cs-nps-importacao-em-lote.md`: critérios, evidências, gates, limites e File List completos.

---

## [2026-07-15 15:50] — IAlpha: sistema solar astronômico realista no background

**Tags:** #frontend #visual #ialpha #astronomia #css
**Agentes envolvidos:** Scout, Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
O usuário achou o background sideral anterior "quase bom" e pediu duas evoluções: (1) sistema solar inspirado em imagem de referência, sem linhas de órbita, sol fora do centro, azul Alpha, com posições dos planetas conforme data/hora real; (2) realismo visual — os planetas pareciam esferas lisas de ilustração básica.

### O que foi feito
- **Efemérides reais sem API externa:** os 8 planetas usam elementos orbitais keplerianos J2000 do JPL (válidos 1800–2050). Equação de Kepler resolvida por ponto fixo, longitude heliocêntrica verdadeira por planeta, recalculada a cada minuto via `useSyncExternalStore` (SSR sem planetas → cliente assume após hidratação, sem mismatch).
- **Validação astronômica:** Terra em 292,9° para 15/jul — confere com o esperado (~293°).
- **Realismo em CSS puro (stack mantida — NÃO é Three.js):** iluminação direcional coerente com o sol da cena (highlight + terminador via atan2), texturas procedurais SVG feTurbulence inline animadas (rotação própria, tilt axial, Vênus retrógrado), faixas de gás anisotrópicas em Júpiter/Saturno, Grande Mancha, anéis de Saturno em gradiente com divisão de Cassini, nuvens da Terra em camada própria, rim atmosférico via inset box-shadow, profundidade por blur+dessaturação, estrelas com temperatura de cor variada, lua da Terra no ângulo real.

### Decisões tomadas
- Cálculo local (Kepler/JPL) > API externa para posições planetárias: zero latência, zero dependência, funciona offline. Registrar como padrão para qualquer feature astronômica futura.
- Texturas por SVG feTurbulence data-URI > imagens em /public: sem requests, sem licença, sem costura, tileável para animar rotação.
- `useSyncExternalStore` com server snapshot null > setState em useEffect: exigência do React Compiler (regra `react-hooks/set-state-in-effect` reprova o padrão antigo).

### Verificação
- Forge: eslint limpo no arquivo; `tsc --noEmit` sem nenhum erro novo (persistem 4 preexistentes já catalogados).
- Probe: verificação visual real no dev server (:3000) — desktop e mobile 375px, centro legível, sem erros novos no console.

### Pendências
- Hydration mismatch preexistente de Radix DropdownMenu (ids `radix-*`) no layout — fora do escopo, aparece como "1 Issue" no overlay do Next dev.

---

## [2026-07-15 16:20] — IAlpha: rotação própria dos planetas ancorada no relógio real

**Tags:** #frontend #visual #ialpha #astronomia #fix
**Agentes envolvidos:** Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
Usuário cobrou: "a rotação está funcionando conforme o horário?? tem que funcionar". Diagnóstico honesto: a translação (posição orbital) já era real, mas o giro das texturas era animação decorativa que começava do zero a cada load, com velocidades inventadas.

### O que foi feito
- Substituído `spinDuration/spinDirection` arbitrários por `rotationPeriodHours` com os períodos siderais reais (Mercúrio 1407,6h; Vênus −5832,5h; Terra 23,93h; Marte 24,62h; Júpiter 9,93h; Saturno 10,66h; Urano −17,24h; Netuno 16,11h; negativo = retrógrado).
- `SPIN_TIME_LAPSE = 900` (1s real = 15min simulados) torna o giro perceptível mantendo as proporções reais entre planetas.
- Fase determinística de `Date.now()`: keyframes CSS `ialpha-planet-spin` + `animation-delay` negativo posicionam cada planeta na face correta para o momento atual. CSS usa o timeline do documento → mantém sincronia com o relógio mesmo com aba em background (melhor que framer/rAF).
- Trocado framer-motion por CSS animation nessas camadas; `useReducedMotion` mostra a fase estática correta sem animar.

### Decisões tomadas
- Períodos reais + fator de aceleração fixo > velocidades inventadas: "conforme o horário" vale para translação E rotação; mesma data/hora → mesma face visível em qualquer máquina.
- `useState(() => Date.now())` para a época do spin (uma vez no mount) — evita reinício da animação a cada tick do minuto.

### Verificação
- Forge: eslint limpo; tsc sem erros novos.
- Probe (browser, getComputedStyle nos 8 planetas): durações exatas (Júpiter 39,7s ... Vênus 23330s), delays de fase não-nulos, Vênus/Urano em `reverse`. Tudo ✅.

### Aprendizado técnico
- O conteúdo do PainelAlpha renderiza dentro de um iframe no preview — `javascript_tool` precisa consultar `iframe.contentDocument`, não o document externo.

---

## [2026-07-15 16:55] — IAlpha: órbitas visíveis com tempo acelerado (padrão planetário)

**Tags:** #frontend #visual #ialpha #astronomia #fix
**Agentes envolvidos:** Nova, Forge, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/components/BibbleChatHome/IAlphaCosmicBackground.tsx`, `docs/stories/story-ialpha-background-sideral.md`, `.bibble/memory/components.md`

### Contexto
Usuário: "não está girando, eles estão fixos na tela". Causa: fidelidade astronômica total = imobilidade visual (Mercúrio anda ~4°/DIA; nenhum movimento orbital é perceptível em tempo real).

### O que foi feito
- Adotado o padrão de planetário: a cena abre nas posições REAIS do céu de agora e o tempo avança acelerado (`ORBIT_TIME_LAPSE = 80000`). Mercúrio orbita em ~1,6min, Terra ~6,6min, Júpiter ~1,3h, Lua em ~29s. Recarregar = ressincronizar com o céu real.
- Tick de cena a cada 2s (`useSyncExternalStore`) + `transition: left/top 2s linear` interpolando = movimento contínuo sem saltos; iluminação/terminador recalculados a cada tick.
- `SPIN_TIME_LAPSE` 900 → 3600: rotação das texturas perceptível (Terra ~24s, Júpiter ~10s), proporções reais mantidas.
- `prefers-reduced-motion` desliga a aceleração (tempo real).

### Verificação
- Forge: eslint limpo, tsc sem erros novos.
- Probe: script com a matemática exata mediu o movimento — Mercúrio 7,3px/s, Terra 3,6px/s em viewport 1280x800.
- ⚠️ Verificação visual in-app bloqueada: a sessão de login do preview expirou no meio dos testes (heartbeat/pusher 401) e o app cai em "Application error" — bug PREEXISTENTE (task registrada para corrigir o redirect gracioso de sessão expirada). Usuário deve validar visualmente após novo login.

### Aprendizados
- "Posições conforme data/hora" e "movimento visível" são fisicamente incompatíveis sem time-lapse; a solução de planetário concilia os dois.
- O conteúdo do painel renderiza dentro de iframe no preview — inspecionar via `iframe.contentDocument`.
- Sessão expirada derruba o cliente no error boundary global em vez de redirecionar limpo — erro conhecido a corrigir.

---

## [2026-07-21] — Habilitação Radar: botão "Excluir do banco" + gate de permissão corrigido

**Tags:** #feature #security #auth #integration
**Agentes envolvidos:** Scout, Echo, Vault, Nova, Forge, Anubis, Lens, Probe, Scribe
**Arquivos tocados:** `src/actions/RadarAction.ts`, `src/components/ComponentesRadar/BotoesModal.tsx`, `src/components/ComponentesRadar/FiltroTabela/FiltroTabela.tsx`, `src/app/PainelAlpha/HabilitacaoRadar/page.tsx`, `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` (novo)

### Contexto
Usuário pediu um botão "Excluir do banco" (roxo escuro) no módulo Habilitação Radar, ao lado do botão "Excluir" existente — que hoje só limpa a tabela local (React state), nunca apagou de verdade do banco de produção.

### O que foi feito
- Descoberto que a Server Action de delete real (`deletarRegistrosBanco`) e boa parte do wiring (`temSelecionadoNoBanco`, `handleDeletarDoBanco`) já existiam no código, **órfãos** — nenhum botão os chamava. Reaproveitados em vez de recriados.
- `deletarRegistrosBanco` ganhou `auth()` (era a única action do arquivo sem checagem de sessão).
- Novo botão roxo escuro (`bg-purple-950`) em `BotoesModal.tsx`, com `AlertDialog` de confirmação (mesmo padrão de `ExtratoDetalhe.tsx`), desabilitado sem seleção no banco ou durante `loading`.
- Removidos 2 props mortos (`temSelecionadoNoBanco`/`onDeletarDoBanco`) de `FiltroTabela.tsx`, nunca usados no corpo do componente.
- `HabilitacaoRadar/page.tsx` reestruturado de Client Component monolítico (~1150 linhas) para Server Component fino com gate de permissão (`auth()` + `getPermissoesEfetivas()`, padrão de `Apresentacoes/page.tsx`). Conteúdo movido, sem alteração de lógica, para `HabilitacaoRadarClient.tsx` (novo).

### Decisões tomadas
- Vault classificou o `deleteMany` filtrado pela seleção do usuário como 🟢 (CRUD normal, não "exclusão em massa irrestrita") — sem exigência de backup pontual, só a rotina diária já estabelecida.
- Usuário aprovou corrigir a lacuna de permissão na mesma sessão, em vez de adiar para tarefa separada.
- `npm run build` não foi executado até o fim (EPERM ambiental no `prisma generate`, processo Node concorrente travando a DLL) — usuário aceitou `tsc`+`lint` limpos como validação suficiente para esta sessão.

### Problemas encontrados / resolvidos
- **Lacuna de segurança pré-existente encontrada pelo Anubis:** `HabilitacaoRadar/page.tsx` nunca verificava a permissão de módulo `radar` — qualquer usuário autenticado no sistema acessava a URL direto. Corrigida na mesma sessão.
- Import `@/auth` não existe no projeto (alias não configurado para o arquivo raiz `auth.ts`) — corrigido para `../../auth`, mesmo padrão de `Extratos.ts`.

### Pendências
- Padrão reutilizável para auditorias futuras: páginas de módulo que são Client Component monolítico sem gate de permissão (mesma classe de lacuna já catalogada para `Apresentacoes` antes de ser corrigida) — vale um passe do Probe/Anubis pelos módulos restantes do painel.
- `npm run build` completo (prisma generate) não foi validado nesta sessão por conflito de processo — rodar isoladamente antes do próximo deploy, se possível.

### Refletido também em
- `codebase-map.md`: nova seção "Consulta RADAR (Habilitação Radar) — Excluir do banco + page.tsx virou Server Component"
- `integration-points.md`: nova seção "Consulta RADAR (Habilitação Radar) — gate de permissão + botão 'Excluir do banco'"

### Atualização (mesma sessão, rodada 2) — usuário reportou "o item continua no banco"

Duas causas raiz reais encontradas e corrigidas:
1. `deletarRegistrosBanco` usava `deleteMany` em lote único e retornava `{success:true}` mesmo quando `count` era 0 (nenhuma linha casada) — reportava sucesso falso. Agora retorna `{ success, count }` e a UI distingue "excluídos" de "não encontrados no banco".
2. `handleBuscar` (consulta individual) nunca marcava `salvo: true` no registro local — `temSelecionadoNoBanco` ficava sempre `false` para CNPJs consultados um a um (o fluxo mais comum), desabilitando o botão silenciosamente.

Redesenho pedido pelo usuário: botão agora mostra a quantidade (`Excluir do banco (N)`), modal de 3 fases (confirmar com contagem → barra de progresso processando CNPJ por CNPJ → resumo final), e a exclusão real **não remove mais a linha da tabela** (só marca `salvo:false`), permitindo reconsulta posterior. `BotoesModal.tsx` ganhou 3 estados locais (`modalExcluirBancoAberto`, `iniciouExclusao`) com a fase derivada no render (evitando `useEffect` + `setState` síncrono, que o lint acusou como novo erro `react-hooks/set-state-in-effect` na primeira tentativa).

### Atualização (mesma sessão, rodada 3) — fundo vivo próprio + bug de mascaramento de erro

**Pipeline:** Scout → Iris (3 opções visuais, usuário escolheu "Varredura Sonar") → Nova → Echo → Forge → Lens (achou 1 gap, corrigido) → Probe (✅) → Scribe.

**Visual:** `RadarBackground.tsx` (novo) — anéis concêntricos + linha de sweep rotativa (`conic-gradient`) + blips piscando, 100% Framer Motion, mesma arquitetura de `ChecklistBackground.tsx` mas identidade própria (sonar, não céu estrelado). `CardComScan.tsx` (novo, reutilizável) — linha de scan vertical no hover, usado em 7 cards do módulo. Descoberta no caminho: já existia um `layout.tsx` no módulo (só `Toaster`+metadata) — mesclado, não sobrescrito, para não perder o `Toaster` do qual todo o módulo depende.

**Bug real corrigido em `ConsultaCompleta/route.ts`:** falha técnica na chamada ao RADAR (timeout/HTTP não-200/config ausente) caía num default `"NÃO HABILITADA"`, mascarando erro real como resposta de negócio válida — o filtro de reconsulta já procurava literalmente por `"ERRO NA CONSULTA"`, mas nada no pipeline produzia essa string, então esses registros nunca eram reconsultados. Mesmo problema quando a Receita Federal falhava: retornava 502 sem salvar nada, registro nunca aparecia na tabela pra reconsultar. Corrigido nos dois casos — agora grava `"ERRO NA CONSULTA"` (com guard para não sobrescrever dado bom prévio por falha transitória). Lens pegou um gap na revisão: `stats.falhas` não contava a nova string — corrigido antes de fechar.

**Decisão preservada de propósito:** RADAR responder com sucesso mas sem dados continua sendo `"NÃO LOCALIZADO"`/`"NÃO HABILITADO"` (resposta de negócio válida, fiel à API) — não é erro, não mexer nesse caminho.

---

## [2026-07-22] — CS & NPS: modal de dados do cliente — botão único de salvar + auth em Clientes.ts

**Tags:** #bugfix #refactor #security #auth
**Agentes envolvidos:** Scout, Anubis, Probe, Scribe
**Arquivos tocados:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`, `src/actions/Clientes.ts`

### Contexto
Usuário reportou erro no modal de dados do cliente (CS & NPS): editar o analista, salvar o serviço no botão próprio do card, depois clicar em "Salvar Alterações" no rodapé — dava erro / às vezes revertia a edição. Pediu para remover todos os botões de salvar soltos, deixando só o do rodapé.

### O que foi feito
- Causa raiz encontrada: `salvarAlteracoesGeral` faz update incondicional de TODAS as colunas de gestão do cliente; Dados Fiscais (rodapé) e o card de Serviço Contratado principal chamavam essa mesma action para o MESMO registro, cada um mandando os campos que o OUTRO gerencia como foto desatualizada (`cliente!.campo`, não o estado editado) — quem salvava por último revertia o outro.
- Perguntado sobre o escopo, usuário pediu o mais amplo: consolidar TUDO no modal (não só a parte que quebrava).
- `handleSalvarTudo` (nova função única) substitui `handleSalvarDadosFiscais` + `handleSalvarCard` — salva registro principal + todos os outros serviços do CNPJ, tudo com valores ao vivo (corrige de quebra um bug lateral de NPS/status lidos desatualizados).
- Adicionar/editar sócio, registrar/editar CS, registrar feedback viraram rascunho local (`_pendente: "criar"|"editar"`) até o clique único — badge "Não salvo" nas 3 seções.
- Exclusões (CS/feedback) continuam imediatas — decisão consciente de não deferir uma exclusão já confirmada via `confirm()`.
- Falha parcial tratada: operações com sucesso têm `_pendente` limpo (evita duplicar num novo clique); modal só fecha se tudo der certo.

### Decisões tomadas
- Escopo amplo (tudo no modal) em vez de só o bug: decisão explícita do usuário quando perguntado.
- Exclusões ficam fora da consolidação: destrutivas com confirm() próprio, deferir criaria ilusão de "já apagou" quando não apagou.

### Problemas encontrados / resolvidos
- Achado extra do Anubis: nenhuma das 8 Server Actions usadas por esse modal (`salvarLogCS`, `salvarLogFeedback`, `salvarAlteracoesGeral`, `adicionarSocio`, `atualizarSocio`, `atualizarLogCS`, `excluirLogCS`, `excluirLogFeedback`) bloqueava requisição sem sessão. Usuário aprovou corrigir na mesma sessão — todas as 8 ganharam `auth()` + rejeição explícita.

### Pendências
- Nenhuma — Forge, Anubis e Probe aprovaram; não foi possível testar visualmente no navegador (sem acesso a browser nesta sessão).

### Refletido também em
- `codebase-map.md`: nova seção "CS & NPS — Modal de dados do cliente: botão único de salvar + auth em Clientes.ts"

### Atualização (mesma sessão, rodada 4) — virtualização da tabela (performance com milhares de CNPJs)

**Contexto:** usuário reportou que lotes reais já chegaram a 8 mil CNPJs e a tabela renderizava tudo de uma vez, deixando o navegador lento. Bibble apresentou 2 opções (virtualização vs. paginação simples client-side); usuário escolheu virtualização.

**O que foi feito:** instalada `@tanstack/react-virtual@3.14.7` (primeira virtualização do projeto, compatibilidade com React 19 confirmada antes de instalar). Tabela `HabilitacaoRadarClient.tsx` reescrita com técnica de padding-rows (2 `<tr>` de altura calculada simulando linhas fora da janela visível) preservando o `<table>` HTML nativo — evita quebrar alinhamento de colunas que aconteceria com posicionamento absoluto. `<thead>` ganhou `sticky top-0`; container ganhou scroll próprio (`max-h-[70vh]`, `overflow-y-auto`).

**Confirmado sem regressão:** `handleSelecionarTudo`, `exportarExcel` e os filtros operam sobre os arrays completos em memória, nunca dependeram de quantas linhas o DOM tinha montadas — corretos mesmo com só ~30-40 `<tr>` renderizados por vez.

**Aceito conscientemente:** 1 warning de lint novo (`react-hooks/incompatible-library`, o `useVirtualizer` é conhecidamente incompatível com o otimizador do React Compiler) — irrelevante aqui, o projeto não tem `experimental.reactCompiler` ativado.

**Pendência:** não foi possível testar visualmente em navegador real com um lote de milhares de linhas carregado — recomendado ao usuário validar scroll/performance real antes de considerar fechado.

### Atualização (mesma sessão, rodada 5) — "NÃO HABILITADA" corrigido de vez + reconsulta restaurada

**Contexto:** usuário percebeu que "não habilitados" ainda estavam virando "NÃO LOCALIZADO" (a correção da rodada 2 tratou só a falha técnica do RADAR, não esse caso) e que o botão de reconsultar "não habilitados" tinha sido removido do modal de reconsulta.

**O que foi feito:**
- Fallback de `getRadarData` corrigido de `"NÃO LOCALIZADO"` para `"NÃO HABILITADA"` quando o RADAR responde com sucesso mas sem registro de habilitação (empresa existe, só não é habilitada) — string canônica usada em todo o resto do sistema.
- Achada função órfã `prepararReconsultaLote` (2 cópias, `RadarAction.ts` e `ReconsultaRadar.ts`) que dependia de apagar registros + um "robô" externo não localizado no projeto — importada mas nunca chamada. Em vez de reativar, generalizada `handleReconsultarErros` → `handleReconsultar(tipo)`, reaproveitando o motor de reconsulta ao vivo já funcional.
- `BotaoReconsulta.tsx`: props tipadas (eram `any`), 2º botão "Reconsultar Não Habilitados" restaurado.

**Decisão:** não revivi o mecanismo antigo (delete + robô externo) por confiabilidade incerta — generalizei o mecanismo atual, que já funciona e é auditável. `prepararReconsultaLote` (as 2 cópias) ficou 100% morta — não removida, decisão do usuário se quer limpar.

---

## [2026-07-22] — POP + Gestão de Equipe: Confirmação de Leitura de Documento

**Tags:** #feature #security #decision #integration
**Agentes envolvidos:** Scout, Vault, Echo, Nova, Anubis, Probe, Scribe
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/ConfirmacaoLeituraDocumento.ts` (novo), `src/app/PainelAlpha/DocsAlpha/page.tsx`, `src/app/PainelAlpha/DocsAlpha/DocsAlphaClient.tsx`, `src/app/PainelAlpha/DocsAlpha/_components/PopModalConfirmarLeitura.tsx` (novo), `src/components/cadastro/AbaGestaoEquipe.tsx`

### Contexto
Usuário pediu um botão de confirmação de leitura de documento no módulo POP (ao lado do nome do documento aberto), refletindo em Gestão de Equipe: badge por colaborador mostrando se leu o Regimento Interno (sempre destacado) e se leu todos os documentos do setor dele (colapsado num resumo).

### O que foi feito
- Model novo `ConfirmacaoLeituraDocumento` (documentoId + usuarioId + confirmadoEm, unique composto) — Vault aprovou 🟢 (CREATE TABLE puro), migration via script pontual Node+`@libsql/client` no Turso remoto, confirmada via `PRAGMA`.
- `confirmarLeituraDocumento`/`buscarStatusLeituraEquipe` (novas Server Actions) + botão/modal no POP + badges em Gestão de Equipe.

### Decisões tomadas
- "Setor do usuário" não precisou de campo novo — já existe como `usuarios.role` (mesma string usada em `documentos.setor`), descoberto lendo `AbaGestaoEquipe.tsx`.
- "Regimento Interno" identificado por `titulo.includes("REGIMENTO INTERNO")` — sem campo de categoria hoje, frágil se o título mudar, aceito conscientemente por falta de alternativa sem mais uma migration.
- Usuário pediu backup fresco extra antes da migration, mesmo o Vault classificando como 🟢 baixo risco e havendo um backup diário já dentro das 48h — feito via script pontual, descartado depois.

### Problemas encontrados / resolvidos
- Anubis achou que `buscarStatusLeituraEquipe()` só tinha `auth()` básico — qualquer usuário logado (não só quem gerencia equipe) podia ver o status de leitura de todos os colaboradores. Corrigido com o mesmo gate de role/permissão de `cadastro/page.tsx`.
- `npx prisma generate` travou com EPERM (erro conhecido, processo Node concorrente) — resolvido pedindo ao usuário fechar o dev server.

### Pendências
- Nenhuma — Forge, Anubis e Probe aprovaram. Não foi possível testar visualmente no navegador.

### Refletido também em
- `codebase-map.md`: nova seção "POP (Documentos) + Gestão de Equipe — Confirmação de Leitura de Documento"
- `integration-points.md`: novo ponto sobre relação reversa obrigatória em models novos + padrão de backup fresco pontual mesmo pra migrations 🟢

---

## [2026-07-23 17:15] — Calendário Alpha integrado ao Bibble/IAlpha

**Tags:** #feature #integration #security #auth #nextjs
**Agentes envolvidos:** Bibble, Scout, Echo, Cortex, Forge, Probe, Anubis, Lens, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/lib/bibble/calendar-tools.ts`, `src/lib/bibble/tools.ts`, `src/lib/bibble/tool-executor.ts`, `src/lib/bibble/system-prompt.ts`, `src/app/api/bibble/chat/route.ts`, `src/actions/google-calendar-eventos.ts`, `src/actions/google-calendar-admin.ts`, `src/lib/google-calendar/client.ts`, `src/lib/validations/google-calendar.ts`, `tests/bibble/`, `tests/google-calendar/`, `docs/stories/story-calendario-alpha.md`

### Contexto
O usuário pediu que o Bibble/IAlpha passasse a consultar a agenda, verificar disponibilidade e criar, editar ou cancelar compromissos e reuniões com todas as capacidades operacionais do Calendário Alpha.

### O que foi feito
- O IAlpha ganhou 10 tools: listar calendários; listar, criar, editar e cancelar eventos próprios; consultar FreeBusy; consultar agenda de colega; e criar, editar ou cancelar eventos de colega para Admin/CEO.
- Um helper central passou a validar argumentos, resolver calendário/colega sem seleção silenciosa, aplicar ownership/permissões e normalizar datas em `America/Sao_Paulo`.
- Edições usam patch parcial com ETag/`If-Match`; cancelamentos exigem confirmação explícita em duas fases; tools executam em sequência com limites de 6 por rodada, 12 por requisição e 3 mutações de calendário.

### Decisões tomadas
- IDs de usuário/colega/calendário e e-mail de impersonation nunca vêm do modelo: são resolvidos a partir da sessão e do banco.
- Role e permissões efetivas são relidas por requisição; escrita na agenda de terceiros permanece exclusiva de Admin/CEO.
- Configurações administrativas de calendário continuam na UI. Não houve alteração de schema, migration ou mutação de banco; Vault não foi necessário.

### Problemas encontrados / resolvidos
- A integração anterior tinha apenas 5 tools e não cobria edição, seleção segura de calendário nem CRUD de colega; o fluxo foi completado sem duplicar a lógica de autorização do domínio.
- Concorrência de edição poderia sobrescrever mudanças externas; ETag com `If-Match` agora retorna conflito em vez de gravar sobre uma versão desatualizada.
- Verificação final: 122 testes, Next build, ESLint escopado e `git diff --check` passaram. Probe e Lens: PASS. Anubis: CONCERNS sem blocker.

### Pendências
- Dívidas de endurecimento cross-request: rate limit persistente, idempotência persistente de mutações e token persistente/específico para confirmação de cancelamento.
- O typecheck global conserva 4 erros de baseline fora do diff desta entrega.

### Refletido também em
- `story-calendario-alpha.md`: extensão conversacional, gates e file list registrados.
- `bibble-flows.md`: fluxo das 10 tools e salvaguardas documentados.
- `codebase-map.md`: núcleo `calendar-tools.ts` e integração do chat mapeados.
- `integration-points.md`: contratos de segurança, ETag, timezone e limites registrados.

---

## [2026-07-24] — Parceiros: 3º toggle "Aprovar" (podeAprovar) + ícone de notificação liberado

**Tags:** #feature #security #decision
**Agentes envolvidos:** Scout, Vault, Echo, Forge, Anubis, Lens, Probe, Scribe
**Arquivos tocados:** `prisma/schema.prisma`, `src/actions/parceiros.ts`, `src/actions/convites-parceiro.ts`, `src/components/Parceiros/ParceirosClient.tsx`, `src/components/Parceiros/ModalEngrenagem.tsx`, `src/components/Parceiros/ModalPreCadastros.tsx`

### Contexto
Usuário pediu, no controle de acesso do módulo Parceiros (ao lado de Editar/Excluir), um botão que dá acesso equivalente ao Admin. Relatou também que alguns usuários com acesso ao módulo não veem o ícone de notificação de pré-cadastros, e que quem tiver esse "acesso total" deve poder aprovar/rejeitar convites mesmo sem ser Admin.

### O que foi feito
- Campo `podeAprovar` adicionado ao model `ParceiroAcesso` (Vault aprovou 🟢 ADD COLUMN nullable/default — migration via script pontual `@libsql/client` no Turso, confirmada via `PRAGMA table_info`, reaproveitando um backup pré-existente da mesma sessão de trabalho em vez de gerar outro).
- 3º toggle "Aprovar" no `ModalEngrenagem.tsx` (cor emerald, ao lado de Editar/Excluir), persistido via `salvarAcessoParceiro` (assinatura estendida com o 4º argumento).
- Ícone de notificação (Bell) em `ParceirosClient.tsx` — antes gated só por `isAdmin`, agora por `podeVerNotificacoes = isAdmin || podeAprovar` (aplicado ao hook de Pusher e à prop `isAdmin` do `ModalPreCadastros`).
- `aprovarPreCadastro` (convites-parceiro.ts) mudou de admin-only para `(!isAdmin && !podeAprovar)`.

### Decisões tomadas
- Escopo reduzido a um 3º toggle nomeado (`podeAprovar`), não um "acesso total" literal que replicasse todas as permissões de Admin — decisão tomada em uma parte anterior desta mesma sessão (antes de uma compactação de contexto) e honrada ao retomar o trabalho, após verificar via PRAGMA que a coluna ainda não existia no Turso.
- `salvarAcessoParceiro` (quem CONCEDE o toggle) permanece Admin-only deliberadamente — evita que um usuário com `podeAprovar` conceda mais acesso a si mesmo ou a terceiros.
- `rejeitarPreCadastro` não precisou de mudança — já era aberto a qualquer usuário com `ParceiroAcesso` (podeAcessarParceiros), o que já satisfazia "pode rejeitar mesmo não sendo admin".

### Problemas encontrados / resolvidos
- `getCtx()` existe duplicado em `parceiros.ts` e `convites-parceiro.ts` (duas interfaces `Ctx` separadas) — os dois precisaram ser editados independentemente; ambos agora computam `podeAprovar` da mesma forma.
- Tooltip em `ModalPreCadastros.tsx` ("Apenas administradores aprovam") ficou desatualizado com a mudança de gate — corrigido para "Sem permissão para aprovar".

### Pendências
- Nenhuma para esta feature — Forge (tsc/lint/build), Anubis e Probe aprovaram.
- Bug não resolvido de outra sessão/tarefa: usuário relatou falha ao adicionar/editar CS e Feedback no módulo CS&NPS (diagnóstico não iniciado) + pedido de loading nos botões de salvar desses modais.

### Refletido também em
- `project_parceiros.md` (memória do usuário): nova seção "Acesso Total / podeAprovar (2026-07-24)".

---

## [2026-07-30 16:46] — Agenda Alpha reestruturada com cache-first e sincronização explícita

**Tags:** #feature #refactor #bugfix #integration #security #nextjs
**Agentes envolvidos:** Bibble, Scout, Nova, Echo, Forge, Anubis, Lens, Sage, Probe, Scribe, Kowalski
**Arquivos tocados:** `src/app/PainelAlpha/CalendarioAlpha/`, `src/components/CalendarioAlpha/`, `src/actions/google-calendar-{eventos,admin,colegas,sync}.ts`, `src/lib/google-calendar/`, `src/lib/modulos-registry.ts`, `tests/google-calendar/`, `docs/stories/story-calendario-alpha.md`, `.bibble/memory/{architecture,codebase-map,integration-points,journal}.md`

### Contexto
O usuário pediu renomear visualmente Calendário Alpha para Agenda Alpha, corrigir falta de sincronização e regras da sidebar, transformar superfícies em modais 3D e melhorar o módulo inteiro sem quebrar integrações existentes.

### O que foi feito
- O rebranding preservou rota `/PainelAlpha/CalendarioAlpha`, id e permissão `calendarioAlpha`; a página passou a renderizar cache local no SSR, com sincronização manual explícita, resultados/contadores/status visíveis, dedupe e cooldown por instância.
- O sync passou a trocar cache e `syncToken` atomicamente depois de todas as páginas, inclusive na recuperação de `410 Gone`; sucesso integral atualiza a conexão sem mascarar falhas.
- Edição agora carrega detalhes completos, usa PATCH parcial com ETag/`If-Match` e preserva descrição, participantes/metadata e Google Meet. Invalidação cross-tab ganhou `BroadcastChannel` com fallback e dedupe.
- Sidebar, status e fluxos foram separados em componentes/hooks, com modais 3D acessíveis no desktop e Sheets responsivos no mobile. Em agendas de colegas, usuário comum vê apenas “Ocupado”; detalhes e escrita permanecem com Admin/CEO.

### Decisões tomadas
- Cache-first no SSR: leitura da rota não chama Google; compartilhadas permanecem live e só são consultadas por ação explícita.
- Coordenação atual é deliberadamente in-process: não há promessa de lock distribuído entre réplicas.
- Não houve migration nesta onda; qualquer lock persistente ou mudança de schema futura exige Vault, backup verificado e confirmação.

### Problemas encontrados / resolvidos
- Renderização e sincronização estavam acopladas, permitindo leituras lentas/inconsistentes; foram separadas em cache-only + comando explícito.
- `410 Gone`, detalhes parciais e invalidações duplicadas podiam degradar cache, sobrescrever campos ou gerar loops; recuperação atômica, ETag e dedupe fecharam esses caminhos.
- Verificação final da Agenda: **114 testes PASS**, **build PASS**, **lint escopado PASS** e `git diff --check` PASS; nenhum erro de typecheck atribuível à onda.

### Pendências
- Implementar lock distribuído somente com infraestrutura persistente aprovada.
- Executar E2E autenticado no navegador contra Google Calendar real.
- Avaliar modularização adicional do controller e eventual cache de agendas compartilhadas, sem remover o acionamento explícito.

### Refletido também em
- `architecture.md`: leitura cache-only, action de sync e limites in-process/cross-tab.
- `codebase-map.md`: rebranding, fluxo cache-first, componentes, privacidade e riscos.
- `integration-points.md`: contratos de sync, atomicidade, ETag/Meet, DWD de colegas e shared-live explícita.

---

## [2026-07-30 19:20] — Agenda Alpha Fase 2A: infraestrutura distribuída aplicada com rollout desligado

**Tags:** #feature #integration #security #prisma #critical
**Agentes envolvidos:** Bibble, Scout, Vault, Echo, Nova, Forge, Lens, Anubis, Sage, Probe, Scribe, Kowalski
**Arquivos tocados:** `prisma/schema.prisma`, `plan/agenda-alpha-phase2a-migration-preview.sql`, `src/lib/google-calendar/`, `src/app/api/calendario-alpha/webhook/`, `scripts/calendar-alpha-*.mjs`, `tests/google-calendar/`, `docs/stories/story-calendario-alpha.md`

### Contexto
O usuário autorizou explicitamente, após o relatório Vault, aplicar em produção no Turso somente o DDL da Fase 2A, com rollback pelo backup verificado `painelalpha_turso_pre_change_agenda-alpha-phase2a_2026-07-30T20-13-38Z.sql`.

### O que foi feito
- O SQL aprovado criou exclusivamente `GoogleCalendarPushChannel`, `GoogleCalendarPendingOperation` e `GoogleCalendarSyncLease`, com 10 índices — 7 comuns e 3 `UNIQUE` — sem `ALTER`, `DROP`, backfill, seed ou mutações em Comissões.
- A infraestrutura de fila persistente, lease/fencing distribuído, worker, webhook push, manutenção e diagnóstico foi implementada atrás de flags desligadas por padrão.
- Gates finais: **183 testes PASS**, Prisma validate, lint escopado e build de produção PASS; o Turso respondeu corretamente ao doctor, status da fila e maintenance dry-run sem mutações.

### Decisões tomadas
- Rollout permanece desligado até existir HTTPS público confiável, WAF/rate limiting, scheduler/worker operacional e E2E canário contra Google real.
- Cache e cursor só avançam dentro da mesma transação e com fencing válido antes e depois da persistência em lotes.

### Problemas encontrados / resolvidos
- Claims longos podiam expirar durante processamento: adicionado heartbeat CAS por `id + worker + claimToken`.
- Lifecycle de canais admitia corrida entre renew/stop: serializado por lease, heartbeat e CAS, com compensação de watch órfão.
- Erros permanentes do Google eram reprocessados: classificados para DLQ e canal `ERROR`; transitórios continuam em retry.
- CAS SQL com `BigInt`, `payloadJson = null`, rejeição do heartbeat manual e persistência em lote exigiram normalização explícita.
- Rate limit do webhook é local por instância; validado como defesa complementar, não substituto de WAF distribuído.

### Pendências
- Configurar HTTPS público, WAF/rate limit distribuído e scheduler/worker; ativar lock+queue e depois push em canário, observando `claim_lost`, `lease_lost`, DLQ e duplicidade de watches.
- Executar E2E autenticado com Google Calendar real antes de ampliar o tráfego.
- O typecheck global conserva 4 erros baseline externos à Agenda Alpha, em arquivos sem alteração nesta fase.

### Refletido também em
- Nenhum arquivo curado adicional foi alterado neste fechamento; plano, story e testes da Fase 2A já contêm os detalhes operacionais e de aceitação.

---

## [2026-07-31 13:35] — Agenda Alpha compactada para o viewport do painel

**Tags:** #refactor #bugfix #tailwind #nextjs
**Agentes envolvidos:** Bibble, Scout, Iris, Nova (fallback local), Forge, Probe, Lens, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/app/PainelAlpha/CalendarioAlpha/layout.tsx`, `src/components/CalendarioAlpha/{AgendaSidebar,CalendarioAlphaDashboard,ConteudoAgenda,GradeHoraria,HeaderCalendario,MiniCalendarioAgenda,VisaoMes}.tsx`, `docs/stories/story-calendario-alpha.md`

### Contexto
O usuário pediu reduzir o card lateral e a agenda, adaptando o módulo à tela para evitar rolagem excessiva e manter as funções visíveis.

### O que foi feito
- A cadeia de altura do layout até as visões passou a usar viewport dinâmico, flex e `min-h-0`, mantendo a rolagem dentro da região correta.
- Sidebar, header e mini-calendário ficaram mais compactos no desktop; mês passou a seis linhas flexíveis e dia/semana rolam somente as horas.

### Decisões tomadas
- Compactação é responsiva e restrita ao desktop; Sheet e alvos de toque mobile continuam preservados.
- A visão anual mantém rolagem interna porque doze meses não devem ser comprimidos até perder legibilidade.

### Problemas encontrados / resolvidos
- `min-h-0` isolado não tinha efeito porque os pais não forneciam altura/flex; a cadeia completa foi corrigida.
- O executor de subagentes perdeu autenticação durante a implementação; Scout e Iris concluíram, e o patch foi aplicado localmente como fallback com os mesmos limites de escopo.

### Pendências
- Validar visualmente no navegador autenticado em notebook e monitor ultrawide; os gates automatizados não medem conforto visual real.
- O teste preexistente `tests/google-calendar/cli.test.ts` continua excedendo o timeout de 5s no Windows.

### Refletido também em
- `codebase-map.md`: contrato de altura/scroll da Agenda Alpha.
- `integration-points.md`: checkpoint de viewport para alterações futuras.

---

## [2026-07-31] — Visão Dia preserva a data civil local

**Tags:** #bugfix #agenda-alpha #timezone #nextjs
**Agentes envolvidos:** Bibble, Scout, Nova, Forge, Probe, Lens, Sage, Scribe, Kowalski
**Arquivos principais:** `src/app/PainelAlpha/CalendarioAlpha/page.tsx`, `src/components/CalendarioAlpha/lib/{datas,useAgendaAlphaController}.ts`, `src/components/CalendarioAlpha/{VisaoMes,VisaoAno}.tsx`

### Contexto
Ao selecionar a visão Dia, a Agenda Alpha recuava um dia e ficava sem eventos, enquanto as visões mais amplas mascaravam o erro.

### Causa e correção
- A URL trazia `YYYY-MM-DD`, mas `new Date(valor)` interpretava a data como meia-noite UTC; em São Paulo, isso correspondia à noite do dia anterior.
- O módulo passou a parsear, serializar e calcular datas civis explicitamente em `America/Sao_Paulo`, sem depender do fuso local do SSR ou do navegador.
- Navegação, intervalos, agrupamento, títulos e chaves das visões agora compartilham o mesmo contrato.
- A meia-noite inexistente de 04/11/2018 revelou risco de loop no grid; o conversor agora escolhe o primeiro instante válido do dia, com fallback limitado e cacheado.

### Limites
- Nenhuma action, API, sincronização, permissão, schema ou dado foi alterado.
- Datas impossíveis caem no fallback seguro e a regressão ficou coberta por testes unitários, wiring, SSR em UTC e transição histórica de DST.

---

## [2026-08-03 17:18] — Player nativo e persistência serial do Alpha Presentation Studio

**Tags:** #bugfix #refactor #decision #integration #nextjs
**Agentes envolvidos:** Bibble, Scout, Iris, Nova, Forge, Probe, Lens, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/components/Apresentacoes/Editor/{ApresentacaoEditor,ModalReproducaoApresentacao}.tsx`, `src/components/Apresentacoes/Editor/SidebarEsquerda/SidebarSlides.tsx`, `src/components/Apresentacoes/Editor/store/useEditorStore.ts`, `src/components/Apresentacoes/ModoApresentacao/{ModoApresentacaoClient,TransicaoContainerAlphaLayer}.tsx`, `src/app/PainelAlpha/Apresentacoes/[id]/{editor,apresentar}/page.tsx`, `src/components/layout/PainelLayoutClient.tsx`, `tests/apresentacoes/{central-criativa,container-alpha,editor-persistencia}.test.ts`, `.bibble/memory/{components,integration-points,journal}.md`, `docs/stories/story-apresentacoes-container-alpha-animado.md`

### Contexto
O player modal demorava, falhava de forma intermitente e chegava a mostrar a sidebar do Painel Alpha dentro da apresentação. O usuário também precisava que o Container Alpha tivesse profundidade visual, abrisse uma única vez e já avançasse pelo zoom ao slide seguinte, sem atraso, repetição ou mudança prematura do palco.

### O que foi feito
- O iframe interno foi removido do modal; `ModoApresentacaoClient` agora monta diretamente no Dialog usando um snapshot instantâneo dos slides já carregados no Zustand, incluindo componentes/canvas atuais do slide ativo.
- A transição sintética do Container Alpha ganhou margem responsiva de 5% da menor dimensão do palco, limitada entre 18 e 72 px. O player detecta quando o container real já executa a animação e não monta uma segunda camada concorrente, eliminando a repetição antes do zoom.
- O destino é promovido no início real do zoom, mas `slidePalco` preserva canvas, fundo, escala e recorte do slide de origem até o callback final da animação 3D. A conversão geométrica da abertura/margem foi corrigida e mantida tipada.
- Palco e controles passaram a ocupar regiões próprias do layout, sem sobreposição sobre o slide. Range e comandos continuam responsivos, ganharam `focus-visible` e fullscreen explícito.
- O clique em “Apresentar” desbloqueia Web Audio antes do mount e o modal nasce iniciado. O gate “Iniciar apresentação” existe somente na rota standalone, autenticada e separada do modal; o iframe global de abas permite `autoplay` e `fullscreen`.
- A persistência ganhou `versaoEdicao` monotônica, `concluirSalvamento` condicionado à versão atual e uma fila independente por `slideId`, serializando escritas do mesmo slide sem bloquear slides diferentes e continuando após rejeição.

### Decisões tomadas
- Player modal React direto: evita segundo SSR/layout, nova autenticação/consulta Prisma, flash da sidebar e perda do gesto de áudio.
- Snapshot local primeiro, save em background: a reprodução abre imediatamente sem sacrificar a persistência.
- Versão monotônica + fila por slide: comparação de referências isolada não era suficiente para impedir respostas e escritas fora de ordem.
- Sequência única por instância: um `containerCarga` real configurado é a própria transição; a camada sintética só existe quando a animação vem de outro componente.
- Canvas de origem até `onComplete`: o índice lógico pode avançar no início do zoom sem provocar salto de proporção, fundo ou recorte durante a expansão.
- Gate apenas standalone: o modal preserva abertura instantânea, enquanto a rota direta obtém explicitamente o gesto exigido para áudio e fullscreen.

### Problemas encontrados / resolvidos
- A causa raiz era o iframe aninhado apontando para uma rota `force-dynamic`: ele recarregava o layout do painel e só detectava o contexto embutido após hidratação.
- Saves do debounce, do botão Apresentar e da troca de slide podiam competir; a fila preserva a ordem de envio por slide e a versão impede uma conclusão antiga de limpar `isDirty` novo.
- A repetição visual vinha da camada sintética concorrendo com o próprio Container Alpha; o guard recursivo mantém apenas a instância real. A troca visual antecipada vinha do palco derivado diretamente do índice já promovido; `slidePalco` agora retém a origem enquanto a transição está ativa.
- Validação final: ESLint focal PASS, 32/32 testes focados PASS em Central Criativa, Container Alpha e persistência do editor, e `git diff --check` PASS. O typecheck não apresenta erro no player e conserva somente 5 baselines externos: Exclusão Fiscal (2), Radar (1) e Google Calendar (2).

### Pendências
- Executar E2E futuro em navegador autenticado para churn contínuo da Sidebar e medição da latência visual imediata; ambos foram aprovados nesta sessão por inspeção, mas o navegador automatizado estava indisponível.
- Manter os 5 baselines externos de typecheck e o bloqueio ambiental do Prisma fora deste escopo até tratamento próprio.

### Refletido também em
- `components.md`: contrato do modal React nativo, áudio/gate, margem responsiva, sequência única, canvas de origem, controles, snapshot, versão e fila serial.
- `integration-points.md`: invariantes do player, geometria da transição, rota standalone, iframe global e persistência concorrente.
- `story-apresentacoes-container-alpha-animado.md`: evolução 1.8, arquivos, 32/32 testes, gates e risco E2E residual.

---

## [2026-08-04 10:22] — Alpha Metas: feature "Justificativa de Meta" (upload PDF vigente + histórico imutável)

**Tags:** #feature #nextjs #prisma #security #integration
**Agentes envolvidos:** Scout, Echo, Vault, Nova, Forge, Probe, Anubis, Lens, Sage, Scribe
**Arquivos tocados:** `prisma/schema.prisma`, `src/lib/metas-permissoes.ts` (novo), `src/actions/Metas.ts`, `src/actions/JustificativaMeta.ts` (novo), `src/app/api/metas/justificativas/{upload,[id]}/route.ts` (novos), `src/components/Metas/{ModalJustificativaMeta,PreviewJustificativa,ListaHistoricoJustificativas,SeletorPeriodoJustificativa}.tsx` (novos), `src/app/PainelAlpha/Metas/MetasClient.tsx`, `tests/metas/{metas-permissoes,justificativa-meta-action,upload-magic-bytes}.test.ts` (novos), `.bibble/memory/known-errors.md`

### Contexto
Usuário pediu botão "Justificativa de Meta" no topo do módulo Metas: Admin/TI, CEO e Líder Comercial fazem upload de um PDF mensal (mês/ano de referência); upload novo sobrescreve o vigente do período; membros comuns do Comercial só visualizam; aba Histórico lista todas as versões enviadas, preservando as substituídas.

### O que foi feito
- Novo model `JustificativaMeta` (Prisma) — migration real aplicada no Turso via script Node pontual, validada por `PRAGMA table_info`/`PRAGMA index_list`, backup pré-mudança gerado em `database-backups/pre-change/`.
- Server Actions (`ListarHistoricoJustificativas`, `BuscarJustificativaVigente`, `RegistrarJustificativaMeta`) + 2 Route Handlers (upload com magic bytes PDF + leitura autenticada via Vercel Blob privado, token `METAS_READ_WRITE_TOKEN`, já configurado pelo usuário em `.env.local`).
- Modal (`ModalJustificativaMeta` + 3 subcomponentes) integrado ao header do `MetasClient.tsx`, botão sempre visível (conteúdo do modal muda por role).
- 44 testes automatizados novos, 100% passando; suíte completa do projeto 708/709 (1 falha pré-existente não relacionada).

### Decisões tomadas
- Escopo restrito a somente PDF (usuário removeu DOCX): rejeição com toast orientando conversão.
- Histórico imutável sem `@@unique([mes,ano])` — cada upload é `create()` novo, vigente é sempre o mais recente via `orderBy: createdAt desc`. Nunca update/delete físico.
- Botão sempre visível no header, autorização só no conteúdo do modal + reforçada no backend — padrão alternativo ao botão condicional já usado em "Configurar Metas".
- Blob Store dedicado `access: "private"` (token `METAS_READ_WRITE_TOKEN`), leitura só via Route Handler autenticada — nunca URL pública direta.
- AlertDialog de confirmação obrigatório antes de sobrescrever vigente existente.

### Problemas encontrados / resolvidos
- **Build quebrado (Forge, 1ª rodada):** `podeGerenciarMetas` exportada como função síncrona de `src/actions/Metas.ts` (arquivo `"use server"`) — Next.js só aceita export `async function` nesses arquivos. Fix: extraído para `src/lib/metas-permissoes.ts` (sem `"use server"`). 2ª manifestação real do mesmo padrão já catalogado em `known-errors.md`, atualizado com o novo caso.
- **Anubis 🟡:** `url` recebida por `RegistrarJustificativaMeta` aceitava qualquer domínio — corrigido na mesma sessão com `.refine()` restringindo a `*.blob.vercel-storage.com`.
- **Lens 🟡:** componente do modal com 360 linhas (limite 300) por duplicação de bloco de preview entre as 2 abas — Nova extraiu 3 subcomponentes, caiu para 297 linhas; também adicionado try/catch ausente no parse de JSON do upload.
- **EPERM recorrente no `prisma generate`** (DLL do query engine travada por processos Node residuais) — fix catalogado aplicado 3x ao longo da sessão (`taskkill` antes de gerar).

### Pendências
- Ausência de auditoria formal (`db.auditoria`) em `RegistrarJustificativaMeta` — aceita como dívida consciente (Anubis/Lens concordam que o histórico imutável já cobre a maior parte do valor de rastreabilidade).
- Teste manual em browser real (login autenticado) não realizado nesta sessão — sem credenciais disponíveis (mesma limitação já documentada para Comissões/Blueprint).

### Refletido também em
- `integration-points.md`: seção completa "Alpha Metas — Justificativa de Meta", checklist de integração, achado de comportamento de `podeGerenciarMetas`.
- `components.md`: entrada para `ModalJustificativaMeta` + 3 subcomponentes.
- `architecture.md`: model `JustificativaMeta`, env var `METAS_READ_WRITE_TOKEN`, 3 endpoints novos.
- `decisions.md`: 3 decisões técnicas (vigente+histórico sem `@@unique`, botão sempre visível, Blob Store dedicado privado).
- `known-errors.md`: atualizado por Echo com a 2ª manifestação do erro "use server" + export síncrono.

---

## [2026-08-05] — Alpha Presentation Studio: categoria "Backgrounds" (7 fundos animados extraídos de outros módulos)

**Tags:** #feature #nextjs #integration
**Agentes envolvidos:** Scout → Nova → Forge (2 rodadas) → Probe → Kowalski (Vault/Anubis/Sage não aplicáveis — sem schema/auth/AI novos)
**Arquivos tocados:** 8 novos (`slide-componentes-fundos.ts`, `registry-fundos.ts`, `fundos-utils.ts`, `{CosmosIAlphaFundo,RadarFundo,EstelarFundo,BlueprintFundo}.tsx`, `render/RenderFundos.tsx`, `FundoAnimadoProps.tsx`) + 6 editados (`slide-componentes.ts`, `componentes-registry.ts`, `RenderComponente.tsx`, `PainelPropriedades.tsx`, `TimelineReal.tsx`, `ApresentacaoEditor.tsx`, `CanvasArea.tsx`, `animated-shader-background.tsx`)

### Contexto
Usuário pediu uma categoria "Backgrounds" no Alpha Presentation Studio reaproveitando os fundos animados que já existiam hardcoded em: Painel Alpha/módulos genéricos, Agenda Alpha, CheckList, CS & NPS, Radar e principalmente o Cosmos do chat do Bibble/IAlpha — todos totalmente editáveis (cor, velocidade, estilo, direção). Scout mapeou 7 fundos reais (incluindo 2 que o usuário não citou explicitamente mas se encaixavam no pedido — Blueprint Técnico e o shader Aurora dos Módulos — confirmados com o usuário antes de implementar). 3 decisões de escopo fechadas via pergunta direta: (1) incluir os 7, (2) os 3 presets "estelar" quase idênticos viram 1 engine só com presets em vez de código triplicado, (3) fundo sempre nasce no zIndex mais baixo automaticamente.

### O que foi feito
- **Schema:** 1 tipo novo (`fundoAnimado`) na união discriminada de `ComponenteSlide`, com `estilo` como discriminador interno (mesmo idioma de `container.layout`) — nunca schema Prisma, `Slide.dadosJson` continua o único ponto de persistência.
- **7 itens na paleta:** Cosmos IAlpha (mecânica orbital kepleriana real, extraída de `IAlphaCosmicBackground.tsx`), Radar Sonar, Estelar CS & NPS/CheckList/Agenda Alpha (1 engine, 3 presets), Blueprint Técnico, Aurora dos Módulos (shader WebGL existente, estendido com uniforms de cor/velocidade configuráveis em vez de hardcoded no GLSL).
- **Editável de verdade:** cor primária/secundária (swatch nativo + texto), velocidade, densidade, direção (Radar), toggles específicos por estilo — nenhum campo morto no painel (aparecem só quando fazem efeito visual real).
- **UX de follow-up pedida pelo usuário na mesma sessão:** seletor visual de cor (além de digitar), botão "Centralizar" no painel (mesmo padrão já existente em `ContainerCargaProps.tsx`), e auto-ajuste de zoom no `CanvasArea.tsx` (ResizeObserver one-shot, sem sobrescrever zoom manual) para o slide caber inteiro e ficar centralizado ao abrir o editor.
- **Diferenciação de presets:** usuário notou que CS&NPS e CheckList pareciam "iguais demais" — CheckList ganhou paleta própria (esmeralda/indigo, mais lento e denso) em vez de ser um quase-clone.

### Decisões tomadas
- 1 tipo (`fundoAnimado`) + `estilo` interno, não 7 tipos na união — segue o precedente de `container.layout`.
- 3 presets "estelar" compartilham 1 engine (`EstelarFundo.tsx`) — decisão explícita do usuário para não triplicar código quase idêntico.
- `TipoComponente` (chave do registry) e `ComponenteSlide["tipo"]` deixaram de ser o mesmo conjunto: `"fundoAnimado"` sozinho não é uma chave válida do registry, só existe via as 7 chaves nomeadas (`registryFundoParaEstilo()` resolve o label/ícone certo a partir de uma instância já no slide, usado pela Timeline).
- Fundo nasce sempre cobrindo o canvas ativo e no zIndex mais baixo — lógica no `handleDragEnd` do Editor (que já tem acesso ao canvas/lista de componentes), não no registry (que só conhece `x,y`).
- `AnimatedShaderBackground` ganhou props opcionais com defaults reproduzindo a paleta original — os 2 callers existentes (Extratos/Parceiros) não precisaram de nenhuma mudança.

### Problemas encontrados / resolvidos
- **Erro de tipo real (Forge):** `TipoComponente` inicial exigia uma chave `fundoAnimado` própria no registry (que não existe) — corrigido excluindo esse literal do lado `ComponenteSlide["tipo"]` da união.
- **Mesmo erro se propagou para `TimelineReal.tsx`:** indexava `COMPONENTES_REGISTRY[c.tipo]` diretamente, o que rotularia TODO background como o mesmo item — corrigido com `registryFundoParaEstilo(estilo, preset)`.
- **`react-hooks/set-state-in-effect` (4 ocorrências novas):** as 4 engines geram posições aleatórias (estrelas/blips/âncoras) só no client via `useEffect` — precisa do comentário de disable específico (`react-hooks/set-state-in-effect`, não `exhaustive-deps`), mesmo padrão já usado em `BlueprintBackground.tsx` original.
- **`react-hooks/refs` (achado ao estender `animated-shader-background.tsx`):** o arquivo original já tinha `pausadoRef.current = pausado` direto no corpo do render (violação pré-existente, nunca notada). Ao adicionar 3 refs novas com o mesmo padrão, decidiu-se corrigir as 4 de uma vez com o padrão "latest ref" via `useEffect`, já que a mudança estava exatamente nessas linhas.

### Pendências para próxima sessão
- Drag-and-drop físico da paleta pro canvas não confirmado por automação de browser (mesma limitação já catalogada desde a Onda 2 do módulo) — recomenda-se teste manual humano.
- Fidelidade visual exata do shader Aurora: a fórmula de cor foi simplificada (3 canais RGB independentes → 1 mix entre 2 cores) para viabilizar edição real — visualmente muito próxima do original, mas não pixel-idêntica.

### Refletido também em
- `integration-points.md`: seção completa "Alpha Presentation Studio — Categoria Backgrounds", checklist de integração, arquivos criados/editados, decisão de arquitetura.
- `codebase-map.md`: linha do módulo Alpha Presentation Studio atualizada com a nova categoria.

### Continuação na mesma sessão — polish pedido pelo usuário: cor visual, botão Centralizar, presets Estelar, auto-fit do canvas, e Container Alpha
Após a entrega da categoria Backgrounds, o usuário pediu 3 melhorias de UX na mesma sessão: (1) seletor de cor visual (swatch nativo + texto, achado o precedente exato em `ContainerCargaProps.tsx`/`ColorField`) além de só digitar o hex; (2) botão "Centralizar" no painel do fundo (mesmo padrão já existente só em `ContainerCargaProps.tsx`, agora replicado em `FundoAnimadoProps.tsx`); (3) auto-ajuste de zoom no `CanvasArea.tsx` (ResizeObserver one-shot no mount/troca de formato, nunca sobrescrevendo zoom manual depois) para o slide caber inteiro e ficar centralizado. De brinde, o usuário notou que os presets "Estelar CS & NPS" e "CheckList" pareciam iguais demais — CheckList ganhou paleta própria (esmeralda `#10b981`, mais lento/denso).

Em seguida, pediu 3 melhorias no **Container Alpha** (`containerCarga`, usado como componente de slide E como animação de entrada "container-alpha"): (1) tamanho padrão de slide (nascia 640×360, metade do tamanho — mesmo fix aplicado aos Backgrounds, mas SEM forçar zIndex mínimo, já que o Container é uma capa que fica por cima); (2) prévia ampliada — a caixinha de prévia em `AnimacaoContainerAlphaProps.tsx` é espremida na lateral estreita; novo botão "Ampliar" abre modal grande (`ModalPreviaContainerAlpha.tsx`, reaproveitando a mesma classe de dimensionamento 16:9 responsivo já usada em `ModalReproducaoApresentacao.tsx`); (3) zoom sobreposto à abertura da porta — antes esperava a porta abrir 100% pra só então começar o zoom (sequencial); agora começa aos 55% da duração da abertura, criando sensação de "entrar andando" pela porta. 55% escolhido por análise geométrica do modelo (portas articuladas na borda externa em `ContainerCargaModel.tsx`, já varridas do corredor central da câmera nesse ponto do giro — sem clipping).

**Erro de teste corrigido:** `tests/apresentacoes/container-alpha.test.ts` tinha `640×360` hardcoded no assert do default do registry — atualizado para `CANVAS_PADRAO.width/height`, já que a mudança de tamanho foi intencional (pedida pelo usuário), não uma regressão.

**Achado importante documentado:** o `containerCarga` já tinha DOIS fluxos de apresentação (componente-de-slide via `SlideApresentacaoLayer.tsx`, e capa-de-abertura via `TransicaoContainerAlphaLayer.tsx`/`ModoApresentacaoClient.tsx`) que JÁ forçavam tamanho quase-tela-cheia independente do `w`/`h` salvo no componente — as mudanças desta sessão afetam a experiência de EDITAR (canvas do editor, prévia da animação), não os 2 fluxos de apresentação real, que já estavam corretos.

Forge revalidado após cada rodada (tsc baseline preservado, lint escopado limpo, `next build` OK, 33 testes passando).

### Refletido também em (continuação)
- `integration-points.md`: seção "Alpha Presentation Studio — Container Alpha: tamanho padrão, prévia ampliada e zoom sobreposto à abertura".

### Continuação — bug real reportado: fundo animado "pula" na animação de entrada Container Alpha
Usuário testou e reportou: "a animação de entrada fica bugada quando se tem um background". Investigação (sem browser, só leitura de código): `TransicaoContainerAlphaLayer.tsx`/`ComponenteNoSlide` montam uma PRÉVIA do slide de destino (`SlidePortalPreview`) dentro da porta do Container Alpha, SIMULTANEAMENTE ao slide real já montado por baixo — 2 instâncias React independentes do MESMO componente de fundo. `RadarFundo.tsx`/`BlueprintFundo.tsx`/`EstelarFundo.tsx` geravam blips/âncoras/estrelas com `Math.random()` puro (sem seed) — cada instância sorteava um layout diferente, causando um "pulo" visual perceptível no instante em que a prévia dá lugar ao slide real. `CosmosIAlphaFundo.tsx` já usava seeds fixas e não tinha o bug.

**Fix:** `hashStringParaSeed(componente.id)` (novo, em `fundos-utils.ts`) gera uma seed numérica a partir do id do componente — idêntico nas 2 instâncias, já que é o MESMO componente do slide — usada no gerador congruente linear já existente (`criarGeradorSeed`, extraído do padrão do Cosmos). As 3 engines passaram a receber essa seed. Cadastrado em `known-errors.md` com a explicação completa, já que é um padrão que qualquer fundo/decoração futuro com posições aleatórias vai precisar repetir (qualquer slide com Container Alpha sempre pré-monta a prévia do próximo slide atrás da porta fechada, não só durante a transição ativa — não é caso raro).

Forge revalidado (tsc baseline, lint escopado limpo, build OK, 33 testes passando).

### Refletido também em (2ª continuação)
- `known-errors.md`: entrada nova "fundo animado 'pula' de layout durante a animação de entrada Container Alpha".

### Continuação — 2º bug real: container não cobria 100% da tela
O fix do "pulo" de layout não resolveu tudo — usuário confirmou (via pergunta direta com opções, já que não há browser disponível nesta sessão) que o sintoma real era "container não cobre a tela toda". Achado concreto, não especulativo: `container-intro.ts` documenta explicitamente "*Container Alpha é uma capa: sempre ocupa todo o palco 16:9*", mas `ComponenteNoSlide` (`SlideApresentacaoLayer.tsx`) e `TransicaoContainerAlphaLayer.tsx` aplicavam uma margem de 18-72px ao redor do container, CONTRADIZENDO o próprio comentário do código. Essa margem também undoava silenciosamente o fix de "tamanho padrão de slide" desta mesma sessão (o componente podia estar com `w/h` = canvas inteiro no editor, mas a apresentação recalculava do zero com a margem de qualquer jeito). Antes de existir fundo animado, a margem só mostrava a cor sólida do slide (imperceptível); com um Background atrás, virou uma borda óbvia vazando.

**Fix:** `margem = 0` nos 2 arquivos (mantendo a estrutura/fórmula parametrizada por margem, só zerando o valor — `FRAME_FILL_CAPA=0.985` do `ContainerCargaCameraRig.tsx` já garante respiro interno suficiente pro modelo não cortar na borda).

Forge revalidado novamente (tsc baseline, lint escopado limpo, build OK, 33 testes). Cadastrado em `known-errors.md`.

### Refletido também em (3ª continuação)
- `known-errors.md`: entrada nova "Container Alpha não cobre 100% da tela (margem deixa o fundo vazando na borda)".

---

## [2026-08-06] — Alpha Presentation Studio: Exportação HTML autocontida (10 fases, Plan Mode)

**Tags:** #feature #decision #integration #nextjs #critical
**Agentes envolvidos:** Bibble (Plan Mode com 2 Explore + 1 Plan agent) → Nova (implementação das 10 fases) → Forge (validação a cada fase, 10x) — sem Vault (sem schema novo), sem Anubis formal (sem rota de auth/AI nova além do padrão já estabelecido de ownership)
**Arquivos tocados:** ~15 novos, ~7 editados (lista completa em `integration-points.md`)

### Contexto
Usuário mostrou print do bug do Container Alpha ainda quebrado (renderizando pequeno/no canto, mesmo após 2 rodadas de fix nesta sessão) e decidiu mudar de estratégia: em vez de insistir só no player ao vivo (React/Three.js dentro do Next.js, impossível de testar visualmente nesta sessão sem browser), pediu uma exportação real da apresentação como **1 arquivo `.html` autocontido para download** — HTML/CSS/JS de verdade, com a animação 3D do Container Alpha funcionando, não vídeo nem screenshot. Requisito de navegação: 1 clique/scroll avança exatamente 1 slide; Container Alpha aparece fechado e abre no 1º gesto.

Dado o tamanho (nova dependência de build, pipeline de bundling isolado, componente de player do zero), a sessão entrou em **Plan Mode**: 2 agentes Explore mapearam o motor de render inteiro (todos os ~25 tipos de componente, sistema de animação, mecânica exata do Container Alpha) e o lado de dados/rotas/precedentes de download; 1 agente Plan desenhou a arquitetura completa. 3 perguntas de escopo foram fechadas com o usuário (Container Alpha só como capa por enquanto, UI minimalista, assumir hospedagem Vercel) antes do plano final ser aprovado.

### O que foi feito (10 fases, cada uma fechada com tsc+lint+build verdes)
1. **Preparação:** `ownership.ts` (checagem canônica, sem tocar as 4 cópias existentes), `container-carga-assets.ts` (`LOGO_A_URL` extraído do literal `/A.PNG`), `percorrer-componentes.ts` (walker recursivo puro — coleta e substitui URLs de asset em toda a árvore, já cobrindo objeto3d/globo desde o início), `esbuild`/`postcss` como devDependencies explícitas (já existiam como transitivas).
2. **Spike do bundle:** `scripts/build-apresentacoes-player.mjs` (esbuild IIFE + PostCSS/Tailwind), com 2 guards automatizados (nenhum import de `next/`, nenhum arquivo com `"use server"` no bundle) — validado com um entry trivial antes de qualquer coisa real.
3. **Route Handler + botão:** esqueleto funcional ponta-a-ponta antes de dados reais.
4. **Dados reais + player real:** `PlayerStandalone.tsx` importando `RenderComponente.tsx` de verdade — **momento de maior risco do plano provado**: o bundle saltou de 190KB pra 2,6MB (React+Three.js+R3F+Framer+Recharts+xyflow+lucide inteiros) sem o guard disparar, confirmando que toda a árvore RenderEngine é livre de acoplamento a Next.js.
5. **Navegação:** handler de `wheel` (não existia em lugar nenhum do código antes) com lock/cooldown de 800ms, handler de `click`, hint "role pra continuar" que some após a 1ª interação.
6. **Assets 2D embutidos:** `embutir-assets.ts` (pré-checagem de orçamento de 25MB usando `tamanhoBytes` já salvo no banco, fail-fast em qualquer falha de download) + 9 testes vitest.
7. **CSS escopado:** `source(none)` + `@source` explícito derrubou o CSS de 486KB pra 50,2KB, mantendo as classes reais usadas (confirmado via grep no bundle gerado).
8. **Container Alpha (fase mais arriscada):** alias de build-time do logo (`define` do esbuild + verificação de que o `data:` URI realmente aparece no bundle), prop `deverIniciar` em `ContainerCargaRender.tsx` (default `true`, zero mudança de comportamento existente), orquestração `"fechada"→"abrindo"→"concluida"` em `PlayerStandalone.tsx`.
9. **Modelos 3D:** já estava coberto desde a Fase 1 (o walker foi escrito completo desde o início) — só faltava confirmar com testes explícitos, adicionados (3 novos).
10. **Polimento:** removida uma duplicação (função de sanitização de nome de arquivo já existia em `exportacao.ts`, reescrevi sem perceber na rota — corrigido pra importar a versão existente), reforçado o escape do `<title>` (`&`/`<`/`>`, não só `<`), mensagens de erro diferenciadas por status HTTP no toast do botão.

### Decisões tomadas
- esbuild (não Vite/webpack/rollup) para o bundle isolado do player — mais simples pra "1 entry point, 1 IIFE".
- Bundle gerado em **build-time**, nunca em runtime na function serverless (latência/binário nativo em Lambda seriam riscos reais).
- Container Alpha só como capa do slide 1 nesta v1 — não como transição no meio do deck (decisão explícita do usuário, escopo menor = menos risco antes de qualquer teste visual real).
- `deverIniciar` como prop nova e explícita em vez de reaproveitar `pausado` — mais auditável por leitura de código, já que nenhuma das duas opções pôde ser testada visualmente.

### Problemas encontrados / resolvidos
- **`react-hooks/refs`** de novo (2ª vez na sessão) — `indiceRef.current = indiceAtual` direto no corpo do componente. Fix: mover pra `useEffect`. Catalogado como entrada genérica em `known-errors.md` (já eram 2 ocorrências reais, virou padrão a evitar proativamente).
- **Duplicação descoberta e corrigida na Fase 10:** escrevi uma função de sanitização de filename do zero na rota sem perceber que já existia (`nomeDownloadSeguro` em `exportacao.ts`) — corrigido exportando a existente e importando, em vez de manter 2 quase-iguais.
- Nenhum erro de guard (import de Next/`"use server"`) disparou em nenhuma fase — a hipótese arquitetural central do plano (RenderEngine é livre de Next.js) se confirmou 100% na prática, não só na leitura de código.

### Pendências para próxima sessão
- **Nenhum teste em browser real** — toda a validação foi tsc/lint/build/vitest + guards estáticos (grep no bundle gerado). Abrir o `.html` de verdade via `file://`, confirmar que o Container Alpha abre no 1º gesto sem vazar frame antes da hora, confirmar que assets embutidos (`data:` URI) carregam em `useTexture`/`useGLTF`, e confirmar que 1 scroll = exatamente 1 slide — tudo isso é checklist de QA manual entregue ao usuário, não verificado nesta sessão.
- Container Alpha como transição no meio do deck (não só capa) — fora do escopo desta v1, adicionar se o usuário pedir.
- Orçamento de 25MB / `maxDuration=60` calibrados assumindo Vercel — usuário não confirmou 100% a hospedagem real, vale revisitar se a exportação falhar em produção com apresentações grandes.
- Bug original do Container Alpha no player AO VIVO (não a exportação) — os 2 fixes anteriores (seed determinística dos fundos, remoção da margem) continuam válidos e não foram desfeitos, mas também não foram confirmados visualmente ainda.

### Refletido também em
- `integration-points.md`: seção completa "Alpha Presentation Studio — Exportação HTML autocontida".
- `codebase-map.md`: linha do módulo atualizada (primeira peça real da Onda 6/Export).
- `known-errors.md`: entrada genérica de `react-hooks/refs`.

### Continuação — realismo de textura (fechado) + tentativa de restart do dev server
Após a exportação HTML, o usuário anexou uma foto de referência real de um container fechado ("ALPHA COMEX") e pediu pra igualar a textura das portas a ela, mantendo recolorável. `ContainerCargaModel.tsx` ganhou: `drawCorrugation()` (8 nervuras verticais com gradiente de luz/sombra por aresta, sujeira acumulada topo/chão, 10 escorridos de ferrugem e 16 riscos de desgaste, tudo com seed FIXA — não `Math.random()` — mesmo motivo do bug de "pulo" já catalogado: o container renderiza em 2 instâncias simultâneas quando o portal do próximo slide está ativo); textura das portas subiu de 512×1024 pra 1024×2048; porta direita ganhou tabela de peso/capacidade em 2 unidades (métrico/imperial) e código ACXU; 4 barras de trava por porta com braçadeiras (antes só 1); castings de canto ISO nos 4 cantos do frame.

Usuário reportou "não mudou nada, ainda é o mesmo container de antes" mesmo com o arquivo correto no disco (confirmado via grep — sem duplicata de componente). Hipótese: React Fast Refresh preservando o material/textura cacheados em `useMemo` entre hot-reloads (a dependência do `useMemo` são as CORES, que não mudaram — só o corpo de `makeDoorTexture()` mudou). Sem browser disponível pra confirmar a causa raiz. Com autorização explícita do usuário ("faça"), o processo do `npm run dev` foi encerrado e reiniciado do zero — subiu limpo, sem erros de compilação. **Efetividade não confirmada:** a próxima mensagem do usuário não validou se o restart resolveu, e sim redirecionou o pedido pro efeito de abertura (ver continuação abaixo).

### Continuação — efeito de abertura melhorado: túnel interior real + câmera "entrando" no container
Usuário enviou 2 fotos de referência (fechado + aberto, portas a ~105°) e pediu: (1) realismo continua desejado mas cor/estilização não é prioridade agora ("deixo como na foto"), (2) foco principal agora é o EFEITO DE ABERTURA, (3) o fundo do container aberto pode ser ignorado — quem preenche visualmente é o próprio slide revelado via zoom, (4) zoom deve parecer a câmera "entrando de verdade" no container.

**Achado antes de implementar:** o modelo não tinha profundidade interior nenhuma — só um plano de fundo (`Transition_Backdrop`) colado a 0,12 unidade atrás da porta. A câmera de zoom (`ContainerCargaCameraRig.tsx`) avançava apenas `Math.max(0.08, size.z*0.08)` além do centro da bounding box — na prática quase nada, porque não havia pra onde avançar.

**Fix — `ContainerCargaModel.tsx`:**
- `INTERIOR_DEPTH = 5.4` (exportado) + componente novo `InteriorTunnel`: paredes laterais, chão, teto e 12 nervuras estruturais por lado, SEMPRE renderizado (não depende de `mostrarFundoInterior`).
- Quando o portal do próximo slide está ativo, o fim do túnel fica propositalmente aberto (sem parede de fundo) — o Canvas é `alpha:true`, então o que aparece por trás é o próprio `SlidePortalPreview` (DOM, zIndex 1, sob o Canvas em zIndex 2), não uma textura 3D. `Transition_Backdrop` foi realocado pro fim do túnel (`z = -(INTERIOR_DEPTH-0.1)`) só pro caso SEM portal (prévia estática no editor com a porta aberta).
- `corInterior` (agora usado nas paredes do túnel, antes só num plano quase-invisível) tinha default `#f5f6f8` (quase branco) — trocado pra `#171b22` (cinza-chumbo escuro) nos 4 lugares duplicados (`slide-componentes-3d.ts`, `animacao-container-alpha.ts` ×2, `registry-3d.ts`) — branco ia deixar o túnel novo parecendo um corredor branco, não um interior metálico real.

**Fix — `ContainerCargaCameraRig.tsx` (redesign, não só tuning):** adicionar profundidade real quebrava o cálculo de enquadramento existente, porque o ponto de referência de profundidade vinha de `box.getCenter()` da bounding box INTEIRA do modelo — com 5,4 unidades de túnel novo, esse centro despencaria pra dentro do corredor e desalinharia até o enquadramento EXTERNO (container fechado). Trocado por um ponto fixo ancorado no plano da porta (`localToWorld` de `(0, CONTAINER.centerY, 0)`) pra toda referência de profundidade. Câmera agora avança 65% de `INTERIOR_DEPTH` de verdade durante o zoom (antes ~0,08 unidade fixo, quase nulo). Mira (`lookAt`) deixou de ficar fixa no plano da porta — agora interpola de `targetInicial` (plano da porta) pra `targetInterior` (105% de `INTERIOR_DEPTH`, além de onde a câmera chega) junto com `motion.zoom`, pra câmera continuar "olhando pra frente" rumo ao slide revelado em vez de encarar o próprio destino no fim do avanço.

Ângulo de abertura (105° default) já batia com a foto de referência aberta — nenhuma mudança necessária ali.

Forge validado: `tsc --noEmit` limpo nos arquivos tocados (erros pré-existentes em `ExclusaoFiscal`/`HabilitacaoRadarClient`/teste do google-calendar, sem relação com esta mudança), `eslint` limpo, `build:player` (esbuild, 2,97MB JS/50,2KB CSS) e `next build` OK. `npm run build` completo (com `prisma generate`) bateu no EPERM de Windows já catalogado em `known-errors.md` (dev server rodando em paralelo trava a DLL) — contornado rodando `build:player`+`next build` direto, sem precisar derrubar o dev server do usuário de novo.

**Pendência crítica, sem mudança desde as últimas rodadas de trabalho no Container Alpha:** nenhuma confirmação visual em browser real. Nem o restart do dev server, nem o realismo de textura, nem o túnel/câmera novos foram vistos rodando. Próxima sessão (ou o usuário, ao testar) precisa confirmar: sensação real de "entrar" no zoom, ausência de clipping/z-fighting nas paredes do túnel, e se a profundidade/velocidade escolhidas (65% de 5,4 unidades em `duracaoZoom` de 1,15-1,4s conforme o contexto) parecem rápidas/lentas demais na prática.

### Refletido também em (continuação)
- `known-errors.md`: addendum na entrada de EPERM do Prisma (workaround de Forge pra validar sem derrubar o dev server).

### Continuação — usuário confirmou visualmente pela 1ª vez: "mudou, mas não parece realista"
Depois do túnel/câmera, usuário perguntou "cadê o realismo do container?". Pergunta com opções confirmou: a mudança de textura da rodada anterior (corrugação, tabela, barras, castings) ESTÁ aparecendo (então o restart do dev server resolveu o problema de HMR/cache) — mas a qualidade não convence perto da foto de referência. Primeira confirmação visual real do Container Alpha nesta sessão inteira, mesmo que parcial (via pergunta de múltipla escolha, não via screenshot).

**Causa técnica identificada:** a corrugação inteira era só cor pintada num plano liso (gradientes simulando luz/sombra), sem relevo geométrico nenhum — não reage à luz de verdade da cena, então parece "colado" em vez de metal real. Fica mais evidente agora que a câmera se move (zoom novo desta sessão).

**Fix — `ContainerCargaModel.tsx`:**
- `bumpMap` novo por porta (`drawCorrugationHeight()`/`makeDoorBumpTexture()`, mesma grade de 8 nervuras da textura difusa, mas como heightmap cinza — precisa alinhar só a posição X das nervuras, não o grão) — `bumpScale=0.018`, pequeno de propósito (nervura real de container é rasa perto da largura da porta toda).
- Grão fino (ruído de ~2200 retângulos translúcidos claros/escuros) na textura difusa — degradê puro fica "digital demais", metal real tem microvariação.
- Texto das portas (ALPHA/COMEX, tabela de peso, etc.) ganhou relevo via `fillTextComRelevo()` — sombra escura + brilho claro levemente deslocados antes do preenchimento normal, simulando letra pintada/gravada em vez de vetor chapado.

**Ceiling comunicado ao usuário:** textura procedural em canvas tem teto de realismo — não alcança qualidade fotográfica pixel-idêntica à referência. Se não for suficiente, o caminho mais direto é textura baseada na foto real (imagem, não procedural) em vez de mais ajuste de gradiente — troca arquitetural que sacrifica a recolorização fácil atual. Não implementado ainda, só sinalizado — usuário não pediu essa troca.

Forge validado: tsc/lint limpos, `build:player` (esbuild, 2975.8KB JS) OK, `next build` OK (confirmado lendo o conteúdo do log, não só o exit code — 2ª vez na sessão que o exit code de uma cadeia de comandos mascarou o resultado real: desta vez foi o `grep` final da cadeia retornando 1 por não achar "error/fail", reportado como "falha" pelo orquestrador de background mesmo com o build em si tendo saído 0 e a tabela de rotas completa no log).

### Refletido também em (continuação)
- Nenhuma entrada nova em `known-errors.md` — nenhum bug de código encontrado, só uma lacuna de qualidade visual (esperada, endereçada).

### Continuação — 2º bug real reportado na reprodução: container "não fecha 100%", slide "não enquadra", falta fluidez
Usuário testou a reprodução de verdade (1ª vez nesta sessão testando o fluxo animado completo, não só a textura estática) e reportou 3 sintomas juntos: container não fica 100% fechado, tela do slide não fica enquadrada, falta fluidez/"fica bugado". Achados por leitura de código, dois bugs reais e distintos:

**Bug 1 — bounds do portal congelados:** `onPortalBounds` (retângulo que recorta/posiciona a prévia do próximo slide dentro da porta, `PortalProximoSlide`) só era calculado UMA VEZ, no mount, dentro de `enquadrar()` — nunca de novo durante o `useFrame`. Antes da mudança desta sessão (câmera avançando só ~0,08 unidade) isso quase não importava. Com a câmera agora percorrendo ~3,5 unidades de verdade pro túnel, o retângulo ficava congelado no tamanho de quando a câmera ainda estava longe, enquanto a cena 3D continuava avançando — descompasso na hora de revelar o slide real. **Consequência direta da mudança de câmera desta mesma sessão**, não bug pré-existente isolado.

Primeira tentativa de fix (reprojetar o retângulo a cada frame) foi DESCARTADA antes de aplicar: a câmera agora ultrapassa o próprio plano de referência da porta (z=-0,13) durante o zoom, e projetar um ponto atrás da câmera devolve coordenada sem sentido — teria trocado um bug por outro pior (retângulo "explodindo" no meio da animação). Fix real aplicado: capturar o retângulo inicial UMA VEZ (mantido, mesma lógica de sempre) e interpolar esse retângulo até EXATAMENTE o tamanho do viewport conforme `motion.zoom` avança (0→1), em vez de reprojetar geometria 3D todo frame. Garante matematicamente handoff sem salto pro slide real em zoom=1, sem depender de projeção que pode degenerar.

**Bug 2 — folga visível na costura central das portas:** as duas portas têm uma folga proposital de 0,03 unidade na costura central (evita z-fighting entre as 2 malhas). Como a prévia do próximo slide (`PortalProximoSlide`, DOM) já fica ativa por trás mesmo com a porta fechada (zIndex 1, sob o Canvas alpha:true em zIndex 2), e não havia nenhuma geometria opaca cobrindo especificamente essa fresta vertical, um fiapo do conteúdo de trás vazava pela linha central mesmo com o container "fechado" — pré-existente (não introduzido nesta sessão; sempre existiu desde que o portal ficou sempre ativo no fluxo de capa), só nunca tinha sido visto rodando de verdade.

**Fix:** peça nova `Reforco_Central` em `ContainerCargaModel.tsx` — mesh fixo (não gira com nenhuma porta) de 0,05×(openingH-0,02)×0,05 centralizado em x=0, cor `assets.frame` (mesma do corpo do container). Tapa a fresta quando fechado E bate com a referência real (containers de carga têm um reforço vertical visível na junção das portas) — resolve o bug e soma à realismo ao mesmo tempo.

Forge validado: tsc/lint limpos nos 2 arquivos, `build:player` (esbuild, 2976,1KB JS) OK, `next build` OK — desta vez o exit code real foi gravado dentro do próprio arquivo de log (`echo "EXIT_CODE:$?" >> log`) em vez de depender do exit code reportado pelo orquestrador de background, depois de 2 episódios seguidos nesta sessão de exit code mascarado por pipe/comando errado no fim da cadeia — prática a manter daqui pra frente neste projeto.

**Sobre a textura no HTML exportado:** usuário também cobrou realismo da textura "no html" especificamente. Esclarecido ao usuário que o `.html` exportado é um SNAPSHOT ESTÁTICO gerado no momento do clique em "Exportar HTML" — o bundle do player (`src/generated/apresentacoes-player-bundle.ts`) já foi reconstruído com todas as melhorias de textura desta sessão (bump map, grão, texto em relevo), mas qualquer arquivo `.html` baixado ANTES dessas mudanças não se atualiza sozinho — precisa reexportar pra refletir o código atual.

### Refletido também em (continuação)
- `known-errors.md`: registrar o padrão "gravar exit code dentro do próprio arquivo de log" como prática recomendada pra validação de build neste projeto (Windows + comandos em background mascaram exit code de formas diferentes a cada vez).

### Continuação — 1ª screenshot real da sessão: 3 problemas concretos identificados e corrigidos
Usuário finalmente mandou um print da "Modo Apresentação" (via `ModalReproducaoApresentacao.tsx`/`ModoApresentacaoClient.tsx`, com portas já abertas — câmera dentro do túnel). Primeira confirmação visual de verdade nesta sessão inteira sobre Container Alpha. Achados:

1. **Risco azul saturado no frame/reforço central**: `assets.frame` (usado no frame do container E no `Reforco_Central` novo) compartilhava o mesmo `pbr` das portas (`roughness:0.62, metalness:0.38`) — superfície lisa e sem textura quebrando o reflexo, pegando um reflexo especular forte e uniforme da `directionalLight` azulada da cena (`#b8c9e6`, intensity 2.1, a mais forte da cena) e lendo como uma linha azul saturada em vez de metal escuro. **Fix:** material dedicado `pbrFrame` (`roughness:0.82, metalness:0.18`) só pro frame/reforço — portas mantidas como estavam (não reportadas com problema).

2. **Container pequeno/quadrado, não preenchendo o quadro**: causa raiz não confirmada com certeza absoluta (sem devtools/inspeção ao vivo), mas hipótese mais forte após analisar a cadeia de componentes: o container nasce dentro de um `Dialog` (Radix, via `ModalReproducaoApresentacao.tsx`) — o 1º sucesso de `enquadrar()` (que só roda até funcionar UMA vez e nunca mais, a menos que `viewportSize` mude) pode capturar um tamanho de canvas ainda não 100% estabilizado pela animação de abertura do modal, ficando congelado num enquadramento errado pelo resto da animação. **Fix defensivo:** reconferir `enquadrar()` mais 3 vezes (100ms/300ms/700ms) depois do 1º sucesso — janela seguramente ANTES do zoom começar (delay real de ~0,8-1,2s antes de `motion.zoom` sair de 0), então não corta nenhuma animação em andamento. **Honestidade registrada:** este fix é defensivo/robusto contra a hipótese mais provável, não uma correção cirúrgica de causa 100% confirmada — se persistir, precisa de inspeção ao vivo (devtools) pra confirmar o tamanho real do canvas no momento do bug.

3. **"Slide pequeno, depois grande, sem fluidez"**: o crescimento do retângulo da prévia (fix da rodada anterior) esticava linearmente por TODO o zoom (0→1) — mas a câmera viaja fundo no túnel durante esse mesmo intervalo, então por boa parte da animação o espectador via ao mesmo tempo "o retângulo ainda crescendo" E "a câmera avançando pelo túnel", uma combinação que não lê como fluida mesmo sendo matematicamente correta. **Fix:** retângulo agora atinge tela cheia bem no INÍCIO do zoom (zoom=0→0,4, não 0→1) — a partir daí o resto da animação é só o "voo" pelo túnel por cima de um slide que já não muda mais de tamanho.

Forge validado: tsc/lint limpos, `build:player` (esbuild, 2976,3KB) OK, `next build` OK (exit code gravado no próprio log, confirmado 0).

**Pendência honesta:** o fix #2 (container pequeno) é o único dos 3 sem confirmação de causa raiz 100% certa — é uma correção defensiva bem fundamentada, não uma certeza. Se o usuário testar de novo e o container AINDA nascer pequeno/quadrado (não só durante a transição, mas desde o quadro inicial fechado), a hipótese do modal/timing está errada e precisa de investigação com devtools reais (inspecionar `canvas.width/height` renderizado vs. `slidePalco.canvas.width/height` esperado).

### Refletido também em (continuação)
- Nenhuma entrada nova em `known-errors.md` — nenhuma das 3 causas foi confirmada com certeza suficiente pra virar "erro catalogado com fix definitivo" ainda (especialmente #2).

### Continuação — usuário reportou "tudo isso" ruim (rápido/trava/portas não convencem/câmera não parece entrar): simplificação em vez de mais ajuste fino
Depois dos 3 fixes da rodada anterior, usuário continuou insatisfeito ("é tão simples o pedido e você não resolve"). Pergunta de múltipla escolha (4 sintomas: muito rápida / trava-engasga / portas não convencem / câmera não parece entrar) voltou **"tudo isso aí"** — sinal de que o problema não é 1 bug isolado, é a coreografia inteira. Decisão: em vez de continuar empilhando ajustes finos sem conseguir ver o resultado, SIMPLIFICAR a estrutura da animação pra reduzir a superfície de risco.

**Mudança 1 — porta e zoom deixaram de se sobrepor** (`ContainerCargaRender.tsx`): antes o zoom começava aos 55% do giro da porta (geometricamente seguro, mas 2 animações competindo por atenção ao mesmo tempo). Agora o zoom só começa depois da porta terminar 100% + uma pausa curta de 0,15s. Consequência boa de quebra: a sequência total fica ~0,8s mais longa (de ~2,2s pra ~3,0s com os defaults), endereçando "muito rápida" sem precisar mexer nos números de duração (que continuam configuráveis pelo usuário no painel, caso ainda esteja rápido/lento demais pro gosto dele).

**Mudança 2 — reconferência defensiva REVERTIDA** (`ContainerCargaCameraRig.tsx`): a rodada anterior tinha adicionado reconferir `enquadrar()` mais 3x (100/300/700ms) depois do 1º sucesso, pra tentar corrigir uma possível medição prematura de tamanho do canvas (hipótese pro bug do container pequeno/quadrado). Raciocínio quando foi adicionada: "seguro porque o zoom ainda não começou nesse intervalo". Raciocínio que faltou: `enquadrar()` seta `camera.position` DIRETO, sem transição — se a reconferência corrigisse o tamanho medido nesse intervalo, a câmera pularia instantaneamente de um enquadramento pro outro BEM NO MEIO da porta já visivelmente abrindo (já que a porta começa a abrir logo, independente do zoom) — o que bate exatamente com "trava/engasga" reportado. Revertido: melhor 1 fix a menos do que 1 fix que pode estar causando o próprio sintoma reportado.

**Não mexido nesta rodada:** causa raiz do container pequeno/quadrado continua sem confirmação (só o fix arriscado foi removido, não foi substituído por outro). "Portas não convencem" e "câmera não parece entrar" não têm fix técnico específico novo — a aposta é que a sequência ficando 100% sequencial (sem 2 coisas competindo) já ajuda bastante por si só, sem precisar de mudança adicional.

Forge validado: tsc/lint limpos, `build:player` OK, `next build` OK (exit code no log, confirmado 0).

**Padrão notado e vale manter em mente:** esta é a 2ª vez na sessão que um fix aplicado sem poder ver o resultado (a reconferência defensiva) tinha um efeito colateral não previsto no momento em que foi escrito. Reforça: preferir a mudança mais SIMPLES/com menos partes móveis quando não há como testar visualmente, mesmo que uma solução mais elaborada pareça tecnicamente superior no papel.

### Refletido também em (continuação)
- Nenhuma entrada nova em `known-errors.md` — ainda sem causa 100% confirmada pra catalogar.

### Continuação — mudança de arquitetura: "Apresentar" virou exibidor do HTML exportado (não mais player React ao vivo)
Depois de várias rodadas sem conseguir estabilizar o player React/Three.js ao vivo (container pequeno, risco azul, falta de fluidez — todas sem confirmação visual real), usuário pediu uma mudança de estratégia: o modal do botão "Apresentar" no editor deveria parar de ser um player próprio e passar a mostrar EXATAMENTE o `.html` que "Exportar HTML" gera — "não um visualizador de código, mas o visual pronto que terá". Decisão consolidada: em vez de manter 2 caminhos de renderização divergentes (o player ao vivo, com bugs próprios; e o export standalone, que já tinha guards automatizados provando isolamento de Next.js), a prévia do editor passa a usar o MESMO caminho do export — 1 única coisa pra acertar, WYSIWYG real.

**O que foi feito:**
- `src/lib/apresentacoes/exportacao.ts`: extraído `buscarHtmlApresentacao(id): Promise<string>` (busca o HTML como texto) reaproveitado tanto pelo download (`exportarApresentacaoComoHtml`, que agora monta o Blob a partir do texto) quanto pela prévia nova.
- **Novo** `src/components/Apresentacoes/Editor/ModalVisualizadorHtml.tsx`: `Dialog` (mesma classe `aspect-video`/16:9 responsiva já usada antes) com 3 estados (`carregando`/`erro`/`pronto`) e um `<iframe srcDoc={html} sandbox="allow-scripts allow-same-origin">` no estado pronto. Sem controles próprios de play/pause/prev/next — a navegação é a do PRÓPRIO player exportado (clique/scroll), fiel ao que o arquivo baixado realmente faz.
- `ApresentacaoEditor.tsx`: `handleApresentar()` reescrito — como a prévia agora lê do BANCO (a rota de export consulta o Prisma), não mais do Zustand em memória, o salvamento do slide ativo (se `isDirty`) guarda sua promise numa ref (`salvamentoPendenteApresentarRef`) passada como `aguardarAntesDeGerar` pro modal esperar ANTES de buscar o HTML — evita mostrar versão desatualizada. Removido o estado `slidesReproducao`/snapshot em memória (não é mais necessário).
- **Removido** `ModalReproducaoApresentacao.tsx` (o modal antigo que montava `ModoApresentacaoClient` direto).
- `/PainelAlpha/Apresentacoes/[id]/apresentar` (rota standalone) **não foi tocada** — continua usando `ModoApresentacaoClient`/player ao vivo. Só o modal do editor mudou.

**Achado importante ANTES de implementar — decisão histórica documentada em `integration-points.md`:** havia uma nota explícita proibindo "reintroduzir iframe interno" nesse exato modal, de uma sessão anterior que tinha tentado `<iframe src="/apresentar?modal=1">` (apontando pra uma ROTA da própria aplicação) e caiu em shell/auth/Prisma duplicados + sidebar vazando. Analisado com cuidado antes de prosseguir: o mecanismo NOVO é estruturalmente diferente — `srcDoc` (não `src` pra rota interna) com um documento HTML AUTOCONTIDO gerado por uma API route dedicada (1 auth+query, HTML estático com assets já embutidos, zero layout raiz dentro do iframe) — não reproduz nenhum dos 3 problemas documentados na proibição original. `integration-points.md` atualizado com a reconciliação completa (motivo da proibição antiga preservado como nota histórica, não apagado).

**Trade-off aceito, não resolvido:** cada abertura do modal chama a rota de export de novo, sem cache — pode ficar perceptivelmente lento em apresentações com bastante imagem/vídeo (a rota baixa e reembute todos os assets toda vez). Sinalizado como possível próxima melhoria (cache invalidado no save), não implementado.

**Erro real encontrado durante a validação (não relacionado ao código desta mudança):** `next build` falhou com `"AnimacaoItemForm" is defined multiple times` em `AnimacaoPropsV2.tsx` — arquivo não tocado nesta sessão, e `grep` confirmou que a função nem existe mais nesse arquivo. Causa: cache do Turbopack (`.next/cache`, datado de 3 dias antes desta sessão) desatualizado, provavelmente por causa da tentativa de build anterior que tinha falhado no EPERM do Prisma. Fix: `rm -rf .next/cache` (sem tocar `.next/dev`, que pertence ao `npm run dev` do usuário rodando em paralelo) + rebuild — resolveu. Catalogado em `known-errors.md`.

Forge validado: tsc/lint limpos (nos arquivos tocados; erros pré-existentes de `ExclusaoFiscal`/`HabilitacaoRadarClient`/teste do google-calendar continuam os mesmos 5, sem relação), `build:player` OK, `next build` OK depois da limpeza de cache.

### Refletido também em (continuação)
- `integration-points.md`: seção "Player modal da apresentação" reescrita com a mudança de arquitetura + reconciliação da proibição histórica de iframe (preservada como nota, não removida).
- `known-errors.md`: entrada nova sobre cache do Turbopack ficando inconsistente após build interrompido.
- `components.md`: a checar/atualizar se cita `ModalReproducaoApresentacao.tsx` (referência a arquivo removido).

---

## [2026-08-06] — Sidebar de slides (renomear + renumeração ao excluir) e Importação de PPTX (v1)

**Tags:** #feature #decision #nextjs #dependency
**Agentes envolvidos:** implementação direta (sem browser disponível pra testar visualmente o resultado — mesma limitação da sessão inteira)
**Contexto:** usuário pediu explicitamente pra deixar de lado o trabalho do Container Alpha/apresentação por enquanto. Dois pedidos: (1) melhoria pontual na sidebar de slides — nome editável + renumeração automática ao excluir; (2) feature nova e maior — upload de `.pptx`, extraindo os slides "certinho e separado corretamente".

### Sidebar de slides — nome editável + renumeração ao excluir
**Achado ao investigar:** `Slide.nome` já existia (`String?`, nullable) e `ItemSlide` já tinha o fallback `nome || \`Slide ${ordem+1}\`` — mas `CriarSlide` gravava um literal `"Slide N"` fixo na criação (não `null`), então o fallback nunca era exercitado na prática: o nome ficava "congelado" no texto de quando foi criado, não recalculado pela posição atual. Isso explica o comportamento que o usuário queria mudar.

**Fix:**
- `CriarSlide` (actions/slides.ts): parou de gravar `nome: "Slide N"` literal — fica `null`, deixando o rótulo ser calculado no client a partir de `ordem` (sempre correto, mesmo depois de excluir/reordenar). Só vira texto fixo quando o usuário renomeia de verdade.
- `ExcluirSlide`: agora roda numa `$transaction` que exclui E renumera `ordem` dos slides restantes (sequencial, sem buracos) — antes só excluía, deixando buracos (ex.: excluir ordem=0 de [0,1,2] deixava [1,2] em vez de [0,1]). `SidebarSlides.tsx#handleExcluir` espelha a mesma renumeração no estado local.
- `DuplicarSlide`: se o original não tinha nome customizado, a cópia agora usa o rótulo padrão dele como base (`Slide N (cópia)`) em vez de `"Slide (cópia)"` sem número.
- **UI nova:** `ItemSlide` ganhou um botão de lápis (ícone `Pencil`, mesmo padrão hover dos outros botões da linha) que vira o rótulo num `<input>` inline — confirma em blur/Enter, cancela em Escape. `handleRenomear` usa o estado AO VIVO do editor (`useEditorStore.getState()`) se for o slide ativo, ou o snapshot já carregado na sidebar caso contrário — `AtualizarSlide` exige `dadosJson` válido mesmo só pra mudar nome.
- **Limitação não resolvida:** não existe forma de reverter um slide renomeado de volta pro auto-numerado (`AtualizarSlide` só grava `nome` quando a string não é vazia — nunca limpa pra `null`). Não implementado por não ter sido pedido; mencionar se o usuário quiser essa opção depois.

### Importação de PPTX — v1 "tentar tudo" (texto, imagens, tabelas, formas básicas)
**Decisão de escopo, confirmada com o usuário via pergunta:** PPTX é um formato muito complexo (LibreOffice/conversor não está instalado no servidor, então "virar imagem perfeita por slide" não era opção viável). Usuário escolheu explicitamente a opção mais ambiciosa ("tentar tudo") em vez do caminho mais seguro (só texto+imagem) — aceitando o risco de que casos mais elaborados podem sair errados, dado que não há como testar visualmente nesta sessão.

**O que É extraído nesta v1:**
- **Texto** — títulos (detectados via `<p:ph type="title"/ctrTitle">`, viram `tag:"h1"`) e corpo, cor/negrito/tamanho de fonte quando definidos diretamente no run (`<a:srgbClr>`/`<a:rPr sz/b>`), alinhamento do parágrafo.
- **Imagens** — extraídas dos bytes reais dentro do `.pptx` (via relacionamento `r:embed` → `ppt/media/`), reenviadas pro Vercel Blob (mesmo padrão de `/api/apresentacoes/assets/route.ts`, inclusive registrando `ApresentacaoAsset` pra aparecer na biblioteca de assets normal).
- **Tabelas** — primeira linha vira `colunas`, resto vira `linhas` (heurística simples, nem toda tabela real tem essa semântica de cabeçalho).
- **Formas básicas com preenchimento sólido** (retângulo/retângulo arredondado/elipse) — viram componente `card`, com o texto interno aninhado em `filhos` quando a forma também tinha texto.
- Escala geométrica: lê o tamanho real do slide do PPTX (`<p:sldSz>`, em EMU) e calcula um fator uniforme (sem distorcer) que encaixa tudo no canvas da apresentação de destino (usa o canvas do último slide já existente, mantendo consistência) — com centralização quando a proporção não bate exatamente (ex.: PPTX 4:3 num canvas 16:9).

**O que NÃO é extraído (fora do escopo desta v1, documentado explicitamente pro usuário):** gráficos (`<c:chart>`), SmartArt/diagramas, geometria customizada complexa (`<a:custGeom>`), cores de tema (`<a:schemeClr>` — só lê cor direta `<a:srgbClr>`), herança de layout/master (forma sem posição própria explícita no slide é ignorada), animações/transições do PPTX original, notas do apresentador, formatos de imagem vetorial legados (EMF/WMF — não renderizam em navegador). Cada elemento não suportado é contado (não trava a extração) e reportado ao usuário no toast final via `ignorados: Record<motivo, contagem>`.

**Arquitetura:**
- `src/lib/apresentacoes/pptx/{tipos,unidades,parser,mapear}.ts` — parser puro (zip via `jszip` já existente + XML via `fast-xml-parser`, dependência NOVA adicionada) → representação intermediária (`FormaExtraida[]`) → `ComponenteSlide[]`. Cada forma/slide é isolada em try/catch — 1 elemento incompreendido nunca derruba a extração inteira.
- `POST /api/apresentacoes/[id]/importar-pptx` (rota nova, `maxDuration=60` — mesmo teto de `exportar-html`/`gerar-slide`) — auth+ownership, valida extensão/tamanho (80MB pro .pptx, 50MB por imagem embutida), roda o parser, envia cada imagem extraída pro Blob, cria 1 `Slide` novo por slide extraído (APPEND — sempre depois do último slide existente, nunca substitui os atuais), devolve contagem de sucesso + `ignorados` + eventuais falhas de upload de imagem.
- UI: botão novo (ícone `Upload`) na sidebar de slides, do lado do "+" de adicionar — abre um `<input type="file" accept=".pptx">` oculto, faz upload, atualiza a lista de slides via `ListarSlides` (mesmo padrão já usado depois de duplicar) e mostra toast com o resultado (incluindo aviso do que ficou de fora, se houver).

**Risco conhecido e não resolvido — limite de payload do Vercel:** a rota usa `request.formData()` direto (mesmo padrão de TODOS os outros uploads deste projeto, incluindo `/api/apresentacoes/assets`), que herda o limite padrão de corpo de requisição de Functions da Vercel (historicamente ~4,5MB) — um `.pptx` com várias imagens facilmente passa disso. Não é regressão desta sessão (é a mesma arquitetura já usada em todo upload do projeto), mas vale saber: se `.pptx` grandes falharem de forma nao clara, é provavelmente esse limite, não bug de parsing. Fix real seria upload direto client→Blob (`@vercel/blob/client`), fora do escopo desta sessão.

Forge validado: tsc/lint limpos em todos os arquivos novos/alterados, `build:player` OK, `next build` OK (rota nova aparece na tabela de rotas). **Erro cometido e corrigido no caminho:** tentei escrever um regex de remoção de acentos à mão e errei a notação Unicode (2 tentativas) — descobri que `nomeArquivoSeguro` já existe pronto em `@/lib/apresentacoes/assets.ts` e passei a importar em vez de duplicar.

**Nenhum teste real:** não foi possível testar upload de um `.pptx` de verdade nesta sessão (sem browser). Todo o parser foi validado só por leitura de código + compilação — a extração pode ter bugs reais só visíveis testando com arquivos reais variados (PowerPoint tem MUITAS variações práticas entre versões/templates).

### Refletido também em
- `integration-points.md`: nova seção "Importação de PPTX" com o fluxo completo e os limites de escopo.
- `components.md`: `SidebarSlides` atualizado (renomear, importar PPTX).

### Continuação — usuário reportou PPTX "sem imagens e sem formatação" + prompt de spec de 10 seções: causa raiz real + reescrita orientada a teste
Usuário testou a v1 (upload funcionou, mas resultado veio quebrado) e colou um prompt de especificação extremamente detalhado (10 seções: leitura completa OOXML slide→layout→master→tema, fundo em todas as formas, rich text por trecho, EMU→canvas com flip/rotação/grupos aninhados, renderização de referência via LibreOffice/Aspose, worker com progresso/cancelamento real, proteção anti-zip-bomb, etc.).

**Antes de tocar em qualquer código, rodei o parser v1 contra XML OOXML sintético (via `npx tsx`, Node real, não só leitura) pra achar a causa raiz de verdade em vez de adivinhar.** O caso básico (texto+imagem+forma colorida simples) funcionou perfeitamente — confirmando que a base (unzip, parsing de atributo namespaced, resolução de rId, conversão EMU) estava correta. Isso descartou "parser fundamentalmente quebrado" e apontou pra **cobertura insuficiente de casos que praticamente todo PPTX real usa**, não bug estrutural:
1. **Fundo do slide nunca era lido** — o parser só olhava `<p:spTree>` (as formas), nunca `<p:cSld><p:bg>` nem a herança slide→layout→master. Causa direta de "imagens de fundo desaparecem".
2. **Cores de tema (`<a:schemeClr>`) não eram resolvidas** — só lia `<a:srgbClr>` direto. Como a maioria dos templates reais usa cor de tema (é a paleta padrão da UI do PowerPoint), qualquer forma colorida assim tinha o preenchimento **descartado silenciosamente** (não só errado — ausente).
3. **Grupos não recalculavam a posição interna dos filhos** — entrava no `<p:grpSp>` mas usava a mesma escala do slide inteiro, ignorando `chOff`/`chExt` (o sistema de coordenadas local do grupo).

**Escopo do pedido de 10 seções, decidido com o usuário via pergunta direta (escolheu a opção recomendada):** corrigir o essencial que explica o relatado + melhorias viáveis dentro da arquitetura atual; documentar como limitação clara (não meia-solução arriscada) os 3 itens genuinamente inviáveis nesta passada — renderização de referência via LibreOffice/Aspose (não instalado no servidor, não instalável numa function serverless), worker/fila com progresso e cancelamento real (não existe essa infra no projeto), rich text por TRECHO dentro do mesmo parágrafo (o schema do componente `texto` do Alpha Motion só guarda 1 estilo por caixa inteira — mudar isso é alterar o modelo de dados do editor inteiro, não só o importador).

**Arquitetura nova (refatorada, não reescrita do zero — pedido explícito do usuário):**
- `xml-utils.ts` (novo): utilitários de XML extraídos de `parser.ts` (antes privados) — reusados por `tema.ts`.
- `tema.ts` (novo): resolve a cadeia slide→layout→master→tema; lê `<a:clrScheme>` (12 slots: dk1/lt1/dk2/lt2/accent1-6/hlink/folHlink, incluindo `<a:sysClr>` com `lastClr` de fallback), `<p:clrMap>` (mapeia bg1/tx1/bg2/tx2 pros slots reais — indireção que a maioria das implementações simplificadas esquece), resolve `<a:schemeClr>` com modificadores `lumMod`/`lumOff`/`shade`/`tint` (aproximação HSL padrão, não bit-exata ao algoritmo do PowerPoint mas visualmente próxima), resolve fundo (`<p:bg><p:bgPr>`: imagem/cor sólida/gradiente aproximado pelo 1º stop) com herança real, e busca posição herdada de placeholder no layout por `type`+`idx`.
- `parser.ts` (reescrito, mesma responsabilidade): composição de transform de grupo em espaço EMU puro (`TransformoEmu` com scale+offset, compõe via `compor()` pra grupos aninhados — matemática derivada e **validada com um caso de grupo 2x escala, conferido a mão E por teste**), fundo emitido como 1ª forma do slide (zIndex mais baixo), rotação lida de `<a:xfrm rot="">` (60.000avos de grau → graus, já existia campo `rotacao` no schema base — só não estava sendo lido), posição herdada do layout quando a forma não tem `<a:xfrm>` próprio.
- `tipos.ts`/`mapear.ts`: `rotacao` passou a ser campo obrigatório em `RetanguloExtraido`, propagado pra todos os tipos de componente mapeado.

**Validação real, não só compilação — 1ª vez nesta sessão inteira que uma feature nova foi testada empiricamente, não só por leitura de código:** escrito XML OOXML sintético mas estruturalmente realista (presentation.xml + slideMaster + slideLayout + theme + slide, com relacionamentos `.rels` de verdade) e rodado contra o parser real via `npx tsx` (Node, fora do browser — algo que ESTE ambiente consegue fazer, diferente de renderização 3D/visual). Todas as 5 verificações passaram, incluindo a matemática de transform de grupo conferida a mão (grupo escala 2x: EMU (3000000,3000000)→px(315,315), bateu exato). Convertido em teste vitest formal (`tests/apresentacoes/pptx-parser.test.ts`, 6 casos, todos passando) — fica como regressão permanente, não script descartável.

**Limitação de ordem encontrada e documentada (não corrigida):** `processarArvoreFormas` processa todos os `<p:sp>`, depois `<p:pic>`, depois `<p:graphicFrame>`, depois recursa em `<p:grpSp>` — ordem relativa preservada DENTRO do mesmo tipo, mas não ENTRE tipos intercalados no XML original (ex.: uma imagem que devia ficar atrás de um texto pode sair na frente, se estiverem intercalados de um jeito específico). Corrigir exigiria `fast-xml-parser` no modo `preserveOrder` — reescreveria todo acesso a XML do módulo; não feito por ser desproporcional ao bug real reportado.

Forge validado: tsc/lint limpos, **154 testes vitest de apresentações passando** (6 novos + 148 preexistentes, nada quebrou), `build:player` OK, `next build` OK.

### Refletido também em (continuação)
- `integration-points.md`: seção "Importação de PPTX" reescrita com a arquitetura nova (tema.ts/xml-utils.ts), causa raiz real dos 3 bugs, e a limitação de ordem entre tipos.
- Nenhuma entrada nova em `known-errors.md` — os bugs eram de COBERTURA (funcionalidade nunca implementada), não comportamento inesperado de alguma API/lib.

### Continuação — "ainda não está carregando" + pedido de modal de pré-importação: fluxo virou 2 fases (prévia não-destrutiva → confirmar/cancelar)
Usuário testou de novo: "ainda não está carregando" (ambíguo — upload trava, ou conteúdo continua vindo vazio, não dava pra saber qual) + pediu explicitamente um modal de pré-visualização antes de importar de verdade (ver quantos slides, o que tem, poder remover slide, só então confirmar ou cancelar).

**Decisão de não perguntar antes de agir:** o modal pedido resolve os dois problemas ao mesmo tempo — é a própria ferramenta de diagnóstico que faltava (o usuário vê exatamente o que o parser extraiu antes de qualquer coisa ser gravada) e é a feature pedida. Não fazia sentido bloquear em uma pergunta quando construir a coisa certa já respondia a ambos.

**Suspeita concreta de causa pro "trava" investigada e corrigida:** a rota de commit processava imagem por imagem SEQUENCIALMENTE (`await` num loop `for`) — pra um deck com várias imagens, cada upload é 1 round-trip de rede; 20 slides com 2-3 imagens cada passa fácil dos 60s do `maxDuration`, e a function seria matada pelo Vercel no meio, sem resposta clara pro client (parece "trava"). Paralelizado via `Promise.all` sobre os slides (mapeamento+upload), mantendo a gravação no banco sequencial (ordem determinística, SQLite/Turso não ganha muito com escrita paralela mesmo).

**Arquitetura nova — fluxo em 2 fases, nada destrutivo até confirmar:**
1. **Prévia** (`POST /api/apresentacoes/[id]/pptx-preview`, rota nova): roda o MESMO parser, mas nunca grava nada — nem `Slide` no banco, nem upload de imagem no Blob. Imagens viram `data:` URI inline (conversão local, sem round-trip de rede). Cancelar não deixa nenhum resíduo.
2. **`ModalPreImportarPptx.tsx`** (novo): mostra os slides extraídos renderizados de VERDADE — reaproveita `RenderComponente` (confirmado antes de implementar: é puro, sem dependência do Zustand do editor, dá pra usar isolado) com o mesmo truque de palco escalado (`transform: scale()`) do Modo Apresentação. Cada slide tem um botão de remover (marca localmente, não some da lista — só fica esmaecido e é excluído se o usuário confirmar sem desfazer). Rodapé: Cancelar / Confirmar importação (N).
3. **Commit** (`POST /api/apresentacoes/[id]/importar-pptx`, existente, estendido): agora aceita `excluirIndices` (JSON, índices 0-based) — reprocessa o MESMO arquivo (o `File` original fica em memória no client desde a seleção, reenviado no confirm) pulando os excluídos, só ENTÃO faz upload real pro Blob e cria `Slide` no banco.
4. `SidebarSlides.tsx`: o input de arquivo não faz mais upload direto — só guarda o `File` e abre o modal.

**Erro cometido de novo (3ª vez nesta sessão):** `react-hooks/refs` + `react-hooks/set-state-in-effect` no `ModalPreImportarPptx.tsx` — mesmo padrão já catalogado genericamente em `known-errors.md`, mesmo assim escrito errado de novo antes do lint pegar. Fix aplicado (ref atualizada em `useEffect` próprio, setState movido pro início do IIFE assíncrono), mas vale reforçar: aplicar esse padrão PROATIVAMENTE ao escrever `useRef`+`useEffect` juntos, não só corrigir depois que o lint reclama.

Forge validado: tsc/lint limpos, **160 testes vitest de apresentações passando**, `build:player` OK, `next build` OK (as 2 rotas de pptx aparecem na tabela de rotas).

**Ainda não confirmado pelo usuário:** nem se o "ainda não está carregando" original tinha mesmo relação com o timeout (hipótese razoável, não certeza), nem se o modal novo resolve satisfatoriamente — sem browser disponível nesta sessão.

### Refletido também em (continuação)
- `integration-points.md`: seção de PPTX atualizada com o fluxo de 2 fases (prévia não-destrutiva → commit) e a paralelização.
- `components.md`: `SidebarSlides` — a atualizar com a referência ao `ModalPreImportarPptx.tsx` substituindo o upload direto.

---

## [2026-08-06 17:53] — Alpha Motion — Fase 08: Scroll Reveal + Controles do Player

**Tags:** #feature #integration #nextjs
**Agentes envolvidos:** Scout, Echo (2x), Nova, Forge, Probe, Anubis, Lens, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/lib/apresentacoes/scroll/scroll-reveal.ts` (novo), `src/components/Apresentacoes/Editor/RenderEngine/ScrollRevealWrapper.tsx` (novo), `src/apresentacoes-player/dados-tipos.ts`, `src/app/api/apresentacoes/[id]/exportar-html/route.ts`, `src/apresentacoes-player/PlayerStandalone.tsx`, `src/components/Apresentacoes/Editor/Canvas/ComponenteNoCanvas.tsx`, `tests/apresentacoes/scroll-reveal.test.ts` (novo)

### Contexto
Fase 08 da fila `prompt-phases/` do Alpha Motion: implementar Scroll/Scrollytelling (Seção 17 do prompt original) e Controles do Player (Seção 27). Antes de Scout mapear, o usuário esclareceu um ponto que mudou o entendimento da tarefa: o "player" (exportação HTML) não é HTML estático — é um bundle React que roda offline dentro do `.html`.

### O que foi feito
- **Scout** mapeou o terreno: confirmou que o player navega por SLIDE INTEIRO (1 gesto = 1 avanço, `PlayerStandalone.tsx`), não é rolagem contínua — recomendou recorte: só Scroll Reveal viável, Scrub/Sticky/Pinned/Parallax/Snap ficam de fora.
- **Echo** entregou em 2 rodadas: (1) lógica pura — `scroll-reveal.ts` (`useScrollReveal` via `IntersectionObserver`, `ConfigScrollReveal`), testado com 8 casos síncronos (sem DOM real — projeto não tem `jsdom`/`testing-library`); (2) depois que Scout identificou a lacuna, o pré-requisito de dados — `SlideExportado.animacaoConfig` (`dados-tipos.ts`) e propagação em `exportar-html/route.ts` (sem migration — `dadosJson` já é `Json` genérico).
- **Nova** criou `ScrollRevealWrapper.tsx` (wrapper fino por componente, diferente de `EfeitosGlobaisSlide` que é por slide) e conectou em `ComponenteNoCanvas.tsx` (Editor) e `PlayerStandalone.tsx` (player exportado), reaproveitando `resolverAnimacoesDoElemento` nos dois pontos. Implementou `voltar()`/`reiniciar()`/`alternarTelaCheia()` e atalhos de teclado no player, copiando o padrão já existente em `ModoApresentacaoClient.tsx`.
- **Forge** achou 1 erro real (`react-hooks/set-state-in-effect` — `setState` redundante em `scroll-reveal.ts`), corrigido e catalogado em `known-errors.md`.
- **Probe** aprovou o checklist completo (lookup reaproveitado, retrocompatibilidade, composição com `ajusteVisual` da Fase 07, dados chegando no player, controles funcionais, sem regressão).
- **Anubis** achou 1 issue importante (não bloqueante): `threshold` do `IntersectionObserver` sem clamping, podendo lançar `TypeError` se `customProperties` trouxer valor fora de `[0,1]` — corrigido com `Math.min(1, Math.max(0, ...))`.
- **Lens** aprovou; corrigiu JSDoc desatualizado de `PlayerStandalone.tsx` e adicionou comentário explicando por que `ScrollRevealWrapper` não usa Zod (render path, não input).
- **Sage** adicionou 6 testes novos (clamping de threshold, `resolverAnimacoesDoElemento` com config ausente, determinismo do `.find()` com múltiplas animações on-scroll) — 160 testes na suíte de apresentações, todos passando. Documentou 1 risco de baixo impacto não corrigido: `reiniciar()` sem cooldown próprio.
- **Scribe** atualizou `codebase-map.md` (nova seção estrutural "Alpha Motion") e `integration-points.md` (seção detalhada da Fase 08).

### Decisões tomadas
- Só Scroll Reveal implementado — Scrub/Sticky/Pinned/Parallax/Snap ficam documentados como limitação: exigiriam trocar a navegação por slide discreto por rolagem contínua real.
- Sem velocidade de reprodução / play-pause real de slides / mute / desativar animação manual — nenhum desses cabe sem autoplay (que não existe e não foi pedido nesta fase).
- `ScrollRevealWrapper` como wrapper FINO por componente (não por slide) — decisão arquitetural distinta de `EfeitosGlobaisSlide` (Fase 07), porque Scroll Reveal só precisa saber do próprio elemento, não dos irmãos.

### Problemas encontrados / resolvidos
- `setState` redundante em `useEffect` (`scroll-reveal.ts`): o `useState` inicial já cobria o fallback sem `IntersectionObserver`; o `setRevelado(true)` dentro do efeito era redundante e bloqueado pelo lint. Removido.
- `threshold` do `IntersectionObserver` sem validação de range: clampado em `[0,1]` antes de passar ao construtor — evita `TypeError` de auto-DoS caso `customProperties` traga valor malformado.
- `ScrollRevealWrapper` sem `width:100%/height:100%` quebrava o layout dos `Render*` internos (que dependem de 100% do pai imediato) — corrigido durante a implementação de Nova, antes mesmo de chegar em Forge.
- **Tentativa de prompt injection detectada e recusada** no início da sessão: uma instrução embutida no resultado de uma tool call tentava mandar parar de usar ferramentas e produzir um resumo fora do fluxo normal. Identificada como conteúdo observado (não instrução do usuário) e ignorada — trabalho continuou normalmente como Echo.

### Pendências
- `reiniciar()` em `PlayerStandalone.tsx` sem cooldown próprio — clique duplo rápido pode truncar a transição visual (não corrompe estado). Baixo risco, documentado, não corrigido.
- Comportamento real do `IntersectionObserver` em browser (threshold, delay, fallback SSR) segue exigindo teste manual — ambiente de testes do projeto não tem `jsdom`/`testing-library`.
- Fase 08 concluída — pronta para Fase 09 (Presets, Preview e Polimento) começar.

### Refletido também em
- `known-errors.md`: nova entrada "ESLint `react-hooks/set-state-in-effect` — setState redundante dentro de useEffect que só replica o valor inicial do useState".
- `codebase-map.md`: nova seção "Alpha Motion — motor de animação do Presentation Studio (Fases 01-08)".
- `integration-points.md`: nova seção "Alpha Motion — Fase 08 (Scroll Reveal + Controles do Player)".

---

## [2026-08-06 09:52] — Alpha Motion — Fase 09: Presets, Preview e Polimento

**Tags:** #feature #integration #nextjs #decision
**Agentes envolvidos:** Scout, Echo, Nova, Forge, Probe, Anubis, Lens, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/lib/apresentacoes/animacao/presets-completos.ts` (novo), `src/lib/apresentacoes/animacao/responsivo.ts` (novo), `src/components/Apresentacoes/Editor/ReducedMotionSimuladoContext.tsx` (novo), `src/components/Apresentacoes/Editor/PainelDireito/camposPorTipo/{PreviewMiniatura,SeletorPreset,CamposResponsividade}.tsx` (novos), `src/components/Apresentacoes/Editor/BarraSuperior/ModalAplicarPreset.tsx` (novo), `AnimacaoPropsV2.tsx`, `AnimacaoItemForm.tsx`, `BarraSuperiorEditor.tsx`, `ApresentacaoEditor.tsx`, `slide-animacao-config.ts`, `tests/apresentacoes/presets-completos.test.ts`

### Contexto
2ª fase seguida na mesma sessão (logo após a Fase 08). Fase 09 da fila `prompt-phases/`: fechar a experiência de uso com pré-visualização, aplicação em massa, 8 presets prontos, e UI de controle para responsividade/reduced-motion/qualidade — as três dimensões antes tratadas só como "regra a seguir" internamente.

### O que foi feito
- **Scout** mapeou o terreno e recomendou recorte: sem multi-seleção (editor só suporta seleção singular desde a Onda 2), sem Undo/Redo (nenhuma infraestrutura de histórico existe), sem modo de qualidade em `Apresentacao` (exigiria migration real — model não tem campo Json genérico). Recorte aprovado pelo usuário.
- **Echo** entregou `presets-completos.ts` (8 presets: Minimalista, Corporativo, Cinematográfico, Dinâmico, Storytelling, Cards em sequência, Apresentação de métricas, Card Focus — cada um retornando `ElementAnimation[]` parcial) e `responsivo.ts` (`ResponsivoConfig`/`lerConfigResponsiva`, sem migration).
- **Nova** construiu toda a UI: preview de miniatura (reaproveitando `montarTransition` de `curvas.ts`, não `nucleo.tsx` — formatos de animação incompatíveis), seletor de preset, modal de aplicar a 1 slide ou todos (com `AlertDialog`), campos de responsividade, e o toggle de reduced-motion simulado (isolado do Editor, sem tocar em nenhum hook compartilhado com o player exportado).
- **Forge** aprovou após lidar com o `EPERM` conhecido do `prisma generate` (outro processo node consumindo ~5.8GB de RAM no ambiente, provavelmente `npm run dev` do usuário em paralelo) — contornado rodando `build:player`+`next build` isolados, já que a fase não tocou schema. `next build` completo passou (exit 0) depois de ~17 minutos de contenção de ambiente.
- **Probe** confirmou os 7 pontos críticos: presets sempre geram `id` novo, ownership revalidado por chamada no loop, payload de `AtualizarSlide` correto, `AlertDialog` nunca `confirm()`, reduced-motion isolado, `customProperties` preservado, sem regressão no painel existente.
- **Anubis** aprovou com 1 ressalva não-bloqueante: loop de "aplicar a todos os slides" sem teto de quantidade.
- **Lens** aprovou com 1 ressalva não-bloqueante: duplicação de lógica de merge de `SlideAnimationConfig` entre os 2 caminhos de aplicação em `ModalAplicarPreset.tsx`.
- **Sage** adicionou 3 testes (distanciaMobile=0 não é falsy-bug, fallback de preview exercitado contra o catálogo real, reaplicação de preset documentada como não-deduplicada) e corrigiu 1 UX real: botão "Aplicar a todos os slides" agora desabilita com `slides.length === 0`.
- **Scribe** estendeu a seção "Alpha Motion" em `codebase-map.md` (Fases 01-08 → 01-09) e adicionou a seção da Fase 09 em `integration-points.md`.

### Decisões tomadas
- Multi-seleção, Undo/Redo e modo de qualidade ficam fora — nenhum tem base suficiente no código hoje, e forçá-los nesta fase inflaria o escopo além do padrão das fases anteriores.
- Toggle de reduced-motion simulado implementado como Context isolado, usado só em `PreviewMiniatura.tsx` — decisão deliberada para nunca arriscar o player exportado herdar a simulação (confirmado que `AnimacaoWrapper`/`RenderComponente.tsx`, o caminho de render real compartilhado, não usa `useReducedMotion` hoje).
- Presets sempre ADICIONAM, nunca substituem ou deduplicam — mesmo comportamento do fluxo manual de adicionar animação já existente.

### Problemas encontrados / resolvidos
- **Descoberta arquitetural**: dois formatos de animação coexistem no projeto — `ConfigAnimacao` (legado, Onda 3, lido por `nucleo.tsx`) e `ElementAnimation` (novo, Fases 01-09, lido via `resolverAnimacoesDoElemento`). Não são intercambiáveis; `PreviewMiniatura.tsx` precisou de mapa de variants próprio em vez de reaproveitar `nucleo.tsx`. Registrado como convergência futura pendente.
- `EPERM` no `prisma generate` durante a verificação de Forge — mesma causa já catalogada (processo node concorrente travando o `.dll.node`), resolvido com o workaround já documentado (pular `prisma generate` quando o schema não muda).
- Ambiente sob contenção pesada de memória (múltiplos processos node, um consumindo ~5.8GB) atrasou bastante `next build`/`lint` completos — não foi tratado como falha, só aguardado com verificação de progresso real via `tasklist` antes de decidir prosseguir.

### Pendências
- Loop de "aplicar a todos os slides" sem teto de quantidade — baixo risco no volume realista de uso, mas vale limite explícito se apresentações muito grandes se tornarem comuns.
- Duplicação de merge de `SlideAnimationConfig` em `ModalAplicarPreset.tsx` — candidata a extração de helper numa próxima passada pelo arquivo.
- Fase 09 concluída — falta só a Fase 10 (Exportação Final, Otimização e Testes), última da fila `prompt-phases/`.

### Refletido também em
- `codebase-map.md`: seção "Alpha Motion" estendida para Fases 01-09, com nota sobre os 2 formatos de animação coexistindo.
- `integration-points.md`: nova seção "Alpha Motion — Fase 09 (Presets, Preview e Polimento)".

### 2026-08-07 — Guia Inteligente de Módulo em Alpha Metas e Parceiros

O Bibble ganhou manuais operacionais tipados e consultados sob demanda para Alpha Metas e Parceiros, incluindo a correção conceitual de que Parceiros vincula um cliente já existente — não cadastra cliente novo. A tool `consultar_manual_modulo` é somente leitura e respeita permissão/role antes de devolver o conteúdo.

Parceiros ganhou tour sequencial de primeira visita com spotlight, Pular, progresso, navegação, Escape, reduced motion, scroll/resize, passos condicionais e replay por “Tutoriais”. O visto é salvo localmente por usuário, módulo e versão; nenhuma migration foi necessária.

O padrão foi batizado **Guia Inteligente de Módulo**. Pedido futuro curto: “Adicione o Guia Inteligente neste módulo.” A implementação de referência do spotlight já existente era o Blueprint; o checkout atual de Comissões não possuía tour equivalente.

**Arquivos centrais:** `src/lib/shared/module-knowledge/`, `src/lib/bibble/{tools,tool-executor,system-prompt}.ts`, `src/components/Guias/GuiaModuloTour.tsx`, `src/lib/guias/tutorial-modulo.ts`, `ParceirosClient.tsx` e testes em `tests/bibble/`/`tests/guias/`.

**Validação focada:** 11/11 testes novos e lint dos arquivos da feature aprovados. Typecheck global manteve somente erros preexistentes em Exclusão Fiscal, Habilitação RADAR e fila do Google Calendar.

**Última atualização:** 2026-08-07 por Kowalski

---

## [2026-08-07] — Importador PPTX: correção profunda de interpretação OOXML (arquivo real de 18 slides)

**Tags:** #bugfix #integration #decision
**Arquivos tocados:** `src/lib/apresentacoes/pptx/ordem-xml.ts` (novo), `src/lib/apresentacoes/pptx/geometria.ts` (novo), `src/lib/apresentacoes/pptx/parser.ts` (reescrito), `src/lib/apresentacoes/pptx/tipos.ts`, `src/lib/apresentacoes/pptx/xml-utils.ts`, `src/lib/apresentacoes/pptx/tema.ts`, `src/lib/apresentacoes/pptx/mapear.ts`, `tests/apresentacoes/pptx-parser.test.ts`

### Contexto
O usuário reportou, com um `.pptx` real de 18 slides, que o importador (implementado em rounds anteriores desta mesma sessão, validado só com XML sintético) ainda vinha "sem as imagens e sem as formatações certas". Trouxe um diagnóstico técnico próprio e específico: o arquivo real usa `<a:blipFill>` dentro de `<p:sp>` pra imagem (nunca `<p:pic>`), com `<asvg:svgBlip>` como alternativa vetorial, e `<a:custGeom>` em vez de `<a:prstGeom>` na maioria das formas — nenhum dos dois reconhecido pelo parser existente, que classificava tudo isso como "forma sem texto/preenchimento reconhecido" e descartava.

### O que foi feito
- Inspeção direta do `.pptx` real do usuário (unzip + grep/python) confirmou 100% do diagnóstico do usuário: zero `<p:pic>` nos slides 2/3/4; `blipFill` dentro de `<p:sp>` com `asvg:svgBlip` resolvendo via `.rels` pra PNG+SVG; `custGeom` variando de retângulo simples (slide 10) a curvas reais via `cubicBezTo` (fotos de especialista do slide 3); e um bug de z-order real — `<p:spTree>` do slide 3 tem 14 `<p:grpSp>` seguidos de 52 `<p:sp>` no XML, mas o parser processava todos os `sp` antes de todos os `grpSp` (`fast-xml-parser` agrupa por tag, perde ordem entre tipos diferentes).
- `ordem-xml.ts`: scanner de texto XML cru (regex+pilha) que reconstrói a árvore de ordem REAL entre `p:sp`/`p:pic`/`p:grpSp`/`p:graphicFrame`/`p:cxnSp`, com offsets de início/fim de cada nó. `ConsumidorPorTipo` zipa os arrays já parseados (agrupados por tag) de volta na sequência certa; `xmlDoNo` fatia o XML cru de 1 shape específico pra reprocessamento independente.
- `geometria.ts`: scanner sequencial de comandos `moveTo`/`lnTo`/`cubicBezTo`/`quadBezTo`/`arcTo`/`close` dentro de `<a:path>` (também teria a ordem embaralhada pelo `fast-xml-parser` normal, de forma ainda pior — desenharia a forma errada, não só posicionada errado). Converte pra `d` de SVG; detecta o caso comum de retângulo exportado como `custGeom` (evita SVG desnecessário); gera SVG com `clipPath` (imagem recortada) ou path colorido (fallback de forma sem card nativo).
- `parser.ts` reescrito: `processarArvoreFormas` agora itera a ordem real (via `ordem-xml.ts`) em vez de "todos os sp, depois todos os pic..."; novo `processarShape` reconhece `<a:blipFill>` em `<p:sp>` (com `resolverBlipPreferido` compartilhado escolhendo `svgBlip` sobre raster), decide entre card nativo/SVG recortado/SVG colorido conforme a geometria; `p:cxnSp` agora é CONTADO em `ignorados` em vez de silenciosamente nunca iterado; toda forma não aproveitada ganha um motivo específico (nome da forma + geometria + fill encontrado) em vez da mensagem genérica antiga; fontes usadas (`<a:latin typeface>`) detectadas e reportadas em `fontesNaoAplicadas`; `flipH`/`flipV` detectados e expostos no diagnóstico (não aplicados — schema sem campo de flip); diagnóstico estruturado por elemento (`slide`, `shapeId`, `nome`, `tipoOoxml`, `fillEncontrado`, `relationshipId`, `assetResolvido`, `grupoPai`, `geometria`, `motivoFallback`) logado por slide via `console.info`.
- `mapear.ts`: `objectFit` de imagem trocado de `"contain"` pra `"cover"` — `<a:stretch><a:fillRect/></a:stretch>` (o caso comum, sem crop) sempre preenche o quadro por completo no PowerPoint, "contain" deixaria barras vazias.
- Validação em 2 camadas: (1) 8 testes vitest novos com XML sintético controlado (blipFill+svgBlip+custGeom retangular/curvo, ordem intercalada sp→pic→grupo→sp, detecção de fonte, motivo específico, cxnSp contado) — 14/14 passando; (2) rodado o parser de verdade via `npx tsx` direto contra o `.pptx` real de 18 slides do usuário (não só leitura de código) — slide 10 deixou de ficar vazio, as 14 fotos de especialista do slide 3 apareceram recortadas, slides 2/4 com fundo+ícones em blipFill/svgBlip extraídos corretamente, 0 exceções em qualquer slide, 0 elementos "não pareados" entre ordem real e árvore parseada.

### Decisões tomadas
- `custGeom` colorido (sem imagem) sem componente nativo pro path arbitrário vira SVG com o path preenchido — reaproveita a mesma infraestrutura do recorte de imagem, em vez de inventar um novo tipo de componente no schema.
- Flip (`flipH`/`flipV`) e fonte (`fontFamily`) DETECTADOS e reportados, mas não aplicados — schema de componente não tem campo pra nenhum dos dois; aplicar de verdade exigiria mudança de schema + render engine, escopo maior que "corrigir o importador". Mesmo raciocínio de "nunca substituir/descartar em silêncio" já usado em rounds anteriores desta sessão.
- `srcRect` (crop em pixel) não implementado — sem lib de processamento de imagem no servidor; `objectFit:"cover"` é a aproximação escolhida (preenche sem distorcer, não recorta exato).

### Problemas encontrados / resolvidos
- `grep -c` contava LINHAS, não ocorrências — XML real do PowerPoint é minificado em 1 linha só, então `grep -c` subestimava drasticamente contagens de `blipFill`/`custGeom` durante a investigação. Corrigido pra `grep -o | wc -l`.
- `EPERM` do `prisma generate` no Windows durante o Forge — causa já catalogada em `known-errors.md` (dev server do usuário rodando em paralelo trava o `.dll.node`). Confirmado via inspeção de processo (não presumido) que era o `next dev` do próprio usuário; não derrubado. Contornado com o workaround já documentado (`next build` direto, pulando `prisma generate`, já que nenhuma mudança tocou `schema.prisma`) — `next build` completo passou limpo.
- Teste `tests/google-calendar/cli.test.ts` falha por timeout só quando a suíte inteira roda em paralelo (confirmado passando isolado) — pré-existente, não relacionado, não investigado a fundo (fora do escopo desta sessão).

### Pendências (fora do escopo desta correção, honestamente listadas)
- Comparação visual real contra o PowerPoint original (LibreOffice headless ou equivalent) — ferramenta não disponível neste ambiente. Toda validação foi estrutural (posição/imagem/cor/z-index corretos nos dados) mais uma heurística de texto sobreposto (bounding box quase idêntico, sem achados nos 18 slides) — não é prova visual.
- Rich text por TRECHO (múltiplos estilos num mesmo parágrafo) — schema de `texto` só guarda 1 estilo por caixa inteira, limitação pré-existente não resolvida.
- `fontFamily`/`flipH`/`flipV` detectados mas não aplicados — precisaria de mudança de schema (`slide-componentes.ts`) + render engine, não só o importador.
- `gradFill`/`pattFill` (gradiente/padrão) em forma sem equivalente no schema — mesmo fallback SVG do `custGeom` colorido seria aplicável, não implementado nesta passada.
- `arcTo` dentro de `custGeom` convertido analiticamente pra arco SVG, mas sem nenhum exemplo real no arquivo de regressão pra confirmar visualmente — tratar como best-effort.

### Refletido também em
- `integration-points.md`: seção "Importação de PPTX" reescrita com a arquitetura nova (`ordem-xml.ts`+`geometria.ts`), causa raiz real, escopo atualizado e validação com arquivo real.
- `known-errors.md`: nenhuma entrada nova — o EPERM do Prisma já estava catalogado com o workaround exato usado.

**Última atualização:** 2026-08-07

---

## [2026-08-11 16:16] — Bibble: leitura confiável de PDFs e respostas não truncadas

**Tags:** #bugfix #integration #nextjs #security #critical
**Agentes envolvidos:** Bibble, Scout, River, Dex, Forge, Probe, Anubis, Sage, Scribe, Kowalski
**Arquivos tocados:** `src/app/api/bibble/{chat,upload-to-blob}/route.ts`, `src/components/BibbleChatHome/{BibbleChatInput,BibbleChatLayout,BibbleFileUpload,BibbleSettingsPanel}.tsx`, `src/lib/bibble/{attachments,attachment-security,client-stream,completion,context-budget,pdf24-ocr,tika}.ts`, `tests/bibble/*.test.ts`, `docs/stories/story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md`

### Contexto
O IAlpha perdia PDFs enviados ao Bibble e, quando o arquivo chegava a ser lido, entregava respostas abreviadas. A investigação confirmou uma corrida entre upload e envio, cortes silenciosos de 50 mil/25 mil caracteres, janela legada de 4.096 tokens sem reserva de saída, geração duplicada e persistência de streams encerrados parcialmente.

### O que foi feito
- O envio passou a exigir todos os anexos prontos tanto na UI quanto na guarda defensiva do layout; em EOF, timeout ou término por limite, texto e anexos são restaurados e a resposta parcial não é persistida.
- Foi criado um orçamento único de contexto com reserva positiva de saída, janela efetiva compatível com o modelo, seleção transparente de início/meio/fim do PDF e limite explícito serializado por provider; PDF/anexos usam uma única geração em streaming e desabilitam tools.
- A cadeia Tika → `pdf-parse` → PDF24 foi preservada, com observabilidade somente por metadados. O hardening adicionou Zod strict, limites agregados, Blob HTTPS/path/same-origin sem redirects, chaves opacas, validação de MIME/magic bytes e PDF24 same-origin.
- A suíte `tests/bibble` passou com 11 arquivos e 86 testes; lint direcionado passou sem erros e `npx next build` compilou e gerou 70 páginas. Nenhuma migration, schema ou mutação de banco foi feita.

### Decisões tomadas
- Conteúdo maior que a capacidade é reduzido preservando início/meio/fim com aviso explícito, em vez de cortes fixos silenciosos ou alegação de leitura integral.
- `finish_reason=length|max_tokens`, EOF sem `done` e `truncated:true` são falhas não persistíveis; o usuário recebe o turno original de volta para retry.
- Qualquer anexo isola o turno das tools, porque MIME/nome fornecidos pelo cliente não são prova suficiente para autorizar ações laterais.

### Problemas encontrados / resolvidos
- O botão e Enter ignoravam `filesReady`; o layout filtrava anexos ainda em upload e limpava a seleção — ambos agora compartilham a mesma regra de prontidão e o servidor mantém validação independente.
- O PDF sofria truncagem no upload, novamente no chat e na persistência; os cortes foram substituídos por orçamento consciente da janela e teto agregado testável.
- A rota fazia uma completion não-stream descartada antes da resposta final e aceitava EOF físico como sucesso; PDF/anexos agora seguem uma única geração e exigem encerramento aplicativo válido.

### Pendências
- Blobs continuam públicos por contrato do armazenamento atual; chave opaca reduz exposição, mas ownership/autorização forte de download exige arquitetura de storage autenticado.
- O caminho legado Onyx ainda tem limite próprio de aproximadamente 25 mil caracteres e não foi alterado nesta story do Bibble nativo.
- OCR continua sujeito a latência/timeout de serviços externos; streams longos ainda dependem dos limites reais do proxy/provider, embora agora falhem de modo explícito e recuperável.
- Gates globais seguem bloqueados por problemas externos/preexistentes: milhares de violações fora do escopo no lint, erros de typecheck em Exclusão Fiscal/Habilitação RADAR/Google Calendar, timeout de Google Calendar, `prisma generate` com `EPERM` e CodeRabbit indisponível sem WSL. A story permanece `In Progress`; Lens não pôde emitir aprovação formal sem Forge global verde.

### Refletido também em
- `docs/stories/story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md`: causas, critérios, implementação, testes, gates e pendências consolidados no Dev Agent Record.
- `codebase-map.md` e `integration-points.md`: fluxo de anexos, orçamento, SSE e controles de segurança atualizados por Scribe.

---

## [2026-08-13 10:54] — Alpha CRM: fluxo operacional completo da etapa Fechado

**Tags:** #feature #bugfix #integration #nextjs #prisma #security
**Agentes envolvidos:** Bibble, Scout, River, Echo, Nova, Sage, Forge, Probe, Anubis, Scribe, Kowalski
**Arquivos tocados:** `docs/stories/story-alpha-crm-fechado-status-pos-fechamento.md`, `src/lib/bpm/status-pos-fechamento.ts`, `src/lib/validations/bpm.ts`, `src/actions/bpm/Cards.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/{PainelStatusPosFechamento,PainelHistorico}.tsx`, `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `tests/bpm/{fechado-status-pos-fechamento,fechado-actions,fechado-ui,card-modal-integration}.test.ts`

### Contexto
O schema já possuía `BpmCard.statusPosFechamento` e a associação de campos obrigatórios por etapa, mas esse mapa estava operacionalmente morto: não havia inicialização, edição protegida nem representação consistente do status. A etapa Fechado também precisava impedir entrada sem Valor acordado no contrato e Forma de pagamento em todos os caminhos.

### O que foi feito
- A story foi criada e concluída com guard server-side fail-closed para Valor/Forma na criação direta, drag, modal e action direta; a entrada inicializa `AGUARDANDO_CONTRATO` atomicamente e preserva status existente em reentrada.
- Os cinco status canônicos — Aguardando contrato, Contrato a enviar, Contrato enviado, Pagamento confirmado e Contrato assinado — ganharam fonte única, Select editável no painel esquerdo, histórico, CAS versionado, reautorização dentro da transação e realtime somente após commit.
- O modal preserva rascunho local diante de atualização externa; o board exibe badge textual e tint visual específicos por status somente em Fechado.
- Regressão BPM aprovada em 19 arquivos/105 testes, além de ESLint focado e `git diff --check` limpos.

### Decisões tomadas
- Requisitos contratuais falham fechados quando a configuração está ausente ou inconsistente, sem confiar em label, ID ou estado enviados pelo cliente.
- `AGUARDANDO_CONTRATO` é default apenas na primeira entrada com status nulo; cards legados não recebem backfill e reentradas não perdem progresso.
- O status canônico permanece em `BpmCard.statusPosFechamento`; integração financeira futura ficou fora do escopo.

### Problemas encontrados / resolvidos
- Auditorias iniciais reprovaram pontos de concorrência/integração, incluindo falso conflito no realtime; o CAS passou a comparar o snapshot versionado correto, com reautorização transacional e preservação explícita do rascunho. Probe revalidou o fluxo e Anubis aprovou sem achados críticos ou importantes.
- A existência do campo no schema mascarava a falta de writers e leitores operacionais; ações, modal, board, histórico e realtime foram conectados sem duplicar fonte de dados.

### Pendências
- Cinco erros basais de typecheck permanecem fora do CRM: dois em Exclusão Fiscal, um em `HabilitacaoRadarClient.tsx` e dois em `sync-queue.ts`; lint/test/build globais e CodeRabbit continuam pendentes conforme a story.
- Nenhuma alteração de schema, migration, seed ou backfill foi realizada.

### Refletido também em
- `docs/stories/story-alpha-crm-fechado-status-pos-fechamento.md`: escopo, decisões, matriz de testes, gates e File List finais.
- `codebase-map.md` e `integration-points.md`: contrato dos status, guard de entrada, edição protegida, realtime e representação no board.

---

## [2026-08-13 11:36] — Alpha CRM: Motivo de Lost sem bypass

**Tags:** #feature #bugfix #integration #nextjs #security
**Agentes envolvidos:** Bibble, Scout, River, Echo, Nova, Sage, Forge, Probe, Anubis, Lens, Scribe, Kowalski
**Arquivos tocados:** `docs/stories/story-alpha-crm-lost-motivo.md`, `src/lib/bpm/lost.ts`, `src/lib/validations/bpm.ts`, `src/actions/bpm/Cards.ts`, UI do Alpha CRM em `CardModal`/`NovoCardModal`, `tests/bpm/{lost,lost-actions,lost-ui,card-modal-ui}.test.ts`

### Contexto
Lost precisava expor o motivo corretamente e impedir bypass por criação, drag, modal, action direta ou edição concorrente.

### O que foi feito
- Catálogo canônico com quatro motivos e **Outro**; este exige companion textual condicional.
- Helper `lost.ts` e guards fail-closed antes/dentro da transação, com CAS/realtime de resolução explícita, teto de 100 campos e histórico somente por IDs.
- UI condicional ficou no lado esquerdo e na criação; painel direito e banco não foram alterados.

### Decisões tomadas
- Configuração ausente ou divergente bloqueia a operação; nenhuma migration, seed ou backfill foi necessário.

### Problemas encontrados / resolvidos
- Forge aprovou 22 arquivos/150 testes BPM, lint focado e diff-check; Probe/Anubis aprovaram e a ressalva documental do Lens foi corrigida.

### Pendências
- Cinco erros basais de typecheck permanecem fora do CRM; build global e CodeRabbit não foram executados, conforme a story.

### Refletido também em
- `docs/stories/story-alpha-crm-lost-motivo.md`: contrato, gates e File List finais.

---

## [2026-08-13 12:05] — Alpha CRM: Próximo Contato na entrada de Sem Viabilidade

**Tags:** #bugfix #crm #integration #security
**Agentes envolvidos:** Bibble, Scout, Echo, Nova, Forge, Probe, Anubis, Lens, Kowalski

### O que foi feito
- `etapaExigeProximoContato` virou a fonte única client-safe para Em Tratativa e Sem Viabilidade, tolerando caixa, acentos e espaços.
- A criação pelo `+` passou a exibir Data/Hora obrigatória, validar o valor e enviar ISO.
- `CriarCardBpm` valida antes e dentro da transação, persiste `proximoContatoEm` atomicamente e publica realtime somente após commit.
- Drag e modal continuam no executor comum já protegido; `PainelProximoContato` permanece no lado esquerdo para edição posterior.
- Nenhuma alteração de banco, rota ou painel direito.

### Qualidade
- BPM: 23 arquivos/158 testes PASS; ESLint focado e diff-check PASS.
- Forge, Probe, Anubis e Lens aprovaram. O typecheck mantém somente os cinco baselines externos conhecidos.
- Story: `docs/stories/story-alpha-crm-sem-viabilidade-proximo-contato.md`, Ready for Review.
