# Handoff frontend — estabilidade do Painel Alpha

26/10/2026, Nova. Candidato exclusivo `/var/tmp/alpha-estabilidade-20261026/candidate`, base20f310 e trabalho Echo preservados. Nenhum commit, deploy, env, schema ou banco real alterado.

## Implementado

- Sessão/heartbeat no navegador30s; csrf+session compartilham o prazo TOTAL. Handshake do frame45s. Heartbeat permanece React Query20s saudável, identidade/autorização obrigatórias, top-window, abort/cooldown e sem repetição automática de POST. TEMP precisa confirmação real antes de voltar a emitir heartbeat.
- Broadcast usa React Query por identidade, uma consulta em voo, deadline30s, backoff30→300s,15s saudável/60s oculto e Retry-After bounded. Dismiss persiste durante refetch. Notificações preservam poller consolidado checklist/chamados, páginas/cursor, deduplicação e snapshot em5xx; agora deadline/backoff/Retry-After/foco sem furar cooldown, abort/troca identidade e limpeza de estado de outro usuário.
- Lembretes exigem principal+sessão permitida+visibilidade+permissão existente, no máximo uma action em voo, catch/cleanup e próximo ciclo normal5min após settlement. Sem retry por foco nem replay de action que escreve/Pusher.
- `useNotasWorkspaceSync` reúne somente reconciliação/persistência do workspace existente. Leitura React Query preserva geração local, mergeia abas locais ainda não confirmadas e não sobrescreve drafts pendentes; hidrata antes de gravar. Preferências só são gravadas quando diferentes do snapshot confirmado, debounce600ms, uma escrita em voo e coalescing da intenção mais recente após sucesso. Resultado desconhecido mantém aviso/intenção, sem reenvio automático; reconsulta manual é somente leitura.
- NotesGlobalTaskbar consome rejeições de todas as actions afetadas, inclusive fixar/cor/ativar/fechar/reordenar/criar/abrir/sync/leitura. Reorder usa ordem ATUAL do store, não o closure anterior. Mantém sistema existente SalvamentoNota/rascunhos e guardas. Sucesso de criação seguido de falha ao abrir workspace mantém aba local. Erros exibidos em região `role=status` com reconsulta.
- IA: GETs agentes/pins/models separados, abort/autorização por usuário, body deadline e códigos públicos allowlist; erro não apaga conversa, texto ou pins confirmados. GETs com erro recuperam com backoff60→300s/Retry-After. Voz mantém cache/inflight/fallback nativo/backoff e passa a expor código público; mudança de usuário cancela checks e invalida capacidades antigas. Nenhum POST de chat/voz é repetido.
- Geo mantém `geolocation=()` e consulta policy antes de API; policy desconhecida não pede localização. Iframe mantém `allow=autoplay; fullscreen` sem `allowFullScreen` redundante.
- `PainelVersionNotice` faz GET health no principal a cada5min, somente com SHA local válido e sessão permitida. Wiring mínimo aprovado pelo lead em `src/app/PainelAlpha/layout.tsx` passa `VERCEL_GIT_COMMIT_SHA` validado40hex para prop pública do shell; nenhum secreto/env server importado no client. Aviso orienta salvar trabalho em TODAS abas/preservar drafts e atualizar manualmente. Não há botão de reload, navegação, auto-refresh, remount ou bypass de guardas: proteção verificável de todos os frames legados não existe e a alternativa orientativa foi aprovada pelo lead.

Novos componentes: somente `PainelVersionNotice`, acessível e tokens semânticos. `AvisoBroadcast` é subcomponente local para preservar dismiss/timer. Não há novo módulo/menu/atalho nem alteração de ACL. Arquivos legados grandes foram adaptados pontualmente, sem reescrever chat/editor.

## Evidências executadas

- Rodada inicial44testes:39PASS/5FAIL. Corrigidos drain de preferências depois de liberar single-flight e cooldown do heartbeat na recuperação; fixtures de Retry-After atualizadas para contrato máximo300s.
- Rodada posterior59testes PASS. Regressões reais adicionais da taskbar passaram. Asserção estática antiga de `window !== window.top` foi adaptada ao helper; cenário real child-frame já cobre a regra.
- Rodada com120testes tinha erro NÃO tratado de Animation.cancel do happy-dom ao desmontar Framer Motion do widget de clima. Corrigida somente a fronteira de animação do teste por mock (sem silenciar erros globais nem alterar aplicativo).
- **Rodada final:16arquivos/128testes PASS, sem unhandled errors**, duração726ms. Log `/var/tmp/alpha-estabilidade-20261026/nova-focused-final.log`.
- ESLint direcionado29arquivos app/test:0errors/0warnings; novos testes IA/voz também0errors. Logs `nova-eslint-final.log` e `nova-eslint-tests-final.log` no mesmo diretório privado. `git diff --check` PASS.
- Tentativa isolada `npx tsc --noEmit` terminou **OOM no heap padrão4GB**, não constitui aprovação de typecheck. Não repetida conforme lead; Forge executará `npm run typecheck` com8GB, além de lint/test/build globais.

Testes cobrem: orçamento csrf20s+session10s; uma consulta em voo/cancel/childframe/cooldown e identidade; snapshot/dismiss; lembretes sem replay; hidratação sem upsert; alteração concorrente de abas/draft; coalescing/drain; todas rejeições de taskbar e aba criada preservada; códigos IA seguros/deadline body; voz com usuário antigo abortado; geo bloqueada sem API; aviso SHA sem reload/remount e draft DOM preservado. Inclui regressões existentes de editor, salvamento concorrente/realms, sessão/iframe/guardas e headers.

## File list Nova

App alterado:
- `src/lib/auth/cliente-sessao.ts`, `src/lib/painel-embedded.ts`, `src/lib/onyx/browser.ts`
- `src/components/Heartbeat.tsx`, `src/components/BroadcastBanner.tsx`, `src/components/NotificacaoFlutuante.tsx`
- `src/hooks/useNotasLembretesPendentes.ts`, `src/components/Notas/NotesGlobalTaskbar.tsx`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `src/components/BibbleChatHome/useVoiceStatus.ts`, `src/components/BibbleChatHome/BibbleWeatherWidget.tsx`, `src/components/BibbleChatHome/BibbleSpriteCompanion.tsx`
- `src/components/layout/PainelLayoutClient.tsx`, `src/app/PainelAlpha/layout.tsx` (wiring SHA aprovado)

App criado:
- `src/lib/painel-polling.ts`, `src/lib/geolocation-policy.ts`, `src/lib/ai-availability-client.ts`
- `src/hooks/useNotasWorkspaceSync.ts`, `src/components/layout/PainelVersionNotice.tsx`

Testes criados:
- `tests/auth/cliente-sessao-budget.test.ts`
- `tests/layout/estabilidade-consumidores-react.test.tsx`
- `tests/notas/workspace-resiliencia-react.test.tsx`, `tests/notas/taskbar-rejeicoes-react.test.tsx`
- `tests/bibble/availability-client.test.ts`

Testes adaptados:
- `tests/auth/sessao-cliente-resiliencia.test.tsx`, `tests/auth/iframe-sessao-resiliencia.test.tsx`
- `tests/layout/painel-frame-guards-composition.test.tsx`, `tests/bibble/voice-status-react.test.ts`
- `tests/chamados/feedback-ui.test.ts`, `tests/chamados/central-notificacoes-painel.test.ts`

Documentação: este handoff e checklist/file list da story. Catálogo/memória final ficam para Scribe/Kowalski conforme ownership.

## Limites para Forge/Probe

Sem validação de browser autenticado/runtime staging/prod ou medição de carga real nesta etapa. Forge/Probe/Anubis/Lens/Sage e deploy permanecem pendentes. Verificar tipos com heap8GB e build completo; logs de focused não substituem gates globais. Não declarar banco normalizado por timeout ampliado. DevOps deve garantir metadado de SHA do artefato e binding staging/produção separado. Atualização de versão é deliberadamente orientativa por ausência de garantia universal de drafts de frames legados.


## Correção pontual após Forge

Forge identificou TS2339 no `modelsQuery.data.capabilities`: o callback de intervalo do React Query não preservava a inferência do retorno genérico. `BibbleChatLayout.tsx` agora declara `BibbleModelsResponse` e `useQuery<BibbleModelsResponse>` explicitamente; a mesma interface tipa o helper da consulta. Sem `any`, coerção de dados ou mudança de comportamento. Testes correspondentes `tests/bibble/availability-client.test.ts`:7PASS; ESLint do componente:0errors/0warnings; diff-check PASS. Typecheck global permanece com Forge, não foi repetido por Nova. Arquivo app já consta na file list.


## Fixtures CheckList após suíte global Forge

Alterados exclusivamente `tests/checklist-analistas/notifications-subscription.test.tsx` e `tests/checklist-analistas/eventos-recovery-client.test.tsx`: sessões autenticadas agora têm `estadoAcesso: PERMITIDO`, `acessoBloqueado:false` e identidade; TEMP não contém identidade pública. Adicionada regressão INDISPONIVEL sem fetch em cada suíte. O cenário de falha na segunda página também verifica que evento de recuperação respeita cooldown6s antes da nova leitura, preservando página1 e deduplicação. Primeira rodada após fixtures:14PASS/1FAIL por expectativa antiga de recovery imediato; corrigida somente expectativa/relógio, sem enfraquecer app. Rodada final2arquivos/15testes PASS; ESLint direcionado0errors/0warnings. Logs privados `nova-checklist-fixtures.log` e `nova-checklist-fixtures-eslint.log`. Nenhum appcode, typecheck/global build, schema/env/deploy alterado; Forge pode retomar gates.


## Correção SSR após smoke Forge

`src/components/BroadcastBanner.tsx`: callback `refetchInterval` agora testa `typeof document !== "undefined"` antes de ler `document.hidden`. React Query pode avaliar esse callback durante SSR mesmo com `enabled:false`; a condição anterior causava500 nas páginas públicas. Não alterados autorização, cadência, Retry-After ou backoff. Inspecionados callbacks novos de heartbeat/version/models/agentes/notas e fronteiras de efeitos/voz: os demais callbacks de intervalo são puros; browser APIs restantes estão em efeitos/eventos ou guardas apropriados.

Novo `tests/layout/pollers-ssr.test.tsx` usa `renderToString` REAL em ambiente Node sem window/document: BroadcastBanner, Heartbeat, version notice, poller consolidado e hooks notas/lembretes/voz, estados unauthenticated/loading/INDISPONIVEL/PERMITIDO, sem chamadas de rede. Rodada focada com regressões de concorrência:2arquivos/13testes PASS; lint dos2arquivos0errors/0warnings; diff-check PASS. Logs privados `nova-ssr-focused.log`/`nova-ssr-eslint.log`. Forge deve refazer build/runtime, não executados por Nova. File list adicional: teste SSR acima; appfile já listado. Nenhum schema/env/deploy.


## Correção de concorrência apontada por Lens

`src/hooks/useNotasWorkspaceSync.ts` agora chama `query.refetch({cancelRefetch:false})`; botão em `src/components/Notas/NotesGlobalTaskbar.tsx` aplica a mesma opção em `noteQuery.refetch`. Reconsultas com cache preenchido reutilizam a leitura em voo, sem cancelar só o observador e multiplicar Server Actions não abortáveis. Gerações, rascunhos, auth, catches e coalescing de escritas preservados.

Regressões nos hooks/componentes reais, não só QueryObserver: depois de hidratar/cachear, leitura pendente mais3mensagens+3reconsultas manuais mantém calls totais2 (inicial+uma nova), active1/peak1; resposta tardia conserva aba/rascunho local. A taskbar com cache de nota preenchido e3cliques também mantém uma única Server Action ativa.5arquivos/41testes de notas PASS, lint dos2appfiles+2testfiles0errors/0warnings; diff-check PASS. Logs privados `nova-lens-concorrencia.log` e `nova-lens-concorrencia-eslint.log`. File list permanece nos4arquivos acima já listados; nenhum schema/env/deploy/gate global executado. Delta retorna a Forge proporcional e Lens.
