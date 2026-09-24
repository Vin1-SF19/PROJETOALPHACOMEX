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
