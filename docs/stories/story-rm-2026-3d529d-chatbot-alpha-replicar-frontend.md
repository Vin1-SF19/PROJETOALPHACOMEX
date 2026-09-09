# Story — RM-2026-3D529D: ChatBotX = Chatbot Alpha — Replicar o Frontend

**Projeto:** Painel Alpha
**Código:** RM-2026-3D529D
**Status:** `CONCLUÍDA — FASES 0–16 PASS`
**Criado em:** 2026-09-08
**Última atualização:** 2026-09-08 (Fase 16 — Kowalski: sessão arquivada no journal; encerramento completo)

---

## 1. Contexto

O módulo `/PainelAlpha/ChatBotAlpha` existia no Painel Alpha somente como um **hub de infraestrutura** (Adminer, RedisInsight e MailHog via iframe). O objetivo RM-2026-3D529D é **replicar o frontend do ChatbotX** (sistema self-hosted externo) dentro deste módulo.

### Estado inicial confirmado no código real

| Artefato | Caminho | Função |
|----------|---------|--------|
| Rota protegida | `src/app/PainelAlpha/ChatBotAlpha/page.tsx` | `auth()` + permissão `chatBotAlpha` (ou admin) |
| Client principal | `src/components/ChatBotAlpha/ChatBotAlphaClient.tsx` | Estado: sistema selecionado, URL do iframe, erro, loading |
| Seletor (admin) | `src/components/ChatBotAlpha/SeletorSistemaChatBot.tsx` | 3 opções: Adminer, Redis, MailHog |
| Iframe | `src/components/ChatBotAlpha/IframeChatBotAlpha.tsx` | Sandbox com `allow-same-origin allow-scripts allow-forms allow-downloads allow-top-navigation-by-user-activation` |
| Server action | `src/actions/ChatBotAlpha.ts` | `ObterUrlSistemaChatBot(sistema)` — Zod enum, auth, env vars |
| Registry | `src/lib/modulos-registry.ts` | `{ id: 'chatBotAlpha', label: 'ChatBot Alpha', href: '/PainelAlpha/ChatBotAlpha', iconName: 'Bot', category: 'admin', permission: 'chatBotAlpha', tag: 'ChatBot' }` |

**Conclusão do diagnóstico inicial:** antes desta RM, o módulo era somente um hub de infraestrutura e não continha componentes de chat, mensagens ou API de chatbot.

### Estado entregue nesta revisão

O módulo agora mantém o hub original na aba **Infra** e acrescenta a aba **Chat**, com lista de conversas, mensagens, envio, estados de carregamento/erro/vazio/sucesso e proxy server-side. A referência real está disponível em `/home/ialpha/projetos/ChatbotX-main`. A camada é consumível quando `CHATBOTX_API_URL` e `CHATBOTX_API_KEY` estiverem configurados; `CHATBOTX_API_TOKEN` é aceito somente como fallback legado.

### Retomada obrigatória da Fase 6 — contrato real

- O inbox via workspace token usa `GET /v1/contacts`, não `GET /v1/conversations`. A origem `listContactsForAPI` é explicitamente sem escopo de membro e retorna `{ data, pageCount, totalCount, totalCountCapped }`.
- O adaptador mantém somente contatos cuja relação `conversation` não é nula e os normaliza para o modelo de conversa usado pela UI.
- `GET /v1/contacts` suporta busca e paginação por página neste fluxo; filtro de status/tags foi removido do contrato e da UI porque não é suportado nessa superfície.
- Mensagens permanecem em `GET/POST /v1/contacts/{identifier}/messages`; envio recebe `{ text }` e sucesso é `204`.
- Não se declara paridade para ações internas de inbox, filtros avançados, uploads ou recursos que exigem sessão interna e não estão disponíveis na API workspace-token usada pelo Painel Alpha.
- `ObterUrlSistemaChatBot` exige `chatBotAlpha` para todo não-admin antes de resolver inclusive MailHog; Adminer e Redis continuam restritos a admin.

---

## 2. Escopo

### Dentro do escopo (quando a referência estiver disponível)

- Replicar todas as telas, componentes, estados e interações do frontend ChatbotX dentro do módulo `/PainelAlpha/ChatBotAlpha`.
- Conectar cada operação visível na referência a uma **API real** (server actions ou route handlers), sem controles cenográficos ou mocks em produção.
- Respeitar o shell, a permissão e o sistema de temas do Painel Alpha.
- Manter paridade visual e comportamental no conteúdo do módulo.
- Preservar o hub de infraestrutura (Adminer/Redis/MailHog) na aba **Infra** da rota principal. A sub-rota inicialmente planejada foi substituída por essa aba para manter um único ponto de acesso, sem perder a funcionalidade existente.

### Fora do escopo

- Backend do ChatbotX (self-hosted externo) — apenas o frontend será replicado.
- Mudanças de schema/banco de dados do Painel Alpha (a menos que a referência exija).
- Novos sistemas de autenticação — reutilizar `auth()` + permissão `chatBotAlpha` existente.

---

## 3. Bloqueio das Fases 0 e 1 — resolvido

A referência real foi disponibilizada e inspecionada em `/home/ialpha/projetos/ChatbotX-main`. O contrato workspace-token abaixo deriva diretamente de `apps/builder/src/features/contacts/api/workspace-token.ts`, `schemas/query.ts`, `queries/list-contacts.queries.ts` e do middleware `workspace-token-auth.ts`. O bloqueio histórico não se aplica mais à Fase 6 retomada.

---

## 4. Matriz de Paridade validada para a superfície workspace-token

| # | Painel/controle de referência | Implementação no Painel Alpha | API/Action real | Diferença objetiva |
|---|------------------------------|-------------------------------|-----------------|--------------------|
| 1 | Lista de conversas/contatos | Primeira coluna, busca com debounce e paginação por página | `ListarConversasChatbotx` → `GET /v1/contacts` | Filtros de status/tags do inbox interno não são exibidos porque não existem neste contrato |
| 2 | Mensagens e composer | Coluna central; sem composer quando nenhuma conversa está selecionada; composer disponível em conversa vazia | `ListarMensagensChatbotx` / `EnviarMensagemChatbotx` → `GET/POST /v1/contacts/{identifier}/messages` | Somente texto foi implementado; upload, flow e reply não são alegados |
| 3 | Detalhe do contato | Terceira coluna usa o contato retornado junto da listagem | Dados embutidos em `GET /v1/contacts` | Não exige chamada extra; embora `GET /v1/contacts/{identifier}` exista, nenhuma operação adicional de detalhe foi necessária |
| 4 | Infra MailHog | Aba Infra preservada | `ObterUrlSistemaChatBot("mailhog")` | Todo não-admin precisa de `chatBotAlpha`; Adminer/Redis permanecem admin-only |

---

| ID | Requisito | Rastreabilidade |
|----|-----------|-----------------|
| RF-01 | Listar somente contatos que possuam `conversation` não nula | `listContactsForAPI` + `listarConversas` |
| RF-02 | Buscar e paginar contatos sem expor filtros cenográficos | `keyword`, `page`, `perPage` de `listContactsRequest` |
| RF-03 | Consultar mensagens pelo identificador `id:<contactId>` | rota workspace-token de mensagens |
| RF-04 | Enviar texto com `{ text }` e aceitar sucesso sem corpo `204` | `createMessageRequest` + `successStatus: 204` |
| RF-05 | Exigir sessão e permissão `chatBotAlpha`, com bypass apenas para admin | Server Actions de chat e infra |
| RF-06 | Executar doctor, capabilities, listagem, consulta e envio por CLI | scripts `chatbot-alpha:*` |

---

## 6. Requisitos Não Funcionais

| ID | Requisito | Status |
|----|-----------|--------|
| RNF-01 | Respeitar o shell do Painel Alpha (sidebar, header, tema) | ✅ Definido |
| RNF-02 | Permissão `chatBotAlpha` (ou admin) — já existe no registry | ✅ Definido |
| RNF-03 | Sistema de temas do Painel Alpha (`bg-[#020617]`, `border-white/5`, `text-slate-500`) | ✅ Definido |
| RNF-04 | Ícones via `lucide-react` | ✅ Definido |
| RNF-05 | Imports absolutos com `@/` (Artigo VII) | ✅ Definido |
| RNF-06 | Acessibilidade: ARIA labels, foco visível, contraste WCAG AA | ✅ Definido |
| RNF-07 | Responsividade: mobile-first, breakpoints do Painel Alpha | ✅ Definido |
| RNF-08 | Sem mocks em produção — toda operação visível chega a API real | ✅ Definido |

---

| Endpoint | Método | Auth | Request | Response |
|----------|--------|------|---------|----------|
| `/v1/contacts` | GET | `Authorization: Bearer <workspace-token>` no proxy server-side | `keyword?`, `page?`, `perPage?` | `{data,pageCount,totalCount,totalCountCapped}`; o adaptador retém só `conversation != null` |
| `/v1/contacts/{identifier}/messages` | GET | idem | `cursor?`, `perPage?` | `{data,nextCursor,prevCursor}` |
| `/v1/contacts/{identifier}/messages` | POST | idem | `{text}` | `204 No Content` |

### Padrões confirmados no Painel Alpha (a seguir)

| Padrão | Evidência |
|--------|-----------|
| Server actions | `"use server"` + Zod + `auth()` em `src/actions/ChatBotAlpha.ts` |
| Realtime | Pusher (`pusher-js`) — padrão do projeto |
| Uploads | `UploadDocs.ts` existe no repo |
| Streaming | Não existe padrão de SSE/streaming no repo ainda — a definir pela fonte |

---

## 8. Regras de Autenticação e Autorização

| Regra | Implementação |
|-------|---------------|
| Auth server-side | `auth()` + `redirect` em `page.tsx` (já existe) |
| Permissão | `getPermissoesEfetivas(userId)` + `permissoes.includes("chatBotAlpha")` (já existe) |
| Admin | `isAdminRole` (já existe) |
| Escopo externo | O workspace token seleciona o workspace; a API não fornece ownership por usuário/agente para contato individual |
| Zod validation | Em todas as server actions (Artigo V) |

---

## 9. Estados de UI

| Estado | Comportamento esperado |
|--------|----------------------|
| Loading | Skeleton/spinner com tema do Painel Alpha |
| Error | Mensagem clara + retry (padrão `NotificacaoFlutuante`) |
| Empty | Mensagem amigável + CTA (padrão do Painel Alpha) |
| Success | Feedback via `NotificacaoFlutuante` |

---

## 10. Acessibilidade

- ARIA labels em todos os controles interativos.
- Foco visível (outline) em navegação por teclado.
- Contraste mínimo WCAG AA (4.5:1 texto normal, 3:1 texto grande).
- `aria-live` para atualizações de chat em tempo real.
- Alt text em imagens.

---

## 11. Responsividade

- Mobile-first: layout single-column em telas < 768px.
- Tablet: 2 colunas (sidebar + conteúdo) em 768–1024px.
- Desktop: layout completo em > 1024px.
- Breakpoints do Painel Alpha (confirmar no CSS/Tailwind config).

---

## 12. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Indisponibilidade do ChatbotX externo | Média | Alto | Timeout de 30 s, cancelamento, erro normalizado/retryable e correlation ID |
| Token externo exposto ao navegador | Baixa | Alto | Proxy server-side; segredo somente em env e header Bearer no servidor |
| Ownership por agente ausente no contrato workspace-token | Média | Médio | Restringir acesso à permissão do módulo e registrar a limitação sem alegar isolamento por contato |
| Recurso do inbox interno exposto sem API equivalente | Média | Médio | Não renderizar controles sem operação real; busca/paginação e texto são a superfície implementada |
| Permissão `chatBotAlpha` já existe | Baixa | Baixo | Reutilizar; não criar nova |

---

## 13. Plano de Testes

| Tipo | Escopo | Ferramenta |
|------|--------|------------|
| Unit | Schemas, adaptação contato→conversa, paginação, 204, timeout e erros externos | Vitest |
| Integration | Server actions com mocks de auth/permissão e autorização direta do MailHog | Vitest |
| CLI | Doctor/capabilities/listar/consultar/enviar com JSON e exit codes | Execução dos scripts npm; smoke real depende de configuração externa |
| E2E (manual) | Fluxo completo de texto no inbox de três painéis | Manual, quando o backend estiver configurado |

---

## 14. Checklist das Fases

| Fase | Título | Status |
|------|--------|--------|
| 0 | Auditoria inicial | ✅ PASS (com AUTO_ADJUSTMENT_REQUIRED) |
| 1 | Blueprint de Integração (Scout) | ✅ PASS (com AUTO_ADJUSTMENT_REQUIRED) |
| 2 | Criar e preparar a story obrigatória | ✅ PASS |
| 3 | Especificar a réplica visual e comportamental | ✅ PASS (com AUTO_ADJUSTMENT_REQUIRED — sem referência) |
| 4 | Determinar necessidade de banco | ✅ PASS — `DATABASE_CHANGE_NOT_REQUIRED` (dados pertencem ao ChatbotX externo) |
| 5 | Aplicar delta de banco aprovado | ✅ PASS — não aplicável (nenhum delta requerido pela Fase 4) |
| 6 | Implementar capacidades via API e CLI | ✅ PASS — corrigido para `GET /v1/contacts` → `{data,pageCount,totalCount,totalCountCapped}`, mantendo somente contatos com `conversation`; mensagens em `GET/POST /v1/contacts/{identifier}/messages`, envio `{text}` → 204; segredo canônico `CHATBOTX_API_KEY` com fallback legado; CLI `list-conversations --page`, `list-messages`, `send-message`; MailHog reautorizado na action |
| 7 | Integrar runtime de IA | ✅ PASS (AI_RUNTIME_CHANGE_NOT_REQUIRED) |
| 8 | Observabilidade operacional | ✅ PASS (logs estruturados, sanitização, métricas, erros operacionais) |
| 9 | Replicar o frontend do ChatbotX no módulo ChatBot Alpha | ✅ PASS (chat + infra, estados, observabilidade; sessão de fechamento extraiu `src/lib/chatbot-alpha/formatters.ts` — `tituloConversa`/`ultimaMensagemConversa`/`rotuloRemetente`/`isMensagemDoContato` — antes duplicadas inline em `ChatBotAlphaClient.tsx`/`ChatConversa.tsx` — e adicionou `tests/chatbot-alpha/formatters.test.ts` com 10 testes; o projeto não tem `@testing-library/react` nem ambiente `jsdom` no `vitest.config.ts` — confirmado nesta sessão —, então os "testes de componentes" desta fase cobrem a lógica pura extraída dos componentes, seguindo o mesmo padrão já registrado em `tests/apresentacoes/scroll-reveal.test.ts`) |
| 10 | Executar o gate técnico real | ✅ PASS (baseline global pré-existente; 0 erros novos nos arquivos desta entrega) |
| 11 | Verificação de integração (Probe) | ✅ PASS (8 pontos; persistência/integração externa parciais por falta de `CHATBOTX_API_URL` real) |
| 12 | Auditoria de segurança (Anubis) | ✅ PASS — nenhum achado reportável no delta; acesso workspace-wide reconhecido como propriedade do token privilegiado e protegido localmente por Admin/permissão `chatBotAlpha` |
| 13 | Revisão de qualidade (Lens) | ✅ PASS — nenhum achado bloqueante ou importante |
| 14 | Validar cenários extremos e cobertura automatizada (Sage) | ✅ PASS — suíte final com 124 testes aprovados e 1 `it.todo`; cenários adicionais de 401/403, cursor, listas vazias, `perPage` e trim |
| 15 | Consolidar arquitetura, integrações e story (Scribe) | ✅ PASS — documentação reconciliada; limitações externas mantidas explícitas |
| 16 | Arquivar a sessão e o resultado final (Kowalski) | ✅ PASS — sessão e resultado registrados no journal |

---

## 15. File List (Atualizado — Fases 6–15, corrigido na retomada da Fase 6 e da Fase 9)

**Correção de paridade de UI (retomada da Fase 9, feedback do administrador):** `src/components/ChatBotAlpha/ChatBotAlphaClient.tsx`, `src/components/ChatBotAlpha/ChatConversa.tsx`, `src/actions/ChatBotAlphaChat.ts` — layout em três colunas (lista de contatos com conversa | mensagens | detalhe do contato), busca com debounce e paginação por página. Filtros de status/tags foram removidos por não existirem em `GET /v1/contacts`. O estado sem seleção não renderiza composer; uma conversa selecionada ainda sem mensagens mantém o composer para permitir a primeira mensagem. O painel de detalhe usa os dados de contato embutidos na listagem; nenhuma paridade é alegada para edição ou outras ações não implementadas.

**Correção de contrato (retomada da Fase 6, feedback do administrador):** `src/lib/chatbot-alpha/chat-api.ts`, `src/actions/ChatBotAlphaChat.ts`, `src/actions/ChatBotAlpha.ts`, `src/lib/chatbot-alpha/contracts.ts`, `src/lib/chatbot-alpha/doctor.ts`, `scripts/chatbot-alpha.mjs`, `src/components/ChatBotAlpha/ChatBotAlphaClient.tsx`, `tests/chatbot-alpha/chat-api.test.ts`, `tests/chatbot-alpha/actions.test.ts`, `tests/chatbot-alpha/infra-action.test.ts`, `tests/chatbot-alpha/doctor.test.ts` — o inbox foi corrigido para `GET /v1/contacts`, resposta paginada por página e normalização apenas de contatos com conversa. O filtro de status foi removido. Mensagens continuam via contato e envio 204. A configuração agora exige URL + chave canônica, com fallback legado explícito.

### Arquivos novos

| Arquivo | Função | Fase |
|---------|--------|------|
| `src/lib/chatbot-alpha/contracts.ts` | Schemas Zod, factory `makeCliResult`, registry de 6 capacidades | 6 |
| `src/lib/chatbot-alpha/doctor.ts` | `runChatbotAlphaDoctor` — checks de config, safety, contract, observability | 6/8 |
| `src/lib/chatbot-alpha/observability.ts` | Logs estruturados, sanitização, métricas, erros operacionais UI-safe | 8 |
| `src/lib/chatbot-alpha/chat-api.ts` | Cliente HTTP para backend ChatbotX (proxy server-side, Zod, timeout) | 9 |
| `src/actions/ChatBotAlphaChat.ts` | 3 server actions: `ListarConversasChatbotx`, `ListarMensagensChatbotx`, `EnviarMensagemChatbotx` | 9 |
| `src/components/ChatBotAlpha/ChatConversa.tsx` | Componente de chat com estados: loading, vazio, erro+retry, sucesso, disabled | 9 |
| `src/lib/chatbot-alpha/formatters.ts` | Formatação pura sem I/O (`tituloConversa`, `ultimaMensagemConversa`, `rotuloRemetente`, `isMensagemDoContato`), extraída de `ChatBotAlphaClient.tsx`/`ChatConversa.tsx` para ser testável sem `@testing-library/react` | 9 |
| `tests/chatbot-alpha/formatters.test.ts` | 10 testes: título/última mensagem de conversa com contato completo/parcial/ausente, rótulo por `senderType`, distinção de mensagem do contato | 9 |
| `scripts/chatbot-alpha.mjs` | CLI entrypoint: `doctor`, `capabilities`/`list` — saída JSON, exit codes 0/1/2 | 6 |
| `tests/chatbot-alpha/contracts.test.ts` | 20+ testes: schemas Zod, factory, registry, validação | 6 |
| `tests/chatbot-alpha/observability.test.ts` | 30+ testes: sanitização, correlationId, tracking, métricas, erros operacionais | 8 |
| `tests/chatbot-alpha/chat-api.test.ts` | 20 testes: config ausente, timeout, rede fora do ar, 4xx/5xx/429, resposta malformada, corpo não-JSON, lista vazia, sucesso, concorrência, encoding de URL | 14 |
| `tests/chatbot-alpha/actions.test.ts` | 21 testes + 1 `it.todo`: sessão ausente, permissão negada, payload inválido (vazio/limite), backend não configurado, API lenta/indisponível, erro não vazado à UI, repetição, concorrência/isolamento; `it.todo` documenta ownership pendente de referência | 14 |

### Arquivos adaptados

| Arquivo | Alteração | Fase |
|---------|-----------|------|
| `src/actions/ChatBotAlpha.ts` | Instrumentado com observabilidade (correlationId, logs estruturados, erros operacionais) | 8 |
| `src/components/ChatBotAlpha/ChatBotAlphaClient.tsx` | Tabs Chat/Infra, sidebar de conversas, integração com `ChatConversa`; nesta sessão passou a importar `tituloConversa`/`ultimaMensagemConversa` de `formatters.ts` em vez de definir inline | 9 |
| `src/components/ChatBotAlpha/ChatConversa.tsx` (ajuste adicional) | Passou a importar `rotuloRemetente`/`isMensagemDoContato` de `formatters.ts` em vez de mapear inline | 9 |
| `package.json` | Scripts `chatbot-alpha:doctor` e `chatbot-alpha:capabilities` | 6 |
| `src/lib/chatbot-alpha/chat-api.ts` | Robustez: resposta HTTP 200 com corpo não-JSON agora é erro tratado; resposta JSON é validada contra os schemas Zod já existentes (`.safeParse`) antes de retornar sucesso; `429` (rate limit) passou a ser classificado como `retryable: true` | 14 |
| `docs/stories/story-rm-2026-3d529d-chatbot-alpha-replicar-frontend.md` | Story, gates, limitações, caminho de consumo e File List reconciliados | 2–15 |
| `.bibble/memory/architecture.md` | Arquitetura final, limites e evidências técnicas | 15 |
| `.bibble/memory/codebase-map.md` | Mapa de rota, UI, actions, domínio, CLI e testes | 15 |
| `.bibble/memory/integration-points.md` | Fluxo ponta a ponta entre UI, actions, proxy e backend externo | 15 |
| `.bibble/memory/decisions.md` | Decisões de integração externa, persistência e escopo condicionado | 15 |

### Arquivos preservados (inalterados)

| Arquivo | Função |
|---------|--------|
| `src/app/PainelAlpha/ChatBotAlpha/page.tsx` | Auth + permissão (server-side) |
| `src/components/ChatBotAlpha/SeletorSistemaChatBot.tsx` | Seletor de sistema (aba Infra) |
| `src/components/ChatBotAlpha/IframeChatBotAlpha.tsx` | Iframe sandbox (aba Infra) |

---

## 16. Caminho de Consumo Esperado

```
Sidebar → "ChatBot Alpha" → /PainelAlpha/ChatBotAlpha
  → (navegação interna) → Chat | Infra
  → Chat → lista de conversas → conversa → mensagens → input → enviar
  → Infra → seletor (Adminer/Redis/MailHog) → iframe (comportamento atual)
```

---

## 17. Componentes Reutilizáveis do Painel Alpha

| Componente | Caminho | Reuso |
|------------|---------|-------|
| `Button` | `@/components/ui/button` | Botões de ação |
| `Input` | `@/components/ui/input` | Campos de busca/formulário |
| `ButtonLoading` | `@/components/ButtonLoading` | Estados de loading |
| `NotificacaoFlutuante` | `@/components/NotificacaoFlutuante` | Toasts de feedback |
| `ChatChamado` | `@/components/ChatChamado` | Padrão de chat (mensagens, input, scroll) — **referência de UX** |
| `PusherGlobal` | `@/components/PusherGlobal.tsx` | Realtime |
| `getTema` / `TemaAlpha` | `@/lib/temas` | Cores dinâmicas |

---

## 18. Critério Central de Aceite

> **Cada operação visível na referência ChatbotX precisa existir no ChatBot Alpha e chegar a uma API real, sem controles cenográficos ou mocks em produção.**

Este critério é **verificável** somente quando a referência (código-fonte do ChatbotX) estiver acessível dentro do projeto.

---

## 19. Veredito consolidado após a retomada da Fase 6

A referência real permitiu validar a superfície workspace-token e corrigir API, CLI, autorização e documentação. A entrega não alega paridade integral com o inbox interno: recursos que dependem de sessão interna, filtros não aceitos por `GET /v1/contacts`, uploads/flows/replies e edição de contato permanecem fora da capacidade implementada.

**Status da story:** `CONCLUÍDA — FASES 0–16 PASS`
**Próximo passo operacional:** configurar `CHATBOTX_API_URL` + `CHATBOTX_API_KEY` para o smoke contra o serviço real.

---

## 20. Evidências dos Gates (Fases 10–14)

| Gate | Fase | Resultado | Detalhe |
|------|------|-----------|---------|
| Forge (Gate Técnico) | 10 | ✅ PASS | ESLint: 0 novos erros; Typecheck: 0 novos erros; Tests: 0 novas falhas; `git diff --check`: limpo |
| Probe (Integração) | 11 | ✅ PASS | 8/8 pontos verificados; persistência parcial (sem `CHATBOTX_API_URL` real); 3 bugs corrigidos nesta fase |
| Anubis (Segurança) | 12 | ✅ PASS | 12 arquivos de produção revisados; nenhum achado reportável; relatório canônico da auditoria preservado fora do repositório |
| Lens (Revisão) | 13 | ✅ PASS | Nenhum achado bloqueante ou importante; fronteiras Server/Client, tipagem, consumidores e tratamento de erros aprovados |
| Sage (Cobertura) | 14 | ✅ PASS | 7 arquivos, 124 testes aprovados e 1 `it.todo`; cobertura adicional de 401/403, cursor, listas vazias, `perPage` e trim |

---

## 21. Limitações e Pendências Operacionais

| # | Limitação | Impacto | Status |
|---|-----------|---------|--------|
| 1 | Referência está fora deste repositório, em `/home/ialpha/projetos/ChatbotX-main` | Código foi inspecionado nesta retomada; o caminho precisa permanecer disponível para futuras revalidações | ⚠️ Dependência local |
| 2 | `CHATBOTX_API_URL`/`CHATBOTX_API_KEY` não configurados no ambiente | Smoke real de chat (listar conversas, enviar mensagem) não executável | 🔴 Pendente (config) |
| 3 | Ownership individual não existe na superfície workspace-token | Qualquer usuário do Painel Alpha com `chatBotAlpha` opera no workspace externo associado à chave | 🔴 Pendente (política/contrato externo) |
| 4 | Validação em navegador real (teclado, foco, responsividade) | Confirmada por inspeção estática; sem RTL/Playwright no projeto | ⚠️ Pendente (manual) |
| 5 | Doctor exige URL + `CHATBOTX_API_KEY` e aceita `CHATBOTX_API_TOKEN` só como fallback | Configuração incompleta falha com código de configuração | ✅ Corrigido |

---

## 22. DELIVERY_READY (Parte não bloqueada)

```
Sidebar → "ChatBot Alpha" → /PainelAlpha/ChatBotAlpha (auth + permissão chatBotAlpha)
  → Aba "Infra" → seletor (Adminer/Redis/MailHog) → iframe (comportamento preservado)
  → Aba "Chat" → sidebar de conversas → selecionar conversa → mensagens → input → enviar
  → CLI: npm run chatbot-alpha:doctor → JSON com checks de config/safety/contract/observability
  → CLI: npm run chatbot-alpha:capabilities → lista de 6 capacidades com status
  → CLI: npm run chatbot-alpha:list-conversations -- --keyword <texto> --page <n>
  → CLI: npm run chatbot-alpha:list-messages -- --contact-id <id>
  → CLI: npm run chatbot-alpha:send-message -- --contact-id <id> --text <texto>
```

**Validado pelo Probe e pela checagem final independente:** presença visual, trigger, rota protegida, permissões, estados UI (loading/erro+retry/vazio/sucesso), sem regressões. Build aprovado (78 páginas, rota gerada). Suíte final: 7 arquivos, 124 testes aprovados e 1 `it.todo`.

**Não validado (pendente):** smoke no backend real (requer configuração de ambiente), recursos deliberadamente fora da superfície implementada e isolamento individual por agente (não fornecido pelo workspace token).

---

## 23. Checklist Final de Fechamento

- [x] Fases 0–16 concluídas com veredito PASS
- [x] Fase 16 concluída: sessão e resultado arquivados no journal
- [x] Story criada e reconciliada com o estado final
- [x] File List completo (novos, adaptados, preservados)
- [x] Evidências dos gates registradas (Fases 10–14)
- [x] Limitações e pendências documentadas
- [x] DELIVERY_READY registrado com caminho validado
- [x] Memória da fase 15 atualizada (`architecture`, `codebase-map`, `integration-points` e `decisions`)
- [x] `components` preservado: nenhum componente novo foi classificado como reutilizável fora do módulo
- [x] `known-errors` preservado: não houve nova falha de produto com solução comprovada nesta fase documental
- [x] `journal` atualizado pela fase 16 de arquivamento
- [x] Sem segredos, tokens ou URLs autenticadas registrados na memória
- [x] Baseline global pré-existente documentado (2.484 ESLint, 34 typecheck, 2.412/2.462 tests)
