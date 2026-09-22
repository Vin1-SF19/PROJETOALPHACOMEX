# Story RM-2026-EB7B58 — Restaurar operação: acesso das equipes, opções das seleções, fix do follow-up, agendar jobs

**Objetivo do Roadmap:** Restaurar operação: acesso das equipes, opções das seleções, fix do follow-up, agendar jobs
**Projeto:** Painel Alpha
**Módulo:** Alpha CRM / BPM
**Status:** Fase 2 — story criada (documental); implementação pendente
**Posição no grupo:** 2 de 4 (RM-2026-5669BD → RM-2026-EB7B58 → RM-2026-FE6C53 → RM-2026-9941F2)

## Contexto

A Fase 0 (auditoria somente leitura) e a Fase 1 (blueprint técnico) revalidaram
os cinco resultados do objetivo diretamente no código atual, em vez de confiar
no diagnóstico histórico de 2026-09-04. Conclusão consolidada: **quatro das
cinco causas raízes são de dado/configuração viva, não de código faltante**, e
uma (item 3, modal "Em tratativa") já está corrigida no código atual (commits
e1e6c898/f438d929, confirmados nesta linhagem). Esta é a Fase 2: formalizar o
artefato documental exigido pelo Artigo I da Constitution (blueprint do Scout)
antes de qualquer operação de dado, checkpoint Vault ou mudança de infra.

Este objetivo reaproveita a base estabilizada pela RM-2026-5669BD (superfície
CRM versionada, procedimento de build limpo) e será reaproveitado pela
RM-2026-FE6C53 (autoridade única de transições) e RM-2026-9941F2 (consolidação
de opções em `BpmCampoOpcao`, UAT tri-perfil que absorve a validação ponta a
ponta de Comercial/Operacional exigida aqui).

## Escopo

1. Registrar os cinco critérios de aceite com evidência, dependências e
   rollback próprios.
2. Consolidar a matriz de acesso Comercial/Operacional × pipeline × operação a
   partir do mecanismo real (`podeAcessarPipelineBpm`/`checarAcessoBpmPipeline`
   + `SetorPermissao` + `BpmPipelineSetor`), incluindo a pergunta objetiva para
   os valores de dado que dependem do banco vivo.
3. Registrar as dez seleções (nome do campo, pipeline/etapa, mecanismo de
   persistência real) e as perguntas objetivas sobre os valores de opção
   aprovados que ainda não foram fornecidos por uma fonte de negócio.
4. Decidir e registrar a estratégia de jobs (cutover do motor central via
   `scripts/migrar-automacoes-hardcoded.ts` vs. adicionar as rotas legadas ao
   `vercel.json`), com a mutação em massa correspondente sinalizada para
   checkpoint Vault.
5. Registrar o procedimento de verificação da tarefa vencida com alerta
   pendente.
6. Auditar entregabilidade de cada frente (quem consome, por qual tela/rota) e
   registrar `AUTO_ADJUSTMENT_REQUIRED`/`DELIVERY_READY` por item.

## Fora de escopo

- Aplicar qualquer mutação em massa (cutover de automações) ou alteração de
  `SetorPermissao`/`BpmCampoOpcao` em lote sem checkpoint Vault próprio, com
  backup pre-change verificado (≤48h) e aprovação humana explícita e
  específica — silêncio ou aprovação genérica não valem.
- Alterar `vercel.json` (infraestrutura/CI-CD) — autoridade exclusiva de
  DevOps (Constitution, Art. II).
- Consolidar `opcoesJson` → `BpmCampoOpcao` — escopo da RM-2026-9941F2; esta
  story usa a fonte canônica **real e efetiva hoje** (`opcoesJson`), não o
  model desconectado.
- Commit/push — autoridade exclusiva de Virtus, mediante chamada manual.
- Inventar valores de negócio (nomes de opções, datas de janela, responsáveis
  humanos) que não constam em nenhum artefato aprovado do projeto.

## Frente 1 — Acesso Comercial/Operacional aos pipelines

### Causa raiz confirmada

Dado, não código. `src/lib/bpm/ownership.ts:65-76` (`podeAcessarPipelineBpm`)
concede acesso quando: `isAdminRole(role)` **ou** (`possuiPermissaoCrm`
verdadeiro **e** (`pipeline.setores` vazio **ou** usuário é membro do card
**ou** algum `setor.nome` do pipeline bate com o `role` do usuário via
`isSameRole`)). `checarAcessoBpmPipeline` (linha 192-221) monta esses
parâmetros a partir de `SetorPermissao` (permissão `crm` por setor/role) e da
relação `BpmPipeline.setores` (tabela `BpmPipelineSetor`, setor com `nome`).
Não há bypass hardcoded por role administrativa nesse caminho além do
`isAdminRole` documentado.

O caminho administrativo para conceder o módulo `crm` a um setor já existe e
está em produção: `src/actions/PermissoesSetor.ts:39-57`
(`atribuirModulosAoSetor`) grava em `SetorPermissao` via `db.$transaction`
(`deleteMany` + `createMany`), validado por Zod (`KNOWN_MODULOS`) e exige
`requireAdminSession`. Consumido pela tela `/PainelAlpha/cadastro`
(`src/app/PainelAlpha/cadastro/page.tsx`).

### Pergunta objetiva (bloqueia apenas a verificação, não o mecanismo)

Não há ferramenta de leitura do Turso real nesta sessão (catálogo restrito a
Read/Grep/Glob/Edit/Write). Não é possível confirmar sem acesso ao banco:

1. `SetorPermissao` já contém `{ setor: "COMERCIAL", modulo: "crm" }` e
   `{ setor: "OPERACIONAL", modulo: "crm" }`?
2. `BpmPipelineSetor` associa o pipeline usado pelo time Comercial (ex.:
   "Revisão de Radar") ao setor `COMERCIAL`, e o pipeline usado pelo time
   Operacional (ex.: "Operacional") ao setor `OPERACIONAL`?

Se a resposta a qualquer uma for não, a correção é **operação de dado via UI
existente** (`/PainelAlpha/cadastro` → atribuir módulo `crm` ao setor; edição
dos setores do pipeline na tela de administração do pipeline) — não requer
código novo nem migration. Se o volume envolver atribuição em lote fora da UI
(ex.: script direto no banco), trata-se de mutação e exige checkpoint Vault.

### Dependências

`src/lib/bpm/ownership.ts`, `src/actions/PermissoesSetor.ts`,
`src/app/PainelAlpha/cadastro/page.tsx`, tela de setores do pipeline em
`src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/`.

### Ambiente de validação

Login real com conta COMERCIAL (sem role admin) → deve acessar o pipeline do
próprio setor; idem para OPERACIONAL. Não é aceitável validar com conta
Admin/CEO/TI, pois essas roles têm bypass por `isAdminRole`.

### Evidência

Pendente — depende de leitura/gravação no Turso real e de teste de login com
conta não administrativa, fora do catálogo de ferramentas desta sessão.

### Rollback

Reverter `SetorPermissao`/`BpmPipelineSetor` para o estado anterior (mesma
tela administrativa, operação simétrica). Sem mudança de schema, rollback é
apenas re-atribuição de dado.

## Frente 2 — Dez seleções com opções válidas

### Causa raiz confirmada e refinada

O editor de campo (`src/actions/bpm/Campos.ts:215-392`,
`CriarCampoBpm`/`AtualizarCampoBpm`) já persiste um array `opcoes:[{rotulo,
ativo}]` em `BpmCampo.opcoesJson`. O renderer `CampoBpmInput.tsx:35-63` lê
exclusivamente `opcoesJson` (`lerOpcoes`). O model `BpmCampoOpcao` existe no
schema (linha ~5052) mas **tem zero usos em `src/`** — não é a fonte
consumida hoje. Popular esse model não teria efeito visível até uma migração
de leitura (escopo da RM-2026-9941F2).

### Os dez campos (nomes herdados da auditoria da Fase 0/1)

| # | Pipeline (aprox.) | Campo |
|---|---|---|
| 1 | Financeiro | Status da assinatura |
| 2 | Financeiro | Status do contrato |
| 3 | Financeiro | Status financeiro |
| 4 | Operacional | Andamento/status |
| 5 | Operacional | Motivo do indeferimento |
| 6 | Operacional | Classificação do motivo |
| 7 | Operacional | Solução adotada |
| 8 | Revisão de Radar | Regime tributário |
| 9 | Revisão de Radar | Radar atual |
| 10 | Revisão de Radar | Status da sede |

### Pergunta objetiva (bloqueia apenas o preenchimento, não o mecanismo)

Os **valores exatos de cada opção** (rótulos de negócio, ex. quais são os
status possíveis de "Status da assinatura") não constam em nenhum artefato
aprovado lido nesta sessão (nem PRD, nem `.bibble/memory/`, nem os arquivos de
código). Popular esses valores sem uma fonte de negócio aprovada seria
inventar requisito de produto, proibido pelo Artigo IV da Constitution. Esta
pergunta deve ser respondida pelo PM/dono do produto antes da implementação
dessa frente; a implementação em si (chamar `AtualizarCampoBpm` com o array de
opções) é trivial uma vez que os valores existam.

### Dependências

`src/actions/bpm/Campos.ts`, `src/app/PainelAlpha/CampoBpmInput.tsx`,
`src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/{AdminPipelineClient,PipelineWorkspaceSections}.tsx`.

### Ambiente de validação

Cada um dos 10 `<select>` deve renderizar as opções aprovadas no formulário do
card correspondente e salvar um valor válido via Server Action existente.

### Evidência

Pendente — depende dos valores de negócio (pergunta objetiva acima) e de
gravação em `BpmCampo.opcoesJson` via UI/Server Action já existentes.

### Rollback

`AtualizarCampoBpm` é idempotente por campo; reverter é executar a mesma ação
com o array de opções anterior (nenhum histórico de opções é destruído por
esta operação, pois é substituição de um campo JSON simples via UI padrão,
não uma migration).

## Frente 3 — Modal "Em tratativa" sincronizado com follow-up

### Já corrigido no código atual

Cadeia íntegra confirmada por leitura direta:
`CardFullViewModal.tsx:230` (`onEstadoFollowUpChange={atualizarEstadoFollowUp}`)
→ `PainelRegistrar.tsx:65` → `CardOpenFormSlot.tsx:72`
(`onEstadoChange={onEstadoFollowUpChange}`, ativo somente quando o componente
da composição é `follow-up-checklist`) → `PainelChecklistFollowUp.tsx` chama
`onEstadoChange` em carregamento, erro e após ação (linhas 66, 71, 98, 122). A
regressão do diagnóstico histórico de 2026-09-04 (callback perdido após
extração do slot) não existe mais; a renderização também não é mais hardcoded
por nome de etapa (usa `FormularioEtapaRenderer`), coerente com os commits
e1e6c898/f438d929.

### Pergunta objetiva (dado, não código)

Confirmar que a composição (`formularioEtapa`) da etapa "Em tratativa" de cada
pipeline aplicável realmente inclui o componente `follow-up-checklist` — sem
isso, o card nunca chega a montar `PainelChecklistFollowUp`, mesmo com o
código correto.

### Dependências

`src/app/PainelAlpha/AlphaCRM/CardModal/{CardFullViewModal,PainelRegistrar,CardOpenFormSlot,PainelChecklistFollowUp}.tsx`.

### Ambiente de validação

`/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → abrir card na etapa "Em
tratativa" → alterar o estado do checklist de follow-up → modal deve refletir
o novo estado e permitir/bloquear o fechamento corretamente.

### Evidência

DELIVERY_READY (código): cadeia de callback íntegra, validada por leitura de
código nas Fases 0/1 e reconfirmada nesta Fase 2. Falta apenas a confirmação
de dado (composição da etapa) e um teste de UI real (sem navegador nesta
sessão).

### Rollback

Não aplicável — nenhuma alteração de código é feita nesta frente.

## Frente 4 — Jobs de novos leads e alertas agendados

### Causa raiz confirmada

`vercel.json` agenda hoje 8 crons; nenhum deles é
`/api/bpm/jobs/automacao-novos-leads` nem `/api/bpm/jobs/alertas-tarefas`.
Apenas `/api/bpm/jobs/automacoes` (motor central, a cada 5 min) está agendado.
As duas rotas legadas (`src/app/api/bpm/jobs/automacao-novos-leads/route.ts`,
`.../alertas-tarefas/route.ts`) existem, verificam
`automacoesMigradasEstaoAtivas`/`alertasTarefasForamMigrados`
(`src/lib/bpm/automacoes/migracao-hardcoded.ts:130-147`) e retornam
`{ignorado:true, motivo:"MIGRADO_PARA_MOTOR_CENTRAL"}` quando o cutover já
rodou — mas, sem cron algum, **nenhum dos dois caminhos roda hoje em
produção**, migrado ou não.

### Duas estratégias possíveis

- **Caminho A (recomendado):** executar
  `scripts/migrar-automacoes-hardcoded.ts -- --aplicar`, que chama
  `migrarAutomacoesHardcodedBpm` (`migracao-hardcoded.ts:149-195`). Essa
  função cria/atualiza `BpmAutomacao`/`BpmAutomacaoVersao` para os 9
  comportamentos hardcoded (fechamento comercial, nota fiscal, follow-up de 8
  dias úteis em 3 etapas, 5 ligações diárias, Standby semanal, Monitoramento
  mensal, polling de transcrição do Meet, e um `Alertas de tarefas — <pipeline>`
  por pipeline ativo), tudo dentro de transações Prisma com auditoria
  (`BpmPipelineConfigAuditoria`) e ativação atômica em lote. O cron do motor
  central (`/api/bpm/jobs/automacoes`) já está agendado — nenhuma mudança em
  `vercel.json` é necessária. **É mutação em massa sobre automações de
  produção → exige checkpoint Vault com backup pre-change verificado e
  aprovação específica antes de `--aplicar`.**
- **Caminho B (fallback, requer DevOps):** adicionar
  `/api/bpm/jobs/automacao-novos-leads` e `/api/bpm/jobs/alertas-tarefas` a
  `vercel.json`. É alteração de infraestrutura/CI-CD, autoridade exclusiva de
  DevOps (Constitution Art. II) — esta story apenas registra a opção, não a
  executa.

Caminho A é preferível: reaproveita mecanismo já pronto e testado, evita
manter dois sistemas de automação paralelos e não exige mudança de
infraestrutura.

### Dependências

`vercel.json`, `scripts/migrar-automacoes-hardcoded.ts`,
`src/lib/bpm/automacoes/migracao-hardcoded.ts`,
`src/app/api/bpm/jobs/{automacoes,alertas-tarefas,automacao-novos-leads}/route.ts`.

### Ambiente de validação

Após o cutover (Caminho A): uma execução real do cron `/api/bpm/jobs/automacoes`
processa o ciclo de follow-up/alerta correspondente; `GET` manual às rotas
legadas retorna `{ignorado:true, motivo:"MIGRADO_PARA_MOTOR_CENTRAL"}`.

### Evidência

Pendente — Caminho A é mutação em massa e não pode ser executado nesta fase
documental sem checkpoint Vault (relatório, backup `database-backups/pre-change/`
verificado ≤48h, aprovação humana explícita e específica).

### Rollback

`migrarAutomacoesHardcodedBpm` arquiva a versão anterior (`status: "ARQUIVADA"`)
em vez de apagá-la — reverter é reativar a versão anterior de cada
`BpmAutomacao` afetada (auditoria completa em `BpmPipelineConfigAuditoria`
preserva o estado anterior de cada mudança).

## Frente 5 — Tarefa vencida com alerta pendente

### Mecanismo confirmado

`executarAlertasTarefasBpm` (`src/lib/bpm/alertas-tarefas.ts:5-39`) busca
`BpmTarefa` com `status: "PENDENTE"`, `alertaEm <= agora`,
`alertaDisparadoEm: null`, marca o disparo dentro de uma transação
(`updateMany` condicional para evitar corrida) e registra
`TAREFA_ALERTA_DISPARADO` no histórico do card via `registrarHistoricoCard`,
notificando o pipeline em tempo real. Após o cutover da Frente 4, o mesmo
comportamento passa a ser coberto pela automação
`Alertas de tarefas — <pipeline>` (ação `MARCAR_ALERTA_TAREFA`) via motor
central, disparada pelo cron já agendado.

### Pergunta objetiva

Identificar a tarefa vencida específica citada no diagnóstico histórico
depende de consulta ao Turso real (`BpmTarefa.alertaDisparadoEm`), sem
ferramenta disponível nesta sessão.

### Dependências

`src/lib/bpm/alertas-tarefas.ts`, `src/app/api/bpm/jobs/alertas-tarefas/route.ts`
(legado) ou motor central pós-cutover (Frente 4).

### Ambiente de validação

Consulta ao histórico do card da tarefa identificada deve mostrar o evento
`TAREFA_ALERTA_DISPARADO` após a execução do job correspondente.

### Evidência

Pendente — depende da Frente 4 (job precisa estar rodando) e de acesso ao
Turso real para identificar a tarefa.

### Rollback

Não aplicável — `executarAlertasTarefasBpm`/`MARCAR_ALERTA_TAREFA` apenas
marcam um timestamp e registram histórico; não há mutação destrutiva a
reverter.

## Nenhuma alteração de banco autorizada por esta story

Esta story documental **não autoriza** nenhuma migration, mutação em lote
(cutover de automações) ou atribuição de permissão em massa fora da UI
administrativa padrão. Qualquer operação de mutação em massa (Caminho A da
Frente 4, ou atribuição de `SetorPermissao`/opções de campo em lote fora da
UI) exige checkpoint Vault próprio em fase futura, com: relatório completo,
backup `database-backups/pre-change/` verificado (≤48h) e aprovação explícita
e específica do administrador — antes de qualquer operação dependente.

## Responsáveis e dependências externas

| Papel | Responsabilidade nesta RM | Quando aciona |
|---|---|---|
| PM/dono do produto | Fornecer os valores exatos das opções das 10 seleções (Frente 2) | Antes da implementação da Frente 2 |
| Administrador do sistema | Confirmar/ajustar `SetorPermissao` e `BpmPipelineSetor` via `/PainelAlpha/cadastro` (Frente 1) | Antes da validação da Frente 1 |
| Vault | Checkpoint de mutação em massa (cutover de automações, Frente 4 Caminho A) | Antes de `--aplicar` |
| DevOps | Autoridade sobre `vercel.json` (Frente 4 Caminho B, se necessário) | Se o cutover não puder ser aplicado nesta janela |
| Scribe (esta fase) | Este artefato documental | Fase 2 |

## Critérios de aceite

| # | Critério | Evidência local | Pendência para fase de implementação |
|---|---|---|---|
| 1 | Acesso Comercial/Operacional aos pipelines do próprio setor, sem bypass Admin/CEO/TI | Mecanismo de código confirmado correto (`ownership.ts`) | Confirmar/ajustar dado real (`SetorPermissao`/`BpmPipelineSetor`) e validar login não-admin |
| 2 | As 10 seleções renderizam opções reais e salvam valor válido | Mecanismo de persistência confirmado (`opcoesJson` via `AtualizarCampoBpm`) | Obter valores de negócio aprovados (pergunta objetiva) e popular via UI |
| 3 | Modal "Em tratativa" reflete o estado real do follow-up | Cadeia de callback confirmada íntegra no código | Confirmar composição da etapa inclui `follow-up-checklist`; smoke de UI real |
| 4 | Jobs de novos leads e alertas rodando em produção | Causa raiz e mecanismo de cutover confirmados | Checkpoint Vault + aprovação específica antes de `--aplicar` (Caminho A) |
| 5 | Tarefa vencida com alerta pendente processada e auditável | Mecanismo de disparo/histórico confirmado | Identificar a tarefa no Turso real e confirmar evento após a Frente 4 |

**Nenhum critério pode ser marcado como atendido por leitura de código
isolada** — cada um exige confirmação de dado vivo e/ou execução real,
registrada nas fases seguintes (implementação/Vault/Forge/Probe).

## Auditoria de entregabilidade (por frente)

- Frente 1: consumidor final é o usuário do setor Comercial/Operacional,
  acessando `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` pelo menu já
  existente; a entrega já é consumível assim que o dado (`SetorPermissao`/
  `BpmPipelineSetor`) estiver correto — nenhuma tela nova é necessária.
- Frente 2: consumidor final é qualquer usuário preenchendo o formulário do
  card; a entrega já é consumível assim que `opcoesJson` estiver populado —
  nenhuma tela nova é necessária.
- Frente 3: já consumível hoje (código correto); depende apenas de dado de
  composição.
- Frente 4: consumidor final é o próprio sistema (execução automática); a
  "entrega" é o cron rodando de fato, não um artefato de código adicional —
  Caminho A não precisa de nenhuma tela nova, pois reaproveita o motor central
  já com UI de acompanhamento (aba Automações, RM-2026-35A772).
- Frente 5: consumidor final é o usuário que audita o histórico do card
  (`PainelHistorico`, já existente); nenhuma tela nova é necessária.

Nenhuma das 5 frentes exige novo visualizador, rota, botão ou exportação —
todas reaproveitam superfícies já entregues em RMs anteriores. Não há
`AUTO_ADJUSTMENT_REQUIRED` de infraestrutura de entrega nesta story; os
`AUTO_ADJUSTMENT_REQUIRED` registrados são de **dado/valor de negócio**, não
de capacidade de consumo.

## Checklist por fase

- [x] Fase 0 — Auditoria somente leitura concluída (PASS com ajustes).
- [x] Fase 1 — Blueprint técnico revalidado no código atual (PASS com ajustes).
- [x] Fase 2 — Este artefato (story) criado, com as 5 frentes, matriz,
      perguntas objetivas e auditoria de entregabilidade.
- [x] Fase 3 — Checkpoint Vault produzido: Frentes 1, 2, 3 e 5 classificadas
      como CRUD normal (checkpoint de banco não se aplica); Frente 4 Caminho A
      (cutover de automações) classificada como mutação em massa, com
      relatório completo em `.bibble/memory/architecture.md`. Status
      `WAITING_APPROVAL` — sem comprovante de aprovação específica e sem
      backup gerado/verificado nesta sessão (sem ferramenta de shell/banco
      disponível). Nenhuma mutação executada. Oito reexecuções posteriores
      da mesma fase apresentaram "comprovantes" de worker automatizado que
      apenas ecoavam o `RESULT: BLOCKED` da tentativa anterior como "plano
      aprovado" — todas revalidadas e recusadas como aprovação humana
      específica (ver `.bibble/memory/architecture.md`); status
      `WAITING_APPROVAL` mantido em todas as doze invocações.
- [ ] Fase 4+ — Implementação de dado (Frentes 1/2/3 via UI existente),
      geração/verificação do backup pre-change e aprovação específica para o
      cutover de automações (Frente 4), validação da Frente 5 pós-cutover,
      gates reais (Forge/Probe/Anubis/Lens).

## File list

- `docs/stories/story-rm-2026-eb7b58-restaurar-operacao.md` (atualizado, Fase 3 — décima segunda invocação)
- `.bibble/memory/architecture.md` (atualizado, Fase 3 — checkpoint Vault, décima segunda invocação)

## Encerramento da execução mesclada — 2026-09-22

A aprovação humana específica foi recebida após backup completo verificado.
O estado vivo de produção foi reconciliado e relido após a aplicação:

- [x] Permissão `crm` presente para `COMERCIAL` e `OPERACIONAL`.
- [x] Sete seleções realmente vazias receberam os catálogos aprovados (36 opções).
- [x] Callback do follow-up preservado e coberto pela suíte BPM.
- [x] Treze automações hardcoded migradas e ativas no motor central; cron central já configurado.
- [x] Zero tarefas vencidas pendentes no snapshot pós-cutover.
- [x] Typecheck, lint BPM, 927 testes BPM e build aprovados.

File list complementar: `scripts/bpm-reconciliar-objetivos-mesclados.mjs`,
`src/lib/bpm/automacoes/migracao-hardcoded.ts`, `package.json` e esta story.
Backup/rollback: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-22T13-38-30-357Z.{sql,manifest.json}`
(ignorado pelo Git). RESULT: PASS; pronto para **Em testes**.
