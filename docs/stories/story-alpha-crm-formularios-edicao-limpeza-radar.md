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
