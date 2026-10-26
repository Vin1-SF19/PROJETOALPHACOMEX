# Forge — gates completos da estabilidade do Painel Alpha

**Resultado atual: APROVADO (rodada6, 26/10/2026, 22:05 UTC).** Tipos gerados pelo Next, lint, cobertura integral e regressões incrementais, build e smoke HTTP local aprovados conforme escopo detalhado nas rodadas5–6. Delta de concorrência das notas liberado para nova conferência Lens; staging e produção ainda não validados pelo Forge. Rodadas anteriores preservadas abaixo.

## Rodada 1 — REPROVADO (26/10/2026, 21:28 UTC)

Candidato isolado `/var/tmp/alpha-estabilidade-20261026/candidate`, HEAD base `20f310a345e04171fbe0b8e3e37f4ef0ce2e126f` com alterações Echo/Nova ainda não commitadas. Fonte app/test/schema/config registrada em manifesto privado: SHA256 `56342c006ce9c881c1431fe98ba4a4450efc43159497882a5291157d91d63d96`, 3.153 arquivos. Nenhum deploy, configuração persistente ou mutação de banco realizada.

Ambiente CLI carregado explicitamente de `.env.staging.local`, com override e confirmação do fingerprint staging `7fdd1607…`. URL, tokens e valores de ambiente não foram impressos. Logs/runner privados em `/var/tmp/alpha-estabilidade-20261026/forge-*`. Testes posteriores usarão destinos sintéticos locais após a conferência de ambiente, sem escrita no banco real.

`npm run typecheck` executado de verdade com o heap oficial de8GB: **exit2 em55,934s** (21:26:55–21:27:51 UTC). Diagnósticos:

- `src/app/api/apresentacoes/[id]/exportar-html/route.ts:9`: TS2307, módulo gerado `@/generated/apresentacoes-player-bundle` ausente no checkout novo. Executado preparo existente `npm run build:player`, exit0/471ms; gerou somente o artefato ignorado previsto no script. Não foi editado o import nem o schema.
- `src/components/BibbleChatHome/BibbleChatLayout.tsx:228`: **TS2339 novo**, `capabilities` não existe em `{}` inferido para o resultado da query. Devolver a Nova para tipar o contrato/resultado sem coerção cega.

Lint, suíte completa com cobertura, build e runtime **não iniciados** nesta rodada: fila interrompida para correção do owner, conforme lead. Nenhuma aprovação Forge emitida.

CodeRabbit: executável não localizado em PATH nem no caminho configurado `~/.local/bin/coderabbit`. `.aiox-core/core-config.yaml` define `graceful_degradation.skip_if_not_installed: true`; revisão automatizada não executada, não declarada PASS. Lens/Anubis deverão realizar revisão manual depois dos gates completos. Nenhuma instalação ou alteração de dependências executada.

File list Forge nesta rodada: este relatório e acréscimo à story; o bundle gerado permanece ignorado. Wrapper/logs/manifesto ficam fora do Git. Sem mudança de aplicação.

## Rodada 2 — REPROVADO (26/10/2026, 21:33 UTC)

Após correção Nova da tipagem do contrato models, fonte app/test/schema/config SHA256 `4b101fc1839cbe2495c17f90cc523d1ea6896bc9d041c1655222fcff4f6cba29`, 3.153 arquivos. Preparação do player concluída.

| Gate real | Resultado |
| --- | --- |
| `npm run typecheck` (heap8GB) | PASS, exit0/8,455s |
| `npm run lint` | PASS, exit0/47,375s;0erros/1.172warnings, nenhum warning em arquivo alterado |
| `npm test -- --maxWorkers=4` (V8 coverage ativo) | FAIL, exit1/184,181s;814arquivos:806pass/8fail;6.744testes pass/21fail/38skipped/1todo |
| `npm run build` e runtime | Não iniciados: parar para corrigir o gate anterior |

Falhas da suíte, preservadas integralmente em `forge-test.log`:

1. **Nova — fixtures do poller:** `tests/checklist-analistas/notifications-subscription.test.tsx` tem8asserções falhando (fetch não inicia/timer ausente/abort/store), linhas85,106,126,152,169; `tests/checklist-analistas/eventos-recovery-client.test.tsx` tem3falhas, linhas78,118,140. Ambos mocks de `useSession` informam `authenticated` sem `estadoAcesso` autorizado explícito; o novo guard fail-closed impede polling. Corrigir contrato da fixture e cobrir estado indisponível sem liberar acesso no app. Não são falhas atribuídas a memória por inferência.
2. **Harness Forge — segredo sintético ausente:**9casos em `tests/auth/sessao-resiliencia.test.ts` falharam ao codificar cookie (`TypeError: ikm must be Uint8Array or string`). A fixture lê `process.env.AUTH_SECRET!` na linha31; `.env.staging.local` não fornece esse campo. Wrapper privado corrigido para fornecer segredo exclusivamente sintético antes da próxima execução. Não usar segredo real e não alterar autenticação.
3. **Preparação SQLite — timeout ainda precisa rerun:**4suites falharam no `beforeAll` de30s: `tests/checklist-analistas/catalogo-replay.test.ts:14`, `eventos-recovery.contract.test.ts:13`, `realtime-worker-isolation.test.ts:38` e `tests/operacional/checklist-cliente-master.test.ts:10`. Preparação observada de53–56s em algumas fixtures. Um caso de `tests/bpm/rd-station-recovery-cli.test.ts:65` excedeu5s. A disputa de recursos com4workers no host com swap quase cheio é hipótese operacional; próxima rodada usará1worker, preservando os mesmos prazos e aplicação/testes intactos nesse ponto. Não declarar esses testes aprovados antes de executar.

Não foi produzido recibo de cobertura aprovada nesta execução com falhas. Não há processo de gate ativo. Nova deve corrigir as duas fixtures; após handoff, Forge repete suíte integral com segredo sintético e1worker, além dos demais gates requeridos. Nenhuma alteração de app, schema, ambiente persistente, dados reais ou publicação foi feita pelo Forge.

## Rodada 3 — REPROVADO no runtime SSR (26/10/2026, 21:44 UTC)

Nova corrigiu somente as fixtures de sessão/polling, incluindo casos de indisponibilidade; não mudou aplicação nessa rodada. Forge repetiu typecheck oficial e suíte integral com1worker e segredo AUTH_SECRET sintético; nenhum prazo de teste foi ampliado.

| Gate real | Resultado |
| --- | --- |
| `npm run typecheck` (heap8GB) | PASS, exit0/8,642s |
| `npm run lint` | PASS da rodada2; aplicação intacta e ESLint direcionado das2fixtures novas PASS pela Nova |
| `npm test -- --maxWorkers=1` | **PASS**, exit0/304,909s,814arquivos;6.801testes pass/4skipped/1todo |
| `npm run build` literal | **PASS**, exit0/108,705s; client Prisma privado regenerado e Next16.1.6 Webpack |
| `npm run start -- --port3478 --hostname127.0.0.1` | Inicializou em328ms, mas smoke SSR encontrou regressão bloqueante |

Cobertura V8 gerada no escopo já definido por `vitest.config.ts` (BPM/NPS): linhas74,52%, statements70,99%, funções78,54%, branches64,61%. Não representa cobertura de todo o repositório. Fonte app/test/schema/config SHA256 `fc90d135e38f46bd6116c53e86b9e308db167ff944b5598f5aa65def6ad87e65`; subconjunto app/schema/config `bc65d06bef008b21daae99b9542086c8cef7f641f958a43c7cc6f28c42698b08`. Manifestos antes/depois privados permitem verificar a fonte executada.

**Regressão real encontrada no smoke:** GET `/` e `/login` retornaram500 com `ReferenceError: document is not defined`, digest local `1661304624`. Origem identificada em `src/components/BroadcastBanner.tsx:23`: callback `refetchInterval` consulta `document.hidden` durante SSR; ReactQuery calcula o intervalo mesmo quando `enabled=false`. Nova deve proteger callbacks de scheduler contra ausência de browser e adicionar teste SSR real. Não mascarar erro com retorno vazio ou desativação de gates.

APIs sem sessão retornaram401 em models, Onyx agents e POST heartbeat, sem efeitos de negócio. Health version retornou503/no-store esperado para execução local sem metadados Vercel. Headers preservados em todas as respostas: `geolocation=()` e `X-Frame-Options:SAMEORIGIN`. Smoke não autenticado local não substitui validação staging/produção.

O harness local também registrou `UntrustedHost` por não definir confiança do host local. Wrapper privado já prepara `AUTH_TRUST_HOST=true` somente nos processos locais build/start, junto ao segredo sintético quando ausente; não houve alteração de ambiente persistente ou segurança do aplicativo. Warning existente de pré-carga pdfjs foi registrado, sem atribuir essa mensagem à regressão SSR. Logs de build ainda mostram warnings de imports dinâmicos pdfjs, sem erro de build.

Servidor local encerrado por SIGINT no grupo próprio; sonda posterior confirmou que3478 não está mais ouvindo. Nenhum processo de gate permanece ativo. **Forge não libera Probe/Lens/deploy até correção SSR e revalidação dos gates impactados.** File list permanece relatório/story, sem alteração app pelo Forge. Artefatos: `forge-test.log`, `forge-build.log`, `forge-start.log`, `forge-runtime-smoke.json` e `forge-coverage-summary.json` no diretório privado.

## Rodada 4 — REPROVADO na validação de rota gerada (26/10/2026, 21:47 UTC)

Nova adicionou guarda `typeof document !== "undefined"` no callback do Broadcast e nova fixture Node `tests/layout/pollers-ssr.test.tsx`. A reconstrução em memória da única linha anterior do Broadcast reproduziu exatamente o hash app da rodada3, comprovando ausência de outra alteração de aplicação nessa correção. Fonte nova app/test/config SHA256 `6bf68f778e5736486cffea6b6c8b76da6e3a9fe7e6775cbcef8d03f270c94180`; app `6807557119eff7c1fe7d0234c7e1c6a49f93938492246f55e3278a7d6c997ec0`.

`npm run typecheck` real8GB com os validadores `.next/types` gerados pelo build anterior: **exit2/62,369s**. Novo diagnóstico antes indisponível no checkout sem build:

```text
.next/types/app/api/bibble/models/route.ts:41 TS2344
GET __param_type__: Request | undefined não satisfaz ParamCheck<NextRequest | Request>.
```

Origem: `src/app/api/bibble/models/route.ts:16`, assinatura `GET(request?: Request)`. Echo deve exigir `Request` como parâmetro do Route Handler e ajustar chamadas de teste com Request concreto, preservando cancelamento. Não remover os validadores gerados, mudar `tsconfig`, inserir casts cegos ou declarar typecheck aprovado.

Fila interrompida para Echo antes de lint direcionado, suíteSSR ou novo build/runtime. Relatórios de13testes SSR focados da Nova permanecem evidência do owner, não execução Forge desta rodada. Servidor3478 permanece encerrado; não há gate em execução. Log/result preservados como `forge-typecheck-round4.*`. Repetir gates impactados após a correção; os resultados integrais anteriores não comprovam esta tipagem gerada.

## Rodada 5 — APROVADO (26/10/2026, 21:51 UTC)

Echo tornou `Request` obrigatório no GET models e preservou `request.signal`. Desde a suíte integral aprovada, somente dois deltas app: a guarda SSR do Broadcast e a assinatura/signal de models. Reconstruir essas linhas anteriores em memória produziu **exatamente** o hash app `bc65d06b…` da rodada3. Isso fundamenta reutilizar os814arquivos/6.801testes com cobertura aprovados naquela fonte e testar especificamente os dois deltas, sem afirmar que a suíte integral foi repetida na fonte final.

Fonte final app/test/schema/config SHA256 **`ce48c29e0f8287218e0278890b5c57a995569f4d86b1dadb3acabcc5e4e2ce00`**,3.154arquivos; subconjunto app/schema/config **`370a8e2942cc2e6076f5767499d96a8bb8d0468373be576a7b67e55c169fda8a`**. Manifestos antes/depois confirmam fonte idêntica durante os gates finais. HEAD base20f310, alterações ainda não commitadas; esta identificação não é SHA de deployment.

| Verificação | Evidência real |
| --- | --- |
| Typecheck oficial8GB com `.next/types` | PASS/8,822s antes do build; **PASS/14,719s depois do build final**, sem ignorar validadores |
| Lint | Gate global0errors/1.172warnings fora dos arquivos alterados na rodada2; deltas finais4arquivos PASS/1,077s,0errors/0warnings |
| Suíte integral com V8 coverage | Rodada3 PASS/304,909s:814arquivos,6.801testes pass/4skipped/1todo; reuso proporcional aos deltas comprovados |
| Regressões finais | **3arquivos/22testes PASS**,1,070s: `pollers-ssr`, `estabilidade-consumidores-react`, `availability-routes` |
| `npm run build` literal final | **PASS/50,372s**, client Prisma privado e Next Webpack; sem mudança em dependências/config/source |
| `npm run start` e smoke HTTP local | Ready291ms; respostas abaixo aprovadas, sem500 de SSR |

Smoke local não autenticado às21:51:08UTC, com configuração staging verificada e segredo/trust-host apenas sintéticos do processo local:

- GET `/`: **200**, login real definido por `src/app/page.tsx` e `auth.config.ts` (`signIn:"/"`).
- GET `/login`: **404 legítimo**, rota não existe; primeira expectativa incorreta do harness foi corrigida, sem alterar aplicação. Evidência inicial preservada em `forge-runtime-smoke-round5-wrong-login-path.json`.
- GET `/PainelAlpha`: **307 para `/`**; GET `/api/auth/session`: **200/null**, sem identidade inventada.
- GET models, GET Onyx agents e POST heartbeat: **401** sem sessão.
- GET health/version: **503/no-store esperado em execução local sem metadados Vercel**, não evidência de falha de banco. Staging/prod real precisam seus próprios recibos.
- Todos preservam `Permissions-Policy` com `geolocation=()` e `X-Frame-Options:SAMEORIGIN`; nenhum erro `document is not defined`/UntrustedHost no runtime final. Warning preexistente de pré-carga pdfjs permanece registrado.

Servidor próprio encerrado por SIGINT; conexão posterior à3478 falhou com **ECONNREFUSED**, sem processo de gate pendente. Nenhum schema, ambiente persistente, dados reais, commit ou deployment alterado. Bundle player e `.next` são artefatos ignorados de validação. File list Forge versionada: este relatório e a story; `tests/layout/pollers-ssr.test.tsx` é arquivo criado pela Nova registrado no aceite final. CodeRabbit não executado (ausente e fallback previsto); revisão manual e homologação ambiental permanecem para os próximos owners.

## Rodada 6 — APROVADO após correção de concorrência Lens (26/10/2026, 22:05 UTC)

Nova corrigiu `cancelRefetch:false` nas reconsultas não abortáveis de workspace/nota, atualizou comentário do listener e acrescentou regressões com cache preenchido, leitura pendente, eventos/cliques repetidos e draft local. Escopo app desta rodada: `src/hooks/useNotasWorkspaceSync.ts` e `src/components/Notas/NotesGlobalTaskbar.tsx`; testes correspondentes de workspace/taskbar. Nenhum código app alterado pelo Forge.

- Typecheck oficial com `.next/types`: **PASS/9,125s**.
- ESLint dos4arquivos do delta: **PASS/1,190s,0errors/0warnings**. Gate global anterior reutilizado para arquivos intactos.
- **8arquivos/63testes PASS**,2,087s:41notas/concurrency/drafts mais22SSR/consumidores/models. Suíte integral814arquivos/6.801testes e cobertura da rodada3 reutilizada proporcionalmente, sem afirmar execução integral na fonte final. As regressões exercitam os deltas posteriores; não somar contagens como testes únicos adicionais.
- `npm run build` literal: **PASS/95,295s**; nenhum novo erro, warnings de import dinâmico pdfjs já registrados.
- Runtime real local às22:05:07UTC: login `/`**200**, `/login`404legítimo, painel anônimo**307→`/`**, sessão**200/null**, models/Onyx agents/heartbeat**401**. Health version503/no-store é esperado local sem metadadosVercel. Headers de geolocalização/frame intactos; sem500.

Fonte final app/test/schema/config **`aa16cb5ab68471e4bbf5de6a192cfd50c5a6769e2a0a1995c37e124015df8d7c`**; app/schema/config **`86f8d17971aabed14359a70a85dfb1f1547954905994a34467e9df962cdc8c04`**,3.154arquivos. Manifestos antes/depois confirmam fonte idêntica durante esta execução. A reconstrução exata da fonte anterior não foi afirmada nesta rodada, pois além das opções refetch houve atualização de comentário; escopo do delta é o handoff Nova/Lens e a revisão correspondente.

Testes usaram URL/segredo sintéticos em processo após validar bindingstaging; um rótulo do recibo de primeira rodada focused estava false por comparação literal do nome do gate, corrigido no runner privado e rerun focused aprovado. Não houve conexão de testes ao banco real. Servidor próprio encerrado e porta3478 confirmada livre por ECONNREFUSED. Logs/resultados `forge-test:notas`, `forge-lint:notas`, `forge-build`, `forge-runtime-smoke` e manifestos round6 privados; relatório/story são a file list Forge. Liberado para Lens delta; nenhum deploy ou mutação de banco realizado.
