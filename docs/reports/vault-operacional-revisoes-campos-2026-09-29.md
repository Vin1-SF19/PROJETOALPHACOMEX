# Vault — campos das três etapas de revisão do Operacional

## Estado

**Publicado em 2026-09-29 após autorização específica do usuário.** A transação confirmou a versão 12 → 13 do pipeline Operacional. O script não alterou valores de cards.

## Ambiente e escopo

- Banco: Turso remoto de produção do Painel Alpha, configurado em `.env.local` (`libsql://`). O arquivo `prisma/dev.db` não é o alvo.
- Pipeline Operacional `cmuih4tnh000409gm5z34jvss`, versão anterior **12** e atual **13**, publicada por comparação e troca transacional.
- Etapas de origem: Revisão (ordem 4), Revisado (ordem 5) e Revisão do protocolo (ordem 6). Os campos continuam visíveis nas etapas posteriores para preservar o contexto do card.
- Sete campos configuráveis em **Campos e Formulários**: Anotação com resultado da revisão; Anotação após protocolo; Data do protocolo (data e hora); Certificado digital utilizado; Número do protocolo; Todos os documentos foram juntados?; Os documentos possuem os códigos corretos?
- Apenas na saída de **Revisão do protocolo** são obrigatórios Data do protocolo, Número do protocolo e as duas confirmações. As confirmações usam campos booleanos de opções fixas “Sim”/“Não”, para que editar o rótulo do campo na UI não invalide as duas regras `EXIT_STAGE` que exigem “Sim”. Os campos das etapas Revisão e Revisado permanecem opcionais, conforme o pedido recebido.
- A publicação criou 7 registros de campo, 54 configurações de campo por etapa, 54 componentes em 9 formulários, 24 seções de formulário e 2 requisitos; incrementou a versão desses 9 formulários e a versão do pipeline. Os campos pertencem ao Operacional e não têm vínculos extras para o mesmo pipeline. Um card existe no pipeline, na etapa anterior (Documentação em análise); nenhum card estava nas três etapas alvo ou posteriores. Valores de cards existentes não foram modificados pelo script.
- Esta publicação **não** cria alertas ou SLAs; esses itens continuam nas stories correspondentes, dependentes das regras de tempo e acesso ainda não publicadas.

## Comandos e verificações antes da aplicação

1. Reexecutar a prévia read-only: `npx tsx --conditions=react-server scripts/configurar-campos-revisoes-operacional.mts`. Conferir versão 12 e o plano acima.
2. Backup completo dedicado já criado em `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T21-20-06-468Z.sql` com manifesto de mesmo prefixo. Motivo: `operacional-revisoes-campos-v13`; 177.949.800 bytes, 332 tabelas, 191.627 linhas, SHA-256 `4ac8eb43d7e9f4c3f5eb6f2eba2f6b0adcba354b08b3491184c72479cb37c221`.
3. Verificação isolada do dump: `node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>` retornou `verified: true`, tamanho, hash, 332 tabelas e 191.627 linhas iguais ao manifesto. O backup deve continuar íntegro e com menos de 48 horas no instante da aplicação; se vencer ou falhar, criar e verificar outro.
4. Após **confirmação explícita específica do usuário**, aplicar com `--apply --approval=AUTORIZO_CAMPOS_REVISOES_OPERACIONAL --expect-version=12 --admin-id=1 --backup=<dump.sql> --manifest=<manifest.json>`. O script revalida ambiente remoto, administrador, integridade/restauração do backup, nomes/ordem das etapas, ausência de chaves duplicadas, versões e transação com CAS antes de gravar.
5. Ler de volta versão 13, os sete campos, opções Sim/Não, configurações, componentes, duas regras e versões dos formulários. Testar em card autorizado o salvamento e o bloqueio de saída com campo vazio/“Não”, sem mover ou criar card de produção apenas para ensaio.

## Evidência de qualidade da preparação

- Prévia somente leitura executada novamente após corrigir dois pontos da revisão: os campos booleanos têm “Sim/Não” fixos e não há vínculo redundante ao pipeline proprietário. Continua em 12 → 13, com 7 campos, 9 formulários e 0 valores de cards alterados.
- `npm run lint`: aprovado, 0 erros (1.191 avisos preexistentes no repositório).
- `npm run typecheck`: aprovado.
- `npm test`: aprovado; teste direcionado `tests/bpm/requisitos-transicao-obrigatoriedade.test.ts` cobre vazio/“Não”/“Sim” nas duas confirmações.
- `npm run build`: aprovado.
- Revisão QA após as correções: **PASS para a preparação dos sete campos e dos dois bloqueios**; SLAs e alertas continuam fora desta publicação.

## Publicação e leitura de volta

- O usuário autorizou especificamente a gravação no Turso de produção dos sete campos, duas regras e versão 12 → 13 após receber escopo, impacto, risco, alternativa e reversão.
- Antes da aplicação, `node scripts/verify-turso-backup.mjs` reconfirmou hash, tamanho e restauração isolada do backup; a prévia reconfirmou a versão 12.
- `--apply` concluiu com `sucesso: true` e `COMMIT` transacional.
- `npx tsx --conditions=react-server scripts/verificar-campos-revisoes-operacional.mts` confirmou: versão 13; 7 campos ativos; 2 confirmações booleanas; 54 configurações, 54 componentes, 24 seções, 2 regras `EXIT_STAGE` ativas, 0 vínculos redundantes, 9 formulários v4 e 1 card no pipeline.

## Riscos, alternativa e reversão

- Riscos: versão concorrente invalidar a prévia; indisponibilidade breve ou timeout transacional; campo não aparecer no formulário; requisito bloquear indevidamente uma movimentação futura. O único card existente pode chegar a uma etapa que passou a ter mais campos, mas seus valores atuais não são tocados.
- Alternativa sem alteração: manter apenas a prévia e as stories, aguardando definição/autorizações de publicação.
- Reversão preferencial: bloquear novos movimentos se houver erro, ler os IDs criados e executar uma transação compensatória limitada a esta publicação, com guarda de versão. Remover os componentes, seções, requisitos e configurações criados; se algum campo já tiver valores de usuário, **não excluir esses valores**: desativar/ocultar o campo e preservar dados para reconciliação. Publicar nova versão corrigida do pipeline/formulários. O dump integral é recuperação de desastre, pois sua restauração total sobrescreveria dados posteriores.

## Autorização necessária

A confirmação específica exigida pelo `AGENTS.md` foi recebida para Turso de produção, sete campos, duas regras e versão 12 → 13. O backup foi verificado antes da execução.
