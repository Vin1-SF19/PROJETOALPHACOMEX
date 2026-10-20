# Story — Alpha CRM: Assessoria Smart → Enviar para REVISÃO

## Status

Ready for Review — configuração publicada e verificada em 2026-10-20; ressalva de build global interrompido por SIGTERM.

**Origem:** solicitação direta do usuário em 2026-10-20.

## Executor Assignment

- **Executor:** @dev, reutilizando os mecanismos administrativos existentes.
- **Quality gate:** @qa.
- **Ferramentas:** inventário somente leitura, comparação da configuração antes/depois, testes BPM pertinentes e gates do projeto.

## Story

**Como** usuário do Alpha CRM, **quero** uma etapa chamada **Enviar para REVISÃO** na penúltima posição do funil de Assessoria Smart e que a entrada nela espelhe o card no Operacional em Revisão, **para** encaminhar o atendimento à revisão operacional preservando sua origem e seu vínculo.

## Contexto e escopo

O funil identificado é **REVISÃO DO RADAR - ASSESSORIA SMART**. A nova etapa fica imediatamente antes de **CLIENTES CANCELADOS**, com o metadado **ehFinal=true**. “Espelhar” utiliza o mecanismo existente de criar um card em outro pipeline com vínculo ao original; o card Smart permanece na origem. Esta story não cria sincronização contínua de todos os campos nem regras adicionais de encerramento, SLA, prazo ou responsável. O formulário/configuração de campos da etapa Documentação em análise é reutilizado na nova etapa, sem campos novos.

A entrega consiste em configuração CRUD limitada: uma etapa, sua ordenação, reutilização do formulário, duas transições mínimas e uma automação central publicada, por script com prévia e controle de versão. Não inclui schema, migrations, seeds, backfill, operações em massa ou movimentação de cards existentes. A criação da configuração não deve disparar encaminhamento retroativo. CRUD comum está contemplado na exceção do `AGENTS.md`; caso a execução exija operação estrutural ou de risco elevado fora desse escopo, aplicar o checkpoint Vault antes dessa operação.

## Critérios de aceite

1. O pipeline **REVISÃO DO RADAR - ASSESSORIA SMART** apresenta exatamente uma etapa ativa com o nome **Enviar para REVISÃO**, na penúltima posição, imediatamente antes de **CLIENTES CANCELADOS**, com **ehFinal=true**. A ordem relativa das demais etapas permanece preservada. O metadado final não implica definir status CONCLUIDO ou cancelamento automático.
2. Uma automação central ativa e publicada do pipeline Smart usa o gatilho **ENTRAR_COLUNA**, restrito ao ID da nova etapa. Entrar em outra etapa não dispara esse encaminhamento.
3. Ao entrar em **Enviar para REVISÃO**, a ação existente **CRIAR_CARD_OUTRO_PIPELINE** cria o card de destino no pipeline **Operacional**, na etapa ativa **Revisão**, salvo reutilização canônica descrita no AC 5, com **vincularAoOriginal: true** e **somenteSeNaoExistirAtivo: false**. IDs e pertencimento da etapa ao pipeline são revalidados antes da configuração.
4. O card de origem permanece no Smart, na etapa **Enviar para REVISÃO**. O destino mantém o vínculo persistido com o original. Ao criar um destino, o ramo genérico existente utiliza empresa, responsável e serviço; não há requisito de copiar campos específicos, histórico ou anexos.
5. Repetir o evento ou entrar novamente na etapa não duplica um destino **NÃO ARQUIVADO** já vinculado ao original no Operacional, mesmo quando seu status não é ATIVO, nem reposiciona esse destino. A deduplicação por **BpmCardVinculo** ocorre independentemente de **somenteSeNaoExistirAtivo: false**. Outro card da mesma empresa sem vínculo não bloqueia a criação de um novo card na **Revisão**, preservando jornadas distintas da mesma empresa.
6. A automação utiliza validação, autorização e observabilidade canônicas, com seus resultados reais: pipeline de destino inativo retorna `ignorada: true` e motivo `PIPELINE_DESTINO_INATIVO`, embora a execução seja registrada como `SUCESSO`; esse retorno não comprova criação concluída. Etapa inválida lança erro e segue o tratamento existente de retentativas/falha. A verificação distingue execução ignorada, criação efetiva e erro, sem alterar o runtime para uniformizar esses estados.
7. A configuração não altera cards existentes, não executa retroprocessamento, não modifica a configuração de etapas do Operacional nem substitui automações ou transições alheias ao pedido. Não são introduzidos parâmetros de SLA, prazos, responsáveis fixos ou campos novos.
8. Checklist, File List e evidências distinguem configuração persistida de execução efetivamente testada. Os gates `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` têm seus resultados reais registrados; limitações de sessão autenticada ou ausência de entrada real são explicitadas.
9. As transições mínimas **Documentação em análise → Enviar para REVISÃO** e **Enviar para REVISÃO → CLIENTES CANCELADOS** tornam o percurso acessível pelo mecanismo canônico. Não definem `lifecycleDestino`; preservam o lifecycle/status atual em vez de inferir conclusão ou cancelamento. A nova etapa reutiliza o formulário/configuração de campos da Documentação em análise, sem criar campos novos.

## Inventário recebido para revalidação

| Recurso | Identificação / estado observado |
| --- | --- |
| Smart | `ca6920da81c6e3472ff83fffa`, versão 1 |
| Etapa 0 | Contratos Stand-by |
| Etapa 1 | Envio do checklist e boas vindas |
| Etapa 2 | Documentação em análise, ID `cf571affb178558c16dd45c87`, com 1 card |
| Etapa 3 | CLIENTES CANCELADOS, ID `ce39a27743ea5be0c3e431391` |
| Configuração Smart | Nenhuma `BpmTransicaoEtapa` e nenhuma automação identificadas no inventário inicial |
| Operacional | `cmuih4tnh000409gm5z34jvss`, versão 19 |
| Revisão do Operacional | `draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79` |

Esses valores são evidência inicial recebida do executor principal, não autorização para ignorar concorrência ou estado atual. Reconsultar IDs, nomes, atividade, versão e ordem antes de salvar. Se houver mudança concorrente, atualizar o plano sobre o estado real sem sobrescrever alterações de terceiros.

## Dev Notes e referências

- [Fonte: `src/actions/bpm/Etapas.ts`, funções `CriarEtapaBpm` e `ReordenarEtapasBpm`]: mecanismos existentes para criação e ordenação de etapas; reutilizar os contratos administrativos e sua auditoria/versão.
- [Fonte: `src/actions/bpm/AutomacoesCentrais.ts`, funções `SalvarDefinicaoAutomacaoCentralBpm` e `AtivarVersaoAutomacaoCentralBpm`]: contratos existentes de definição e publicação da automação central. Uma definição apenas salva em rascunho não satisfaz o aceite.
- [Fonte: `src/lib/bpm/automacoes/central-schemas.ts`, enum de eventos e `criarCardSchema`]: suporta `ENTRAR_COLUNA`, `CRIAR_CARD_OUTRO_PIPELINE`, `pipelineId`, `etapaId`, `vincularAoOriginal` e `somenteSeNaoExistirAtivo`. O último tem default falso; definir explicitamente como falso nesta automação.
- [Fonte: `src/lib/bpm/automacoes/central-runtime.ts`, ramo `CRIAR_CARD_OUTRO_PIPELINE`]: valida pipeline/etapa de destino ativos e mantém `BpmCardVinculo`. A busca de destino existente vinculado não arquivado ocorre sempre, independentemente de `somenteSeNaoExistirAtivo`. Nesta configuração, o parâmetro falso impede reutilização por mera coincidência de empresa, permitindo criar um novo destino na Revisão quando não há vínculo não arquivado. O ramo genérico cria empresa/responsável/serviço e vínculo, sem cópia de campos específicos, histórico ou anexos. Reutilizar esse comportamento sem introduzir runtime paralelo.
- [Fonte: `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md`, critérios 2, 5 e 14]: encaminhamentos existentes preservam a identidade por vínculo e têm configuração editável na central. Reutilizar esse padrão sem transportar os demais requisitos dessa story para o Smart.
- [Fonte: `docs/stories/story-alpha-crm-jornada-card-entre-pipelines.md`, critérios 2 e 7]: a apresentação da jornada consulta vínculos persistidos. A configuração desta story conserva a deduplicação pelo vínculo existente e permite jornadas distintas da mesma empresa.

Não há orientação específica disponível nos documentos genéricos de arquitetura para esta configuração. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados no checkout; o contexto cruzado foi consultado nas stories e contratos citados. Nenhuma nova variável de ambiente, dependência ou tecnologia é prevista.

**[AUTO-DECISION] Origem da story:** usar o pedido direto do usuário e o nome de arquivo definido pelo executor principal, sem inventar epic ou numeração e sem criar tarefa externa de tracking.

**[AUTO-DECISION] Etapa final:** aplicar o metadado `ehFinal=true` na penúltima posição, imediatamente antes de CLIENTES CANCELADOS, conforme orientação do executor principal. Não derivar disso novos comportamentos de encerramento ou mudanças de lifecycle do card.

**[AUTO-DECISION] Integração mínima:** copiar a configuração de formulário/campos da Documentação em análise e configurar somente as duas transições explicitadas no AC 9, sem `lifecycleDestino`, conforme orientação do executor principal. Usar `somenteSeNaoExistirAtivo: false`, pois a deduplicação por vínculo não arquivado já ocorre sempre e reutilizar card avulso da mesma empresa em outra etapa impediria criar o destino solicitado na Revisão. O destino Operacional/Revisão foi revalidado pelo executor principal; rechecá-lo no momento de aplicar para detectar concorrência.

## Tarefas / subtarefas

- [x] Registrar pedido, inventário inicial, critérios e limites do escopo.
- [x] Consultar os contratos de etapas, automação central, vínculo e contexto das stories relacionadas.
- [x] Aplicar `story-draft-checklist.md` à preparação.
- [x] Revalidar pipeline Smart, destino Operacional/Revisão, versões, ordem e ausência de configuração duplicada (AC 1–3, 7).
- [x] Criar a etapa e reordenar para a penúltima posição usando os mecanismos existentes; preservar as etapas e os cards atuais (AC 1, 7).
- [x] Reutilizar formulário/configuração de campos da Documentação em análise e criar as duas transições mínimas sem `lifecycleDestino` (AC 9).
- [x] Salvar e publicar a automação `ENTRAR_COLUNA` com origem restrita à nova etapa, destino Revisão, `vincularAoOriginal: true` e `somenteSeNaoExistirAtivo: false`, preservando a deduplicação canônica por vínculo não arquivado (AC 2–5).
- [x] Conferir por leitura a etapa, ordem final, publicação ativa, parâmetros e preservação dos recursos existentes (AC 1–3, 7).
- [x] Validar os cenários de entrada, repetição, vínculo e destino inválido com fixtures sintéticas ou testes existentes adequados; não movimentar cards reais para fabricar evidência (AC 3–6).
- [x] Executar os quatro gates e registrar os resultados reais e limitações (AC 8).
- [x] Atualizar status, checklist, File List, evidências e resultado de QA (AC 8).

## Testing

| Cenário | Evidência esperada |
| --- | --- |
| Configuração final do Smart | Cinco etapas ativas; Enviar para REVISÃO em ordem 3 e CLIENTES CANCELADOS em ordem 4, se o inventário inicial permanecer válido |
| Percurso e formulário | Duas transições mínimas disponíveis, formulário reutilizado e nenhum campo novo ou lifecycleDestino |
| Metadado final | ehFinal=true na nova etapa; status/lifecycle dos cards preservados |
| Publicação da automação | Versão ativa com evento ENTRAR_COLUNA e etapa exata de origem |
| Entrada sintética sem destino não arquivado vinculado | Novo card Operacional em Revisão com empresa, responsável e serviço suportados pelo ramo genérico, vínculo ao original e origem preservada |
| Entrada em outra etapa | Nenhum encaminhamento pela nova automação |
| Repetição com destino não arquivado vinculado, ATIVO ou outro status | Nenhum novo destino; vínculo mantido e destino não reposicionado |
| Sem destino não arquivado vinculado e com outro card da mesma empresa no Operacional | Novo card criado na Revisão e vinculado à origem; card avulso preservado |
| Pipeline de destino inativo | Payload `ignorada: true`, motivo `PIPELINE_DESTINO_INATIVO` e status de execução SUCESSO conforme runtime; nenhuma criação concluída é inferida desse status |
| Etapa de destino inválida | Erro tratado pelo mecanismo existente de retentativas/falha, sem criação declarada como concluída |
| Comparação antes/depois | Cards existentes e configuração alheia preservados |

Priorizar testes existentes do mecanismo canônico, acrescentando testes apenas se houver lacuna comportamental real. A configuração do negócio em banco exige verificação persistida; testes isolados não comprovam um evento real em produção. Uma entrada futura real deve ser relatada separadamente de fixtures sintéticas.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integration, com configuração via contratos administrativos existentes; complexidade baixa a média pela ligação entre dois pipelines. Não há mudança de schema.
- **Specialized Agent Assignment:** @dev executa e realiza Pre-Commit; @qa revisa posição, publicação, origem/destino e deduplicação. @architect somente se surgir decisão de arquitetura; @devops para operações remotas caso solicitadas.
- **Quality Gate Tasks:** Pre-Commit (@dev): conferir escopo e diff e executar os quatro gates. Revisão CodeRabbit deve refletir arquivos realmente alterados; se a CLI não estiver disponível, registrar a limitação e a revisão alternativa. Pre-PR (@devops) aplica-se somente se houver PR. Não há deploy de código previsto para uma configuração administrativa.
- **Self-Healing Configuration:** @dev light, até 2 iterações/15 minutos, filtro CRITICAL; corrigir CRITICAL e documentar HIGH. Revisão @qa full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM como dívida. @devops check, apenas reporte.
- **Focus Areas:** exatidão dos IDs e escopo do gatilho, versão publicada ativa, preservação da origem, vínculo persistido, prevenção de duplicata de destino não arquivado vinculado, concorrência e ausência de alterações laterais.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado em modo autônomo.

| Categoria | Resultado |
| --- | --- |
| Objetivo e contexto | PASS — requisito e benefício explícitos |
| Orientação técnica | PASS — contratos existentes e inventário para revalidação |
| Referências | PASS — fontes locais e seções/funções identificadas |
| Informação autocontida | PASS — limites e interpretação do espelhamento definidos |
| Testes | PASS — cenários observáveis e limites da evidência |
| Integração CodeRabbit | PASS — plano definido, sem alegar execução |

**Preparação: READY, clareza 9/10.** Nenhuma dependência de alteração de código identificada; o executor deve revalidar o destino e confirmar a publicação da configuração. A preparação não comprova mutação, execução da automação ou aprovação QA.

## Dev Agent Record

Configuração administrativa CRUD publicada via CLI, transação e CAS da versão Smart 1→2. Sem alteração de schema, migration, seed, backfill ou movimentação de cards existentes; aplica-se a exceção de CRUD comum do AGENTS.md.

- Etapa `csmartenviarevisao00000001`: **Enviar para REVISÃO**, ativa, ordem 3, `ehFinal=true`. CLIENTES CANCELADOS passou para ordem 4; demais etapas preservadas.
- Automação `cmvh4lad0001ya2ih22g91r4c`: ativa, versão 1 ATIVA, ENTRAR_COLUNA restrito ao ID exato da nova etapa. Ação CRIAR_CARD_OUTRO_PIPELINE para Operacional/Revisão, `vincularAoOriginal:true`, `somenteSeNaoExistirAtivo:false`; deduplicação canônica por destino não arquivado vinculado. Outro processo avulso da mesma empresa não é reutilizado. Sem condição ou responsável fixo.
- Formulário e 33 configurações de campos reutilizados da Documentação em análise, sem campos novos. Duas transições previstas criadas sem alteração de lifecycle.
- Pós-verificação remota em `2026-10-20T20:18:50.750Z`: cinco etapas, posição correta, versão publicada e grafo correto. Comparação antes/depois confirmou preservação dos IDs, etapas, status, versões e responsáveis dos cards Smart, além de todas as etapas do Operacional. Execução posterior do script retornou JA_CONFIGURADO. Nenhum envio retroativo ou movimentação de card real para teste.
- Evidência operacional local ignorada pelo Git: `database-backups/pre-change/smart-validation/{antes,depois}.json`.
- Backup completo anterior do mesmo banco: `database-backups/pre-change/painelalpha_turso_pre_change_2026-10-20T17-26-08-703Z.sql`, manifesto gerado em 2026-10-20 17:30:04 UTC. 366.320.989 bytes, 337 tabelas, 293.950 linhas, SHA-256 `2aa3ae96a30e4a08f17ee27fd2cdc05edeb4b0cae9c73b00776b01fc057ad2bd`. Restaurado e validado por verify-turso-backup.mjs: hash, tamanho, contagens, integrity_check e foreign_key_check aprovados. A tentativa inicial por réplica encontrou quota temporária; usado backup completo recente existente, verificado antes da aplicação.
- Smoke sobre cópia local completa: aplicação APLICADO e repetição JA_CONFIGURADO. Um teste de integração com runtime real passou: criação na Revisão/vínculo, reentrada sem duplicação, outra etapa sem disparo, preservação da origem e de processo avulso da mesma empresa. Resultado em `database-backups/pre-change/smart-validation/runtime-test.log`. As primeiras tentativas de harness encontraram problemas de ambiente/importação; o harness final passou via Vitest. Nenhum teste foi feito movendo cards reais.
- Gates iniciais: npm run lint passou com avisos preexistentes; npm run typecheck passou, inclusive após a criação do script; npm test passou com 674 arquivos, 5.083 testes, 4 skipped e 1 todo. ESLint individual do script passou sem erros/avisos depois dos ajustes finais. A repetição final de typecheck foi encerrada por SIGTERM (exit 143), sem diagnóstico TypeScript. Não declarar essa repetição como aprovada.
- Duas tentativas de npm run build compilaram com avisos conhecidos em pdfjs-polyfill.ts, mas seus workers foram encerrados por SIGTERM. Não se declara build aprovado. A segunda usou distDir isolado, posteriormente removido. Não há alteração de runtime ou deploy nesta entrega.
- CodeRabbit não está instalado; realizada revisão independente @qa. Ajustados o preflight idempotente (escopo do gatilho, condição ausente, formulário e transições) e a documentação de destino inativo, sem mudar o motor central.
- Rollback administrativo: pausar a automação e, se a nova etapa estiver vazia, desativá-la e devolver CLIENTES CANCELADOS à ordem 3, sempre com auditoria/nova versão. Se houver cards novos, preservar os dados e revisar o encaminhamento antes de qualquer remoção. O backup completo permanece disponível; não restaurar indiscriminadamente o banco ativo.

### File List

- `docs/stories/story-alpha-crm-assessoria-smart-enviar-revisao.md` — critérios, checklist, evidências e limitações.
- `scripts/configurar-assessoria-smart-revisao.mts` — prévia, publicação transacional delimitada e conferência idempotente.

## QA Results

**@qa: PASS** para script e configuração, após correções do preflight e da documentação. Smoke local aprovado. A publicação remota foi posteriormente comprovada pelo executor por leitura/comparação. Ressalvas: build global e repetição final do typecheck interrompidos por SIGTERM, sem diagnóstico de erro de código. Nenhum deploy necessário para disponibilizar a configuração.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 0.1 | Story preparada a partir do pedido direto e inventário inicial, com checklist de draft | River (@sm) |
| 2026-10-20 | 0.2 | Configuração publicada e verificada, smoke local e QA PASS; limitações de infraestrutura registradas | Codex |
