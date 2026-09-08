# Story RM-2026-DBEF25 — Remover Regras Financeiras do CRM/BPM

## Contexto

O Alpha CRM/BPM possui uma função configurável chamada **Regras Financeiras**, criada pelo
RM-2026-002817. Ela reúne um workspace administrativo de regras tributárias, um painel de
cálculo no card, aplicação dessas regras no movimento do card e uma ponte específica para
gerar eventos no módulo de Comissões.

Este objetivo descontinua somente essa função. O Pipeline Financeiro, suas etapas, campos,
validações e cálculo canônico continuam ativos. O Motor de Regras BPM e o módulo autônomo de
Comissões também permanecem. Não será criado substituto.

## Classificação de escopo

### Remover

- rota e workspace `Alpha CRM > Configurações > Regras Financeiras`;
- Server Actions exclusivas de regras financeiras;
- painel configurável de cálculo exibido no card;
- schemas, motor, persistência e conector CRM → Comissões exclusivos da função;
- testes exclusivos da implementação descontinuada.

### Ajustar

- retirar o link da configuração do CRM e os pontos de montagem/chamada em arquivos
  compartilhados;
- manter regras financeiras históricas ocultas e inertes por meio de um marcador legado no
  domínio genérico de regras, sem apagar registros;
- adicionar regressão estática que comprove a ausência da função e a preservação dos módulos
  vizinhos.

### Preservar

- `src/lib/bpm/pipeline-financeiro.ts`, action/preset e testes do Pipeline Financeiro;
- cálculo tributário canônico, guardas de movimento e proteção de campos calculados do
  Pipeline Financeiro;
- Motor de Regras BPM, sua rota administrativa, CRUD e guarda de movimento;
- construtor, regras, gerador e telas do módulo autônomo de Comissões;
- tabelas, migrations e dados históricos compartilhados.

## Critérios de aceitação

- [x] O card/link “Regras Financeiras” não aparece nas Configurações do CRM.
- [x] A URL `/PainelAlpha/AlphaCRM/admin/regras-financeiras` deixa de existir.
- [x] O modal do card não monta o painel configurável de cálculo financeiro.
- [x] Actions, bibliotecas e chamadas exclusivas da função não permanecem no runtime.
- [x] O movimento de card não dispara mais a ponte específica CRM → Comissões.
- [x] Registros legados marcados não aparecem no Motor de Regras genérico nem são avaliados
  por sua guarda de movimento.
- [x] Pipeline Financeiro, Motor de Regras genérico e módulo de Comissões permanecem
  disponíveis e cobertos por regressão.
- [x] Não há alteração de schema, migration, seed, backfill ou dados.
- [x] Lint, typecheck, testes direcionados, suíte e build são executados e documentados.

## Banco de dados e rollback

`DATABASE_CHANGE_NOT_REQUIRED`. A função reutiliza `BpmRegra`/`BpmRegraVersao` e estruturas
genéricas de Comissões; não possui tabela exclusiva. Os registros históricos permanecem no
banco, mas são filtrados na listagem e no carregamento do runtime. Qualquer limpeza física
futura exigirá outro objetivo, Vault, backup verificado e aprovação explícita.

O rollback de código consiste em restaurar os arquivos exclusivos e seus pontos de integração.
Como não há mutação de dados, nenhuma restauração de banco faz parte desta entrega.

## Plano de execução

- [x] Fase 0 — auditoria de entregabilidade e sobreposições.
- [x] Fase 1 — blueprint Scout com classificação REMOVER/AJUSTAR/PRESERVAR.
- [x] Fase 2 — story criada antes da alteração de produção.
- [x] Fase 3 — Vault: `DATABASE_CHANGE_NOT_REQUIRED`.
- [x] Fase 4 — retirar superfície visual e acesso direto.
- [x] Fase 5 — retirar backend e integrações exclusivas.
- [x] Fase 6 — limpar referências e criar regressões.
- [x] Fases 7–11 — Forge, Probe, Anubis, Lens e Sage.
- [x] Fase 12 — atualizar memória técnica.
- [x] Fase 13 — registrar journal e concluir relatório.

## Evidências

- Busca residual em `src` não encontrou a rota, os componentes, as actions ou as chamadas
  exclusivas removidas. O marcador restante existe somente no módulo de compatibilidade.
- Testes direcionados finais: 6 arquivos, 64 testes aprovados. Cobrem remoção, filtro
  null-safe, preservação de regra global/do pipeline, reserva do prefixo e bloqueio sem write
  de atualização, ativação e exclusão de registros históricos.
- Suíte completa de Comissões: 21 arquivos, 196 testes aprovados.
- ESLint direcionado: zero erros; permaneceu apenas o warning preexistente da função
  `executarMovimentoLegadoDesativado` não utilizada em `Cards.ts`.
- `git diff --check`: aprovado.
- Dois builds isolados: aprovados. O build final compilou, gerou 78 páginas e o manifesto não
  contém `/PainelAlpha/AlphaCRM/admin/regras-financeiras`; portanto o acesso direto cai no
  `not-found` do App Router. Avisos não fatais do worker PDF permaneceram fora do escopo.
- Probe: PASS após correção do filtro nullable. Anubis: PASS, sem achado crítico/alto/médio,
  após proteger as mutações genéricas. Lens/Sage: PASS, sem overdelete ou blocker funcional.
- Suíte global no worktree concorrente: 304 arquivos aprovados e 24 falhos; 2.487 testes
  aprovados e 57 falhos. As falhas permanecem em módulos e mocks fora dos hunks desta entrega,
  incluindo Calendar, Alpha SEO, Chatbot, Gerador de Documentos e testes antigos de movimento
  que não mockam `bpmCardVinculo.findMany`.
- Typecheck global foi executado com 8 GB após regenerar os tipos de rota. Não apontou erro nos
  arquivos da entrega, mas permaneceu vermelho por tipos gerados do dev server e débitos
  concorrentes em Calendar, Pusher, Gerador de Documentos, Chatbot e outros módulos. A
  execução com limite padrão também atingiu OOM.
- Lint global foi executado e preserva o baseline amplo do repositório: 2.486 erros e 1.258
  warnings, concentrados em infraestrutura `.agents`/`.aiox-core` e código legado fora do
  objetivo. O lint direcionado da entrega está verde.
- Vault: `DATABASE_CHANGE_NOT_REQUIRED`; `git diff --name-status` confirma ausência de schema,
  migration, seed e scripts de alteração de dados.

## File List

### Criados

- `docs/stories/story-rm-2026-dbef25-remover-regras-financeiras.md`
- `src/lib/bpm/regras/legado.ts`
- `tests/bpm/regras-financeiras-remocao.test.ts`

### Ajustados

- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Regras.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx`
- `src/lib/bpm/regras/contexto.ts`
- `tests/bpm/regras-actions.test.ts`
- `tests/bpm/regras-guarda-movimento.test.ts`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`

### Removidos

- `src/actions/bpm/RegrasFinanceiras.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/regras-financeiras/page.tsx`
- `src/components/bpm/regras-financeiras/PainelCalculoFinanceiro.tsx`
- `src/components/bpm/regras-financeiras/RegrasFinanceirasWorkspace.tsx`
- `src/lib/bpm/regras-financeiras/comissoes-card.ts`
- `src/lib/bpm/regras-financeiras/motor.ts`
- `src/lib/bpm/regras-financeiras/persistencia.ts`
- `src/lib/bpm/regras-financeiras/schemas.ts`
- `tests/bpm/regras-financeiras-comissao.test.ts`
- `tests/bpm/regras-financeiras-engine.test.ts`
