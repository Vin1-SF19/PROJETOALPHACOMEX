# Story: Substituir a consulta Radar da InfoSimples pela API Alpha Comex

## Status

Ready for Review

## Story

**Como** usuário do módulo Consulta Radar, **quero** que a habilitação Siscomex seja consultada pela API Consulta Radar da Alpha Comex, **para** receber a situação e modalidade atuais sem depender da integração Radar da InfoSimples.

## Contexto e escopo

Pedido do usuário em 2026-09-28. A API de destino tem base `https://consulta-radar.alpha-comex.com` e aceita `GET /consultar/{cnpj}` ou `POST /consultar` com `{ "cnpj": "..." }`. O parâmetro é **a raiz de 8 dígitos** do CNPJ, sem pontuação. O token exclusivo do sistema deve ficar em segredo de ambiente no servidor e seguir apenas no header `Authorization: Bearer`; esta story não registra seu valor.

Os consumidores existentes incluem `src/app/api/ConsultaCompleta/route.ts` (painel Consulta Radar, consulta e reconsulta individuais e lote) e `src/app/api/ConsultaRadar/route.ts` (pré-análise/ChatBot). Hoje ambos usam `API_TOKEN` e `URL_RADAR` no formato da InfoSimples e enviam token no corpo. A troca deve abranger as chamadas Radar desses fluxos, mantendo a consulta cadastral à Receita Federal e as outras integrações InfoSimples fora deste escopo. A pré-análise valida CNPJ completo antes de consultar; o valor enviado ao provedor Radar é somente sua raiz. A UI do painel ainda mostra saldo InfoSimples: revisar esse indicador para que não seja apresentado como custo/status da nova consulta Radar.

Não há épico/PRD específico nem `docs/stories/accumulated-context.md` neste checkout. A coerência foi conferida com `story-pre-analise-integridade-apis-tributarias.md`: preservar validação do CNPJ de entrada, autorização, timeout e distinção entre resposta vazia, erro e sucesso. O contrato externo abaixo e os critérios derivam diretamente do pedido atual.

## Acceptance Criteria

1. As consultas Radar do painel, reconsulta, lote e pré-análise usam a API Alpha Comex por chamada **servidor a servidor**, enviando `Authorization: Bearer <segredo>` no header. Token não aparece em URL, query string, body enviado ao navegador, bundle cliente, resposta pública, logs ou código versionado. A configuração ausente gera erro controlado.
2. Para um CNPJ completo válido recebido nos fluxos atuais, a chamada externa recebe exatamente a raiz numérica de 8 dígitos; entrada inválida continua rejeitada sem chamada externa. A integração nunca envia os 14 dígitos ao endpoint `/consultar/{cnpj}` ou no body do `POST /consultar`.
3. Resposta HTTP 200 com `success: true` mapeia `data.cnpj`, `razaoSocial`, `situacao`, `modalidade`, `dataSituacao`, `baseLegal`, `tipoDesabilitacao` e `operacoesAutorizadas` sem trocar o significado dos campos. Os campos necessários ao contrato atual do painel e da pré-análise continuam disponíveis, incluindo razão social/contribuinte, situação, modalidade/submodalidade e data da situação. O texto `raw` é preservado como referência quando a extração estruturada, especialmente de datas, for incompleta.
4. HTTP 404 representa raiz não habilitada/não encontrada; HTTP 400 representa raiz mal formatada; HTTP 401 representa falha de autenticação/configuração; HTTP 502 com `BLOCKED_BY_CAPTCHA` representa bloqueio temporário. Esses resultados têm estado/mensagem distinguíveis, sem converter erro de autenticação, captcha, rede, timeout ou resposta inválida em “NÃO HABILITADA” e sem sobrescrever dado bom salvo com erro transitório.
5. A chamada comporta latência de vários segundos de um navegador headless, com timeout finito e estado de carregamento/erro coerente nos consumidores. Reconsulta e lote evitam frequência alta e tentativas repetidas imediatas após `BLOCKED_BY_CAPTCHA`; nova tentativa só ocorre após alguns minutos, conforme orientação operacional do provedor.
6. A consulta cadastral à Receita Federal e a persistência/visualização atuais do painel continuam funcionais. O indicador de saldo InfoSimples, se mantido por outros serviços, não sugere que mede consumo ou disponibilidade da nova API Radar.
7. Testes cobrem raiz de 8 dígitos, header de autorização sem vazamento, mapeamento de 200, 404, 400, 401, captcha, timeout e regressão dos consumidores. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes de concluir.

## Tasks / Subtasks

- [x] Inventariar chamadas Radar e contratos dos consumidores; definir um cliente servidor compartilhado e configuração secreta específica da nova integração (AC: 1–2, 6).
- [x] Implementar chamada externa, normalização da raiz, leitura do contrato e mapeamento dos estados de resposta (AC: 1–4).
- [x] Integrar consulta completa, pré-análise, reconsulta e lote; ajustar mensagens, latência, frequência e indicação de saldo no painel (AC: 3–6).
- [x] Cobrir cenários com testes, executar gates e completar checklist/File List (AC: 7).

## Dev Notes

- [Source: solicitação do usuário, 2026-09-28] Contrato externo: `GET /consultar/{raiz}` ou `POST /consultar` com JSON; raiz com 8 dígitos; `Authorization: Bearer` somente no servidor. HTTP 200 traz `success`, `cnpj`, `data` e `raw`. HTTP 404, 401, 400 e 502 `BLOCKED_BY_CAPTCHA` têm significados distintos. Cada chamada abre navegador headless; evitar alta frequência.
- [Source: `src/app/api/ConsultaCompleta/route.ts`] A rota combina Receita e Radar, consulta cache por CNPJ completo, mantém `forcar`/`somenteBanco` e grava `consultas_radar`. Avaliar mapeamento sem mudar schema. Escritas normais de consulta seguem a exceção CRUD do `AGENTS.md`; qualquer migration, backfill ou operação em massa exige Vault, backup verificado e autorização específica antes de executar.
- [Source: `src/app/api/ConsultaRadar/route.ts`] A pré-análise já protege acesso com `requirePreAnaliseAccess("tributario")`, valida CNPJ completo e expõe contrato legado para `BlocoResultados.tsx` e ChatBot. Manter essas garantias ao trocar apenas a fonte Radar.
- [Source: `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx`] O painel chama `ConsultaCompleta` para consulta, reconsulta e lote; também apresenta saldo InfoSimples. Tratar lote com cuidado por causa do custo de uma sessão headless por chamada.
- [Source: `docs/stories/story-pre-analise-integridade-apis-tributarias.md#acceptance-criteria`] A correção anterior exige validação, timeout, estados explícitos e ausência de falso sucesso. Preservar esse baseline.
- [AUTO-DECISION] A interface de entrada aceita CNPJ completo porque os consumidores e o banco já trabalham com 14 dígitos; apenas a chamada ao novo provedor usa a raiz de 8 dígitos (razão: compatibilidade com fluxo atual e contrato novo).

## Testing

Usar respostas simuladas da API externa; nunca usar a credencial real em fixtures, snapshots ou testes. Verificar integração das duas rotas e dos consumidores relevantes, inclusive o comportamento de cache/dados previamente salvos. Confirmar manualmente o estado visual de carregamento e os erros, sem disparar lote real de alta frequência.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Integração/API com segurança de segredo; complexidade média. Sem mudança estrutural de banco prevista.

**Specialized Agent Assignment:** `@dev` implementa; `@qa` valida; `@architect` apoia contrato compartilhado e segurança; `@devops` cuida de configuração/deploy.

**Quality Gate Tasks:**

- [ ] Pre-Commit (`@dev`): lint, typecheck, testes, build; revisar vazamento de segredo e estados de erro.
- [ ] Pre-PR (`@devops`): compatibilidade com consumidores e revisão CodeRabbit.
- [ ] Pre-Deployment (`@devops`): segredo configurado no servidor, timeout, rollback da integração e ausência de token no cliente/logs.

**Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min (CRITICAL corrigir; HIGH documentar); `@qa` full, até 3 iterações/30 min (CRITICAL/HIGH corrigir); `@devops` check/report only. MEDIUM documentar como dívida quando pertinente; LOW avaliar no review.

**CodeRabbit Focus Areas:** segredo restrito ao servidor; raiz de 8 dígitos; mapeamento de payload; preservação de `raw`; 404 versus falha transitória; captcha e frequência; compatibilidade da pré-análise e do painel.

## Checklist de conclusão

- [x] AC 1–6 validados com testes simulados sem credencial exposta.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` aprovados.
- [x] File List, Change Log e evidências de QA atualizados.

## File List

- `docs/stories/story-consulta-radar-api-alpha-comex.md` — especificação inicial.
- `.env.example` — configuração documentada sem valor secreto.
- `src/lib/radar/consulta.ts` — cliente servidor da nova API.
- `src/app/api/ConsultaRadar/route.ts` — pré-análise.
- `src/app/api/ConsultaCompleta/route.ts` — consulta do painel e persistência.
- `src/lib/cnpj/parse-date-br.ts` — interpretação de data brasileira com hora.
- `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx` — mensagem de erro do provedor.
- `src/components/ComponentesRadar/HabilitacaoRadarClient.tsx` — lote, reconsulta e remoção do saldo antigo.
- `tests/pre-analise/consultas-tributarias.test.ts` — contrato da rota.
- `tests/radar/consulta-completa.test.ts` — regressão da consulta completa.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story da troca de provedor Radar e critérios de aceite. | River (`@sm`) |
| 2026-09-28 | 0.2 | Implementação da integração, tratamento de erros e testes. | Codex |

## Dev Agent Record

`npm run lint`: aprovado com avisos preexistentes. `npm run typecheck`: aprovado. `npm test`: aprovado. `NEXT_DIST_DIR=.next-radar-validation npm run build`: aprovado; o diretório isolado evitou o lock de outro build simultâneo. Credencial configurada somente em `.env.local`, ignorado pelo Git. O ambiente de deploy ainda exige `CONSULTA_RADAR_TOKEN`.

## QA Results

Testes simulados das rotas aprovados. Um smoke externo único retornou HTTP 403 sem corpo JSON; a resposta real de sucesso não pôde ser confirmada a partir deste ambiente. Nenhuma chamada adicional foi feita para evitar frequência desnecessária.

## Story Draft Validation

| Category | Status | Issues |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Fluxos, valor e escopo identificados. |
| Technical Implementation Guidance | PASS | Rotas, consumidores, contrato e configuração descritos. |
| Reference Effectiveness | PASS | Fontes específicas e baseline anterior resumidos. |
| Self-Containment Assessment | PASS | Sucesso, erros, segredo, raiz e frequência explícitos. |
| Testing Guidance | PASS | Cenários verificáveis sem credencial real. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco preenchidos. |

**Final Assessment:** READY, clareza 9/10. A implementação depende da configuração segura da credencial no ambiente de execução; a story não contém seu valor.
