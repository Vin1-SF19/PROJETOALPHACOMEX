# Story: Diagnosticar timeout e continuar coleta Logcomex interrompida

## Status

Ready for Review — implementação e testes focais concluídos; diagnóstico operacional específico da ocorrência permanece limitado pela telemetria disponível. Sem deploy ou retomada real executada.

## Story

Como usuário do Alpha Catcher, quero entender por que uma coleta Logcomex parou e continuar uma coleta interrompida sem perder nem duplicar resultados, para concluir a importação iniciada.

## Contexto e fontes

Relato do usuário: em 13/10/2026, uma coleta iniciada às 9h26 exibiu “A coleta excedeu 30 minutos. Os resultados já recebidos foram preservados.” No histórico, o início aparece e o fim consta como “não concluída”. Não há opção para continuar a coleta. O caso foi identificado como coleta de Andrew em produção. O horário relatado é o exibido ao usuário; os timestamps técnicos abaixo estão em UTC. A causa detalhada além do vencimento do limite permanece desconhecida sem telemetria da etapa/progresso, sem atribuí-la à Logcomex.

### Diagnóstico read-only de produção — 13/10/2026

Consulta somente leitura a metadados do histórico de Andrew; nenhuma coleta foi retomada e nenhuma escrita foi executada.

| Execução | Job ID | Início UTC | Fim da coleta UTC | Fim geral | Estado | Coletadas | Processadas |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| 9h26 exibido | `b0b213e2-5c4b-49d7-9ee1-f17b04078d3f` | `2026-10-13T12:26:18.433Z` | `2026-10-13T12:56:19.048Z` | `null` | `pendente` | 2.159 | 2.157 |
| 13h48 exibido | `d3804299-d8ef-44c4-a41f-0f38adb20fe5` | `2026-10-13T16:48:17.515Z` | `2026-10-13T17:18:18.237Z` | `null` | `pendente` | 2.165 | 1.842 |

Os dois `fimColeta` ocorreram aproximadamente 30 minutos após o respectivo início, compatíveis com o limite fixo do aplicativo. `fim: null` e `estado: pendente` indicam que o histórico não registra término geral da importação; as contagens mostram processamento parcial. Os metadados persistidos não incluem a última etapa ou progresso do coletor, portanto não permitem afirmar qual operação consumiu o tempo. A diferença entre coletadas e processadas não deve ser interpretada como causa do timeout da coleta.

Na versão que gerou essas ocorrências, um `setTimeout` de 30 minutos desde o início do job encerrava a coleta, incluindo o tempo de preparo, Gmail/OTP, CAPTCHA e captura. Ao vencer, o job passava a erro, o worker recebia SIGTERM e os pares já recebidos eram enviados ao histórico. O aviso comprova o vencimento daquele cronômetro do aplicativo, **não** identifica a etapa que consumiu o tempo nem prova falha da Logcomex. A implementação atual não tem limite total; mantém watchdog de inatividade de 30 minutos. O histórico deixa `fim` vazio até a coleta e a fila de consultas terminarem; sua ausência não prova que o worker ainda esteja ativo. [Fonte: histórico de produção e `src/lib/alpha-catcher/logcomex-job.ts` (`iniciarColeta`); `src/lib/alpha-catcher/historico.ts` (`terminarColeta`); `docs/alpha-catcher.md` (“Histórico persistente das importações Logcomex”).]

Decisão técnica da arquitetura: o histórico antigo armazena filtros e linhas de empresas, mas não possui checkpoint exato de página/perfil. A continuação relê o ranking com os mesmos filtros e reconcilia CNPJs e nomes com o histórico persistido; pode haver releitura de páginas, sem duplicar empresas ou perder resultados. Não apresentar isso como continuação exata da posição remota. [Fonte: `src/lib/alpha-catcher/historico-tipos.ts`; `scripts/alpha-catcher-logcomex.mjs`; `docs/alpha-catcher.md` (“Diagnóstico de coleta parcial”).]

Evidência de duração: uma execução externa via CLI do usuário levou aproximadamente 4h30 para coletar 16.500 empresas. O antigo limite total de 30 minutos do job do painel era inadequado para esse volume. A coleta agora não possui limite total; encerra após 30 minutos sem mensagens do worker. Essa evidência não demonstra a etapa exata em que a coleta de Andrew parou.

Stories relacionadas: `docs/stories/story-alpha-catcher.md` (coleta, fila e histórico), `docs/stories/story-alpha-catcher-logcomex-worker-persistente.md` (bridge e limites de restart), `docs/stories/story-alpha-catcher-worker-producao-independente.md` (ambiente de produção). `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no repositório; essas stories e o guia operacional são o contexto acumulado disponível.

## Acceptance Criteria

1. O incidente de 13/10/2026 é investigado por job, ambiente e linha do tempo: início, última etapa/progresso conhecido, vencimento do cronômetro, encerramento do worker e estado da fila/histórico. A conclusão separa fatos observados, inferências e lacunas de telemetria. Os metadados read-only acima são evidência parcial; a última etapa e a causa específica ainda requerem telemetria, se disponível. Logs e relatório não expõem credenciais, OTP, cabeçalhos BI ou dados de empresas.
2. O limite de 30 minutos e seu ponto de início ficam documentados e observáveis na operação. Quando a coleta for interrompida, o usuário vê motivo conhecido, etapa/progresso disponível e indicação clara de que o fim do histórico permanece pendente enquanto a fila não termina; se a causa além do timeout não for verificável, isso é informado sem atribuí-la à Logcomex.
3. Existe caminho operacional via CLI para inspecionar uma coleta interrompida e iniciar sua continuação autorizada, com verificação de usuário/proprietário, estado, filtros originais e execução ativa. A UI oferece a ação correspondente no histórico apenas quando a continuação é permitida. CLI e UI usam o mesmo contrato de domínio/servidor.
4. A continuação preserva os pares e resultados persistidos. CNPJs já recebidos não são perdidos nem contabilizados duas vezes; empresas já salvas ou existentes não são recriadas nem reconsultadas sem necessidade. O histórico permite entender o vínculo entre a tentativa original e a continuação, sem transformar a tentativa interrompida em conclusão fictícia.
5. A continuação de histórico antigo relê o ranking com os filtros originais e reconcilia CNPJs e nomes persistidos, informando que páginas podem ser relidas. Não depende de checkpoint exato inexistente nem apenas da memória do processo. Testes verificam idempotência e preservação dos resultados mesmo se os nomes reaparecerem ou forem atualizados na fonte.
6. Recarregamento da página, reinício do worker, polling repetido e duas tentativas simultâneas não criam continuações duplicadas nem deixam o histórico em estado de sucesso falso. Falha de acesso, CAPTCHA, worker indisponível ou nova interrupção preserva o progresso e apresenta estado/ação coerentes.
7. O backend não impõe limite total de duração à coleta. Mantém o encerramento após 30 minutos sem mensagens do worker. O teste cobre coleta superior a 8 horas com atividade, interrupção por inatividade e espera de CAPTCHA; polling da UI ou mera permanência do processo não renova a inatividade.
8. Testes com fixtures/doubles cobrem timeout, continuação parcial, deduplicação, autorização, concorrência, restart, erro e histórico. Nenhuma coleta externa real ou gravação em banco real é executada para validar a story. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, File List e resultados reais antes de concluir.

## Tasks / Subtasks

- [x] Correlacionar metadados read-only das duas execuções de produção e registrar limite da evidência (AC 1–2). Telemetria de etapa/progresso e causa detalhada ainda indisponíveis.
- [x] Registrar e implementar decisão técnica: ranking relido com filtros originais, reconciliação por CNPJ/nome, duração total ilimitada e interrupção após 30min sem mensagens do worker (AC 4–5, 7).
- [x] Implementar contrato de inspeção/continuação via CLI e servidor com autorização e controle de concorrência (AC 3–6).
- [x] Expor continuação elegível e motivo/estado no histórico da UI (AC 2–3, 6).
- [x] Validar cenários com doubles, executar gates e registrar File List/checklist (AC 8). Suíte global mantém falhas alheias listadas no Dev Agent Record.

## Dev Notes

Pontos de integração: `src/lib/alpha-catcher/logcomex-job.ts`, `src/lib/alpha-catcher/historico.ts`, `src/lib/alpha-catcher/historico-tipos.ts`, `src/app/api/alpha-catcher/logcomex/route.ts`, `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`, `scripts/alpha-catcher-logcomex.mjs`, `scripts/alpha-catcher-stream.mjs`, `tests/alpha-catcher/` e `docs/alpha-catcher.md`. O worker usa estado em memória e bridge de instância única; persistência do histórico não equivale a checkpoint do coletor. A fila de enriquecimento e a coleta Logcomex são etapas diferentes e devem ser diagnosticadas separadamente.

Decisão da arquitetura: reler ranking e reconciliar resultados persistidos; duração total ilimitada e interrupção após 30min sem mensagens do worker. A medição externa de ~4h30/16.500 empresas sustenta remover o teto total; o watchdog de inatividade protege contra jobs travados. [AUTO-DECISION] Prometer página exata? → Não; histórico antigo não contém checkpoint. [AUTO-DECISION] Migration/backfill? → Não presumidos. Se necessários, acionar Vault e cumprir backup verificado e confirmação específica de `AGENTS.md` antes de qualquer execução.

## Testing

Os testes focais com fixtures/doubles cobrem coleta superior a 8h sem limite total, inatividade de 30min, resultado parcial, releitura/reconciliação, autorização, concorrência, falha e histórico. Nenhuma coleta externa real ou retomada de Andrew foi feita. Resultados dos gates estão no Dev Agent Record; o ambiente global ainda tem falhas alheias a esta story.

## CodeRabbit Integration

**Story Type Analysis:** Integration; secundários API, Frontend e Security; complexidade alta.

**Specialized Agents:** @dev execução, @architect decisão de checkpoint/timeout, @qa cenários de continuação e concorrência, @github-devops gates de publicação se houver deploy.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops se houver PR; Pre-Deployment @github-devops se houver publicação. Foco: idempotência, ownership, contrato do histórico, progresso após restart, limite de execução e ausência de segredos.

**Self-Healing Configuration (Story 6.3.3):** @dev light, 2 iterações/15 minutos, CRITICAL auto-fix e HIGH documentado; @qa full, 3 iterações/30 minutos, CRITICAL/HIGH corrigidos e MEDIUM documentado; @github-devops check, report only. Registrar indisponibilidade da CLI conforme configuração do projeto.

## File List

- `docs/stories/story-alpha-catcher-logcomex-retomada-timeout.md`
- `docs/alpha-catcher.md`
- `scripts/alpha-catcher-logcomex.mjs`
- `scripts/alpha-catcher-stream.mjs`
- `scripts/alpha-catcher-retomar.mts`
- `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`
- `src/app/PainelAlpha/AlphaCatcher/HistoricoConsultas.tsx`
- `src/app/api/alpha-catcher/logcomex/route.ts`
- `src/app/api/alpha-catcher/historico/route.ts`
- `src/app/api/alpha-catcher/historico/[id]/route.ts`
- `src/app/api/internal/alpha-catcher/worker/route.ts`
- `src/lib/alpha-catcher/historico-tipos.ts`
- `src/lib/alpha-catcher/historico.ts`
- `src/lib/alpha-catcher/logcomex-job.ts`
- `src/lib/alpha-catcher/worker-client.ts`
- `src/lib/alpha-catcher/worker-executar.ts`
- `tests/alpha-catcher/client-stream.test.ts`
- `tests/alpha-catcher/historico-api.test.ts`
- `tests/alpha-catcher/historico-ui.test.ts`
- `tests/alpha-catcher/historico.test.ts`
- `tests/alpha-catcher/logcomex-api.test.ts`
- `tests/alpha-catcher/logcomex-job.test.ts`
- `tests/alpha-catcher/stream.test.ts`

## Story Draft Checklist

| Categoria | Resultado | Evidência / pendência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Incidente, benefício e relação com coleta/histórico definidos |
| Orientação técnica | PASS | Releitura/reconciliação para históricos sem checkpoint e novos limites decididos |
| Referências | PASS | Código e documentação relacionados identificados |
| Autossuficiência | PASS | Limite, histórico, segurança e comportamento de continuação descritos |
| Testes | PASS | Cenários de timeout, deduplicação, restart e autorização definidos |
| CodeRabbit | PASS | Tipo, agentes, gates e self-healing definidos |

**Readiness: READY FOR REVIEW**; a causa detalhada da ocorrência de Andrew em produção permanece desconhecida sem telemetria. Clareza 9/10. Testes focais aprovados; falhas da suíte global registradas abaixo. Nenhum deploy, alteração de banco ou coleta real foi executado nesta entrega.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-13 | 1.0 | Diagnóstico e continuação de coleta Logcomex após timeout | River (@sm) |
| 2026-10-13 | 1.1 | Decisão de releitura/reconciliação e limites de 8h/30min; causa operacional específica ainda desconhecida | River (@sm) |
| 2026-10-13 | 1.2 | Metadados read-only de duas execuções de Andrew em produção; sem retomada real | River (@sm) |
| 2026-10-13 | 1.3 | File List e gates da implementação; status Ready for Review | River (@sm) |
| 2026-10-13 | 1.4 | Removido o limite total de 8h a pedido do usuário; watchdog de 30min sem mensagens preservado | Dex (@dev) |

## Dev Agent Record / QA Results

Implementação de continuação por releitura de ranking e reconciliação, CLI, servidor e UI registrada na File List. A duração total agora é ilimitada; 30min sem mensagens do worker ainda encerra um job travado. Nenhum deploy ou retomada de coleta real foi executado; o caso Andrew permanece apenas diagnosticado por metadados read-only.

Gates reais: `npm run lint` terminou com 0 erros e 1.192 warnings; `npm run typecheck` PASS após a correção do CLI; build isolado do candidato PASS. Testes focais `tests/alpha-catcher/` executados fora do sandbox: 260/260 PASS. `npm test` global em Node 22: 4.440 passaram, 4 skipped, 1 todo e 2 falharam somente nos testes existentes de `tests/builder/embed.test.ts`, relacionados à serialização de URL no happy-dom. Backup remoto criado em `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-13T17-50-14-997Z.sql`, 216.650.820 bytes, 332 tabelas e 226.654 linhas; SHA-256, restauração SQLite, `integrity_check` e `foreign_key_check` aprovados. O manifesto corresponde ao banco remoto. Nenhuma alteração no banco ou retomada foi executada.

Validação da alteração 1.4 neste ambiente: `tests/alpha-catcher/logcomex-job.test.ts` 12/12 PASS; `npm run lint` exit 0, 0 erros e 1.192 warnings; `npm run typecheck` PASS; `git diff --check` PASS. `npm test` em Node 20.20.2: 4.449 testes passaram, 4 skipped, 1 todo e 7 falharam em testes alheios por restrições `EPERM`, diferenças do happy-dom em `builder/embed.test.ts` e duas suítes que não carregaram `node:sqlite`. A alteração 1.4 não foi publicada.
