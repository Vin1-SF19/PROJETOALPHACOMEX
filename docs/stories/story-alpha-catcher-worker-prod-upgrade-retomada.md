# Story: Upgrade seguro do worker Alpha Catcher de produção para retomada Logcomex

## Status

In Progress — worker atualizado e smokes local/HTTPS aprovados. Publicação da UI/bridge na Vercel e conferência de identidade/configuração da Vercel permanecem pendentes.

## Story

Como operador, quero atualizar o worker Alpha Catcher **já instalado** em produção para uma release com a correção de retomada Logcomex, preservando o serviço, o segredo, a release anterior e as coletas em andamento, para publicar a nova versão com rollback verificável.

## Contexto e fontes

O instalador inicial `scripts/install-alpha-catcher-worker-prod.sh` fixa como fonte a release de 09/10/2026 (`20261009-130924-alpha-catcher-logcomex-worker`) e bloqueia artefatos existentes. Serviço `alpha-catcher-worker-prod`, deployment, `current`, release(s), env privado e proxy já existem; portanto executar novamente o `apply` de instalação não constitui upgrade. [Fonte: `scripts/install-alpha-catcher-worker-prod.sh`; `docs/alpha-catcher-worker-producao-independente.md` (“Revisar e instalar na ialpha”).]

A correção de timeout/retomada está na story `docs/stories/story-alpha-catcher-logcomex-retomada-timeout.md`, em revisão. O worker mantém jobs em memória e um restart perde execução em andamento. O bridge exige segredo HMAC, e o fluxo de publicação existente exige HTTPS/contrato autenticado antes de apontar a Vercel. [Fonte: `docs/stories/story-alpha-catcher-worker-producao-independente.md` (“Dev Notes”); `docs/alpha-catcher-worker-producao-independente.md` (“Apontar a Vercel para o worker”, “Operação e rollback”).]

## Acceptance Criteria

1. Um plano CLI somente leitura inspeciona o estado real de produção antes de qualquer troca: serviço e processo, alvo de `current`, release e build ativos, manifesto/hashes, configuração de proxy, segredo/env por presença e permissões (sem imprimir valores), e jobs/coletas ativos. Registra divergências e bloqueios; não presume que o estado atual coincida com a instalação inicial.
2. O upgrade prepara uma **nova release versionada** a partir de build validado contendo a correção de retomada, verifica integridade e compatibilidade de runtime/contrato, e mantém intactos a release anterior, o manifesto, o env e o segredo privados. Não reutiliza o `apply` do instalador inicial nem sobrescreve `current` antes dos gates.
3. Se houver job/coleta ativa, estado de atividade inconclusivo, lock de login em uso ou falha em identificar o processo que atende ao tráfego, a troca/restart é bloqueada com motivo claro. Nenhuma coleta é cancelada para viabilizar o upgrade; a janela de troca é reavaliada imediatamente antes do switch.
4. A troca de `current` e o restart do serviço são controlados e verificáveis. O estado anterior é inventariado para rollback; falha de saúde/smoke restaura somente a release anterior e o serviço correspondente, preservando segredo, env, releases, dados, staging e artefatos alheios. Repetir a operação não cria releases duplicadas nem troca segredo silenciosamente.
5. Após o worker atualizado ficar saudável, smoke local e HTTPS confirmam isolamento do proxy (POST sem assinatura rejeitado, UI não publicada), contrato HMAC autenticado somente leitura, replay rejeitado e compatibilidade do histórico de produção, sem iniciar coleta nem mutar dados. Falha em HTTPS/auth impede a etapa Vercel.
6. A publicação do código corrigido na Vercel ocorre **depois** de o worker atualizado passar os gates locais e HTTPS. Verificar identidade do banco e preservar a configuração anterior da Vercel; rollback da publicação restaura a versão/configuração anteriores de forma coordenada com a release do worker, sem desfazer outras mudanças.
7. O procedimento tem `plan`, passos de execução e rollback documentados com comandos, pré-condições, efeitos e evidências. Testes com fixtures validam release/manifest divergente, serviço ausente, job ativo, falha de smoke, switch repetido e rollback. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, File List e resultados reais. Preparar a entrega não executa upgrade, deploy, restart ou coleta real.

## Tasks / Subtasks

- [x] Executar inventário privilegiado somente leitura e validar release candidata; produção aponta para `releases/20261009-142144`, nginx válido, manifesto/build válidos e checagens do worker/lock sem bloqueios (AC 1, 3).
- [x] Preparar plano e mecanismo de release versionada, switch seguro e rollback restrito ao worker (AC 2–4).
- [x] Definir e testar smoke local/HTTPS/auth, incluindo prontidão, replay e isolamento (AC 5).
- [ ] Conferir identidade/configuração e deployment anterior da Vercel antes de publicar UI/bridge (AC 6).
- [x] Documentar sequência worker → Vercel e rollback coordenado, sem executar publicação nesta preparação (AC 6–7).
- [x] Executar testes com fixtures focais e gates disponíveis; registrar as duas falhas globais alheias (AC 7; smoke HTTPS aprovado na continuação abaixo).

## Dev Notes

Inspecionar `scripts/install-alpha-catcher-worker-prod.sh`, `scripts/resume-alpha-catcher-worker-prod.sh`, `scripts/alpha-catcher-worker-prod/{prepare,smoke}.mjs`, `docs/alpha-catcher-worker-producao-independente.md` e os arquivos da correção listados na story de retomada. O instalador fixo de 09/10 é fonte histórica de instalação; preparar upgrade separado e derivar versão/build da release candidata validada. Confirmar paths, hashes, unidade e tráfego no ambiente real em vez de copiá-los da documentação como estado atual.

O segredo HMAC e env de produção permanecem nos locais privados já existentes. Não revelar valores, copiar para o repositório ou gerar segredo novo durante upgrade. Não tocar staging, banco, DNS ou Tunnel salvo se uma divergência concreta exigir nova decisão documentada. Qualquer alteração estrutural de banco ou mutação em massa exigiria Vault, backup verificado e confirmação explícita conforme `AGENTS.md`; não está prevista nesta story.

[AUTO-DECISION] Usar instalador inicial? → Não, ele fixa release de 09/10 e bloqueia artefatos existentes. [AUTO-DECISION] Trocar `current` com job ativo? → Não, jobs em memória seriam perdidos. [AUTO-DECISION] Vercel primeiro? → Não, contrato HTTPS do worker atualizado precisa ser validado antes.

## Testing

Fixtures/diretórios temporários para plan sem escrita, hashes/build incompatíveis, `current` inválido, env sem permissão, serviço ou job ativo, lock ocupado, switch e rollback idempotentes, falha de saúde e segredo ausente do output. Smoke autenticado usa somente leitura e não inicia Logcomex, ReceitaWS ou gravações. Validar que publicação Vercel é etapa separada e bloqueada se worker/HTTPS/auth falhar.

## CodeRabbit Integration

**Story Type Analysis:** Deployment; secundários Integration e Security; complexidade alta.

**Specialized Agents:** @dev implementação dos artefatos e testes, @github-devops operação/publicação quando autorizada, @architect revisão de isolamento/rollback e @qa cenários negativos.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops se houver PR; Pre-Deployment @github-devops antes da troca em produção. Foco: jobs ativos, preservação de release/env/segredo, manifesto, HMAC e ordem worker → Vercel.

**Self-Healing Configuration (Story 6.3.3):** @dev light, 2 iterações/15 minutos, CRITICAL auto-fix e HIGH documentado; @qa full, 3 iterações/30 minutos, CRITICAL/HIGH corrigidos e MEDIUM documentado; @github-devops check, report only. Registrar CLI indisponível conforme configuração do projeto.

## File List

- `docs/stories/story-alpha-catcher-worker-prod-upgrade-retomada.md`
- `docs/alpha-catcher-worker-producao-independente.md`
- `scripts/upgrade-alpha-catcher-worker-prod.sh`
- `scripts/alpha-catcher-worker-prod/verify-upgrade.mjs`
- `tests/alpha-catcher/upgrade-worker-prod.test.ts`
- `scripts/alpha-catcher-worker-prod/smoke.mjs`
- `scripts/alpha-catcher-worker-prod/smoke-request.mjs`
- `tests/alpha-catcher/smoke-worker-prod.test.ts`

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Upgrade de instalação existente e dependência da correção de retomada claros |
| Orientação técnica | PASS | Inventário, release versionada, bloqueio de jobs, switch e rollback definidos |
| Referências | PASS | Instalador, guia operacional e stories relacionadas |
| Autossuficiência | PASS | Pré-condições, ordem de publicação e limites explícitos |
| Testes | PASS na preparação | Fixtures focais 2/2, build, typecheck; suíte global falhou somente em dois testes Builder alheios. Smoke HTTPS aprovado na continuação abaixo. |
| CodeRabbit | PASS | Tipo, agentes, gates e self-healing definidos |

**Readiness: READY** para preparar o upgrade; execução operacional depende da inspeção atual e dos gates. Clareza 9/10. Nenhum deploy ou mutação foi executado na elaboração.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-13 | 1.0 | Story de upgrade do worker de produção para correção de retomada | River (@sm) |

## Dev Agent Record / QA Results

Mecanismo de upgrade e rollback preparado; sintaxe Bash e Node aprovada; teste de manifesto 2/2 PASS. Candidato isolado em `/tmp/alpha-catcher-resume-rXbdf6-runtime`, build `HF2WMwa2-LWt000xy3qsI`, 2.040 hashes verificados. `npm run typecheck`, `npm run lint`, build e testes focais Alpha Catcher (260/260) passaram. `npm test` global em Node 22 executou 4.447 testes: 4.440 passaram, 4 skipped, 1 todo e 2 falharam nos testes existentes de `tests/builder/embed.test.ts` (serialização de URL em happy-dom), alheios a esta story. Em 13/10, o usuário executou o `plan` privilegiado: nginx e release candidata passaram, current confirmado em `releases/20261009-142144`, verificações de serviço, processo/lock, endpoint local e espaço disponíveis passaram. Apply, smoke HTTPS e publicação Vercel permanecem pendentes. Nenhum switch, restart, deploy, coleta ou mutação de banco executado.


### Continuação de 13/10/2026 — smoke de inicialização

O apply executado pelo usuário às 18:04 UTC restaurou a release anterior após HTTP 502. O journal registra start e stop da candidata no mesmo segundo, antes de readiness; a release antiga ficou pronta em 511 ms. O helper deixado incompleto foi conectado ao smoke com prazo total de 30 s, limite por requisição limitado ao tempo restante, nonce novo por tentativa e repetição apenas de erros de transporte e 502/503/504 locais. HTTPS, autenticação e HTTP 500 não recebem retries. Adicionadas verificações reais de POST sem assinatura e UI bloqueada.

Testes focais: 31 arquivos e 269 testes aprovados, incluindo 9 casos novos de readiness e 2 de upgrade. Lint global: 0 erros e 1.192 warnings; typecheck aprovado. Suíte global em Node 22.22.3: 4.449 passed, 4 skipped, 1 todo, 2 falhas conhecidas de `tests/builder/embed.test.ts` (URL absoluta versus relativa em happy-dom). A primeira execução com Node 24 também teve falhas de compatibilidade do SQLite, descartada como gate do runtime de produção. CodeRabbit CLI indisponível neste usuário.

Smoke local e HTTPS da release anterior aprovados com leitura HMAC, replay e isolamento. Inventário da tentativa revertida preservado em `/home/ialpha/deployments/alpha-catcher-worker-prod/upgrade-audit/20261013-180413-rolled-back/` após verificação do rollback e saúde, sob lock operacional. Nova tentativa usa a mesma candidata previamente validada, build `HF2WMwa2-LWt000xy3qsI`, com 2.040 hashes conferidos; nenhuma coleta ou mutação de banco faz parte desta operação.


Upgrade operacional concluído em 13/10/2026 às 18:34 UTC: `current` aponta para `/home/ialpha/deployments/alpha-catcher-worker-prod/releases/20261013-183316-upgrade`; serviço `active/running`, Next pronto em 551 ms. Smoke local do apply e smoke HTTPS pós-upgrade aprovados: HMAC, leitura do histórico, replay 401, POST sem assinatura 401 e UI 404. Release anterior `/home/ialpha/deployments/alpha-catcher-worker-prod/releases/20261009-142144` preservada com inventário de rollback. Não houve push, publicação Vercel, retomada de Andrew ou alteração de banco nesta continuação. A etapa Vercel permanece com o usuário conforme instrução recuperada da sessão original.

Build adicional de verificação: `NEXT_DIST_DIR=.next-catcher-resume-verification npm run build` em Node 22.22.3 concluiu com exit 0; as entradas temporárias adicionadas pelo Next ao tsconfig foram removidas. A candidata publicada permaneceu a release validada e isolada original.
