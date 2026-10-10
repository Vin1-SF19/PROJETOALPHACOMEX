# Story: Worker Alpha Catcher de produção independente

## Status

Ready for Implementation do instalador e plano revisável. Apply privilegiado condicionado às pré-condições e autorização operacional.

executor: "@devops"
quality_gate: "@architect"
quality_gate_tools: ["CLI plan", "validação Bash", "testes instalação/rollback", "revisão segurança"]

## Story

Como operador, quero instalar um worker Alpha Catcher de produção independente na ialpha, para atender a Vercel preservando staging e coletas ativas.

## Contexto e referências

Pedido comunicado pelo agente principal: preparar instalador revisável sem executar instalação privilegiada sem sudo/autorização. Serviço `alpha-catcher-worker-prod`, deployment próprio, cópia do build validado, env privado e segredo exclusivo, bind loopback em porta disponível, proxy HTTPS somente endpoint bridge. Domínio proposto `catcher-worker.alpha-comex.com`, DNS pendente. Variáveis Vercel de produção somente depois do TLS configurado. Sem DDL/backfill nem coleta real.

Coerência: `docs/stories/story-alpha-catcher-logcomex-worker-persistente.md`, `docs/stories/story-alpha-catcher.md`, `AGENTS.md`, `.aiox-core/core-config.yaml`. `accumulated-context.md` não encontrado no carregamento anterior; stories existentes fornecem contexto acumulado.

## Acceptance Criteria

1. CLI oferece plan somente leitura com ambiente, paths, serviço, porta, build, comandos, riscos, pré-condições e rollback. Não altera staging/sistema/banco nem imprime segredos.
2. Apply cria `alpha-catcher-worker-prod` e deployment próprios, sem reutilizar/mudar serviço, env, current ou releases de staging. Copia build validado, verifica integridade/runtime e não modifica fonte/build/release ativos.
3. Env privado tem acesso mínimo e segredo exclusivo; não aparece no Git, logs, output, argumentos públicos ou exemplos. Configuração URL/papel/segredo worker validada sem consultas externas reais.
4. Processo escuta somente loopback em porta comprovadamente disponível; HTTPS publica somente endpoint bridge aprovado, bloqueando UI e outras rotas. Preserva proxy existente e não instala pacotes HTTP cegamente.
5. Checa runtime/build, usuário/grupo, porta, paths/unidades existentes, proxy/TLS e conflitos antes de qualquer mudança. Ausência/conflito bloqueia com instrução concreta; artefatos alheios não são sobrescritos.
6. Plan explicita domínio proposto e DNS pendente. Não afirma DNS/TLS funcional sem prova. Variáveis Vercel de produção são preparadas/configuradas somente após validar HTTPS/contrato autenticado, sem divulgar segredo.
7. Preparar plan/arquivos não executa instalação privilegiada, altera DNS ou publica Vercel. Apply utiliza sudo/autorização apropriados e apresenta passos restantes de modo revisável.
8. Rollback usa inventário/estado anterior e afeta somente artefatos próprios; preserva staging, releases alheias, banco, backups e coletas. Reinstalação não duplica configuração nem troca segredo silenciosamente.
9. Smoke/testes não iniciam coleta Logcomex, consultas ReceitaWS ou mutação de dados. Limitação de Map perdido em restart permanece documentada, sem prometer retomada; não reiniciar coletas existentes.
10. Entrega instalador/documentação/testes, checklist/file list atualizados e validações reais registradas: sintaxe scripts, plan e cenários negativos, além dos gates de AGENTS.md aplicáveis.

## Tasks / Subtasks

- [x] Inspecionar ambiente/runtime/proxy sem mutações e definir paths/porta no plan (AC 1–5).
- [x] Preparar CLI plan/apply/rollback com inventário e proteção contra conflitos (AC 1–8).
- [x] Preparar unit/env/proxy restrito e cópia independente do build (AC 2–5).
- [x] Documentar DNS/TLS e etapa posterior de Vercel (AC 6–7).
- [ ] Testar isolamento/segredo/rollback e registrar gates/file list (AC 8–10).
- [ ] Instalar somente após pré-condições e privilégios/autorização; registrar smoke sem efeitos (AC 7–9).

## Dev Notes

Inspecionar `scripts/activate-alpha-catcher-stage.sh` e scripts equivalentes para padrões locais sem reutilizar seus artefatos de staging. Caminho/porta finais precisam ser verificados no plano; não assumir disponibilidade. Preservar mudanças de outros agentes.

Bridge aprovado: HMAC vincula body/userId/nonce, TTL 45s, issuer/audience fixos; Vercel encaminha Logcomex iniciar/ler/cancelar/CAPTCHA e processamento empresa ao mesmo Next systemd host. Worker revalida permissão no banco. Segredos ficam somente servidor. Worker mantém Maps, logo restart não garante retomada. Publicação Vercel exige worker HTTPS funcional primeiro.

[AUTO-DECISION] Compartilhar staging? → Não. [AUTO-DECISION] Instalar nginx/certbot sem checar? → Não; apresentar pré-condições. [AUTO-DECISION] Alterar banco? → Não previsto; eventual necessidade aplica Vault/backup/confirmação de AGENTS.md. [AUTO-DECISION] Configurar Vercel antes de TLS? → Não.

## Testing

Usar fixtures/diretórios temporários: plan sem writes, build ausente, porta ocupada, unit/proxy alheios, env permissionado, output sem segredo, apply repetido e rollback preservando terceiros. Validar Bash/configuração com ferramentas disponíveis, sem instalação cega. Smoke autenticado/negativo sem iniciar job. Executar `npm run lint`, `npm run typecheck`, `npm test`; build se código/build for alterado; documentar limitações/falhas anteriores sem aprovação fictícia.

## CodeRabbit Integration

**Story Type Analysis:** Deployment; secundários Security/Integration; complexidade alta. **Specialized Agents:** @devops executor, @dev pre-commit, @architect isolamento/segurança, @qa negativos. **Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops se PR; Pre-Deployment @github-devops antes da publicação. Foco: artefatos próprios, segredo/TLS/proxy e staging intacto.

**Self-Healing Configuration (Story 6.3.3):** @devops/@github-devops check report only; @dev light 2 iterações/15min CRITICAL auto-fix e HIGH documentado; @qa full 3/30min CRITICAL/HIGH auto-fix e MEDIUM dívida. Registrar CLI ausente conforme graceful degradation.

## File List inicial

Criado: `docs/stories/story-alpha-catcher-worker-producao-independente.md`. Previstos: instalador/templates/testes/documentação em `scripts/`, `tests/` e `docs/`; paths finais definidos na implementação e registrados integralmente. Templates contêm somente placeholders. Nenhuma mudança de staging, schema ou backup prevista.

## Story Draft Checklist

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Produção independente derivada do pedido |
| Orientação técnica | PASS | Unit, domínio proposto, isolamento, plan/apply/rollback |
| Referências | PASS | Bridge e scripts/política existentes |
| Autossuficiência | PASS | Pré-condições e fronteiras operacionais |
| Testes | PASS | Conflitos, segredo, rollback e smoke sem efeitos |
| CodeRabbit | PASS | Agentes/gates/self-healing |

**Readiness: READY** para preparar instalador; execução operacional depende de pré-condições/autorização. Clareza 9/10. Validação documental sem instalação executada.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-09 | 1.0 | Instalador worker produção independente | River (@sm) |

## Dev Agent Record / QA Results

Correção do smoke HTTPS: `listar-historico` valida cursor numérico positivo ou null; o teste enviava objeto vazio, produzindo HTTP 400. Corrigido para null e erro agora informa somente status esperado/recebido, sem body ou segredo. Sintaxe Node PASS. Repetição HTTPS pelo operador pendente; worker não requer rebuild/restart.

Instalador preparado, sem instalação privilegiada, DNS, Tunnel, Vercel ou banco alterados. Sintaxe Bash e Node aprovada; plan somente leitura verificou build `uM77P10Wju23nlN2OI_TU` e 2156 hashes de runtime. Netlink negado no sandbox é reportado como validação de portas pendente de sudo, nunca como porta comprovadamente livre. Negativos executados: modo inválido, apply/rollback sem sudo, fixtures de build divergente e hash alterado; todos bloqueados sem instalação. Smoke autenticado e nginx -t aguardam plan/apply autorizado com sudo. Gates globais e revisão QA em andamento pelo agente principal.

### File List implementada

Correção após apply do usuário: teste imediato da porta 3302 falhou após reload do nginx; cleanup desativou somente o worker e preservou arquivos. Instalador agora aguarda resposta 401. Retomada valida hashes do inventário e restaura somente unit/proxy preservados, reutilizando release e segredo. Sintaxe Bash PASS; execução sem sudo bloqueada. Retomada real e logs privilegiados pendentes; hipótese de recarga assíncrona ainda não confirmada.

- `scripts/install-alpha-catcher-worker-prod.sh`
- `scripts/resume-alpha-catcher-worker-prod.sh`
- `scripts/alpha-catcher-worker-prod/prepare.mjs`
- `scripts/alpha-catcher-worker-prod/smoke.mjs`
- `docs/alpha-catcher-worker-producao-independente.md`
- `docs/stories/story-alpha-catcher-worker-producao-independente.md`

Verificação final: `npm run typecheck` PASS; `npm run lint` PASS com 1192 avisos e zero erros. `npm test` passou 590 arquivos/4410 testes, mas teve falhas de ambiente (Node sem `node:sqlite`, processos/sockets bloqueados pelo sandbox) e duas falhas conhecidas do Builder. Os quatro arquivos afetados pelo ambiente foram repetidos com Node 22 fora do sandbox: 19 testes PASS. As duas falhas do Builder permanecem; não se declara suíte global aprovada. Evidências: `/tmp/alpha-catcher-prod-typecheck.log`, `/tmp/alpha-catcher-prod-lint.log`, `/tmp/alpha-catcher-prod-tests.log`, `/tmp/alpha-catcher-prod-tests-recheck.log`. QA e arquitetura aprovaram a preparação para revisão operacional; instalação/publicação permanecem pendentes.

Consulta pública DNS confirmou `coco.ns.cloudflare.com` e `sean.ns.cloudflare.com`: DNS administrado na Cloudflare, enquanto o painel permanece hospedado na Vercel. O acesso à conta/zone do Tunnel ainda precisa ser conferido.

Limitações: jobs em memória, automações externas e lock de login compartilhados; falhas parciais preservadas exigem revisão antes de reinstalar. Timeout padrão Cloudflare 125s permanece aplicável a processamento demorado.
