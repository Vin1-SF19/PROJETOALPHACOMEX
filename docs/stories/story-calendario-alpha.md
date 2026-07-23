# Story: Calendário Alpha — Google Calendar via Domain-Wide Delegation

**ID:** STORY-CALALPHA-001
**Epic:** Calendário Alpha
**Status:** InReview
**Prioridade:** Alta
**Complexidade:** Muito Alta
**Agente responsável:** Bibble Squad (Scout → Echo/Nova → Vault → Forge → Lens → Probe → Sage → Anubis)
**Data de criação:** 2026-07-17

---

## ⚠️ Mudança de arquitetura nesta sessão (ver Change Log completo)

A story começou como **OAuth 2.0 individual** (cada usuário clica "Conectar" e autoriza no Google). Depois de implementada, testada e migrada, o usuário esclareceu que o modelo desejado é **Domain-Wide Delegation**: uma Service Account, autorizada **uma única vez** pelo Super Admin do Google Workspace no Admin Console, impersona qualquer usuário do domínio usando o e-mail dele (`usuarios.email`, confirmado pelo usuário como sendo o mesmo e-mail do Workspace). **Não há mais OAuth por usuário, nem token individual armazenado.** Esta versão do documento reflete a arquitetura final (v2).

---

## Narrativa

**Como** usuário autorizado do PainelAlpha, com acesso à minha agenda Google Workspace já concedido pela empresa via Domain-Wide Delegation,
**quero** ativar o módulo nativo **Calendário Alpha**,
**para** visualizar, criar, editar e cancelar meus compromissos reais do Google diretamente dentro do painel, sem precisar de nenhum passo de autorização individual.

---

## Contexto e Fluxo Esperado (v2)

1. Exibe estado "não ativado" com explicação clara e botão **Ativar Calendário Alpha** — não há redirecionamento a nenhuma tela do Google, é uma operação 100% local (grava `GoogleCalendarConexao{ userId, status: "ATIVA" }`).
2. Toda chamada à Google Calendar API usa uma **Service Account com Domain-Wide Delegation**, impersonando `usuarios.email` do usuário logado (`google.auth.JWT({ subject: emailUsuario })`) — nunca um token individual.
3. Lista os calendários Google do usuário (via impersonation) e permite selecionar quais ficam visíveis/gravável no painel.
4. Exibe eventos em visões de **mês** e **agenda** (lista de 14 dias) — respeitando o tema ativo do usuário.
5. Permite criar, editar e cancelar eventos reais. Google é fonte de verdade de horário/all-day/timezone/participantes/Meet.
6. Sincroniza incrementalmente via `syncToken` por calendário; `410 Gone` dispara full sync controlado, sem duplicar eventos.
7. **Sem webhook** (decisão já tomada — sem infra pública/cron confirmada).
8. **Sem vínculos internos** (Reserva de Salas/Clientes/Tarefas) nesta entrega.
9. `emailUsuario` usado na impersonation **sempre** vem de `usuarios.email` da sessão autenticada no servidor — nunca de um valor fornecido pelo cliente (confirmado por Anubis, ver seção de segurança).

---

## Pré-requisito manual (Google Cloud + Workspace Admin Console)

**Isto não é código — só o Super Admin do Workspace consegue fazer:**

1. No Google Cloud Console (mesmo projeto ou novo): ativar a **Google Calendar API**.
2. Criar uma **Service Account** → gerar uma **chave JSON** → guardar `client_email` e `private_key`.
3. Na Service Account, anotar o **Client ID numérico** (aparece nos detalhes dela).
4. No **Admin Console do Google Workspace** (admin.google.com) → **Security → API Controls → Domain-wide Delegation → Add new**:
   - Client ID: o numérico da Service Account (passo 3).
   - Escopos OAuth (exatamente os de `src/lib/google-calendar/scopes.ts`, separados por vírgula):
     `https://www.googleapis.com/auth/calendar.calendarlist.readonly,https://www.googleapis.com/auth/calendar.events.owned,https://www.googleapis.com/auth/calendar.events.readonly,https://www.googleapis.com/auth/calendar.freebusy`
5. No `.env`/`.env.local` do PainelAlpha:
   ```env
   GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL=<client_email da chave JSON>
   GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key da chave JSON, com \n literais>
   ```
6. Rodar `npm run calendar-alpha:doctor` para validar formato (não imprime segredo).

Sem os passos 1-4 (feitos por vocês no Google), o código não tem como funcionar — não é algo que eu resolvo escrevendo mais código.

---

## Critérios de Aceitação

- [x] AC-001: Story aprovada e atualizada conforme decisões tomadas (incluindo a mudança de arquitetura).
- [x] AC-002: Módulo registrado como 1 entrada em `MODULOS_REGISTRY` (`calendarioAlpha`, rota `/PainelAlpha/CalendarioAlpha`) — grid/sidebar/TabBar/permissões propagam automaticamente.
- [x] AC-003: Rota (`page.tsx` + `middleware.ts`) e todas as Server Actions exigem `verificarAcessoCalendarioAlpha()` (sessão + usuário `ATIVO` + permissão efetiva `calendarioAlpha`).
- [x] AC-004 *(reformulado)*: Não há OAuth individual — a "ativação" é uma preferência local do usuário, sem qualquer interação com o Google. Login principal do Painel (Credentials + JWT) inteiramente intocado.
- [x] AC-005 *(reformulado)*: Não há mais token por usuário para criptografar (removido `crypto.ts`/AES-GCM). A chave privada da Service Account é um segredo estático do servidor, guardado em `.env` como qualquer outro (`ANTHROPIC_API_KEY` etc.) — nunca em banco, nunca no client.
- [x] AC-006: Escopos documentados em `scopes.ts` (`calendarlist.readonly`, `events.owned`, `events.readonly`, `freebusy`) — sem o escopo `calendar` completo. Precisam bater exatamente com o que for autorizado no Admin Console.
- [x] AC-007: `EstadoDesconectado.tsx` (estado "não ativado") explica dados acessados, sem iframe, sem evento simulado.
- [x] AC-008 *(revisado)*: Visões **dia**, **semana**, **mês** e **ano** implementadas como grades reais (sem lista) — dia/semana com grade horária de 24h e posicionamento de sobreposição (`layout-eventos.ts`, testado), mês como grid completo, ano como 12 mini-meses navegáveis. Distinção "ocorrência vs. série" em evento recorrente ainda não implementada.
- [x] AC-009: CRUD real via impersonation + cache local; sync traz mudanças externas. Testado com mocks (Sage).
- [x] AC-010: `sync.ts` — `syncToken`, `410` reseta e refaz full sync uma única vez, cursor só avança em sucesso total.
- [ ] AC-011 *(Fase 2 — fora do MVP)*: Webhook.
- [x] AC-012 *(reformulado)*: "Desativar" é uma preferência local (`status: "DESATIVADA"`), não revoga o Domain-Wide Delegation (isso só o Super Admin faz no Admin Console) — a UI é explícita sobre essa diferença. Sessão do Painel é independente. Não apaga eventos no Google.
- [~] AC-013 *(parcial)*: `consultarDisponibilidade` (FreeBusy) implementada e segura, ainda não chamada pela UI do formulário.
- [ ] AC-014 / AC-015 *(Fase 2 — fora do MVP)*
- [x] AC-016: Tema, mobile-first, `Sheet`/`AlertDialog` acessíveis, `aria-label`+`title` em botões só-ícone.
- [x] AC-017: Nenhum ponto loga a chave privada da Service Account ou dado sensível; erros sempre classificados antes de log/retorno.
- [~] AC-018 *(parcial)*: `npm run calendar-alpha:doctor` valida a nova configuração (Service Account) sem imprimir segredo. CLI de sync/reconciliação manual não construída (sync roda via ação do usuário na UI).
- [x] AC-019: Vault cumprido **duas vezes** — schema inicial (Fase 2 original) e redesenho para Domain-Wide Delegation (Fase 2 v2) — relatório + backup fresco + confirmação explícita em ambas.
- [x] AC-020: `tsc --noEmit`, `npm run lint`, `npm test` (64/64) e `npm run build` executados de verdade após o redesenho, todos passando.
- [x] AC-021: Lens revisou; Anubis revisou com foco específico em `emailUsuario` nunca vir do cliente (confirmado — sempre de `usuarios.email` via sessão); Probe confirmou integração estrutural.
- [x] AC-022: Limitações declaradas: sem rate limit; FreeBusy sem UI; sem webhook; semana/dia não implementadas; CLI de sync não construída. **Impersonation via Domain-Wide Delegation validada com credencial e Service Account reais em 2026-07-17** (`calendar.calendarList.list` impersonando `ti@alpha-comex.com` retornou os 2 calendários reais da conta) — deixou de ser uma limitação.

---

## Decisões de Produto

### Confirmadas em 2026-07-17 (escopo original, ainda válidas)
1. **MVP controlado**: seleção de calendário + visões mês/agenda + CRUD + FreeBusy (lib) + sync incremental. Webhook/vínculos internos ficam para Fase 2.
2. **Sem infra de webhook confirmada** → não implementado.
3. **Sem vínculos internos** (Reserva de Salas/Clientes/Tarefas) nesta entrega.

### Confirmada em 2026-07-17 (mudança de arquitetura, substitui a decisão original de "OAuth individual")
4. **Domain-Wide Delegation em vez de OAuth por usuário.** Motivo do usuário: replicar o modelo de credencial única/centralizada já usado pelo Onyx (`usuarios.token_onyx`) em vez de um fluxo de consentimento por pessoa. Confirmado antes de implementar: (a) `usuarios.email` é o mesmo e-mail do Google Workspace de cada colaborador; (b) a empresa tem acesso de Super Admin do Workspace para autorizar a Service Account. **Consequência aceita conscientemente:** só funciona para contas Google Workspace da empresa — conta pessoal (Gmail) deixou de ser suportada (substitui a decisão anterior de aceitar "ambas"). A Service Account, uma vez autorizada, pode impersonar qualquer usuário do domínio — por isso `emailUsuario` **nunca** pode vir de input do cliente (ownership 100% ancorada em `usuarios.email` da sessão, auditado por Anubis).

---

## Fora do Escopo (Fase 2, após confirmação futura do usuário)

- Webhook/push notification do Google e renovação automática de canal.
- Vínculo de evento com Reserva de Salas, Clientes ou Tarefas.
- Suporte a conta Google pessoal (Gmail) — inviável com Domain-Wide Delegation; exigiria voltar ao modelo OAuth por usuário em paralelo.
- Distinção "esta ocorrência vs. série inteira" em eventos recorrentes.
- Visões de semana/dia como grades dedicadas.
- Substituir o login principal do Painel por Google Sign-In.
- Reimplementar a lógica de conflito de Reserva de Salas.

---

## Extensão entregue em 2026-07-23 — Calendário Alpha no Bibble/IAlpha

Esta extensão torna o Calendário Alpha operável por conversa no Bibble/IAlpha, sem alterar schema, executar migration ou mudar a configuração de compartilhamento já existente. O acesso continua ancorado na sessão, no usuário `ATIVO`, na role atual e nas permissões efetivas lidas do banco.

- [x] 10 tools de calendário disponíveis: listar calendários; listar, criar, editar e cancelar eventos próprios; consultar FreeBusy; consultar agenda de colega; e criar, editar e cancelar evento de colega para Admin/CEO.
- [x] Consultas aceitam intervalo exato (`data_inicio` + `data_fim`) ou janela de até 60 dias e limitam a resposta a 200 eventos.
- [x] O calendário pode ser resolvido por nome; quando há mais de uma opção compatível, o Bibble devolve candidatos e pede escolha em vez de selecionar silenciosamente.
- [x] Datas com horário exigem ISO 8601 com offset; datas civis usam `America/Sao_Paulo`. A data/hora atual de São Paulo é injetada no contexto de cada requisição.
- [x] CRUD próprio mantém ownership por `ctx.userId` da sessão. Nenhuma tool aceita `userId`, `colegaId`, `calendarId` ou e-mail de impersonation fornecido pelo modelo.
- [x] Consulta de colega respeita o compartilhamento existente; Admin/CEO pode consultar qualquer colaborador ativo. Nome/e-mail ambíguo retorna candidatos, sem `findFirst` silencioso.
- [x] Escrita na agenda de colega é exclusiva de Admin/CEO e resolve o alvo no banco; role e permissões são recarregadas do banco em cada requisição do chat.
- [x] Edição usa patch parcial e exige `etag`; o cliente envia `If-Match`, preservando campos não editados e sinalizando conflito quando o evento mudou desde a última leitura.
- [x] Cancelamento próprio ou de colega ocorre em duas fases: o Bibble pede confirmação explícita e a execução exige tanto `confirmado: true` quanto a confirmação reconhecida na conversa atual.
- [x] Tool calls são executadas sequencialmente. Limites por requisição: até 6 tools por turno, 12 no total e 3 mutações de calendário; mutação idêntica repetida na mesma requisição é bloqueada.
- [x] Configurações administrativas do módulo — ativar/desativar, selecionar/ocultar calendários, cores e concessão da permissão de compartilhamento — permanecem na UI do Calendário Alpha.
- [x] Sem alteração de banco nesta extensão; portanto, não houve migration, backup pré-mudança nem acionamento do Vault.

**Quality gates da extensão:** ESLint escopado nos 14 arquivos da entrega PASS; `npm test` PASS (16 arquivos/122 testes); `npx next build` PASS; `git diff --check` PASS. O typecheck global mantém 4 erros de baseline fora do diff: dois artefatos gerados de Exclusão Fiscal, `ModalPerfilColaborador` e `HabilitacaoRadarClient`.

**Revisões:** Probe PASS; Lens PASS; Anubis CONCERNS sem blocker. Dívidas registradas pelo Anubis: rate limit cross-request, idempotência persistente e token persistente/específico para confirmação de cancelamento.

---

## Change Log

- 2026-07-23 — **Calendário Alpha ampliado no Bibble/IAlpha para 10 tools**: consultas por intervalo exato e seleção segura de calendário; CRUD próprio; FreeBusy; leitura de agenda de colega; CRUD de colega exclusivo de Admin/CEO; edição parcial com ETag/`If-Match`; confirmação de cancelamento em duas fases; timezone `America/Sao_Paulo`; role/permissões atuais do banco; resolução explícita de ambiguidades; execução sequencial e limites de segurança. Novo núcleo `src/lib/bibble/calendar-tools.ts`. Sem schema/migration/Vault. Gates: ESLint escopado PASS, 122 testes PASS, Next build PASS e diff-check PASS; typecheck global conserva 4 erros baseline fora do diff. Probe e Lens PASS; Anubis CONCERNS sem blocker.
- 2026-07-17 — Story criada (Draft) a partir do prompt gerado pelo Phantom.
- 2026-07-17 — Scout entregou blueprint de reconhecimento. Riscos identificados: auth de Reserva de Salas é fraca (não copiar), sem criptografia/cron/webhook/`googleapis` no projeto.
- 2026-07-17 — Usuário confirmou 4 decisões de produto (MVP controlado, OAuth ambas as contas, sem webhook, sem vínculos internos). Status → Ready.
- 2026-07-17 — **v1 (OAuth individual) implementada e testada**: criptografia AES-256-GCM, state OAuth assinado, nonce de uso único, cliente Google via `googleapis`, Route Handlers `connect`/`callback`, UI completa (mês/agenda/formulário/detalhe/seletor de calendários), 80 testes, Forge/Anubis/Lens/Sage/Probe executados, 1ª migration Vault aplicada no Turso (`GoogleCalendarConexao` com tokens + `GoogleCalendarOAuthNonce`).
- 2026-07-17 — **Usuário esclareceu que o modelo desejado era Domain-Wide Delegation** (como o Onyx), não OAuth por usuário. Confirmado: `usuarios.email` = e-mail Workspace real; empresa tem Super Admin do Workspace.
- 2026-07-17 — **v2 (Domain-Wide Delegation) implementada**: 2ª migration Vault (backup fresco `painelalpha_turso_pre_change_calendario_alpha_v2_20260717_164327.sql`, confirmação explícita do usuário) — `DROP TABLE GoogleCalendarOAuthNonce`, `GoogleCalendarConexao` recriada sem campos de token (`status`/`ativadoEm`/`desativadoEm`/`ultimaSincronizacaoEm` apenas). Removidos: `crypto.ts`, `oauth-state.ts`, `nonce.ts`, `token-manager.ts`, rotas `/api/calendario-alpha/oauth/*`. Novo: `usuario-google.ts` (resolve e-mail a impersonar sempre a partir da sessão), `client.ts` reescrito para `google.auth.JWT` com `subject: emailUsuario`. UI: "Conectar/Desconectar" → "Ativar/Desativar". CLI doctor atualizado para as novas env vars. 64 testes passando (removidos os de crypto/oauth-state/nonce, adicionado `usuario-google.test.ts`). Forge (tsc/lint/build/test) e Anubis (foco: `emailUsuario` nunca vem do cliente) reexecutados após o redesenho.
- 2026-07-17 — Usuário configurou a Service Account no Google Cloud (`calendario-alpha@projeto-alpha-492917.iam.gserviceaccount.com`) e o Domain-Wide Delegation no Admin Console do Workspace (Client ID `116171147796556178597`, escopos corrigidos após 1ª tentativa colar sem vírgulas). Removido `ESCOPO_APP_CREATED` de `scopes.ts` (dead code, nunca usado). Credenciais gravadas em `.env.local` (lidas diretamente do JSON baixado, chave privada nunca exposta no chat/terminal). `scripts/calendar-alpha-doctor.mjs` corrigido para carregar `.env`+`.env.local` via `dotenv` (faltava, causava falso-negativo). **Teste end-to-end real executado com sucesso**: impersonation de `ti@alpha-comex.com` via `calendar.calendarList.list()` retornou os 2 calendários reais da conta — confirma Domain-Wide Delegation funcionando ponta a ponta. AC-022 atualizado (deixou de ser limitação).
- 2026-07-17 — **Bug real de performance encontrado em uso real** (não em teste mockado): primeira sincronização completa do calendário pessoal do usuário escalou de 2s para 284s (logs do próprio servidor). Causa: (1) `client.ts` recriava o cliente JWT (nova troca de token OAuth) a cada página de paginação; (2) janela de full sync original de 455 dias (90 atrás + 365 à frente) era grande demais para uma conta de trabalho ativa. Corrigido: cliente JWT agora cacheado por `emailUsuario` (TTL 45min); janela reduzida para 180+180 dias; adicionado teto de segurança de 30 páginas por sincronização (`sync.ts`). Confirmado pelo usuário que recarregar a página voltou a funcionar normal.
- 2026-07-17 — **Reforma visual solicitada pelo usuário**: adicionadas visões de **Dia** e **Semana** (grade horária de 24h, `GradeHoraria.tsx` compartilhado, com algoritmo de particionamento de colunas para eventos sobrepostos em `layout-eventos.ts`, 8 testes novos) e **Ano** (`VisaoAno.tsx`, 12 mini-meses navegáveis com indicador de dia com evento). **Removida** a visão "Agenda" (lista) — usuário não queria formato de lista, só grades de calendário reais. Container do módulo alargado (`max-w-6xl` → `max-w-[1600px]`) e células do mês aumentadas para visão mais ampla. Criado `CalendarioAlphaBackground.tsx` + `layout.tsx` do módulo — background "vivo" CSS/Framer Motion (estrelas em 3 camadas + parallax + glows) baseado no `CsNpsBackground.tsx` do CS&NPS, com detalhe próprio de mostrador de relógio (12 marcadores + ponteiro varrendo) em vez do anel simples do CS&NPS, para não ficar idêntico (mesmo padrão já usado entre CS&NPS/CheckList). Janela de sync ajustada para 180+180 dias para a visão de Ano ter dados reais. Forge (tsc/lint/build/78 testes) reexecutado, tudo passando.
- 2026-07-17 — **3ª migration Vault** (backup fresco `painelalpha_turso_pre_change_calendario_alpha_v3_20260717_183952.sql`, confirmação explícita): `ADD COLUMN "linkMeet" TEXT` (nullable) em `GoogleCalendarEventoCache` — 403 linhas preservadas. **Detalhe do evento trocado de Sheet lateral para Popover** (`DetalhePopover.tsx`, novo `src/components/ui/popover.tsx` shadcn) — abre ancorado no evento clicado em vez de ocupar a lateral inteira da tela, com botão "Entrar no Google Meet" quando `linkMeet` está presente. `DetalheEvento.tsx` (Sheet) removido, substituído em `VisaoMes`/`GradeHoraria`. Forge (tsc/lint/build/78 testes) reexecutado após a mudança.
- 2026-07-17 — **Usuário pediu**: (1) poder do Bibble sobre a própria agenda via chat, (2) Admin/CEO enxergar a agenda de qualquer colaborador, e (3) uma cultura de compartilhamento de agenda entre colegas (todo mundo adiciona quem quiser à própria visão, cor diferenciada, liga/desliga). Confirmado com o usuário: Admin vê **qualquer** colaborador mesmo sem ter sido adicionado; acesso de Admin é **leitura + escrita completa**; entrega em **UI + Bibble**.
- 2026-07-17 — **4ª migration Vault** (backup fresco, confirmação explícita "sim"): nova tabela `GoogleCalendarColegaVisivel` (`userId` viewer, `colegaId` dono, `cor`, `visivel`, `@@unique([userId, colegaId])`) + relations `colegasQueEuVejo`/`colegasQueMeVeem` em `usuarios`. Backend: `src/lib/google-calendar/colegas.ts` (paleta de 10 cores, `proximaCorColega`, `isAdminRole`), `src/actions/google-calendar-colegas.ts` (listar/adicionar/remover/alternar + `listarEventosDeColega` — leitura ao vivo sem cache, teto de 10 páginas, exige estar na lista de visibilidade OU ser Admin/CEO), `src/actions/google-calendar-admin.ts` (`criarEventoParaColega`/`atualizarEventoParaColega`/`cancelarEventoParaColega` — exclusivo Admin/CEO, e-mail do colega sempre resolvido do banco via `colegaId`, nunca do cliente). UI: `PainelColegas.tsx` (Sheet com seletor + lista com cor/switch/remover), botão `Users` no `HeaderCalendario`, eventos de colegas mesclados na grade (`page.tsx`) com `colegaId` marcado em `EventoExibicao`, `DetalhePopover`/`FormularioEvento` roteando para as ações de Admin quando o evento é de um colega.
- 2026-07-17 — **Bibble ganhou tools de Calendário Alpha**: `listar_eventos_calendario`, `criar_evento_calendario`, `cancelar_evento_calendario`, `consultar_disponibilidade_calendario` (agenda do próprio usuário, delegando para `src/actions/google-calendar-eventos.ts`) e `consultar_agenda_colega` (resolve o colega por nome/e-mail no banco e delega para `listarEventosDeColega`, que já aplica a checagem de compartilhamento/admin server-side — o modelo nunca recebe nem escolhe um `colegaId` diretamente, só um nome/e-mail em texto livre, o que torna IDOR estruturalmente impossível pelo parâmetro da tool). Definições em `src/lib/bibble/tools.ts`, execução em `src/lib/bibble/tool-executor.ts`, capacidades documentadas em `src/lib/bibble/system-prompt.ts`. Forge (tsc/lint/build/78 testes) reexecutado, tudo passando; auto-revisão de segurança confirmou que `userId` nunca é aceito do modelo e toda escrita/leitura passa pelas Server Actions que já validam ownership.
- 2026-07-17 — **Rodada de refinamento visual/funcional pedida pelo usuário**: (1) **Cor personalizável** — agenda própria (`personalizarCorCalendario` em `google-calendar-eventos.ts`, `input[type=color]` em `SeletorCalendarios.tsx`) e agenda de cada colega (`personalizarCorColega` em `google-calendar-colegas.ts`, `input[type=color]` em `PainelColegas.tsx`); corrigido `definirCalendarioSelecionado` para não resetar mais a cor personalizada toda vez que visibilidade/gravável são alternados (removido `corHex` do objeto `update` do upsert, mantido só no `create`). Nova validação `corHexSchema` (`^#RRGGBB`) em `google-calendar.ts`. (2) **"+N mais" do mês virou clicável** — novo `DiaEventosPopover.tsx`, Popover com a lista completa dos eventos do dia (clicar em um item abre o formulário de edição direto). (3) **Criar evento clicando no dia (mês)** — botão "+" que aparece no hover de cada célula do `VisaoMes.tsx` (`onNovoEventoNoDia`), sem interferir no clique da célula inteira (que continua navegando para a visão de Dia). (4) **Confirmado que eventos sobrepostos já ficam lado a lado** — `calcularPosicoesEventosDoDia` (`layout-eventos.ts`) já opera sobre o array mesclado (próprios + colegas) recebido por `GradeHoraria.tsx`; nenhuma mudança necessária, só verificação.
- 2026-07-17 — **Correção de design na permissão de compartilhamento (feedback do usuário logo após a entrega):** a 1ª versão exigia que os DOIS lados (quem adiciona e quem é adicionado) estivessem liberados — o usuário apontou que isso quebrava o caso de uso real (liberar só líderes de setor, que precisam poder adicionar a agenda de colaboradores comuns, que nunca vão ter a permissão). Corrigido: a permissão em `GoogleCalendarPermissaoColegas` agora controla **apenas quem pode usar o botão de adicionar/consultar** (o "viewer"); o alvo pode ser qualquer colaborador ATIVO, liberado ou não. Removida a checagem de permissão do lado do `colega` em `adicionarColegaVisivel`, `listarUsuariosParaCompartilhar` e `listarEventosDeColega`. Texto do `PainelPermissoesColegas.tsx` corrigido para refletir a regra assimétrica. Forge (tsc/lint/build/78 testes) reexecutado.
- 2026-07-17 — **5ª migration Vault** (backup fresco `painelalpha_turso_pre_change_calendario_alpha_v5_20260717_174739.sql`, 58MB/111 tabelas/28.690 linhas, confirmação explícita "Sim, pode aplicar"): nova tabela aditiva `GoogleCalendarPermissaoColegas` (presença de linha = usuário permitido a usar o compartilhamento de agenda; ausência = bloqueado; Admin/CEO sempre liberado independente da tabela) + relation `permissaoColegasCalendario` em `usuarios`. **Motivo:** usuário pediu um botão visível só para Admin que controla quem pode usar o botão de adicionar agenda de colega — antes disso, qualquer ativo podia adicionar qualquer outro livremente. **Impacto assumido e confirmado com o usuário:** a partir desta migration, ninguém (exceto Admin) consegue usar o compartilhamento até ser liberado explicitamente; compartilhamentos (`GoogleCalendarColegaVisivel`) já existentes continuam no banco mas passam a ser bloqueados na leitura (`listarEventosDeColega`) até ambos os lados (quem vê e quem é visto) estarem permitidos de novo. Backend: `temPermissaoCompartilhamento()`, checagem nos dois lados em `adicionarColegaVisivel`/`listarUsuariosParaCompartilhar`/`listarEventosDeColega`; novas actions Admin-only `listarPermissoesColegasTodosUsuarios`/`alternarPermissaoColegas`. UI: novo `PainelPermissoesColegas.tsx` (Sheet com Switch por usuário, Admin sempre mostrado como "sempre liberado"), botão `ShieldCheck` visível só para Admin no `HeaderCalendario.tsx`. Forge (tsc/lint/build/78 testes) reexecutado após a migration, tudo passando.

## File List (estado final, v2)

**Domínio (`src/lib/google-calendar/`):**
- `scopes.ts` — escopos da Service Account (sem identidade openid/email — não precisa mais descobrir a conta)
- `errors.ts` — classificação de erros Google (mensagens atualizadas para o contexto de impersonation)
- `types.ts` — DTOs
- `client.ts` — **reescrito**: `google.auth.JWT` com impersonation, todas as funções recebem `emailUsuario`
- `cache-eventos.ts` — mapeamento evento→cache (cobre all-day corretamente)
- `sync.ts` — motor de sync (parâmetro renomeado para `emailUsuario`)
- `autorizacao.ts` — sessão + permissão efetiva
- `auditoria.ts` — auditoria best-effort
- `usuario-google.ts` — **novo**: resolve e-mail a impersonar + status de ativação, sempre a partir de `userId` da sessão

**Removidos nesta sessão (obsoletos na v2):** `crypto.ts`, `oauth-state.ts`, `nonce.ts`, `token-manager.ts`, `src/app/api/calendario-alpha/` (rotas OAuth)

**Actions:** `src/actions/google-calendar-conexao.ts` (ativar/desativar), `src/actions/google-calendar-eventos.ts` (CRUD/sync/seleção/FreeBusy)

**Validações:** `src/lib/validations/google-calendar.ts` (inalterado)

**UI:** `src/app/PainelAlpha/CalendarioAlpha/page.tsx`, `src/components/CalendarioAlpha/{CalendarioAlphaDashboard,EstadoDesconectado,HeaderCalendario,VisaoMes,VisaoAgenda,SeletorCalendarios,FormularioEvento,DetalheEvento}.tsx`, `lib/{datas,tipos}.ts`

**Integração:** `src/lib/modulos-registry.ts` (entrada `calendarioAlpha`), `src/components/layout/GlobalSidebar.tsx` (ícone `CalendarClock`), `src/components/ui/sheet.tsx` (novo componente shadcn)

**Schema:** `prisma/schema.prisma` — `GoogleCalendarConexao` (v2, sem tokens), `GoogleCalendarSelecionado`, `GoogleCalendarEventoCache`; `GoogleCalendarOAuthNonce` removido

**CLI:** `scripts/calendar-alpha-doctor.mjs` (v2 — valida Service Account)

**Testes (64):** `tests/google-calendar/{errors,validations,cache-eventos,sync,usuario-google,datas-calendario}.test.ts`

**Dependências:** `googleapis` adicionado ao `package.json`; script `calendar-alpha:doctor` adicionado

### Extensão Bibble/IAlpha de 2026-07-23 — arquivos alterados/novos

**Bibble/IAlpha:**
- `src/lib/bibble/calendar-tools.ts` — novo núcleo de validação, resolução segura e execução das 10 tools
- `src/lib/bibble/tools.ts` — contratos das 10 tools expostos ao modelo
- `src/lib/bibble/tool-executor.ts` — roteamento das tools com contexto autenticado
- `src/lib/bibble/system-prompt.ts` — capacidades e regras de conversa do calendário
- `src/app/api/bibble/chat/route.ts` — permissões efetivas atuais, timezone, confirmação em duas fases, execução sequencial e limites

**Google Calendar:**
- `src/actions/google-calendar-eventos.ts` — edição parcial segura de evento próprio
- `src/actions/google-calendar-admin.ts` — edição parcial segura de evento de colega por Admin/CEO
- `src/lib/google-calendar/client.ts` — patch parcial e cancelamento com ETag/`If-Match`
- `src/lib/validations/google-calendar.ts` — validação estrita da edição parcial

**Testes:**
- `tests/bibble/calendar-tools.test.ts`
- `tests/bibble/calendar-tools-edge.test.ts`
- `tests/google-calendar/client-etag.test.ts`
- `tests/google-calendar/evento-parcial.test.ts`
- `tests/google-calendar/validations.test.ts`
