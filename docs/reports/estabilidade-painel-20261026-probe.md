# Probe — integração da estabilidade do Painel Alpha

**Veredicto: APROVADO para integração local, 26/10/2026, 21:54 UTC.** Sem bloqueante de integração identificado neste escopo. Homologação autenticada em staging e produção permanece pendente e deve preceder a conclusão do rollout.

Base do candidato:20f310, preservando CRM. Fonte app/test/config aprovada pelo Forge:ce48c29e…; Probe não alterou aplicação, testes, schema, configuração de ambiente, dados, commit ou deployment. Comparação com blueprint/arquitetura e handoffs Echo/Nova realizada depois do Forge PASS.

## Checklist de integração

| Caminho | Evidência e resultado |
| --- | --- |
| Entrada/menu/atalhos | Correção transversal nas entradas existentes, sem módulo/menu/atalho novo. Componentes globais continuam montados no root layout; NotesGlobalTaskbar e guardas existentes permanecem no shell. |
| Principal e iframes | Heartbeat/Broadcast/Notificações/Lembretes exigem estado de acesso permitido e identidade; os pollers globais verificam janela principal. Testes reais React verificaram ausência de chamadas em child-frame, requisição única em voo, cooldown/Retry-After e cancelamento na troca de identidade. |
| Notificações | Caminho existente `/api/notificacoes` → checklist/chamados → stores preservado, incluindo paginação/cursor. Falha mantém snapshot confirmado; recuperação respeita espera, sem segundo poller. |
| Notas | Taskbar conectada a `useNotasWorkspaceSync`; leituras e mutations passam pelas actions existentes. Rejeições são consumidas, estado de erro tem `role=status` e reconsulta de leitura. Testes verificaram hidratação sem upsert, intenção coalescida, resposta antiga sem sobrescrever abas/draft e escrita desconhecida sem replay. Guardas de saída dos frames continuam conectadas. |
| Integrações IA | Queries de agentes/pins/models por usuário, cancelamento quando acesso deixa de ser permitido e estados de indisponibilidade conectados à UI. Rotas diferenciam auth/config/metadata/upstream; voz mantém fallback e invalidação por identidade. Testes de rota confirmam token individual/ownership e ausência de falso200 em falha. |
| Geolocalização/fullscreen | Ambos widgets usam a policy helper antes da API; policy bloqueada/desconhecida não pede localização. Frame mantém `allow="autoplay; fullscreen"` e remove redundância. Headers/config/schema sem alteração nesta entrega. |
| Versão publicada | SHA40 server → prop do shell → `PainelVersionNotice` → `/api/health/version`, com ambiente Vercel staging explícito. Aviso acessível é somente orientativo, sem handler de reload, remount ou limpeza de drafts. Teste preserva trabalho aberto ao detectar versão diferente. |
| Autenticação/roteamento | Forge smoke do build final: login real `/`200, painel anônimo307→`/`, sessão200/null e APIs protegidas401. Probe revisou wiring e executou cenários de acesso indisponível sem polling. Não foi fabricada sessão em ambiente remoto. |
| Regressão/SSR | Fixture Node usa renderização React real sem window/document, cobrindo quatro estados de sessão e os consumidores globais. Composição real dos guardas de frames preserva fechamento/cancelamento/aba fixa. |

## Execução própria

`npx vitest run --maxWorkers=1` nos11arquivos abaixo: **79testes PASS**, exit0,2,97s às21:53:18UTC. Segredo e URLs de banco exclusivamente sintéticos locais; I/O de negócio controlado pelas fixtures, sem acesso/mutação ao banco real. Nenhum unhandled error reportado. Log privado: `/var/tmp/alpha-estabilidade-20261026/probe-focused.log`.

- `tests/layout/{estabilidade-consumidores-react,pollers-ssr,painel-frame-guards-composition}.test.tsx`
- `tests/notas/{workspace-resiliencia-react,taskbar-rejeicoes-react}.test.tsx`
- `tests/auth/cliente-sessao-budget.test.ts`
- `tests/bibble/{availability-client,availability-routes,voice-status-react}.test.ts`
- `tests/onyx/routes-user-token.test.ts`
- `tests/roadmap/production-version-route.test.ts`

Typecheck/lint/build/cobertura integral e HTTP local são evidências do Forge, não novas execuções do Probe. Os79testes direcionados são subconjunto da validação existente, não somar como novos testes distintos à contagem integral.

## Limites e handoff

Esta etapa não executou Chromium/Playwright autenticado, cliques reais nos ambientes remotos, verificação de escrita de negócio real, comparação de carga Vercel ou normalização do Turso/serviços IA. Sem deploy nesta etapa. DevOps deve homologar staging autenticado (home/checklist/cadastro/calendário, rascunhos, pollers/codes e SHA), conferir bindings separados e só então promover e observar produção. Menus/atalhos novos não se aplicam; não inferir saúde de upstream a partir de mocks ou HTTP200 de login.

File list Probe: este relatório e atualização da story. Próximo gate: Anubis, seguido de Lens/Sage conforme fila do lead.
