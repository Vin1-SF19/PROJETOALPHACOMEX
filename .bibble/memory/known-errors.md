# KNOWN ERRORS — Erros Conhecidos e Fixes

> Consultado por: Forge e todos os agentes antes de debugar
> Adicionar SEMPRE após resolver um erro novo.

---

### Script de migration ad-hoc: split de statements por `.split(";\n")` engole `CREATE TABLE` quando o arquivo .sql começa com linhas de comentário `-- ...`
**Sintoma:** ao aplicar `prisma/migrations/20260826173000_add_parceiro_tarefa/migration.sql` statement-por-statement via `@libsql/client`, o primeiro `CREATE INDEX` falhou com `SQLITE_UNKNOWN: no such table: main.parceiro_tarefa` — mesmo o `CREATE TABLE` sendo o statement anterior no arquivo e reportando sucesso aparente. Investigação (`PRAGMA foreign_key_check`/`sqlite_master` direto no Turso) confirmou: a tabela realmente NUNCA foi criada — nada persistiu, nem erro nem sucesso silencioso do lado do servidor.
**Causa raiz:** era um bug no script local de aplicação, não no Turso. O parser `sql.split(";\n").filter(s => !s.startsWith("--"))` juntou os 2 comentários de cabeçalho do arquivo (`-- RM-...` / `-- Migration 100%...`) com o `CREATE TABLE` inteiro em um único "statement 0" (porque o split só corta DEPOIS do primeiro `;`, e o `CREATE TABLE` multi-linha não tem `;` até o fim dele) — e o filtro `startsWith("--")` descartou esse statement inteiro por começar com comentário, incluindo o `CREATE TABLE` que vinha junto. Os demais `CREATE INDEX`/`ALTER TABLE`, sem comentário próprio, passaram batido — por isso o erro só apareceu no índice, não no `CREATE TABLE`.
**Fix:** sempre que aplicar SQL de migration via script ad-hoc, remover linhas de comentário (`.split("\n").filter(line => !line.trim().startsWith("--")).join("\n")`) ANTES de dividir por `;` — nunca filtrar por `startsWith("--")` depois de já ter agrupado por `;\n`, porque um statement multi-linha pode carregar um comentário de cabeçalho junto e ser descartado inteiro.
**Lição geral:** depois de qualquer statement de migration reportar "OK" via script solto, SEMPRE confirmar contra `sqlite_master`/`PRAGMA table_info` antes de seguir para o próximo — "não deu erro" não é prova de que persistiu (já visto antes com o Hrana batch; agora confirmado que um bug de parsing local pode produzir o mesmo sintoma por um motivo totalmente diferente).
**Adicionado em:** 2026-08-26 (Bibble, migration `parceiro_tarefa`, RM-2026-8B7DC7)

---

### Roadmap — worker de documentação (Qwen) processava vários objetivos ao mesmo tempo, deveria ser 1 por vez (2026-08-26, CORRIGIDO)
**Sintoma:** Usuário reportou que o worker de documentação estava "documentando vários ao mesmo tempo, sendo que é para documentar 1 por 1". Múltiplos objetivos entravam em `DOCUMENTING` simultaneamente.
**Causa raiz:** `RoadmapDocumentationJob.claimToken` (fencing otimista) só protege contra o MESMO job ser reivindicado duas vezes — não impede que dois processos worker DIFERENTES reivindiquem jobs DIFERENTES ao mesmo tempo, cada um chamando o Ollama/Qwen em paralelo sem nenhuma serialização entre si. Não havia nenhum lock global de sequenciamento na fila.
**Fix:** nova tabela `RoadmapDocumentationWorkerLock` (lock global singleton, `id` fixo `"singleton"`, mesmo padrão de fencing otimista com `claimToken` incremental + lease de 12min via `claimExpiresAt`/heartbeat de 30s). `src/lib/roadmap-alpha/worker.ts`: `processNextRoadmapJob` agora chama `acquireWorkerLock(workerId)` ANTES de `claimNextJob` — se não conseguir o lock, retorna `{ processed: false }` sem reivindicar nada. Lock é liberado no `finally` (`releaseWorkerLock`) e renovado junto do heartbeat do job (`heartbeatWorkerLock`). Migration 100% aditiva (`CREATE TABLE`), aplicada em produção via protocolo Vault completo (backup + confirmação explícita).
**Lição geral:** um `claimToken` por-linha (job individual) NÃO substitui um lock de fila — eles resolvem problemas diferentes. Fencing por-item impede double-claim do MESMO recurso; um lock global/singleton é o que impede concorrência entre RECURSOS DIFERENTES quando a regra de negócio exige processamento estritamente sequencial da fila inteira.
**Adicionado em:** 2026-08-26 (Bibble, execução direta a pedido do usuário)

---

### Alpha CRM — Campo BPM com etapaId=null ("Todas as etapas" no admin) nunca aparece em nenhuma etapa — RM-2026-04C4B0 (2026-08-26, CORRIGIDO)
**Sintoma:** Usuário reportou que "campos já preenchidos perdem valor entre etapas" no card do Alpha CRM. Investigação confirmou: campos configurados no admin do pipeline (`AdminPipelineClient.tsx`) com a opção **"Todas as etapas"** (que grava `BpmCampo.etapaId = null`) nunca aparecem em NENHUMA etapa — mesmo com valor real já salvo em `BpmCardCampoValor`. Confirmado em produção: 6 campos (CNPJ, Nome do responsável, Radar pretendido, Confirmar serviço, Valor acordado no contrato, Forma de pagamento) tinham valores reais preenchidos por usuários, mas ficavam 100% invisíveis.
**Causa raiz:** `carregarCamposAplicaveisEtapa`/`carregarCamposObrigatoriosEtapa` (`src/lib/bpm/requisitos-etapa-server.ts`) filtravam `bpmCampo.findMany({ where: { pipelineId, etapaId } })` por igualdade exata — um campo com `etapaId: null` no banco nunca bate com `etapaId: "<id-da-etapa-atual>"` no Prisma (Prisma não trata `{ etapaId: "x" }` como "inclui nulls"). O mecanismo que faria um campo global aparecer numa etapa específica (`BpmCampoObrigatorioEtapa`) existe no schema e é lido pela query, mas **nunca é escrito por nenhuma Server Action/UI** — infraestrutura morta, nunca conectada.
**Fix:** trocar o `where` de `{ pipelineId, etapaId }` para `{ pipelineId, OR: [{ etapaId }, { etapaId: null }] }` nas 2 funções. Correção de 7 linhas, sem tocar frontend/schema/rota — o bug era 100% de leitura backend.
**Lição geral:** ao filtrar por uma FK nullable no Prisma que representa "aplica-se a X específico OU a todos" (`etapaId: string | null`), NUNCA usar `where: { chave: valorAtual }` sozinho — sempre `where: { OR: [{ chave: valorAtual }, { chave: null }] }`, a menos que "null" tenha sido deliberadamente excluído por decisão de produto (confirmar contra o texto real da UI, não assumir). Antes de aceitar um teste existente como prova de comportamento correto, verificar se ele reflete a UI real — neste caso um teste unitário documentava o bug como se fosse esperado.
**Adicionado em:** 2026-08-26 (Bibble, execução via Roadmap Production)

---

### `CardFullViewModal.tsx` — eslint `react-hooks/refs` ("Cannot access refs during render") pré-existente, não relacionado a mudanças no CardModal
**Sintoma:** `npx eslint src/app/PainelAlpha/AlphaCRM/CardModal/` reporta 1 `error` (não warning) em `CardFullViewModal.tsx:197:44`, na linha `onAtualizado={() => { void recarregar(); onAtualizado(); }}` — a regra nova `react-hooks/refs` do eslint-plugin-react-hooks acusa que `recarregar` (função que provavelmente lê `acessoRevogadoRef.current` internamente) está sendo referenciada dentro de um closure passado como prop durante o render.
**Confirmado NÃO ser regressão:** `git status`/`git diff HEAD` confirmam que `CardFullViewModal.tsx` não foi tocado na sessão em que este erro foi descoberto (2026-08-26, execução do objetivo RM-2026-6D5A60 — só `CardOpenFormSlot.tsx`/`CardOpenShell.tsx`/`PainelContatos.tsx` foram editados/removidos). O arquivo também tem ~15 warnings pré-existentes de `no-unused-vars` (props/estado declarados mas nunca usados: `realtimeRevision`, `onClose`, `dadosEmpresaDrawer`, `podeMoverEtapa`, etc.) — sinal de que ninguém rodou `eslint` escopado nesse diretório específico antes (só o lint completo do projeto, que aparentemente não pegou por alguma diferença de config/cache — investigar se necessário no futuro).
**Ação:** não corrigido nesta sessão — fora do escopo da tarefa em andamento (limpeza de `CardOpenFormSlot`/remoção de código morto), e mexer na leitura de refs de `CardFullViewModal.tsx` é risco desnecessário sem uma tarefa dedicada a esse arquivo. Registrar aqui para não ser confundido com regressão em sessões futuras que tocarem este diretório.
**Adicionado em:** 2026-08-26 (Bibble, execução do objetivo RM-2026-6D5A60, Fase 3/Forge)

---

### `npm run build` falha em arquivos de `Roadmap*`/`roadmap-alpha`/`roadmap-production` sem eu ter tocado nesses arquivos — processo autônomo concorrente, não é regressão
**Sintoma:** `npm run build` (Turbopack) falha com erro de módulo em arquivos como
`src/actions/RoadmapProduction.ts`, `src/lib/roadmap-alpha/*`, `RoadmapDashboard.tsx`,
`RoadmapImplementationRoom.tsx` etc. — mesmo numa sessão que não editou nenhum arquivo desse
módulo. Rodar o build de novo minutos depois produz um erro DIFERENTE, ainda confinado aos
mesmos arquivos de Roadmap.
**Causa raiz confirmada (2026-08-25, sessão CRM Canais e Parcerias):** o Painel Alpha tem um
sistema próprio de desenvolvimento autônomo (Roadmap Production, ver `codebase-map.md` — workers
`.ps1`/`.mjs` que rodam como processos separados, escrevendo código de verdade neste MESMO
working directory). Confirmado via `git status` (arquivos de `roadmap-production`/`roadmap-alpha`
modificados/deletados que a sessão atual não tocou) + timestamp de arquivo (`RoadmapProduction.ts`
modificado há SEGUNDOS antes do build) + `Get-Process` (múltiplos processos `node`/`powershell`
iniciados nos minutos imediatamente anteriores). O build captura um snapshot do meio de um
refactor de outro processo, não um erro real e estável.
**O que fazer:** NUNCA tentar "consertar" arquivos de Roadmap por causa disso — não é seu escopo
e o outro processo pode estar no meio de uma mudança legítima. Para validar SEU PRÓPRIO trabalho
com confiança quando isso acontecer: (1) `npx eslint <seus arquivos específicos>` — não depende
de resolução cruzada de módulos de outras partes do projeto; (2) `npx tsc --noEmit` completo,
mas ler o log INTEIRO (não só grep pelo nome do seu módulo) — se os únicos erros forem os
baselines já catalogados (`ReceitaFederal`/`ExclusaoFiscal`/`HabilitacaoRadarClient`/
`google-calendar sync-queue`) e nada de Roadmap aparecer no `tsc`, seu código está correto
independente do que `next build` reportar naquele instante; (3) rodar a suíte de testes
Vitest relevante (isolada via mocks, não afetada pelo estado de compilação de outros módulos).
Se precisar mesmo de um `npm run build` limpo como evidência final, esperar alguns minutos e
rodar de novo — mas não bloquear a entrega do seu próprio trabalho por um erro comprovadamente
alheio.
**Adicionado em:** 2026-08-25 (Bibble/Vault/Forge, Fase 04 do CRM de Canais e Parcerias)

---

### Migration no Turso remoto: `client.transaction("write")` em lote falha com "no such table" ao criar tabelas com FK cruzada no mesmo batch
**Sintoma:** Ao aplicar uma migration multi-`CREATE TABLE` via `@libsql/client` usando `client.transaction("write")` + `tx.execute()` para cada statement + `tx.commit()`, o Turso remoto (protocolo Hrana HTTP) retorna `LibsqlBatchError: SQLITE_UNKNOWN: no such table: main.<TabelaCriadaAntesNoMesmoBatch>` — mesmo a tabela referenciada sendo a PRIMEIRA statement do batch. O erro acontece mesmo quando o mesmo SQL, testado antes contra um SQLite local via `client.executeMultiple(sql)`, passa sem nenhum problema (é o que gerou falsa confiança antes de tentar em produção).
**Causa raiz:** o protocolo Hrana do Turso remoto, no modo `transaction()`, não resolve de forma confiável referências de FK a uma tabela criada mais cedo no MESMO batch não commitado — diferente do modo local (`executeMultiple`), que resolve tudo na mesma conexão SQLite direta. Ao dar erro, o rollback do lado do cliente não necessariamente reflete o que o servidor remoto realmente persistiu: numa ocorrência real (2026-08-25, migration `20260825180000_add_roadmap_production_status`), 2 das 3 tabelas do lote ficaram criadas (vazias, sem violação de FK) mesmo com o batch inteiro reportando erro e "rollback" — só a 1ª tabela (que não tinha nenhuma FK pendente ainda) não foi criada, criando um estado parcial que exigiu diagnóstico manual antes de continuar.
**Fix:** para migrations no Turso remoto que criam múltiplas tabelas com FK entre si, usar `client.execute(sql)` **simples, um statement por vez, sem `transaction()`/batch**, verificando cada `CREATE TABLE`/`CREATE INDEX` individualmente (`SELECT name FROM sqlite_master WHERE name=...`) antes de seguir para o próximo. Mais lento, mas cada passo é atômico e confirmável — sem risco de estado parcial invisível.
**Lição geral:** SEMPRE, depois de qualquer tentativa de migration remota que reportar erro (mesmo com "rollback"), rodar `SELECT name, type FROM sqlite_master WHERE name LIKE '%NomeDaFeature%'` no banco real antes de tentar de novo — nunca assumir que erro reportado = nada foi persistido no Turso remoto. `PRAGMA foreign_key_check` sozinho não pega esse cenário (tabelas parcialmente criadas mas vazias não geram violação de FK).
**Adicionado em:** 2026-08-25 (Bibble/Vault, migration do novo motor de status do Roadmap Production)

---

### `tests/bpm/` tem 28 testes falhando PRÉ-EXISTENTES (11 arquivos) — baseline real é 287/315, não 315/315
**Sintoma:** `npx vitest run tests/bpm` retorna "11 failed | 39 passed (50 arquivos), 28 failed | 287 passed (315 testes)" mesmo sem nenhuma mudança em código de BPM/Alpha CRM.
**Causa raiz:** dívida de teste acumulada de remoções de UI já documentadas em `decisions.md` (ex: `PainelRequisitosAvanco.tsx` removido em RM-2026-3E14F1, `PainelContatos.tsx` removido em RM-2026-05E75A) — os testes fazem asserção estática de que certos componentes/strings aparecem no código-fonte (`readFileSync` + `toContain`), e ficaram órfãos quando os componentes foram removidos da UI por decisão deliberada, sem que os testes fossem atualizados junto. `tests/bpm/standby-follow-up.test.ts:139` é um exemplo confirmado (`expect(registrar).toContain("<PainelStandbyFollowUp")`).
**Confirmado NÃO ser regressão de nenhuma sessão específica:** verificado via `git stash` isolando qualquer mudança em andamento — as mesmas 28 falhas, nos mesmos 11 arquivos, com a mesma asserção, reproduzem no baseline limpo (2026-08-25, sessão CRM de Canais e Parcerias, Fase 01).
**Ação para sessões futuras:** ao rodar a suíte `tests/bpm/` como gate de regressão de qualquer feature nova, o baseline de comparação é **287/315 passando**, não 315/315. Uma queda abaixo de 287 é regressão real; 287 mantido não é. Corrigir os 28 testes órfãos é trabalho de limpeza válido, mas está fora do escopo de qualquer feature que não seja especificamente sobre esses componentes — não tente "consertar" silenciosamente como efeito colateral de outra tarefa.
**Baseline da suíte COMPLETA do projeto (`npx vitest run`, sem filtro), confirmado em 2026-08-26 na Fase 08 (fechamento da fila CRM de Canais e Parcerias):** **1718 passando / 1751 totais** (242 arquivos, 226 passando/16 falhando). Os 33 testes falhando se decompõem em: os mesmos 28 de `tests/bpm/` acima **+ 5 falhas pré-existentes e não relacionadas** em outros módulos, também confirmadas sem nenhuma ligação com Parceiros/Canais (nenhum arquivo desses módulos foi tocado nesta fila):
- `tests/alpha-seo/inventory.test.ts` (1) e `tests/alpha-seo/schema-draft.test.ts` (1)
- `tests/apresentacoes/pptx-parser.test.ts` (1)
- `tests/bibble/context-budget.test.ts` (1)
- `tests/google-calendar/cli.test.ts` (1, timeout de 5000ms — pode ser flaky, não investigado a fundo por estar fora do escopo desta fila)
Ao rodar a suíte COMPLETA como gate final de qualquer feature futura, o baseline de comparação é **1718/1751**, não 1751/1751. `tests/parceiros/`+`tests/cs-nps/` devem continuar 100% (124/124 confirmado nesta mesma sessão) — qualquer falha nesses dois diretórios É regressão real.
**Adicionado em:** 2026-08-25/26 (Bibble/Vault/Sage, Fases 01 e 08 do CRM de Canais e Parcerias)

---

### CS&NPS — "Invalid input: expected string, received null" ao clicar em "Salvar Cliente" (cadastro novo) — bug pré-existente, mascarado pelo bloqueio de telefone do sócio
**Sintoma:** No modal de cadastro de cliente novo, ao clicar em "Salvar Cliente", erro de validação `Invalid input: expected string, received null`. Só passou a aparecer depois de o telefone do sócio virar opcional (2026-08-25) — antes, o cadastro sempre travava mais cedo nesse campo e nunca chegava a bater nesse segundo bug.
**Causa raiz:** `handleFinalizar` em `modal.tsx` monta o payload usando `campo || null` para `embasamento`, `origemLead`, `formaPagamento`, `valorContrato`, `closerNome` quando vazios — mas `cadastrarClienteSchema` (`src/lib/validations/cs-nps.ts`) define esses campos como `z.string().optional()`/`z.coerce.number().optional()`, que aceitam `undefined`, **não `null`**. Zod trata os dois como tipos diferentes por padrão.
**Fix:** trocar `|| null` por `|| undefined` nesses 5 campos em `modal.tsx:140-145`. O backend (`CadastrarCliente`/`resolverClienteCsNps` em `Clientes.ts`) já normaliza para `null` na hora de gravar no Prisma (`d.embasamento || null`, etc.), então o comportamento final no banco não muda — só o contrato de validação do payload.
**Lição geral:** Zod `.optional()` sozinho NUNCA aceita `null` — só `undefined`. Campo que pode legitimamente vir `null` (nullable no banco/UI) precisa de `.nullable()` explícito no schema, OU o caller deve normalizar `null → undefined` antes de enviar. Ao montar payload de Server Action a partir de state React, preferir `valor || undefined` em vez de `valor || null`, a menos que o schema do lado do servidor use `.nullable()`.
**Adicionado em:** 2026-08-25 (Bibble/Echo/Forge)

---

### Deploy falha com "Cannot find module '@/auth'" — alias `@/*` não cobre a raiz do projeto
**Sintoma:** Build/deploy quebra com `Cannot find module '@/auth' or its corresponding type declarations` num arquivo novo (nesta ocorrência, `src/app/api/painel-alpha/clientes/[id]/timeline/route.ts`). É um erro de RESOLUÇÃO DE MÓDULO do bundler (webpack/turbopack), não um erro de tipo — por isso derruba o build mesmo com `typescript.ignoreBuildErrors: true` no `next.config.ts` (esse flag só ignora erros de type-check, não erros de resolução de import).
**Causa raiz:** `auth.ts` vive na RAIZ do projeto (`./auth.ts`), mas o alias `@/*` no `tsconfig.json` mapeia só para `./src/*`. O CLAUDE.md documenta `import { auth } from '@/auth'` como padrão — **essa documentação está desatualizada/errada**. Confirmado por grep em todo `src/app/api/`: 100% das rotas existentes usam import RELATIVO até a raiz (ex.: `import { auth } from "../../../../../auth"`, profundidade variando com a quantidade de pastas do arquivo).
**Fix:** trocar `import { auth } from '@/auth'` por caminho relativo (`../` × número de pastas entre `src/app/api/` e a raiz, inclusive). Nunca usar `@/auth` em código novo.
**Lição geral:** ao criar uma rota nova em `src/app/api/`, checar como uma rota IRMÃ próxima importa `auth` antes de escrever o import — não confiar cegamente no exemplo do CLAUDE.md para esse caso específico.
**Adicionado em:** 2026-08-25 (Bibble/Echo/Forge)

---

### CS&NPS — "Invalid input: expected string, received undefined" ao clicar em "Salvar Cliente" (cadastro novo sempre falhava)
**Sintoma:** No módulo CS&NPS (`/PainelAlpha/CadastroClientes`), preencher o modal "Cadastro de Cliente" (CNPJ, serviço, analista, sócios) e clicar em "Salvar Cliente" sempre retornava erro de validação — 100% dos cadastros novos falhavam, não era um caso isolado.
**Causa raiz:** Bug de contrato de payload entre frontend e Server Action, NÃO relacionado a CRM/feature flag/bloqueio intencional (hipótese inicial descartada após investigação — banco, schema Prisma e FKs de `Cliente`/`ClienteServico`/`Pessoa`/`PessoaClienteVinculo` confirmados 100% saudáveis via `PRAGMA foreign_key_check` e teste de transação real contra o Turso). `handleFinalizar` em `modal.tsx` montava o payload com a chave `servicos: servicosSelecionados` (array), mas `cadastrarClienteSchema` (`src/lib/validations/cs-nps.ts`) exige `servico: z.string().trim().min(1)` (singular, string) — a chave nunca batia, `dados.servico` chegava `undefined` no `safeParse`, e o Zod rejeitava com essa mensagem genérica.
**Fix:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx:138` — trocado `servicos: servicosSelecionados` por `servico: servicosSelecionados[0]` (a UI de seleção de serviço já só permite escolher 1 por vez). Adicionada validação de UX (`if (servicosSelecionados.length === 0) return toast.error("Selecione o Serviço!")`) antes do envio, mesmo padrão dos outros campos obrigatórios da função.
**Lição geral:** Quando o erro do Zod é "expected X, received undefined" em uma Server Action, verificar PRIMEIRO se o nome da chave no payload do client bate exatamente com o nome do campo no schema — plural vs singular é um erro fácil de não notar numa leitura rápida do código, e symptom (erro genérico) não indica a causa (é fácil suspeitar de banco/permissão/feature desativada primeiro, como aconteceu nesta investigação).
**Contexto:** Não confundir com a sincronização automática Metas→CS&NPS (`criarRegistroClienteAPartirDeContrato` em `Clientes.ts`, chamada por `ContratoComercial.ts`) — usa uma interface própria (`servico: string`) e nunca teve esse bug; caminho de dados totalmente separado do cadastro manual.
**Adicionado em:** 2026-08-24 (Bibble/Scout/Echo/Forge/Probe)

---

### Extratos Bancários — "Erro ao cadastrar período" / FOREIGN KEY constraint failed ao criar `PeriodosAnalise` — CAUSA RAIZ REAL: constraint física presa em tabela renomeada
**Sintoma:** Ao clicar em "+ Adicionar Mês de Análise" dentro do detalhe de uma empresa em `/PainelAlpha/ExtratosBancarios/[Id]`, a criação falha com `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` — **mesmo depois de validar em código que o `Extratos.id` existe de verdade** (`db.extratos.findUnique` retornando sucesso, e o `create()` ainda assim falhando).
**Causa raiz real (achado importante, não é bug de aplicação):** a constraint FÍSICA de FK do SQLite em `PeriodosAnalise.extratoId` estava presa em `Extratos_old_fase33` — a tabela `Extratos` ANTIGA, renomeada e congelada durante a "Fase 3.3 do Cliente Master" (13/08/2026, ver `plano-cliente-master.md`). O Prisma Client aponta para o model/tabela atual (`Extratos`), mas o SQLite validava a FK contra a tabela congelada, que nunca recebeu os registros criados depois do rename. Resultado: `db.extratos.findUnique` (lê a tabela atual) confirma que o registro existe, mas o `INSERT` físico falha porque a constraint real aponta para outro lugar. Reproduzido e confirmado via `PRAGMA foreign_key_list(PeriodosAnalise)` e teste direto de `create()`.
**Descoberta mais ampla:** o MESMO padrão ("rename de tabela em migration não recria a FK das tabelas-filhas") foi encontrado em outras 8 relações do banco, afetando os módulos CheckList (`Checklist.empresaId → operacional_clientes_old_fase35`), Comissões (`CommissionEntry`/`CommissionDivergence.eventId → CommissionEvent_old_fase37`, `CommissionEvent.businessProcessId → BusinessProcess_old_fase37`), BPM/Alpha Blueprint (8 tabelas filhas de `BpmCard` → `BpmCard_old_fixfk`), e `observacoes_contratos.contratoId → contratos_comerciais_old_fase36`. Já existia 1 precedente documentado e corrigido (`indicacoes.clienteId`, Fase 4 do Cliente Master, 2026-08-15, ver `plano-cliente-master.md` linha 380) — mas as outras 8 relações nunca tinham sido auditadas até esta sessão.
**Fix aplicado (só `PeriodosAnalise`, escopo reduzido a pedido do usuário — as outras 8 relações continuam pendentes):**
1. Validação defensiva em `src/actions/periodos.ts` (`db.extratos.findUnique` antes do `create()`) — necessária mas insuficiente sozinha, mantida por defesa em profundidade.
2. Backup completo do Turso gerado (`database-backups/pre-change/painelalpha_turso_pre_change_periodosanalise-fk-fix_2026-08-21T18-54-56-324Z.sql`, 242 tabelas, 38098 linhas).
3. `PeriodosAnalise` recriada via `CREATE TABLE ... AS SELECT` com a FK correta apontando para `Extratos` (padrão obrigatório no SQLite — não existe `ALTER TABLE ... DROP CONSTRAINT`/mudar alvo de FK diretamente): `CREATE nova tabela com FK correta` → `INSERT SELECT * FROM antiga` → `DROP` da antiga → `RENAME` para o nome original. 49 linhas preservadas.
4. Ao corrigir a constraint, `PRAGMA foreign_key_check` revelou 7 linhas realmente órfãs (períodos de 6 empresas que nunca migraram para a nova tabela `Extratos`/`Cliente` na Fase 3.3 — incluindo ALPHA COMEX BRASIL LTDA, com 534 transações reais vinculadas). Restauradas criando `Cliente` novo para cada CNPJ (dados vindos de `Extratos_old_fase33`) + `Extratos` vinculado preservando o `id` original (para não precisar tocar em `PeriodosAnalise.extratoId` já existente). Validação final: `PRAGMA foreign_key_check` zerado, teste real via Prisma Client criando e removendo período de teste em `extratoId: 37` e `extratoId: 7` (Alpha Comex) — ambos com sucesso.
**Atualização (mesmo dia, sessão seguinte):** o usuário pediu para corrigir o restante. 10 das 11 relações pendentes foram corrigidas com o mesmo padrão (backup completo prévio + `CREATE nova tabela com FK correta` → `INSERT SELECT` → `DROP` → `RENAME` + índices recriados manualmente, em `_tmp-fix-fk-fase2.mjs`, script pontual apagado após uso): `observacoes_contratos.contratoId → contratos_comerciais`, `CommissionEvent.businessProcessId → BusinessProcess`, `CommissionEntry.eventId → CommissionEvent`, `CommissionDivergence.eventId → CommissionEvent`, e as 8 tabelas filhas de `BpmCard` (`BpmCardCampoValor/Membro/Vinculo/Historico/Anexo`, `BpmTarefa`, `BpmInteracaoCard`, `BpmChecklistFollowUp`). Todas sem nenhum registro órfão real (`PRAGMA foreign_key_check` zerado em todas, contagem de linhas idêntica antes/depois). Backup: `database-backups/pre-change/painelalpha_turso_pre_change_fk-fase2-checklist-comissoes-bpm_2026-08-21T19-18-29-563Z.sql`.
**Atualização final (mesmo dia):** `Checklist.empresaId → operacional_clientes_old_fase35` também corrigido, a pedido do usuário — confirmado que o módulo Alpha CheckList "ainda não foi lançado oficialmente para uso", dado 100% de teste, sem necessidade de cautela extra de produto (só a cautela técnica normal de backup/preservação de dado, sempre mantida). 3 empresas nunca migradas restauradas: criado `Cliente` novo para `ADICEL - INDUSTRIA E COMERCIO LTDA` (id 293) e `ARCOS DOURADOS COMERCIO DE ALIMENTOS SA` (id 294); `ALPHA COMEX BRASIL LTDA` reaproveitou o `Cliente.id: 288` já criado na correção de Extratos (mesmo CNPJ). As 3 linhas migradas para `operacional_clientes` no formato novo (`clienteOperacionalId` preservado = login antigo, `clienteId` novo = empresa em `Cliente`), preservando os 3 `Checklist` reais vinculados sem tocar neles. `Checklist` recriada com FK correta para `operacional_clientes` (6 linhas preservadas, 0 violação). Validado via Prisma Client real (listagem com `include: cliente` + criação/remoção de Checklist de teste). Backup: `database-backups/pre-change/painelalpha_turso_pre_change_checklist-operacional-fk-fix_2026-08-21T19-49-03-778Z.sql`.

**RESULTADO FINAL: todas as 11 relações de FK física órfã identificadas nesta investigação foram corrigidas.** Varredura completa do banco confirma zero tabela ATIVA com FK presa em nome `_old_*`/`_fixfk` — o que resta apontando pra tabelas antigas são as próprias tabelas congeladas entre si (`clientes_old_fase36` e satélites, legado morto da Fase 4) e `PessoaEmpresaVinculo`/`logAlteracao` (0 linhas, sem model Prisma ativo), já documentados antes como preservados sem uso.
**Contexto:** Qualquer migration futura que renomeie uma tabela (`RENAME TO xxx_old_faseNN`) DEVE rodar `PRAGMA foreign_key_list` em TODAS as tabelas do banco (não só nas do módulo em foco) para achar e corrigir toda constraint apontando para o nome antigo — não confiar que "ninguém mais referencia essa tabela" sem essa varredura explícita. Ver também a regra já existente em `integration-points.md` ("Checkpoint obrigatório: mudança estrutural na tabela `clientes`"), que deveria ser generalizada para qualquer rename de tabela, não só `clientes`.
**Adicionado em:** 2026-08-21 (Bibble/Vault, sessão de bugfix do módulo Extratos Bancários — achado expandiu de "1 registro órfão" para "constraint física sistêmica em 9 relações")

---

### `prisma generate`/`npm run build` falha com EPERM em `query_engine-windows.dll.node`
**Sintoma:** `Error: EPERM: operation not permitted, rename '...\.prisma\client\query_engine-windows.dll.node.tmpNNNNN' -> '...\query_engine-windows.dll.node'`, tanto rodando `npx prisma generate` isolado quanto dentro de `npm run build` (que chama `prisma generate` como primeiro passo).
**Causa:** um processo `node.exe` anterior (dev server, build travado, ou processo residual de uma execução prévia que não finalizou limpo) ainda tem o `.dll.node` do Query Engine aberto — o Windows bloqueia o rename atômico que o Prisma usa para substituir o binário. Reincide especialmente depois de um `npm run build` anterior falhar/ser interrompido, porque os processos filhos (`next build`, workers do PostCSS) podem sobreviver ao comando pai.
**Fix:** listar processos `node.exe` (`tasklist //FI "IMAGENAME eq node.exe"` ou `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` para ver a `CommandLine` de cada um) e encerrá-los (`taskkill //F //PID <id>`) antes de tentar `prisma generate`/`npm run build` de novo. Confirmar com o usuário antes de matar processos que possam ser trabalho dele em outra janela — uma vez autorizado, o padrão pode ser reaplicado sem perguntar de novo na mesma sessão se o mesmo erro reincidir.
**Contexto:** Ambiente de desenvolvimento Windows local deste projeto. Builds muito longos (15-30min neste ambiente, projeto grande) aumentam a chance de o usuário/agente interromper e deixar processo residual. Se o erro reincidir mesmo após matar todos os `node.exe`, verificar se um antivírus/EDR está com lock no arquivo (menos provável, não observado até agora).
**Adicionado em:** 2026-08-10 (Forge, Fase A e Fase B do plano BPM "Revisão de Radar" — reincidiu 2x na mesma sessão)
**Atualização 2026-08-17:** confirmado que `scripts/roadmap-alpha.mjs worker` e `scripts/roadmap-production.mjs worker` têm AUTO-RESTART real (algum supervisor externo os reinicia em poucos segundos após `taskkill`, com PID novo) — matar 1x não basta, eles voltam e tornam a travar o lock antes do próximo `prisma generate` terminar. Fix que funcionou: matar TODOS os `node.exe` do projeto (incluindo esses 2 workers, mais qualquer `vitest`/`eslint` de outra sessão/processo rodando em paralelo) e rodar `prisma generate` IMEDIATAMENTE em seguida, no mesmo comando encadeado (`taskkill ... ; npx prisma generate`) — a corrida contra o supervisor precisa vencer antes dele reiniciar os workers. Sempre confirmar com o usuário antes de matar esses workers (podem ser processamento real de fila em andamento) — uma vez autorizado, pode reaplicar no restante da sessão.

---

### `next dev`/Turbopack não resolve folha CSS criada depois que o servidor iniciou
**Sintoma:** `globals.css` falha com `CssSyntaxError: Can't resolve './arquivo.css'`, embora o arquivo exista no caminho informado e `npx next build` compile com sucesso.
**Causa:** o grafo de dependências do processo `next dev` foi criado antes da nova folha CSS existir e pode continuar tratando o arquivo como ausente mesmo após HMR. O problema foi observado no Next.js 16.1.6 com Turbopack.
**Fix:** manter folhas globais geradas junto de `src/app/globals.css`, usar import local (`@import "./arquivo.css"`) e reiniciar o processo `next dev` depois da primeira geração do arquivo. Antes de encerrar processos, filtrar pelo caminho absoluto do workspace e pelos comandos `next dev`/`start-server.js`, preservando outros processos Node.
**Contexto:** arquivos CSS gerados por scripts enquanto o servidor de desenvolvimento já está ativo. Se o build de produção também falhar, tratar como caminho realmente inválido em vez de cache do dev server.
**Adicionado em:** 2026-08-10 (Forge, correção das fontes locais do Alpha Motion)

---

### ESLint `react-hooks/static-components` — "Cannot create components during render"
**Sintoma:** `npm run lint` (ou Forge) reporta `Error: Cannot create components during render` apontando para uma `function NomeQualquer(...)` declarada DENTRO do corpo de outro componente/função de render (padrão comum ao tentar variar entre `<motion.div>` e `<div>` condicionalmente, ou qualquer "wrapper condicional" ad-hoc).
**Causa:** Declarar um componente (função que retorna JSX, mesmo pequena/local) dentro do corpo de outro componente cria uma IDENTIDADE NOVA a cada render — React perde o estado interno dele e o React Compiler deste projeto bloqueia isso como erro, não warning.
**Fix:** Nunca declarar `function Wrapper(...)`/`function ItemWrapper(...)` etc. dentro de outro componente. Alternativas corretas: (a) declarar o componente FORA, no escopo do módulo; (b) se a variação é só "motion.div vs div" condicional, resolver inline com um ternário JSX direto (`condicao ? <motion.div ...>{filhos}</motion.div> : <div ...>{filhos}</div>`) em vez de extrair um componente. Exemplo real corrigido (`ComponenteNoCanvas.tsx`, Fase 03 do Alpha Motion): trocado `function Wrapper({children,style}){...}` interno por um ternário direto no `return`, com uma função auxiliar `renderFilhos()` que retorna um array de JSX (não um componente) para evitar duplicar a lista de filhos entre os dois ramos.
**Contexto:** Qualquer código que precise alternar entre duas variantes de wrapper (com/sem animação, com/sem determinado estilo) baseado em uma condição calculada em runtime — armadilha fácil de cair ao tentar "organizar" o JSX em uma função auxiliar dentro do componente.
**Adicionado em:** 2026-08-06 (Nova, sessão Alpha Motion — Fase 03, fechamento da dívida técnica de stagger em `ComponenteNoCanvas.tsx`)

---

### Teste `pptx-parser.test.ts` — "custGeom curvo + blipFill" falha (PRÉ-EXISTENTE, não catalogado até agora)
**Sintoma:** `tests/apresentacoes/pptx-parser.test.ts` → `custGeom curvo + blipFill: recorta a imagem original pelo path real (clipPath), virando SVG novo` falha com `AssertionError: expected 'image/png' to be 'image/svg+xml'` — o resultado mapeado da forma "Foto Recortada" (shapeId 5, `<p:sp>` com `custGeom` curvo + `blipFill`) volta como imagem crua (PNG) em vez do SVG recortado esperado.
**Causa:** ainda não investigada a fundo — CONFIRMADO que é pré-existente no `HEAD` do repositório (reproduzido isoladamente via `git stash` de todas as mudanças da sessão de 2026-08-17 que tocou `xml-utils.ts`/`parser.ts`/`mapear.ts`/`tipos.ts`; a falha persiste idêntica sem nenhuma dessas mudanças aplicadas). Não é efeito colateral de `trimValues: false` nem da lógica de `retanguloHerdado`/`objectFit` adicionada nessa sessão — ambas as mudanças ficam em branches de código que este teste específico não atravessa (`processarFormaImagemDeShape`/branch `forma.recorte` em `mapear.ts`, nenhum dos dois tocados).
**Fix:** NENHUM aplicado ainda — fora do escopo da sessão que descobriu (bugs priorizados eram resize sobreposto + texto colado + imagem espichada no import PPTX, não este). Precisa de investigação dedicada: hipótese a checar primeiro é se `geometria.ehRetangulo`/`geometria.pathSvg` (`extrairGeometriaCustGeom` em `geometria.ts`, chamado com `xmlShapeCru` fatiado por `xmlDoNo`/`ordem-xml.ts`) está retornando um valor que faz o parser cair no branch de fallback (linha ~400 de `parser.ts`, sem recorte) em vez do branch de recorte (linha ~389).
**Contexto:** suite completa (`tests/apresentacoes/`) tem 325 testes; este é o único que falha (324 passam). Rodar `npx vitest run tests/apresentacoes/pptx-parser.test.ts -t "custGeom curvo"` para reproduzir isolado.
**Adicionado em:** 2026-08-17 (Forge, sessão de correção de bugs do Alpha Motion — resize sobreposto/texto colado PPTX/imagem espichada PPTX)

---

## Template de entrada

```
### [Erro resumido]
**Sintoma:** [o que aparece no terminal/browser]
**Causa:** [por que acontece]
**Fix:** [como resolver]
**Contexto:** [quando esse erro ocorre]
**Adicionado em:** [data]
```

---

### Vercel Blob `get()` com `access: "public"` retorna 400 Bad Request
**Sintoma:** `Error: Vercel Blob: Failed to fetch blob: 400 Bad Request` ao chamar `get(url, { access: "public", token, ... })` do SDK `@vercel/blob`, mesmo com a URL e o token corretos.
**Causa:** `get()` do SDK é pensado para blobs PRIVADOS (autenticação via token contra a API do Vercel Blob). Para blobs `access: "public"`, a própria doc do SDK diz que o blob é "acessível via sua URL" — chamar `get()` com `access: "public"` não é o fluxo suportado corretamente e retorna 400. `useCache` também só é efetivo para blobs privados (é apenas ignorado para públicos, não é a causa do 400).
**Fix:** Para blob PÚBLICO, não usar `get()` do SDK — fazer um `fetch()` HTTP direto na própria `arquivoUrl`/URL armazenada (já é uma URL pública completa gerada pelo `put()`), e repassar `response.body` como stream. Exemplo real (`src/app/api/metas/justificativas/[id]/route.ts`):
```typescript
const respostaBlob = await fetch(justificativa.arquivoUrl);
if (!respostaBlob.ok || !respostaBlob.body) return new Response("Arquivo não encontrado", { status: 404 });
return new Response(respostaBlob.body, {
  status: 200,
  headers: {
    "Content-Type": respostaBlob.headers.get("content-type") ?? "application/pdf",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `inline; filename="..."`,
    "X-Content-Type-Options": "nosniff",
  },
});
```
Manter `auth()`/checagem de permissão ANTES de buscar o registro no banco — o `fetch()` na URL pública não exige token, mas a rota do painel continua sendo o único caminho autenticado/oficial.
**Contexto:** Qualquer Blob Store do projeto configurado como público na Vercel (fora do controle do código — decisão de infraestrutura). Se um Blob Store for criado/reconfigurado como público no futuro, usar `fetch()` direto, nunca `get()` do SDK com `access: "public"`.
**Adicionado em:** 2026-08-04 (Echo, feature Justificativa de Meta — 2º bug real reportado pelo usuário em produção na mesma sessão, após o 1º fix de `private`→`public` no `put()`/upload ter corrigido o envio mas quebrado a leitura)

---

### Notificação de chamado: som toca mas o toast não aparece na tela
**Sintoma:** Usuário ouve o som de notificação (`/sounds/notification.mp3`) mas não vê nenhum toast na tela. Comportamento intermitente — às vezes aparece, às vezes não, sem padrão óbvio.
**Causa (2 partes):** (1) [NotificationToast.tsx](../../src/components/chamados/NotificationToast.tsx) não tinha fila — `useEffect` sempre pegava `notificacoes[0]` e chamava `setVisivel()` direto. Se um segundo evento chegasse antes dos 6s do primeiro, o segundo **sobrescrevia** o primeiro instantaneamente, sem o usuário nunca ver o toast do primeiro (o som dele já tinha tocado no hook `useAdminChamadosNotifications.ts`, então "ouve o som, não vê nada" é exatamente esse cenário). (2) Causa secundária, estrutural e não corrigida (fora de escopo desta correção): `pusher-js` não faz replay de eventos emitidos enquanto o socket estava desconectado (aba em background, rede instável) — nenhum hook de notificação do projeto (chamados, holerite, checklist) trata isso.
**Fix:** Reescrito `NotificationToast.tsx` com fila real (FIFO): cada notificação nova entra numa fila (`filaRef`) deduplicada por id (`enfileiradosRef`, com limite de 50 para não vazar memória em sessões longas); `mostrarProximo()` exibe um item por vez e só avança para o próximo depois do timer de 6s (ou de dispensa manual via clique/X). Nenhum evento é mais descartado silenciosamente. Detalhe de implementação: a função recursiva usa o padrão "latest ref" (`mostrarProximoRef`, atualizado dentro de um `useEffect` sem deps) porque o React Compiler/linter deste projeto bloqueia mutação de ref durante o corpo de render (`Cannot access refs during render` / `react-hooks/refs`) e também bloqueia `useCallback` auto-referenciado com deps vazias.
**Contexto:** Qualquer componente de toast único (`visivel: T | null`) alimentado por uma lista/store que pode receber múltiplos itens em rajada precisa de fila, nunca de "pega o mais recente e substitui" — o mesmo padrão de `useState<T|null>` existe potencialmente em outros toasts do projeto (holerite, checklist) e deveria ser auditado se o mesmo sintoma for relatado lá. A causa secundária (perda de evento por desconexão do Pusher) não foi corrigida — se o sintoma persistir mesmo com a fila (ex.: usuário nunca ouve o som nem vê nada), a próxima hipótese é reconexão do Pusher, não a fila.
**Adicionado em:** 2026-07-31 (Echo, sessão de bugfix notificações de chamados)

---

### `tests/google-calendar/cli.test.ts` — timeout intermitente só quando roda com a suíte inteira
**Sintoma:** `it("não devolve argumento bruto nos erros das CLIs")` estoura `Test timed out in 5000ms` quando `npx vitest run tests/google-calendar/` roda a pasta inteira (27 arquivos). Rodando o arquivo isolado (`npx vitest run tests/google-calendar/cli.test.ts`), passa normal (2/2) em ~5s.
**Causa:** não investigada a fundo — sintoma de contenção de recursos (provavelmente spawn de processo filho da CLI disputando CPU/IO com os outros 26 arquivos rodando em paralelo no mesmo worker pool do Vitest), não um bug de lógica. Confirmado via `git stash` que o timeout já existia ANTES de qualquer mudança relacionada (reproduz igual no estado limpo do `main`).
**Fix:** nenhum aplicado ainda — não bloqueia PRs; se precisar rodar a suíte com confiança, rodar `cli.test.ts` isolado ou aumentar o timeout desse `it` especificamente (`it("...", async () => {...}, 15000)`). Investigar `poolOptions`/paralelismo do Vitest se o flake incomodar em CI.
**Contexto:** Só reproduz com a pasta `tests/google-calendar/` inteira, não isolado. Observado pela 1ª vez durante a correção do bug de feriado 1 dia antes (`cache-eventos.ts`), mas não relacionado a ele.
**Adicionado em:** 2026-08-17 (Forge, verificação da correção de feriados na Agenda Alpha)

---

### Bibble confirma "chamado aberto" via chat mesmo quando a abertura falhou (ou nunca foi tentada)
**Sintoma:** Usuário pede para o Bibble abrir um chamado de suporte pelo chat; o Bibble responde confirmando a abertura com um número de chamado (ex.: `#PAA-2026/789` — formato que não existe no sistema; o ID real é sequencial simples `#1`, `#2`...), mas o chamado não existe de verdade em `/PainelAlpha/Chamados` — ninguém no admin recebe a notificação. Persiste mesmo perguntando várias vezes: o Bibble reafirma a confirmação inventada.
**Causa raiz (2 camadas):**
1. A tool `abrir_chamado` ([tool-executor.ts](../../src/lib/bibble/tool-executor.ts)) retornava uma string livre, e o `system-prompt.ts` não tinha regra obrigando o LLM a basear a resposta nesse texto literal. `db.chamados.create` também não tinha try/catch.
2. **Mais grave:** mesmo depois de corrigir (1) só via prompt, o problema persistiu — porque um modelo local (`qwen3:14b`) pode simplesmente **nunca emitir a tool call** e alucinar a confirmação inteira em texto livre, número de chamado inventado incluído. Regra de prompt não tem como impedir isso: ela só rege como o modelo interpreta o retorno de uma tool que ele decidiu chamar. Se ele não chama, não há retorno nenhum para obedecer.
**Fix:**
1. Try/catch no case `abrir_chamado` + retorno prefixado com `SUCESSO_ABRIR_CHAMADO:`/`FALHA_ABRIR_CHAMADO:` + regra no `system-prompt.ts` (mesmo padrão da regra de integridade do calendário).
2. **Guarda estrutural em código** — [chamado-guard.ts](../../src/lib/bibble/chamado-guard.ts), plugado no `route.ts` (`runStream`): quando `mensagemSolicitaAbrirChamado(message)` detecta que o usuário pediu abertura nesta mensagem, a resposta final deixa de ser streamada token-a-token e é **buferizada inteira**; se `respostaAlegaChamadoAberto()` detectar alegação de sucesso sem que `abrir_chamado` tenha retornado `SUCESSO_ABRIR_CHAMADO` em algum tool call deste turno, a resposta é substituída por uma mensagem honesta antes de qualquer texto chegar à tela. Réplica exata do padrão já usado para "falso cancelamento de evento" (`calendar-cancellation.ts` → `protegerRespostaDeFalsoCancelamento`).
**Contexto:** Prompt engineering sozinho NUNCA é suficiente para impedir uma IA de confirmar uma ação que ela nunca executou — o modelo pode simplesmente pular a tool call. Qualquer tool de mutação (chamados, calendário, e futuras: tarefas, reservas de sala etc.) exposta ao Bibble precisa de proteção em DUAS camadas: (a) prompt explicando como interpretar o retorno da tool, e (b) um guard em código que detecta a intenção do usuário na mensagem + verifica se a tool teve sucesso real no turno, e substitui a resposta se houver alegação falsa. Só (a) sozinho é insuficiente e não deve ser considerado fix completo.
**Adicionado em:** 2026-07-31 (Echo, sessão de bugfix Bibble/Chamados — 2ª iteração após fix insuficiente)

---

### ESLint `react-hooks/set-state-in-effect` — `setState` redundante dentro de `useEffect` que só replica o valor inicial do `useState`
**Sintoma:** `npm run lint` reporta `Error: Calling setState synchronously within an effect can trigger cascading renders` numa chamada `setEstado(valorFixo)` dentro de um `useEffect`, SEM nenhuma `Promise`/Server Action envolvida (diferente do caso já catalogado logo abaixo, que é sobre `void`+disable comment).
**Causa:** Padrão "fallback síncrono" mal escrito: `useState(() => condicaoX)` já calcula o valor inicial correto, mas o `useEffect` reafirma esse mesmo valor com `setEstado(true)` num branch condicional — é sempre redundante (o valor já está certo desde a primeira render) e o lint bloqueia qualquer `setState` direto no corpo do efeito, mesmo quando "parece inofensivo".
**Fix:** Deletar a chamada redundante — se o `useState` inicial já cobre o caso, o `useEffect` só precisa dar `return` cedo nesse branch, sem tocar o estado. Caso real (`useScrollReveal`, `scroll-reveal.ts`, Fase 08 do Alpha Motion): `useState(() => typeof IntersectionObserver === "undefined")` já deixava `revelado=true` quando não há suporte; o `if (typeof IntersectionObserver === "undefined") { setRevelado(true); return; }` dentro do efeito virou só `if (typeof IntersectionObserver === "undefined") return;`.
**Contexto:** Qualquer hook que calcule um fallback síncrono no inicializador do `useState` E também tente "garantir" o mesmo valor dentro do `useEffect` — o segundo é sempre desnecessário e vai ser bloqueado pelo lint. Ao revisar, perguntar: "esse `setState` no efeito está fazendo algo que o valor inicial do `useState` já não fez?" — se a resposta for não, remover.
**Adicionado em:** 2026-08-06 (Forge, sessão Alpha Motion — Fase 08, Scroll Reveal)

---

### ESLint `react-hooks/set-state-in-effect` — chamar Server Action dentro de `useEffect`
**Sintoma:** `npm run lint` reporta `error: Calling setState synchronously within an effect can trigger cascading renders` apontando para uma linha tipo `carregarDados();` ou `carregar();` dentro de um `useEffect(() => { ... }, [deps])`.
**Causa:** Regra do React Compiler (via `eslint-config-next/core-web-vitals`) detecta chamar diretamente uma função que internamente faz `setState` (mesmo que seja uma função `async` que popula estado a partir de uma Server Action) dentro do corpo de um efeito — é o padrão universal do projeto para "buscar dados ao montar" (ex: `ApresentacoesDashboard.tsx`, todo o módulo Alpha Blueprint), mas o linter trata como erro bloqueante, não warning.
**Fix:** Prefixar a chamada com `void` E manter um `// eslint-disable-next-line react-hooks/set-state-in-effect` na linha imediatamente anterior — os DOIS juntos, um sozinho não resolve (`void` sozinho não silencia o lint; o disable sozinho sem `void` deixa a Promise solta sem indicar intenção). Exemplo:
```tsx
useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void carregarDados();
}, [carregarDados]);
```
Para casos de leitura síncrona de layout do DOM (ex: `getBoundingClientRect()` disparando `setState` direto, sem `async`), usar só o disable comment com justificativa inline (`// eslint-disable-next-line react-hooks/set-state-in-effect -- motivo`), já que não há `Promise` para `void`.
**Contexto:** Qualquer componente novo que precise popular estado local a partir de uma Server Action ao montar (praticamente todo Dashboard/painel do projeto usa esse padrão). O projeto tem ~178 ocorrências pré-existentes desse erro em código legado (não corrigidas retroativamente) — mas todo código NOVO deve aplicar o fix, pois é um `error` bloqueante do lint, não um warning tolerável.
**Adicionado em:** 2026-07-27 (Forge, sessão Alpha Blueprint)

---

### `@xyflow/react` — `useReactFlow().updateNodeData()` não aciona autosave (edição parece funcionar mas nunca persiste)
**Sintoma:** Nenhum erro no console/build. O usuário edita o texto de um node customizado do React Flow, a UI atualiza normalmente, mas ao recarregar a página a edição sumiu — nada foi persistido, mesmo com a lógica de autosave/debounce implementada e aparentemente correta.
**Causa:** `updateNodeData(id, patch)` (do hook `useReactFlow()`) escreve diretamente no store interno do provider do React Flow, **sem passar pelo callback `onNodesChange`** do componente controlador. Quando o autosave está implementado dentro de `onNodesChange`/`handleNodesChange` (padrão natural: "salvar sempre que os nodes mudarem"), qualquer edição feita via `updateNodeData` fica invisível para esse mecanismo — o React re-renderiza (o dado mudou no store), mas o `useNodesState` do componente pai nunca dispara seu próprio `onChange`.
**Fix:** Nunca usar `useReactFlow().updateNodeData()` para editar `data` de um node quando o autosave depende de `onNodesChange`. Em vez disso, criar um React Context que carregue um callback do componente controlador (`handleDataChange(nodeId, patch)` que chama `setNodes` real), e prover esse contexto ao redor do `<ReactFlow>`. Cada node customizado consome o contexto (`useContext`) em vez de `useReactFlow()`. Implementado em `src/components/AlphaBlueprint/canvas/CanvasNodes.tsx` (`CanvasDataChangeContext`) — usar como referência para qualquer canvas futuro no projeto que precise de nodes com edição inline.
**Contexto:** Qualquer implementação de canvas com `@xyflow/react` neste projeto que tenha nodes customizados editáveis (texto, propriedades) E autosave baseado em `onNodesChange`. Também vale o mesmo cuidado para `updateNode`/`updateEdge` do mesmo hook — todos sofrem do mesmo problema de não disparar os callbacks de change.
**Adicionado em:** 2026-07-27 (Lens, sessão de melhorias do Canvas do Alpha Blueprint)

---

### `@xyflow/react` — node customizado sem `<Handle>` não permite criar conectores (regressão real reportada pelo usuário)
**Sintoma:** Ao trocar nodes de `type: "default"` (nativo do React Flow) para um componente React customizado (`nodeTypes` prop), o usuário não consegue mais arrastar das bordas do node para criar uma conexão/edge — os pontos de conexão simplesmente somem, mesmo com `onConnect` implementado corretamente no `<ReactFlow>`.
**Causa:** O node `type: "default"` nativo do xyflow já vem com 2 `<Handle>` embutidos (um `target` em cima, um `source` embaixo). Ao substituir por um componente customizado, esses handles NÃO são herdados automaticamente — é responsabilidade do componente customizado renderizar seus próprios `<Handle>` explicitamente. Esquecer isso é fácil porque nada quebra em tempo de build/типecheck: o node simplesmente renderiza sem pontos de conexão, sem erro nenhum.
**Fix:** Todo node customizado que deve ser conectável precisa importar `Handle`/`Position` de `@xyflow/react` e renderizar ao menos um `type="target"` e um `type="source"`. Para permitir conectar em qualquer direção (não só topo→baixo), usar 4 pares (top/right/bottom/left, cada um com `source` E `target`, `id` únicos). Implementado como componente compartilhado `HandlesQuatroLados` em `src/components/AlphaBlueprint/canvas/CanvasNodes.tsx`, reaproveitado pelos 4 tipos de node — copiar esse padrão para qualquer node customizado novo do xyflow no projeto. Detalhe de polish: os handles ficam com `opacity-0 group-hover:opacity-100` (visíveis só no hover ou quando o node está selecionado) para não poluir visualmente nodes pequenos — requer a classe `group` no wrapper do node.
**Contexto:** Qualquer vez que um node do xyflow migrar de `type: "default"`/tipos nativos para um componente customizado neste projeto. Testar explicitamente "consigo arrastar uma conexão das bordas?" depois de qualquer mudança em `nodeTypes` — essa regressão não aparece em nenhuma verificação automatizada (tsc/lint/build), só em teste manual real.
**Adicionado em:** 2026-07-27 (sessão de melhorias do Canvas do Alpha Blueprint — reportado pelo usuário em teste manual)

---

## Erros Catalogados

### ESLint `react-hooks/refs` — "Cannot access/update ref during render" ao sincronizar um ref com o valor mais novo de um state
**Sintoma:** `npm run lint` reporta `Error: Cannot update ref during render` apontando pra uma linha tipo `algumRef.current = valor;` escrita direto no corpo do componente (fora de `useEffect`/handler).
**Causa:** Regra do React Compiler (mesma família de `react-hooks/set-state-in-effect`, já catalogada acima) bloqueia mutar `ref.current` durante o render — é o padrão "latest ref" (guardar o valor mais recente de um state/prop num ref pra ler dentro de um closure de callback/loop que não pode depender de re-render, ex: `requestAnimationFrame`, listener de `wheel`/`resize`, timeout) escrito da forma antiga (mutação direta no corpo da função). Já apareceu 2x nesta sessão: `animated-shader-background.tsx` (refs de velocidade/cor lidas dentro do loop de `animate()`) e `apresentacoes-player/PlayerStandalone.tsx` (`indiceRef` lido dentro do handler de `wheel`/timeout de cooldown).
**Fix:** Mover a atribuição pra dentro de um `useEffect` com o valor como dependência: `useEffect(() => { algumRef.current = valor; }, [valor]);`. Nunca `algumRef.current = valor;` solto no corpo do componente.
**Contexto:** Qualquer ref usado como "leitura mais recente dentro de um callback assíncrono/imperativo" (RAF, wheel, resize, setTimeout, WebSocket handler, etc.) neste projeto — o padrão antigo (mutação direta) sempre vai ser pego pelo lint. Verificar isso ANTES de escrever esse padrão, não depois.
**Adicionado em:** 2026-08-06 (sessão Bibble, export HTML do Presentation Studio)

### Alpha Presentation Studio — Container Alpha não cobre 100% da tela (margem deixa o fundo vazando na borda)
**Sintoma:** Usuário reporta "o container de entrada ainda continua bugado na hora de rodar a apresentação" mesmo após corrigir o "pulo" de layout do fundo (ver entrada seguinte) — especificamente: o container não cobre a tela inteira, sobra uma borda visível nos 4 lados.
**Causa:** `container-intro.ts` documenta explicitamente "*O Container Alpha é uma capa: na apresentação sempre ocupa todo o palco 16:9*" — mas a implementação CONTRADIZIA esse comentário: `ComponenteNoSlide` (`SlideApresentacaoLayer.tsx`) e `TransicaoContainerAlphaLayer.tsx` aplicavam uma `margem` de 18-72px (`Math.min(72, Math.max(18, menorDimensao * 0.05))`) ao redor do container, ignorando qualquer tamanho configurado no componente. Antes da categoria Backgrounds existir, essa borda mostrava só a cor de fundo lisa do slide (quase imperceptível) — com um fundo animado (estrelas/planetas/etc.) atrás, a borda de 18-72px passa a mostrar claramente o fundo vazando ao redor do container fechado, e essa MESMA margem também undoava (sobrescrevia) o fix de "tamanho padrão de slide" aplicado no editor (`registry-3d.ts`/`ApresentacaoEditor.tsx`) — o componente podia estar `w/h` = canvas inteiro no editor, mas a apresentação recalculava `x/y/w/h` do zero com a margem de qualquer forma.
**Fix:** `margem = 0` nos dois arquivos (mantendo a fórmula/conversão de coordenadas parametrizada por `margem`, só zerando o valor, para não perder a estrutura caso um dia se queira reintroduzir uma margem configurável). `FRAME_FILL_CAPA = 0.985` (em `ContainerCargaCameraRig.tsx`) já garante ~1.5% de respiro interno pro modelo 3D não ficar cortado rente à borda — não precisa de margem externa adicional.
**Contexto:** Qualquer elemento que se autodeclare "capa de tela cheia" (full-bleed) precisa realmente ocupar 100% do palco quando há um fundo animado por baixo — margens "discretas" que pareciam inofensivas contra uma cor sólida se tornam bugs visíveis óbvios contra um fundo com detalhe visual. Ao adicionar qualquer feature nova que pressupõe fundo cheio atrás (como a categoria Backgrounds), reconferir todo componente "capa"/overlay existente que antes convivia só com fundos sólidos.
**Adicionado em:** 2026-08-05 (sessão Bibble, mesma sessão da categoria Backgrounds)

### Alpha Presentation Studio — fundo animado "pula" de layout durante a animação de entrada Container Alpha
**Sintoma:** Usuário reporta "a animação de entrada fica bugada quando se tem um background" — ao usar a animação de entrada "Container Alpha" num slide que também tem um fundo animado da categoria Backgrounds (estrelas/blips/âncoras), o campo de partículas visivelmente "pula"/salta para posições diferentes no instante em que a animação da porta termina e revela o slide real.
**Causa:** `TransicaoContainerAlphaLayer.tsx` (e também `ComponenteNoSlide` em `SlideApresentacaoLayer.tsx`, usado em toda transição normal entre slides com Container Alpha) monta uma PRÉVIA do slide de destino dentro da porta que abre (`SlidePortalPreview`), ao mesmo tempo que o slide real já está montado por baixo — são 2 instâncias React **independentes** do MESMO componente de fundo. `RadarFundo.tsx`/`BlueprintFundo.tsx`/`EstelarFundo.tsx` geravam as posições (blips/âncoras/estrelas) com `Math.random()` puro dentro de um `useEffect` (padrão correto para evitar mismatch de hidratação SSR, herdado dos módulos originais) — mas sem seed fixa, cada instância monta com um layout aleatório DIFERENTE. Quando a prévia dá lugar ao slide real, o layout "pula" visivelmente. `CosmosIAlphaFundo.tsx` já usava seeds fixas (`createSeededRandom` com seeds numéricas hardcoded por camada) e não sofria do bug — só os 3 tipos "estelar/radar/blueprint" tinham o problema.
**Fix:** `hashStringParaSeed(componente.id)` (novo helper em `fundos-utils.ts`) converte o id do componente (idêntico nas 2 instâncias montadas, já que é o MESMO componente do slide) num número, usado como seed do gerador congruente linear já existente (`criarGeradorSeed`, extraído do padrão já usado em `CosmosIAlphaFundo.tsx`). Layout determinístico por `componente.id` = as 2 instâncias sempre geram o MESMO layout, sem pulo visual.
**Contexto:** Qualquer componente de fundo/decoração futuro que gere posições aleatórias via `Math.random()` dentro de `useEffect` (padrão necessário para evitar hydration mismatch) precisa de seed determinística por `componente.id` se existir QUALQUER cenário onde o mesmo componente pode ser renderizado em 2 instâncias simultâneas — o que é o caso de qualquer slide com `containerCarga`/Container Alpha (preview do próximo slide sempre pré-montado atrás da porta fechada, não só durante a transição ativa). `Math.random()` puro só é seguro quando existe certeza de que o componente nunca é duplicado na árvore.
**Adicionado em:** 2026-08-05 (sessão Bibble, categoria Backgrounds + Container Alpha)

### "use server" file can only export async functions, found object
**Sintoma:** `npm run build` falha com `Failed to collect page data for /rota` → causa raiz: `A "use server" file can only export async functions, found object.` Também aparece como `Server Actions must be async functions.` quando o export problemático é uma função SÍNCRONA (não só constante/objeto) — mesma causa raiz, mensagem do Turbopack varia conforme o tipo do export.
**Causa:** Um arquivo com `"use server"` no topo (Server Actions) exportou algo que não é `async function` — constante não-função (objeto de configuração, array, número) OU uma função helper síncrona (ex: um helper de autorização `function podeX(role) {...}` tornado `export` para reuso). Next.js proíbe qualquer export que não seja `async function` nesses arquivos, sem exceção.
**Fix:** Mover o export problemático para um arquivo separado SEM `"use server"` (ex: `lib/tributos.ts`, `lib/metas-permissoes.ts`) e importar dos dois lados (do arquivo de actions e de quem mais precisar do valor/função). Caso real: `podeGerenciarMetas(role)` em `src/actions/Metas.ts` foi tornada `export function` (síncrona) para reuso em `src/actions/JustificativaMeta.ts` — quebrou o build com exatamente este erro. Corrigido movendo para `src/lib/metas-permissoes.ts` e trocando os 3 imports (`Metas.ts` interno + `JustificativaMeta.ts` + as 2 rotas de API que precisavam do helper).
**Contexto:** Acontece ao tentar reexportar constantes (percentuais, configs, enums) OU helpers síncronos de um arquivo de Server Actions para reuso no frontend/outras actions/rotas — parece funcionar em `tsc`/dev, só quebra no `next build`. Regra geral: qualquer coisa exportada de um arquivo `"use server"` deve ser `async function`, sem exceção — helpers síncronos de autorização/formatação/validação devem morar em `src/lib/`, nunca em `src/actions/`.
**Adicionado em:** 2026-07-01 (constante/objeto) · **Atualizado em:** 2026-08-04 (Echo, feature Justificativa de Meta — 2ª manifestação real, função síncrona)

### InfoSimples CPF — data_nascimento formato errado
**Sintoma:** Consulta CPF retorna erro "CPF não encontrado" mesmo com dados corretos.
**Causa:** `<input type="date">` envia `YYYY-MM-DD`; InfoSimples `receita-federal/cpf` exige `DD/MM/YYYY`.
**Fix:** Converter no servidor antes de chamar a API: `[d,m,y] = iso.split('-')` → `${d}/${m}/${y}` (implementado em `paraFormatoInfoSimples()` em `/api/ConsultaCpf/route.ts`).
**Contexto:** Qualquer campo de data HTML que seja enviado para a InfoSimples.
**Adicionado em:** 2026-06-17

### pdf-parse v2 — `.default` is not a function
**Sintoma:** `TypeError: pdfParse is not a function` ao ler PDF; erro silenciado em catch → IA não lê o PDF.
**Causa:** pdf-parse v2 (`^2.x`) mudou a API. v1 exportava função; v2 exporta `{ PDFParse }` (classe). `(await import("pdf-parse")).default` é `undefined`.
**Fix:** `const { PDFParse } = await import("pdf-parse"); const p = new PDFParse({ data: buffer, verbosity: 0 }); const r = await p.getText(); await p.destroy();` — texto em `r.text`. (Centralizado em `src/lib/bibble/tika.ts` como fallback.)
**Contexto:** Qualquer uso de pdf-parse no projeto.
**Adicionado em:** 2026-06-19

### fetch body com Buffer/Uint8Array — TS2769 BodyInit
**Sintoma:** `TS2769: No overload matches this call. Type 'Buffer'/'Uint8Array' is not assignable to type 'BodyInit'`.
**Causa:** tsconfig com `target: ES2017` + lib `dom` não reconhece `Buffer`/`Uint8Array` como `BodyInit` no `fetch`.
**Fix:** passar `ArrayBuffer`: `body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer`.
**Contexto:** Enviar binário (PUT/POST) via fetch no server-side.
**Adicionado em:** 2026-06-19

### Onyx upload de imagem — 307 no /api/chat/file (agente não lê imagem)
**Sintoma:** Agente Onyx não "vê" a imagem enviada; responde alucinando link do Qwen (`chat.qwen.ai/s/d/.../user_id`). OCR/visão nunca dispara.
**Causa:** `POST /api/chat/file` foi descontinuado na versão atual do Onyx — responde **307** (redirect p/ rota GET). Upload falha silenciosamente → `file_descriptors` vazio → agente não recebe a imagem.
**Fix:** Usar o endpoint NOVO `POST /api/user/projects/file/upload` (multipart, campo `files`). Resposta tem `user_files[]` com `id` (=user_file_id), `file_id`, `chat_file_type`. No `file_descriptors` do send-chat-message, incluir **`user_file_id`** (= `user_files[].id`) — sem ele o Onyx rejeita com "Project files provided but no project_id specified". Implementado em `uploadChatFiles` (`src/lib/onyx/client.ts`).
**Contexto:** Qualquer envio de imagem do usuário para agentes Onyx.
**Adicionado em:** 2026-06-26

### Imagem do agente Onyx some ao recarregar a conversa
**Sintoma:** Imagens (geradas e enviadas) aparecem durante o chat mas somem ao atualizar a página.
**Causa (dupla):** (1) Imagem GERADA: o Onyx persiste no texto da mensagem como `![alt](file://{uuid})` — esquema `file://` não renderiza no browser, e `files[]` da mensagem fica vazio. (2) Imagem ENVIADA: vem em `files[]` na reidratação, MAS a bolha do USUÁRIO renderiza texto puro (não markdown), então embutir como markdown não funciona.
**Fix:** Na rota `/api/onyx/session/[id]`, reescrever `file://{uuid}` → `/api/onyx/file/{uuid}` no `content`. No `loadSession` (BibbleChatLayout): mensagem do usuário recebe imagens via `message.files` (AnexoPreview renderiza); mensagem do assistente recebe via markdown no content (ReactMarkdown renderiza).
**Contexto:** Reidratação de conversas com agente Onyx. Sessões antigas (pré-fix do upload 307) não têm a imagem enviada salva — irrecuperável.
**Adicionado em:** 2026-06-26

### Prisma update P2025 em rotas idempotentes (heartbeat)
**Sintoma:** `PrismaClientKnownRequestError P2025: No record was found for an update` em log recorrente.
**Causa:** `.update()` lança quando o `where` não acha registro. Ex.: sessão JWT válida com email de usuário já removido/renomeado.
**Fix:** usar `.updateMany()` (retorna `count: 0` sem lançar); tratar `count === 0` como caso não-erro (404 silencioso, sem console.error).
**Contexto:** Updates idempotentes onde "registro não existe" não deve ser erro de servidor.
**Adicionado em:** 2026-06-19

---

## Consulta CPF InfoSimples retorna code 606/607 (nunca traz dados)
**Sintoma:** `/api/ConsultaCpf` responde erro; log mostra `code: 606` ("campo obrigatório ausente") ou `code: 607` ("data de nascimento inválida"). No browser pode logar "404 Not Found" enganosamente.
**Causa:** dois detalhes da API InfoSimples (receita-federal/cpf): (1) o campo da data chama-se **`birthdate`**, NÃO `data_nascimento`; (2) o formato exigido é **AAAA-MM-DD** (ISO), NÃO DD/MM/AAAA. O `<input type="date">` já manda AAAA-MM-DD.
**Fix:** enviar `birthdate` no formato AAAA-MM-DD (não inverter). Testado: `2003-10-25`=code 200 ✓, `25/10/2003`=607 ✗. Bônus: rota retornava `status:404` em erro de consulta (browser logava como rota inexistente) → usar 422.
**Contexto:** Vale para PainelAlpha (`src/app/api/ConsultaCpf/route.ts`) e portal AlphaParceiros (`lib/consultaActions.ts`).
**Adicionado em:** 2026-06-23

---

## "db.<model> is undefined" / action falha com catch silencioso após adicionar model novo
**Sintoma:** action retorna erro genérico sem log; teste direto mostra `Cannot read properties of undefined (reading 'create')` em `db.<novoModel>`.
**Causa:** Prisma Client em execução está STALE — o dev server subiu com o client gerado ANTES do model novo existir no schema. O model existe no schema e nos tipos, mas o runtime client não.
**Fix:** `npx prisma generate` + **REINICIAR o dev server** (Turbopack não recarrega o client). No Windows o generate dá EPERM na DLL se o node estiver rodando — parar node antes. SEMPRE logar o erro real no catch (`console.error`), nunca catch vazio.
**Adicionado em:** 2026-06-23

**Addendum (2026-08-06, Forge):** o mesmo EPERM derruba `npm run build` inteiro (script roda `prisma generate && npm run build:player && next build` — falha no 1º comando, os outros nunca rodam) sempre que o `npm run dev` do usuário está de pé em paralelo. Cuidado ao ler o resultado: se o comando de build for encadeado com `| tail`, o exit code reportado é o do `tail` (quase sempre 0), NÃO o do build — mascarando a falha. Ler o conteúdo real do output, nunca confiar só no exit code de um pipe. Quando a mudança sendo validada NÃO tocou `prisma/schema.prisma`, não é preciso derrubar o dev server só pra validar: rodar `node scripts/build-apresentacoes-player.mjs` e `npx next build` direto (pulando `prisma generate`) valida tsc/lint-equivalente + bundling sem o conflito de lock.

**Addendum 2 (2026-08-06, mesma sessão):** o exit code de um comando em background pode ser mascarado de formas DIFERENTES a cada vez (visto 2x seguidas: 1ª vez foi `| tail` mascarando; 2ª vez foi o último comando de uma cadeia `;` ser um `grep` que retorna 1 por "não achei erro", reportado como "falha" mesmo o build tendo saído 0). Prática mais robusta pra validar build em background: gravar o exit code DENTRO do próprio arquivo de log, ex. `npx next build > log.txt 2>&1; echo "EXIT_CODE:$?" >> log.txt`, e depois ler o arquivo direto — nunca confiar no status ("completed"/"failed") do orquestrador de background sem ler o conteúdo real.

**Addendum 3 (2026-08-07, sessão Sistema de Notas):** o EPERM pode reaparecer NO MEIO de uma sessão longa mesmo depois de já ter sido resolvido uma vez — cada `npm run build`/`tsc`/`lint` pode inadvertidamente reiniciar processos node novos (ex: script `build:player`, workers de postcss do Turbopack) que voltam a travar a DLL. Fix seguro: `tasklist //FI "IMAGENAME eq node.exe"` (Bash) ou `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` (PowerShell, mostra `CommandLine` completa) para IDENTIFICAR qual PID é o quê ANTES de matar qualquer um — processos do Cursor/VSCode (`tsserver.js`, `typingsInstaller.js`, helpers do editor) NUNCA devem ser mortos, só os PIDs cuja `CommandLine` mostra `next dev`/`next build`/`npm run dev`/scripts do próprio projeto. `Stop-Process -Id <lista> -Force` seletivo, nunca `taskkill /F /IM node.exe` genérico (mataria o editor do usuário).

---

## Filtro de string PT-BR com acento nunca casa (includes retorna sempre false)
**Sintoma:** função que classifica por nome de serviço/status retorna `false` para tudo, mesmo com o termo presente. Ex.: `s.includes("revisao")` falha em "Revisão RADAR".
**Causa:** normalização com `.replace(/[^a-z0-9]/g, "")` REMOVE os caracteres acentuados junto com a pontuação — "revisão"→"reviso", "habilitação"→"habilitao". O termo de busca sem acento nunca casa.
**Fix:** remover acentos com `.normalize("NFD").replace(/[̀-ͯ]/g, "")` ANTES de qualquer filtro/lowercase. Nunca usar `[^a-z0-9]` para "limpar" string PT-BR sem antes tirar diacríticos.
**Bônus:** IDs de contrato/cliente são cuid (STRING tipo `cmpfxcy81...`), não Int — em UPDATE manual via SQL, sempre passar como arg parametrizado/aspas, nunca interpolar cru.
**Adicionado em:** 2026-06-23

---

## `prisma db push` / `migrate` não aplicam mudança de schema no Turso (só no SQLite local)
**Sintoma:** `npx prisma db push` roda e reporta sucesso ("Your database is now in sync"), mas as colunas/tabelas novas não aparecem no banco de produção real — app continua funcionando com o schema antigo em runtime, ou pior, quebra achando que a coluna existe.
**Causa:** `datasource db` do `schema.prisma` aponta pro `DATABASE_URL` (`file:./prisma/dev.db`, SQLite local). O app em runtime, porém, conecta ao Turso remoto via um adapter separado (`PrismaLibSql`, lendo `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` em `src/lib/prisma.ts`). O Prisma CLI só enxerga o `datasource` declarado no schema — nunca o adapter usado em runtime. Os dois caminhos de conexão são desacoplados.
**Fix:** Depois de `prisma generate` (regenerar tipos/client), aplicar a mudança direto no Turso via script pontual em Node com `@libsql/client/web`, lendo as mesmas envs (`TURSO_DATABASE_URL` com `libsql://` trocado por `https://`, `TURSO_AUTH_TOKEN`), rodando `ALTER TABLE ... ADD COLUMN ...` manual. Confirmar com `PRAGMA table_info(tabela)` antes/depois. Script fica na raiz do projeto (resolve `@libsql/client` do `node_modules` local), roda uma vez, e é apagado — nunca commitado. Ver decisão completa em `decisions.md` (2026-07-06).
**Contexto:** Qualquer sessão que altere `prisma/schema.prisma` neste projeto. Vault deve ser acionado antes do `ALTER TABLE` em produção, independente do mecanismo.

---

## "Application error: Rendered more hooks than during the previous render" ao acessar /PainelAlpha/Parceiros direto
**Sintoma:** Acessar `http://localhost:3000/PainelAlpha/Parceiros` diretamente como navegação de topo (URL colada na barra, refresh direto) no dev server quebra com "Application error" — overlay do Next mostra "Runtime Error: Rendered more hooks than during the previous render", stack trace aponta para dentro do próprio `Router` do Next.js (`app-router.tsx`), não para código da aplicação.
**Causa:** Não identificada (bug de hidratação do App Router do Next.js 16 em dev mode, aparentemente específico dessa rota quando acessada fora do fluxo normal via iframe do painel — o sistema renderiza módulos como `/PainelAlpha/[Modulo]` dentro de um `<iframe>` a partir de `/PainelAlpha`, e a navegação direta parece expor um caminho de render diferente). Confirmado via `git stash` que o erro é PRÉ-EXISTENTE — já ocorria antes de qualquer mudança da sessão de 2026-07-06 (convite de parceiro, onboarding). NÃO afeta produção: `npm run build` compila limpo, o erro só aparece em dev.
**Fix:** Nenhum aplicado ainda — fora do escopo das sessões que o encontraram. Para testar mudanças em `/PainelAlpha/Parceiros` em dev, prefira navegar via o fluxo real do painel (clicar no módulo a partir de `/PainelAlpha`) em vez de colar a URL direto/dar F5 nela. Se o erro persistir mesmo via navegação normal, investigar `GlobalSidebar.tsx` (apareceu em alguns stack traces relacionados) e o mecanismo de iframe em `PainelLayoutClient.tsx`.
**Contexto:** Só reproduzido em dev server (Turbopack). Build de produção não afetado.
**Adicionado em:** 2026-07-06
**Adicionado em:** 2026-07-06

---

## Agente Onyx (qwen3) retorna 502 "não retornou dados" — reasoning aborta sem gerar resposta em prompt grande
**Sintoma:** `POST /api/onyx/extrato` (ou qualquer rota usando `sendChatMessageStream`) retorna 502. Log mostra o stream recebendo só `reasoning_start` → `reasoning_delta` (às vezes com 1 palavra tipo "Here") → `reasoning_done`, e nunca um `message_start`/`message_delta` — resultado fica com 0 chars. Acontece de forma **consistente/determinística** com o mesmo arquivo grande (não é flakiness — retry simples nas mesmas condições falha sempre).
**Causa:** O modelo **qwen3** (modelo padrão configurado no agente no Onyx) não processa de forma confiável prompts de entrada muito grandes (~37k chars de texto de extrato + instruções). Ele aborta o bloco de reasoning quase instantaneamente e o turno termina sem nunca emitir a resposta final. NÃO é limite de `max_tokens` de output (aumentar `maxTokens` sozinho não resolve — testado, erro idêntico). NÃO é intermitência (retry com o texto completo, sem reduzir tamanho, falhou 2/2 vezes de forma idêntica).
**Fix real:** dividir o texto extraído pelo Tika em **trechos menores** (`dividirEmChunks` em `src/lib/onyx/extrato-agents.ts`, ~6000 chars cada, preferindo cortar em quebras de página `\f` do PDF) e enviar cada trecho como uma chamada separada ao agente, agregando as transações de todos os trechos no final. Retry por trecho (até 2 tentativas) continua existindo como proteção adicional, mas o que resolveu de fato foi reduzir o tamanho do prompt de entrada. `maxDuration` da rota subiu de 120 para 300 (processar N trechos em sequência leva mais tempo).
**Contexto:** Qualquer agente Onyx usando modelo qwen3 via `sendChatMessageStream` com prompt de entrada grande (>~6-10k chars). Se um agente Onyx some sem responder e o texto de entrada for grande, suspeitar do tamanho do prompt ANTES de max_tokens ou de bug no parser do stream.
**Adicionado em:** 2026-07-02

### pdf-parse v2 na Vercel — "DOMMatrix is not defined" (500 no /api/onyx/extrato)
**Sintoma:** `POST /api/onyx/extrato` (ou qualquer rota que use `pdf-parse` via `PDFParse`/`getText()`) responde 500 em produção (Vercel), mas funciona normalmente em dev local. Log do Vercel mostra: `Failed to load external module pdf-parse-...: ReferenceError: DOMMatrix is not defined`, precedido por `Warning: Cannot load "@napi-rs/canvas" package` e `Warning: Cannot polyfill DOMMatrix, rendering may be broken`.
**Causa:** `pdf-parse@2.4.5` traz sua PRÓPRIA cópia de `pdfjs-dist@5.4.296` (isolada da versão `4.10.38` usada pelo resto do projeto — `resolutions` no `package.json` não tem efeito porque o projeto usa npm, não Yarn, e npm ignora esse campo). Essa versão interna do pdfjs carrega eager (no import, não sob demanda) o build legacy que tenta usar `@napi-rs/canvas` para operações de renderização (`getImage`/`getScreenshot`) — mesmo quando só se usa `getText()`. `@napi-rs/canvas` é um pacote-fachada cujo binário nativo real vem de `optionalDependencies` por plataforma (`@napi-rs/canvas-win32-x64-msvc`, `@napi-rs/canvas-linux-x64-gnu` etc.). No ambiente serverless da Vercel (Linux) esse binário não fica disponível no bundle do Lambda, o carregamento falha, e o pdfjs cai no polyfill de `DOMMatrix` — que não existe em Node puro, lançando o erro fatal.
**Fix:** Polyfill mínimo de `DOMMatrix` no escopo global do servidor, importado ANTES de qualquer `import("pdf-parse")` — `src/lib/bibble/pdfjs-polyfill.ts` (classe stub com os métodos usados pelo pdfjs: `multiply`, `translate`, `scale`, `inverse`). Como o projeto só usa `getText()` (nunca renderização), o polyfill nunca é de fato exercitado — só evita o `ReferenceError` no carregamento do módulo. Importado no topo de `src/lib/onyx/extrato-agents.ts` e `src/lib/bibble/tika.ts` (os dois pontos que fazem `import("pdf-parse")`).
**Contexto:** Qualquer uso futuro de `pdf-parse` no projeto DEVE importar `@/lib/bibble/pdfjs-polyfill` antes do `import("pdf-parse")` dinâmico, senão reintroduz o 500 em produção (não reproduz em dev local — só no runtime Linux da Vercel).
**Adicionado em:** 2026-07-08

### pdf-parse v2 na Vercel — parte 2: "Setting up fake worker failed: Cannot find module pdf.worker.mjs"
**Sintoma:** Depois de corrigir o erro de `DOMMatrix` acima, `/api/onyx/extrato` continuou 500. Log do Vercel mudou para: `[POST /api/onyx/extrato] Setting up fake worker failed: "Cannot find module '/var/task/node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs' imported from .../pdf.mjs"`.
**Causa:** Mesmo em Node.js (sem Web Worker real), o pdfjs-dist usa um "fake worker" que roda na main thread — mas mesmo esse modo faz `import(this.workerSrc)` DINÂMICO (specifier é uma string variável, resolvida em runtime) para carregar `WorkerMessageHandler`. O file tracing do Next.js (`outputFileTracingIncludes`/detecção automática) não consegue seguir imports dinâmicos com string variável, então `pdf.worker.mjs` nunca era incluído no bundle enviado pro Lambda da Vercel — o arquivo existe em `node_modules` local mas não chega em produção.
**Fix (duas camadas, redundantes de propósito):** (1) `next.config.ts` ganhou `outputFileTracingIncludes: { "/**": ["./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", ".../pdf.worker.min.mjs"] }` — força esses arquivos a entrar no bundle de toda rota server-side, independente de tracing automático. (2) `src/lib/bibble/pdfjs-polyfill.ts` ganhou `pdfjsWorkerReady` — resolve o caminho absoluto do `pdf.worker.mjs` real (via `require.resolve("pdfjs-dist/legacy/build/pdf.mjs", { paths: [...] })` a partir de dentro de `node_modules/pdf-parse`, pois o pdfjs-dist aninhado ali é uma versão DIFERENTE do da raiz do projeto — nunca misturar as duas), importa via `pathToFileURL` (contorna o `exports` map do `package.json` do pdf-parse, que bloqueia acessar subpaths do pdfjs-dist aninhado por specifier de string) e registra em `globalThis.pdfjsWorker` — quando esse global existe, o pdfjs PULA o `import()` dinâmico problemático por completo. Os dois pontos de uso (`extrato-agents.ts`, `tika.ts`) agora fazem `await pdfjsWorkerReady;` antes de `import("pdf-parse")`.
**Verificação:** Após o build, `.next/server/app/api/onyx/extrato/route.js.nft.json` (arquivo de trace do Next) deve listar `node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs` — se sumir dessa lista em alguma mudança futura de dependências, o erro volta.
**Contexto:** Continuação direta da entrada anterior (`DOMMatrix is not defined`) — mesma causa raiz de fundo (pdf-parse v2 + pdfjs-dist legacy build assumindo ambiente que a Vercel serverless não fornece). Se o pdf-parse for atualizado de versão major no futuro, revalidar se esse problema ainda existe antes de reaplicar o fix.
**Adicionado em:** 2026-07-08

### Chunking por trecho gera transações duplicadas/truncadas (extrato bancário)
**Sintoma:** Extrato de 18 páginas retornou 458 transações (muito acima do esperado — extratos normais têm dezenas). Algumas descrições vieram cortadas no meio da palavra (ex: `"DISTRESSED FUNDO DE 1"`, `"TEKA TECELAGEM KUEHNR"`).
**Causa:** Ao dividir o texto do Tika em chunks (`dividirEmChunks`) sem overlap controlado, uma linha de movimentação que cai exatamente na fronteira de dois chunks pode aparecer inteira (ou truncada) nos dois trechos adjacentes — o agente processa cada trecho isoladamente e não sabe que já viu aquela linha. Chunk grande demais também aumenta a chance do modelo "perder o fio" da linha e cortar/abreviar a descrição.
**Fix:** (1) Deduplicação por chave `data|descricao|valor` após agregar os resultados de todos os trechos (`processarExtratoPorAgentes` em `src/lib/onyx/extrato-agents.ts`) — uma transação idêntica não se repete de verdade num extrato real. (2) Reduzido `TAMANHO_MAX_CHUNK` de 6000 para 3500 chars. (3) Prompt reforçado: "descricao deve ser a linha COMPLETA... nunca corte no meio de uma palavra" e "cada movimentação aparece SOMENTE UMA VEZ".
**Contexto:** Qualquer pipeline que divide texto grande em chunks processados independentemente por um LLM e depois agrega os resultados — duplicação na fronteira dos chunks é um risco estrutural, não um bug pontual.
**Adicionado em:** 2026-07-02

### Extrato de páginas recortadas/exportadas retorna 0 transações silenciosamente
**Sintoma:** Upload de um PDF "recortado" (ex: só as 3 primeiras páginas de um extrato maior, exportado por alguma ferramenta de split de PDF) processa sem erro mas retorna 0 transações. Log mostra `[PDF-PARSE fallback] ... 44 chars extraídos` e o texto bruto é só `-- 1 of 3 --  -- 2 of 3 --  -- 3 of 3 --` (marcadores de página do pdf-parse, sem nenhum conteúdo real).
**Causa:** Algumas ferramentas de recorte/split de PDF rasterizam as páginas (convertem em imagem) em vez de preservar a camada de texto original. Nem o Tika nem o fallback pdf-parse conseguem extrair texto de um PDF assim — não é bug do pipeline, é o arquivo de entrada que não tem texto extraível. O agente Organizador respondeu corretamente `[]` porque de fato não recebeu nenhuma movimentação.
**Fix:** `processarExtratoPorAgentes` (`src/lib/onyx/extrato-agents.ts`) agora valida o texto extraído removendo os marcadores `-- N of M --` do pdf-parse antes de checar o tamanho — se sobrar menos de 20 chars reais, lança erro 422 claro ("PDF pode ser scan sem OCR ou ter perdido a camada de texto") em vez de silenciosamente processar um texto vazio e devolver 0 transações.
**Contexto:** Sempre testar o pipeline de extração com o PDF ORIGINAL (não um recorte feito por ferramenta externa) — recortes podem introduzir esse problema que não existe no arquivo fonte.
**Adicionado em:** 2026-07-02

### API PDF24 (Cross Service Solutions) — path real do endpoint difere da documentação do widget
**Sintoma:** `POST {PDF24_OCR_API_URL}/api/` retorna `404 {"message":"Cannot POST /solutions/api/"}`. A documentação do widget mostra "POST /api/ 67" com um número solto ao lado, sem indicar claramente que faz parte do path.
**Causa:** O "67" na documentação é o **id da solução/produto** ("PDF OCR") dentro da plataforma multi-produto Cross Service Solutions — o endpoint real de criação de job é `POST /api/{solutionId}`, ou seja `POST /api/67`, não `POST /api/`. Confirmado testando incrementalmente contra a API real (curl) até achar o path que retornava 201 em vez de 404.
**Fix:** `src/lib/bibble/pdf24-ocr.ts` usa `PDF24_SOLUTION_ID = "67"` e monta a URL como `${PDF24_URL}/api/${PDF24_SOLUTION_ID}` tanto para criar o job (POST) quanto consultar (GET .../{jobId} continua sendo só o id numérico do job, não da solução).
**Contexto:** Documentação de "widgets" white-label (PDF24 by Cross Service Solutions, e provavelmente outras integrações da mesma plataforma) pode omitir que um número aparentemente solto no exemplo de rota é na verdade parte obrigatória do path. Quando a doc de uma API externa parecer incompleta/ambígua, validar incrementalmente com curl antes de assumir o path.
**Adicionado em:** 2026-07-02

### API PDF24 — critério de "job concluído" e tempo de processamento real
**Sintoma:** Achava-se que `output: null` no job significava "ainda processando" e `output` preenchido significava concluído. Na prática, `output` já vem preenchido com `{result: "<p>please download your PDF</p>", files: []}` desde o status `pending`/`in_progress` — só quando `status` vira `"done"` é que `output.files[]` recebe o arquivo de verdade.
**Causa:** A API retorna um placeholder de "output" genérico durante todo o processamento, não `null`. O sinal confiável de conclusão é `output.files.length > 0` (ou `status === "done"`), não a mera presença do campo `output`.
**Fix:** `aguardarJobOcr` em `pdf24-ocr.ts` verifica `output?.files && files.length > 0` como sinal de sucesso, e trata `status` em `{error, failed, failure, cancelled, canceled}` como falha explícita (aborta o polling cedo em vez de esperar o timeout inteiro).
**Tempo real observado:** Um PDF de 3 páginas de scan levou **mais de 8 minutos** para o job concluir (`status: "done"`) nesse serviço. `PDF24_POLL_TIMEOUT_MS` foi ajustado de 120_000 para 480_000 (8 min), e `maxDuration` da rota `/api/onyx/extrato` subiu de 300 para 800 para acomodar. Esse tempo pode variar (fila do serviço, tamanho do arquivo) — não é um SLA garantido, é só o que foi observado num teste real.
**Contexto:** Qualquer uso de `ocrViaPdf24`. Se o guard de texto insuficiente em `extrato-agents.ts` disparar 422 mesmo com PDF24 configurado, o job pode ter estourado o timeout de polling — checar logs `[PDF24-OCR]` para confirmar.
**Adicionado em:** 2026-07-02

---

## Canvas Three.js dentro de container `absolute` fica com width:0 (dentro de iframe do painel)
**Sintoma:** Background/canvas WebGL renderizado dentro de um container `position: absolute` (comum para backgrounds decorativos atrás de conteúdo) fica com `canvas.style.width: 0px` permanentemente — nada aparece, mesmo o container pai tendo largura correta. Mais provável de reproduzir quando o componente é montado dentro do iframe de módulo do painel (`PainelLayoutClient.tsx`).
**Causa:** `renderer.setSize(container.clientWidth, ...)` roda de forma síncrona no `useEffect`, no instante exato do mount — nesse momento o container `absolute` pode ainda reportar `clientWidth: 0` porque o browser não terminou de computar o layout do elemento pai. O `ResizeObserver` deveria corrigir isso no callback inicial (a spec garante 1 disparo ao chamar `.observe()`), mas se o container "já nasce" com o tamanho final do ponto de vista do CSS (não há uma mudança de tamanho real depois do mount), esse callback de garantia pode não chegar a tempo/não disparar de novo no ambiente do iframe — o canvas fica preso no `width:0` do primeiro frame.
**Fix:** Além do `ResizeObserver`, adicionar uma segunda leitura forçada via `requestAnimationFrame` logo após `resizeObserver.observe(container)`, chamando a mesma função de ajuste de tamanho (que já tem guard `container.clientWidth === 0 → return` para não aplicar um tamanho inválido). Implementado em `src/components/ui/animated-shader-background.tsx`. Lembrar de limpar o `requestAnimationFrame` no cleanup do efeito (`cancelAnimationFrame`).
**Contexto:** Qualquer componente Three.js/canvas com container `position: absolute` (background decorativo) neste projeto — especialmente se for renderizado dentro do iframe de módulo do PainelAlpha. Confirmado via `preview_eval` inspecionando `canvas.style` diretamente (não visível em screenshot, que trava com canvas WebGL animado em ambiente headless — usar `preview_eval` para inspecionar propriedades do canvas em vez de depender só de screenshot nesses casos).
**Adicionado em:** 2026-07-09

**Nota adicional (Onda 4 — Apresentation Studio, componentes 3D via React Three Fiber):** `@react-three/fiber`'s `<Canvas>` já resolve o problema de RESIZE internamente (usa `ResizeObserver` por baixo dos panos) — não é necessário replicar manualmente o fix de `requestAnimationFrame` acima para os componentes `globo`/`particulas`/`objeto3d`. PORÉM, R3F **não resolve** o problema de VISIBILIDADE dentro do iframe do painel: `document.visibilityState` continua não refletindo a visibilidade real do módulo quando ele está "escondido" dentro do iframe de `PainelLayoutClient.tsx` (mesma limitação do `animated-shader-background.tsx`). Sem tratar isso, o `frameloop` do R3F continua rodando (consumindo GPU/CPU) mesmo com o módulo fora de tela. Fix implementado: hook compartilhado `src/components/Apresentacoes/Editor/RenderEngine/useVisibilidadeIframe.ts` baseado em `IntersectionObserver`, usado nos 3 componentes de renderização 3D (`GloboRender.tsx`/`ParticulasRender.tsx`/`ObjetoGlbRender.tsx`) para alternar a prop `frameloop` do `<Canvas>` entre `"always"` e `"never"` conforme a visibilidade real do componente.
**Adicionado em:** 2026-07-10

**Nota adicional 2 (Onda 4, Lens):** cada componente 3D monta seu PRÓPRIO `<Canvas>` do R3F independente (R3F não compartilha contexto WebGL entre múltiplos `<Canvas>` facilmente). Navegadores têm limite prático de contexts WebGL simultâneos (tipicamente ~8-16, varia por browser/GPU) — um slide com muitos componentes 3D pode degradar performance ou falhar silenciosamente (o browser recicla o context mais antigo quando o limite é atingido, "perdendo" a renderização dele sem erro visível). Não é bloqueante para uso típico (poucos componentes 3D por slide), mas vale ter em mente se um usuário reportar um componente 3D "sumindo" quando há muitos outros no mesmo slide — não é bug de código, é limite de recurso do browser. Sem hard-limit de UI implementado ainda; considerar no futuro se virar problema real reportado.
**Adicionado em:** 2026-07-10 (Lens)

## CS&NPS — seção "Serviços Contratados" (dados do Painel de Metas) escondida quando cliente tem só 1 serviço
**Sintoma:** Usuário testa um cliente que TEM contrato real correspondente no Painel de Metas (CNPJ confirmado batendo em ambas as tabelas) mas a seção "Serviços Contratados" (Forma de Pagamento/Valor do Contrato/Closer) não aparece no modal de detalhe do CS&NPS.
**Causa:** A seção estava condicionada a `Array.isArray(clienteGrupo) && clienteGrupo.length > 1` — só renderizava quando o CNPJ tinha MÚLTIPLOS registros/serviços mesclados. Como a feature de múltiplos serviços por CNPJ (2026-07-13) é nova, praticamente todo cliente hoje tem exatamente 1 registro — a condição escondia a seção (e os dados do Metas) para quase 100% dos casos reais, incluindo clientes com contrato correspondente de verdade.
**Fix:** Trocar a condição para renderizar sempre que houver um `cliente` válido (todo cliente tem no mínimo 1 serviço) — normalizar `clienteGrupo` para array sempre via `registrosDoServicosSecao = cliente ? [cliente, ...outrosServicos] : []`, em vez de checar `length > 1`. O título "Serviços Contratados (N)" mostra "(1)" normalmente quando só há 1 serviço — isso é esperado e correto.
**Contexto:** `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`. Lição geral: ao decidir esconder uma seção nova "só quando há múltiplos itens" para evitar ruído visual, checar se essa condição também esconde dados que deveriam aparecer no caso comum (1 item) — nem toda feature de "mesclagem" deve ficar invisível no caso trivial de 1 elemento só.
**Adicionado em:** 2026-07-13

## Modelo de IA "não lê" imagem anexada no chat
**Sintoma:** usuário anexa imagem, modelo responde como se não houvesse imagem (ou descreve genérico). Logs mostram a imagem indo como texto tipo "[imagem disponível em: url]".
**Causa:** a imagem estava sendo passada como TEXTO (link/descrição) no content da mensagem. Modelos de visão precisam receber a imagem como conteúdo multimodal real.
**Fix:** (Bibble/OpenAI-compat) o `content` do user vira array `[{type:"text",text},{type:"image_url",image_url:{url:"data:image/...;base64,..."}}]`. (Onyx) upload via POST /api/chat/file → passar `file_descriptors` no send-chat-message. Sempre checar se o modelo TEM visão antes (`modelSupportsVision`) — Mistral/DeepSeek/Phi/Llama-básico/Qwen não têm; avisar o usuário pra trocar.

---

### `next build` (Turbopack) falha com "the name 'X' is defined multiple times" apontando pra uma função que NÃO existe mais no arquivo
**Sintoma:** `npx next build` reporta `Ecmascript file had an error ... the name 'AlgumNome' is defined multiple times` num arquivo `.tsx`/`.ts`, apontando linha/coluna de uma declaração de função — mas `grep`/leitura direta do arquivo mostra que essa função só existe UMA vez (ou nem existe mais). Builds anteriores na mesma sessão passavam limpo sem tocar nesse arquivo.
**Causa:** cache de build do Turbopack (`.next/cache/`) desatualizado/inconsistente — ficou stale depois de uma tentativa de build anterior que falhou no meio (ex.: `prisma generate` travando em `EPERM`, ver entrada de EPERM acima) ou de edições concorrentes de outra sessão/processo no mesmo repositório. `.next/cache` é DIFERENTE de `.next/dev` (usado pelo `npm run dev` rodando em paralelo) — são pastas separadas.
**Fix:** apagar SÓ `.next/cache` (nunca `.next/dev`, que pertence ao dev server ativo do usuário — apagar essa quebraria a sessão dele) e rodar o build de novo: `rm -rf .next/cache && npx next build`. Confirmar antes com `grep`/leitura direta que a função "duplicada" realmente não existe mais no arquivo — se existir de verdade, é erro real de código, não cache, e limpar o cache não resolve.
**Contexto:** Qualquer build (`next build`/Forge) que reporte um erro de sintaxe/duplicação num arquivo que a leitura direta do código contradiz. Mais provável de acontecer depois de um build anterior ter sido interrompido/falhado no meio (não só o `prisma generate`/EPERM — qualquer falha no meio da etapa `next build` pode deixar `.next/cache` inconsistente).
**Adicionado em:** 2026-08-06 (Forge, sessão Container Alpha/exibidor HTML — build reportou `AnimacaoItemForm` duplicado em `AnimacaoPropsV2.tsx`, arquivo não tocado nesta sessão e sem a função duplicada no código real)
**Adicionado em:** 2026-06-23

## React error #310 ("more hooks than previous render") em produção — `useSearchParams()` numa página `force-dynamic` (⚠️ remover só o `<Suspense>` NÃO basta — ver nota abaixo)
**Sintoma:** "Application error: a client-side exception has occurred" ao abrir uma página — reproduz **especificamente em hard-reload** (F5, link direto, nova aba) em produção (Vercel). NÃO reproduz em `npm run dev` local, e NÃO reproduz em navegação client-side (SPA routing a partir de outra página do painel já carregada) — essa combinação exata (funciona local, funciona em navegação SPA, só quebra em hard-reload de build de produção) é a assinatura característica deste bug.
**Causa raiz completa (só ficou clara na 2ª rodada de investigação):** `useSearchParams()` do `next/navigation`, usado num Client Component renderizado por um Server Component `force-dynamic`, causa esse erro na hidratação de produção — **mesmo sem nenhum `<Suspense>` ao redor dele**. A primeira hipótese (Suspense com `fallback={null}` causando mismatch de contagem de hooks entre fallback e conteúdo real) parecia fazer sentido e a correção baseada nela (remover só o `<Suspense>`) passou por todo o pipeline de qualidade (Forge/Anubis/Lens/Probe) e foi para produção — **mas o erro voltou horas depois**, com um novo `dpl` (deployment hash) confirmando que o deploy novo realmente estava no ar. Reproduzido de novo ao vivo, mesmo padrão exato (hard-reload quebra, SPA nunca quebra). Conclusão: o próprio hook, não o boundary, é a causa.
**Fix definitivo:** eliminar `useSearchParams()` da árvore de render inteiramente. Se o único uso é ler um parâmetro simples num `useEffect` (que já só roda no cliente), trocar por `new URLSearchParams(window.location.search).get(...)` lido diretamente do DOM dentro do próprio efeito — mesmo resultado funcional, sem depender do comportamento especial que o Next.js App Router dá a esse hook durante SSR/hidratação.
**Contexto:** `src/components/RoadmapAlpha/RoadmapDashboard.tsx`, usava `useSearchParams()` só para ler `?novoModulo=1` e abrir um dialog. `src/app/PainelAlpha/Roadmap/page.tsx` é `force-dynamic`.
**⚠️ Lição para a próxima vez que este erro aparecer:** se a página JÁ NÃO tem `<Suspense>` (ou já foi removido) e o erro #310 ainda ocorre, **não assuma que a causa é outra coisa** — verifique primeiro se ainda existe algum uso de `useSearchParams()` (ou hooks parecidos sensíveis a timing de hidratação) em qualquer componente client renderizado por aquela rota, mesmo sem boundary nenhum ao redor. A regra geral anterior ("Suspense supérfluo em página force-dynamic") continua válida como PARTE do padrão, mas não é suficiente sozinha — o hook em si é o gatilho real, o Suspense só aumentava a chance de reproduzir.
**Como foi confirmado (as duas vezes):** reprodução ao vivo em produção (usuário logou no navegador da sessão do Bibble; Bibble só observou console/network, nunca tocou em credenciais) — `read_console_messages` capturou o erro real, `read_network_requests` confirmou que o SSR retornava 200 (dado chegava bem do servidor), e testar navegação client-side vs. hard-reload isolou a causa para hidratação, não para os dados em si. Na 2ª vez, o `dpl` (deployment hash) diferente no stack trace confirmou que o novo deploy já estava ativo antes de reproduzir de novo — não era cache de CDN nem deploy antigo.
**Adicionado em:** 2026-08-25 (Bibble, investigação + Scout + 2 rodadas de correção — 1ª incompleta, 2ª definitiva)

## Edição de objetivo "módulo novo" do Roadmap mostrava campo "Projeto" enganoso (select com valor não intencional)
**Sintoma:** ao editar um objetivo do Roadmap Alpha criado via botão "Novo módulo", o campo "Projeto" reaparecia no formulário de edição em vez de ficar oculto — mostrando um `<select>` editável quando o objetivo, por definição, cria um módulo novo e não pode ser associado a um projeto/módulo existente.
**Causa:** a checagem `isNovoModuloObjective(constraints)` determinava o tipo do objetivo procurando um texto mágico fixo (`NOVO_MODULO_CONSTRAINTS`) DENTRO do campo `constraints` (texto livre, editável pelo usuário na própria tela de criação/edição). Bastava o usuário reescrever o campo de restrições com conteúdo técnico próprio — uso normal e esperado — para o sinal se perder, já que o texto exato não sobrevivia à edição.
**Fix:** campo estrutural `RoadmapObjective.isNewModule` (Boolean, persistido explicitamente na criação, nunca recalculado depois). Ver seção completa em `integration-points.md` ("Roadmap Alpha — identidade de 'objetivo de módulo novo' é campo estrutural"). Migration aplicada em produção via Vault: `ALTER TABLE RoadmapObjective ADD COLUMN isNewModule INTEGER NOT NULL DEFAULT 0` + backfill `UPDATE ... WHERE moduleKey = 'roadmap'` (script Node pontual com `@libsql/client`, padrão já documentado neste arquivo para o Turso `basetestes-alphacomex` — `prisma migrate` não alcança esse banco). Backup pré-mudança: `database-backups/pre-change/painelalpha_turso_pre_change_roadmap-objective-isnewmodule_2026-08-25T17-58-16-341Z.sql`.
**Achado colateral durante a investigação:** o `moduleKey` usado como placeholder para objetivos de módulo novo (`"roadmap"`) NÃO é um valor inválido — é o id real do módulo "Roadmap Alpha" em `MODULOS_REGISTRY`. Uma hipótese inicial errada (de que `updateRoadmapObjective` sempre falharia com `UNKNOWN_MODULE` para esses objetivos) foi descartada ao ler `modulos-registry.ts` com atenção — o bug real era só a UI mostrar o campo, não uma falha de validação no backend.
**Contexto:** `src/lib/roadmap-alpha/objectives.ts`, `contracts.ts`, `worker.ts`, `src/components/RoadmapAlpha/RoadmapDashboard.tsx` (`EditObjectiveDialog`/`CreateObjectiveDialog`).
**Adicionado em:** 2026-08-25 (Bibble, investigação + Scout + Vault + Echo + Forge + Anubis + Lens + Probe)

## Worker de documentação do Roadmap Alpha trava indefinidamente durante geração de manifesto (heartbeat para, timeout de 600s não dispara) — NÃO RESOLVIDO
**Sintoma:** uma fase de documentação (Qwen/Ollama, `qwen-generator.ts`) fica com status `RUNNING`/`PROCESSING` por muito mais tempo que o normal (>10-13min observado, vs. ~70-170s do caminho feliz ou de um `TRUNCATED_MODEL_RESPONSE` normal). O campo `heartbeatAt` do `RoadmapDocumentationJob` para de atualizar (deveria atualizar a cada 30s, `HEARTBEAT_MS` em `worker.ts`) e nunca mais muda enquanto o processo trava — mesmo o processo Node continuando vivo (não crashou), sem consumir CPU visível de forma anormal.
**O que JÁ foi descartado como causa:** não é `max_tokens` (formato OpenAI-compatible, testado, sem efeito no Ollama). Não é `options.num_ctx`/`options.num_predict` — testado com `num_ctx: 65_536` (trava) e depois só `num_predict: 8_192` sem alterar `num_ctx` (trava igual, mesma assinatura: heartbeat para, processo não morre, nunca chega a `PROVIDER_TIMEOUT` mesmo passando muito do timeout de 600s configurado em `qwen-generator.ts`). Ou seja, o travamento acontece **independente** desses parâmetros — não é sobre tamanho de contexto/saída.
**Hipótese não confirmada:** o `AbortController`/`setTimeout` de 600s no código parece correto na leitura (deveria abortar o `fetch` e cair no `catch` que checa `controller.signal.aborted` → `PROVIDER_TIMEOUT`), mas na prática isso nunca foi observado disparando durante os travamentos reais — sugere que o event loop do processo pode estar bloqueado de forma síncrona em algum ponto (o que impediria até o próprio timer de disparar), não é só a chamada de rede ficando pendurada. Não foi identificado o ponto exato do bloqueio síncrono.
**Mitigação temporária aplicada:** nenhuma correção de causa raiz — o objetivo real que expôs esse bug (`RM-2026-7282A4`, "CRM dos Parceiros") foi **arquivado** a pedido do usuário para tirar de circulação, e o processo travado do worker foi morto manualmente (`Stop-Process`) cada vez que isso foi detectado — o supervisor PowerShell já reinicia automaticamente, mas não detecta esse tipo de travamento sozinho (só reinicia quando o processo morre de verdade, e este não morre).
**Próximos passos sugeridos (não implementados):** (1) investigar se algum outro objetivo grande reproduz o travamento, para isolar se é específico do conteúdo desse objetivo (descrição muito longa) ou um bug geral; (2) considerar adicionar um watchdog externo ao próprio `setTimeout` interno — ex: o loop do worker (`scripts/roadmap-alpha.mjs`) checando periodicamente se o heartbeat do job atual parou de avançar, e matando/reiniciando o processo nesse caso, já que o timeout interno se mostrou não confiável; (3) investigar se `JSON.parse` de uma resposta muito grande do Ollama (não streaming, `stream: false`) pode bloquear o event loop por tempo suficiente para mascarar o problema.
**Contexto:** `src/lib/roadmap-alpha/qwen-generator.ts`, `src/lib/roadmap-alpha/worker.ts` (heartbeat, `LEASE_MS`, `AUTO_RETRY`).
**Adicionado em:** 2026-08-25 (Bibble, investigação parcial — NÃO RESOLVIDO, registrado para continuidade futura)
