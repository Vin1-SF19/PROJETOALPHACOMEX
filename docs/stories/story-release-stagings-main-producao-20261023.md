# Story: promover integralmente os stagings dos dois painéis

## Status / Executor Assignment

Ready for Review — código, Forge completo e QA focal locais aprovados; rollout staging/produção e homologação remota pendentes.
executor: @dev (Echo, código) / @devops (Git, configuração e publicação); quality_gate: @qa; quality_gate_tools: [lint, typecheck, test, build, contrato, smoke].

## Story e autorização

Como responsável pelos dois painéis, quero promover todo o código aprovado dos stagings para main e produção, para disponibilizar as entregas com autenticação e integração funcionais.
Autorização literal do usuário, 23/10/2026: “preciso que analise todos os staging rodando inclusive as suas modificaçoes e mande para o Main, todos eles foram aprovados e podem ir para produção”.
[AUTO-DECISION] Nova aprovação genérica/PRD/epic/PO? → dispensada pela autorização explícita; esta story operacionaliza a promoção e o ajuste necessário ao modo production, preservando os ACs das stories de origem.

## Contexto e dependências

- Inventário final `/tmp/release-stagings-20261023-inventory.md` e `.json`: seis projetos Vercel, somente Painel Alpha e Portal com staging ativo; nenhuma frente de código aprovada desses stagings deve ser omitida.
- Painel: main `f51b753b` → staging/candidato `50319eb0` (20 commits). Portal: main `e63fe49e` → `f27ce441` (1 commit). Ambos main ancestrais; preservar todos os commits/hotfixes e reavaliar ancestria caso os remotos mudem.
- Candidatos isolados: `painel-alpha-worktrees/release-stagings-20261023` e `painelclientes-worktrees/release-stagings-20261023`; não alterar roots/worktrees alheios. Sparse checkout Main exclui somente snapshots `.next` rastreados.
- API canônica anterior implementada em ambos; bloqueio atual: validadores aceitam apenas local/staging e produção daria503. Produção ainda não tem variáveis API configuradas.
- Bancos distintos, ambos342 tabelas; digest sqlite_master idêntico `a1f5c673611f1f4a63dbc7363e0cda96aeb732bc34dc2912f71a403e272bd7e7`: zero DDL necessário. Catálogo de produção tem3 modelos antigos e0 correspondências aos59 novos.

## Acceptance Criteria

1. Promover os20+1 commits inventariados, incluindo outras frentes aprovadas, mais o ajuste necessário validado primeiro no staging; registrar SHAs finais, ranges e ancestria sem perder main nem incluir sujeira alheia.
2. Main, contrato/SDK e Portal aceitam `PORTAL_API_ENVIRONMENT=production` explicitamente; HTTPS obrigatório em staging/produção, HTTP limitado ao loopback local; issuer/audience/env/azp/kid e escopo de app/principal permanecem isolados por ambiente e sem bypass.
3. Evoluir contrato canônico Main em versão minor de v1, regenerar artefatos/manifestos e consumir no Portal a partir dessa fonte; conservar compatibilidade v1, TTL, permissões, sessão privada e cookies existentes de staging.
4. Configurar somente os escopos de destino corretos: chaves PROD novas e independentes de staging/staff; segredo de assinatura somente Main; Portal recebe apenas chave técnica própria, API origin `https://painel.alpha-comex.com` e web origin `https://alphaclientes.vercel.app`, ambos em modo production. Nunca copiar env/credenciais/DB/dados de staging para produção.
5. Executar lint/typecheck/test/build reais e provas causais nos dois repositórios após a mudança runtime; publicar e validar o ajuste no staging antes de qualquer promoção. Main API de produção deve estar READY com guard negativo e login/me legítimo positivo antes do cutover Portal; build/health isolado não prova READY.
6. Homologar produção com conta legítima e autorização real, sem sessão staff fabricada: login/sessão/me, acesso permitido e recusado, checklist, arquivo/upload/download/avatar e SSE pertinentes; nenhuma credencial ou principal aparece em logs, sessão pública ou bundles.
7. Retirar/mascarar dependência efetiva DB/Turso/Blob master do Portal somente produção após API comprovada e rollback seguro preparado; preservar Preview/staging, evitar herança indevida e não alegar snapshot de valores sensitive ilegíveis.
8. Preparar rollback de versão/config privada e consumidores v1 compatíveis antes do corte; manter Main API disponível enquanto houver consumidor dependente e nunca usar fallback runtime para DB ou rollback de dados.
9. Não executar DDL nem lote dos59 modelos nesta promoção de código. Preservar os3 modelos antigos; eventual lote PROD exige plano Vault, backup completo verificado≤48h e consentimento específico. Waiver de staging não autoriza produção, exclusões por IDs staging nem cópia de contas/dados.

## Tasks / Subtasks — serial

- [x] SM: inventário, autorização e story-draft-checklist registrados (AC1–9).
- [x] Echo Main→Portal: adicionar production a schemas/config/SDK/claims; versão minor, geração canônica e testes negativos/positivos, sem UI nem schema novo (AC2–3; arquitetura §§2,6–7).
- [x] Forge nos dois repos: quatro gates completos atuais + contrato fornecedor/consumidor/boundary PASS, evidências abaixo (AC2–6; arquitetura §10).
- [x] QA: Probe→Anubis→Sage→Lens focais PASS source/local, com hashes fonte iguais ao Forge; runtime remoto e homologação continuam nas tasks DevOps.
- [ ] DevOps: conferir ambiente efetivo, validar novo ajuste nos dois stagings e preparar configuração/rollback privados de produção (AC1,4–5,7–8; arquitetura §11).
- [ ] DevOps: publicar Main/API e comprovar READY; só depois configurar/publicar Portal, concluir smoke, registrar deploys/origins/SHAs e atualizar File List/checklist (AC1,4–9).

## Dev Notes / fontes

- [Arquitetura API](../architecture/portal-api-canonica-20261023.md#6-app-e-principal-protocolo-fechado-sem-nova-tabela), §§2,6–7,10–11: Main é owner do banco e assinatura; Portal é BFF servidor, contrato puro e sessão pública projetada. A restrição anterior “produção requer futura autorização/configuração separada” está satisfeita pela autorização acima; demais invariantes continuam válidas.
- [Story de origem](story-portal-api-canonica-20261023.md#acceptance-criteria): manter seus ACs, 30 fluxos e retirada de backend duplicado. Não redesenhar protocolo nem ampliar operações.
- Main env server-only: `PORTAL_API_ENVIRONMENT`, `PORTAL_WEB_ORIGIN`, `PORTAL_API_APP_KEYS_JSON`, `PORTAL_API_PRINCIPAL_KEYS_JSON`; Portal: `PORTAL_API_ENVIRONMENT`, `PORTAL_WEB_ORIGIN`, `PORTAL_API_ORIGIN`, `PORTAL_API_APP_ID`, `PORTAL_API_APP_KEY_ID`, `PORTAL_API_APP_KEY` e seu próprio `AUTH_SECRET`/`NEXTAUTH_SECRET`.
- Contexto cruzado: `accumulated-context.md` não existe nos candidatos/root; usar o inventário e `/tmp/release-stagings-20261023-orchestration.md`, sem inventar histórico. Arquivos legados `.Codex/commands/AIOX/agents/sm.md`/`.aiox/gotchas.json` ausentes; persona oficial `.aiox-core/development/agents/sm.md` usada.

## Testing

Unit/integration reais em `tests/portal-api/`: production positivo; env/chave/principal/issuer/audience/azp divergentes recusados; HTTPS/origin inválido recusado; cookie seguro/chunked e sessão pública sem segredos; staging/local estáveis. Provar guard/adapter reais, contrato gerado e fronteira Portal sem DB/master. Executar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` em ambos; somente fixtures descartáveis, sem migrations remotas. Gates históricos6327 Main/42 Portal são contexto, não substituem gates após novo runtime.

## 🤖 CodeRabbit Integration

Story Type Analysis: Deployment; secundárias API/Security/Integration; complexidade alta (dois runtimes e autenticação). Specialized Agent Assignment: @dev e @devops primários; @qa/Anubis apoiam, @architect somente se houver nova decisão além do desenho aprovado.
- [x] Pre-Commit (@dev): revisão do diff, contrato, isolamento e segredos antes de concluir código.
- [ ] Pre-PR (@devops, se houver PR) e Pre-Deployment (@devops): revisão de compatibilidade, escopos e rollback; executar CodeRabbit quando disponível, documentar indisponibilidade conforme core-config e nunca ocultar CRITICAL.
Self-Healing: @dev light,2 iterações/15min, CRITICAL auto_fix e HIGH document_only; @qa full,3/30min, CRITICAL/HIGH auto_fix; @devops check/report_only. Focus Areas: autenticação/claims, HTTPS/origins, geração canônica, ausência de vazamento e ordem de rollout.

## Dev Agent Record / File List

Implementação Echo, gates globais Forge e QA focal locais concluídos; rollout remoto continua pendente. File List efetiva Main:

- `contracts/portal-api/v1.ts`, `contracts/portal-api/sdk.server.ts`: contrato minor1.1.0, schema/tipo de ambiente compartilhado e SDK.
- `src/lib/portal-api/config.ts`: config/app environment canônico; guards/claims/TTL existentes preservados.
- `scripts/portal-api/generate-contract.mjs`, `artifacts/portal-api/v1/{v1.ts,sdk.server.ts,manifest.json}`: geração determinística, revision1.1.
- `tests/portal-api/backend.test.ts`, `tests/portal-api/contracts.test.ts`: production positivo/isolamento real de claims/chaves e TLS por ambiente.
- Esta story; ficha Portal e sua File List registram arquivos consumidores.

Evidências Echo23/10: Main40/40 testes em5 arquivos; Portal20/20 em3 arquivos. Lint focal ambos exit0, typecheck Portal exit0; typecheck Main exit0 após gerar o bundle player ignorado, pré-requisito normal do clean checkout. Contrato fornecedor/consumidor e boundary Portal exit0; artifacts Main/Portal byteiguais. Testes usam apenas configuração sintética/fixtures SQLite efêmeras. Nenhum deploy/config remoto/banco real/Git remoto. Diff revisado, sem bypass e sem segredo; CodeRabbit CLI ausente no PATH (indisponibilidade registrada, sem alegação de aprovação automática). Relatório e comandos Forge: `/tmp/release-stagings-20261023-echo.md`; wrapper sanitizado `/tmp/release-stagings-20261023-run.py`.

## QA Results / checklist de preparação

Story-draft-checklist: READY para execução, clareza9/10; Goal/Context PASS, Technical Guidance PASS, References PASS, Self-Containment PASS, Testing PASS, CodeRabbit PASS. Nenhum runtime/deploy validado nesta etapa documental; rollout pendente dos gates acima. Relatório detalhado: `/tmp/release-stagings-20261023-sm.md`.

## Change Log

2026-10-23 | v1 | River: story operacional derivada da aprovação e inventário final; sem código/config/DB/Git remoto.

2026-10-23 | v1.1 | Echo: modo production explícito canônico nos dois runtimes, minor1.1.0/gerados/testes; gates globais e staging-first delegados.


## Forge — gates completos 2026-10-23

- [x] Main typecheck7,53s, lint45,69s (0erros/1182warnings), teste integral final108,83s (775arquivos PASS/1skipped;6464PASS/7skipped/1todo), build literal103,04s; contrato fornecedor0,02s. Todos exit0.
- [x] Portal typecheck0,89s, lint1,37s (sem warnings), teste completo1,03s (42Vitest/8arquivos+2Node PASS), build literalTurbopack3,07s; contrato/boundary0,07s cada (62sources/tests). Todos exit0.
- [x] Primeira tentativa Main test preservada (exit1/109,33s):2falhas ENOENT no pai `.cache` ausente do clean checkout, `tests/bpm/excluir-card-action.test.ts:152`. Criado somente pai ignorado e rerun INTEGRAL PASS; nenhuma fonte/teste alterado para passar.
- [x] Ambiente whitelist sintético; builds production/HTTPS.invalid; Portal sem DB/Turso/assinatura/Blob master. Gates sequenciais, Main2testworkers; Prisma output privado, schemas intactos. Hashes rastreados iguais antes/depois de Forge.
- [x] QA focal source/local: Probe→Anubis→Sage→Lens PASS; nenhum READY/publicação alegado. Runtime/deploy remoto permanece nas tasks DevOps.

File List Forge: somente esta story/ficha atualizada. Relatórios privados fora do Git `/tmp/release-stagings-20261023-forge.md` e `.json`, logs/metadata `{main,portal}-forge-*`, fingerprints `forge-before.json`/`forge-after.json`. `.next`/symlinks/outputs/client/fixtures/player são locais regeneráveis, nunca versionar. Warnings Main build: duas dependências Webpack dinâmicas em pdfjs-polyfill e preload pdfjs worker indisponível; build exit0. Typecheck completo separado PASS, pois configs existentes ignoram typecheck do Next.

2026-10-23 | v1.2 | Forge: gates completos atuais PASS, correção única de harness documentada, QA/rollout pendentes.

## QA focal — 2026-10-23

- [x] Probe PASS: schema canônico alcança config Main/SDK/Portal, emissão/guard e cookie/Auth.js/BFF; rotas owner e DTO público preservados. Menu/UI/atalho/persistência nova N/A.
- [x] Anubis PASS:0críticos/0importantes; HS256/typ/kid/iss/aud/env/azp/conta/version, HTTPS fixo e separação app/assinatura/staff preservados. Assinatura Main-only; sessão pública sem principal/segredos.
- [x] Sage PASS: provas reais40Main/20Portal focais e full Forge6464Main/42Vitest+2NodePortal; negativos crossenv/claims/chaves/TLS, JWE chunked/Auth.js, owner SQLite efêmero/ACL/revogação e major1 compatível. Nenhum gap causal exige teste novo/rerun.
- [x] Lens PASS após Forge e anteriores:0bloqueantes/0importantes; fonte canônica/artefatos/consumer byteiguais, manifesto1.1.0/major1, sem UI/schema/protocolo/TTL novos. Todos rastreados não documentais coincidem com snapshot Forge.
- [x] CodeRabbit SKIPPED: CLI `coderabbit`/`cr` ausentes; revisão manual executada, sem aprovação automática alegada. Flux N/A: ajuste sem UI/dependências.
- [ ] DevOps: publicar/validar o novo código primeiro nos dois stagings, depois configurar produção com chaves novas/origins separadas e rollback privado; Main guard negativo+login/me legítimo READY antes do Portal, retirada efetiva de DB/master somente no scope correto e smoke remoto pertinente.

QA File List: esta story e ficha Portal; `.bibble/memory/{codebase-map,integration-points,journal}.md` Main (entradas curtas Scribe/Kowalski). Relatório privado `/tmp/release-stagings-20261023-qa.md`; nenhuma fonte/teste, cloud, DB remoto, Git commit/push ou output gerado alterado nesta estação. Os59 modelos e3antigos permanecem no fluxo de dados separado Vault; sem import/exclusão/IDs staging.

2026-10-23 | v1.3 | QA/Scribe/Kowalski: código/provas locais PASS, memória factual canônica1.1.0, rollout remoto pendente.


DevOps23/10: fontes não documentais reconferidas contra Forge sem divergências; remotos main/staging atualizados, sem divergência de ancestria. Preparação de commit seletivo e rollout staging-first autorizados; resultados remotos serão registrados após execução. File List inclui esta story e, no Main, três memórias documentais já listadas pelo QA. Nenhum dado ou configuração de produção alterado nesta preparação.
