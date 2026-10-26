# Resiliência da sessão diante da indisponibilidade do banco — contrato

Data: 2026-10-26. Base: staging remoto `b115dd3802485e9b0a049f2a45a5010db77338b5`.
Origem: pedido “realize as melhorias necessarias” após diagnóstico privado `incidente-painel-banco-20261026/{echo-causal,devops-runtime}.md`. Este contrato orienta implementação; não declara correção pronta.

## Decisão e fronteiras

- [x] Preservar identidade criptográfica durante erro temporário, negar operação protegida até revalidação válida, manter revogação definitiva irreversível.
- [x] Implementar em worktree isolada a partir de staging atualizado; publicação e validação primeiro em staging. Produção requer pedido explícito de promoção.
- [x] Não há schema, migration, seed, backfill ou mutação em massa nesta correção. Não copiar dados/ambientes de produção. Eventual mudança estrutural reinicia Vault.
- [x] Separar resultado da validação de acesso de presença de cookie. Não confiar em role/id do token como autorização operacional quando a leitura atual falha.

## Estados e contrato mínimo

| Estado lógico | JWT interno | Sessão pública/provider | auth() servidor | REST/heartbeat | RSC/cliente |
|---|---|---|---|---|---|
| PERMITIDO | identidade e versão revalidadas; marcador temporário limpo | user validado; estado explícito permitido | retorna Session válida | prossegue com ACL/ownership próprios | renderiza/recupera |
| NEGADO DEFINITIVO | bloqueio existente; remove identidade como hoje; nunca volta automaticamente | sem user; acessoBloqueado=true | null | 401 se ausência; 403 se bloqueio confirmado | login/logout conforme contrato atual |
| INDISPONÍVEL | mantém sub/id/role/version, marca sinal temporário; não bloqueia | sem user autorizável; erro/estado temporário explícito | lança erro temporário tipado FORA do callback JWT | 503 + código AUTH_UNAVAILABLE + Retry-After + no-store | recuperação limpa; não redirect/login/signOut |

`ausente` continua significando ausência de identidade, não falha de banco. Os nomes concretos dos tipos podem ser ajustados por Echo, mantendo exatamente esta semântica. Um DTO temporário sem user pode ser truthy para Auth.js e produzir status authenticated; por isso status sozinho não autoriza nem confirma login. Não expor versão/role/identidade antiga no DTO temporário com aparência de sessão válida.

### Regras obrigatórias

- [ ] Leitura de status/versão retorna união discriminada: permitido, negado definitivo (ID inválido, inexistente, inativo, versão inválida/divergente), indisponível (exceção da leitura). Exceção desconhecida da leitura falha fechada e não vira revogação; detalhes só no log sanitizado.
- [ ] `jwt` NÃO lança por indisponibilidade: @auth/core 0.41.2 limpa cookies no catch. Preservar claims exclusivamente no JWT criptografado, sem aceitar atualização cliente de flag/status/id/role/version.
- [ ] `session` expõe estado explícito e retira user autorizável no temporário. `/api/auth/session` preserva protocolo Auth.js (objeto de estado com HTTP200 é permitido); endpoints protegidos retornam503. Não converter resposta Auth.js503 em null/unauthenticated por acidente.
- [ ] `auth()` mantém assinatura atual e nunca retorna DTO temporário: erro tipado ocorre depois de `nextAuth.auth()`, blindando guards existentes que só conferem session truthy/user/id. `authComEstadoAcesso` permanece leitor de estado para callers enumerados; não importá-lo em ações/guards de domínio.
- [ ] RootLayout usa leitor explícito de estado/provider e nunca lança erro temporário antes de renderizar html/body. Layout Painel bloqueia children durante indisponibilidade e oferece recuperação/retry. Falha de queries extras de permissões/usuário/links também não vira logout. Error boundary de segmento não captura falha do próprio layout: tratar localmente ou usar boundary ancestral apropriada.
- [ ] Middleware real é `middleware.ts` com getToken; `auth.config.ts` não tem consumidores. É pré-filtro de navegação, não autoridade DB. Marcação temporária não vira revogação/login; acesso operacional continua no servidor. Preservar regras TV, senha temporária, cadastro Admin e sanitização dos headers de iframe. Não inserir bypass de ACL por cookie.
- [ ] Não permitir acesso por role/cache antigo quando DB indisponível. Revogação real continua negada após recuperação; uma requisição que ainda não recebeu prova da revogação apenas fica temporariamente indisponível, nunca autoriza.

## Propagação por superfície

Inventário AST privado `auth-callers-inventory.json`: 300 arquivos com chamadas reais de auth; 128 actions, 78 RSC, 77 APIs diretas; 71 APIs com alcance indireto por imports (superconjunto, exige revisão de fluxo). Contém paths, linhas, conditions e imports. Guards concretos frágeis incluem `AlphaCRM/layout.tsx`, `ChatBotAlpha/layout.tsx`, `Chamados/page.tsx`, `Metas/page.tsx` (truthy) e `src/lib/{auth-guard,checklist/acesso,gerador-documentos/ownership}.ts` (user/id). A facade central evita refatorar todos esses guards.

- [ ] REST protegido: helper único para reconhecer erro e criar503 sanitizado. Adaptar catches/handlers efetivamente alcançáveis no inventário, inclusive indiretos. Wrapper externo não resolve catch interno que transforma erro em500/401/403: mapper precisa preceder esses fallbacks. Filtrar cron/OAuth/API keys/públicos, preservando seus mecanismos próprios.
- [ ] Server Actions: rejeição temporária tipada ou resultado de erro recuperável conforme DTO existente; nunca falso sucesso, dado vazio tratado como sucesso, UNAUTHENTICATED por falha DB, retry de write ou navegação ao login. Confirmar nenhuma escrita/external side effect depois da falha de auth. Digest de Error de Server Action em produção não preserva message: não depender da classe/mensagem cliente sem envelope explícito.
- [ ] RSC: layout Painel impede render de conteúdo protegido no temporário; demais páginas continuam usando auth() seguro. Boundary/fallback com retry sem substituir shell existente ou apagar rascunhos. Headers/streaming de Next podem resultar HTTP200 em fallback RSC; não prometer503 HTTP após streaming. API continua503.
- [ ] Heartbeat: auth temporário503, negação definitiva403, ausência401. Falha na escrita do sinal é operacional500/503, nunca negação de identidade. Cliente só encerra por prova definitiva; um request por vez, AbortController por tentativa, deadline próprio, backoff limitado, cleanup/unmount. Logout coordenado/deduplicado. Online/focus/novo polling podem recuperar sem login.
- [ ] Iframe raiz: pathname `/` é indício, não prova de revogação. Confirmar com endpoint de estado/heartbeat antes de signOut; temporário/rede/deadline preserva shell e marca frame como erro recuperável. Manter origem exata, frameId/attempt e timeout de handshake15s. Não recarregar frames com rascunhos automaticamente nem usar signOut como retry.
- [ ] Login: armar prazo antes de update(), não depois. Se update pendura, liberar formulário com mensagem temporária/novo retry; não despachar AUTH_SUCCESS/navegar como autenticado sem user e estado permitido. Guardar geração/tentativa para ignorar resolução atrasada, limpar timers. update() não aceita AbortSignal: um watchdog isolado não cancela fetch interno; usar confirmação abortável explicitamente se necessária e só sincronizar provider depois de prova. Não criar loop de hard navigation.

## Transporte DB, retry e prazo

Prova local de dependências: @prisma/adapter-libsql6.19.3 construtorConfig → createClient(config); @libsql/core0.17.3 Config.fetch?:Function; hrana0.10.0 chama fetch(request) e só depois decodeResponse(resp). Portanto fetch customizado é suportado sem atualização de dependência.

- [ ] Implementar helper pequeno de fetch com AbortController e prazo curto por roundtrip, incluindo leitura do body. Combinar signal original de Request/init com deadline e preservar abort reason, headers, status e body. Timer não pode ser limpo ao receber somente headers; limpar ao concluir/cancelar body ou materializar body compatível antes de retornar Response. Cobrir rejeição, body travado e cancelamento do consumidor.
- [ ] Conectar somente adapter HTTP; preservar file: local e env guards existentes. Não mudar região, URLs, banco, Prisma version ou pool por hipótese.
- [ ] Definir constantes justificadas por medição no staging: ponto de partida5s por roundtrip; no máximo1 retry de leitura de status/versão, jitter pequeno e orçamento total explícito. Não descrever isso como prazo total garantido da query: SDK tem fila de concorrência20 e transações múltiplos roundtrips. Verificar admissão/tempo em fila se teste causal mostrar extrapolação; documentar limite real.
- [ ] Retry apenas leitura idempotente de status/version, nunca fetch HTTP genérico (o protocolo usa POST inclusive para SELECT), writes, transactions ou POST desconhecido. Preservar retry específico de alertas já em b115dd38; evitar retry multiplicativo da mesma leitura.
- [ ] Cancelamento de transporte não prova rollback de write enviada. Resultado de write pode ficar incerto; sem replay automático e sem prometer cancelamento transacional.

## Validação causal e integração

- [ ] Token válido + DB lança erro → preserva claims internos, DTO temporário sem user; auth() nega antes da operação; API503; cookie não deletado. Recuperação DB permite revalidação sem login. Inativo/deletado/version mismatch/ID inválido bloqueiam definitivamente e não ressuscitam.
- [ ] Teste real @auth/core encode/decode/session/cookies no handler GET e atualização POST de sessão; não só mock do callback. Provar que throw fora deJWT não cai no catch limpador do core. Fonte das nove reproduções antigas é baseline, não aprovação da correção.
- [ ] Provar RSC deny, guards truthy/id, pelo menos uma Action de escrita sem efeitos, API direta, helper indireto, mapper protegido de catch genérico, middleware com cookie temporário e revogado; não aceitar DTO público como auth autorizada.
- [ ] Fake timers: Heartbeat403logout,503não,401conforme contrato; deadline, sem overlap, unmount, recovery e resolução atrasada; iframe `/` temporário vs definitivo; Login update nunca resolve e resolve atrasado; Shell mantém15s.
- [ ] Fetch com Request.signal original, abort antecipado, headers rápidos/body lento, body cancelado, error propagation, uma tentativa por write e retry limitado exclusivamente da leitura segura.
- [ ] Forge executa lint/typecheck/npm test/build reais com ambientes sanitizados e output novo RAM (nativas no disco); anotar preexistentes sem editar alheios. Probe/Anubis/Lens revisam integração/segurança/qualidade depois dos gates. Sem sessão real, não declarar E2E autenticado concluído.
- [ ] DevOps re-fetch staging antes de integrar/push, preserva commits concorrentes, publica staging e valida aliases/status, sessão permitida, negação temporária e recuperação. Não promover produção.

## Implementação Echo (26/10/2026), UI pendente

Contrato concreto em `sessao-resiliencia-handoff-nova-20261026.md`. Backend distingue estados, preserva cookie TEMP e nega via facade foraJWT. Mapper503 aplicado em111rotas de sessão e nos grupos Explorer/Checklist/Roadmap; credenciais públicas/cron/OAuth máquina permanecem com seu protocolo.
Fetch real limitado5s atébodycompleto; observador de validação tem budgetTOTAL5s, no máximo8reads pendentes por instância, slot retido até SDKsettlement, retry seguro no máximo1 dentro do orçamento. Nenhum cache positivo e nenhum replay de writes. UI/layouts ainda exigem integração por Nova; não declarar feature global pronta.

## Complemento SSR após Nova

Implementado `src/lib/painel-leituras-ssr.ts` e integração mínima do layout. Agregação adicional5s,4grupos por instância, callbacks após admissão, allSettled até todos terminarem (inclui onboarding). Budgetobservador não libera slot cedo nem autoriza por resultado tardio. Null/usuárioinativo confirmado preserva redirect fora do catch; erros/deadline/full preservam fallback Nova. Sem cancelamentoSQL/retrywrites/cachepositivo. Auth tem budget/pool independente; prazo não é de toda renderização de páginas filhas. Detalhes/testes no handoff e relatório privado echo-ssr-budget.md.
