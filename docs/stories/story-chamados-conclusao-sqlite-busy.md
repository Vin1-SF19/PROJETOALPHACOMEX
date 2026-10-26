# Story — Investigar e corrigir bloqueio SQLite ao finalizar chamados

## Status

Ready for Review — implementação e quatro gates aprovados no candidato isolado; QA autorizou publicação e validação exclusivamente em staging. Deploy em andamento; produção exige pedido explícito posterior.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["diagnóstico somente leitura", "regressões de conclusão e concorrência", "npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como responsável pelo atendimento de chamados no Painel Alpha, quero finalizar chamados sem falhas indevidas por bloqueio transitório do banco, para encerrar o atendimento com status, feedback e protocolo consistentes.

Origem: pedido direto do usuário em 2026-10-26. Ao finalizar um chamado apareceu um erro descrito aproximadamente como “sql busy / is locked”; nova tentativa segundos depois funcionou. O relato não identifica chamado, horário, ambiente nem mensagem técnica exata. Esses dados e a atribuição causal precisam de evidências; sucesso posterior, isoladamente, não comprova integridade nem corrupção do banco.

## Acceptance Criteria

1. Antes de scripts, consultas ou configuração, identificar o ambiente e o banco efetivos. Operações CLI de staging usam explicitamente `.env.staging.local`. O diagnóstico de integridade é somente leitura, registra o alcance das verificações e suas limitações e não testa conclusões em registros reais. Não atribuir o incidente a um chamado específico nem declarar corrupção/ausência de corrupção sem evidência suficiente.
2. Rastrear os fluxos rápido e com protocolo até o serviço de conclusão compartilhado. Reproduzir o bloqueio relevante em testes isolados e registrar a causa comprovada ou a lacuna de correlação com o incidente relatado. Corrigir somente o caminho causal demonstrado.
3. Quando a transação de conclusão for integralmente revertida por disputa de escrita reconhecida, refazer a transação inteira com limite de tentativas e espera controlada. Revalidar permissões, técnico responsável e estado do chamado em cada tentativa. Falhas de negócio, validação, integridade ou erro técnico não classificado como bloqueio transitório não devem entrar em repetição indiscriminada.
4. Preservar a atomicidade da transição real para `CONCLUIDO`, dos dados de solução/protocolo e da criação do feedback existente. Uma falha intermediária não deixa gravações parciais; concorrência e nova tentativa não duplicam feedback nem produzem duas conclusões. Manter CAS e todas as permissões vigentes.
5. Notificações, Agenda Alpha e demais efeitos externos permanecem após o commit e fora da repetição transacional. As tentativas revertidas não disparam esses efeitos. Falha pós-commit não deve provocar repetição da conclusão persistida nem uma mensagem que induza o usuário a concluir de novo.
6. Se a contenção persistir até o limite, os dois fluxos devolvem orientação segura para aguardar e tentar novamente, sem SQL, stack ou credenciais na interface e sem falso sucesso. Logs sanitizados permitem reconhecer a operação e a falha.
7. Regressões cobrem sucesso após bloqueio transitório, esgotamento do limite, rollback integral, falha de negócio sem repetição, permissões reavaliadas, conclusão concorrente/repetida, unicidade de feedback e efeitos pós-commit. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados reais e eventuais impedimentos.
8. Publicar e validar o delta autorizado primeiro em `https://staging.alpha-comex.com`, preservando trabalhos alheios, dados e ambientes separados. Não alterar estrutura, executar migration/seed/backfill ou mutação em massa. Se isso se tornar necessário, interromper apenas essa operação e cumprir Vault, backup verificado e confirmação específica. Não promover nem configurar produção sem pedido explícito posterior.
9. Antes de concluir, atualizar checklist, File List, diagnóstico, evidências, resultados e limites de validação desta story. Diferenciar correção local, teste automatizado, deploy staging e teste autenticado efetivamente realizados.

## Tasks / Subtasks

- [x] Confirmar destino e verificar integridade somente leitura, com evidências sanitizadas e limites (AC: 1, 2).
- [x] Mapear conclusão rápida e com protocolo, transação compartilhada e efeitos pós-commit (AC: 2, 4, 5).
- [x] Reproduzir bloqueio em teste isolado antes da correção (AC: 2, 7).
- [x] Aplicar repetição limitada da transação integral revertida, preservando revalidação e CAS (AC: 3, 4).
- [x] Ajustar retorno seguro de contenção persistente nos dois fluxos e conferir falhas pós-commit (AC: 5, 6).
- [x] Validar rollback, concorrência, feedback único, permissões e ausência de efeitos duplicados (AC: 4, 5, 7).
- [x] Executar regressões dirigidas, lint, typecheck, testes completos e build (AC: 7).
- [ ] Revisar o delta e publicar/validar staging pelo fluxo DevOps autorizado (AC: 8).
- [x] Consolidar diagnóstico, resultados, limitações, checklist e File List (AC: 9).

## Dev Notes

### Contratos e referências existentes

- `docs/stories/story-rm-2026-a6f2c9-chamados-feedback-preferencia-prazo.md#acceptance-criteria`: feedback pendente nasce na mesma transação de uma nova conclusão real; há no máximo um feedback por chamado; somente o técnico efetivamente vinculado pode finalizar. Os AC 8–10 e 15 são contratos existentes, não autorização para migration nesta correção.
- `docs/stories/story-rm-2026-a6f2c9-chamados-feedback-preferencia-prazo.md#fluxos-existentes`: conclusão rápida usa `updateChamadosStatus` em `src/actions/chamados.ts`; protocolo usa `finalizarComProtocolo` em `src/actions/protocolos.ts`; serviço comum em `src/lib/chamados/conclusao.ts`.
- `docs/stories/story-chamados-notificacoes-abertura-conclusao.md#acceptance-criteria`: notificação de conclusão existe nos dois fluxos; falha de notificação não desfaz conclusão persistida.
- `docs/stories/story-crm-erro-salvar-concluir-tarefa-maria.md#implementação`: correção anterior de bloqueio no CRM usa `repetirTransacaoOcupada` em `src/lib/bpm/sqlite-busy-retry.ts`, limitado à transação inteira revertida, com CAS e efeitos externos após commit. É precedente técnico a avaliar, não prova do incidente atual.
- `AGENTS.md#fluxo-de-ambientes--staging-primeiro`: staging primeiro, destino conferido e bancos separados; produção depende de solicitação explícita posterior.
- `AGENTS.md#database-safety-and-backup-policy-non-negotiable`: estrutura/migration/mutações em massa dependem de Vault, backup verificado e confirmação explícita. Esta story propõe correção de código e diagnóstico somente leitura.

### Pontos de implementação a examinar

Serviço `src/lib/chamados/conclusao.ts`, entradas `src/actions/chamados.ts` e `src/actions/protocolos.ts`, helper existente `src/lib/bpm/sqlite-busy-retry.ts` e testes em `tests/chamados/`. As referências anteriores já descrevem esses pontos; confirmar o código atual antes de editar. Novos arquivos e alterações efetivas devem entrar na File List durante a implementação.

Não foi localizada orientação específica nos documentos de arquitetura configurados para esta correção: `docs/architecture/index.md` e `docs/framework/` não estão disponíveis. Não foi localizado `accumulated-context.md` nem `.aiox/gotchas.json`; a coerência entre stories foi conferida pelos três artefatos de Chamados/CRM citados. Nenhuma tecnologia ou tabela nova é requisito desta story.

### Decisões da preparação

- [AUTO-DECISION] Qual epic e numeração usar? → Story de correção independente com nome solicitado pelo executor principal, seguindo os arquivos de correção já existentes; a fonte é o pedido direto, sem criar epic ou integração externa.
- [AUTO-DECISION] Qual ambiente recebeu o erro? → Não presumir. O diagnóstico deve conferir o destino; desenvolvimento e validação da correção começam em staging conforme regra vigente.
- [AUTO-DECISION] Autoriza concluir um chamado real para testar? → Não. Usar fixtures/banco isolado para regressões; disponibilidade e testes autenticados em staging devem ser distinguidos nas evidências.

## Testing

Seguir Vitest e os testes existentes em `tests/chamados/conclusao-feedback.test.ts`, `tests/chamados/finalizar-rapido-feedback.test.ts` e `tests/chamados/finalizar-protocolo-agenda.test.ts`. Reusar o contrato do helper já testado em `tests/bpm/sqlite-busy-retry.test.ts` se adequado ao erro reproduzido. Além de mocks, verificar atomicidade em banco local isolado quando necessário para demonstrar rollback real. Não repetir operações com resultado de commit desconhecido como se houvessem sido revertidas. Não executar migration em staging ou produção para preparar fixtures.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** API; secundários Integration e Security; complexidade média. Não é mudança de schema.

**Specialized Agents:** `@dev` implementa e revisa antes do commit; `@qa` valida regressões, atomicidade e permissões; `@devops` conduz publicação staging e eventual PR; `@architect` somente se houver mudança de contrato/padrão; Vault somente se surgir operação de banco sujeita à política.

**Quality Gate Tasks:**

- [x] Pre-Commit (@dev): revisar delta, regressões, quatro gates e CodeRabbit se disponível; documentar indisponibilidade e revisão alternativa conforme configuração do projeto.
- [ ] Pre-PR (@devops), se houver PR: revisar integração, escopo e compatibilidade sobre a branch staging atual.
- [x] Pre-Deployment staging (@devops): conferir destino, escopo, resultados e reversão por código. Pre-Deployment de produção não se aplica ao escopo autorizado.

**Self-Healing Configuration:** `@dev` light, 2 iterações/15 minutos, correção automática somente CRITICAL e HIGH documentado; `@qa` full, 3 iterações/30 minutos para CRITICAL/HIGH e MEDIUM documentado como dívida; `@devops` check, somente reporte.

**Focus Areas:** classificação restrita de bloqueio transitório, transação integral, rollback, CAS, permissões por tentativa, feedback único, efeitos externos após commit, erro seguro e preservação dos ambientes/dados.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** A falta de horário/ID/ambiente do incidente é uma limitação explícita a investigar, sem impedir reprodução isolada e correção do caminho demonstrado. Esta preparação não comprova integridade, causa, implementação, execução de gates ou deploy.

## Dev Agent Record

### Agent Model Used

Codex — executor @dev; @sm preparou story; @qa revisa; @devops publica exclusivamente staging.

### Debug Log References

- `/tmp/chamados-busy-20261026-runtime-sanitizado.json` — três erros Prisma de produção na rota `/PainelAlpha/Chamados`: 12:40:07.052Z, 12:40:10.529Z e 12:40:31.916Z em 26/10. Sem contexto para atribuição a um ID de chamado ou ação específica.
- `/tmp/chamados-integridade-producao-20261026.json` e `/tmp/chamados-integridade-staging-20261026.json` — diagnósticos somente leitura com destinos conferidos. Staging usa `.env.staging.local` e banco `painel-alpha-staging`; produção foi consultada separadamente via `.env.local`, sem copiar dados/credenciais ou executar mutações.
- `/tmp/chamados-regressao-antes-20261026.log` — regressões sem retry: 4 falhas/6 sucessos; rejeições das expectativas assíncronas acompanham a ausência de recuperação. Não é resultado pós-correção.
- `/tmp/chamados-sqlite-real-20261026.log` — teste de lock entre processos revelou erro encapsulado em `meta.driverAdapterError.cause.originalMessage`, corrigido no detector compartilhado.
- `/tmp/chamados-focados-20261026.log` — 27 arquivos/181 testes PASS, incluindo ambos os fluxos e SQLite descartável.
- `/tmp/chamados-lint-focado-20261026.log`, `/tmp/chamados-typecheck-root-20261026.log` — PASS. O lint completo do root sujo esgotou heap padrão; nova execução com heap ampliado foi encerrada por recursos. O candidato isolado passou no lint completo sem erros (warnings herdados).
- `/tmp/chamados-test-root-20261026.log` — suíte root: 5.392 testes aprovados, 4 skipped, 1 todo, 1 falha preexistente no teste `novo-card-modal-react` por tema CRM modificado em trabalho alheio. O candidato isolado deve ter gates próprios.

### Completion Notes List

- **Causa demonstrada:** a conclusão compartilhada fazia apenas uma transação sem recuperação de contenção. O protocolo repassava qualquer `Error.message` à tela. O relato é compatível com os logs e o lock foi reproduzido com Prisma/libSQL real em SQLite temporário, mas os logs não identificam a transação concorrente que segurou a escrita em produção.
- **Correção:** `concluirChamadoComFeedback` reutiliza o helper canônico: até quatro tentativas totais, esperas de 200/400/800 ms, sempre reiniciando a transação inteira após sua rejeição. ACL, técnico responsável, estado e CAS são reavaliados. Status, solução/protocolo e feedback continuam atômicos; notificações e Agenda permanecem após commit, fora do retry. Contenção persistente produz `BANCO_OCUPADO` com orientação segura e log sanitizado por chamado/técnico. Erros inesperados do protocolo são registrados no servidor e ocultados na interface.
- **Referência técnica:** [SQLite — isolamento e concorrência](https://www.sqlite.org/isolation.html) descreve serialização de escrita e reinício da transação após snapshot invalidado; [códigos SQLite](https://www.sqlite.org/rescode.html#busy) distingue contenção de corrupção. O diagnóstico deste incidente deriva dos logs e da reprodução, sem inferir corrupção a partir de `SQLITE_BUSY`.
- **Detector compartilhado:** agora reconhece `SQLITE_BUSY` também no código do erro e na cadeia `meta.driverAdapterError.cause`, com proteção contra ciclos. `P1008`, `SocketTimeout`, constraint ou falha de negócio isolados não são repetidos. Nenhum retry global de consultas foi introduzido.
- **Integridade:** `PRAGMA integrity_check('chamados')` e `integrity_check('chamados_feedback')` retornaram `ok` nos dois ambientes; `foreign_key_check` não encontrou violações. Feedbacks órfãos/incompatíveis e duplicados: zero. Todas as conclusões não próprias desde 15/10 têm feedback, inclusive a conclusão de 26/10 em produção (uma conclusão/um feedback). Sem identificação do usuário não se afirma que essa linha é o chamado relatado.
- **Limites físicos:** `PRAGMA quick_check` geral de produção retornou `ok`. `integrity_check` integral geral e quick_check geral de staging excederam timeout; verificações integrais das duas tabelas afetadas concluíram. Não se declara auditoria completa de todos os índices do banco.
- **Histórico:** os dois bancos já contêm os mesmos 154 chamados concluídos sem técnico, dos quais 115 sem `closedAt`; os registros desse grupo foram criados até 31/08/2026. São lacunas históricas distintas da conclusão atual. Não foram preenchidas por inferência. Uma consulta inicial de feedback recente misturava datas textuais e numéricas; foi substituída pela contagem com normalização de tipos, cujo resultado correto é zero pendências ausentes.
- **Testes reais:** segunda conexão em processo separado reserva escrita durante a conclusão, a primeira transação falha por lock, nenhum dado parcial persiste, a segunda confirma uma única conclusão com protocolo e um feedback. Trigger de falha de feedback comprova rollback também após o update; duas conclusões concorrentes geram um único sucesso. Testes das duas actions comprovam ausência de efeitos durante retry, um único envio após commit e sucesso preservado se a Agenda falha depois.
- Nenhum chamado real foi concluído para testes; sem alteração estrutural/migration/seed/backfill ou mutação em massa, portanto não houve operação sujeita ao gate Vault. Produção permanece sem publicação/configuração.
- **Release:** candidato isolado parte de `origin/staging` em `1c8c5d40c38dad379da805c2d83fbdf4f4cf2897`; o root estava divergente e contém trabalho alheio preservado. Build encontrou limites locais de disco/quotas; apenas caches e artefatos desta tarefa foram descartados/reposicionados, sem alterar configuração do aplicativo. Build original do candidato PASS às 13:00:50 UTC; lint completo PASS sem erros; typecheck independente PASS às 13:09:35 UTC. Primeira suíte com ambiente cloud injetado teve interferência de flags em testes alheios; segunda execução saturou workers/memória com timeouts. Gate final completo resolvido: `TMPDIR=/tmp npm test -- --maxWorkers=2 --coverage.reportsDirectory=/tmp/chamados-qa-final-suite2-coverage-20261026` PASS, exit 0, 778 arquivos e 6.483 testes aprovados, quatro skipped e um todo, em 116,59 s. Nenhum código ou timeout foi alterado para acomodar o runner. Revisão @qa final APPROVED para staging; 181 focados e 69 dos consumidores BPM também aprovados. Deploy staging é o próximo passo autorizado.
- CodeRabbit indisponível; revisão independente @qa realizada conforme degradação prevista no projeto. Audit de dependências do candidato registra dívida herdada (120 vulnerabilidades, 10 críticas), sem delta de `package.json`/lock/dependências; não é declarado audit PASS.

### Registro DevOps antes da publicação

- Candidato isolado na base `1c8c5d40c38dad379da805c2d83fbdf4f4cf2897`, com somente nove arquivos autorizados; manifesto sanitizado `/tmp/chamados-busy-20261026-release-manifest.json`. Schema, dependências, configuração Next e ambientes não têm delta. Oito fontes/testes têm paridade SHA-256 com o root revisado.
- Gates completos: lint com heap 8 GB e zero erros (1.183 avisos herdados), typecheck independente, build original e suíte completa aprovados. Resultados: `/tmp/chamados-busy-20261026-candidate-build-verified-result.json`, `/tmp/chamados-busy-20261026-candidate-typecheck-result.json`, `/tmp/chamados-busy-20261026-candidate-lint-verified.log`, `/tmp/chamados-qa-final-suite2-result-20261026.json`.
- Banco de build conferido por `.env.staging.local`: `painel-alpha-staging`, `VERCEL_TARGET_ENV=staging`. Testes finais usam somente fixtures sintéticas locais e contexto unitário padrão. Nenhuma migration/mutação real é executada.
- Rollback de código disponível: SHA base acima/deployment staging anterior `dpl_DzhBPKDEnFzcg3wtNLuhv8wrhTLD`; não foi executado. Branch main e produção permanecem fora do escopo. Pre-PR não se aplica: não há PR nesta publicação direta staging autorizada.

### File List

- `docs/stories/story-chamados-conclusao-sqlite-busy.md`
- `src/lib/chamados/conclusao.ts`
- `src/actions/protocolos.ts`
- `src/lib/bpm/sqlite-busy-retry.ts`
- `tests/chamados/conclusao-feedback.test.ts`
- `tests/chamados/finalizar-protocolo-agenda.test.ts`
- `tests/chamados/conclusao-sqlite.test.ts`
- `tests/chamados/conclusao-actions-retry.test.ts`
- `tests/bpm/sqlite-busy-retry.test.ts`

## QA Results

### Revisão independente — 2026-10-26 — Quinn (@qa)

**Patch: APPROVED / apto a staging. Gate da release: NEEDS_WORK, pendente da suíte completa do candidato.** Nenhum achado bloqueante no delta revisado. Esta aprovação técnica do patch não aprova a entrega completa com testes pendentes/falhando e não autoriza produção.

- Inspeção confirmou repetição somente de `db.$transaction`, no máximo quatro tentativas com 200/400/800 ms entre elas. ACL, técnico e estado são relidos a cada tentativa; CAS e feedback único permanecem transacionais. Código `P1008`/`SocketTimeout` isolado não dispara repetição: exige evidência explícita de `SQLITE_BUSY` na cadeia de erro, inclusive no envelope Prisma.
- Regressões independentes: **27 arquivos / 181 testes PASS** de Chamados/helper; **3 arquivos / 69 testes PASS** dos consumidores BPM (edição de card, movimento livre e helper; três testes do helper também integram a primeira execução). ESLint focado e `git diff --check` do delta passaram. Logs: `/tmp/chamados-qa-focados-20261026.log`, `/tmp/chamados-qa-bpm-20261026.log`, `/tmp/chamados-qa-lint-20261026.log`.
- AC 3/4/7: testes cobrem lock real em processo SQLite separado, rollback de status/protocolo quando feedback falha, uma única conclusão entre concorrentes, feedback único, ACL revogada entre tentativas, limite de repetição e falha de integridade sem repetição. AC 5/6: ambos os fluxos usam o serviço real nos testes de integração, sem efeitos antes de commit; notificação/Agenda executam uma vez após recuperação; erro da Agenda após commit não repete conclusão. Erros técnicos do protocolo ficam fora da resposta pública.
- AC 1/2: evidências de leitura conferidas. `integrity_check` das tabelas de chamados/feedback retornou `ok` nos dois ambientes, FK sem violações e nenhuma conclusão recente sem feedback. `quick_check` global de produção retornou `ok`; global de staging atingiu timeout, portanto integridade global completa de staging não foi demonstrada. Os 154 chamados sem técnico (115 também sem data de conclusão) foram criados até 2026-08-31 e são iguais nos dois ambientes; não foram alterados nem atribuídos ao incidente. Três logs de lock na página em produção às 12:40 UTC não identificam o chamado ou a transação exata.
- AC 7/8/9: DevOps ainda deve concluir suíte completa e registrar deploy/validação staging e checklist/File List. A suíte candidata anterior falhou principalmente com timeouts de testes/hooks/subprocessos e de início de workers; foi solicitada nova execução com concorrência limitada (`--maxWorkers=4`), sem alterar testes/timeouts para ocultar falhas. Build verificado aprovado; typecheck final aprovado informado pelo executor e lint completo com zero erros/avisos herdados.
- **Dívida separada: CONCERNS.** Audit do grafo herdado registra 120 vulnerabilidades, incluindo dez críticas; package/lock sem delta no escopo. Esta revisão não declara audit PASS nem remedia/dispensa essa dívida. CodeRabbit não instalado; revisão manual independente aplicada conforme degradação prevista na configuração.

Nenhum código alterado durante a revisão. Somente esta seção recebeu o parecer; gate final permanece pendente da evidência da suíte completa do candidato e da validação staging.


### Atualização do gate — 2026-10-26 — suíte completa aprovada

**APPROVED — liberação técnica para publicar e validar exclusivamente em staging.** O gate de testes pendente foi resolvido por configuração do runner, sem alterar código, fixtures, critérios ou limites de timeout. A confirmação do deploy/alias staging permanece a cargo do DevOps; nenhuma promoção a produção foi autorizada.

- Executado no candidato isolado atualizado: `TMPDIR=/tmp npm test -- --maxWorkers=2 --coverage.reportsDirectory=/tmp/chamados-qa-final-suite2-coverage-20261026` — **exit 0, 778 arquivos PASS; 6.483 testes PASS, quatro skipped e um todo**, 116,59 s. Log integral: `/tmp/chamados-qa-final-suite2-20261026.log`; resultado sanitizado: `/tmp/chamados-qa-final-suite2-result-20261026.json`.
- Antes dessa aprovação, os quatro arquivos com timeout de fixture passaram isoladamente (32 testes), e os dois arquivos com timeout marginal da execução de um worker passaram isoladamente (30 testes). Todas as falhas anteriores foram mantidas nos logs; não foram chamadas de PASS. A execução final completa passou sem aumentar timeouts nem excluir testes. `TMPDIR=/tmp` mantém fixtures no tmpfs; o shell herdava `/var/tmp` no filesystem quase cheio. A concorrência de dois workers evitou a saturação observada nas execuções anteriores.
- Paridade SHA-256 confirmada entre os **oito arquivos de código/testes revisados no root e os oito arquivos do candidato**: `/tmp/chamados-qa-source-parity-20261026.json`. Build completo do candidato e typecheck tiveram exit 0, conforme os resultados verificados; lint completo apresentou zero erros e 1.183 avisos herdados. ESLint focado e diffcheck também passaram.
- Cobertura do escopo configurado no projeto: linhas 74,34%, funções 78,34%, statements 70,77% e branches 64,18%. Esses percentuais não representam cobertura específica de todo o módulo Chamados; seus cenários funcionais e de atomicidade foram verificados pelos testes dirigidos descritos acima.
- **CONCERNS separado e preservado:** dívida de dependências herdada e ausência de CodeRabbit. A aprovação do delta de código para staging não declara audit PASS. Validação autenticada na aplicação e promoção a produção não estão cobertas por este parecer.

Recomendação: DevOps pode completar a publicação de staging já autorizada pelo usuário/AGENTS, conferir SHA/ambiente/alias e executar o smoke apropriado. Atualizar checklist/File List e status no registro do executor; QA não alterou essas seções.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-26 | 0.1 | Preparação da correção a partir do relato direto, contratos existentes e checklist de draft. | River (@sm) |

| 2026-10-26 | 0.2 | Diagnóstico read-only, recuperação de lock na conclusão e detector Prisma, rollback/concorrrência comprovados em banco descartável; preparação de staging e gates em curso. | Dex (@dev) |
