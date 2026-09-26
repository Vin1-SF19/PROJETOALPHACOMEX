# Story — Alpha CRM: saídas Radar → Financeiro → Operacional com rastreio da origem

## Status

Ready for Manual Acceptance — código e configuração publicados; cadeia de dados e execução verificadas. Conferência visual autenticada pelo usuário pendente.

## Executor Assignment

- **Executor:** @dev
- **Quality gate:** @qa, com revisão de @architect para identidade e transições entre pipelines.
- **Ferramentas:** testes BPM, gates do projeto, diagnóstico somente leitura do runtime e configuração publicada.

## Story

**Como** usuário do Alpha CRM, **quero** que a conclusão do contrato encaminhe o trabalho para a primeira etapa do pipeline Operacional e que os cards de saída continuem visíveis no pipeline de origem com a localização atual indicada, **para** acompanhar o fluxo sem voltar a editar um card já encaminhado.

## Critérios de aceite

1. Ao alcançar a última etapa do Financeiro com o contrato concluído, a automação publicada encaminha o caso à **primeira etapa ativa do pipeline Operacional**, usando a configuração de saída. A ação é executada de fato no fluxo real; falhas são registradas e visíveis para diagnóstico.
2. O encaminhamento preserva o vínculo entre o card Financeiro e o card Operacional. Repetir o evento ou reprocessar a execução não cria card Operacional duplicado para o mesmo encaminhamento nem perde o vínculo.
3. Após a saída Radar → Financeiro, o card Radar continua aparecendo na etapa de saída do Radar. Ele fica bloqueado para edição e movimentação, visualmente mais opaco e com uma tag que mostra o **pipeline e a etapa atuais do card Financeiro vinculado**.
4. Após a saída Financeiro → Operacional, o card Financeiro continua aparecendo na etapa de conclusão do Financeiro. Ele fica bloqueado para edição e movimentação, visualmente mais opaco e com uma tag que mostra o **pipeline e a etapa atuais do card Operacional vinculado**.
5. A tag acompanha mudanças posteriores de etapa no pipeline de destino sem exigir edição no card de origem. A relação entre origem e destino é determinada pelos vínculos persistidos, não por nome de empresa ou por rótulo de etapa.
6. O bloqueio é aplicado também pelo servidor: ações diretas de salvar ou mover um card de origem já encaminhado não contornam a apresentação da interface. A visualização do card e de seu histórico continua disponível.
7. A automação, o bloqueio e a tag respeitam as permissões existentes de cada pipeline e não expõem dados de um card de destino a quem não pode vê-lo. A ausência de destino válido ou uma falha de criação mantém a origem em estado diagnosticável, sem indicar falsamente que o encaminhamento foi concluído.
8. A correção cobre o cenário que falhou no teste do usuário, incluindo a verificação de gatilho, versão publicada, execução/erro, evento de entrada na última etapa e destino configurado. Um teste integrado demonstra a sequência Radar → Financeiro → Operacional e o estado das duas origens.
9. O card Operacional criado aparece em Boas-vindas para uma conta com acesso ao pipeline e à etapa conforme as permissões configuradas. O nome da etapa não impõe uma restrição adicional fixa a Admin; contas administrativas globais, incluindo TI, seguem a mesma regra das demais etapas.
10. Nos pipelines recriados pela UI, a entrada em Fechado da Revisão de Radar cria um card vinculado na etapa inicial ativa do Financeiro. O Radar permanece visível, atenuado e com a localização atual do destino; o vínculo evita duplicação.
11. O arrasto solta o card na coluna sob o ponteiro, sem oscilar com a própria prévia. Destinos anteriores à etapa atual não movem o card nem exibem erro. O servidor também rejeita regressões.
12. O painel lateral mostra apenas a etapa atual e os destinos posteriores permitidos. O movimento aparece imediatamente no board após soltar, enquanto a confirmação e a atualização dos cards acontecem em segundo plano.
13. Nos pipelines recriados pela UI, a entrada em Concluido do Financeiro cria um card vinculado em Boas vindas do Operacional, sem duplicar um destino já vinculado.
14. Em Configurações → Automações, o usuário pode editar essas automações de encaminhamento e escolher visualmente outra etapa de origem, o pipeline e a etapa de destino, vínculo com a origem e prevenção de duplicata, sem editar JSON.

## Escopo e decisões registradas

- **Fonte do pedido:** mensagem do usuário nesta sessão: encaminhar contrato concluído para o início do Operacional e manter as duas saídas visíveis, bloqueadas, opacas e com tag de localização atual.
- **[AUTO-DECISION] Interpretação de “redirecionar”:** usar o mecanismo existente de criação de card em outro pipeline, com vínculo ao card de origem, porque o usuário quer que o card original permaneça na etapa de saída. Confirmar no inventário e evitar converter o card de origem em card do destino.
- **[AUTO-DECISION] Momento exato do gatilho:** identificar a condição publicada de “contrato concluído” antes de definir o evento. O nome da última etapa, isoladamente, não comprova conclusão; não criar regra por texto de etapa.
- **[AUTO-DECISION] Situações sem destino:** apresentar falha de encaminhamento com diagnóstico; o card não pode exibir tag de destino inexistente. Reprocessamento deve ser seguro.
- **Dependência de configuração:** antes de publicar ou alterar automação/arestas no Turso, seguir o checkpoint Vault do `AGENTS.md`: inventário, plano explícito, backup completo verificado com até 48 horas e confirmação específica do usuário para esta mutação. Aprovação anterior para outra etapa não cobre esta publicação.

## Tarefas / subtarefas

- [x] **Diagnosticar o caminho real** (AC 1, 8): inventariar etapas, versão publicada, eventos, execuções, vínculos e o card testado. A causa é a ausência de automação Financeiro → Operacional; o board também ocultava o card concluído.
- [x] **Preparar o encaminhamento Financeiro → Operacional** (AC 1, 2, 7, 8): script declarativo com destino ativo, vínculo, deduplicação e reprocessamento delimitado do evento do card testado. Publicação e execução real pendentes de aprovação.
- [x] **Definir estado de saída do card de origem** (AC 3–7): derivar bloqueio e localização do vínculo; guard de servidor para card de etapa final encaminhado/concluído.
- [x] **Atualizar board e modal** (AC 3–5, 7): card atenuado, tag de pipeline/etapa ou localização restrita, indicação de encaminhamento pendente e controles indisponíveis.
- [x] **Testar localmente** (AC 2–7): 3.830 testes passaram; o teste do board verifica a atualização da tag após a mudança de etapa do destino. Execução real e cadeia completa dependem da publicação protegida.
- [x] **Publicar configuração protegida** (AC 1, 8): após Vault, backup verificado e aprovação específica, publicar e verificar execução/vínculo; gates locais concluídos.
- [ ] **Publicar o encaminhamento Financeiro → Operacional dos pipelines recriados** (AC 13): inventariar, obter relatório Vault, verificar backup recente, receber confirmação específica e publicar uma versão ativa auditável.
- [x] **Expor o encaminhamento no editor visual** (AC 14): configurar origem, destino, vínculo e deduplicação pelo formulário de Automações.

## Dev Notes

- `src/lib/bpm/automacoes/central-schemas.ts` já aceita `CRIAR_CARD_OUTRO_PIPELINE` com `pipelineId`, `etapaId`, `vincularAoOriginal` e `somenteSeNaoExistirAtivo`. `src/lib/bpm/automacoes/central-runtime.ts` cria `BpmCardVinculo` e publica `CARD_CRIADO`; deduplicação atual por empresa/pipeline/estado exige revisão para o cenário deste pedido.
- `src/lib/bpm/automacoes/migracao-hardcoded.ts` possui precedente de criação vinculada Comercial/Radar → Financeiro. O fluxo deve respeitar a configuração publicada; não reintroduzir lógica financeira por rótulo no runtime.
- `src/lib/bpm/transicao-command.ts` é o comando canônico de movimento. `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md` documenta retirada de guardas financeiras fixas e uso de arestas/requisitos publicados.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` renderiza cards e movimento. `src/actions/bpm/Cards.ts` salva e consulta cards. Inspecionar os contratos atuais de leitura e autorização antes de definir a projeção da tag.
- `prisma/schema.prisma` contém `BpmCardVinculo` (`cardOrigemId`, `cardDestinoId`, par único). A necessidade de migration **não está estabelecida**; preferir os modelos existentes após diagnóstico.
- Inventário Turso de 25/09/2026: o pipeline `comercial` é **Revisão de Radar** e sua etapa final `Fechado` já cria Financeiro e o pipeline `radar` antigo/inativo. O Financeiro `Concluídos` tem 1 card `CONCLUIDO`, evento `CARD_MOVIDO` em 17:44:46 UTC e **nenhuma** automação para Operacional. A consulta do board filtrava somente `ATIVO`, ocultando esse card. O Operacional tem etapa inicial `Boas-vindas` e nenhum card.
- O plano somente leitura `scripts/bpm-handoff-config.mts` cria a automação na saída final Financeiro → entrada Operacional, arquiva o nó antigo do Radar inativo na automação Comercial e delimita o reprocessamento ao único evento de conclusão do card testado. O código preserva vínculos quando o destino ativo já existe e ignora destino de pipeline inativo.
- Reteste do cadastro informado pelo usuário: empresa `501` possui cadeia Comercial `cmufv344o00000bgmb9vp1h4p` → Financeiro `cmugxle5800060agmhtfqtnjg` → Operacional `cmuhb951900040agmeci9evnw`. O destino está ATIVO em Boas-vindas, mas era ocultado da conta TI responsável pela origem por um bloqueio fixo de nome/role no servidor; o card Operacional foi atribuído ao Admin. A correção remove o bloqueio fixo e usa as permissões e vínculos existentes.
- Vault: backup completo dedicado `database-backups/pre-change/painelalpha_turso_pre_change_financeiro_operacional_2026-09-25T18-18-55-914Z.db`, restauração verificada (331 tabelas, 171.450 linhas, FK=0, integridade OK), SHA-256 `ddd7da3b6410e0364ca33834657f404b09e6104c7a4d0bb4693888367c3a9dfd`. Snapshot seletivo `database-backups/pre-change/financeiro-operacional-config-before-2026-09-25T18-19-11-189Z.json`. Nenhuma mutação aplicada.
- `docs/stories/story-financeiro-novo-contrato.md` define a entrada vinculada Radar → Financeiro. `docs/stories/story-rm-2026-fe6c53-desenho-pipelines.md` define `BpmTransicaoEtapa` como autoridade única e saídas explícitas.
- O arquivo `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no checkout durante o draft; o contexto cruzado foi obtido das stories e do diagnóstico acima.

## Testing

- Testes unitários do gatilho, vínculo e leitura da localização; integração do executor e dos comandos de salvar/mover; testes React do board/modal e teste de fluxo autenticado com os três pipelines.
- Cenário principal: Radar concluído cria Financeiro; Radar permanece visível e bloqueado; Financeiro concluído cria Operacional na primeira etapa; Financeiro permanece visível e bloqueado; a mudança de etapa Operacional atualiza a tag no Financeiro.
- Cenários adversos: evento duplicado, card destino ativo preexistente, destino ausente/inativo, automação despublicada/falha, chamadas diretas ao servidor e permissão insuficiente.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integração, com API, Frontend e configuração persistida; complexidade alta pela cadeia entre pipelines e idempotência.
- **Specialized Agents:** @dev implementa; @architect revisa vínculo e estado; @qa valida testes; @ux-expert revisa bloqueio/tag; Vault antes de mutação protegida; @github-devops em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e review; Pre-PR (@github-devops): regressão de transições e autorização; Pre-Deployment (@github-devops): evidência Vault, configuração publicada e rollback.
- **Self-Healing (Story 6.3.3):** @dev light, 2 iterações/15 min, corrige CRITICAL; @qa full, 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** idempotência e vínculo correto, bloqueio de mutação no servidor, autorização da tag, execução assíncrona e diagnóstico de erro, consistência entre board e detalhe.

## Checklist

- [x] Pedido original e histórias adjacentes consultados; critérios de aceite rastreáveis e testáveis.
- [x] Pontos de código e modelo existentes identificados sem assumir configuração real de produção.
- [x] Checklist de draft aplicado: objetivo/contexto PASS; orientação técnica PARTIAL (inventário de produção pendente); referências PASS; autossuficiência PASS; testes PASS; CodeRabbit PASS.
- [x] Inventário real da automação/etapas e causa da falha registrado.
- [x] Implementação e gates locais concluídos: lint (0 erros, avisos preexistentes), typecheck, 3.830 testes e build passaram. A suíte usou uma cópia temporária do backup como banco local; nenhuma escrita foi feita no banco remoto.
- [x] Configuração publicada após checkpoint Vault e autorização específica do usuário.
- [x] Smoke de dados do fluxo existente: card Comercial concluído ligado ao Financeiro concluído, ligado ao novo card Operacional ativo em Boas-vindas; execução Financeiro → Operacional com SUCESSO, sem duplicidade.
- [ ] Conferência visual autenticada dos dois boards pelo usuário.
- [x] Reteste técnico somente leitura com os dados de produção: a conta TI `42` tem acesso ao pipeline, pode visualizar a etapa configurada e o card `cmuhb951900040agmeci9evnw` é retornado pela consulta do board com o código corrigido.
- [ ] Reteste visual autenticado de Boas-vindas pela conta TI após publicar a correção de visibilidade.
- [x] Configurar e validar Radar Fechado → Financeiro inicial nos pipelines recriados após Vault, backup e confirmação específica (AC 10).
- [x] Corrigir destino do drag, impedir regressão silenciosa e filtrar o painel lateral (AC 11, 12).
- [ ] Publicar e verificar Financeiro Concluido → Operacional Boas vindas nos pipelines recriados após checkpoint Vault (AC 13).
- [x] Expor configuração visual das automações de criação de card em outro pipeline (AC 14).
- [x] Executar lint, typecheck, testes e build nesta revisão; atualizar File List e resultado.

## Dev Agent Record

### File List inicial

- `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md` — esta story.
- `src/lib/bpm/automacoes/central-runtime.ts` — validação do destino ativo e deduplicação com vínculo.
- `src/lib/bpm/ownership.ts`, `src/actions/bpm/Cards.ts` — bloqueio no servidor e projeção dos cards de saída.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — card atenuado/tag e modal somente leitura.
- `scripts/bpm-handoff-config.mts` — plano somente leitura e publicação protegida da configuração.
- `tests/bpm/ownership-security.test.ts`, `tests/bpm/board-polling-react.test.ts` — bloqueio e tag no board.
- `tests/bpm/fechado-ui.test.ts` — expectativa do estilo de arrasto atualizada para cards encaminhados.
- `src/actions/bpm/Dashboard.ts`, `src/actions/bpm/Empresas.ts`, `src/actions/bpm/Tarefas.ts`, `src/actions/bpm/Pendencias.ts` — remoção da restrição fixa de Boas-vindas nas consultas agregadas; perfil de empresa e tarefas agora também filtram pela visibilidade configurada da etapa.
- `src/lib/bpm/transicao-command.ts`, `src/lib/bpm/boas-vindas.ts`, `src/lib/timeline/aggregator.ts` — permissões configuradas como fonte de autorização; nome da etapa preservado somente para alerta visual.
- `tests/bpm/boas-vindas-acesso.test.ts`, `tests/bpm/excluir-card-action.test.ts`, `tests/bpm/pendencias-motor.test.ts`, `tests/bpm/tarefas-checklist-actions.test.ts` — expectativas de autorização e consultas atualizadas.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`, `src/lib/bpm/ordem-etapas.ts`, `src/lib/bpm/transicao-command.ts` — drop pela coluna real, atualização visual imediata e avanço estrito também no servidor.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — painel lateral mostra só destinos posteriores permitidos.
- `src/actions/bpm/AutomacoesCentrais.ts`, `src/lib/bpm/automacoes/central-schemas.ts`, `src/lib/bpm/automacoes/schemas.ts`, `src/lib/validations/bpm.ts` — editor e motor aceitam IDs de etapas criadas pela UI.
- `src/actions/bpm/Cards.ts` — localização exibida no Radar acompanha o destino vinculado quando este segue para outro pipeline visível.
- `tests/bpm/board-polling-react.test.ts`, `tests/bpm/drag-drop-rollback.test.ts`, `tests/bpm/automacoes-central.test.ts`, `tests/bpm/ordem-etapas.test.ts` — regressão do arrasto, ordem e IDs de automação.
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx`, `src/components/bpm/automacoes/AutomacoesWorkspace.tsx` — editor visual de origem/destino do encaminhamento e resumo legível do destino na lista.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft do encaminhamento e persistência visual das saídas | River (@sm) |
| 2026-09-25 | 0.2 | Diagnóstico real, plano Vault e implementação local de bloqueio e localização | Codex |
| 2026-09-25 | 0.3 | Deploy d7b4b600 e publicação protegida no Turso; reprocessamento do evento concluído com sucesso | Codex |
| 2026-09-25 | 0.4 | Diagnóstico do card ABIAN: destino criado, mas oculto da conta TI pelo bloqueio fixo de Boas-vindas; correção local da visibilidade; 512 arquivos e 3.832 testes, lint, typecheck e build aprovados | Codex |
| 2026-09-26 | 0.5 | Drop estável por coluna, avanço sem regressão, atualização visual rápida e suporte a etapas da UI no motor de automações; publicação Radar → Financeiro sujeita ao Vault | Codex |
| 2026-09-26 | 0.6 | Commit e8dc2b84 em produção; automação Radar Fechado → Financeiro Novo Contrato publicada após Vault e confirmação específica | Codex |
| 2026-09-26 | 0.7 | Editor visual das automações entre pipelines; preparação do novo encaminhamento Financeiro → Operacional sujeita a Vault | Codex |

## QA Results

Lint e typecheck passaram; `npm test` passou com 511 arquivos, 3.830 testes aprovados, 4 ignorados e 1 marcado TODO em uma cópia local do backup; build de produção passou. Vercel confirmou deploy do commit `d7b4b600cec2e0cec2f0fd9ecf4394d46adf31de`. A automação Financeiro → Operacional `cmuhb4zog0001oiihhrpkzy2g` executou o evento `cmuh93isd000f0agmn0sjbe1r` com SUCESSO e criou o card `cmuhb951900040agmeci9evnw` em Boas-vindas, vinculado ao Financeiro `cmugxle5800060agmhtfqtnjg`. Um único card ativo da empresa foi encontrado no Operacional. A automação Comercial v3 tem apenas o destino Financeiro.

Na correção de visibilidade do cadastro ABIAN, lint terminou com 0 erros, typecheck e build passaram; `npm test` passou com 512 arquivos e 3.832 testes. Com o código corrigido e leitura do banco de produção, a conta TI `42` tem acesso ao pipeline Operacional, a Boas-vindas e ao card criado. Publicação e conferência visual autenticada pendentes.

Na revisão de 26/09, `npm run lint` passou (0 erros, 1.192 avisos preexistentes), `npm run typecheck` passou, `npm test` passou (532 arquivos, 3.929 testes, 4 ignorados e 1 pendente) e `npm run build` compilou e gerou 78 páginas estáticas. O backup Vault dedicado da automação Radar → Financeiro foi verificado antes de solicitar confirmação; nenhum dado de produção foi movido para testar esta revisão.

O deploy de `e8dc2b84` foi concluído e o domínio de produção serviu esse deployment antes da configuração. Vault verificou backup completo pré-mudança em `database-backups/pre-change/` (169.651.748 bytes, 332 tabelas, 179.598 linhas, SHA-256 `e1572a3f21695ab65dec03a3efa3d3e1f113af16098a97bfee05efa1d450fb2a`, integridade OK e zero erros de FK). Após confirmação específica do usuário, uma transação com CAS publicou a automação `c17d0860b8a679fdf3caffac8`, versão 1 ativa, gatilho de entrada em Fechado e ação de criar card vinculado em Novo Contrato do Financeiro com prevenção de duplicata; registrou auditoria e elevou Radar 9→10. Consulta posterior confirmou a definição, a auditoria e zero erros de FK. O disparo com card real permanece para aceite do usuário.

Para o editor visual do encaminhamento Financeiro → Operacional, `npm run lint` passou com 0 erros e 1.192 avisos preexistentes; `npm run typecheck` passou; `npm test` passou com 532 arquivos, 3.929 testes, 4 ignorados e 1 pendente; `npm run build` passou com 78 páginas estáticas. A publicação da configuração dos pipelines recriados ainda depende do checkpoint Vault e de confirmação específica. Há um card que já estava em Concluido antes da publicação; o gatilho de entrada não o processa retroativamente.
