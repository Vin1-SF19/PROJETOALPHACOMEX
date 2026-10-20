# Reconciliação de histórico e autoria — Alpha CRM / RD

Data: 20/10/2026. Escopo confirmado pelo usuário: **Histórico e autoria**.

**Situação: comparação e simulação concluídas; aplicação em produção aguardando autorização específica.** A correção de apresentação está preparada; esta entrega ainda não foi publicada.

## Resultado da comparação

| Cobertura | Quantidade |
|---|---:|
| Cards Alpha inventariados, incluindo arquivados | 1.234 |
| Cards com vínculo RD explícito, consultados individualmente | 1.221 |
| Cards sem vínculo RD, preservados | 13 |
| Negócios RD enumerados pela V1, 9 páginas | 1.572 |
| Negócios RD sem card Alpha, sem criação automática de cards | 351 |
| Anotações globais V1, 27 páginas | 5.228 |
| Anotações comparadas nos cards vinculados | 3.682 |
| Movimentos de etapa comparados | 7.177 |
| Registros históricos de tarefas comparados | 1.624 |
| Eventos existentes equivalentes | 12.036 |
| Cards com mudanças históricas propostas | 237 |

Todos os 1.221 detalhes de negócio foram coletados, sem resposta 404 e sem falha final de consulta. IDs externos identificam os cards/eventos; nomes de empresas e responsáveis não foram usados para criar correspondências.

A V1 forneceu os eventos e os catálogos; a V2 forneceu 31 usuários e a conferência de 266 anotações em 54 negócios. Essa conferência cobre todas as anotações que serão inseridas/alteradas: IDs de negócio/anotação, autor e instante coincidem. A conferência V2 não abrangeu todos os negócios do RD; a enumeração integral dos negócios e histórico vinculado foi feita pela V1.

Os 30 usuários V1 e os 31 usuários V2 não apresentaram nomes divergentes para IDs compartilhados. A V2 apresenta conteúdo de anotação em HTML, enquanto a V1 apresenta texto: diferenças de representação foram registradas, sem substituir automaticamente o texto V1 por HTML ou declarar equivalência textual integral.

## Lote proposto

| Tipo de registro histórico | Inserções | Atualizações |
|---|---:|---:|
| Anotações | 55 | 23 |
| Tarefas no histórico | 28 | 254 |
| Movimentos de etapa | 39 | 48 |
| **Total** | **122** | **325** |

As anotações incluem **19 autores antes ausentes**, três nomes atualizados conforme o mesmo ID de autor no RD e uma atualização de conteúdo. As 55 novas anotações possuem autor identificado.

As tarefas terão texto, datas, situação e responsáveis históricos reconciliados quando a fonte apresentar diferença. O responsável de uma tarefa será identificado como **“Responsável no RD”**, sem ser apresentado como autor de uma anotação. As tarefas operacionais do Alpha não serão modificadas.

Os movimentos históricos terão os períodos de entrada/saída atualizados e os registros ausentes acrescentados. A etapa atual dos cards não muda.

Não serão feitas alterações em campos comerciais, empresas, contatos, donos/membros de cards, pagamentos, permissões, automações ou no próprio RD. Nenhum card será criado, movido ou excluído.

## Mensagem relatada pelo usuário

O horário **13/10/2026 às 19:41 (America/Sao_Paulo)** corresponde a **1.843 correções automáticas locais**, registradas às 22:41 UTC com campos de título/nome de etapa e identificadores da importação anterior. Não são registros de uma pessoa escrevendo uma anotação naquele horário.

Na apresentação das correções, o código passa a distinguir:

- Correção automática comprovada da importação: **“Ajuste automático da importação”**.
- Recuperação automática anterior de autoria: **“Autoria recuperada automaticamente do RD”**.
- Correção feita por usuário Alpha: preserva o nome desse usuário.
- Correção sem proveniência suficiente: **“Autor do ajuste não identificado”**.

O autor original da anotação permanece separado do autor da correção local. Nenhuma autoria humana será inventada para correções automáticas.

## Limitações preservadas

- Os **7.177 movimentos de etapa** coletados não informam autor original. O responsável atual pelo negócio não será usado como substituto.
- **71 referências históricas de etapa** não têm nome recuperável no catálogo atual. Nomes anteriores existentes são preservados.
- **Duas datas de tarefas** não foram fornecidas em formato utilizável; valores existentes são preservados.
- Os 13 cards sem vínculo RD e os 351 negócios RD sem card Alpha permanecem fora da carga.
- A simulação não equivale a validação visual autenticada em produção. A apresentação e os resultados remotos ainda precisam ser conferidos após a publicação/aplicação.

## Segurança, banco e execução

Ambiente: **produção, banco Turso remoto do Painel Alpha**. Identificador SHA-256 da URL: `3a07b72d638b9528ba4a373d5c293551467ea154c6770966967b8cc11d0cc662`.

Plano fechado: `4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece`.

A prévia privada contém antes/depois por evento, hashes das fontes e do executor, vínculos esperados, exceções e comandos reversos em `database-backups/pre-change/rd-historico-autoria-2026-10-20/plan.json`. Dados reais e dumps permanecem ignorados pelo Git.

O lote executa:

1. Validação do plano, executor, banco, backup e simulação.
2. Em transações de até 20 operações, revalidação dos vínculos, eventos e correções locais.
3. Inserção de 122 eventos em `BpmEventoExternoCard`; atualização somente da projeção e timestamp de 325 eventos existentes.
4. Acréscimo de 325 correções em `BpmEventoExternoCorrecao` e 447 recibos de auditoria em `BpmCardHistorico`.
5. Conferência das 1.341 condições de estado esperado e gravação do resultado.

O payload bruto dos eventos existentes e as correções anteriores permanecem intactos. Edições humanas locais são protegidas, inclusive campos removidos. Alteração concorrente bloqueia o lote afetado; transações já concluídas possuem recibos para retomada idempotente.

Risco: falha de rede ou alteração concorrente pode interromper a execução após alguns lotes confirmados. Não há migração nem indisponibilidade planejada, mas as transações podem causar contenção breve. A verificação não anuncia sucesso global se houver falha parcial.

**Alternativa sem escrita:** manter esta comparação e o plano privado, sem aplicar o lote.

## Backup e retorno

Backup completo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql`, concluído em **20/10 às 17:30:04 UTC**, 366.320.989 bytes, 337 tabelas e 293.950 linhas.

SHA-256: `2aa3ae96a30e4a08f17ee27fd2cdc05edeb4b0cae9c73b00776b01fc057ad2bd`. Restauração integral, contagens, hash, integridade e FKs verificados. Validade máxima do backup: **22/10 às 17:30:04 UTC**; a fonte da comparação também é limitada a 24 horas pelo executor.

O rollback padrão é seletivo: restaura projeções alteradas, remove somente eventos inseridos por este lote e acrescenta auditoria de reversão. Preserva registros e atividades posteriores; qualquer edição posterior no evento bloqueia sua reversão. Lotes nunca aplicados são preservados, inclusive se mudaram depois da prévia. Restauração integral do banco não é a operação padrão.

Comandos preparados, **ainda não executados remotamente**:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/reconciliar-historico-autoria-rd.mjs apply --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql --confirm=apply:4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece
node scripts/reconciliar-historico-autoria-rd.mjs verify
```

Comandos de retorno do mesmo lote, se necessário:

```bash
TMPDIR="$PWD/database-backups/pre-change/vault-verificacao" node scripts/reconciliar-historico-autoria-rd.mjs rollback --backup=database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql --confirm=rollback:4be6d3428252a7c6aca9d9463ea7a520d1fa6643d355ba39a61b1e566c89bece
node scripts/reconciliar-historico-autoria-rd.mjs verify --state=rollback
```

## Validação e versionamento

- Simulação em cópia restaurada: **447 aplicadas; reexecução com zero novas alterações; 447 revertidas; 1.341 condições conferidas; integridade OK e zero violações de FK**.
- Testes focados finais: **24 aprovados**, incluindo paginação incompleta, autores conflitantes, campos removidos manualmente, identidade entre APIs, concorrência, repetição e rollback parcial.
- Suite geral executada: **657 arquivos aprovados; 4.975 testes aprovados, quatro ignorados e um TODO**, na rodada final após todas as alterações.
- Typecheck aprovado. Lint sem erros; avisos preexistentes registrados no log.
- Build isolado aprovado (exit 0): Prisma/player executados; Next compilado e 80 páginas estáticas geradas em 171 segundos com heap de 4.096 MB. A execução padrão de `npm run build` havia atingido o limite de 3.072 MB; `package.json` não foi alterado.
- Entrega anterior de cards/fluxo agora registrada no commit local `aa5a50761944ecf049a61b254980675926288af3`. A existência desse commit não significa push ou novo deploy.
- Pacote isolado na branch local `fix/crm-historico-autoria-rd-20261020`, sobre `aa5a5076`, com mensagem de commit `fix(crm): reconciliar histórico e autoria do RD`. Esta reconciliação ainda não foi aplicada no banco, publicada ou verificada visualmente em produção.

Referências: [story](story-alpha-crm-reconciliacao-historico-autoria-rd.md), [relatório Vault](relatorio-vault-rd-historico-autoria.md), [contrato V2 de anotações](https://developers.rdstation.com/reference/crm-v2-list-notes-from-deal), [catálogo V1 de usuários](https://developers.rdstation.com/reference/crm-v1-list-users), [tarefas V1](https://developers.rdstation.com/reference/crm-v1-list-tasks).
