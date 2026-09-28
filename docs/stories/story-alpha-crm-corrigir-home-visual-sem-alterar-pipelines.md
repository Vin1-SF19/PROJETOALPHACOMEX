# Story: Alpha CRM — corrigir Home visual sem alterar pipelines

**Status:** Ready for Review

## Story

Como usuário autorizado do Alpha CRM, quero uma Home clara com acesso aos módulos disponíveis, para navegar no CRM sem perder o comportamento dos pipelines.

**Origem:** pedido do usuário nesta sessão após a intervenção da sessão OpenCode `ses_f172a510bffesy1kR4u8mRQUiw`. Esta story trata da correção visual e da regressão relatada no pipeline; não autoriza mudança de dados ou estrutura de banco.

## Critérios de aceite

1. A Home em `/PainelAlpha/AlphaCRM` apresenta o título **Alpha CRM**.
2. Os quatro cards de indicadores (KPI) no topo são substituídos por **três cards de navegação** para destinos existentes do CRM. Cada card é um link funcional, acessível por teclado e coerente com as permissões do usuário; destinos administrativos não são expostos a quem não tem acesso.
3. Os pipelines continuam acessíveis a partir da Home conforme as permissões existentes. A aparência e o funcionamento do board, das etapas e dos cards em `/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` permanecem íntegros; mudanças visuais da Home não se propagam ao board.
4. O layout compartilhado do CRM mantém o comportamento esperado sem sidebar interna: fundo, largura, espaçamento, navegação e abertura das páginas filhas funcionam na Home e nas demais rotas do CRM, inclusive em telas estreitas.
5. Navegações e consultas com espera perceptível apresentam feedback de carregamento real enquanto a operação está pendente, encerrando o feedback ao concluir ou falhar. Não se exibe estado permanente de “Ao vivo” sem relação com uma operação ou conexão verificável.
6. A correção preserva as verificações de acesso existentes para pipelines e páginas administrativas. Usuários sem permissão não obtêm links ou conteúdo restritos pela nova Home ou pelo layout.
7. As páginas internas do CRM exibem **Voltar** no canto superior esquerdo. Páginas internas de Configurações retornam à lista de Configurações; as demais retornam à Home, inclusive quando abertas diretamente. A Home não exibe um botão que aponte para si mesma.

## Tarefas / subtarefas

- [x] Conferir o estado anterior e atual da Home, do layout compartilhado e do board para localizar as regressões relatadas (AC 1–4).
- [x] Corrigir título, cards de navegação e estados de carregamento da Home (AC 1, 2, 5, 6).
- [x] Ajustar somente o comportamento necessário do layout compartilhado sem sidebar e conferir as rotas filhas no código (AC 3, 4, 6).
- [x] Adicionar retorno visível às páginas internas e verificar os destinos por rota (AC 7).
- [ ] Conferir visualmente e por testes os perfis com e sem acesso administrativo, a Home responsiva e pelo menos um pipeline autorizado (AC 2–6).
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`; registrar os resultados. Atualizar checklist e File List antes de concluir.

## Dev Notes

- Pontos de entrada existentes: `src/app/PainelAlpha/AlphaCRM/page.tsx`, `DashboardClient.tsx` e `CRMLayoutClient.tsx`. O board usa `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/`.
- O commit `3b44c1a1` alterou `DashboardClient.tsx` e `CRMLayoutClient.tsx` ao remover a sidebar e incluir atalhos. Usar o histórico como referência de investigação, sem reverter em bloco alterações posteriores.
- A Home atual tem quatro KPIs e atalhos para Tarefas, Pendências e Configurações; Configurações é restrita a admin. **[AUTO-DECISION]** Destinos dos três cards: reutilizar rotas existentes e manter o controle de acesso atual; a formulação do pedido não define três destinos específicos, então não criar novas rotas nem liberar administração para completar uma contagem visual.
- Não alterar modelos, migrations, seeds, ações de mutação ou dados do CRM nesta story.

## Testes e qualidade

- Verificar título e três cards de navegação na Home; testar foco/ativação por teclado, carregamento real e apresentação em largura móvel.
- Verificar perfil admin e perfil comum; confirmar que os links e as páginas mantêm a autorização.
- Abrir um pipeline autorizado e confirmar renderização, etapas, cards, abertura de card e navegação, sem alterações visuais não solicitadas no board.
- **CodeRabbit Integration:** Frontend; @dev na implementação e pré commit, @ux-design-expert na revisão visual e @qa na validação. Foco em regressão do layout, acessibilidade, responsividade e permissões. Self-healing @dev: light, até 2 iterações/15 minutos para CRITICAL; HIGH documentado. Revisão @qa: full conforme configuração do projeto.

## Checklist de conclusão

- [ ] Critérios de aceite validados em navegador autenticado (Home e pipeline).
- [x] `npm run lint` passou (0 erros; warnings preexistentes).
- [x] `npm run typecheck` passou.
- [x] `npm test` passou (539 arquivos; 3983 testes passaram, 4 ignorados, 1 pendente).
- [x] `npm run build` passou.
- [x] File List atualizada com os arquivos realmente alterados.

**Validação:** o commit `3b44c1a1` só alterou `CRMLayoutClient.tsx` e `DashboardClient.tsx` no produto. A regressão no board vinha do `max-w-7xl` e do padding impostos pelo layout compartilhado. O board e suas regras não foram editados nesta correção. A renderização em navegador autenticado permanece para revisão visual; o build e os testes automatizados passaram.

**Retorno interno:** `crm-back-destination.test.ts` passou (3 testes). O botão usa links para pais conhecidos da navegação, permitindo voltar mesmo em acesso direto à rota.

## File List

- `docs/stories/story-alpha-crm-corrigir-home-visual-sem-alterar-pipelines.md` — criação da story.
- `src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx` — restaura o contêiner visual do CRM sem sidebar e sem restringir o board.
- `src/app/PainelAlpha/AlphaCRM/crm-back-destination.ts` — define o destino de retorno para páginas internas.
- `src/app/PainelAlpha/AlphaCRM/DashboardClient.tsx` — substitui indicadores por cards de navegação, preserva os pipelines e corrige a visibilidade administrativa.
- `src/app/PainelAlpha/AlphaCRM/page.tsx` — adiciona skeleton durante o carregamento real do dashboard.
- `tests/bpm/crm-back-destination.test.ts` — cobre retorno da Home, páginas e configurações.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Story de correção visual da Home e proteção dos pipelines | River (@sm) |
| 2026-09-28 | 0.2 | Botão Voltar nas páginas internas do CRM | Codex |
