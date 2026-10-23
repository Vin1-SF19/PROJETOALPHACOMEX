# Story: API canônica do Portal sobre o banco atual

## Status

**Ready for Review** — GO PO (9/10), 2026-10-23. Main e Portal implementados; gates completos dos dois apps e QA local independentes aprovados. Documentação concluída; homologação/publicação staging em execução. Freeze Aria v1.0 preservado.

ID compartilhado: `portal-api-canonica-20261023`. Fonte canônica de escopo/AC: este arquivo no Painel. O Portal mantém uma ficha de execução com o mesmo nome e referencia estes AC, sem constituir outra iniciativa.

Bases isoladas: Painel `274d6d6f`, Portal `e63fe49e`, ambos em `feat/portal-api-20261023`. Diretórios: `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/portal-api-20261023` e `/home/ialpha/projetos/alpha-comex/painelclientes-worktrees/portal-api-20261023`. Raízes originais e worktrees anteriores têm mudanças alheias e não são alvos desta entrega.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [lint, typecheck, test, build, contract-tests, security-review]
```

- Executor: `@dev / Echo`, primeiro Painel, depois Portal; Nova somente para ajustes necessários de tipos/consumo UI.
- Quality gate: `@architect / Aria` no desenho; Forge, Probe, Anubis, Lens e Sage na validação, coordenados serialmente pelo Bibble.
- Ferramentas de qualidade: lint, TypeScript, testes, builds reais, contrato fornecedor/consumidor, SQLite descartável e revisão de segurança/integração.
- DevOps publica e configura exclusivamente staging nesta iniciativa, após os gates. Nenhum especialista aciona o seguinte por conta própria.

## Story

Como responsável pelo Painel e pelo Portal de Clientes, quero centralizar no backend do Painel as regras e o acesso aos dados usados pelo Portal, para evoluir cada aplicação por um contrato estável, preservar todos os fluxos atuais do cliente e retirar do Portal o acesso direto ao banco e as cópias de regras de persistência.

A etapa usa o **banco atual**. O Painel continua dono do cadastro master, colaboradores e CRM; entrega apenas projeções autorizadas. Conta externa (`ClienteOperacional.id`), atendimento (`OperacionalClientes.id`) e master (`Cliente.id`) são identidades diferentes. O Portal pode acessar vários atendimentos da própria conta, jamais inferir vínculo por nome, CNPJ ou ID fornecido pelo browser.

## Contexto e fontes

- Parecer aceito Aria: `/tmp/portal-database-decoupling-20261023-aria.md`, seções “Fronteiras e garantias necessárias” e “Evolução conceitual e critérios de sucesso”: API primeiro, separação física apenas mediante evidência futura.
- Diagnóstico Dara: `/tmp/portal-database-decoupling-20261023-dara.md`, §§5–8: contrato de hash integral acopla schemas; senha, revogação e transações impedem extração parcial ingênua.
- Blueprint fresco Scout: `/tmp/portal-api-20261023-scout.md`, §§1–7; mapa `/tmp/portal-api-20261023-opmap.json`, `operationCount=30`, bases acima. O inventário abaixo preserva essas 30 entradas, algumas locais/inativas/compatibilidade, sem prometer 30 endpoints novos.
- Preparação DevOps: `/tmp/portal-api-20261023-devops-prep.md`: dependências privadas por worktree; Prisma generate do Painel pendente para o próximo owner antes dos gates; nenhum banco real configurado/validado nesta estação.
- Contrato anterior: `docs/architecture/checklist-analistas-crm-20261022.md`, §§2–4,9,14: ator Portal, ACL, recibo/CAS/journal, storage e polling. Story anterior `docs/stories/story-checklist-analistas-reformulacao-integracao-crm-20261022.md`: a sincronização dos 320 models motivada por campo interno CRM é a dependência a substituir, preservando regras e cobertura existentes.
- `accumulated-context.md` foi procurado nas duas worktrees e não está disponível. Coerência entre stories deriva das fontes anteriores; não se presume conclusão de homologações antigas. A story anterior de release tem autorização própria e não concede produção a esta mudança.

## Acceptance Criteria

1. **Owner único e escopo completo:** as 30 entradas da matriz têm destino explícito e teste de compatibilidade ou justificativa local/inativa, conforme matriz congelada por Aria. Todo acesso persistente antes feito pelo Portal passa pelo owner Painel. As actions internas do Painel usam diretamente as mesmas funções canônicas, preservando transações locais; não fazem loop HTTP para sua própria API nem mantêm outra implementação das mesmas regras.
2. **Contrato específico:** DTOs e validação de requests/responses versionados têm fonte editável única no Painel e artefato/SDK reproduzível no Portal, com versão, manifesto e comando de verificação de drift. O contrato não exporta Prisma, GetPayload, ReturnType de serviço ou hash dos 320 models. Datas wire são ISO string/null; URLs documentais/avatar são relativas ao BFF. Não há senha/hash, reset hash, storage key permanente ou credenciais no DTO; o token curto restrito do upload direto é a exceção funcional prevista. Uma alteração aditiva interna de CRM não usada no contrato não altera seu snapshot nem exige republicar Portal.
3. **Identidade e isolamento:** cada handler de dados do namespace API valida app e principal assinado vinculado à conta e revalida existência/sessionVersion. Credencial técnica sozinha, Alpha cookie sozinho ou userId enviado pelo cliente não autorizam dados de conta. Testes verificam 401 para identidade ausente/inválida/expirada e 403 para autorização negada, com proteção de existência de recursos conforme contrato congelado, inclusive cruzamento de contas, app/principal incompatível e sessão revogada. Login, recuperação e consumo de reset têm o modo pré-sessão específico autenticado por app, rate limit e prevenção de replay definidos por Aria; não exigem principal já logado.
4. **Sessão privada e falha fechada:** login Credentials, revalidação auth(), logout local e acesso público a `/redefinir-senha` continuam funcionando. Bearer principal e segredo do app ficam exclusivamente no servidor/JWT privado criptografado, ausentes de `/api/auth/session`, Session pública, props RSC, bundles browser e logs; senha nunca é retida. Falha de rede/API não produz sessão válida nem fallback de banco. Logout continua limpando a sessão local, sem inventar revogação global.
5. **Credenciais externas preservadas:** nova senha externa tem mínimo12 caracteres e máximo72 bytes UTF-8. Hash presente nunca cai em plaintext. Legado acima72 bytes, inclusive acima100 caracteres, usa comparação SHA256 timing-safe sem upgrade; legado até72 bytes mantém upgrade bcrypt12 por CAS de senhaHash null/senha exata/versão, com releitura segura quando perde CAS. Testes bcrypt reais cobrem Unicode, limites, corrida e troca de senha com invalidação de sessão. A política interna staff 12–128 caracteres permanece distinta.
6. **Reset e recuperação preservados:** solicitar recuperação mantém resposta neutra que orienta o analista; não envia novo email nem troca de provedor. O analista continua emitindo link `/redefinir-senha#token=...`, token aleatório32 bytes base64url, hash SHA256 e validade15min; replay de emissão não reexibe token. Consumo tem expiração, uso único, corrida/CAS e incremento da versão, limpa plaintext/reset e exige reautenticação. Não reutiliza reset de usuarios internos.
7. **Perfil/avatar:** ler perfil e atualizar nome/email preservam validação, normalização e conflito de email. Upload/download de avatar mantêm JPEG/PNG/WebP com magic bytes, limite2MiB, prefix/REF privados existentes, URL relativa, checagem de conta e versão inclusive após upload e durante stream; legado só em allowlist HTTPS sem redirect/SSRF. Wrapper antigo de URL arbitrária continua recusando ou sai apenas após comprovar ausência de callers.
8. **Notificações:** inbox paginada (pageSize1–100), total e não lidas, marcar uma/todas, incremental e SSE mantêm shape, ordem e isolamento da própria conta. SSE mantém ticks8s, revalidação de conta/versão e cleanup de abort/timer; expiração/revogação de principal encerra conforme desenho congelado. EventSource usa rota same-origin BFF, sem bearer no browser/URL. Marcar todas é operação da inbox autenticada, não backfill administrativo.
9. **Leituras e poderes limitados:** lista/detalhe, histórico, progresso legado e documentos preservam paginação, projeções master/analista, 11 status legíveis e capabilities reais. Escrita documental só em checklist ativo e upload próprio quando exigido pelo serviço. API nega alteração de item/status/tipo/owner/modelos/CRM e restauração por Portal; schema estrito recusa campos/operation extras. Não expõe dispatcher administrativo genérico nem transforma cliente em ator INTERNO.
10. **Upload privado existente:** permanece Blob SDK2.8.2 `put` com clientToken restrito, pathname/MIME exatos, acesso private, TTL15min, máximo8MiB, sem overwrite/sufixo aleatório. Iniciar→put→finalizar→registrar preserva conta/item/recibo, expiração e autorização antes de emitir token. Finalize valida bytes reais, tamanho, MIME, magic e SHA. Raw `/api/upload` sem caller UI localizado retorna HTTP410 GONE após guard/CSRF; não ganha proxy8MiB nem persistência Portal. Upload UI permanece direto ao Blob, evitando limite de corpo da função Vercel. Não há callback ativo hoje e não se exige implementá-lo; qualquer mudança dessa escolha requer desenho explícito e validação do protocolo real do SDK.
11. **Atomicidade e idempotência:** registrar/observar/remover documento preserva mutationId, expectedRevision, hash do payload, ACL revalidada, recibo, documento, CAS do atendimento e journal na mesma transação. Retry idêntico não repete efeito; payload divergente retorna conflito; perda de CAS faz rollback completo. Remoção é lógica, preserva ator/data; observação documental nullable até5000 caracteres não se confunde com observação de item. Provas usam SQLite real descartável no Painel, além dos testes da fronteira HTTP.
12. **Streaming e limites:** documento download mantém ACL/soft-delete/legacy allowlist e máximo25MiB; avatar mantém2MiB; upload raw aposentado retorna410, enquanto upload direto mantém8MiB. Download/avatar revalidam a cada5s; leitura privada tem timeout10s. BFF propaga abort e limita bytes reais, sem buffering integral/base64; upstream tem origem server-only fixa, redirect recusado e headers permitidos, sem encaminhar Set-Cookie/segredos. JSON request máximo32KiB e response máximo2MiB reais, conforme freeze Aria, independente de Content-Length/serverActions.bodySizeLimit; excesso, truncamento, timeout e falha upstream têm erros públicos estáveis sem stack/Prisma.
13. **Portal sem banco:** somente depois da migração de todos os callers e do rehome de cobertura, remover cliente/adapter/SQL deps, `lib/prisma.ts`, backend duplicado, schema Prisma integral e teste/script de hash global do Portal. Portal completa lint/typecheck/test/build sem Prisma e sem URLs/tokens Turso/DB ou credencial master do storage; detector de imports/dependências SQL e testes de contrato provam a fronteira. Não apagar dumps/dados reais. Código morto UploadThing/Pusher que referencie backend removido é retirado após busca de callers, sem reativar provider.
14. **UI e regressão:** navegação, menus, telas, formulários, estados de erro, capacidades, histórico e fluxos do Portal mantêm a experiência atual. Ajustes de imports/tipos são permitidos, sem redesign. Outros módulos do Painel e as regras internas de staff/CRM/modelos continuam intactos. Nenhum novo módulo de menu/atalho é criado para esta API.
15. **Cobertura e gates:** os casos DB de identidade/avatar/checklist/storage do Portal são rehomed ou vinculados a cobertura equivalente no owner Painel, sem reduzir cobertura causal. Portal mantém testes de integração SDK/BFF, UI, reset routing, sessão, DTO e upload. Ambos repositórios passam `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` reais, mais contrato fornecedor/consumidor, Probe, Anubis e Lens; Sage cobre falhas/concorrência. Registrar evidências e File List real antes de publicação; build que ignora tipos não substitui typecheck.
16. **Rollout staging:** API Painel é publicada e comprovada READY em staging antes do cutover Portal. DevOps valida origem/configuração/credenciais próprias do staging, depois publica Portal e homologa ponta a ponta todos os fluxos pertinentes. Só depois retira as credenciais de DB/storage master da configuração efetiva do Portal staging. Não copia segredos/dados de produção. Rollback de código usa versões e contrato compatíveis e não restaura caminho de DB como fallback runtime. Produção exige futuro pedido explícito; nenhuma DDL, nova base, reset administrativo, seed/backfill ou lote está incluído nesta story.

## Matriz de cobertura — 30 entradas Scout

Rotas/métodos/inputs/DTOs finais estão congelados no [desenho normativo v1.0](../architecture/portal-api-canonica-20261023.md), §§2–9, com matriz30 na§4. A matriz resumida abaixo referencia as mesmas entradas; compatibilidade tem destino explícito sem query Portal residual.

| # | Entrada atual | Destino previsto | AC |
|---|---|---|---|
| 1 | Login Credentials.authorize | Identidade externa Painel via SDK privado | 3–5 |
| 2 | Revalidar sessão | Identidade externa Painel; fail closed | 3–4 |
| 3 | Logout | NextAuth local; sem nova revogação global | 4 |
| 4 | Solicitar recuperação | Painel, rate limit e mensagem neutra | 6 |
| 5 | Consumir reset | Painel, pré-sessão app autenticado | 6 |
| 6 | Trocar senha | Painel, CAS/version; signOut local | 5–6 |
| 7 | Ler perfil | Painel projeção perfil | 7 |
| 8 | Atualizar nome/email | Painel; revalidatePath continua Portal | 7 |
| 9 | Referência foto legada | Compat local guard /me + erro constante, não envia URL | 7 |
| 10 | Avatar upload | Painel owner; BFF binário | 7,12 |
| 11 | Avatar download | Painel stream; BFF binário | 7,12 |
| 12 | Inbox paginada | Painel notificações | 8 |
| 13 | Marcar uma lida | Painel, WHERE id+conta | 8 |
| 14 | Marcar todas lidas | Painel, somente inbox da conta | 8 |
| 15 | Incrementais legacy | Compat SDK→Painel; ISO/take100 | 8 |
| 16 | SSE inbox | Painel owner; BFF same-origin | 8,12 |
| 17 | Listar atendimentos | Helper canônico Painel | 9 |
| 18 | Detalhe ativo/histórico | Helper canônico Painel | 9 |
| 19 | Wrappers list/get | Aliases locais delegam SDK | 1,9 |
| 20 | Progresso legacy | Painel resolve checklist e ACL | 9 |
| 21 | Listar docs | Helper Painel filtrando removidos | 9 |
| 22 | Iniciar upload direto | Painel recibo+token curto; Blob put no cliente | 10 |
| 23 | Callback Blob | Ausente/inativo; manter sem callback | 10 |
| 24 | Finalizar upload | Painel valida bytes/storage/recibo | 10–11 |
| 25 | Raw upload compat | BFF410 GONE com guard/CSRF, sem caller UI e sem persistência | 10,12 |
| 26 | Registrar documento | Helper Painel transacional | 11 |
| 27 | Observação do documento | Helper Painel, somente próprio upload | 11 |
| 28 | Remover documento | Helper Painel soft delete, próprio upload | 11 |
| 29 | Download documento | Painel stream; BFF attachment | 12 |
| 30 | UploadThing desativado | Rota compat410 e retirada de wrappers/deps mortos, sem provider | 13 |

## Tasks / Subtasks — execução serial

- [x] **T0 Aria — congelar desenho antes de implementar (AC1–16).** Freeze concluído em `docs/architecture/portal-api-canonica-20261023.md` v1.0. Decisões normativas §§2–11 cobrem todos os itens seguintes; nenhum item de implementação foi concluído nesta etapa. Escopo original: Registrar no artefato normativo e referenciar aqui: namespace/rotas e matriz30, schemas wire/projeções, versão/gerador/manifesto, erros e HTTP, app/principal JOSE (algoritmo/issuer/audience/kid/TTL/rotação), vínculo conta/sessionVersion, retenção privada NextAuth, pré-sessão/replay/rate-limit/IP confiável, cookies/CSRF BFF, duração SSE, limites JSON/timeouts, opção sem callback e rollout/rollback. Definir nomes das novas variáveis server-only e seu escopo staging; nenhum valor secreto em docs. Atualizar Draft após freeze/revisão.
- [x] **T1 Echo Painel — contrato e fronteira (AC1–4,9,12).** Gerador e DTO puro versionado; guard comum em todo handler, independente da sessão Alpha; allowlist exata, origem/headers/erros/limites; testes fornecedor/compatibilidade. Fonte Scout §§2–3,5–6.
- [x] **T2 Echo Painel — owner de identidade/perfil/notificações (AC5–8,12).** Mover regras externas e avatar, manter emissão de reset interna no mesmo owner; SSE/stream e rehome dos testes causais. Não reutilizar policy/reset staff. Fonte Scout §§3–5.
- [x] **T3 Echo Painel — atendimento/documentos (AC9–12).** Expor somente operações permitidas usando serviços PORTAL existentes; preservar CAS/recibo/journal; provar transação com SQLite descartável e fronteira HTTP. Actions internas continuam chamadas diretas. Fonte Scout §§1–2,4,7.
- [x] **T4 Echo Portal — consumo completo (AC1–4,7–10,12).** SDK/BFF server-only, auth/jwt/session callbacks, actions e handlers binários/SSE. Guard em cada entrada, sem confiar em proxy/middleware. Migrar todos os callers da matriz e manter aliases/compat acordados. Fonte Scout §§3,5–6.
- [x] **T5 Echo Portal — remoção após cobertura (AC2,13,15).** Rehome de testes DB primeiro; remover backend/schema/hash/deps SQL somente após busca transitiva de callers. Gerar artefato consumidor e substituir teste de paridade global por contrato/provider+consumer; provar build/typecheck/test sem env DB/Turso/master storage. Fonte Scout §§5–7.
- [ ] **T6 Nova se necessário (AC14).** Ajustar somente tipos/imports e adapters DTO usados pelos componentes atuais; preservar layout, menus e fluxo. Fonte Scout §6.
- [x] **T7 Forge nos dois repositórios (AC15).** Clientes/ferramentas próprios de cada worktree; gerar Prisma privado somente no owner Painel quando necessário. Rodar quatro gates reais por repo e contrato. Não adotar resultados antigos como evidência da árvore nova.
- [x] **T8 Probe → Anubis → Lens; Sage conforme lacunas (AC3–15).** Conectar fluxos UI/BFF/API e negar crossconta; revisar auth/segredos/storage/replay/abort/transações, regressão e casos de falha. Correções voltam ao owner e aos gates afetados. Nenhum especialista publica.
- [x] **T9 Scribe/Kowalski (AC1,13,15–16).** Atualizar mapa/integrações/memória com owner único e contratos reais, checklist e File List por repo; distinguir implementado, testado e homologado.
- [ ] **T10 DevOps STAGING (AC16).** Preflight ambiente efetivo sem assumir `.env.local`; usar `.env.staging.local` para CLI remoto. Validar Main API READY antes do cutover Portal; credenciais staging próprias, smoke autenticado e retirada de segredos desnecessários somente após comprovar cobertura. Registrar rollback compatível, deployment/alias e limitações. Não promover produção.

## Dev Notes

O Painel já tem `AtorChecklist` PORTAL e `exigirLeituraChecklist` revalida conta/versão; `exigirEscritaChecklist` recusa o Portal. A nova fábrica de ator deriva do principal verificado, não da sessão interna. `commands.executarAtendimento` e helpers documentais preservam autorização/replay/CAS/journal na transação. Não criar outro backend escritor nem ampliar ACL. [Source: Scout §2; arquitetura anterior §§2,4]

Main middleware e Portal proxy excluem rotas API; proteção precisa estar em cada handler/action e nos streams. No Portal, privado User/JWT pode precisar novos campos, mas Session pública não. Upstream é configuração server-only validada. [Source: Scout §3]

Blob2.8.2 atual usa `put`+clientToken, não `handleUpload`/callback. Formato de chave de documentos e avatar `perfil-private:v1:` deve continuar compatível. Staging exige binding/token explícito; não ativar fallback de produção para resolver falta de credencial. `CHECKLIST_PRIVATE_BLOB_TOKEN`, `CHECKLIST_STORAGE_PREFIX`, `CHECKLIST_LEGACY_ALLOWED_HOSTS` permanecem no owner Painel conforme necessidade; `CHECKLIST_PRODUCTION_READ_WRITE_TOKEN` e condicionais existentes não concedem uso staging. Não manter segredo master no Portal após validação operacional. [Source: Scout §4]

`AUTH_SECRET`/`NEXTAUTH_SECRET` e HMAC rate-limit são nomes existentes. `DATABASE_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` deixam de ser dependências Portal. Nomes e escopos das novas chaves estão congelados no desenho§6; valores são exclusivamente privados de staging. App key própria + principal HS256 emitido somente Main,7dias absolutos sem refresh; não presumir OAuth vendor ou novo provedor. `NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN` continua apenas origem pública usada pelo emissor do link reset. [Source: Scout §§3,5]

**Freeze técnico concluído:** `/api/portal/v1`,30 entradas, contrato puro `zod/v3` compatível com versões locais, SDK vendored gerado Main sem registry, hash de integridade sem paridade global; app+principal HS256/7dias absolutos, token privado no JWE Auth.js e recuperação getToken cookie-only com cookieName=salt explícitos/chunking oficial, sem recursão auth→SDK→auth. JSON32KiB/2MiB, streams bounded, SSE45s Main/50s BFF/reconnect, raw410 e sem callback Blob. Ler desenho inteiro antes da execução. Acesso efetivo ao store/config staging é preflight operacional posterior, sem inferir valores pela fonte. Usuário esclareceu que contas atuais são de teste e o sistema ainda não foi lançado; homologar com uma conta existente de staging de forma privada, sem seed ou redefinição em massa. [Source: Scout §§3–7; DevOps prep]

**Project Structure Notes:** seguir `src/lib`/`src/app/api` no Painel e `lib`/`app/api` no Portal. Blueprint recente substitui sugestões genéricas. `docs/framework/{coding-standards,tech-stack,source-tree}.md`, índice sharded/guia genérico de arquitetura e `accumulated-context.md` não foram encontrados nas worktrees; não há orientação genérica adicional a presumir. `.Codex/commands/AIOX/agents/sm.md` e `.aiox/gotchas.json` ausentes; persona via skill SM disponibilizada.

**Fora do escopo:** separação física de banco, banco por frontend, replicação/dual-write, Kafka/outbox distribuída, rede de microsserviços, novos emails/OAuth, novos recursos ou redesign. Apenas avaliação futura por domínio e medições pode fundamentar outro banco. DDL/índice/backfill/lote eventual constitui mudança de escopo sujeita a Vault, backup completo verificado≤48h e confirmação específica; nada disso é necessário ou executado nesta preparação.

## Testing — orientação para a execução

Main: estender testes PORTAL existentes de `tests/checklist-analistas/backend.service.test.ts`, incluindo conta diferente, storage/magic e finalize, com novas suítes `tests/portal-api/`. Credenciais com bcrypt real/Unicode/legado longo/CAS; reset single-use/corrida/revogação; perfil conflito e avatar inválido/crossconta; contrato wire/ISO/11 status/URLs relativas; auth inválido/replay/crossapp; transação real de recibo+doc+revision+journal e rollback. Portal: fake API somente para fronteira consumidor, sem substituir prova transacional do owner. [Source: Scout §§2,5–7]

Ambos: JSON excessivo/truncado, body sem Content-Length, magic falso, receipt expirado/reusado, retry/payload divergente, SSRF/redirect, limite25MiB/abort/timeout/revogação midstream, cleanup SSE e erro upstream. Capturar `/api/auth/session`/RSC/logs/bundles e verificar ausência de bearer/segredos. Probe verifica telas/menu/roteamento existentes e EventSource real. Staging smoke usa conta autorizada e store do ambiente, sem dados/segredos de produção. [Source: Scout §7]

## 🤖 CodeRabbit Integration

**Story Type Analysis:** API; secundários Integration, Security e Architecture; complexidade alta (dois repositórios, identidade e streaming).

**Specialized Agent Assignment:** @dev/Echo primário; @architect/Aria para desenho, @qa/Sage para cobertura, Forge/Probe/Anubis/Lens para gates, Nova se tipagem exigir; @github-devops/DevOps para PR e staging. Trabalho serial pelo Bibble.

**Quality Gate Tasks:**

- [ ] Pre-Commit (@dev): CodeRabbit `--prompt-only -t uncommitted`, antes da conclusão do código.
- [ ] Pre-PR (@github-devops): revisar diff/contrato e rodar CodeRabbit contra a base efetiva staging antes de PR.
- [ ] Pre-Deployment STAGING (@github-devops): conferir gates, segredos, compatibilidade e rollback. Produção não se aplica.

**Self-Healing Configuration (Story6.3.3):** @dev light,2iterações/15min, CRITICAL auto-fix; HIGH documentado; MEDIUM/LOW sem correção automática. @qa full,3iterações/30min, CRITICAL/HIGH auto-fix e MEDIUM dívida. DevOps check,0iterações, somente reporte. Nenhum CRITICAL aberto na entrega. Se CLI indisponível, registrar ausência e revisão alternativa conforme graceful_degradation do core-config; nunca declarar review executado.

**CodeRabbit Focus Areas:** autenticação app/principal, ACL/crossconta, DTO wire e compatibilidade, nenhuma dependência Prisma browser/Portal, regras externas distintas de staff, CAS/replay/atomicidade, streams/SSRF/limites e ausência de segredos.

## Checklist de preparação — story-draft-checklist

Aplicação YOLO em23/10/2026, separada dos gates de implementação. Todos os itens das seis categorias foram confrontados com este documento e as fontes. Não há epic numerado para copiar AC literalmente: o pedido autorizado nomeia esta story; AC foram derivados do parecer aceito/blueprint sem novos recursos.

| Categoria | Resultado | Evidência / ação |
|---|---|---|
| 1. Objetivo e contexto | PASS | Story, owner, escopo banco atual, dependências T0 e bases explícitos |
| 2. Orientação técnica | PASS documental após T0 | Desenho normativo v1.0 congela matriz30, DTO/SDK, app/principal, recuperação JWE privada, CSRF/IP, limites/streams, rollout e provas |
| 3. Referências | PASS | Fontes com seções e resumo autocontido; relatório /tmp acessível nesta sessão, decisões finais serão persistidas por Aria |
| 4. Autocontenção | PASS | AC e matriz reproduzem escopo essencial, exceções legadas e pendências |
| 5. Testes | PASS | Cenários causais, SQLite e gates mensuráveis por repo; execução ainda pendente |
| 6. CodeRabbit | PASS | Tipos/agentes/gates/self-healing/foco definidos conforme configuração habilitada |

**Resultado atualizado: READY, GO PO; T0 concluído.** As escolhas técnicas antes parciais estão no desenho v1.0; restante da checklist documental permanece válido. Revisão PO não substitui gates/QA de implementação. Developer perspective: escopo implementável pelo executor Main→Portal com o freeze, sem inventar identidade/limites/rotas. Não há bloqueio de produto ou necessidade de nova confirmação genérica.

[AUTO-DECISION] Sequência/nome/epic/elicitação → usar nome e escopo explicitamente autorizados pelo coordenador, sem nova numeração/PRD/ClickUp; nenhuma integração externa solicitada. Artefatos existentes satisfazem a fonte de requisitos. Story release anterior e suas permissões não são reutilizadas.

[AUTO-DECISION] Aprovar tecnicamente a implementação agora? → T0 resolvido por Aria no desenho v1.0; encaminhar revisão PO curta pelo coordenador e execução serial autorizada. Implementação/gates/deploy não estão concluídos.

## Dev Agent Record / File List

**Histórico da preparação/freeze e revisão PO (antes da implementação Echo):** `docs/stories/story-portal-api-canonica-20261023.md` em cada worktree (Painel canônica; Portal ficha local) e `docs/architecture/portal-api-canonica-20261023.md` apenas Main. Modelo/execução de desenvolvimento, debug logs e notas de conclusão: pendentes dos executores. Nenhuma source app/env/schema/config/CI alterada; nenhum commit/gate/deploy/DB realizado.

**Planejado Painel — confirmar por diff após implementação:**

- Criar `contracts/portal-api/v1.ts`, `scripts/portal-api/generate-contract.mjs` e manifesto/artefato versionado (formato final Aria).
- Criar `src/lib/portal-api/{auth,http,identity,perfil,notificacoes}.ts`, owner avatar `src/lib/perfil/avatar.ts`, helpers externos de credenciais/policy se separados, handlers explícitos sob `src/app/api/portal/v1/`.
- Adaptar somente se necessário `src/lib/checklist/{leitura,documentos,dto,schemas,types}.ts`; integrar emissão/reset externo em `src/actions/ClientesOperacional.ts` se necessário. `acesso/commands/service` já têm suporte PORTAL; não editar sem necessidade demonstrada.
- Criar/rehomar `tests/portal-api/*` e casos owner nos testes Checklist/identidade/avatar; atualizar scripts/package/lock apenas se dependências/geração exigirem. Preservar schema/migrations Main e módulos alheios.
- Atualizar esta story e, após entrega, `.bibble/memory/{integration-points,codebase-map,architecture}.md` e journal pelo owner correspondente.

**Planejado Portal:** ficha local homônima contém checklist e File List do BFF/remoções; AC aqui são compartilhados. A lista planejada não afirma arquivos alterados nem permite remoção cega de diretórios.

### Execução Echo Main — 23/10/2026

Main implementado conforme freeze: 24 métodos remotos e 6 destinos locais/inativos = matriz30 completa. Contrato/SDK canônicos Zod/v3, artefatos SHA determinísticos e transporte server-only; app+JWS HS256 absoluto7dias com versão revalidada, identidade externa/perfil/avatar/inbox/SSE e adapters sobre serviços transacionais existentes. Helpers staff/Checklist, schema e dependências existentes permanecem preservados. Esta etapa não adapta nem remove fontes do Portal.

Verificação sanitizada SQLite local: Prisma generate6.19.3 exit0; `npm run typecheck` exit0 (13,58s); ESLint focal exit0 sem warnings (1,22s); Vitest focal **63 testes/6 arquivos PASS**, exit0 (7,53s). Contrato `--check` exit0. Build:player local foi necessário para o artefato gerado preexistente exigido pelo typecheck; build completo e npm test/lint globais dos dois apps ficam no T7. Logs `/tmp/portal-api-20261023-handoff-final-{focal,lint,typecheck}.log`, harness `/tmp/portal-api-20261023-run.py` usa apenas allowlistenv e fixtures próprias em RAM, nunca env remoto.

Rehome causal antes da remoção Portal: `password-legacy-compat.test.ts` + `password-byte-boundary.test.ts` + casos de identidade de `checklist-backend.test.ts` → `tests/portal-api/backend.test.ts` (bcrypt real Unicode72/long>100/hash-first/CAS simultâneo e perdido para reset; policy/owner reset e troca recusamoversize sem consumir token; reset72, expiração/uso único/corrida/version). `perfil-avatar.test.ts` → mesmo backend Main (PNG privado roundtrip, JPEG/WebP magic,2MiB/vazio/MIME,ACL/chave alheia/SSRF/revogação pósput). DTO/status do backend Portal → `contracts.test.ts`, `backend.test.ts` e suíte Main existente; transações Checklist/storage → suítes Main existentes executadas mais novas provas Portal actor de rollback/replay/recibo+documento+revision+journal SQLite. Os testes BFF/Auth.js/UI continuarão no consumidor e devem ser adaptados na próxima estação.

**File List real Echo Main:**

- `artifacts/portal-api/v1/manifest.json`
- `artifacts/portal-api/v1/sdk.server.ts`
- `artifacts/portal-api/v1/v1.ts`
- `contracts/portal-api/sdk.server.ts`
- `contracts/portal-api/v1.ts`
- `scripts/portal-api/generate-contract.mjs`
- `src/app/api/portal/v1/[...unsupported]/route.ts`
- `src/app/api/portal/v1/atendimentos/[id]/route.ts`
- `src/app/api/portal/v1/atendimentos/route.ts`
- `src/app/api/portal/v1/checklists/[id]/progress/route.ts`
- `src/app/api/portal/v1/documents/[id]/download/route.ts`
- `src/app/api/portal/v1/documents/[id]/observation/route.ts`
- `src/app/api/portal/v1/documents/[id]/remove/route.ts`
- `src/app/api/portal/v1/documents/route.ts`
- `src/app/api/portal/v1/identity/login/route.ts`
- `src/app/api/portal/v1/identity/me/route.ts`
- `src/app/api/portal/v1/identity/password/route.ts`
- `src/app/api/portal/v1/identity/recovery/route.ts`
- `src/app/api/portal/v1/identity/reset/route.ts`
- `src/app/api/portal/v1/notifications/[id]/read/route.ts`
- `src/app/api/portal/v1/notifications/incremental/route.ts`
- `src/app/api/portal/v1/notifications/read-all/route.ts`
- `src/app/api/portal/v1/notifications/route.ts`
- `src/app/api/portal/v1/notifications/stream/route.ts`
- `src/app/api/portal/v1/profile/avatar/route.ts`
- `src/app/api/portal/v1/profile/route.ts`
- `src/app/api/portal/v1/uploads/finalize/route.ts`
- `src/app/api/portal/v1/uploads/initiate/route.ts`
- `src/lib/perfil/avatar.ts`
- `src/lib/portal-api/auth.ts`
- `src/lib/portal-api/checklist-handlers.ts`
- `src/lib/portal-api/config.ts`
- `src/lib/portal-api/credentials.ts`
- `src/lib/portal-api/errors.ts`
- `src/lib/portal-api/file-handlers.ts`
- `src/lib/portal-api/http.ts`
- `src/lib/portal-api/identity-handlers.ts`
- `src/lib/portal-api/identity.ts`
- `src/lib/portal-api/notification-handlers.ts`
- `src/lib/portal-api/notifications.ts`
- `src/lib/portal-api/profile.ts`
- `src/lib/portal-api/projections.ts`
- `src/lib/portal-api/scope.ts`
- `tests/portal-api/backend.test.ts`
- `tests/portal-api/contracts.test.ts`
- `tests/portal-api/fixtures/consumer-v1.json`
- `tests/portal-api/routes.test.ts`
- `tests/portal-api/streams.test.ts`
- `docs/stories/story-portal-api-canonica-20261023.md` (status/checklist/execução/file list).

Handoff com hashes, matriz30 e limitações: `/tmp/portal-api-20261023-echo-main.md`; inventário `/tmp/portal-api-20261023-echo-main-files.json`. Nenhum deploy/READY staging, DDL real, acesso a DB real, env real, commit ou push. T4–T10 e revisão de segurança/integração continuam pendentes.

### Execução Echo Portal e ajuste SDK — 23/10/2026

T4–T5 concluídos na worktree Portal: ações/Auth.js/BFF/aliases e sessão privada com getToken cookie-only, retirada completa de SQL/schema/hash/deps após rehome Main, sem alterações visuais. Portal passou npm test40 Vitest+2 Node, typecheck, lint e contrato/boundary sem variáveis DB/Turso/storage master; npm ci --ignore-scripts também passou. Forge/builds e QA/staging continuam pendentes. Relatório `/tmp/portal-api-20261023-echo-portal.md`, inventário/hashes `/tmp/portal-api-20261023-echo-portal-files.json`.

Bug de integração corrigido no SDK canônico: erro Result não carregava status HTTP/Retry-After ao adapter BFF. SDK agora guarda esses metadados em WeakMap server-only; requestId segue envelope, JSON não ganha campos. Somente SDK/teste fornecedor/artefatos Main mudaram, sem backend/schema/DTO/ops/TTL. SDK SHA anterior `dc9dc5cba4533bf5129b55e574e81e9612c86c0e01a05d0a88aabd39f8646cae` → atual `6d61f8a45074ac4333b7cf69b4dcf66a8de43f7216f90d4acaa13bfc9092fac1`; ambos artefatos regenerados, contractVersion1.0.0/major1 preservado no pacote ainda não publicado. Main typecheck0/7,67s,15 testes correlatos0 e lint focal0 após ajuste. A bateria63 da estação Main é evidência anterior; o Forge formal deve usar as fontes/artefatos finais.

## QA Results

Preparação/freeze documental somente: T0 e checklist acima; gates de app, QA independente, segurança, integração e homologação staging **PENDENTES**. Registrar evidências por árvore candidata; não chamar esta story de Done enquanto AC15–16 não forem comprovados.

Revisão PO alterou somente esta story (status, metadados executor/gate, checklist documental e Change Log); nenhuma source app foi alterada pelo PO.

## Parecer PO — validate-story-draft

**GO — 9/10, confiança alta, 2026-10-23, Pax.** Pronta para desenvolvimento serial Echo Main → Echo Portal. Revisão documental dos 16 AC, matriz Scout 30/30 e desenho Aria v1.0; nenhum bloqueante de requisitos/contrato. A aprovação é de implementabilidade, não de código ou publicação.

- [x] Template, responsabilidades distintas e ferramentas de qualidade explícitas; sem placeholders de requisito.
- [x] AC1–16 rastreados às tarefas e provas; matriz 1–30 completa, incluindo logout local, aliases, callback ausente, raw410 e UploadThing inativo.
- [x] Contrato wire/compatibilidade, segredo de assinatura só Main, principal7dias, sessão JWE privada cookie-only e ACL/version documentados.
- [x] Credenciais externas/staff distintas, reset15min, rehome DB causal e atomicidade/CAS/idempotência preservados no plano.
- [x] Limites/stream/CSRF, remoção SQL total após migração e rollout Main READY → Portal exclusivamente staging definidos.
- [x] CodeRabbit habilitado: seção/agentes/gates/self-healing/focos presentes. CLI e quality gates não executados nesta revisão.
- [x] PO master checklist e change-checklist confrontados item a item; relatório detalhado em `/tmp/portal-api-20261023-po.md`.
- [ ] Implementação, quatro gates nos dois repos, contrato, QA independente e homologação staging: aguardam executores.

[AUTO-DECISION] Status de origem “Ready for PO Review” difere de Draft no pre-check genérico do task → registrar diretamente **Ready**, conforme handoff explícito do coordenador para a revisão pós-freeze. Não simular estado Draft nem declarar Done. Versão documental0.2 normalizada para0.2.1 (patch de processo).

[AUTO-DECISION] Epic/PRD/contexto acumulado → não criar nova iniciativa/epic: requisitos vêm do parecer aceito, story canônica e desenho normativo; histórico anterior de Checklist foi referenciado, sem herdar aprovação de produção. `accumulated-context.md` e `.aiox/gotchas.json` ausentes; caminho legado `.Codex/commands/AIOX/agents/po.md` ausente, persona carregada da skill PO disponível. Nenhuma nova decisão de produto necessária.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-23 | 0.1 | Draft canônico,30 entradas,16 AC, dependência Aria e execução staging serial | River / SM |
| 2026-10-23 | 0.2 | Freeze técnico Aria v1.0 completo; matriz30/segurança/SDK/limites/rollout, raw410, T0 concluído e Ready for PO Review | Aria |
| 2026-10-23 | 0.2.1 | Validated GO (9/10), Ready for PO Review → Ready; checklist documental PO e metadados executor/gate explícitos; implementação/gates pendentes | Pax / PO |

| 2026-10-23 | 0.3 | Echo Main implementado: contrato/SDK/guards/24 métodos, rehome causal e63 testes focais; Portal e gates/homologação pendentes | Echo |

| 2026-10-23 | 0.4 | Echo Portal concluiu T4–T5;42 testes consumidor, lint/typecheck e boundary; SDK preserva HTTPstatus/RetryAfter sem mudar wire; builds/QA/staging pendentes | Echo |


### Forge — gates locais dos dois candidatos, 23/10/2026

- [x] Oito gates globais reais (quatro por repo), uma vez cada, todos exit0. Main: TC7,43s/lint44,63s(0erros1183warnings)/fullcoverage41,29s(753arquivos6168PASS+4skip1todo)/build99,08s(Prisma/player/webpack/86páginas). Gates correspondentes do outrorepo e logs no relatório consolidado.
- [x] Maincontractcheck0,02s/Portalcontract0,07s/boundary0,08s exit0: contrato1.0.0/SDK6d61f8a4… íntegros,24/24métodos de negócio em21paths; Portal62fontes/testes+manifest/lock+ausência física de providers.
- [x] Fingerprint deste candidato `65e14c4275492bf249e56eb09ccd53ebd800a1eaf7cad2563d95ae8817758336` antes/depois idêntico, incluindo novas fontes UNTRACKED e exclusões registradas. Main schema c3c82… intacto; wrappers somente sintéticos, TMPDIR/.nextRAM privados preservados, Portalenvlocal vazio/semDATABASE-TURSO-storage master. BuildstargetstagingHTTPS*.invalid/chavesfalsas, NextNODEENVnormal, sem alterar appguards/config/timeouts/cobertura.
- [ ] Probe/Anubis/Lens/Sage/CodeRabbit e homologação/publicação staging seguem pendentes; InProgress, sem READY/Done ou produção por estes gates.

Relatório `/tmp/portal-api-20261023-forge.md`; hashes/resultados/argv `/tmp/portal-api-20261023-forge-input.json`. File List Forge: somente esta story no Main e story homônima no Portal, append factual; app/fontes/testes/config/envreal/Gitmutável/DBreal/cloud intactos. Controle ao Bibble; nenhum próximo agente acionado.


### Probe — integração local da API canônica (2026-10-23)

- [x] Matriz Scout30/30 confirmada:24operações/21paths e6destinos locais/inativos; callers/linhas em `/tmp/portal-api-20261023-probe-wiring.json`.
- [x] Ponte SDK gerado→HTTPloopback→exports reais Main→SQLite descartável, com actions/BFF/JWE/getToken reais Portal:31checks PASS. Browser Chrome com componentes/providers atuais:16checks PASS, zero Runtimeexceptions, desktop/mobile sem overflow; login, lista/detalhe, upload/observação/remoção/download, perfil e notificações conectados.
- [x] Sessão pública Auth.js e dados/bundle/headers browser sem principal/app/signingsecrets; origens/cookie-only/foreign404/forged/revoked/CSRF comprovados localmente. Fontes Forge Main17872+Portal84 preservadas antes/depois, zero diferenças; teste próprio temporário removido.
- [ ] Protocolo NextRSC/Auth.jslogin completo deployado, Blob/Vercel remoto e smoke staging continuam para homologação; não foram inferidos da fixture. T8 integral permanece pendente dos demais especialistas.

Prova local REAL de API/SQL, com mocks explícitos somente Nextheaders/cache/navigation/actionwire e transporte Blob/capacidade. Wrapper visual de layout/header fiel; PortalHeader server revisado na fonte. Relatório `/tmp/portal-api-20261023-probe.md`, resumo `.json`, evidências runtime/browser e3PNGs em `/tmp/portal-api-20261023-probe-preview/`. Forge oito gates+três extras adotados sem repetir. Sem fonte corrigida/DBreal/cloud/Gitmutável/publicação/READY/Done. FileList desta estação: este arquivo de story (Main e Portal), apenas append QA; harnesses/evidências somente /tmp. Controle devolvido ao Bibble.


### Anubis — revisão de segurança da API/BFF (2026-10-23)

- [x] Revisão independente focal Main+Portal concluída: app/principalHS256/claims/DBversion, cookie-onlygetToken/JWE/projeção pública, CSRF/IP, scopes404/owners/CAS/recibos, SDKorigemfixa/redirect/limites/headers, arquivos/SSE e retirada da persistência Portal. **PASS_LOCAL_SECURITY: zero achados críticos/importantes confirmados**.
- [x] Gates Forge8+3 e integração Probe31runtime+16browser adotados com lineage explícita; source/testes reais inspecionados. Não repetidos gates nem criado PoC sem candidato causal; nenhuma alteração de appsource/testes.
- [ ] Lens/QA final e homologação/configuração staging continuam pendentes. Sem READY remoto, login/RSC/Blob/Vercel remoto certificado, retirada de credenciais históricas presumida ou produção autorizada.

Relatório `/tmp/portal-api-20261023-anubis.md` e resumoJSON discriminam arquivo:linha, source→guard→sink, evidência adotada e riscos residuais (TTL7dias/logoutlocal, streams5s/8s, URLslegadas, configuração/cutover). FileList Anubis: somente esta story no Main e Portal, append factual; artefatos /tmp foraGit. Runtime/testes/schema/deps/env/DBreal/Git/cloud/deploy preservados. Controle devolvido ao Bibble para Lens, sem acionar próximo agente; stories InProgress.


### Lens — revisão causal de código (2026-10-23)

- [x] Revisão focal Main+Portal contra desenho Aria1.0/AC1–16/matriz30 e rules concluída; gates Forge8+3, Probe31runtime+16browser, Anubislocal/Vaultsource adotados sem repetição. SHA focal48arquivosMain+75Portal idênticos aos inputsForge; nenhuma exclusão reapareceu.
- [x] Dois achados 🟡 de cleanup reproduzidos no SDK canônico: `stream` rejeita MIME/status2xx inválido sem cancelar upstream; `boundedStream.start` cria intervalo após detectar sinal já abortado. Reproduções somente/tmp, sem correção de source. Zero achados 🔴 confirmados.
- [ ] **Lens REPROVADO nesta estação até correção LENS-01/LENS-02 e revalidação focal+regeneração dos artefatos.** Sage/QA, CodeRabbit e homologação/configuração staging não declarados completos. CLI CodeRabbit ausente no PATH; review não executado.

Relatório `/tmp/portal-api-20261023-lens.md`, prova `/tmp/portal-api-20261023-lens-stream-repro.{cjs,json}`, comparaçãofocal `/tmp/portal-api-20261023-lens-source-verification.json`. FileList Lens: somente esta story Main e homônima Portal (appendQA); runtime/testes permanentes/schema/deps/envreal/DBoperacional/Gitmutável/cloud preservados. Recomendação não bloqueante a Sage: tornar permanente subconjunto da ponte SDK→HTTP→rotasMain→SQLite hoje somente no harnessProbe/tmp. Stories InProgress, sem READY/deploy/prod. Controle devolvido ao Bibble, nenhum próximo agente acionado.

### Correção Echo — LENS-01/LENS-02 (23/10/2026)

- [x] LENS-01: SDK mantém propriedade do fetch/body até o handoff; rejeições descartam o corpo e abortam upstream antes de remover deadlines/listener. Cancelamento não aguarda hook que possa ficar pendente; o erro público original é preservado. Caminhos de falha comuns JSON/upload reutilizam o mesmo descarte.
- [x] LENS-02: `boundedStream.start` retorna após tratar sinal já abortado, antes de criar intervalo de revalidação.
- [x] Três regressões permanentes no Main: MIME200 inválido e HTTP201 exigem502+cancel1+aborttrue mesmo antes do caller abort; hook cancel pendente não bloqueia rejeição. Preabort exige504+cancel1+zero timers/callbacks, inclusive após cancel repetido e avanço do relógio. Tests falharam3/6 antes; depois contratos/streams18/18 PASS. FakeTimers conferem zero ao fim de cada teste.
- [x] Gerados novamente artefatos Main/Portal pela fonte canônica. SDK SHA `6d61f8a45074ac4333b7cf69b4dcf66a8de43f7216f90d4acaa13bfc9092fac1` → `5399cce8c8bc272e058386aef5c5bed0708c2e06db82b29b4a3ff290650be8ae`; wirev1/ops/TTL/status/WeakMap/segredos intactos.
- [x] Checks focais: Main18testes/2arquivos, typecheck, lint e artefato PASS; Portal40Vitest+2Node, typecheck, lint focal, contrato e boundary PASS, todos com env sintético/local. Sem build global nesta correção.
- [ ] Forge dos dois apps após delta runtime e revisão Lens focal independente: aguardam coordenador. Esta nota registra correção executada, não substitui veredicto QA.

Delta/File List desta correção: `contracts/portal-api/sdk.server.ts`, `tests/portal-api/streams.test.ts`, `artifacts/portal-api/v1/sdk.server.ts`, `artifacts/portal-api/v1/manifest.json`, `docs/stories/story-portal-api-canonica-20261023.md`. Handoff `/tmp/portal-api-20261023-echo-stream-fix.md`, hashes `/tmp/portal-api-20261023-echo-stream-fix.json`, comparação focal contra inputForge `/tmp/portal-api-20261023-echo-stream-source-proof.json`. Sem backend Main/wire/schema/Auth/BFF/UI/package/env real/DB real/cloud alterados. Staging READY/homologação e produção não declarados.


### Forge — revalidação SDK streams LENS-01/02, 23/10/2026

- [x] Oito globals atuais +3checks PASS uma vez cada sobre SDK5399cce8…; Main: TC7,82s/lint44,27s(0erros1183warn)/fullcoverage35,94s(753arquivos6171PASS+4skip1todo)/build50,47s(86páginas), todos exit0. Maincontracts12/streams6PASS no fullrun incluem3regressões novas. Maincontract0,03s/Portalcontract0,08s/boundary0,07s exit0,24ops/wire1.0.0 preservados.
- [x] Fingerprint deste candidato `fe1abba3d40b4da52a3e77de3ba10ac896f4fa7d0c08bc63257f10ddd147a9f9` antes/depois idêntico; novas fontes/artifacts UNTRACKED e exclusões capturadas. Mesmo harness sintético/TMPDIR/.nextRAM, limites/timeouts/cobertura preservados; semfonte/config/envreal/DBreal/cloud/Gitmutável/deploy alterados.
- [ ] Lens focal independente deve fechar LENS-01/02; Sage/CodeRabbit/gates remotos/homologação staging permanecem com owners seguintes, InProgress sem READY/produção.

Relatório `/tmp/portal-api-20261023-forge-stream-fix.md`; hashes/resultados `/tmp/portal-api-20261023-forge-stream-fix-input.json`; logs Main`...-forge-stream-main-*.log`/Portal`...-portal-forge-stream-*.log`+metadata. File List Forge: somente esta story e homônima do outrorepo, append factual. Root/oldWTs/dirtyalheios/.nextRAM preservados; controle ao Bibble, nenhum próximo agente acionado.


### Lens — LENS-01/LENS-02 revalidados e encerrados (2026-10-23)

- [x] **Lens APROVADO local.** Os dois achados anteriores de cleanup foram fechados por reprodução independente do harnessoriginal sobre SDK5399cce8…:200MIMEinválido e201 preservam502/cancel1/upstreamaborttrue; preabort preserva504/cancel1/zerointervalos. Parecer histórico mantido, bloqueio anterior desses itens substituído por este PASS.
- [x] Correção canônica, descarte sem aguardar hookpendente/idempotência e três regressões permanentes inspecionados; ForgeFINAL8+3 PASS adotado, sem repetir globais/builds/browser. Oito hashes focais coincidem com inputForge atual; SDKsource/artefatos e manifests Main/Portal íntegros; wire1.0.0/major1/24operações preservados. Echo sourceproof67Main+80Portal e Probe/Anubis das regiões inalteradas adotados com limites explícitos.
- [ ] Sage/QA e ponteHTTPfornecedor/consumidor portátil permanente, documentação e operação/homologação staging continuam sob coordenação Bibble. Sem READYremoto ou produção inferidos. CodeRabbit não executado por Lens.

Relatórios `/tmp/portal-api-20261023-lens-stream-revalidation.{md,json}`; reproduçãooriginal preservada, cópia reexecutada `/tmp/portal-api-20261023-lens-stream-revalidation-repro.{cjs,json}`; hashes `/tmp/portal-api-20261023-lens-stream-revalidation-hashes.json`. FileList Lens desta estação: somente appendQA desta story Main e homônimaPortal, demais artefatos em/tmp. Nenhuma fonte/teste permanente/config/envreal/DBoperacional/cloud/Git/push/deploy alterado. Controle ao Bibble; nenhum próximo agente acionado.


### Sage — cobertura de bordas e ponte CI portátil (23/10/2026)

- [x] QA local aprovado, sem novo bug causal. Forge final8+3PASS/Main6171+Portal42, Probe31HTTP+16Chrome, AnubisPASS e Lens final após correção dos dois leaks adotados com limites declarados, sem repetição global.
- [x] Sugestão Lens de CIbridge resolvida: `Main/tests/portal-api/http-integration.test.ts`,3testesPASS(1,27s), SDKcanônico→NodeHTTPloopback/portaefêmera→4exportsreais→Prisma/SQLitefixture. Login/me/lista/detalhe own, alheio/missing404 idêntico e revogaçãoowner401; sem checkoutPortal/caminhoabsoluto/deps/config novos ou mock de resposta API.
- [x] Checks do novo teste: MainTC14,79s e ESLintfocal0,52s exit0. Comparados2280arquivos runtime/config/schema/contratoMain+73Portal contra inputForge, zero diferenças; sem rebuild/npmtestglobal por delta somente teste.
- [ ] Documentação e rollout/homologação remota staging permanecem pendentes. Não inferir login/RSCNext/Blob/CDN reais ou produção a partir das fixtures. CodeRabbit não executado nesta estação.

Relatório `/tmp/portal-api-20261023-sage.md`, hashes/checks `/tmp/portal-api-20261023-sage.json`. FileListSage: novo teste somente no Main e append factual nesta storyMain/Portal. Sem runtime/envreal/DBoperacional/Git/cloud alterados. Controle ao Bibble, nenhuma próxima estação acionada; InProgress sem READYremoto.


### Scribe — mapa e integração (23/10/2026)

- [x] Mapa e pontos de integração atualizados nos dois repos: API Main/owners, contrato/gerador/SDK, Auth.js privado/BFF, upload/streams, verificadores e CIbridge com caminhos reais. Históricos preservados.
- [ ] Kowalski e operação/homologação staging permanecem pendentes; esta nota não encerra T9/P7 nem declara READY remoto.

File List desta estação neste repo: `.bibble/memory/codebase-map.md`, `.bibble/memory/integration-points.md` e esta story, somente documentação. Nenhum runtime/teste/config/env/DB/Git/cloud alterado.


### Kowalski — memória da sessão (23/10/2026)

- [x] Sessão significativa arquivada em `.bibble/memory/journal.md`; mapa/integrações Scribe concluídos. Registro distingue código/testes locais da publicação e homologação staging pendentes. Banco físico atual e produção fora do escopo preservados; drafts alheios não alterados.
- [ ] Operação/homologação staging continua com DevOps (T10 Main/P7 Portal); memória concluída não declara READY remoto.

File List desta estação neste repo: `.bibble/memory/journal.md` e esta story, somente documentação. Sem runtime/testes/config/env/DB/Git/cloud alterados; nenhuma nova execução de gate necessária para o delta documental.


### DevOps — preparação staging (23/10/2026)

Gates locais Forge/Probe/Anubis/Lens/Sage e documentação Scribe/Kowalski aprovados; Ready for Review técnico, homologação remota pendente. CodeRabbit ausente; fallback independente adotado conforme `graceful_degradation.skip_if_not_installed`. Commit seletivo e integração normal do staging, sem force, produção ou mudança de banco.
