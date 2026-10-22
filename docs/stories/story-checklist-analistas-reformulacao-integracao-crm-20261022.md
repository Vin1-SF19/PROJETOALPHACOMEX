# Story — Reformular CheckList por analistas e integrar dossiê ao CRM

## Status

In Progress — **implementação local PASS / READY_FOR_APPROVAL**, com gates reais dos dois aplicativos e revisões Probe/Flux, Anubis e Lens concluídos; B01, B02, regressões de integração/gates e LENS-01 fechados. **Integração local Radar aprovada pelo Forge:** Main584856ebac7760707baf60853b28eb870515b239, typecheck/lint/test/build PASS,737 arquivos/5958 testes PASS; Portal7d12f74 e fontes da feature intactos. **Vault/DevOps: consentimento específico recebido (“sim”, observado20:16:25UTC); schema aditivo, bootstrap3 e grant5 APLICADOS com guardasCLI e pós-verificação readonly preservando dados/ownersNULL/acessos. Hash2 consentido continua condicionado ao rollout e liberação por provas reais.** Fase hash já corrigida, plano1bd13b1a… vigente. **Publicação/homologação PENDENTE:** credencial privada Blob, Portal staging READY, provas do leitor/escritor/cessação antiga, hashbatch condicionado ao plano vigente e validação autenticada no staging. Não marcar Done antes dessas provas. Os adendos abaixo preservam a cronologia; falhas e pendências já encerradas em rodadas posteriores não são bloqueios locais atuais.

## Executor Assignment

executor: "Bibble — coordenação serial dos especialistas"
quality_gate: "@qa — independente dos executores"
quality_gate_tools: ["matriz A01–A17", "testes dos dois projetos", "lint", "typecheck", "test", "build", "Vault", "verificação staging/compatibilidade"]

## Story e fontes normativas

Como equipe Operacional, quero organizar o CheckList por analista, consultar empresas globalmente com escrita controlada pelo dono/liderança e vincular explicitamente seus dossiês aos cards CRM, para acompanhar documentos com integridade, histórico e compatibilidade com o portal.

Escopo aprovado pelo usuário: **todas as correções A01–A17**, duplicações, sidebar de analistas à esquerda/empresas à direita, regras de ownership e integração **CRM B**, preservando procedimentos BPM/Excel. O contrato [Aria](../architecture/checklist-analistas-crm-20261022.md), §§1–14, é normativo e integra estes critérios; **§14 prevalece sobre transporte Pusher/timer e ordem de rollout anteriores**. A [auditoria](../reports/auditoria-alpha-checklist-2026-10-22.md) fornece evidências históricas dos achados, não substitui as decisões posteriores de Aria nem afirma correções publicadas.

Bases preparadas: Painel `69047dee` em `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/checklist-analistas-20261022`; Portal `edcf2e8e` em `/home/ialpha/projetos/alpha-comex/painelclientes-worktrees/checklist-analistas-20261022`. Revalidar SHAs/estado antes de implementar. Blueprint auxiliar: `/tmp/checklist-analistas-20261022-scout-blueprint.md`.

**Autorização:** preparar código/migrations/dry-runs nos worktrees e testes sintéticos; staging primeiro. Nenhuma promoção de produção autorizada. Pedido de implementar tudo **não é consentimento específico de banco** após apresentação do plano. Antes de qualquer schema/migration/backfill de hashes, remoção de Teste ou movimentação/deleção de objetos reais: Vault, ambiente/steps/impacto/alternativa/rollback, backup completo verificado de até 48h e confirmação explícita específica. Sem aplicação real antes disso.

## Acceptance Criteria

1. **Identidade e owner:** distinguir `Cliente.id` Int (master), `OperacionalClientes.id` String (atendimento) e `ClienteOperacional.id` String (conta externa). FK `analistaId` nullable no legado com `SetNull`/índice e revision agregada; sem inferência de dono por pasta/nome/CNPJ, sem unique por master que impeça atendimentos legítimos. Novos atendimentos exigem dono explícito segundo Aria §§1/4/6.
2. **ACL persistida:** ator interno ativo, sessão e permissão efetiva `checkList` revalidados; leitura global autorizada. Escrita somente owner ou `Lider Operacional` persistido, sem bypass Admin/CEO/TI/Comercial. Só Líder Operacional reassocia owner e gerencia modelos. Analista ativo dos setores normalizados Operacional/Analista Operacional cria para si; líder escolhe elegível. Legado sem dono só líder escreve. Backend governa todas páginas/actions/API/Pusher/streams; UI consome capabilities.
3. **Analistas/UI:** sidebar esquerda começa por Todos os analistas; catálogo independente dos usuários elegíveis inclui zero empresas e entradas legadas referenciadas/inativas identificadas, sem listar administradores indiscriminadamente. Empresas à direita; Todos inclui owner null; pendentes de atribuição visíveis ao líder. Filtros/paginação/contagens server-side e estados de erro/vazio distintos; responsive Sheet, tema, Dialog/AlertDialog/Avatar, foco/labels/teclado existentes.
4. **Pastas:** retirar filtro virtual Sem Pasta e navegação por pastas sem apagar dados. Teste é operação real separada sob Vault: confirmar identidade, desconectar relações e preservar empresas/checklists/documentos. Demais pastas legadas permanecem nos dados e não determinam owner.
5. **Núcleo único:** implementar serviços/DTO/schemas/ACL/leituras conforme Aria §§2–4, envelope Result com requestId/códigos públicos seguros, PATCH omitido preservado/null explícito limpa, CAS e mutationId idempotente com payload divergente em conflito. Criação/seleção/troca de tipo transacionais; leitura não cria; resolver ativo exato sem primeiro/fallback; tipo vazio retorna MODEL_EMPTY. Comando/evento/auditoria/notificação atômicos, no-op sem aviso e publicação somente póscommit.
6. **Modelos e snapshots:** catálogo revisionado/imutável, ativação/desativação/ordem/autoria; identidade escopo+código normalizado com específico prevalecendo sobre global. Colisão no mesmo escopo rejeitada. Novos modelos afetam somente instâncias futuras; instâncias anteriores mantêm snapshots. Diagnóstico legado sem fusão automática nem backfill retroativo de itens. Progresso/enum/labels/fórmula únicos; 100% não equivale a workflow concluído.
7. **Portal compatível:** schema canônico master do Painel e modelos runtime Portal em paridade, sem ressuscitar layout antigo por db push. Fingerprint somente leitura; transição de layout divergente exige plano/migration separada autorizada. Runtime preserva os 11 status existentes, incluindo `FALAR_DR_EDVAN`/`FALAR_ANDREW` como legados; novas escolhas usam os 9 atuais, só OK/DESNECESSARIO completos. Autorização externa por `clienteOperacionalId`, sem poderes internos de owner/item/tipo/modelo.
8. **Credenciais:** Portal lê bcrypt primeiro, admite legado apenas com hash null e upgrade CAS; Painel escreve bcrypt fator12 com senha vazia. Geração criptográfica mínimo12, exibição única quando necessária, reset por token expirável/uso único e limitação de tentativas/resposta neutra. Nunca segredo no DTO/log. Rollout primeiro leitor Portal compatível, depois escrita hash Painel; sem rehash em lote sem Vault.
9. **Documentos/ZIP:** upload PDF/JPEG/PNG até8MiB, ownership/tipo ativo/magic bytes/recibo hash consumível idempotente, sem URL/autoria arbitrária. Novos arquivos em store privado isolado; download autenticado/no-store e allowlist real de legado, sem inventar hostname. Softdelete com ator real e primeira data preservada, restauração explícita autorizada, histórico/auditoria. ZIP por escopo ATIVO/TODOS ou histórico, nomes únicos e manifesto de falhas, streaming/abort/orçamentos conforme Aria §9:100 docs,25MiB legado/arquivo,100MiB agregado,45s global,concorrência3,fetch10s/redirect bloqueado. Proxy não privatiza URL pública antiga: A10 legado permanece pendente até cópia/verificação/invalidação autorizada.
10. **Eventos/notificações:** journal/outbox e leitura durável evento+usuário separados do motor BPM, recibos/eventos/notifications idempotentes. Produtor Portal existente é adaptado com seus consumidores. Poller único no shell, replay/recovery e dedup por eventId, toast por ID incluindo51º, clique marca lido no servidor, cleanup não derruba outro consumidor. **Aria §14 vigente:** CheckList usa somente journal/polling autenticado6s visível/30s oculto, zero subscribe/trigger Pusher; worker Bearer-first em polling retorna processed0 sem DB/rede/claim/retry. Preparação outbox permanece inativa, sem marcar publicadoEm fictício; não instalar/habilitar timer/cron nem --once remoto. Portal mantém SSE próprio e leitura separada.
11. **CRM B:** card tem vínculo explícito zero/um atendimento, atendimento pode ser reutilizado por vários cards do mesmo master; segue tipo ativo. ACL de leitura do card+CheckList e escrita nos dois recursos para vincular/desvincular; candidatos paginados sem autoescolha. Rejeitar cross-master e troca de master com vínculo silencioso. PainelDossieChecklist no modal existente mostra owner/resumo/pendências/estados e abre módulo com identidade operacional/foco corretos. Não copia itens/arquivos nem conclui tarefa/move etapa por100%; Procedimentos BPM, Excel e monitores permanecem independentes.
12. **Cobertura e encerramento:** cada linha da matriz abaixo tem implementação e regressão observável; funções duplicadas consolidadas somente após busca de callers. Todos gates reais dos dois projetos e revisão de integração/segurança executados. Preparação de migration não comprova aplicação: registrar gates, SHA, READY/alias/smoke, compatibilidade portal e dados aplicados após consentimento. Sem Done se código/gates/aplicação obrigatória faltarem; dependências bloqueadas ficam explícitas.

## Rastreabilidade integral e cenários de aceite

| Escopo | AC / Aria | Regressão mínima verificável |
| --- | --- | --- |
| A01 acesso | 2 / §§2,12 | Sem sessão/módulo, outro owner, admin sem bypass, revogação e chamadas diretas |
| A02 observação | 5 / §4 | PATCH status preserva texto; null limpa; CAS não sobrescreve concorrência |
| A03 senha/schema | 7–8 / §8 | Hash/legado/reset/conta alheia; runtime master/11status; sem segredo DTO |
| A04 ativo/progresso | 5–6 / §3 | Duas ordens de coleção e A→B→A; lista/detalhe/portal/CRM concordam |
| A05 parcial/duplicação | 5,10 / §§4,7 | Falha transacional, no-op, replay mutationId e payload divergente |
| A06 modelo parcial | 6 / §5 | Erro/retry/colisão/concorrência sem catálogo parcial |
| A07 propagação | 6 / §5 | Antiga preservada, futura usa revisão/ordem, desativação sem reabrir100% |
| A08 atendimentos | 1,5 / §4 | Mesmo mutationId cria1; intenção nova permite outro; master≠conta |
| A09 ZIP | 9 / §9 | Nomes repetidos/sanitização, bytes sem length, deadline, manifesto parcial |
| A10 documentos | 9 / §9 | Recibo repetido, URL forjada/cross-company/redirect, privado e plano legado |
| A11 histórico | 5,9 / §§4,6 | Antes/depois/ator real; softdelete retry; restauração explícita |
| A12 escala | 3,5 / §3 | Filtros/page/count consistentes, catálogo>500 sintético, sem overfetch |
| A13 estado tela | 3,5 / §3 | Vazio→criar, A→B→A, IDs/seção corretos, rascunho salvar/descartar |
| A14 falso sucesso | 3,5 / §§3–4 | Result erro/rejectedPromise, finally/rollback, doc permanece na falha |
| A15 wizard | 1,5 / §4 | A→digitarB invalida seleção, consultas invertidas, retry sem órfãos |
| A16 avisos | 10 / §7 | Shell+widget um áudio/toast,51º,replay/remount/reconnect/lido durável |
| A17 histórico/erro | 3,5,9 / §3 | Falha≠vazio, histórico readonly não muda ativo/cache, ZIP escopo |
| Duplicações | 5–6,12 / §4 | Serviços/fórmula/enums únicos; callers confirmados; BPM não removido |
| Analistas | 1–3 / §1 | Todos/zero/null/legado/inativo; owner/líder escreve, apenas líder reatribui |
| Pastas | 4 / §1 | Sem Pasta sai UI; Teste só após Vault; empresas/docs preservados |
| CRM B | 11 / §10 | Cross-master negado,2cards/1dossiê,sem autoescolha/efeito em task/etapa |

## Fases e checklist de execução serial

- [x] @sm: ler contrato Aria/blueprint/auditoria e validar story-draft-checklist, mantendo decisões e dependências.
- [x] **Dara:** schemas/migrations aditivas nos dois repos, diagnóstico/fingerprint/órfãos/conflitos, dry-run/rollback/paridade11status em SQLite sintético; nenhuma execução real (AC1,5–10). Validate/generate6.19.3 e lint focado dos dois PASS; Painel14/14 e Portal3/3 PASS; ver `docs/data/checklist-analistas-20261022.md`.
- [x] **Echo:** backends dos dois apps, ACL/serviços/DTO/CAS/events/modelos/portal/hash/recibos/download/ZIP/adaptadorCRM e testes próximos, conforme contrato (AC1–11). Handoff `docs/backend/checklist-analistas-api-20261022.md`; Painel37 testes (23backend +14dados) e Portal13 (10backend +3dados) PASS; ESLint focado ambos sem warnings e diff-check PASS. Gates globais, revisão integral e aplicação real ainda pendentes.
- [x] **Nova + Iris:** sidebar analistas/empresas, páginas/estados/wizard/modelos/histórico, Portal compatível, shell/avisos e painel CRM; sem ACL inventada no cliente (AC2–4,6–11).
- [x] **Sage:** suíte causal/regressão integral pela matriz, fixtures/SQLite/streams; evidência executada e lacunas explícitas (AC12).
- [x] **Forge:** lint/typecheck/test/build reais Painel e equivalentes Portal PASS, incluindo build Main independente pós-LENS-01; lineage adotada explicitamente sem repetir gates intactos.
- [x] **Probe → Anubis → Lens:** integração em fixtures, custo dos builds, segurança/auth/storage/ZIP e revisão de código concluídos. B01/B02/LENS-01 e regressões dos gates fechados;0 achados locais abertos. Não equivale a E2E autenticado remoto.
- [x] **Vault documental:** plano concreto das quatro operações staging, backup completo verificado≤48h, impactos/alternativa/rollback e pedido de consentimento preparados no adendo final de `docs/vault/checklist-analistas-20261022.md`; Teste/objetos excluídos pelo préestado0.
- [x] **Vault consentimento:** usuário respondeu literalmente “sim” ao plano específico das4operações staging; evidência real registrada foraGit, preflight sem drift/backup válido e3pares consent/Vault emitidos.
- [ ] **DevOps aplicação3:** executar schema/bootstrap3/grant5 somente com guardasCLI/backup/CAS/préestado confirmados. Hash consentido ainda bloqueado até provas reais de leitor/escritorREADY e cessação antiga; nenhuma aprovação hash emitida.
- [x] **DevOps local:** inventário seletivo/commits feature Main62d1c154 e Portal7d12f74; scanner sem segredo real, exclusões/escopos verificados. Merge mecânico local ab278f13 preserva ambos os históricos; File List consolidada abaixo.
- [x] **Forge após integração/Main:** quatro gates reais PASS na árvore integrada,737arquivos/5958testesPASS; evidências pré-merge preservadas, Portal intacto adotado sem repetição.
- [ ] **DevOps operacional:** Blob403 exige ação humana/login legítimo e resposta efetiva; PortalREADY/origens/runtime efetivo ainda pendentes antes de push/preview autorizado.2overridesDBMain somente custom staging agora usam alvo staging conhecido verificado; originais production/preview preservados. CheckList usa polling§14, sem novo Pusher nem timer.
- [x] **DevOps DB3:** schema67statements/bootstrap3/grant5 aplicados exclusivamente staging, exatos planos/guardas/Vault/consentimento/backup; preservação de dados/4ownersNULL/acessos comprovada após cada operação.
- [ ] **DevOps rollout/hash:** PortalreaderREADY antes PainelhashwriterREADY/cessação antiga, depois hash2 consentido sob liberação/provas reais; Blobstep-up/origins/homologação continuam pendentes.
- [x] **QA readiness independente:** confrontar AC1–12/A01–17 e evidências atuais; implementação local PASS/READY_FOR_APPROVAL, nenhum critério de código sem entrega demonstrado. Ver consolidação final e matriz.
- [ ] **QA homologação:** conferir aplicação autorizada/compatibilidade real, SHA/READY/aliases/sessões legítimas e round-trip privado no staging. A10 legado staging N/A provisório por0docs/0fotos, revalidar; nenhuma afirmação de revogação/fechamento em produção. Sem Done antes da homologação.
- [ ] **Scribe/Kowalski:** atualizar mapas/memória/journal após entrega comprovada; fechar checklist/File List/evidências e manter produção sem promoção.

A ordem acima é serial; pré-condições de ambiente/backup prevalecem sobre a posição nominal de DevOps/Vault. Planejar código é permitido antes do consentimento; ativar schema, hash em massa, Teste ou objetos reais não é.

## Notas de desenvolvimento, testes e rollback

Aria §§2–11 define arquivos, assinaturas, limites e ownership; não duplicar o relatório. Serviços server-only em `src/lib/checklist/{acesso,schemas,types,service,leitura,modelos,items,eventos,documentos}`, adapter `src/lib/bpm/checklist-documental.ts` e `CardModal/PainelDossieChecklist.tsx`; actions legadas tornam-se fachadas compatíveis. Sem novo módulo/menu nem depósito de eventos em filas BPM. Portal atualiza auth/actions/upload/download/notificações/schema/projeções sob o mesmo contrato, sem restaurar layout antigo.

Usar fixtures isoladas para todos positivos/negações,20+ eventos e51ºtoast, catálogos>500, streams sem content-length/abort e concorrência CAS/replay. Nenhum teste altera registros reais ou envia dados reais a storage público. Limites/segredos/tokens não entram nos logs. Rollback deve preservar snapshots/eventos/hash: não voltar leitor plaintext após contas hash e não fazer DROP automático. Schema/dados/objetos só revertem por plano Vault aprovado. Backup produção não é seed staging.

## CodeRabbit Integration e validação da preparação

Tipo full-stack/segurança/dados; complexidade alta. @dev/Echo/Nova Pre-Commit com revisão/gates; @qa cobertura integral; DevOps Pre-PR/Pre-Deployment com escopo/segredos/rollback. CodeRabbit quando disponível; ausência exige revisão alternativa registrada. Self-healing @dev light2iterações/15min CRITICAL, HIGH documentado; @qa full3/30min CRITICAL/HIGH, MEDIUM dívida; DevOps check somente reporte.

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado autonomamente: objetivo/contexto PASS; orientação técnica PASS pelo contrato normativo; referências PASS; autocontenção PASS com defaults explícitos; testes PASS pela matriz; CodeRabbit PASS. **READY, clareza9/10.** Os defaults Aria foram aceitos como decisões de produto informadas pelo coordenador; não são autorização de banco. `accumulated-context.md` e gotchas não estavam disponíveis nas preparações anteriores; esta story usa contexto normativo/relatório/blueprint atual, sem inferir conclusão de implementação.

## Dev Agent Record / File List

- Preparado: `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md`, no worktree e cópia documental no checkout principal para revisão.
- Fontes lidas, não alteradas pela preparação: contrato Aria, relatório de auditoria, blueprint Scout.
- Previstos Painel: `prisma/schema.prisma`, migrations/scripts dry-run; actions checklist/modelos/ClientesOperacional; módulos lib acima; páginas/componentes CheckList; ZIP/download/eventos/readstate; hook/store/central/shell; painelCRM; testes correspondentes.
- Previstos Portal: schema/migrations compartilhadas quando pertinentes, auth/actions checklist/notificações, upload/download, UI checklist e testes/scripts de verificação nos caminhos definidos por Aria/Dara/Echo. Manter File List real por repo, artefato de migration separado da evidência de aplicação e relatório Vault/consentimento referenciados após existirem.

### File List real — Dara

Painel: `prisma/schema.prisma`, `prisma/checklist-schema.contract.json`, `prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql`, `scripts/checklist-analistas/lib.mjs`, `scripts/checklist-analistas/cli.mjs`, `scripts/checklist-schema-parity.mjs`, `tests/checklist-analistas/fixtures/base-checklist.sql`, `tests/checklist-analistas/schema.contract.test.ts`, `docs/data/checklist-analistas-20261022.md`.

Portal: `prisma/schema.prisma`, `prisma/checklist-schema.contract.json`, `scripts/checklist-schema-parity.mjs`, `tests/checklist-schema-parity.test.mjs`. Opcional nativo local0.5.29 recuperado somente em node_modules; package/lock/env preservados. Nenhuma aplicação real; CLI não altera o ledger `_prisma_migrations`, cuja reconciliação cabe ao plano Vault/DevOps.

### Handoff real — Echo

Contrato e nomes de API/client DTO/upload4passos/env estão em `docs/backend/checklist-analistas-api-20261022.md`; evidências locais `/tmp/checklist-analistas-20261022-echo-implementation.md`, `/tmp/checklist-echo-backend-tests-final.log` e `/tmp/checklist-portal-backend-tests-final.log`. Testes novos usam SQLite/streams sintéticos; nenhum DB/config/store/objeto real alterado. Upload privado usa `CHECKLIST_PRIVATE_BLOB_TOKEN`, sem trocar o token Blob global. Typecheck exploratório não é gate PASS; cinco linhas transitivas auth.ts no Painel e consumidores UI legados Portal seguem para a verificação global após Nova. Lista real de arquivos backend será consolidada pelo diff da entrega; não confundir código implementado com A10 legado ou deploy verificado.

## QA Results

**Implementação local PASS / READY_FOR_APPROVAL** na revisão independente de readiness, com rastreabilidade integral na [matriz QA](../qa/matriz-checklist-analistas-20261022.md) e relatório `/tmp/checklist-analistas-20261022-qa-readiness.md`. Main global735arquivos/5953PASS+4skip/1todo preexistentes, typecheck/lint PASS e build independente pós-fix58,32s/86páginas; Portal typecheck/lint/build PASS e57+3testes adotados por fonte intacta. Probe/Flux, Anubis e Lens aprovados;0 achados locais abertos. CodeRabbit indisponível, revisões alternativas independentes registradas. **Publicação/homologação PENDENTE:** não há DDL/bootstrap/grant/hashbatch aplicados, Portal staging READY ou round-trip Blob privado; não há consentimento específico de banco nem homologação autenticada remota. Story In Progress, produção intocada. Relatórios anteriores são históricos e não substituem este estado consolidado.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Story abrangente executável com matriz integral e fases seriais | River (@sm) |

### Handoff real — Nova/Iris

UI Painel e Portal implementada, inclusive sidebar Analistas/empresas, modelos, histórico, notificações únicas e painel de vínculo CRM. Painel12 testes UI PASS; Portal8 testes upload/helper PASS e typecheck completo PASS. Lint focado ambos PASS. Componentes reais exercitados em Chromium com fixtures desktop/mobile, sem exceções ou overflow; não equivale a E2E autenticado. Arquivos/evidências em `/tmp/checklist-analistas-20261022-nova-implementation.md`. Gate Nova continua aberto até concluir proteção integral de rascunhos, isolamento de cache Portal na troca de ator e retenção da seleção de conta fora da página atual; endpoint avatar segue correção Echo. Nenhuma aplicação real ou publicação feita.

### Integração e infraestrutura local — DevOps

Checkpoint seletivo local `add03a89`; merge sem conflitos de staging `d7580d07` em `a950f33e`, preservando correção de observadores TI/Admin. Nenhum push/deploy. Scheduler staging preparado (não instalado): `scripts/checklist-analistas/staging-worker.mjs`, `ops/systemd/checklist-eventos-staging.{env.example,service,timer}`, `tests/checklist-analistas/staging-worker.test.ts`, `docs/ops/checklist-analistas-staging-20261022.md`. Oito testes causais PASS; lint, TS estrito focado, syntax e systemd verify PASS. Handoff `/tmp/checklist-analistas-20261022-devops-integration.md`.

Preflight somente leitura confirmou banco staging canônico distinto de produção, migration NOT_APPLIED,4 atendimentos/6 checklists/10 itens/3 modelos sem colisão/2 contas legadas. Zero documentos, fotos legadas ou pasta Teste: nenhuma cópia/revogação/exclusão necessária nesta fotografia; revalidar antes de aplicar. Líder Operacional existe sem acesso CheckList; plano setorial deverá preservar4 módulos antigos e acrescentar CheckList (5 vínculos, snapshot/CAS). Hashbatch de2 contas e concessão setorial precisam código guardado, Vault/backup/consentimento. Portal staging/Blob privado/Pusher isolados e comprovação do runtime permanecem pendentes; nenhum override alterado.

### Fechamento Nova — guarda, cache e wizard

Três lacunas core do primeiro handoff corrigidas e verificadas: rascunhos de item/metadados/documento com save sequencial e revisão confirmada; handshake opt-in para fechamento da aba sem afetar outros módulos; cache Portal por conta+versão com cancelamento de respostas antigas/fechamento SSE e gating de props; conta selecionada retida fora de página/busca, reset de novo cadastro e botões de paginação sem submit acidental. Painel17/17 testes PASS e lint focado PASS; Portal11/11 PASS, typecheck completo e lint focado PASS. Main TS focado manteve5 diagnósticos auth.ts transitivos; gate global ainda pendente. Handoff `/tmp/checklist-analistas-20261022-nova-followup.md`.

File List Nova: componentes `src/components/checklist/{AnalistasSidebar,AtendimentoSettings,ChecklistExport,ChecklistItemCard,ChecklistProvider,ChecklistUI,DocumentosItem,HistoricoAtendimento,ModelosWorkspace,NovoAtendimentoDialog,ChecklistDraftGuard}.tsx` e `useChecklistCommand.ts`; `src/lib/checklist/client/{types,upload,notificacoes}.ts`; `src/hooks/useChecklistFrameGuard.ts`; páginas CheckList/lista/detalhe/modelos/histórico; shell/central/hooks/store de notificações; `CardModal/PainelDossieChecklist.tsx` e montagem; testes `tests/operacional/checklist-frontend.test.tsx`/fixtures e config Vitest incluindo test.tsx. Legados substituídos/removidos listados no diff e primeiro handoff, após busca de callers. Portal páginas/clients checklist/perfil/login/reset/home/layout, Providers/header/notificações, helpers upload/Result; `tests/checklist-upload-client.test.ts`, `tests/portal-session-cache.test.tsx`; pacote/lock ReactQuery5.102.8 e happy-dom20.14.5 dev. Nenhuma fonte foi copiada aos checkouts principais sujos.

### Operações guardadas — Dara2

CLI preparou hash-contas e habilitar-lider-checklist, com planos pré-DDL, ambiente/fingerprint/Vault/consentimento/backup restaurado<=48h. Hash exige prova real do leitor Portal staging READY, bcrypt12+senha vazia atômicos/CAS e sessão preservada. Permissão mantém4 tokens antigos e acrescenta CheckList, snapshot de todos usuários do role/inativos/overrides/setor/catálogo/resolver; divergências bloqueiam. UpDocumentos é token legado fora do registry, preservado sem criar módulo. Nenhuma aplicação real.

17 novos testes+14 contratos=31PASS; TS estrito focado/lint/syntax/paridade/diff PASS. Arquivos: scripts/checklist-analistas/{lib,cli,operations}.mjs; tests/checklist-analistas/operations.test.ts, fixtures/permissions.sql, node-sqlite.d.ts; docdata. Handoff /tmp/checklist-analistas-20261022-dara-operations.md. Portal/schema/actions/UI/auth/worker/env intactos; provas reais e consentimento continuam pendentes.

### Revisão Sage — bloqueio B01 em correção

Sage reproduziu defeito do novo Portal ainda local: reset/perfil aceitam mais de72bytes UTF-8 e bcrypt compara somente o prefixo. Nova regressão tests/password-byte-boundary.test.ts:6FAIL/3PASS, com biblioteca e actions reais. Echo corrige backend/compatibilidade de legado, depois Nova alinha UI e Sage retoma. Matriz docs/qa/matriz-checklist-analistas-20261022.md e handoff /tmp/checklist-analistas-20261022-sage.md. Duas suítes operacional legadas ainda precisam migração para o contrato atual; nenhuma foi removida/ignorada. CodeRabbit indisponível localmente, revisão independente Anubis/Lens permanece. Gates gerais e aplicação real não aprovados.

### Correção B01 — backend e formulários

Echo corrigiu a política UTF-8 compartilhada: novas senhas mínimo12caracteres/até72bytes, hashes recusam candidatos truncáveis e hash inválido/vazio não admite fallback. Legados longos preservam login exato sem upgrade truncado; até72bytes mantém CASbcrypt12.37 testes Portal PASS, incluindo9 regressões Sage preservadas e12 novos casos. Nova migrou reset para RHF+Zod e isolou a senha do perfil;8 testes UI PASS, full Portal TS/lint/diff PASS. Senha atual150 preservada, nenhum corte silencioso e falhas mantêm campos. Duas fotos autenticadas usam URL direta com unoptimized; getImageProps real e lint verificados. Sage retomou a revisão independente; matriz/gates globais ainda pendentes. Handoffs /tmp/checklist-analistas-20261022-{echo-password,nova-password}.md.

File List B01 Portal: lib/auth/{password-policy,password-form,credenciais}.ts; actions/{seguranca,perfil}.ts; auth.ts; app/redefinir-senha/page.tsx; app/(autenticado)/perfil/PerfilClient.tsx; components/perfil/AlterarSenhaForm.tsx; components/PortalHeader.tsx; tests/{password-byte-boundary,password-legacy-compat}.test.ts e password-forms-ui.test.tsx; package/lock react-hook-form7.84.0 e resolvers5.7.1. Doc API Painel adendo. Nenhuma alteração real de banco/configuração ou deploy.

### Revisão independente Sage — READY_FOR_GATES

B01/B02 fechados, nenhum outro defeito core na rodada. Painel22 arquivos/155PASS: ACL/CAS concorrente/replay/claim, catálogo501/snapshots/desativação/ordem, ZIP/abort/deadline/orçamentos, frames/lookups/falhas documentais/reset compartilhado/notificação única e8 suítes BPM. Portal57PASS+3paridade anteriores reutilizados, fontes intocadas desde a execução. Lint9arquivos PASS; TS focado apenas5diagnósticos auth.ts transitivos, gate global pendente. Handoff /tmp/checklist-analistas-20261022-sage.md e matriz QA. Cobertura READY_FOR_GATES; entrega final NEEDS_WORK até Forge/revisões/Vault/isolações/aplicação autorizada. CodeRabbit indisponível, Anubis/Lens pendentes.


### Aria — decisão focal de isolamento e ordem de rollout

A16 transportado por journal/polling único autenticado nesta entrega; app Pusher compartilhado não pode isolar namespace contra fallback da produção antiga. Contrato normativo novo §14 da arquitetura e /tmp/checklist-analistas-20261022-aria-isolation.md. Echo implementará helper puro/config failclosed, deny de prefixo CheckList no auth antes do fallback, worker polling sem rede/mutação; Nova removerá assinatura CheckList mantendo store e poller global. Nenhum timer ativo. Arquivos previstos desta correção: src/lib/checklist/realtime.ts, src/app/api/pusher/auth/route.ts, src/app/api/checklist/jobs/eventos/route.ts, src/hooks/useChecklistNotifications.ts, tests/checklist-analistas/realtime-isolation.test.ts e notifications-subscription.test.tsx; file list real a consolidar após implementação. Sem código por Aria e sem gate QA final. Rollout obrigatório pós-consentimento: schema/bootstrap/grant → leitor Portal READY → escritor Painel READY/cessar antigo plaintext → hashbatch legado → validar polling. Blob ainda requer step-up; nenhuma configuração/DB/deploy feito nesta estação.


### Echo — backend do isolamento por polling implementado

Conforme §14 da arquitetura: helper puro resolve somente polling (ausente/exato), valores outros falham fechados; auth Pusher valida strings e nega qualquer prefixo private-checklist antes de ACL/Admin/fallback; worker mantém Bearer constant-time primeiro e retorna processed0 sem importar publisher/Pusher/DB ou alterar journal/readstate. Serviço de publicação permanece inativo. Nova fará a retirada da assinatura do cliente na próxima estação; nenhum timer será habilitado em polling. Story permanece In Progress, sem gate global/aplicação/deploy aprovados.

File List desta estação: `src/lib/checklist/realtime.ts` (novo), `src/app/api/pusher/auth/route.ts`, `src/app/api/checklist/jobs/eventos/route.ts`, `tests/checklist-analistas/realtime-isolation.test.ts` (novo), `tests/checklist-analistas/realtime-worker-isolation.test.ts` (novo), `docs/backend/checklist-analistas-api-20261022.md`, esta story.49 novos casos +8 regressões Chamados=57PASS; ESLint5arquivos e TS estrito helper/worker/fixture PASS. TS de auth/global fica Forge. Handoff `/tmp/checklist-analistas-20261022-echo-isolation.md`. Nenhuma alteração Portal/UI/schema/infra/env/DB real/Git/push/deploy.

## Adendo Nova — isolamento cliente dos avisos (22/10/2026)

- [x] Remover import/assinatura/bind/cleanup Pusher do hook CheckList, preservando inicialização/reset por ator/permissão e opt-out iframe.
- [x] Consumir helper puro `resolverTransporteChecklist(process.env.NEXT_PUBLIC_CHECKLIST_REALTIME_MODE)`; hook retorna a resolução, sem condicionar hidratação/store ou poller à validade da configuração.
- [x] Comprovar zero carregamento/subscribe/bind/unbind/unsubscribe/trigger Pusher para config ausente/polling/inválida/pusher, montagem/remoção de widget, cleanup, troca de ator e replay; somente o poller global existente mantém montagem/foco/6s visível/30s oculto.
- [x] Reexecutar regressões recovery cliente4 + journal SQLite→JSON→parser2 preservadas, incluindo paginação/leitura/replay/falha parcial/ator anterior. Nenhum teste antigo removido/ignorado.
- [ ] Gates globais Forge e revisões independentes seguem pendentes; este adendo não aprova deploy/aplicação ou encerra a story.

File List desta estação: `src/hooks/useChecklistNotifications.ts`, `tests/checklist-analistas/notifications-subscription.test.tsx`, esta story. Não criou componentes. Sem mudanças no poller/Toast/store/singleton Pusher/Portal ou DB/env/infra.15PASS em3arquivos e ESLint2arquivos PASS; diff-check registrado no handoff `/tmp/checklist-analistas-20261022-nova-isolation.md`.


### Vault — revisão e backup,22/10/2026

Revisão independente e backup staging completo verificado concluídos; relatório normativo operacional `docs/vault/checklist-analistas-20261022.md`. Contagem SQL correta:26ADD COLUMN+5tabelas+36índices explícitos=67statements; Prisma diff automático com7rebuilds/DROP NÃO APLICAR. Dump337tabelas reais/295932linhas/949índices/2triggers,360811599bytes, SHA25630b31bbef7c4e462c49bf22150ec4150f6bcc5d4ee035ec47d0fc67197acdd5e; captura17:51:45UTC e restore íntegro17:54:38UTC,22/10/2026. Per-tablecounts/schema/sequências iguais; arquivos ignored700/600. Nenhuma aplicação real autorizada.

PlanosCLI reais dry-run schema/bootstrap3/grant5sem blockers;2legados válidos,0>72bytes,Teste/docs/fotos0,ledgerausente,owners4NULL. Plano hash-contas deve corrigir rótulo de fase e recalcular hash ANTES aprovação/apply. Ordem vigente arquitetura§14: schema/bootstrap/grant→Portal leitor validado→Painel hashwriter novo+cessação verificável do antigo→hashbatch→polling. CLI valida reader; cessação writer é gate operacional externo, não inventar prova de URLs antigas bloqueadas. Timer NÃO instalar/habilitar no transporte polling.

File List desta estação: `docs/vault/checklist-analistas-20261022.md`, append destes documentos e `docs/ops/checklist-analistas-staging-20261022.md`; backup/manifestos/planos privados ficam fora Git. Status In Progress e gates globais/revisões/consentimento/aplicação pendentes.


### Dara — fechamento do metadado hash,22/10/2026

- [x] Alinhar apenas phase/ordem normativa ao §14: schema/bootstrap3/grant5 → leitor Portal READY validado → escritor Painel hash READY e cessação operacional antiga → hashbatch → polling sem timer.
- [x] Novo dry-run real staging sem drift além de phase; ESLint focado PASS e operações existentes17/17 PASS.
- [ ] Forge/gates globais, revisões e posterior consentimento específico/aplicação continuam pendentes; story In Progress.

Novo planSha256 `hash-contas`: `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c`; dry-run real staging às18:06:46UTC de22/10/2026,2conversões projetadas/0inválidas/0bloqueios/0mutações. Plano privado0600: `/tmp/checklist-vault-20261022/plans/hash-contas-phase-corrected.json`; resumo seguro0600: `/tmp/checklist-vault-20261022/hash-contas-phase-summary.json`. Diagnóstico idêntico ao anterior; operationPlan difere somente em phase. Hash antigo3264ef79… continua histórico, NÃO USAR PARA APPLY.

Guards/SQL/algoritmo/flags/schema inalterados; reader continua verificado pelo CLI e cessação writer é gate operacional externo. File List desta estação: `scripts/checklist-analistas/operations.mjs`, `docs/data/checklist-analistas-20261022.md`, `docs/vault/checklist-analistas-20261022.md`, `docs/ops/checklist-analistas-staging-20261022.md`, esta story. Backup/3outrosplanos/Portal/timerfontes preservados. Nenhuma execução real autorizada.


## Forge — gates globais reais,22/10/2026 — NEEDS_FIX

- [x] Gates globais Main executados integralmente em sourceWT sanitizado: TS exit2/40,66s; lint exit0/44,99s (0erros1183warnings); npm test --coverage exit1/34,92s (11filesfailed,41testesfailed,5896passed+4suitesimportfail); build exit0/90,91s com Prisma/player/webpack3GiB. Build ignora tipos e não aprovaTS.
- [x] Portal TS exit0/8,82s e lint exit0/2,09s;57+3testesSage reutilizados porfontesintactas; build exit1/3,42s porBOM/CSS preexistente comprovado (globalseversões byteidênticas ao baseline, reprodução mínima/BOMonly).
- [x] Prisma validate ambos/generate locais/paridade2schemas11statusesPASS. NenhumDBreal/infra/deploy/Git mutável.
- [x] Controles causais: excluir somente novo ambient node:sqlite remove9erroslegadosTS;9consumerscodebase d758 passam89/89 comdepsWT; ZIP6/6isoladoPASS4,78s confirma pressão global, não substitui fullFAIL. Generatedplayer ausente resolvido pelo build.5auth.ts exploratórios antigos não aparecem no global.
- [x] Smoke localhostMain start4391 anônimo401/307/vazio; Portaldev4392login500 mesmoCSS. Processos próprios encerrados. Não é E2Eautenticado nem homologação.
- [ ] Main TS/globaltest e Portalbuild/runtime ainda bloqueados; sem aprovaçãoForge integral.

Owners: Echo restauraAPIglobal notificacoes403inativo/revisaenvelope; Sage adaptafixtures/mocksCRMdelegate/SQLiteestoquecoluna nova/serveractionUI/contratosestruturais/navegação mantendo cenários eguardsfailclosed; Dara/Sage confina declaraçãoSQLite nova e tipa mockrecovery; Nova/Sage sobownerroot remove somenteBOM3bytesPortal. ZIPtimeoutglobal5000 precisa estabilidadecausal semrelaxarlimites. Nenhumteste/fonte alterado porForge.

### Echo — recusa persistida do agregador global restaurada

- [x] Restaurar HTTP403 para ator inválido/ausente/inativo identificado por sessão, antes da leitura CheckList; preservar HTTP200 vazio anônimo e ACL independente dos dois módulos.
- [x] Revisar consumidor real e manter a extensão `checklist:{items,nextCursor}` usada pelo poller global; contrato exato documentado no adendo da API.
- [x] Executar suíte próxima integral:4PASS/1FAIL; regressão403 corrigida,500/filtros/ownership preservados. ESLint focado PASS/zero diagnóstico.
- [x] Sage: mock explícito da action CheckList e deepEqual do envelope atualizados, preservando todas as asserções (adendo Sage abaixo). A aprovação integral da entrega segue pendente.

File List desta estação: `src/app/api/notificacoes/route.ts`, `docs/backend/checklist-analistas-api-20261022.md`, esta story. Testes não editados. Handoff `/tmp/checklist-analistas-20261022-echo-notifications.md`; logs `/tmp/checklist-echo-notifications-{tests,eslint}.log`. Sem Portal/schema/DB/env/Git/deploy.

Relatório completo comarquivo:linha/comandos/exit/duração/baselinecausal/limites: `/tmp/checklist-analistas-20261022-forge.md`. Logs `/tmp/checklist-analistas-20261022-forge-{main,portal}-*.log` e `.log.json`; baseline89PASS `main-baseline-failing-consumers.log`, TScontrol `main-ts-control-without-ambient.log`, CSScontrol `portal-css-control.json`. Pipeline devolvidoaoBibble; story continuaInProgress. Não aplicarDDL/seed/grant/hashbatch/cloud/timer nemdeploy semconsentimentoespecífico e próximosgates.

FileListForge destaestação: `docs/qa/matriz-checklist-analistas-20261022.md`, `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md`; relatórios/logs/tmp foraGit.


## Sage — regressões dos gates corrigidas, 22/10/2026

- [x] Confinar node:sqlite aos testes novos com loader runtime/contrato local, removendo ambient global; nenhum @ts-expect-error legado ou versão @types/node alterados. Tipar mock onAbrir recovery com assinatura real.
- [x] Adaptar fixture CRM (delegate/no-link;50casos), estoque (14casos;**Auditoria**, não Notificacao, coluna nullable+FKRestrict/UpdateCascade+unique em SQLite descartável), fronteiras Server Actions em4suítes UI e chamada com3ºarg opcional.
- [x] Preservar5casos API e adicionar anônimo200; envelope ativo mantém checklist e403inativo não consulta módulos. Dedup/ordem/replay e feedback persistido passam a executar poller/store reais, com cleanup.
- [x] Estabilizar somente orçamento do teste agregado100MiB em20s; limites produto intactos. Full final:arquivoZIP16.902s/agregado5.634s/6PASS confirma a pressão do limite antigo5s. Nenhuma alteração de concorrência global.
- [x] TS GLOBAL8GiB PASS exit0/46.91s; lint18arquivos PASS0diagnóstico e lint final estoque PASS. Focused232PASS/22arquivos +estoque14PASS após corrigir setup (primeira tentativa falhou por tabela citada incorretamente no handoff); todos casos preservados.
- [x] **Um npm test global com cobertura PASS:**734/734arquivos;5949PASS+4skip+1todo preexistentes (5954total),exit0/34.59s. Nenhuma exclusão/skip/todo nova ou repetição global pós-PASS.
- [ ] Forge independente/Portal BOM build, revisões/homologação e posterior consentimento específico/aplicação permanecem pendentes. Story In Progress, sem publicação/DB real/timer.

Handoff `/tmp/checklist-analistas-20261022-sage-gates-fix.md`; logs integrais e metadados `/tmp/checklist-analistas-20261022-forge-sage-fix-{focused,stock,stock-final,typecheck,lint,stock-lint-final,full}.log[.json]`. Main build/lintglobal e Portal TS/lint/testes/paridade prévios não repetidos: fontes/ownership intactos aqui. ROOT sujo/Portal/backups reais preservados.

File List Sage desta estação: `tests/checklist-analistas/{node-sqlite.ts (novo),node-sqlite.d.ts (removido),backend.service.test.ts,schema.contract.test.ts,operations.test.ts,sqlite-fixture.ts,eventos-recovery-client.test.tsx,zip-budgets.test.ts}`, `tests/bpm/{edicao-campos-card.test.ts,anexos-aba-card-react.test.ts,leads-central-react.test.ts,tarefas-alertas-central-react.test.ts,tarefas-alertas-foco-react.test.ts,tarefas-notificacoes-navegacao-react.test.ts}`, `tests/estoque/movement-service.integration.test.ts`, `tests/chamados/{notificacoes-api.test.ts,central-notificacoes-painel.test.ts,feedback-ui.test.ts}`, `tests/helpers/notificacoes-poller.ts` (novo), matriz QA e story.


## Forge round2 — APROVADO local para Probe/Anubis/Lens,22/10/2026

- [x] MAIN npm run build real exit0/56,19s (Prisma+player+webpack3GiB); Portal npm run build real/Turbopack exit0/4,66s após remoção somenteBOM3bytes porNova. Ambos ignoram tipos, TS separado.
- [x] Portal TSglobal pósbuild executadoexit0/8,35s. Main TSglobalSage adotadoexplicitamente exit0/46,91s, fonteintacta desdeSage.
- [x] Main fullnpmtestSage adotadoexplicitamente exit0/34,59s:734arquivosPASS/5949testesPASS+4skips+1todo preexistentes. Semrepetição dos5949intactos. LintglobalMain anterior0erros1183warn+lintfocalEchoAPI/SageinputsnovosPASS; Portallintglobal e57+3testesSage/paridade/Prisma reutilizados porinputintacto.
- [x] Runtime npmstart próprio ambosReady: Mainpublic200/CheckList307/eventos401/notificacoesanon200vazio; Portallogin200/reset200/checklist307callback4392/API401. Zero5xx, AUTH_URLfictícia correta porapp, PIDspróprios841883/843850encerrados eportaslivres.
- [x] Regressões iniciais corrigidas e verificadas; colunaSQLitefixture éAuditoria.checklistEventoId (corrige descrição inicialNotificacao). Semnovoerrocausal.
- [ ] Probe/Anubis/Lens, consentimentoespecífico/aplicação/Vaultvigente eposteriorhomologaçãostaging continuam pendentes. Semdeploy/READYreal ouaprovaçãofinal. StoryInProgress.

Relatório `/tmp/checklist-analistas-20261022-forge-round2.md` discriminaEXECUTADOvsADOTADO, comandos/exit/duração/logs/limites. Logs `/tmp/checklist-analistas-20261022-forge-{main,portal}-round2-*.log`. Handoffs adotadosEcho-notifications/Sage-gates-fix/Nova-bom citados no relatório. FileListForge: estaStory, `docs/qa/matriz-checklist-analistas-20261022.md`, `.bibble/memory/known-errors.md` (causasBOM/ambient agoraresolvidas). Nenhumsource/teste/schema/infra/env/DBreal/Gitmutável/cloud/timer/deploy alterado. ControledevolvidoaoBibble.


## Probe + Flux — revisão local concluída,22/10/2026

- [x] Probe: wiring do blueprint Scout rastreado em menu/rotas/listaAnalistas/wizard/detalhe/modelos/histórico/capabilities/CRM/shell/Portal; controles chamam actions/serviços versionados com autorização servidor. Sem navegação por pastas ou upload público legado operante. Nenhum defeito novo concreto encontrado.
- [x] Flux: assets dos builds existentes medidos por entrada cliente (Main lista394482B/129942Bgzip,detalhe338032B/104476B; Portal lista254804B/72661B,detalhe414993B/119009B; incluem compartilhados, não delta/whole-route); paginação/lotes/cache/índices preparados/limites upload+ZIP e polling§14 revisados. Sem benchmark remoto/CWV autenticado ou recomendação especulativa.
- [x] Chrome fixture real de componentes:13asserts Sheet/foco/8Tabs/Escape/foco restaurado/analista0/vazio, zerooverflow/exception; screenshots Nova reaproveitadas. Harness lifecycle teve timeout (retentativaPage.navigate), separado dos asserts; todos processos próprios parados/portas livres. Actions/Next mockados; não E2E autenticado.
- [x] Gates Forge round2 e subconjuntos Sage/Nova adotados com lineage, sem repetir suíte/build/lint/Prisma intactos. Relatório focado `/tmp/checklist-analistas-20261022-probe-flux.md`; evidências browser JSON/runtime e assets JSON referenciadas ali.
- [ ] Anubis/Lens, aplicação consentida/Vaultvigente e homologação autenticada staging continuam pendentes. Probe/Flux locais APROVADOS não são QAfinal/deployREADY; StoryInProgress.

File List Probe/Flux: apenas esta matriz QA e story (append); relatório e medições em /tmp foraGit. Source/testes/schema/env/cloud/DB/objetos/timer/backups/Git/deploy/produção preservados. Controle devolvido ao Bibble para Anubis, sem chamar outro agente.


## Anubis — segurança local concluída,22/10/2026

- [x] Revisão independente das fronteiras persistidas Main/Portal, owner/líder, commands/CAS/replay/journal, credenciais/reset, uploads privados/recibos/downloads/DTO/avatar/ZIP, CRM e polling§14 concluída. Zero achados críticos ou importantes confirmados; **APROVADO no escopo local de segurança**.
- [x] SSE Portal revalida authSessionVersion persistida a cada tick8s e fecha stream em erro; uploads antigos delegam ao fluxo privado e UploadThing falha fechado. CheckList sem subscribe/trigger Pusher, prefixo negado antes do fallback e worker Bearer-first/polling processed0 sem DB/rede.
- [x] Gates Forge round2/Probe/Sage adotados com lineage; nenhum teste/gate intacto repetido, nenhum repro novo necessário. Revisão source real/diff Main d7580d0 + untracked e Portal edcf2e8 + untracked; relatório `/tmp/checklist-analistas-20261022-anubis.md` contém arquivo:linha e limites.
- [ ] Lens/QA final, aplicação consentida sob Vault/backup vigente e homologação autenticada staging permanecem pendentes. A10 legado não encerra antes de migração/invalidação autorizada; Blob real e PortalREADY não comprovados. Produção não autorizada. Story In Progress.

File List Anubis: somente esta matriz QA e story (append), relatório em /tmp foraGit. Sem alteração de source/testes/schema/env/cloud/DB/objetos/backups/timer/Git mutável/deploy/produção. Controle devolvido ao Bibble para Lens; nenhum agente seguinte acionado.


### Lens — revisão local com correção necessária (22/10/2026)

- [x] Pré-requisitos Forge round2/Probe/Flux/Anubis lidos e gates adotados sem repetir execuções intactas; revisão manual independente de commands/CAS/consumidores/guard/catálogo/CRM/Portal realizada.
- [x] **LENS-01 confirmado (🟡 importante):** `src/lib/checklist/catalogo.ts:211–226` reconstrói a intenção DESATIVAR/ORDENAR usando a última revisão antes do replay; retry idêntico após edição concorrente retorna CONFLICT em vez da confirmação anterior. Repro com source real/delegates em memória, exit0 para ambas operações; sem banco/rede. Relatório `/tmp/checklist-analistas-20261022-lens.md`, script `...-lens-repro.cjs`, evidência `...-lens-repro.json`.
- [x] Echo corrigiu hash/replay da intenção normalizada estável (incluindo operação) após ACL e antes da hidratação da revisão atual, preservando CAS/atomicidade/rejeição de payload/ator divergentes. Regressão causal SQLite real cobre retry pós-edição de ambas operações e revalidação persistida de ator/ACL; RED antes do fix (2failed/2passed), GREEN depois (4PASS; conjunto focado47PASS). **Correção entregue; revisão Lens anterior NEEDS_FIX ainda aguarda retorno focal, sem QA final.**
- [ ] Forge executar build afetado e Lens rever focalmente LENS-01 sobre a fonte corrigida. Echo executou gates globais pós-fix: TypeScript8GB exit0, lint exit0 (0errors/1183warnings preexistentes), suíte única735arquivos/5953PASS+4skip+1todo; detalhes no handoff abaixo.
- [ ] Story continua In Progress; sessões reais/Blob/PortalREADY/Vault+backup vigente+consentimento específico/aplicação/homologação permanecem pendentes. Produção não autorizada.

File List Lens: somente esta matriz QA e story por append; relatório/repro/JSON em /tmp. Sem alteração de appsource/testes/schema/env/Git/cloud/DB real/objetos/backups/timer/deploy. Revisão interrompida após confirmação do defeito, controle devolvido ao Bibble; nenhum próximo agente acionado.

### Echo — correção focal LENS-01 (22/10/2026)

- [x] `catalogo.ts`: executor privado com união tipada PUBLICAR/DESATIVAR/ORDENAR; hash usa `{operation,...inputNormalizado}` do chamador, ACL e replay dentro da transação antes de hidratar a latest revisão. Retry devolve a confirmação rev2 e conserva rev3 concorrente/versões/eventos/auditoria; comando novo com expectedRevision3 continua avançando para4. Núcleo `commands.ts`, schemas, CAS, DTOs e endpoints intactos.
- [x] Quatro regressões em fixture SQLite descartável real, sem ambiente real: replay imediato/tardio de ambas operações, payload/alvo/ação/ator divergentes, CAS e sessão/status/papel/módulo persistidos. Antes do fix duas falhas causais exatas; depois catálogo/concorrência/backend/schema47PASS, lint focado sem diagnósticos, typecheck global8GB e lint global exit0, suíte global735arquivos/5953PASS+4skip+1todo exit0. `commands.ts` SHA permanece `ff1eaa4168fbac4ee63a7203d69840f4d5c608b1821d8d922b504ac415caf709`.
- [ ] Build afetado e revisão Lens focal ficam com Forge/Lens via Bibble. Story continua In Progress; esta correção não encerra pendências de Portal staging READY/Blob/sessões legítimas/Vault/consentimento/homologação nem autoriza publicação.

File List Echo LENS-01: `src/lib/checklist/catalogo.ts`; novo `tests/checklist-analistas/catalogo-replay.test.ts`; `docs/backend/checklist-analistas-api-20261022.md`; esta story. Handoff/logs `/tmp/checklist-analistas-20261022-echo-catalog-replay.md` e `/tmp/checklist-analistas-20261022-echo-replay-{red,focused,typecheck,lint,eslint-focused,fulltest}.log`. Gates globais anteriores mantêm sua linhagem; os acima são novas execuções pós-fix. Portal/build/Anubis/Probe/Flux não foram repetidos. Nenhum schema/migration/env/DB real/cloud/backup/timer/Git mutável/deploy alterado; roots sujos preservados. Controle devolvido ao Bibble e execução parada.


### Forge afetado — catálogo LENS-01,22/10/2026

- [x] MAIN npm run build real após fixEcho: exit0/58,32s, Prisma+player+webpack3GiB,86páginas; semerro novo. Build ignora tipos; TCGLOBAL/lintGLOBAL/full735arquivos5953PASS+4skip+1todo pósfixEcho adotados explicitamente pelos logs echo-replay, semrepetição.
- [x] SHAcatálogo19888490… confere; commands/ACL/CAS/schema/DTO/APIshape intactos. Portalround2TS/lint/build57+3/paridade adotados porfonteintacta; não repetidosruntime/gatesnãoafetados.
- [ ] LensfocalLENS-01 eposteriorhomologação/aplicaçãoautorizada seguempendentes; storyInProgress. Semdeploy/DBreal/Blob/cloud/timer/produção.

**APROVADOForge paraLensfocal**, controleaoBibble. Relatório `/tmp/checklist-analistas-20261022-forge-catalog.md`; log integral `/tmp/checklist-analistas-20261022-forge-main-catalog-build.log` e `.log.json`. FileListForge: `docs/qa/matriz-checklist-analistas-20261022.md`, `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md`. Nenhumsource/teste/schema/env/infra/DBreal/Gitmutável alterado.


### Lens final — LENS-01 fechado, revisão local aprovada (22/10/2026)

- [x] Revisão focal da correção privada em `src/lib/checklist/catalogo.ts:120`: payload da intenção normalizada original inclui operação, ACL persistida precede replay na transação e hidratação latest ocorre só para intenção nova; CAS/journal/auditoria/shapes preservados. commandsSHA intacto.
- [x] Repro independente próprio executado1vezGREEN para DESATIVAR/ORDENAR: retry imediato e após edição concorrente rev3 devolvem confirmação originalrev2, sem writes adicionais e sem alterar revisão/nome concorrente. Artefatos `/tmp/checklist-analistas-20261022-lens-repro-green.cjs/.json`. RegressãoSQLiteEcho4testes e foco47PASS adotados, incluindo divergências/ACLrevogada/CAS.
- [x] Partes restantes do escopo Portal/CRM/documentos/erros concluídas. **APROVADO local — LENS-01 encerrado, zero outros achados abertos.** Relatório `/tmp/checklist-analistas-20261022-lens-final.md` substitui somente o veredicto local anterior NEEDS_FIX. Gates pós-fix EchoTC/lint/full735arquivos5953PASS+4skip1todo e Forgebuild58,32s86páginas adotados explicitamente; Portal intocado e evidências gerais Probe/Flux/Anubis reutilizados, sem alegar nova execução.
- [ ] QA readiness/aplicação sob Vault+backup vigente+consentimento específico, PortalREADY/Blob/sessões legítimas/homologação staging seguem pendentes. Story In Progress; nenhuma autorização DB/deploy/produção derivada desta aprovação.

File List Lens final: somente esta matriz QA e story por append, relatório/reproGREEN em /tmp. Nenhuma alteração de appsource/testes/schema/env/Git/cloud/DB real/objetos/backups/timer/deploy. Controle devolvido ao Bibble para QA readiness/DevOps; nenhum agente seguinte acionado.


## QA readiness independente — consolidação final local,22/10/2026

**Gate IMPLEMENTAÇÃO LOCAL: PASS / READY_FOR_APPROVAL. Gate PUBLICAÇÃO/HOMOLOGAÇÃO: PENDENTE.** Confronto documental AC1–12/A01–17, duplicações, Analistas/Pastas e CRM B concluído; nenhum critério de código sem entrega demonstrado,0 achados locais abertos. Story permanece In Progress. Relatório completo `/tmp/checklist-analistas-20261022-qa-readiness.md` contém mapeamento por critério/achado, fontes, limites e sequência restante; não equivale a aplicação ou homologação remota.

- [x] B01 bytes bcrypt/legado e B02 recovery JSON fechados; regressões iniciais de integração/globaltest, typecheck/SQLite/mocks/estoque/API/ZIP e BOM Portal resolvidos. LENS-01 fechado por regressão SQLite4casos e repro independente GREEN; payload original estável/ACL/CAS e núcleo commands preservados.
- [x] Main pós-fix: typecheck global8GiB exit0, lint global0erros1183warnings preexistentes, uma suíte global735arquivos/5953PASS+4skip/1todo preexistentes34,92s (Echo); build independente real58,32s/86páginas (Forge). Portal TS8,35s/lint0warnings/buildTurbopack4,66s PASS e57+3testes adotados por fonte intacta; paridade11status/schema SHA b407823e… PASS. Builds ignoram tipos; TS separado é evidência obrigatória cumprida.
- [x] Probe/Flux wiring/source/assets e13assertsChrome de componentes reais em fixture aprovados, harness lifecycle timeout separado; Anubis0críticos/importantes; Lensfinal0abertos. Smokes locais `npm run start` Ready/HTTP anônimo esperado/zero5xx são anteriores e não E2E autenticado remoto. Nenhum gate, teste, build ou métrica intacto repetido nesta estação. CodeRabbit indisponível, revisão alternativa independente registrada.
- [x] Ownership/leitura global/analistas0/null/CRM B explícito e Procedimentos/Excel preservados localmente. Sem Pasta virtual retirado; Teste0/docs0/fotos0 no preflight real: **nenhuma exclusão/cópia/revogação staging necessária se reconsulta confirmar0**. A10 legado stage N/A provisório não fecha produção nem revoga URL pública antiga.
- [ ] DevOps readiness: inventário seletivo/commits locais/SHAs dos dois worktrees e validação branch/workflow/provider/env efetivo/DB separado/origens/scopes antes de push/preview. Portal custom staging/hostname e store dedicado existem, mas Portal sem READY e Blob token ausente por403 challenge_required; autenticação Vercel legítima renovada ainda necessária, sem bypass/segredos no chat/cópia de produção. Nenhuma compra de app Pusher exigida.
- [ ] Vault/aplicação: revalidar read-only fingerprint/CAS/contagens/backup≤48h e apresentar plano detalhado/risco/alternativa/rollback para **consentimento explícito específico**. Backup verificado22/10/2026 17:51:45UTC, restore17:54:38,360811599bytes/SHA30b31bbe…/337tabelas/295932linhas/949índices/2triggers; evidência adotada sem ler dump. Schema custom67statements (26colunas+5tabelas+36índices), bootstrap3 e grant5 preservando4módulos+checkList são dry-run; não executar Prisma auto7DROP/rebuild nem resolver ledger ausente automaticamente. Preservar4ownersNULL sem inferência.
- [ ] Rollout autorizado§14: schema/bootstrap/grant → **Portal leitor READY** com prova legítima → **Painel hashwriter READY + cessação comprovada de writers antigos** (alias sozinho não basta) → hashbatch autorizado/CAS/reconciliação. Hash plan vigente `1bd13b1afa8b4d27abd0745db15619a6583166c5b36bda98622ca5aea806254c`,2conversões projetadas0inválidas; antigo3264ef79… obsoleto. CLI não automatiza cessação writer; sem prova não executar batch. Rollback mantém leitor hash compatível/schema aditivo, sem DROP/restaurar plaintext.
- [ ] Homologar staging com sessões legítimas owner/outro/líder/Portal: ACL/CRUD/CAS/ativo/CRM/rascunhos/reset/cache/revogação, upload/finalizar/registro/download/ZIP/avatar e polling/readstate; registrar SHA/READY/alias/config. **Polling6/30s e SSE Portal, zero Pusher CheckList; não instalar/habilitar timer/cron nem chamar --once remoto.** Nenhum cookie, seed ou prova E2E fabricados. Produção somente após homologação e pedido explícito posterior.

Evidências atuais: `/tmp/checklist-analistas-20261022-{forge-catalog,forge-round2,echo-catalog-replay,probe-flux,anubis,lens-final}.md`, matriz/story e `docs/vault/checklist-analistas-20261022.md` com adendo Dara. Relatórios antigos NEEDS_FIX e auditoria original preservados como história, sem tratá-los como defeitos locais atuais.

File List desta estação: somente `docs/qa/matriz-checklist-analistas-20261022.md` (estado/consolidação), `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md` (status/AC10 vigente/checklist/QA Results/consolidação), relatório `/tmp/checklist-analistas-20261022-qa-readiness.md` foraGit. Nenhuma alteração de appsource/testes/schema/env/Git mutável/cloud/DB/objetos/backup/timer/seed/deploy; roots e edits alheios preservados. **Controle devolvido ao Bibble para DevOps readiness; estação encerrada.**


## DevOps readiness — congelamento local e integração Radar,22/10/2026

- [x]63arquivos pendentes Main e69Portal adicionados seletivamente/commit convencional local, sem arquivos reais de ambiente/dumps/credenciais. Source hashes da feature preservados, correção BOM Portal incluída. Ajuste exclusivo blank EOF desta story e matriz QA para diff-check.
- [x]Fresh stagingab278f13 é READY efetivo no alias; diverge do baseline d758(mergebase861e43d7,16vs2commits). Inventário read-only comprova13paths Radar novos sem overlapdiretofeature; merge local mecânico limpo preserva os2históricos, sem patch manual.
- [x]2PATCHvalueonly dos overridesDBMain exclusivamente custom staging aceitos200; fonte explícita0600 comSHAURL7fdd1607… comprovado, scopes/type preservados, produção/previewintactos. Nenhum acesso SQL. Backup existente idade1,523h/stat conferidos; restore verificado prévio adotado, sem reler dump/refazer backup.
- [ ]ForgeMain valida nova árvore integrada antes de publicação; Portal efeature pré-merge mantêm lineage já aprovada. Única nova GETBlob403, loginoficialisolado aguarda ação humana; não presume step-up concluído. PortalREADY/Blob/origens/homologação econsentimentoDB específico continuam pendentes. Story In Progress, sem push/deploy/prod.

**File List real consolidada:** [manifesto por repo](../ops/checklist-analistas-files-20261022.json) enumera132paths featureMain(incluieste novo manifesto),69Portal e13paths da integração Radar separadamente. Artefatos DevOps desta estação: `docs/ops/checklist-analistas-staging-20261022.md`, novo `docs/ops/checklist-analistas-files-20261022.json`, esta story e ajuste somenteEOF `docs/qa/matriz-checklist-analistas-20261022.md`. Código/testes/schema novos não foram escritos porDevOps; commits congelam entregas revisadas dos owners e merge integra source remoto mecanicamente. Handoff `/tmp/checklist-analistas-20261022-devops-readiness.md`/`.json` contém SHAs finais/pais/tree e próximos gates. Sem banco/objetos/timer/produção. Controle devolvido ao Bibble após emissão.


### Forge MAIN pós-merge Radar — 22/10/2026

- [x] HEAD584856ebac7760707baf60853b28eb870515b239/tree dcd4530fb8dddb9e72d80a2fceaf897a3b525bf4 gateados;13pathsRadar justificam nova execuçãoMain.114sourcesfeature e69Portal revalidados0mismatches.
- [x] Quatro comandos Main reais, uma vez cada: `npm run typecheck`8GiB exit0/20,86s; `npm run lint` exit0/44,74s,0erros1183warnings; `npm test`coverage exit0/34,53s,737arquivos/5958PASS+4skip+1todo preexistentes; `npm run build` exit0/62,06s,Prisma/player/webpack3GiB86páginas. BuildSKIPtipos, TCseparadoPASS.
- [x] Semerro novo da integração. Portal/reviewsfeature Probe13Chrome+Anubis+Lens+QA adotados comlineage ehashesintactos; não repetidos nem alegadoscomoE2Eremoto.
- [ ] Operação/homologaçãostaging/PortalREADY/Blob/VaultconsentimentoDB pendentes. StoryInProgress; nenhuma publicação/DBreal/produção autorizada porgates.

**APROVADOForgeMAINcombinado**, controleaoBibble. Relatório `/tmp/checklist-analistas-20261022-forge-merged.md`; inputs `/tmp/checklist-analistas-20261022-forge-merged-input.json`; logs `/tmp/checklist-analistas-20261022-forge-main-merged-{typecheck,lint,test,build}.log`+`.log.json`. FileListForge: estaStory e `docs/qa/matriz-checklist-analistas-20261022.md`; somenteappenddocs, semfonte/teste/schema/config/env/Gitmutável/cloud/DB/backup/timer/deploy.

### Vault final — plano específico pronto para consentimento,22/10/2026

- [x] Consolidar fase hash corrigida1bd13b1a… e gates Forge pós-merge Main737arquivos/5958PASS; Portal/revisões locais adotados sem repetição por fontes intactas. Pendências históricas de fase/gates não são bloqueios locais atuais.
- [x] Preparar apresentação autocontida de quatro operações staging: schema67statements (26colunas/5tabelas/36índices), bootstrap3, grant5 preservando4acessos, hash2 condicionado ao leitor/escritorREADY e cessação antiga real. ComandosCLI,planShas,impactos/locks,alternativa/rollback e pergunta específica em `docs/vault/checklist-analistas-20261022.md`, adendo final.
- [x] Adotar backup completo verificado sem reler dump/rebackup/restore: snapshot22/10/2026 17:51:45UTC (14:51:45SãoPaulo),360811599bytes,337tabelas/295932linhas/949índices/2triggers,restore17:54:38UTC. Idade1,748h às19:36:36UTC;≤48h somente até24/10/2026 17:51:45UTC, revalidar em cada apply. Stat e metadata segura conferidos; nenhum segredo/dado de linha lido.
- [ ] Bibble apresentar e colher consentimento inequívoco antes de aplicar; nenhum consentimento/approved=true sintético. Préestado/CAS/fingerprint/backup devem continuar válidos. Alteração de conjunto/escopo exige novo plano/consentimento.
- [ ] Portal leitorREADY/host/TLS/DBproof/autenticação real, PainelhashwriterREADY/cessação de writers antigos e Blob privado continuam pendentes; sem prova não executar hash nem declarar homologação. Sem Teste/delete/objetos/backfill de owners/ledger/timer/cron/Pusher/produção no plano.

**Veredito: ARTEFATOS REVISADOS / BACKUP VÁLIDO / AGUARDA CONSENTIMENTO.** Story In Progress, sem publicação. File List desta estação: `docs/vault/checklist-analistas-20261022.md`, esta story; relatório `/tmp/checklist-analistas-20261022-vault-final-plan.md` foraGit. Somente documentação, preservando edits anteriores/roots compartilhados; nenhum gate ou backup repetido, SQL remoto ou mutação de banco/cloud/Git. Controle devolvido ao Bibble; estação encerrada.


### Scribe/Kowalski — continuidade documental,22/10/2026

- [x] Mapa real e pontos de integração registrados; §14/polling prevalece sobre Pusher antigo. Entrega local PASS/zero achados, pré-condições operacionais e backup/consentimento distintos de publicação.
- [x] Journal consolidado sem apagar draft alheio; apenas estes novos blocos identificáveis foram apendados às memórias do root compartilhado, preservando entradas concorrentes. Sem fontes/testes/env/DB/cloud/Git/build/backup nesta estação.
**File List documental:** `.bibble/memory/{codebase-map,integration-points,journal}.md`, esta story. Story In Progress; staging não aplicado/publicado nesta entrega, produção fora do escopo. Handoff `/tmp/checklist-analistas-20261022-memory-consolidation.md`; controle devolvido ao Bibble.

### Vault — consentimento real e liberação3 staging,22/10/2026

- [x] Registrar resposta literal do usuário “sim”, pergunta exata e escopo4operações/plano integral/backupSHA, primeira observação20:16:25UTC; sem inventar ID ou timestamp exato de mensagem. Não pedir novamente a mesma autorização.
- [x] Revalidar staging readonly com env0600 explícito: diagnóstico idêntico/NOT_APPLIED, quatro planosSHA iguais,4atendimentos/6checklists/10itens/3modelos/2legados válidos,0docs/fotos/Teste/FK/ledger,owners futuros4NULL. Backup existente verificado adotado/stat e metadata conferidos,sem ler dump/refazer hash360MB/restore/backup/gates.
- [x] Emitir somente3pares reais consent/Vault aprovando schema→bootstrap3→grant5 sob guardasCLI e precondições exatas; diretório0700/arquivos0600 foraGit. Relatório `/tmp/checklist-analistas-20261022-vault-authorized.md`; JSON `/tmp/checklist-vault-20261022/authorization-20261022/authorization-summary.json` contém paths e comandos exatos.
- [ ] DevOps aplicar3operações e validar cada fase; Vault não executou escrita. Hash2 consentido mas sem aprovação/leitor fictícios, aguardando PortalreaderREADY legítimo→PainelhashwriterREADY→cessação comprovada de writers antigos, mais backup/CAS/plano vigente. Blob requer autenticação legítima separada; produção fora.

File List desta estação: `docs/vault/checklist-analistas-20261022.md`, esta story; relatório/evidências acima foraGit. Nenhum source/teste/schema/env/DBwrite/cloud/Gitmutável/objeto/timer/produção alterado. Story In Progress. Controle devolvido ao Bibble para DevOps APPLY3 staging; estação encerrada.


### DevOps APPLY3 real — 22/10/2026

- [x]Schema applied=true/exit0 às20:25:15UTC/45,378s; bootstrap3 às20:27:08UTC/21,721s; grant5 às20:28:40UTC/22,709s. Comandos exatos liberados peloVault, sem bypass/ediçãoCLI, guardrestore completo local executado por cada operação; nenhum backup novo/restore remoto.
- [x]Readonly após cadafase APPLIED/FK0/blockers0/4dossiês6checklists10itens3modelos2contas;4ownersNULL e campos originais de4tabelas iguais ao backupnativo verificado, itens/snapshots intactos.3identidades/3modelos vinculados e5permissões confirmados;4módulos anteriores+crm/calendarioAlpha preservados, sem owner/role/override alteração. CASplanos seguintes iguais.
- [x]NovoOAuth oficial isolado realmente concluído e identity/team confirmados; GETBlob20:27:38UTC continua403challenge_required. Login não resolveu step-up, nenhumtokenconfigurado/extraídoporsidechannel. Usuário deve concluir desafio legítimo no dashboardStorage do storeCHECKLIST-STAGING-20261022; sem tokens no chat.
- [ ]Hash2 já consentido aguarda PortalreaderREADY→PainelhashwriterREADY/cessação antiga→liberaçãoVault real; não executado. PortalREADY/Blob/origins/homologação pendentes. Polling§14 sem timer. Story In Progress, sem publicação/push/prod.

File List desta estação: `docs/ops/checklist-analistas-staging-20261022.md`, `docs/vault/checklist-analistas-20261022.md`, esta story. Demais docs/memória sujos anteriores preservados e não adicionados ao commit seletivo. Handoff seguro `/tmp/checklist-analistas-20261022-devops-apply3.md`/`.json`,3logs e3pósverificações foraGit. Sem app/teste/schema/dependência alterados. Controle devolvido ao Bibble.
