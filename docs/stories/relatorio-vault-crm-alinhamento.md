# Vault Report — autorização recebida; aplicação aguarda validação de entrega

Revisão inicial: 2026-10-20, 16:24 UTC. Revalidação após autorização: 2026-10-20, aproximadamente 16:39 UTC.

Story: [Alinhamento dos cards e fluxo de contrato](story-alpha-crm-alinhamento-cards-fluxo-contrato.md).

Skill aplicada: [Vault](../../.agents/skills/vault/SKILL.md). O `AGENTS.md` exige relatório, backup completo verificado com até 48 horas e confirmação específica antes de executar esta configuração persistente. O pedido geral de implementar as melhorias não substitui essa confirmação. Depois da apresentação da entrega e deste plano, o usuário respondeu **“autorizo”** para sua aplicação exata; a autorização foi comunicada a Vault pelo agente responsável pela conversa.

## Ambiente e artefatos examinados

- **Ambiente: banco remoto, tratado como produção.** A aplicação usa `TURSO_DATABASE_URL` de `.env.local`; `prisma/dev.db` não é o banco examinado.
- Identificador seguro do banco, SHA-256 da URL: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.
- Script: `scripts/configurar-alinhamento-crm.mts`.
- SHA-256 do script revisado: `64c08b54fdcfdf7f0d995bbe1d5a4b524ab59c361b1376b3412931be207b6c10`.
- Plano local ignorado pelo Git: `database-backups/pre-change/crm-alinhamento/plan.json`.
- Fingerprint validado do plano: `22095fae6cc62886d0dae11557f41a1bdf690c5b9a0e886c5c1f2882ef31dca1`.
- Pipeline: Revisão de Radar, versão de configuração da prévia **33**.
- O hash do banco configurado coincide com o plano e com o manifesto do backup.

Esta revisão não executou `apply`, `rollback`, migrations, alterações de schema ou atualizações no banco remoto. A restauração de verificação ocorreu somente em arquivo SQLite temporário local, removido pelo verificador.

## Escopo exato da aplicação

| Operação persistente | Classificação | Limite e efeito |
| --- | --- | --- |
| `UPDATE BpmEtapa` de Fechado | Baixo risco, confirmação obrigatória | Um ID conhecido: nome **Contrato fechado**, chave estável `fechado`. |
| `UPDATE BpmEtapa` de Stand By | Baixo risco, confirmação obrigatória | Um ID conhecido: nome **Stand-by — follow-up semanal**, chave estável `standby_follow_up`. |
| `UPDATE BpmCampoEtapaConfig` do e-mail | Alteração de regra de negócio | Um ID conhecido da etapa fechada: `obrigatorioEntrada=true`. |
| `UPDATE BpmFormularioComponente` do e-mail | Alteração de regra de negócio | Um componente: preserva as demais propriedades de `configJson` e acrescenta a obrigação de entrada. |
| `INSERT BpmCampo` | Aditiva | Um campo de card opcional **Fechado no tarifário padrão**, chave `alpha.radar.fechado.tarifario_padrao`. |
| `INSERT BpmCampoOpcao` | Aditiva | Duas opções do novo campo: **Sim** e **Não**. |
| `INSERT BpmCampoEtapaConfig` | Aditiva | Uma associação do novo campo à etapa Contrato fechado, sem obrigatoriedade. |
| `INSERT BpmFormularioComponente` | Aditiva | Um componente na seção Contratação. |
| `UPDATE BpmEtapaFormulario` | Controle de versão | Incrementa a versão do formulário em um. |
| `UPDATE BpmPipeline` | Controle de versão | Incrementa `configVersion` em um. |
| `INSERT BpmPipelineConfigAuditoria` | Aditiva | Registra administrador ativo, configuração anterior/posterior e fingerprint. |

As três opções de pagamento permanecem exatamente:

1. 50% Entrada / 50% Êxito (Pix)
2. Parcelamento Cartão de Crédito - até 12x com juros
3. Integral na contratação - 10% OFF (Pix)

Não há escrita em cards, contatos, anexos, valores preenchidos, histórico comercial ou filas. Não há backfill de e-mail nem preenchimento presumido do tarifário. Não há alteração de permissões de administradores/líderes, criação de funis ou alteração das cadências. Não há DDL; o protocolo de diff de schema antes de aprovar uma migration não é acionado por este plano de configuração. Nenhuma aprovação de migration é emitida neste relatório.

## Impacto, riscos e alternativa

Depois da aplicação, novos movimentos para Contrato fechado exigirão o e-mail canônico do contato. Cards já existentes não recebem dados artificiais. Os usuários verão os novos nomes e o campo opcional Sim/Não.

O risco principal é operacional: um contato sem e-mail bloqueará a entrada nessa etapa até o dado ser preenchido. As renomeações dependem de o código compatível com nomes antigos/novos estar publicado; aplicar a configuração antes desse código pode afetar regras que ainda comparem nomes literalmente.

A aplicação usa uma transação, compara toda a configuração capturada com a prévia e interrompe se houver divergência. Também exige administrador ativo e backup verificado do mesmo banco. Restrições únicas existentes interrompem conflitos de chaves. Uma falha dentro da transação não deve deixar uma configuração parcialmente aplicada; não existe operação de remoção de dados no caminho de aplicação.

O snapshot cobre as configurações alteradas, o formulário inteiro e as opções de pagamento. Ele não constitui bloqueio de manutenção global. Antes de aplicar, confirmar que não existe publicação administrativa concorrente ou rascunho antigo prestes a sobrescrever a configuração. Após aplicar, conferir a leitura atualizada na aplicação e recarregar a tela para eliminar estado antigo do navegador.

**Alternativa não destrutiva:** manter os nomes, a obrigatoriedade e o formulário atuais enquanto a mudança fica preparada em código e no plano local. Essa alternativa preserva o funcionamento atual, mas deixa as renomeações, o e-mail obrigatório e o tarifário pendentes.

## Backup completo verificado

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-19T12-54-41-780Z.sql`.
- Manifesto: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-19T12-54-41-780Z.manifest.json`.
- Data de geração declarada no manifesto: **2026-10-19 12:59:53.430 UTC**.
- Idade na revisão: aproximadamente **27 horas e 24 minutos**.
- Limite de 48 horas: **2026-10-21 12:59:53.430 UTC**. Depois disso, gerar e verificar um backup novo antes de qualquer aplicação.
- Tamanho: **363.953.962 bytes**.
- Estrutura/dados restaurados: **337 tabelas e 290.819 linhas**.
- SHA-256: `6dc70dbb95a4ac6db5ab4eb9ce17630f7dbafb10c6d1d21ef25aab13f22652fc`.
- Verificação real: restauração completa local, SHA-256 e tamanho iguais ao manifesto, `PRAGMA integrity_check=ok`, nenhuma violação em `PRAGMA foreign_key_check`, contagens de tabelas e linhas iguais ao manifesto.
- O manifesto identifica o mesmo banco do plano.

A primeira verificação usando `/tmp` falhou com `disk I/O error`; a repetição usando diretório temporário no disco do projeto passou. A causa exata de `/tmp` não foi atribuída. Usar o mesmo `TMPDIR` validado nos comandos abaixo. O dump e o plano permanecem fora do Git. Nenhum token ou dado do dump integra este relatório.

## Etapas e comandos previstos — não executados nesta revisão

1. Concluir/publicar o código compatível e validar os testes da story.
2. Confirmar o administrador ativo que será registrado na auditoria e a ausência de publicação administrativa concorrente.
3. Conferir novamente os hashes do script/plano. Se o script, plano ou escopo mudar, renovar a análise e a confirmação. Se a prévia divergir do banco, gerar outra prévia e obter confirmação do novo fingerprint.
4. Revalidar o backup; se vencido, gerar outro por `node scripts/turso-backup.mjs crm-alinhamento` e verificar o novo par dump/manifesto.
5. Solicitar e receber autorização humana específica para este fingerprint.
6. Somente após essa autorização, executar a aplicação. `CRM_ADMIN_ID` deve ser definido com o administrador validado; nenhum ID foi presumido nesta revisão.

Comando de verificação executado com sucesso:

```bash
mkdir -p database-backups/pre-change/vault-verificacao
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/verify-turso-backup.mjs database-backups/pre-change/painelalpha_turso_pre_change_2026-10-19T12-54-41-780Z.sql database-backups/pre-change/painelalpha_turso_pre_change_2026-10-19T12-54-41-780Z.manifest.json
```

Comando de aplicação preparado, **autorização recebida, ainda não executado nesta revisão**:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" NODE_ENV=production node --conditions=react-server --import tsx scripts/configurar-alinhamento-crm.mts apply --confirm=apply:22095fae6cc62886d0dae11557f41a1bdf690c5b9a0e886c5c1f2882ef31dca1 --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-19T12-54-41-780Z.sql --admin-id="$CRM_ADMIN_ID"
```

Depois da aplicação, verificar somente por leitura: nomes/chaves, regra de e-mail, novo campo e opções, catálogo das três formas de pagamento, incremento das versões e registro de auditoria. O recibo local fica em `database-backups/pre-change/crm-alinhamento/receipt.json`; o registro de auditoria do banco permite recuperar o estado mesmo se a gravação do recibo local falhar.

## Rollback

O rollback também exige autorização específica e backup completo válido antes de sua execução. O script consulta o recibo canônico de auditoria e recusa a reversão automática se a configuração tiver sido alterada depois da aplicação.

Na transação de rollback:

- Restaura os nomes/chaves anteriores dos dois IDs de etapa.
- Restaura a regra anterior de entrada do e-mail e seu `configJson`.
- Remove somente o componente de formulário criado por esta aplicação: remoção restrita de configuração, que merece confirmação.
- Desativa o campo tarifário, preservando os valores eventualmente preenchidos, opções e associação.
- Incrementa as versões e registra auditoria da reversão.

O modo previsto é `rollback`, com `--confirm=rollback:22095fae6cc62886d0dae11557f41a1bdf690c5b9a0e886c5c1f2882ef31dca1`, administrador validado e backup vigente. Não executá-lo automaticamente diante de uma falha de recibo: primeiro consultar a auditoria.

Uma restauração integral do dump é recurso de recuperação de desastre e pode descartar gravações posteriores à geração do backup se aplicada sobre o banco atual. Restaurar inicialmente em banco isolado, validar integridade/contagens e planejar reconciliação ou troca do banco somente com autorização específica. Para a configuração prevista, preferir o rollback seletivo que preserva dados comerciais.

## Revalidação após autorização

O usuário respondeu **“autorizo”** à entrega e ao relatório deste plano. A confirmação cobre somente o banco e o fingerprint descritos, sem ampliar o escopo. Não é necessário pedir novamente a mesma autorização enquanto o plano permanecer idêntico.

Leituras repetidas em 2026-10-20, aproximadamente 16:39 UTC:

- SHA-256 do script permanece `64c08b54fdcfdf7f0d995bbe1d5a4b524ab59c361b1376b3412931be207b6c10`.
- Fingerprint do plano validado por recálculo: `22095fae6cc62886d0dae11557f41a1bdf690c5b9a0e886c5c1f2882ef31dca1`.
- Banco configurado continua com o identificador `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.
- O snapshot remoto consultado com as mesmas seleções/ordens do script corresponde integralmente ao estado anterior do plano. SHA-256 do snapshot: `c2d04c32ad7347039e29cc995566bf0575f74f9ed6cd81a5093ccf3b35d8c564`.
- Pipeline permanece na versão **33**.
- O backup foi novamente restaurado e verificado com sucesso: SHA/tamanho, integridade, ausência de violações de FK e contagens mantidos. A idade é aproximadamente 27 horas e 39 minutos; o vencimento permanece **2026-10-21 12:59:53.430 UTC**.

### Conta auditora operacional

A leitura de `usuarios` confirmou a conta **ID 8**, role **TI**, status **ATIVO**, elegível por `isAdminRole`. Os oito registros mais recentes de `BpmPipelineConfigAuditoria` do Radar usam esse mesmo `adminId`, incluindo:

- `visibilidade_pipeline`, 2026-10-16 13:46:24.487 UTC.
- `CONTRATACAO_EM_TRATATIVA_20261016`, 2026-10-16 12:42:41.050 UTC.
- `configuracao_publicada`, 2026-10-15 18:33:20.961 UTC.

Os relatórios anteriores [Novo Lead](../reports/vault-revisao-radar-novo-lead-2026-09-28.md) e [Reunião Agendada](../reports/vault-revisao-radar-reuniao-agendada-2026-09-28.md) documentam explicitamente a auditoria das configurações com **Vinicius/TI, ID 8**. Essa evidência identifica a conta já utilizada para auditoria operacional; **não identifica nem presume quem é o usuário desta conversa**. A configuração pode registrar `CRM_ADMIN_ID=8` com essa atribuição operacional documentada.

## Decisão atual

**Autorização específica recebida e pré-condições de backup/plano verificadas. Nenhuma aplicação foi executada por Vault.**

Permanece a condição de entrega: o agente responsável deve confirmar que o código compatível está disponível no ambiente que consumirá os nomes novos e concluir sua verificação de build antes de executar. O script ainda deve repetir seu controle de concorrência na transação, conferir o administrador e verificar novamente o backup na aplicação. Mudança de plano/escopo exige nova análise e autorização; mero prosseguimento do mesmo plano já autorizado não exige outra pergunta.

Novas formas de pagamento continuam pendentes de definição do usuário. A dispensa de obrigatórios para administradores/líderes permanece no backlog.
