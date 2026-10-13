# Story: Rolagem interna das colunas do Alpha CRM

## Status

Ready for Review — implementação concluída; validação visual pendente e limitações dos gates registradas abaixo.

## História

Como usuário do Alpha CRM, quero que as colunas do kanban mantenham altura limitada à área disponível da tela e tenham rolagem interna independente, para acessar muitos cards sem aumentar a página.

## Origem e contexto

Pedido direto do usuário em 2026-10-13: muitos cards em um pipeline estão gerando overflow na página; a rolagem deve ocorrer dentro de cada coluna, mantendo seu tamanho fixo.

[AUTO-DECISION] Altura fixa significa altura limitada ao espaço disponível da tela, independente da quantidade de cards (motivo: atender ao pedido em diferentes tamanhos de janela).

A correção pertence à visualização do quadro do Alpha CRM. Não depende de outra story. A story `story-alpha-crm-chatbotx-chat-card.md` trata do chat dentro do card; sua rolagem é um fluxo separado. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no repositório na preparação.

## Critérios de aceite

1. A quantidade de cards de uma coluna não aumenta a altura da página do CRM nem cria rolagem vertical no documento.
2. As colunas do kanban mantêm altura limitada ao espaço disponível na tela, independente da quantidade de cards.
3. Cada coluna com cards que excedam sua área visível permite rolagem vertical interna até o último card.
4. Rolar uma coluna não altera a posição de rolagem das demais colunas; o cabeçalho da coluna permanece visível.
5. Colunas vazias, com poucos cards e com muitos cards respeitam o mesmo limite de altura, inclusive após redimensionar a janela.

## Checklist

- [x] Identificar a cadeia de layout entre página, quadro e colunas (AC 1–2).
- [x] Limitar a altura do quadro e das colunas ao espaço disponível (AC 1–2, 5).
- [x] Aplicar rolagem vertical apenas na lista de cards de cada coluna (AC 3–4).
- [ ] Conferir colunas vazias, curtas e longas e redimensionamento da janela (AC 1–5).
- [x] Executar os gates do projeto e registrar resultados ou limitações.
- [x] Atualizar status, checklist e File List com os arquivos realmente alterados.

## Dev Notes

Diagnóstico de implementação informado pelo agente responsável: `CRMLayoutClient.tsx` usa raiz `min-h-screen` e `main` com `overflow-auto`; o quadro usa `h-full` sob pai de altura indefinida. Limitar somente a rota `/AlphaCRM/pipeline/[id]` à altura da janela (`h-dvh`), com contêineres flex que aceitem redução (`min-h-0`) e listas de cards com rolagem vertical interna. Aplicar o mesmo limite ao skeleton. Esta story especifica comportamento visual, sem novos contratos de API, variáveis de ambiente ou alterações de banco.

Implementado limite de `100dvh` na rota do quadro, com navegação e cabeçalho ocupando seu espaço e o board preenchendo a área restante. As listas usam rolagem independente e `overscroll-y-contain`; a rolagem horizontal entre etapas continua contida no quadro. O cabeçalho aceita quebra em telas estreitas. O painel de automações possui altura máxima para continuar acessível sem ocupar toda a coluna; skeletons seguem o mesmo limite de altura.

## Validação prevista

Verificar visualmente um quadro com uma coluna que ultrapasse a altura disponível e outra com poucos cards: a primeira deve alcançar seu último card por scroll interno, sem mover a segunda ou a página. Repetir com coluna vazia e janela menor. Verificar abertura e movimentação de cards como regressão do quadro existente.

Gates do projeto: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`. Registrar bloqueios ambientais e falhas preexistentes separadamente. Usar os testes existentes; não adicionar testes que apenas espelhem classes CSS desta alteração de baixo impacto. Nenhum teste foi executado na preparação desta story.

## Resultados da implementação

- `git diff --check`: passou.
- `npm run lint`: passou, sem erros; 1.192 avisos no repositório.
- `npm run typecheck`: passou.
- `npm test`: 599 arquivos passaram e 1 falhou; 4.440 testes passaram, 2 falharam, 4 foram ignorados e 1 está marcado como todo. As duas falhas estão em `tests/builder/embed.test.ts`: esperam `/api/chatbotx/open`, mas recebem `http://localhost:3000/api/chatbotx/open`. Esse módulo não foi alterado nesta correção. Os testes do CRM passaram.
- `NEXT_DIST_DIR=.next-crm-scroll-validation npm run build`: bloqueado antes da compilação por `EPERM` no `prisma generate`, ao copiar `query_compiler_bg.sqlite.js` para `node_modules/.prisma/client/query_compiler_bg.js`.
- Evidências locais: `/tmp/alpha-crm-scroll-VW9rOC/{lint,typecheck,tests,build}.log`.
- Validação visual em navegador autenticado não executada; permanece pendente o cenário de muitos cards, colunas vazias e redimensionamento descrito acima.

## CodeRabbit Integration

- Tipo: Frontend; complexidade baixa; sem tipo secundário.
- Responsáveis previstos: @dev (implementação e revisão pré-commit), @ux-design-expert (rolagem e adaptação da tela); gate: @qa.
- [ ] Pre-Commit (@dev): revisar limites de altura, overflow, acessibilidade da rolagem e regressões de interação.
- Pre-PR e Pre-Deployment: não aplicáveis ao escopo local desta story.
- Self-healing previsto para @dev: light, até 2 iterações / 15 minutos; CRITICAL corrigido, HIGH documentado; MEDIUM e LOW sem correção automática.
- Foco: conteúdo acessível até o último card, cabeçalhos visíveis, redimensionamento e ausência de overflow no documento.

## File List

Arquivos alterados nesta implementação:

- `docs/stories/story-alpha-crm-rolagem-interna-pipelines.md` — registro desta correção.
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` — limite de altura apenas na rota do quadro.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — quadro e colunas.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardSkeleton.tsx` — dimensionamento durante carregamento.

## Validação do rascunho

Checklist `story-draft-checklist.md` aplicado: objetivo/contexto, orientação técnica, referências, autocontenção, orientação de validação e integração CodeRabbit atendidos. Story pronta para implementação; execução e validação funcional permanecem pendentes. Fonte dos requisitos: pedido direto do usuário, sem epic associado.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-10-13 | 1.0 | Story preparada a partir do pedido de rolagem interna. | River (SM) |
| 2026-10-13 | 1.1 | Altura do quadro limitada à tela, rolagem por coluna e skeleton ajustados; resultados dos gates registrados. | Codex |
