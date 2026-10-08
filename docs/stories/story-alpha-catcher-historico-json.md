# Story: Histórico das importações JSON do Alpha Catcher

## Status

Ready for Review — implementação e candidato de staging validados; recuperação real concluída e verificada; staging publicado e disponibilidade conferida. Smoke autenticado Lucca pendente.

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["testes focais", "lint", "typecheck", "test", "build", "revisão de ownership"]

## Story

Como usuário do Alpha Catcher, quero que importações por JSON criem histórico de consultas e que meu lote anterior de 2.491 CNPJs apareça nele, para acessar seus resultados após recarregar a aplicação.

## Contexto e referências

Pedido direto do usuário em 08/10/2026: “Eu preciso que importação por json também crie histórico e preciso que esse json apareça o histórico”. Não há epic específico fornecido; esta story deriva desse pedido e da implementação existente.

Fonte privada: `/tmp/empresas-28-09-2026-alpha-catcher.json`. Diagnóstico informado pelo agente principal: 2.491 CNPJs válidos distintos, todos presentes no banco; 2.375 com fonte Alpha Catcher JSON e data 28/09/2026 e 116 com outras fontes/datas. Esses números descrevem os cadastros atuais, não comprovam quantos foram novos naquela execução. Os horários de início/fim não estão comprovados. Não versionar arquivo, dump ou dados reais.

Referência de coerência: `docs/stories/story-alpha-catcher.md`, seções “Histórico persistente das importações Logcomex”, “Modal com lista exata da importação”, “Data original para importação JSON” e “Fonte correta por origem de importação”. `accumulated-context.md` e `.aiox/gotchas.json` não encontrados na busca; contexto acumulado usado é a story existente e o diagnóstico recebido. Configuração: `.aiox-core/core-config.yaml`; política de banco: `AGENTS.md`.

## Acceptance Criteria

1. Uma nova importação JSON válida cria um registro persistente próprio no histórico existente, com origem JSON, autoria autenticada e lista exata de CNPJs válidos únicos. Entrada inválida ou sem empresas válidas não cria lote de sucesso.
2. O histórico registra resultados reais do servidor e preserva os snapshots, a ordem e as datas de consulta. Total processado, novos, existentes e pendentes refletem resultados da execução; duplicatas ou retries não incrementam contagens duas vezes.
3. Pausa, erro, cancelamento, retry, reload e restart preservam o histórico e os resultados já persistidos. Execução incompleta permanece identificada como incompleta; fim só é registrado após término comprovado da execução. Nenhum resultado é inventado para completar a fila.
4. Histórico e detalhe JSON aparecem na lista e no modal existentes, respeitando permissão Alpha Catcher e ownership. Usuário não consegue ler, processar ou atualizar lote de outro usuário ou CNPJ fora do seu lote; origem e contadores não são confiados ao cliente.
5. A data personalizada escolhida para JSON continua aplicada somente na criação de novas empresas, preservada nos retries. Cadastros existentes mantêm fonte/data. Um `historicoId` JSON não transforma a fonte em Logcomex. Importações automáticas Logcomex e históricos legados seguem compatíveis.
6. Uma CLI prepara plano somente leitura para recuperar o arquivo privado: valida CNPJs, identifica autor e ambiente/banco, calcula identidade/checksum do lote, compara cadastros atuais e apresenta ações propostas. O plano demonstra 2.491 válidos únicos e nenhum ausente ou informa divergências sem aplicar alterações. Não consulta provedores nem reimporta empresas.
7. Recuperação aplica apenas registro(s) de histórico e seus snapshots em Auditoria existente, sem migration ou alteração de cadastros de empresas. Mesmo plano executado novamente não duplica histórico; execução parcial pode ser retomada sem duplicar linhas ou contagens. Autor deve ser identificado por evidência ou confirmado antes do apply.
8. Lote recuperado fica explicitamente identificado como reconstruído a partir do arquivo e cadastros atuais. Exibe os 2.491 CNPJs e resultados disponíveis, preservando datas atuais sem afirmar que são snapshots originais. Início/fim originais e quantidade de novas empresas são desconhecidos quando não houver prova, nunca preenchidos com hora da recuperação ou inferidos dos 2.375 cadastros. Timestamp de recuperação é apresentado separadamente, se registrado.
9. Apply real de recuperação somente após relatório Vault com ambiente, comandos, impacto, riscos, alternativa e rollback, backup completo verificável de no máximo 48 horas e confirmação específica do usuário. Dry-run é permitido antes; pedido genérico da feature não dispensa esse gate. Rollback afeta somente histórico criado pela recuperação e não remove cadastros existentes.
10. Testes focais verificam esses contratos e regressão Logcomex; executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, registrando resultados reais e falhas anteriores separadamente. Checklist e file list permanecem atualizados.

## Tasks / Subtasks

- [x] Mapear ciclo JSON, fila e persistência existente; definir contrato compatível para origem e informação reconstruída (AC 1–5, 8).
- [x] Implementar criação e acompanhamento persistente da importação JSON em serviço/API e CLI antes de UI (AC 1–5).
- [x] Integrar cliente ao histórico/modal existentes e manter data personalizada (AC 3–5).
- [x] Preparar recuperação CLI plan/apply/rollback idempotente com validação de identidade/autoria e dry-run read-only (AC 6–9).
- [x] Produzir relatório Vault, verificar backup e apresentar plano concreto ao usuário antes de qualquer apply real (AC 9).
- [x] Executar testes com dados sintéticos e gates; documentar entrega e atualizar file list (AC 10).
- [x] Após autorização específica, aplicar recuperação e verificar histórico/detalhe sem modificar empresas (AC 7–9).

## Dev Notes

Reutilizar `Auditoria` e snapshots em blocos do histórico existente; não introduzir schema/migration. O schema atual exige `inicio` e contagem `novasSalvas`, portanto a recuperação exige representação compatível de desconhecido/proveniência, sem fabricar valores para satisfazer schema. A rota de processamento atualmente decide `origem` pela simples presença de `historicoId`; ajustar para origem autenticada do lote, preservando Logcomex e JSON. A aceitação de empresa atualmente depende da execução em memória; recuperação após restart deve manter ownership e associação ao lote por dados persistidos.

Contrato aprovado comunicado pelo agente principal: origem ausente em legado assume LOGCOMEX; JSON inclui arquivo e dataConsulta; recuperação representa inicio/fim/novasSalvas originais como null e registra recuperadoEm separadamente. Conta confirmada para este lote: lucca@alpha-comex.com; resolver seu userId no ambiente correto e verificar no plano antes do apply. Não persistir informação além do necessário sobre caminho local do arquivo.

Referências técnicas: `src/lib/alpha-catcher/historico.ts` e `historico-tipos.ts` (resumo/snapshots), `access.ts` (auth/permissão), `src/app/api/alpha-catcher/route.ts` (resultado/fonte), `src/app/api/alpha-catcher/historico/route.ts` e `[id]/route.ts` (lista/detalhe), `scripts/alpha-catcher-history.mts` (CLI leitura), `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx` (fila/JSON), `HistoricoConsultas.tsx` e `ModalHistorico.tsx` (observabilidade).

[AUTO-DECISION] Nova tabela? → Reutilizar Auditoria (pedido do principal e padrão existente). [AUTO-DECISION] Reconsultar 2.491 empresas? → Não (todos já existem; solicitação é recuperar histórico). [AUTO-DECISION] Execução imediata do backfill? → Preparar somente dry-run até gate Vault específico. [AUTO-DECISION] Datas originais desconhecidas? → Identificar reconstrução e valores desconhecidos, sem inferência.

## Testing

Usar fixtures sintéticas em `tests/alpha-catcher/`, seguindo testes existentes de histórico, API, job e UI. Cobrir JSON inválido/vazio/duplicado, origem confiável, data escolhida, existente versus novo, autorização por usuário/lote/CNPJ, concorrência, persistência parcial, retry e restart; comprovar counters e snapshots. Recuperação: duas execuções do mesmo plano, retomada parcial, arquivo alterado/checksum, autor não identificado, ausentes/divergências, ausência de horários comprovados, zero escrita no dry-run e zero chamadas externas. Verificar leitura de legado Logcomex. Nunca incluir o JSON privado em fixtures.

## CodeRabbit Integration

**Story Type Analysis:** API; secundários Integration, Frontend, Security e recuperação de dados; complexidade alta.

**Specialized Agents:** @dev executor; @architect revisão de contratos/auth; @qa cobertura; @ux-expert compatibilidade UI; Vault e @db-sage para revisão da recuperação; @github-devops somente se houver PR/deploy.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops quando houver PR; Pre-Deployment @github-devops quando houver publicação. Foco: origem autenticada, ownership persistente, idempotência, datas, ausência de contadores inventados e compatibilidade Logcomex.

**Self-Healing Configuration (Story 6.3.3):** @dev light, máximo 2 iterações/15 minutos, CRITICAL auto-fix, HIGH documentado; @qa full, 3 iterações/30 minutos, CRITICAL/HIGH corrigidos, MEDIUM dívida; @github-devops check, somente relatório. CLI indisponível deve ser registrado conforme graceful degradation configurada.

## File List

- `docs/stories/story-alpha-catcher-historico-json.md`
- `docs/alpha-catcher-historico-json-vault.md`
- `docs/alpha-catcher.md`
- `src/lib/alpha-catcher/historico-tipos.ts`
- `src/lib/alpha-catcher/historico.ts`
- `src/lib/alpha-catcher/service.ts`
- `src/lib/alpha-catcher/recuperar-historico-json.ts`
- `src/app/api/alpha-catcher/route.ts`
- `src/app/api/alpha-catcher/importacoes/json/route.ts`
- `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`
- `src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx`
- `src/app/PainelAlpha/AlphaCatcher/ModalHistorico.tsx`
- `scripts/alpha-catcher-recuperar-historico-json.mts`
- `scripts/activate-alpha-catcher-json-history-stage.sh`
- `scripts/turso-backup.mjs`
- `tests/alpha-catcher/api.test.ts`
- `tests/alpha-catcher/service.test.ts`
- `tests/alpha-catcher/historico.test.ts`
- `tests/alpha-catcher/historico-json-api.test.ts`
- `tests/alpha-catcher/historico-ui.test.ts`
- `tests/alpha-catcher/recuperar-historico-json.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido exato, lote e limites probatórios documentados |
| Orientação técnica | PASS | Arquivos reais, reutilização de Auditoria e riscos fonte/restart |
| Referências | PASS | Story anterior, configuração e política de banco |
| Autossuficiência | PASS | Dados, contratos, bloqueio de apply e tratamento de desconhecido |
| Testes | PASS | Cenários positivos/negativos e gates reais |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e foco |

**Readiness: READY**, clareza 9/10. Implementação e plano podem iniciar; aplicar lote recuperado depende de autor comprovado, Vault, backup e confirmação específica. Validação documental; testes de aplicação ainda não executados nesta criação de story.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-08 | 1.0 | Story criada a partir do pedido e contexto existente | River (@sm) |

## Dev Agent Record / QA Results

Implementação 08/10/2026: JSON cria resumo/lista antes das consultas numa transação. API resolve origem, data e consignatário persistidos por autor; execução restaura contadores após restart. CREATE de empresa grava marcador importacaoId+userId no JSON já existente, permitindo reconhecer criação própria após falha entre CREATE e histórico. Cache/locks são por proprietário+UUID. Legado sem origem assume LOGCOMEX. Sem alteração de schema ou migration.

- Workspace: `npm run lint` exit0, 1.192 avisos anteriores; `npm run typecheck` exit0. `npm test` final antes de três testes adicionais de recuperação: 4.382 aprovados e duas falhas preexistentes em tests/builder/embed.test.ts (URL relativa vs resolvida).
- Candidato `/tmp/painel-alpha-json-history-candidate`: `npm run build` exit0; BUILD_ID `ODNoHIdSh-l1t8oiQ2nkB`. Dependências copiadas e Prisma gerado privadamente; nenhum comando de banco. Cache de disco webpack desabilitado só durante compilação e config original restaurado. Credenciais temporárias removidas.
- Candidato suíte final: 592 arquivos aprovados, um skipped; 4.385 testes aprovados, sete skipped, um todo. Apenas o patch já documentado de duas expectativas Builder foi aplicado na cópia isolada; implementação Builder e testes protegidos do workspace não mudaram. `.env.example` incluído para teste de segurança da voz.
- Focais: 68 aprovados antes de três testes adicionais de recuperação; recovery executor atual: cinco testes aprovados com apply idempotente, falha intermediária, autoria, rollback cirúrgico e conteúdo adulterado. Snapshot antigo não inventa horários/número de novas empresas.
- Runtime isolado: raiz HTTP200; rotas histórico e criação JSON HTTP401 sem sessão. Staging ativo não reiniciado. `bash -n` ativador e `git diff --check`: PASS.
- Logs em `/tmp/alpha-catcher-json-{lint-final,typecheck-final,build,candidate-tests-final,recovery-tests}.log`. Primeiro build sandbox falhou por download de Google Fonts; repetido com rede autorizada e aprovado. Primeiro typecheck sem heap configurado abortou; comando oficial com 8GB passou.
- Plano read-only real: 2.491 linhas, 26 novos registros Auditoria, conta lucca@alpha-comex.com, nenhum ausente. Arquivo privado e plano/dump ficam em diretórios ignorados; não versionar dados reais.
- Backup novo completo: 2026-10-08T17:26:30.019Z, 202.923.381 bytes, 332 tabelas/209.667 linhas; restauração SQLite com integrity/fk/hash/tamanho/contagens PASS. Relatório Vault em docs/alpha-catcher-historico-json-vault.md. Apply ainda não autorizado nem executado.
- Arquitetura e QA delegadas conforme Constitution; QA APPROVED para implementação/candidato local, com falhas globais anteriores separadas. CodeRabbit não executado nesta tarefa.
- Limite operacional: cache/fila serializados em um processo Node, como staging atual. Restart interrompe consultas do navegador preservando linhas gravadas; não fazer ativação durante processamento JSON ativo. Recuperação real e smoke autenticado Lucca pendentes de consentimento/ativação manual.


### Recuperação autorizada — 08/10/2026, após 18:20 UTC

Usuário confirmou explicitamente “Então eu autorizo” após apresentação dos 26 registros, backup, riscos e rollback. Vault atualizado para APROVADO antes da gravação. Backup revalidado por restauração SQLite real, 332 tabelas/209.667 linhas, hash/tamanho/foreign keys/integridade PASS; idade aproximadamente 0,91h. Plano SHA256 permaneceu 8731f57b491d6029762ddd62f1933cc3b615b4f326faf2a4314d41d5d8710f2f.

Primeira tentativa sofreu SQLITE_BUSY: transação abortada, conferência read-only comprovou zero resumos/zero blocos parciais. Repetição do mesmo comando autorizado terminou com exit0: inseridos26, auditoria resumo198, importacaoId90c21761-9587-40df-8a10-728ce070bec0. Verificação posterior comprovou exatamente um resumo e25blocos de conteúdo idêntico ao plano, listagem de lucca@alpha-comex.com inclui lote, detalhe tem2491CNPJs únicos e2491 permanecem no Consulta Radar. Sem alterações em consultas_radar, sem reconsultas externas ou migration.

Ativação da aplicação ainda pendente: sudo -n exige autenticação interativa do usuário. Candidato manifesto4302hashes íntegros, BUILD_ID ODNoHIdSh-l1t8oiQ2nkB, base staging20261008-150504-servicos-gerais-copa. Comando manual: sudo bash scripts/activate-alpha-catcher-json-history-stage.sh. Não reiniciar durante fila JSON ativa. Smoke autenticado após ativação permanece pendente.

### Ativação confirmada — 08/10/2026

Usuário executou sudo e publicou20261008-182531-alpha-catcher-json-history. Conferidos current e BUILD_ID ODNoHIdSh-l1t8oiQ2nkB; serviço active; raiz HTTP200; nova rota JSON HTTP401 sem sessão. Release anterior20261008-150504-servicos-gerais-copa preservada. Mensagem final herdada do ativador corrigida para /PainelAlpha/AlphaCatcher; bash -n PASS. Usuário deve atualizar Histórico na conta lucca@alpha-comex.com para smoke autenticado.

### Correção de classificação solicitada — 08/10/2026

Usuário definiu explicitamente: somente empresas com data_consulta correspondente a28/09/2026 12:00 America/Sao_Paulo devem aparecer Salvo; todas as demais Já no banco. Conferência read-only comprovou2375 no instante2026-09-28T15:00:00.000Z e116 outras. Esta regra substitui a classificação conservadora de todas as linhas como existente na recuperação inicial. NovasSalvas deve refletir2375 pela regra informada; início/fim originais seguem desconhecidos. Não aplicar essa regra geral a futuras importações ou outros históricos.

- [x] Preparar plano read-only para atualizar exclusivamente status e contador do lote90c21761-9587-40df-8a10-728ce070bec0, com snapshots anteriores e rollback CAS.
- [x] Validar critério exato de instante, ownership e ausência de mudanças Radar com testes/gates.
- [x] Obter relatório Vault, backup completo anterior à atualização e nova confirmação específica: consentimento anterior cobria somente inserts.
- [x] Aplicar e verificar2375Salvo/116existente/2491linhas no mesmo histórico, sem duplicá-lo.

File List adicional: src/lib/alpha-catcher/reclassificar-historico-json.ts; scripts/alpha-catcher-reclassificar-historico-json.mts; tests/alpha-catcher/reclassificar-historico-json.test.ts; docs/alpha-catcher-historico-json-reclassificacao-vault.md. Sem alteração da UI ou rebuild: build ativo já interpreta os estados salvo/existente e o contador persistido.

Validação da reclassificação: cinco testes focais PASS; lint exit0 (1.192 warnings anteriores), typecheck exit0. npm test: 593 arquivos e 4.391 testes aprovados; duas falhas preexistentes em Builder. Logs /tmp/alpha-catcher-reclassificacao-{tests,lint,typecheck,global}.log. git diff --check PASS. Operação por CLI sem mudança de runtime; build não necessário. Backup nativo apresentou upstream HTTP502 e nova tentativa foi interrompida por falta de progresso; fallback completo de leitura via Prisma em andamento. Nenhuma atualização executada.

Backup da reclassificação concluído via Prisma readonly: database-backups/pre-change/painelalpha_turso_pre_change_2026-10-08T18-47-58-926Z.sql e manifesto; 2026-10-08T18:47:59.133Z, 200.770.158 bytes, 332 tabelas/209.792 linhas, SHA256 0e9960def3331cf34b0fe26d84b0fde8dc7d1bc0f6e64860b69c037a950ea2ac. Identificação do banco adicionada ao manifesto a partir do mesmo ambiente confiável. Restauração real, hash, tamanho, integridade, foreign keys e contagens PASS usando TMPDIR=database-backups/pre-change; tmpfs /tmp gerou erro de I/O nas primeiras tentativas. Evidência /tmp/alpha-catcher-reclassificacao-backup-verify.log. Aguarda confirmação específica; apply não executado.

Reclassificação aplicada após consentimento específico “autorizo”. Vault APROVADO; executor revalidou backup, idade, banco e restauração antes de transação. Apply exit0: 26 registros atualizados. Verificação read-only posterior exit0 comprovou conteúdo exato do plano, sem duplicação, 2.491 CNPJs únicos, 2.375 salvo, 116 existente, novasSalvas=2375 e 2.491 cadastros presentes no Consulta Radar. Logs /tmp/alpha-catcher-reclassificacao-{apply,verify}.log. Sem escrita Radar ou alteração de schema; versão ativa já suporta classificação. Smoke visual autenticado depende de atualização do histórico pelo usuário.
