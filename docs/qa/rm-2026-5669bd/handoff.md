# RM-2026-5669BD — encaminhamento local para DevOps

## Estado

Reconciliação funcional já presente na abertura desta retomada, preservada sem reescrita. Os 83 arquivos do inventário (páginas, imports locais transitivos, migrations e configuração) estão rastreados e não ignorados. `inventory.json` contém SHA-256 de conteúdo e HEAD/árvore de base; **não representa uma árvore Git candidata**. `candidate-source.patch` é o diff local revisável das dependências fonte, incluindo alterações preexistentes que precisam de atribuição por DevOps.

A tentativa de delegação retornou `collab spawn failed: no thread with id`; nenhum agente foi iniciado. Encaminhamento DevOps operacional bloqueado nesta sessão, também sujeita à proibição de Git mutável. Nenhum índice foi preparado, nenhum worktree/branch/commit/push criado. Janela de observação inicia em 2026-09-22T12:48:05.503939+00:00; não há acordo de congelamento entre responsáveis. Nova responde somente pelo inventário; DevOps precisa coordenar início/fim e responsáveis antes da captura definitiva.

## Consumo

Usuário CRM: menu Alpha CRM → Pendências → `/PainelAlpha/AlphaCRM/pendencias` → PendenciasWorkspace.
Administrador: Alpha CRM → Configurações → Base de Conhecimento ou Regras → `/PainelAlpha/AlphaCRM/admin/conhecimento` ou `/PainelAlpha/AlphaCRM/admin/regras` → respectivos workspaces. Links, destino e guardas auth/admin conferidos no código; clique autenticado não executado.

## Procedimento para o candidato (DevOps/Forge, não executado)

1. Coordenar janela sem escritores concorrentes. Comparar hashes do inventário com a árvore local; qualquer mudança invalida a captura. Atribuir mudanças compartilhadas por dependência, sem capturar outros módulos automaticamente.
2. Revisar o patch e as três migrations já rastreadas, sem inventar/aplicar SQL. Incluir testes BPM de regras, SLA, conhecimento e pendências listados na story, manifesto, story e dependências necessárias. Revisar assets públicos e arquivos gerados: estes não são esgotados pelo grafo de imports TS.
3. Preparar isolamento Git e conjunto indexado somente em fase autorizada ao DevOps. Não copiar `.env*`, dumps, backups, caches, builds ou logs brutos. Preservar todas as alterações alheias. Registrar hash da árvore candidata e diff indexado; nenhum arquivo obrigatório untracked/ignorado.
4. Em clone/worktree limpo, instalar com `npm ci`, gerar cliente com `npx prisma generate` e executar `npm run typecheck`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. O build gera `src/generated/apresentacoes-player-bundle.ts` via script existente. Provisionar configuração segura fora do Git; não reutilizar caches nem `.next` da árvore ativa.
5. Validar navegação autenticada com Probe; Vault deve confirmar somente leitura da estrutura SLA remota. Se faltar estrutura, encaminhar fase APPROVAL antes de aplicar qualquer SQL.
6. Conferir hashes novamente e registrar fim/responsáveis. Reaproveitar evidência nas RMs seguintes apenas para a mesma árvore. Virtus permanece exclusivamente manual.

AUTO_ADJUSTMENT_REQUIRED: candidato isolado/indexado e janela coordenada ainda não existem; aplicação remota das duas migrations SLA e clique autenticado continuam sem evidência.
AUTO_ADJUSTMENT_ACCEPTANCE: DevOps registra árvore reproduzível sem obrigatórios untracked, Forge conclui gates nessa árvore, Probe valida os cliques e Vault confirma estrutura SLA por leitura.

## Adendo da revalidação após limite de atribuição

Ver `recheck.json` e `supplemental-inventory.json`: 83 hashes preservados; matriz ampliada com testes e grupo separado de correções de tipos anteriores. O helper `src/lib/google-calendar/webhook-rate-limiter.ts` está untracked e é requerido pela rota/teste já modificados. Não declarar candidato completo sem incluí-lo quando esse grupo for selecionado. Gates reais novamente reprovados (lint/typecheck/test). Build anterior não é evidência de árvore limpa nem de tipos válidos (`ignoreBuildErrors: true`).

Encaminhamento operacional DevOps explicitamente BLOCKED pela proibição de Git mutável desta sessão. Não houve nova tentativa de isolamento/indexação nem criação de caches de build. Próxima fase precisa de autorização compatível para DevOps preparar o índice; reenviar a mesma fase com proibição de Git mutável não resolve este bloqueio. Não capturar logs brutos, dumps ou arquivos de build no candidato.


## Atualização Nova — estado atual (2026-09-22)

`nova-current-validation.json` substitui as afirmações de estado Git/gates dos adendos anteriores: HEAD atual `c9e491ff7345eab6bbdb04991d74ec7c47f47261`; helper `webhook-rate-limiter.ts` agora rastreado, não mais untracked. Os 83 hashes e o inventário suplementar permanecem iguais. Isso não cria candidato ou congelamento global. Lint, typecheck, tsc e testes reais continuam reprovados; build anterior permanece histórico. Nenhuma aprovação Forge/Probe declarada.

Artefato técnico consumido por DevOps/Forge: matriz e hashes neste diretório, procedimento acima e story vinculada. Artefatos de produto consumidos por usuários CRM/administradores: rotas listadas em Consumo, com links presentes; clique autenticado pendente. Encaminhamento operacional continua explicitamente bloqueado pela proibição de Git mutável. Agendar fase DevOps com autorização compatível; commit/push continuam exclusivos do fluxo manual Virtus.
