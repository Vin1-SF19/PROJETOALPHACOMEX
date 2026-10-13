# Story: Diagnóstico sob demanda das APIs do Alpha Catcher

## Status

Ready for Review — endpoint, CLI, botão e testes focais implementados. `npm run lint`, `npm run typecheck` e `npm run build` passaram; a suíte global mantém falhas de ambiente/áreas alheias, detalhadas abaixo.

## Story

Como usuário do Alpha Catcher, quero executar um diagnóstico das dependências do processamento, para identificar se o worker, a ReceitaWS ou o Radar estão indisponíveis antes de continuar uma fila com empresas pendentes.

## Contexto

Em 13/10/2026, durante uma coleta Logcomex em andamento, o processamento pelas APIs ficou pausado. Ao retomar, consignatários avançaram rapidamente e as empresas foram marcadas como pendentes. O usuário pausou o processamento, mas a interface não apresentou um resumo que identificasse qual dependência falhou. A coleta Logcomex e a fila de processamento são etapas independentes; o diagnóstico precisa respeitar essa separação.

O fluxo atual consulta o banco primeiro; para empresas novas, consulta ReceitaWS e depois Radar. Falhas da ReceitaWS e do Radar retornam mensagens/códigos de pendência, e a UI marca falha de conexão como pendente. A ReceitaWS também pode recusar requisições por configuração, autenticação, cota ou limite. O processamento ocorre no servidor/worker; os tokens e demais credenciais são server-side. [Fonte: `docs/alpha-catcher.md` (“Entrada e processamento”, “Dependências da automação”); `src/lib/alpha-catcher/service.ts`; `src/lib/cnpj/receitaws.ts`; `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`.]

O pedido é uma verificação manual e explicável. Abrir a página, coletar CNPJs, pausar/retomar ou tentar pendências não deve disparar um diagnóstico em segundo plano. O diagnóstico não pode enriquecer CNPJs de teste, consumir a cota normal de consultas por empresa, gravar registros ou alterar a fila. Se algum provedor não oferecer uma verificação de saúde segura sem consulta de empresa, o resultado deve dizer que não foi possível confirmar a disponibilidade sem processar um CNPJ; não deve simular sucesso.

Não há evidência coletada nesta story que confirme indisponibilidade atual de qualquer API nem que identifique a causa das pendências do caso relatado. A implementação deve apresentar evidência nova obtida no momento em que o usuário solicitar o diagnóstico, separando indisponibilidade, configuração ausente/inválida, limite/cota e estado inconclusivo.

## Acceptance Criteria

1. A tela do Alpha Catcher oferece uma ação explícita “Verificar APIs” ou equivalente. A verificação só começa após acionamento do usuário; não roda ao abrir/recarregar a página, ao coletar, pausar, retomar ou tentar pendências, nem por polling automático.
2. O resultado identifica separadamente worker, ReceitaWS e Radar, com estado compreensível (`Disponível`, `Com problema` ou `Não foi possível verificar`), horário da verificação e explicação segura/ação recomendada quando aplicável. Falha de uma dependência não oculta o resultado das demais.
3. A verificação usa apenas checagens de saúde/configuração que não consultem CNPJ, não executem enriquecimento, não gravem dados e não iniciem/coordenem jobs. Se um provedor não permitir checagem sem consulta de empresa, ele aparece como inconclusivo com essa razão; não se faz fallback para uma consulta real.
4. As checagens são somente leitura e isoladas da fila ativa: não pausam, cancelam, retomam, consomem itens, alteram estados/contagens ou interferem na coleta Logcomex. Repetir o diagnóstico é seguro e não causa efeitos cumulativos no domínio.
5. A interface distingue problemas de conectividade/timeout, configuração/autenticação e quota/limite quando a evidência disponível permitir. Respostas 401/403/402/429 e erros do bridge não são apresentados como sucesso; mensagens genéricas não afirmam uma causa não observada.
6. Tokens, cookies, cabeçalhos de autorização, URLs privadas e detalhes internos não aparecem na resposta ao navegador, na tela ou nos logs do diagnóstico. O endpoint exige a mesma autenticação e permissão `alphaCatcher` usadas pelas operações existentes; respostas não concedem acesso ao estado de outros usuários.
7. Enquanto verifica, o botão mostra progresso e impede solicitações duplicadas da mesma ação. Timeout ou falha parcial encerra a espera com estado explícito e preserva os resultados já recebidos para as outras dependências.
8. Testes automatizados provam que o diagnóstico não chama operações de consulta por CNPJ, não grava nem altera a fila, trata falhas/status de cada dependência e não serializa segredos. Cobrem também acesso sem autenticação/permissão e resultado parcial. Documentação e File List da story são atualizadas; executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, registrando resultados reais e falhas preexistentes.

## Tasks / Subtasks

- [x] Mapear checagens de saúde seguras e contratos disponíveis para worker, ReceitaWS e Radar; para dependência sem checagem segura, definir retorno inconclusivo (AC 2–5). Worker tem probe autenticado read-only via operação `diagnosticar`; ReceitaWS/Radar não oferecem probe sem CNPJ neste fluxo e aparecem como inconclusivos quando configurados.
- [x] Adicionar endpoint autenticado de diagnóstico somente leitura, sem reutilizar o endpoint de processamento por CNPJ (AC 3–6).
- [x] Adicionar ação e apresentação acessível do estado por dependência, data/hora, carregamento e falha parcial (AC 1–2, 7).
- [x] Criar testes focais de segurança, isolamento da fila, falhas e ausência de chamada de enriquecimento (AC 3–8).
- [x] Atualizar documentação, checklist e File List; executar gates globais e registrar evidências (AC 8).

## Dev Notes

### Pontos de integração existentes

- `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`: controles e monitor da fila; hoje marca falhas HTTP/conexão como pendências.
- `src/app/api/alpha-catcher/route.ts`: processamento normal de um CNPJ; o diagnóstico não deve invocar esse fluxo.
- `src/lib/alpha-catcher/service.ts`: ordem banco → ReceitaWS → Radar e classificação das falhas.
- `src/lib/cnpj/receitaws.ts`: configuração, limites, timeout e erros tipados (`RECEITA_NOT_CONFIGURED`, `RECEITA_UNAUTHORIZED`, `RECEITA_QUOTA_EXHAUSTED`, `RECEITA_TIMEOUT`, `RECEITA_UNAVAILABLE`).
- `src/lib/radar/consulta.ts`: integração Radar e erros tipados; não há probe de disponibilidade sem consulta de CNPJ neste fluxo.
- `src/lib/alpha-catcher/worker-client.ts` e `src/app/api/internal/alpha-catcher/worker/route.ts`: bridge do worker; usar contrato de saúde autenticado e read-only, sem expor HMAC.
- Testes focais ficam em `tests/alpha-catcher/`.

### Diretrizes de implementação

Endpoint: `src/app/api/alpha-catcher/diagnostico/route.ts`, com operação assinada do worker. Não adiciona dependência ou integração de healthcheck especulativa. Não faz chamada externa aos provedores. Quando não há probe sem CNPJ, retorna `inconclusivo` e explica o limite; não testa credencial com busca de empresa nem registra valores de env/headers.

Preservar a fila de coleta e processamento independente. A ação de diagnóstico deve continuar disponível sem assumir controle do processamento; suas respostas não devem atualizar linhas ou o histórico da importação. Não requer mudança de banco nem migration prevista.

### Arquivos previstos

- `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`
- `src/lib/alpha-catcher/diagnostico-apis.ts`
- `src/lib/alpha-catcher/worker-client.ts`
- `src/lib/alpha-catcher/worker-executar.ts`
- `src/app/api/internal/alpha-catcher/worker/route.ts`
- `src/app/api/alpha-catcher/diagnostico/route.ts`
- `scripts/alpha-catcher-api-health.mts`
- `tests/alpha-catcher/diagnostico-apis.test.ts`
- `tests/alpha-catcher/client-stream.test.ts`
- `docs/alpha-catcher.md`

## Testing

Usar mocks/fakes de worker e provedores; nenhum teste deve chamar APIs externas reais ou gravar em banco real. Verificar disponibilidade, timeout, autenticação/configuração, limite/quota, resposta parcial, serviço sem probe suportado e resposta sanitizada. Assegurar que o mock de `processarEmpresa`, consulta por CNPJ, persistência e estado da fila não foi chamado/alterado. Validar autorização no endpoint e interação manual da UI.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Integration; secundários API, Frontend e Security; complexidade média.

**Specialized Agents:** @dev execução; @architect revisão de isolamento e contratos; @qa revisão de cenários; @ux-design-expert revisão de mensagens/acessibilidade.

**Quality Gates:** Pre-Commit @dev obrigatório; Pre-PR @github-devops se houver PR; Pre-Deployment @github-devops antes da publicação. Foco em autorização, isolamento de side effects, estado parcial, timeouts e sanitização de segredos.

**Self-Healing Configuration:** @dev light, 2 iterações/15 min, corrigir CRITICAL e documentar HIGH; @qa full, 3 iterações/30 min, corrigir CRITICAL/HIGH e documentar MEDIUM; @github-devops check/report only conforme configuração do projeto.

## Story Draft Checklist

| Categoria | Resultado | Evidência / pendência |
| --- | --- | --- |
| Objetivo e contexto | PASS | Relaciona pendências rápidas ao diagnóstico explícito das três dependências sem concluir que alguma esteja fora do ar |
| Orientação técnica | PASS | Define endpoint separado, sem CNPJ, gravação ou interferência na fila; estados por dependência |
| Referências | PASS | Aponta tela, rota de processamento, serviço, clientes e documentação existentes |
| Autossuficiência | PASS | Define inconclusivo quando não houver healthcheck seguro, sem inventar disponibilidade |
| Testes | PASS | Casos negativos, autorização, ausência de side effects, segredo e falha parcial mensuráveis |
| CodeRabbit | PASS | Tipo, agentes, gates e áreas de revisão definidos conforme configuração |

**Readiness: READY FOR REVIEW.** Clareza 9/10. O probe autenticado do worker retorna sua configuração da ReceitaWS/Radar sem consultar empresas; provedores sem endpoint de saúde aparecem como inconclusivos.

## File List

- `docs/stories/story-alpha-catcher-diagnostico-apis.md` (esta story; criada)
- `src/app/PainelAlpha/AlphaCatcher/CatcherClient.tsx`
- `src/app/api/alpha-catcher/diagnostico/route.ts`
- `src/app/api/internal/alpha-catcher/worker/route.ts`
- `src/lib/alpha-catcher/diagnostico-apis.ts`
- `src/lib/alpha-catcher/worker-client.ts`
- `src/lib/alpha-catcher/worker-executar.ts`
- `scripts/alpha-catcher-api-health.mts`
- `tests/alpha-catcher/diagnostico-apis.test.ts`
- `tests/alpha-catcher/client-stream.test.ts`
- `docs/alpha-catcher.md`

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-13 | 1.0 | Story de botão para diagnóstico manual, seguro e separado da fila | River (@sm) |
| 2026-10-13 | 1.1 | Implementados diagnóstico autenticado read-only, CLI, botão e testes focais | Dex (@dev) |

## Dev Agent Record / QA Results

Gates executados:

- `npm run lint`: PASS, 0 erros e 1.192 warnings do baseline.
- `npm run typecheck`: PASS.
- `npm test`: 4.448 passaram, 4 skipped, 1 todo e 7 falharam em 6 arquivos fora do escopo (Google Calendar, formulários de migração BPM, Builder e CLI de sessão Alpha Catcher); duas suítes BPM não iniciaram porque o Node do ambiente não fornece `node:sqlite`. O teste Alpha Catcher que falhou exige spawn de processo e foi bloqueado por `EPERM` do ambiente.
- `npm run build`: PASS; build Next concluiu com warnings do pdfjs-polyfill.
- ESLint direcionado aos arquivos alterados: PASS. Testes focais de endpoint/UI: 8/8 PASS. CLI `--help`: PASS.

O diagnóstico executado nesta máquina não representa produção: sem configuração local do worker e com DNS de saída indisponível, não foi possível medir o estado atual dos provedores reais. A operação pública permanece sem consulta CNPJ e sem alterações de banco/fila.
