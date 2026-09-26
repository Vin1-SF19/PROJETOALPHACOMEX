# Story: Alpha CRM — movimentação entre etapas sem obrigatoriedades hardcoded

## Status

Ready for Review

## Story

Como usuário do Alpha CRM, quero mover um card livremente entre as etapas dos pipelines que criei, para configurar formulários e exigências pela UI no momento adequado.

## Origem e contexto

Pedido explícito do usuário nesta conversa: a movimentação de `Novo Lead` para `Agendar Reunião` falha exigindo `próximo contato`, apesar de não haver formulário configurado para essa exigência. O mesmo princípio vale para todas as etapas do CRM. A implementação deve prevalecer sobre exigências antigas associadas a nomes de etapas, preservando as regras que o usuário configurar na UI e as guardas de autorização e integridade.

## Critérios de aceitação

1. Mover um card de `Novo Lead` para `Agendar Reunião` funciona sem preencher `próximo contato` quando esse campo não estiver configurado como obrigatório pela UI.
2. Nenhuma movimentação entre etapas, em qualquer pipeline, é bloqueada por obrigatoriedade de campo, formulário, checklist, requisito ou transição definida apenas em código por nome/ID de etapa.
3. Campos, formulários, checklists, requisitos e transições explicitamente configurados pela UI continuam a ser aplicados conforme sua configuração persistida.
4. A movimentação continua a verificar autorização do usuário, existência e pertinência do card, pipeline e etapas, e integridade dos dados e do histórico.
5. A interface e a ação de servidor apresentam a mesma decisão de permissão para mover; não mostram exigência hardcoded que o servidor já não aplica.
6. Testes cobrem o caso `Novo Lead` → `Agendar Reunião`, outra movimentação sem configuração obrigatória, uma exigência configurada pela UI e as guardas de autorização/integridade. Gates: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
7. IDs `draft-stage-<uuid>` criados pela UI são aceitos nos dois caminhos de movimentação; IDs inválidos são rejeitados com mensagem legível. A verificação de pertinência ao pipeline e de transição permitida continua no servidor.

## Checklist

- [x] Identificar os bloqueios hardcoded no fluxo de movimentação e as fontes de configuração persistida (AC 1–3).
- [x] Remover os bloqueios hardcoded na ação de servidor e alinhar a interface (AC 1, 2, 5).
- [x] Preservar e verificar configurações explícitas, autorização, integridade e histórico (AC 3, 4).
- [x] Executar testes focados, lint, typecheck e suíte completa; atualizar critérios, checklist e File List (AC 6).
- [x] Aceitar IDs de etapa criados pela UI ao mover e devolver erro legível na validação (AC 7).

## Notas para implementação

- Pedido atual substitui, para movimentação, exigências antigas vinculadas ao nome da etapa. Não remover a capacidade de configurar e exigir regras pela UI.
- Consultar as stories `story-alpha-crm-formulario-unificado-por-etapa.md` e `story-alpha-crm-configuracoes-centralizadas-editor-card.md` para o formulário por etapa e sua configuração. Identificar os pontos exatos de código durante a implementação.
- Esta story não pede alteração de schema, migration, seed, backfill ou mutação em massa.

## Verificação de qualidade planejada

- Executor: @dev. Revisão funcional e de regressão: @qa. Push/deploy: @devops.
- Pre-commit: revisar bloqueios remanescentes e executar testes focados, lint, typecheck, suíte completa e build.
- Pre-PR/deploy, se aplicável: conferir a diferença entre validação configurada e hardcoded e o comportamento em produção.

## File List

- `docs/stories/story-alpha-crm-movimentacao-sem-obrigatoriedades-hardcoded.md` — critérios, checklist e resultados.
- `src/actions/bpm/Cards.ts` — prévia sem guardas por nome de etapa.
- `src/lib/bpm/transicao-command.ts` — remove obrigatoriedades fixas de contato, reunião, transcrição e follow-up; mantém regras persistidas.
- `src/lib/validations/bpm.ts` — aceita IDs de etapas criadas pela UI nos schemas de movimentação.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — arrastar não exige próximo contato fixo.
- `tests/bpm/movimentacao-sem-hardcode.test.ts` — prévia livre, requisitos configurados e IDs de etapa da UI.

## Resultado da verificação

- Teste focado: 5/5 passaram.
- `npm run lint`: 0 erros; 1193 avisos preexistentes.
- `npm run typecheck`: passou.
- `npm test`: 531/531 arquivos; 3925 testes passaram, 4 ignorados e 1 pendente. Uma execução anterior no sandbox falhou em 4 testes de CLI por `EPERM` ao criar subprocessos/socket; a execução fora do sandbox passou.
- `npm run build`: compilação Webpack passou; execução interrompida durante a coleta de dados das páginas a pedido do usuário para avançar ao commit e push.

## Validação do rascunho

- Story draft checklist: objetivo, origem, critérios verificáveis, limites de escopo e testes definidos; pontos exatos de código ficam para inventário inicial do desenvolvimento.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-26 | 0.1 | Story criada a partir do pedido explícito do usuário | River (SM) |
| 2026-09-26 | 0.2 | Removidos bloqueios fixos de movimentação e verificados testes, lint e typecheck | Codex |
| 2026-09-26 | 0.3 | Corrigida validação dos IDs draft-stage e mensagem de erro de movimentação | Codex |
