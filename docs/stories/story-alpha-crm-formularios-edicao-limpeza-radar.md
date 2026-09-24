# Story: edição livre de formulários e limpeza controlada de Revisão de Radar

## Status

Ready for Review

## Story

Como administrador do CRM, quero editar ou retirar campos e seções obrigatórios no mesmo salvamento, criar obrigações desde o rascunho inicial e usar um editor visual próximo da referência `public/imagemreferenciaFORMULARIO.png`, mantendo a identidade do Painel Alpha.

## Critérios de aceitação

1. Remover um campo ou seção da composição funciona mesmo se havia obrigação publicada. A publicação limpa as obrigações desse campo na mesma transação e mantém valores e anexos existentes.
2. Desativar ou esvaziar formulário limpa as obrigações correspondentes atomicamente; falha de publicação preserva o estado anterior.
3. Um campo presente no rascunho pode receber obrigação antes da primeira publicação. O requisito de avanço continua validado no servidor.
4. A aba apresenta catálogo lateral visível, seleção clara da etapa, área central destacada de montagem/prévia e propriedades acessíveis, com aparência do Painel Alpha e referência visual fornecida.
5. O formulário da etapa `Novos leads` do pipeline `Revisão de Radar` é esvaziado somente após inventário, backup completo verificado e confirmação específica do usuário. A composição e as obrigações são limpas; valores históricos não são apagados por essa ação.
6. Dos cards existentes no pipeline `Revisão de Radar`, apenas o card identificado inequivocamente como `Francisco Emilio de Paula` permanece. A exclusão dos demais exige relatório Vault, dependências identificadas, backup e confirmação específica.

## Tarefas

- [x] Corrigir action e UI para remoção/edição atômica de obrigações.
- [x] Aproximar o layout da imagem de referência.
- [x] Cobrir remoção obrigatória e criação com obrigação em testes.
- [x] Inventariar banco e preparar backup/relatório Vault sem executar limpeza antes da autorização.
- [x] Após autorização, executar limpeza restrita, verificar resultados e documentar rollback.
- [x] Rodar lint, typecheck, testes e build.

## Checklist

- [x] Implementação de código validada com testes focados e suíte completa.
- [x] Relatório Vault e backup verificado.
- [x] Confirmação explícita da limpeza recebida.
- [x] Limpeza de dados validada.
- [x] File List e resultados atualizados.

## File List

- `docs/stories/story-alpha-crm-formularios-edicao-limpeza-radar.md`
- `src/actions/bpm/FormulariosEtapa.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `tests/bpm/formularios-etapa-save.test.ts`
- `tests/bpm/pipeline-editor-react.test.ts`
- `tests/bpm/crm-configuracoes-centralizadas.test.ts`
- `scripts/bpm-limpar-revisao-radar-2026-09-23.mjs`
- `scripts/bpm-auditar-fks-radar-2026-09-23.mjs`
- `scripts/bpm-simular-limpeza-radar-2026-09-23.mjs`
- `scripts/bpm-verificar-limpeza-radar-2026-09-23.mjs`

## Evidências de preparação da limpeza

- Banco: Turso remoto de produção. Pipeline `cmsd9yvb90000dzggt1gjl980`; etapa Novos leads `cmsd9yvb90003dzgg34vyurim`; formulário ativo v31 `form:cmsd9yvb90003dzgg34vyurim`.
- Dry-run do script pontual passou com os 10 cards esperados: preservar Francisco `cmubiy7zm00010agmru1wbspt`, excluir os outros 9 (4 ativos e 5 arquivados). Formulário: 1 seção, 14 componentes, 21 configurações operacionais obrigatórias, 3 vínculos históricos legados.
- Dependências dos 9 cards: 4 agendamentos de automação e 92 eventos de domínio exigem remoção explícita por FK; cascatas também removerão 130 históricos, 45 valores e 12 tarefas. O script aborta se o inventário mudar.
- Evento Google do card de Eduardo: GET remoto de leitura confirmou status `cancelled`; não há nova chamada de cancelamento planejada.
- Backup completo dedicado: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-23T21-02-51-547Z.sql` e manifesto homônimo; 153.352.903 bytes; SHA-256 `820aff68da3c535c1e378fdd387ea2742afe6bde479e648159f57e4df4f42ad4`. Verificação por restauração: 331 tabelas, 158.919 linhas, integrity_check e foreign_key_check aprovados.
- Os 3 vínculos em `BpmCampoObrigatorioEtapa` são histórico legado, não fonte operacional; serão preservados para auditoria. Os valores e anexos do card Francisco também serão preservados.
- A confirmação específica do usuário foi recebida em 23/09/2026. O GET remoto mostrou o evento Google já cancelado; nenhuma chamada DELETE ao Google foi necessária.
- A primeira tentativa transacional falhou por FK RESTRICT de `BpmTarefa.cardChecklistId` e foi revertida; o dry-run subsequente confirmou todos os 10 cards e dados intactos. O script passou a remover as 12 tarefas dos cards antes da cascata de checklists. Uma simulação em cópia restaurada do backup apagou 9 cards sem violação de FK e foi revertida localmente.
- A segunda execução no Turso concluiu: 9 cards excluídos, Francisco preservado, formulário ativo v32 com 0 seções/0 componentes e 0 regras operacionais obrigatórias. Os 3 vínculos históricos legados e 15 valores de Francisco permaneceram. `PRAGMA foreign_key_check` retornou 0 violações.
- Rollback se houver necessidade futura: restaurar os registros afetados a partir do backup dedicado em uma cópia isolada e migrá-los seletivamente em ordem de FK após congelar gravações relevantes. Uma restauração completa diretamente sobre o banco vivo poderia sobrescrever gravações posteriores e exigiria plano/consentimento próprios.

## Gates locais

- `npm run lint`: 0 erros, 1192 avisos já existentes.
- `npm run typecheck`: passou.
- `npm test`: 501 arquivos, 3787 testes aprovados, 4 ignorados, 1 todo.
- `npm run build`: passou; avisos preexistentes do módulo PDF Bibble.
- `node scripts/bpm-limpar-revisao-radar-2026-09-23.mjs`: dry-run somente leitura passou com o inventário esperado.
- Validação visual autenticada em navegador ainda pendente.

## Solicitação complementar de 24/09/2026 — restauração dos formulários e separação do card

O usuário pediu retirar do catálogo de “Adicionar seção” os campos com “teste” no nome, manter os campos legados e reconstruir os formulários pela auditoria, preservando a edição pela UI. Também relatou que Tarefas e Procedimentos apareceram misturados no card.

### Critérios de aceitação

1. Campos com “teste” no nome deixam de ser oferecidos no catálogo; valores históricos permanecem recuperáveis. Campos legados continuam disponíveis.
2. O formulário de Novos leads é reconstruído pela última composição legada anterior aos testes, com identidades de campo existentes e edição/publicação normal pela UI. As demais etapas já publicadas permanecem inalteradas.
3. Tarefas derivadas de procedimentos aparecem somente na aba Procedimento do card; tarefas independentes continuam na aba Tarefas. O usuário não cria novos procedimentos pela aba de tarefas.
4. A alteração de dados de produção só ocorre após inventário, backup completo recente, relatório Vault e autorização específica.

### Progresso

- [x] Inventariar seções/campos e versões da auditoria em modo leitura.
- [x] Identificar tarefas derivadas por `cardChecklistId` e separar as abas no card.
- [x] Preparar restauração dos formulários e arquivamento seguro dos campos de teste.
- [x] Confirmar escopo de produção após relatório Vault e executar somente se autorizado.
- [x] Rodar lint, typecheck, testes e build.

### File List complementar

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx`
- `src/lib/bpm/tarefas-card.ts`
- `tests/bpm/tarefas-card.test.ts`
- `tests/bpm/tarefas-tipo.test.ts`
- `scripts/bpm-restaurar-formularios-radar-2026-09-24.mjs`

### Inventário e plano Vault complementar

- Ambiente: Turso remoto de produção; pipeline Revisão de Radar `cmsd9yvb90000dzggt1gjl980`; etapa Novos leads `cmsd9yvb90003dzgg34vyurim`.
- Formulário atual v34: duas seções recentes, três componentes. Somente esta etapa foi editada nos 31 logs de `formulario_etapa`; os demais formulários publicados continuam com suas composições antigas.
- Snapshot de auditoria v2 anterior aos testes: “Dados da etapa” com Qualificação, Canal de origem, Nome do responsável, CNPJ, Radar pretendido e Confirmar serviço; “Acompanhamento” com Próximo contato e Procedimentos da etapa. As identidades dos seis campos e dos oito componentes são preservadas ao restaurar; o editor da UI continuará publicando novas alterações.
- O backup antigo de 19/09 tinha quatro obrigações em Novos leads (Nome do responsável, CNPJ, Radar pretendido e Confirmar serviço), enquanto a configuração atual não tem nenhuma. O script restaura a composição e mantém as obrigações atuais zeradas, para não bloquear o único card restante; elas poderão ser ajustadas na UI. Os 26 campos experimentais não possuem obrigações nem requisitos de avanço ativos.
- Catálogo do pipeline: 55 campos, 29 legados anteriores a 21/09/2026 e 26 campos experimentais criados desde então, dos quais 22 têm `test` ou `teste` no nome. Os outros quatro são “texto curto”, “acompanhamento 2”, “cnpj2” e uma cópia recente de “CNPJ”. O plano arquiva os 26, preservando todos os valores históricos e sem remover as definições do banco.
- Dois componentes atuais de Novos leads usam campos experimentais; nenhum deles está em formulário de outra etapa. Há duas tarefas derivadas de procedimentos no banco; a separação do card usa `cardChecklistId` e não muda esses dados.
- Backup completo novo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-24T12-33-39-250Z.sql`, 153.246.206 bytes, SHA-256 `4ef2c455f044db8bc331074c38fabf6c6fe8a9be76e2f996577bc707506e8d30`. Restauração isolada validou 331 tabelas, `integrity_check=ok` e zero violações de FK. Backup e manifesto são ignorados pelo Git.
- Script restrito faz dry-run por padrão e bloqueia execução se versão/inventário mudarem. Simulação da mesma sequência de exclusão/recriação de seções e arquivamento sobre cópia isolada do backup: 2 seções, 8 componentes, 26 campos arquivados e zero violações de FK.
- O script trava a identidade e o nome dos 26 campos por hash, verifica ausência de obrigação/requisito e deixa intactos os dados históricos. A execução direta por CLI ainda não cria linha de auditoria da aplicação, pois essa tabela exige a identidade autenticada de um administrador; script, backup e inventário documentam esta operação separadamente.
- Rollback previsto: restaurar seletivamente o formulário v34 e o estado ativo dos 26 campos a partir do backup em uma operação transacional separada; restauração integral no banco vivo exige congelar gravações e novo consentimento porque sobrescreveria alterações posteriores.
- Em 24/09/2026, o usuário autorizou explicitamente arquivar os 26 campos recentes, inclusive os quatro sem “teste” no nome, restaurar a composição legada e manter as obrigações zeradas. Dry-run repetido imediatamente antes da execução confirmou formulário v34 e os 26 campos. A execução transacional remota concluiu.
- Verificação independente após execução: formulário ativo v35 com 2 seções (“Dados da etapa” e “Acompanhamento”), 8 componentes e 6 campos legados; 26 campos recentes inativos; zero obrigações operacionais; 15 valores históricos dos campos arquivados preservados (15 antes e depois); 15 valores do card Francisco preservados; somente Francisco continua no pipeline; `PRAGMA foreign_key_check` sem violações.

### Gates da solicitação complementar

- `npm run lint`: 0 erros, 1192 avisos preexistentes.
- `npm run typecheck`: passou.
- `npm test`: 502 arquivos, 3788 testes aprovados, 4 ignorados, 1 todo.
- `npm run build`: passou com os avisos preexistentes do módulo PDF Bibble.
- Dry-run do script e simulação local do backup: passaram.

## Solicitação de 24/09/2026 — requisitos visíveis ao mover o card

Ao mover Agendar reunião → Reunião Agendada, a configuração persistida da etapa de destino exige Radar pretendido, Estado e Vendedor responsável. O card aberto apresenta apenas o formulário da etapa de origem, e o botão de avanço chama `MoverCardBpm` sem recolher os campos da transição. Estado é um campo compartilhado do Financeiro, marcado obrigatório e somente leitura na etapa de destino.

### Critérios de aceitação

1. Antes de mover, o card consulta os requisitos da transição. Campos pendentes e editáveis aparecem para preenchimento e são enviados atomicamente com a mudança de etapa.
2. Campo pendente somente leitura exibe o motivo e direciona o administrador para a configuração da etapa; o usuário não fica diante de uma mensagem sem campo acessível.
3. O editor de Campos e formulários permite desativar obrigações já publicadas mesmo quando o campo está atualmente somente leitura. Ativar obrigação para campo não editável continua bloqueado no servidor.
4. As regras são lidas da configuração persistida de cada pipeline/etapa. A edição conserva IDs, valores existentes e os demais campos compartilhados.

### Tarefas

- [x] Inventariar o formulário e as configurações da transição em produção sem escrita.
- [x] Expor os requisitos na UI e salvar valores pela action canônica.
- [x] Permitir limpar regras legadas de campos somente leitura na UI.
- [x] Testar fluxo de transição e editor; rodar gates do projeto.

### File List complementar

- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `tests/bpm/autosave-recovery-react.test.ts`
- `tests/bpm/formularios-etapa-save.test.ts`
- `tests/bpm/transicao-requisitos-card-react.test.ts`

### Evidência da solicitação

- Inventário somente leitura do Turso: os três campos pendentes estão em `BpmCampoEtapaConfig` de Reunião Agendada com `obrigatorio=1`; todos têm componente no formulário publicado da etapa. Radar pretendido e Vendedor responsável são editáveis; Estado é campo compartilhado com Financeiro, somente leitura global e na etapa. Não há `BpmRequisito` ativo para esses três nomes.
- O card consulta `ObterRequisitosTransicaoBpm` após confirmar seus autosaves. Se há campos pendentes, oferece editor antes do movimento; `SalvarRequisitosEMoverCardBpm` grava valores editados e move atomicamente. Campo somente leitura mostra acesso direto ao editor do pipeline, selecionando etapa e campo pela URL.
- A UI de Campos e formulários agora permite desligar uma obrigação marcada mesmo em campo somente leitura. O servidor continua rejeitando ativação de obrigação em campo inacessível. Nenhuma configuração de produção foi alterada automaticamente.
- Testes focados cobrem preenchimento e movimento, bloqueio de campo somente leitura e remoção de obrigação legada. `npm run lint` passou com 0 erros e 1192 avisos existentes; `npm run typecheck` passou; `npm test` passou com 503 arquivos e 3791 testes aprovados, 4 ignorados e 1 todo; `npm run build` passou com os avisos preexistentes do módulo PDF. Validação autenticada em navegador ainda pendente.

## Solicitação de 24/09/2026 — obrigações da entrada em Reunião Agendada

O usuário esclareceu que Radar pretendido e Estado não devem bloquear a entrada nessa etapa. Estado é a UF canônica do cliente e está vazia no card de Francisco. Vendedor responsável permanece um campo de texto separado do responsável e dos membros do card, e continua obrigatório.

### Checklist

- [x] Confirmar em leitura a origem, o valor e as três regras persistidas da etapa.
- [x] Retirar somente as obrigações de Radar pretendido e Estado na etapa Reunião Agendada, preservando Vendedor responsável.
- [x] Registrar auditoria com a conta indicada pelo usuário e verificar versões, regras e chaves estrangeiras após a transação.
- [x] Validar a cópia explicativa do editor e executar os gates do projeto.

### Evidência e operação

- Alteração pontual de configuração em produção, sem mudança estrutural ou mutação em massa: `BpmCampoEtapaConfig.obrigatorio` passou de 1 para 0 apenas em `alpha.radar.pretendido` e `alpha.estado` para a etapa `cmsd9yvb90005dzgg8fj8vzeu`. `alpha.vendedor.a` permaneceu em 1.
- Formulário da etapa avançou de v2 para v3; `BpmPipeline.configVersion`, de 76 para 77. Auditoria `72a74a43-5031-45ee-b164-280b58333a10`, `adminId=8` (Vinicius de Souza Floriano, conta indicada pelo usuário). Verificação independente encontrou as duas regras desligadas, Vendedor responsável obrigatório e zero violações de FK.
- Para reverter, o administrador pode reativar as duas obrigações no editor de Campos e formulários; o estado anterior e o novo estão no registro de auditoria. Nenhum valor do card ou do cadastro do cliente foi alterado.
- A legenda do editor foi ajustada para explicar que “Obrigatório na etapa” também bloqueia transições. O editor já oferece controles separados para obrigação na etapa, entrada e saída.
- Gates após a alteração: lint sem erros, typecheck, 504 arquivos e 3.793 testes aprovados na suíte completa e build concluída.

## Solicitação de 24/09/2026 — recuperar acompanhamento e tornar o catálogo visível

O usuário removeu a composição de acompanhamento da etapa Agendar reunião e pediu a volta da data e hora, o inventário das opções disponíveis no sistema e uma interface de Campos e formulários mais clara e agradável.

### Critérios de aceitação

1. Restaurar o componente de agendamento a partir da auditoria, preservando os dois campos publicados posteriormente, os valores dos cards e o evento do Google Meet.
2. Exibir no editor todos os componentes especializados registrados para formulários, permitindo adicionar os compatíveis com a etapa e mostrando a razão dos indisponíveis ou já usados.
3. Manter o editor de Campos e formulários focado nos controles da etapa; áreas próprias do card, como tarefas, histórico, anexos e navegação, permanecem nas suas abas dedicadas.
4. Apresentar campos, componentes e seções com hierarquia visual, estado de disponibilidade e ações identificáveis em desktop e mobile.
5. Continuar usando a validação e a publicação canônicas do formulário, sem alteração de schema ou migração.
6. Remover um bloco operacional exige confirmação que explica o efeito no card e a preservação dos dados já salvos.

### Checklist

- [x] Inventariar o formulário atual, a auditoria e o valor da reunião de Francisco em leitura.
- [x] Restaurar Acompanhamento com verificação de versão e auditoria.
- [x] Expor catálogo e redesenhar a composição na UI.
- [x] Validar testes, lint, typecheck e build.

### File List complementar

- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/lib/bpm/formularios-etapa.ts`
- `tests/bpm/formulario-renderer.test.ts`
- `docs/stories/story-alpha-crm-formularios-edicao-limpeza-radar.md`

### Evidência de recuperação

- O card Francisco mantinha `dataReuniao=2026-09-24T14:00:00Z` e `googleEventId`; o formulário v4 da etapa Agendar reunião estava ativo, mas continha só dois campos e nenhuma seção Acompanhamento.
- O registro de auditoria da versão 2 continha Acompanhamento com Agendamento de reunião, Procedimentos da etapa e Próximo contato. A restauração pontual acrescentou essa seção sem substituir os campos atuais: formulário v5, `configVersion` 84, auditoria `fe925945-d169-4d82-8876-be3556575f07`, zero violações de FK.
- O catálogo do CRM tem 16 tipos de campo e sete blocos operacionais do formulário aberto. O usuário esclareceu que tarefas, histórico, anexos e navegação já têm áreas próprias; elas foram retiradas do catálogo visual. O card fechado mantém um link para seu editor dedicado. Os blocos de outra etapa aparecem no inventário, mas a action canônica mantém a restrição de capability publicada para evitar ações incompatíveis.
- O editor ganhou cabeçalho, estados de disponibilidade, itens de composição com hierarquia visual, confirmação antes de retirar blocos operacionais e link contextual para o card do Kanban. `npm run lint` passou com zero erros e 1192 avisos preexistentes; `npm run typecheck` passou; `npm test` passou com 504 arquivos e 3796 testes aprovados, quatro ignorados e um todo; `npm run build` passou após a confirmação de retirada.

## Solicitação de 24/09/2026 — referências inválidas em Reunião Agendada

O usuário relatou “Componente indisponível: O campo não está visível/aplicável na configuração canônica da etapa” nos cards de Reunião Agendada. Leitura do Turso identificou `Radar atual` e `Status da sede` inativos, ainda publicados como componentes do formulário. As mesmas referências aparecem também em Boas-vindas e Em análise do pipeline Operacional: seis componentes em três formulários, todos sem obrigações ou valores de card associados.

### Critérios de aceitação

1. Os componentes que apontam para esses dois campos inativos deixam de aparecer nos três formulários, sem alterar campos ativos, valores, tarefas ou demais seções.
2. A publicação registra nova versão e auditoria; uma verificação independente confirma zero referências inválidas e zero violações de FK.
3. O servidor impede desativar um campo ainda usado por formulário ativo e informa ao administrador que deve retirá-lo do formulário primeiro.

### Checklist

- [x] Preparar limpeza restrita com inventário, backup e verificação de versão.
- [x] Executar a limpeza pontual e conferir versões, auditoria e integridade.
- [x] Implementar guarda no servidor e teste de regressão.
- [x] Rodar lint, typecheck, testes e build; atualizar File List.

### File List complementar

- `src/actions/bpm/Campos.ts`
- `tests/bpm/campos-configuraveis-actions.test.ts`
- `scripts/bpm-limpar-componentes-inativos-2026-09-24.mjs`
- `docs/stories/story-alpha-crm-formularios-edicao-limpeza-radar.md`

### Evidência da correção

- Turso remoto: componentes inválidos identificados por leitura direta. `Radar atual` e `Status da sede` tinham `BpmCampo.ativo=0` e `BpmCampoEtapaConfig.visivel=1` nos três formulários. Havia 6 referências, 0 valores de card, 0 obrigações da etapa e 0 requisitos ativos para esses campos.
- Backup dedicado em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-24T18-13-27-754Z.sql`, SHA-256 `2c488d2988762638abc717f6d6c25d948cd76c93a37ba4e9c343a4eb812a88ba`, 154.030.961 bytes; restauração isolada validada com 331 tabelas e 159.152 linhas, integridade e FKs aprovadas.
- Dry-run do script confirmou 6 componentes e 3 formulários sem valores. A execução pontual removeu apenas as seis referências, preservando os dois campos desativados e quaisquer dados históricos. Formulário Reunião Agendada v3→v4; Boas-vindas e Em análise v2→v3. `configVersion` de Revisão de Radar 85→86 e de Operacional 3→4.
- Auditorias `19767bdc-a12c-475c-9137-c0eac14e96b8` e `d8f6e2e4-f378-47f9-937a-6941b63b896b` registraram as referências removidas. Leitura independente: 0 referências inválidas em formulários ativos, 0 violações de FK.
- Rollback: reintroduzir seletivamente os seis componentes a partir da auditoria/backup, somente após reativar ou remapear os campos; uma restauração total do banco sobrescreveria gravações posteriores.
- Gates: `npm run lint` passou com 0 erros e 1.192 warnings existentes; `npm run typecheck` e `npm run build` passaram. A primeira suíte completa sofreu timeouts ambientais em dois testes não relacionados; ambos passaram isolados. `npm test -- --testTimeout 60000` passou com 505 arquivos, 3.808 testes aprovados, 4 ignorados e 1 todo. O teste focado de gestão de campos passou com 19 casos.
