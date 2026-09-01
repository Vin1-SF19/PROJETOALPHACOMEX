# RM-2026-2403E5 — Correção da saída de Novos Leads

## Status

Ready for Review — código e configuração remota concluídos.

## Objetivo

Manter em **Novos leads** somente Nome do responsável, CNPJ, Radar pretendido,
Próximo Contato e Anotação; exigir apenas os quatro primeiros para sair da
etapa; e fazer UI e validação consumirem o mesmo valor efetivo, inclusive dados
já conhecidos pelas entidades mestres do CRM.

## Critérios de aceite

- [x] O campo em edição perde foco e entra na fila de autosave antes do movimento.
- [x] Falha de persistência impede a chamada de movimento.
- [x] Campos globais podem ser ocultados de uma etapa sem serem apagados ou afetarem outras etapas.
- [x] Campos ocultos não entram na lista de obrigatórios nem na validação residual.
- [x] CNPJ vazio é hidratado por `Cliente.cnpj` na UI e na validação.
- [x] Empresa/cliente e contato principal inequívoco (nome, telefone e e-mail) usam a mesma resolução central.
- [x] Valor local válido/divergente não é sobrescrito silenciosamente.
- [x] Valor apenas hidratado não é copiado para `BpmCardCampoValor` ao salvar outro campo.
- [x] Próximo Contato vazio entra na mesma mensagem de pendências de Novos leads.
- [x] Cards legados usam as mesmas regras sem recriação.
- [x] Criar 16 vínculos de ocultação exclusivamente em Novos leads.
- [x] Remover o vínculo obrigatório de Confirmar serviço exclusivamente em Novos leads.
- [x] Confirmar por leitura remota as pós-condições e os cenários A–F.

## Diagnóstico

`Radar pretendido` e `Confirmar serviço` são `BpmCampo` globais e seus valores
são persistidos em `BpmCardCampoValor.valor`, identificados por `campoId`. Não
havia duplicata de nome/ID no pipeline. O card real auditado possuía Radar
persistido, mas `Confirmar serviço` era string vazia. Além disso, o autosave do
formulário era disparado apenas por `onBlur`: clicar diretamente em avançar
podia executar `flushSaves()` antes de o campo ativo registrar o save. Assim a
tela ainda mostrava o estado React atualizado, enquanto o servidor validava o
valor persistido anterior.

## Configuração final de Novos leads

- Visíveis: Nome do responsável, CNPJ, Radar pretendido, Próximo Contato e Anotação.
- Obrigatórios para sair: Nome do responsável, CNPJ, Radar pretendido e Próximo Contato.
- Opcional: Anotação.
- `Confirmar serviço` e os outros campos globais permanecem cadastrados e com valores preservados, mas ficam ocultos somente nessa etapa.

## Banco e Vault

- A tabela aditiva `BpmCampoOcultoEtapa` já foi criada no Turso durante o diagnóstico.
- A migration idempotente foi versionada para evitar drift em outros ambientes; ela não deve ser executada novamente manualmente no Turso atual.
- O backup anterior foi rejeitado pelo Vault porque todas as colunas eram serializadas como `undefined`.
- O gerador foi corrigido para usar `ResultSet.columns` e capturar schema/dados na mesma transação de leitura.
- Novo backup restaurado e verificado: 261 tabelas, 47.528 linhas, 81.975.630 bytes, SHA-256 `203bf8729583ab7a32d8d24cabdafe9b5333c6c807dff53d83a0478ededafd07`.
- Após confirmação explícita do usuário, foram aplicados 16 vínculos de ocultação e removido o vínculo obrigatório de `Confirmar serviço` somente em `Novos leads`.
- Auditoria remota pós-mutação: 16 ocultos, 3 globais visíveis (Nome do responsável, CNPJ e Radar pretendido), zero obrigação de `Confirmar serviço`, zero ocultações fora da etapa, 2 cards ativos preservados e 19 valores persistidos preservados.

## Validação executada

- ESLint direcionado: aprovado.
- Testes focados: 5 arquivos, 41 testes, todos aprovados.
- `npx prisma validate`: aprovado.
- `git diff --check`: aprovado.
- Typecheck global: sem erros nos arquivos desta story; bloqueado por erros preexistentes em Exclusão Fiscal, Agenda/Google Calendar, Gerador de Documentos, Radar e testes externos. A primeira execução também atingiu o limite padrão de heap.
- Restauração integral do novo backup: aprovada com `integrity_check`, FKs, tabelas, linhas, tamanho e hash conferidos.
- Auditoria remota pós-mutação: aprovada; dry-run reproduz as mesmas pós-condições e os cards ativos continuam na etapa correta.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/20260901171000_add_bpm_campo_oculto_etapa/migration.sql`
- `scripts/turso-backup.mjs`
- `scripts/verify-turso-backup.mjs`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/lib/bpm/valor-efetivo-campo.ts`
- `tests/bpm/card-save-flow.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/novos-leads.test.ts`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `tests/bpm/valor-efetivo-campo.test.ts`
- `docs/stories/story-rm-2026-2403e5-correcao-saida-novos-leads.md`
- `scripts/post-audit-novos-leads.ts`
