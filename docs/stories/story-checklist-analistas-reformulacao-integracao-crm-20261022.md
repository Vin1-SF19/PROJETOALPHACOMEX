# Story — Reformular CheckList por analistas e integrar dossiê ao CRM

## Status

In Progress — dados, backends e UI dos dois aplicativos implementados e testados em fixtures; revisão integrada corrige lacunas de rascunhos/cache/seleção e avatar. Gates globais, isolamento operacional e aplicação real autorizada permanecem pendentes. Não marcar Done enquanto houver critério obrigatório sem evidência ou aplicação necessária ainda não autorizada.

## Executor Assignment

executor: "Bibble — coordenação serial dos especialistas"
quality_gate: "@qa — independente dos executores"
quality_gate_tools: ["matriz A01–A17", "testes dos dois projetos", "lint", "typecheck", "test", "build", "Vault", "verificação staging/compatibilidade"]

## Story e fontes normativas

Como equipe Operacional, quero organizar o CheckList por analista, consultar empresas globalmente com escrita controlada pelo dono/liderança e vincular explicitamente seus dossiês aos cards CRM, para acompanhar documentos com integridade, histórico e compatibilidade com o portal.

Escopo aprovado pelo usuário: **todas as correções A01–A17**, duplicações, sidebar de analistas à esquerda/empresas à direita, regras de ownership e integração **CRM B**, preservando procedimentos BPM/Excel. O contrato [Aria](../architecture/checklist-analistas-crm-20261022.md), §§1–13, é normativo e integra estes critérios; a [auditoria](../reports/auditoria-alpha-checklist-2026-10-22.md) fornece evidências dos achados, não substitui as decisões posteriores de Aria.

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
10. **Eventos/notificações:** journal/outbox e leitura durável evento+usuário separados do motor BPM, recibos/eventos/notifications idempotentes. Produtor Portal existente é adaptado com seus consumidores. Assinatura/poller únicos no shell, replay/recovery e dedup por eventId, toast por ID incluindo51º, clique marca lido no servidor, cleanup não derruba outro assinante. Worker protegido/claim CAS/retry e scheduler staging isolado conforme Aria §7; conta portal mantém leitura separada.
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
- [ ] **Nova + Iris:** sidebar analistas/empresas, páginas/estados/wizard/modelos/histórico, Portal compatível, shell/avisos e painel CRM; sem ACL inventada no cliente (AC2–4,6–11).
- [ ] **Sage:** suíte causal/regressão integral pela matriz, fixtures/SQLite/streams; evidência executada e lacunas explícitas (AC12).
- [ ] **Forge:** lint/typecheck/test/build reais Painel e comandos equivalentes Portal; preparar scripts de typecheck/teste ausentes segundo contrato, sem afirmar gate sem executar.
- [ ] **Probe → Anubis → Lens:** integração/end-to-end autorizada em fixtures, revisão de segurança/auth/storage/ZIP e revisão de código após Forge; corrigir e revalidar achados.
- [ ] **Vault:** apresentar plano concreto de aplicação schema/legado/Teste/objetos por ambiente, backup completo verificado≤48h, alternativa/rollback e solicitar consentimento específico; aguardar resposta antes de aplicar.
- [ ] **DevOps:** verificar isolamento Portal/DB/storage/Pusher/cron **ANTES de qualquer push/preview**; Portal não tem staging e previews usam metadata produção. Ausência de isolamento/store privado bloqueia publicação, não autoriza usar produção.
- [ ] **DevOps após gates/consentimento:** aplicar somente operações explicitamente autorizadas e validar schema/objetos; deploy leitor Portal compatível antes de escrita hash Painel, somente staging; conferir SHA/READY/alias/smoke dos dois apps.
- [ ] **QA:** confrontar matriz completa, aplicação autorizada e compatibilidade real; A10 legado só fecha após migração verificada; caso contrário status pendente explícito, sem Done.
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

Pendente de código, gates, consentimento/aplicação necessários e validação. Esta preparação não executou migration, teste de implementação, push ou deploy.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Story abrangente executável com matriz integral e fases seriais | River (@sm) |

### Handoff real — Nova/Iris

UI Painel e Portal implementada, inclusive sidebar Analistas/empresas, modelos, histórico, notificações únicas e painel de vínculo CRM. Painel12 testes UI PASS; Portal8 testes upload/helper PASS e typecheck completo PASS. Lint focado ambos PASS. Componentes reais exercitados em Chromium com fixtures desktop/mobile, sem exceções ou overflow; não equivale a E2E autenticado. Arquivos/evidências em `/tmp/checklist-analistas-20261022-nova-implementation.md`. Gate Nova continua aberto até concluir proteção integral de rascunhos, isolamento de cache Portal na troca de ator e retenção da seleção de conta fora da página atual; endpoint avatar segue correção Echo. Nenhuma aplicação real ou publicação feita.
