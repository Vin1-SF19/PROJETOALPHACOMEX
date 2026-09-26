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
8. As etapas de trabalho da Revisão de Radar podem mover cards para qualquer outra etapa ativa; Fechado, Lost, Sem viabilidade, Stand By e Monitoramento são saídas sem movimento de saída. Transições legadas bloqueadas desse pipeline são removidas ou liberadas no banco após o protocolo Vault; novas etapas usam `ehFinal` configurado pela UI para definir saídas, sem mapa fixo por nome.
9. A promoção de lead virtual NoLoss aceita as etapas atuais `draft-stage-<uuid>`, preserva autorização e verificação do destino e mostra erros de entrada legíveis.

## Checklist

- [x] Identificar os bloqueios hardcoded no fluxo de movimentação e as fontes de configuração persistida (AC 1–3).
- [x] Remover os bloqueios hardcoded na ação de servidor e alinhar a interface (AC 1, 2, 5).
- [x] Preservar e verificar configurações explícitas, autorização, integridade e histórico (AC 3, 4).
- [x] Executar testes focados, lint, typecheck e suíte completa; atualizar critérios, checklist e File List (AC 6).
- [x] Aceitar IDs de etapa criados pela UI ao mover e devolver erro legível na validação (AC 7).
- [x] Liberar a matriz de transições da Revisão de Radar preservando as cinco saídas, após relatório Vault, backup e confirmação específica (AC 8).
- [x] Corrigir promoção NoLoss, cobrir os casos e atualizar File List e gates (AC 9).

## Notas para implementação

- Pedido atual substitui, para movimentação, exigências antigas vinculadas ao nome da etapa. Não remover a capacidade de configurar e exigir regras pela UI.
- Consultar as stories `story-alpha-crm-formulario-unificado-por-etapa.md` e `story-alpha-crm-configuracoes-centralizadas-editor-card.md` para o formulário por etapa e sua configuração. Identificar os pontos exatos de código durante a implementação.
- Não há alteração de schema, migration ou seed. A limpeza pontual das transições persistidas da Revisão de Radar segue o protocolo Vault de backup, relatório e confirmação específica.

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
- `src/actions/bpm/Etapas.ts` — novas etapas recebem transições permitidas para etapas ativas, sem criar saída de etapas finais.
- `src/actions/bpm/NolossLeads.ts` — devolve erro de validação legível na promoção.
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` — rascunho de nova etapa segue o mesmo padrão de transições.
- `tests/bpm/pipelines-etapas-admin.test.ts` — cobre criação de etapa com saída final protegida.
- `tests/bpm/promover-noloss-lead.test.ts` — cobre promoção para etapa criada pela UI.

## Resultado da verificação

- Teste focado: 5/5 passaram.
- `npm run lint`: 0 erros; 1193 avisos preexistentes.
- `npm run typecheck`: passou.
- `npm test`: 531/531 arquivos; 3925 testes passaram, 4 ignorados e 1 pendente. Uma execução anterior no sandbox falhou em 4 testes de CLI por `EPERM` ao criar subprocessos/socket; a execução fora do sandbox passou.
- `npm run build`: compilação Webpack passou; execução interrompida durante a coleta de dados das páginas a pedido do usuário para avançar ao commit e push.
- Nesta revisão: testes focados 44/44, `npm run typecheck` passou, `npm run lint` passou (0 erros, 1193 avisos), `npm test` passou e `npm run build` concluiu 78 páginas estáticas.
- Vault: backup completo pré-alteração de 169.657.541 bytes, 332 tabelas e 179.616 linhas, SHA-256 `2854d3feac31f67bd5412e43cc6b8f87b6b9946834d0d401c3260fccc82ccafb`, verificado antes da execução e mantido fora do Git em `database-backups/pre-change/`.
- Turso de produção: confirmação específica recebida; transação 8→9 aplicada com 16 passagens liberadas, 39 bloqueios sem histórico removidos, passagem histórica de Sem viabilidade desativada e Fechado marcado final. Consulta posterior confirmou 33 transições, 32 permitidas, 1 desativada com histórico e nenhuma saída permitida das cinco etapas finais.

## Validação do rascunho

- Story draft checklist: objetivo, origem, critérios verificáveis, limites de escopo e testes definidos; pontos exatos de código ficam para inventário inicial do desenvolvimento.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-26 | 0.1 | Story criada a partir do pedido explícito do usuário | River (SM) |
| 2026-09-26 | 0.2 | Removidos bloqueios fixos de movimentação e verificados testes, lint e typecheck | Codex |
| 2026-09-26 | 0.3 | Corrigida validação dos IDs draft-stage e mensagem de erro de movimentação | Codex |
| 2026-09-26 | 0.4 | Corrigida promoção NoLoss para etapas da UI e abertura padrão de transições em novas etapas, respeitando etapas finais | Codex |
| 2026-09-26 | 0.5 | Limpeza transacional das transições legadas da Revisão de Radar após protocolo Vault e confirmação específica | Codex |
