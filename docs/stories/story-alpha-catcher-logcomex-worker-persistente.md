# Story: Execução e acompanhamento Logcomex em worker persistente

## Status

Ready for Review. Implementação/candidato validados; ativação operacional pendente.

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["testes de contrato/auth", "lint", "typecheck", "test", "build"]

## Story

Como usuário autorizado do Alpha Catcher em produção, quero iniciar e acompanhar a coleta Logcomex sem perder a execução entre requisições, para receber progresso e resultados coerentes mesmo quando a aplicação usa instâncias distintas na Vercel.

## Contexto e referências

Bug reportado pelo agente principal: produção Vercel perde job em memória e retorna 404 “Execução não encontrada”. Evidência: `src/lib/alpha-catcher/logcomex-job.ts` mantém jobs e comandos em Maps de globalThis; `src/app/api/alpha-catcher/logcomex/route.ts` lê esse estado e retorna 404 quando ausente. Memória local de uma instância não é contrato de acompanhamento entre instâncias.

Arquitetura em análise: bridge remoto para servidor/worker persistente Alpha. Esta story não presume fornecedor adicional, nova tabela, migration ou backfill. Referências de coerência: `docs/stories/story-alpha-catcher.md`, `story-alpha-catcher-historico-json.md` e `story-alpha-catcher-historico-compartilhado.md`. `accumulated-context.md` e `.aiox/gotchas.json` não encontrados no carregamento anterior; essas stories fornecem contexto acumulado. Política: `AGENTS.md`; configuração: `.aiox-core/core-config.yaml`.

## Acceptance Criteria

1. Início, leitura de progresso, resultados e comandos de uma execução Logcomex usam o mesmo worker persistente através de contrato remoto definido pela arquitetura; acompanhamento não depende de Map na instância Vercel que recebeu o POST inicial. Requisições em instâncias diferentes conseguem acompanhar a execução aceita.
2. Identidade do job, autoria, estados, progresso e resultados permanecem coerentes durante toda a execução, inclusive coleta longa e requisições recebidas por instâncias Vercel distintas. Reload/restart não garantem retomada automática. Leitura não cria novo job, repete coleta ou inventa resultados. Worker/processo reiniciado deve reportar estado verificável de interrupção ou recuperar execução conforme contrato aprovado; não aparentar sucesso silencioso.
3. API pública mantém gate `acessoCatcher`: sem sessão 401, sem permissão módulo 403. Leitura/controle do job operacional permanecem restritos ao dono; compartilhar histórico não compartilha cancelamento, CAPTCHA ou execução. Não confiar em userId/origem enviados pelo cliente.
4. Cancelar, confirmar CAPTCHA e tentar CAPTCHA atingem a execução correta no worker e respeitam autoria, estado e ações permitidas. Comando de outro dono não muda execução; erros/timeout não são apresentados como comando confirmado.
5. Bridge e worker autenticam comunicação servidor a servidor. Credenciais, tokens Gmail/Logcomex e segredo do bridge não aparecem no cliente, URL pública, logs, respostas, Git ou arquivos públicos. O segredo dedicado é armazenado somente em configuração privada0600 no host e variável server-only na Vercel. Reutilizar manejo seguro existente; não criar transporte inseguro como workaround.
6. Na Vercel, configuração worker ausente/inválida falha de modo fechado com erro claro e seguro, sem fallback para fork/job local em memória nem criação de execução fictícia. Falha de rede/worker indisponível é distinguida de job realmente inexistente; preservar contrato 404 para ausência real ou job não autorizado sem vazar proprietário.
7. Contratos JSON/Logcomex e histórico persistente existentes continuam compatíveis. Associação ao histórico, snapshots, contadores, origem e datas mantêm significado; resultados não são duplicados por polling ou tentativas de comunicação. Não há migration/backfill presumido nem reimportação de lotes antigos.
8. CLI permite validar configuração/conectividade e os contratos do worker sem depender da UI, antes de conectar acompanhamento no cliente. Verificações automatizadas usam fixtures/doubles e não realizam coleta ou consultas externas reais sem autorização.
9. Testes comprovam início em uma instância e leitura em outra, polling repetido, indisponibilidade/configuração ausente, ownership de comandos/CAPTCHA, segredo ausente em payloads e compatibilidade do histórico. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados e atualizar checklist/file list.

## Tasks / Subtasks

- [x] Incorporar decisão @architect sobre endpoint, autenticação, ownership, configuração e persistência do worker (AC 1–7).
- [x] Definir contrato e validação CLI de início/status/comandos; testar configuração ausente e worker indisponível (AC 1, 4–6, 8).
- [x] Implementar bridge servidor a servidor e integração worker preservando autoria/segredos (AC 1–6).
- [x] Conectar rota e acompanhamento existentes ao contrato aprovado, sem fallback local Vercel (AC 1–7).
- [x] Testar instâncias distintas/reconnect/ownership/CAPTCHA/histórico e executar gates (AC 9).
- [x] Documentar configuração, diagnóstico e limitações de restart; atualizar file list/checklist (AC 2, 6, 8–9).

## Dev Notes

Arquivos reais para inspeção: `src/lib/alpha-catcher/logcomex-job.ts`, `src/lib/alpha-catcher/access.ts`, `src/lib/alpha-catcher/logcomex-input.ts`, `src/app/api/alpha-catcher/logcomex/route.ts`, `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`, `scripts/alpha-catcher-logcomex.mjs`, `src/lib/alpha-catcher/historico.ts`, `.env.example`. O job existente já trata cancela/CAPTCHA e histórico; manter esses comportamentos no worker.

Não escolher armazenamento, endpoint ou segredo por suposição: registrar decisão arquitetural antes da integração. Separar auth do bridge e auth do usuário; worker valida contexto confiável do servidor e ownership de cada ação. Workers indisponíveis devem produzir estado/erro explícito. Configuração de exemplo contém apenas placeholders; nunca dados reais.

[AUTO-DECISION] Fallback local na Vercel? → Bloqueado (reproduz bug e viola fail closed pedido). [AUTO-DECISION] Migration/backfill? → Não previsto. Se uma mudança de banco se tornar necessária, aplicar Vault/backup/confirmação específica antes de execução conforme AGENTS.md. [AUTO-DECISION] Executar coleta real na validação? → Não; doubles verificam contrato e segredo sem efeitos externos.

## Testing

Seguir fixtures em `tests/alpha-catcher/`: logcomex-api/job, histórico e stream. Testar transporte simulado compartilhado entre duas instâncias sem memória comum, estados terminais/em andamento/interrompidos, polling repetido sem duplicação, timeout/erro worker, configuração Vercel faltante, comando inválido, CAPTCHA e cancelamento owner/não owner, auth módulo e ausência de credenciais nas respostas/logs. Testar contratos legado e histórico compartilhado versus controle operacional restrito ao dono.

## CodeRabbit Integration

**Story Type Analysis:** Integration; secundários API, Security e Deployment; complexidade alta.

**Specialized Agents:** @dev executor; @architect contrato/segurança; @qa cenários entre instâncias; @github-devops configuração e publicação quando autorizadas.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops quando houver PR; Pre-Deployment @github-devops quando houver publicação. Foco: segredo servidor, auth/ownership, coerência de job, fail closed, erros e compatibilidade de histórico.

**Self-Healing Configuration (Story 6.3.3):** @dev light, 2 iterações/15 minutos, CRITICAL auto-fix e HIGH documentado; @qa full, 3 iterações/30 minutos, CRITICAL/HIGH corrigidos e MEDIUM dívida; @github-devops check, report only. CLI indisponível registrada conforme graceful degradation configurada.

## File List inicial

Criado: `docs/stories/story-alpha-catcher-logcomex-worker-persistente.md`.

Previstos, confirmar conforme arquitetura: serviço de bridge em `src/lib/alpha-catcher/`, `src/lib/alpha-catcher/logcomex-job.ts`, `src/app/api/alpha-catcher/logcomex/route.ts`, scripts de worker/CLI em `scripts/`, `.env.example`, testes `tests/alpha-catcher/`, `docs/alpha-catcher.md`. Cliente somente se contrato exigir. Sem schema/migration/backfill previstos.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Bug 404 e Map local comprovados |
| Orientação técnica | PARTIAL | Contratos definidos; arquitetura bridge em análise |
| Referências | PASS | Arquivos reais e stories anteriores |
| Autossuficiência | PASS | Auth/segredos/fail closed/ownership explícitos |
| Testes | PASS | Instâncias diferentes e negativas de segurança |
| CodeRabbit | PASS | Tipos, agentes, gates e self-healing |

**Readiness:** contratos/testes READY; decisão arquitetural é dependência antes da integração. Clareza 9/10; nenhuma implantação ou alteração de banco autorizada por esta documentação.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-09 | 1.0 | Story do bug de job Logcomex na Vercel | River (@sm) |

## Dev Agent Record / QA Results

Pendente de implementação. Nenhum código ou banco alterado na elaboração.

Arquitetura final: Vercel encaminha Logcomex, processamento e leituras de histórico para o mesmo worker, evitando inferência de interrompido/consultando com Map local de outra instância. Corpo assinado inclui operação e identidade derivada da sessão; HMAC fixa POST/path/issuer/audience e hash integral, TTL45s e nonce de uso único no processo. Receiver aceita somente host explícito foraVercel e revalida permissão efetiva no banco. Sem schema/migration. Reinício/deploy do host perde job/nonceMap; histórico persistido permanece e indica interrupção; não há retomada automática garantida.

## Dev Agent Record — implementação e validação

Implementados worker-auth.ts, worker-client.ts, worker-executar.ts e processar-entrada.ts; endpointinternal dedicado POST. Rotas públicasLogcomex,empresa,historico list/detail mantêm gate e origem/validação antesbridge. SemDDD/backfill ou login real. Workerprocessamentoeconsulta usamesmoowner e singleprocess; autorizaçõeshistóricos compartilhados preservadas.

Typecheck exit0; lint exit0,1192warningsanteriores;250testesAlphaCatcherPASS. Workspaceglobalsuite tem14falhasEstoque pelo arquivoPrisma query_compiler_bg.js ausente e2Builderanteriores; não alteradoPrismaworkspace. BuildisoladoPASS,BUILD_ID uM77P10Wju23nlN2OI_TU. Suítefinalcandidato com4workers/timeouts15s:595arquivos4415testesPASS,7skip1todo1fileskip. PatchBuilderprévio apenasna cópia isolada; primeirotestesconcurrentesbuildsofreramtimeouts eforamrepetidosapósbuild.

Smoke3317:raiz200;API públicaLogcomex401;histórico401;endpointinternalunsigned401;signedreadcomuser41/jobinexistente404 apóspermissãoDB; replay401. Sóleituras/chamadasrejeitadas,nenhumloginouimportaçãoreal. Chaveusadasintéticado teste, removidos.envtemporáriosapósteste.

Arquivos finais: src/lib/alpha-catcher/{worker-auth,worker-client,worker-executar,processar-entrada}.ts; src/app/api/internal/alpha-catcher/worker/route.ts; src/app/api/alpha-catcher/route.ts; src/app/api/alpha-catcher/logcomex/route.ts; src/app/api/alpha-catcher/historico/route.ts; src/app/api/alpha-catcher/historico/[id]/route.ts; tests/alpha-catcher/worker.test.ts; tests/alpha-catcher/{logcomex-api,historico-api}.test.ts; .env.example; scripts/activate-alpha-catcher-logcomex-worker-stage.sh; docs/alpha-catcher-worker-producao.md. Logs privados database-backups/build-candidates/logcomex-worker-*.log.

Publicação/variáveisVercel ainda pendentes; stagingativo não alterado. Ativadorvalidado bash-ngera/reusa segredo privado0600 em /home/ialpha/.config/painel-alpha/alpha-catcher-worker.env semimprimir. VercelprecisaURL=https://stagepainel-alpha.alpak.ai,mesmasecret e código corrigido publicado. Sem commit/push/deployVercel nestaentrega.

CLI operacional adicionada: scripts/diagnose-alpha-catcher-worker.mts [--user-id ID] [--job-id UUID], relatório mínimo sem segredo/dados de empresas; apenas ler/listar, nuncastart/processar. QAfinal APPROVEDfeature/candidato; workspaceglobalsuiteNEEDS_WORKporfalhas externasPrisma/Builder. Ativaçãooperacionalremota ainda pendente, não parte do checklist de implementação concluído.
