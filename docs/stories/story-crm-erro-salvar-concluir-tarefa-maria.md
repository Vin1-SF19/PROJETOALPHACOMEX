# Story — Diagnosticar e corrigir erros de salvar card e concluir tarefa no Operacional

## Status

Ready for Review — causas reproduzidas, QA/Anubis e quatro gates PASS. Staging861 READY validado; usuário autorizou explicitamente promoção desta correção para produção. Verificação remota de produção pendente após push.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["diagnóstico com evidências sanitizadas", "regressões salvar/concluir/negações", "npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuária do CRM com acesso autorizado ao Operacional, quero salvar o card e concluir tarefas válidas sem falhas indevidas, para continuar o atendimento respeitando as permissões e requisitos existentes.

Relato recebido: usuária **Maria**, empresa informada como **“LCREMPRETEIRA”**, possivelmente “LCR EMPREITEIRA”, recebe **“Erro ao atualizar card”** e **“Erro ao concluir tarefa”** no funil Operacional. Ambiente confirmado pelo usuário: produção em painel.alpha-comex.com. O nome informado não identifica sozinho uma conta, card ou tarefa. As duas causas e suas correções foram comprovadas em fixtures/harness, conforme evidências abaixo.

Esta story autorizou inicialmente diagnóstico e correção com publicação **primeiro em staging**. Após staging861 READY com alias/smoke verificados, o usuário respondeu explicitamente “manda bala pode fazer” ao pedido de publicação desta correção em produção em 2026-10-21. A promoção autorizada mantém somente os cinco caminhos desta correção, preservando o restante de main. Nenhum card/tarefa/dado de usuário real será alterado para teste; o trabalho anterior de Lider Comercial permanece independente.

## Acceptance Criteria

1. O diagnóstico confirma ambiente, release e a identidade correta do caso por leitura autorizada, sem presumir identidade pelo primeiro nome nem grafia aproximada da empresa. Registra o caminho de UI/action, condições de acesso/requisitos, resultado observado e evidências sanitizadas suficientes para rastrear cada falha. Se a identificação ou reprodução não for possível, registra a lacuna e não declara causa comprovada.
2. A falha de salvar e a de concluir são reproduzidas em fixtures/harness ou ambiente isolado que represente as condições relevantes, sem executar operações de teste em registros reais. O diagnóstico distingue falhas independentes, causa compartilhada, recusa legítima de negócio e falha técnica, conforme a evidência; as mensagens genéricas não bastam para concluir a causa.
3. A implementação corrige somente a causa comprovada e seu caminho real. Salvar alterações válidas e concluir tarefa autorizada com requisitos cumpridos funcionam conforme os contratos existentes; quando houver recusa legítima, o fluxo retorna orientação coerente e segura sem mascarar uma falha técnica como sucesso. Logs/evidências não expõem dados de clientes, credenciais ou stack sensível ao usuário.
4. São preservados ACL, validações de campos/requisitos, transações, controle de concorrência/CAS, idempotência e auditoria/eventos existentes. Usuário sem acesso continua impedido; tarefa cancelada, requisitos pendentes, payload inválido e versão desatualizada mantêm a rejeição pertinente. Não há bypass por nome de usuária/empresa nem relaxamento de regra para contornar o relato.
5. As regressões cobrem salvar card e concluir tarefa no cenário comprovado, sucesso válido e negações pertinentes, incluindo concorrência/repetição conforme o diagnóstico. Não há gravação parcial indevida nem duplicação de conclusão/auditoria. Dados/configurações existentes e alterações concorrentes alheias são preservados.
6. Não se presume migration, alteração estrutural, seed/backfill ou mutação em massa. Se uma operação abrangida pela política de banco se tornar necessária, aguarda Vault, explicação do impacto/rollback, backup completo verificado de até 48 horas e confirmação explícita específica antes da execução.
7. Lint, typecheck, suíte completa de testes e build são executados com resultados reais registrados; QA revisa diagnóstico, correção e negações. Após aprovação, DevOps publica/verifica primeiro staging, registrando commit/release, READY/SHA/alias e smoke pertinente; com o pedido explícito posterior do usuário, promove somente esta correção para produção e repete a verificação remota. Limitações de sessão/autenticação não são declaradas como teste aprovado.
8. Checklist, File List e evidências são atualizados com causa confirmada, caminhos alterados, comandos/resultados e limites reais. A promoção para produção depende do pedido explícito posterior registrado nesta story; dados reais não são movimentados ou editados para fabricar evidência.

## Dev Notes e referências

- `src/actions/bpm/Cards.ts`, `AtualizarCardBpm`: valida entrada, chama `exigirAcessoBpmCard(..., "editarCard")`, confere versão e executa salvamento transacional/CAS. O catch registra `[AtualizarCardBpm]` e traduz erros conhecidos; outros retornam “Erro ao atualizar card”. Isso localiza a fronteira do sintoma, sem provar a exceção original.
- `src/actions/bpm/Tarefas.ts`, `ConcluirTarefaBpm`: exige acesso `concluirTarefa` antes e dentro da transação; trata checklist vinculado, tarefa cancelada, requisitos específicos, conclusão condicional de pendente, histórico/evento/SLA. O catch registra `[ConcluirTarefaBpm]` e traduz somente mensagens conhecidas; demais retornam “Erro ao concluir tarefa”. Não atribuir o caso a um desses ramos sem evidência.
- `src/lib/bpm/ownership.ts`: contrato canônico de autorização a preservar. `src/lib/validations/bpm.ts`: validações existentes; conferir schemas efetivamente usados nas duas actions.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`, `PainelProximoContato.tsx` e `PainelStatusPosFechamento.tsx`: consumidores de `AtualizarCardBpm`; confirmar qual deles participa do relato antes de alterar UI.
- Testes existentes relevantes: `tests/bpm/tarefas-tipo-actions.test.ts`, `tarefas-checklist-actions.test.ts`, `tarefas-conclusao-otimista-react.test.ts`, `campos-configuraveis-actions.test.ts` e `ownership-security.test.ts`. Reutilizar harnesses/fixtures e acrescentar a regressão onde a causa for confirmada.
- `AGENTS.md`, Fluxo de ambientes/Quality Gates/Database Safety and Backup Policy: staging primeiro e Vault quando aplicável. `package.json`, scripts: comandos reais dos quatro gates.

Não há orientação específica para essa falha nos documentos genéricos de arquitetura disponíveis. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; consultar stories relacionadas apenas quando o diagnóstico comprovar conexão. Não inferir que a alteração de Lider Comercial causou ou resolve o caso.

**[AUTO-DECISION] Escopo:** usar o relato direto como origem, sem inventar causa, solução, epic ou tarefa externa. Identificação/ambiente podem ser confirmados em paralelo pelo executor principal; investigação somente leitura e testes sintéticos continuam úteis. Ready significa prontidão para diagnosticar, não causa aprovada nem testes concluídos.

## Tarefas / subtarefas

- [x] Registrar sintomas, incertezas, limites, referências e checklist de draft.
- [x] Confirmar ambiente/release e identidade exata do caso por leitura; coletar evidência sanitizada (AC 1).
- [x] Reproduzir ambas as falhas com fixtures/harness e documentar causa comprovada ou lacunas (AC 2).
- [x] Implementar correção mínima da causa comprovada sem relaxar proteções (AC 3–4).
- [x] Acrescentar regressões salvar/concluir e negações/concorrência/idempotência pertinentes (AC 4–5).
- [x] Conferir ausência de mutações reais e necessidade eventual de gate Vault (AC 5–6).
- [x] Executar quatro gates completos e revisão QA (AC 7).
- [x] DevOps publicar/validar staging e registrar release/smoke (AC 7).
- [x] Registrar autorização explícita posterior e QA de integração mínima main.
- [ ] DevOps publicar/validar produção e registrar READY/SHA/alias/smoke.
- [ ] Atualizar causa, checklist, File List, status, evidências e limitações (AC 8).

## Testing

Priorizar regressão que falhe antes e passe depois da correção comprovada, com cenário sintético equivalente ao caso. Cobrir salvamento válido, conclusão válida, falta de acesso, requisitos pendentes, versão concorrente e repetição pertinentes. Verificar atomicidade e resultado real das ações. Smoke staging distingue disponibilidade/versão de teste visual autenticado; não criar, editar, concluir ou movimentar registros reais para testar.

## CodeRabbit Integration

- **Story Type Analysis:** diagnóstico/correção backend com integração frontend; secundário Security; complexidade a confirmar após diagnóstico.
- **Specialized Agents:** @dev diagnóstico/implementação/Pre-Commit; @qa regressões e evidência; @architect se surgir mudança de contrato; @devops publicação staging; Vault quando aplicável.
- **Quality Gates:** Pre-Commit: diff, regressões e quatro gates; CodeRabbit se disponível, documentando ausência/revisão alternativa. Pre-PR por DevOps se aplicável; conferir destino/escopo antes do deploy staging. Produção somente após validação staging e autorização explícita posterior, agora recebida.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL e HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** causa comprovada, ACL, requisitos, CAS, atomicidade, idempotência, erros seguros e preservação de dados reais.

## Validação da preparação — @sm

Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Ambiente/identidade e causa são tarefas explícitas de diagnóstico; esta preparação não comprova reprodução, correção, testes ou publicação.

## Dev Agent Record e File List

### Diagnóstico sanitizado

- Usuário confirmou **produção** e informou que a tarefa foi aberta por notificação cerca de 20 minutos antes; suspeitou que tivesse sido concluída sem atualizar a tela. SELECT direto, sem chamadas do app com efeitos colaterais, encontrou um único card operacional correspondente ao nome informado, ATIVO em Documentação em análise, etapa não final, sem vínculos, cancelamento ou arquivamento. A tarefa documental retornada continuava PENDENTE, sem concluidaEm. Não houve conclusão manual para testar.
- Há duas contas Maria ativas no Operacional; somente uma é responsável/membro do card. Não se presumiu identidade a partir do primeiro nome nem houve impersonação. A correção não depende do nome de usuário/empresa.
- **Bloqueio de conclusão comprovado:** tarefa persistida usa formato `docupdate:<cardId>:<referenciaMs>:<ciclo>`, criado pelo monitor documental. `concluirTarefaSchema` aceitava somente cuid/rdtask/crm-proximo-contato e rejeitava tanto docupdate quanto docpend antes do lookup/ACL. A action devolvia erro de validação como objeto; hook convertia em mensagem genérica. Isso é compatível com a ausência de logs ConcluirTarefaBpm; não foi uma conclusão gravada nessa tarefa.
- **Erro técnico ao salvar comprovado na operação:** logs de produção exibem três `[AtualizarCardBpm] DriverAdapterError: SQLITE_BUSY: database is locked` às 18:40/18:43/18:45 UTC na release anterior. Os logs não contêm correlação suficiente para atribuir todas as ocorrências a este card/conta. O caminho de salvamento não retomava transação abortada por contenção, embora movimentos já usem helper canônico específico. Reproduzido em harness com o mesmo erro dentro da atualização transacional.
- Evidências privadas somente leitura, fora do Git: `/tmp/crm-incidente-20261021-runtime-sanitizado.json`, `/tmp/crm-incidente-20261021-concluir-sanitizado.json`, `/tmp/crm-incidente-20261021-lcr-metadata-sanitizado.json`. Nenhum email, descrição/título real de tarefa, credencial, dump ou ID real precisa integrar esta story.
- Hipóteses de readonly e de UI stale foram examinadas, mas não estão demonstradas como causa deste caso. Nenhuma regra de acesso, requisito ou reconciliação UI foi relaxada/adicionada por suposição.

### Implementação

- Validação aceita estritamente as duas identidades reais do monitor: docpend com cardId válido e data civil válida; docupdate com cardId válido, timestamp inteiro seguro/data válida e ciclo positivo seguro, com tamanho limitado. Formatos anteriores preservados. ID embutido não concede autoridade: lookup usa a tarefa persistida e ACL existente antes e dentro da transação.
- Salvamento de card reutiliza `repetirTransacaoOcupada` existente, reiniciando somente a transação integral revertida por SQLITE_BUSY (até quatro tentativas, backoff limitado). Mantém autorização, CAS e auditoria/eventos transacionais. Edição concorrente após lock é recusada; erro de negócio não é repetido. Side effects após commit ficam fora do retry; contenção persistente retorna orientação segura, sem falso sucesso.
- Não foi aplicado retry à conclusão sem prova de lock nessa operação. Nenhum card/tarefa/usuário real foi atualizado; sem migration/seed/configuração/privilégio novo.

### File List

- `docs/stories/story-crm-erro-salvar-concluir-tarefa-maria.md`
- `src/actions/bpm/Cards.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/edicao-campos-card.test.ts`
- `tests/bpm/tarefas-checklist-actions.test.ts`

### Testes

- Regressão antes da correção: sete cenários novos falharam, oito passaram e 55 não selecionados em 2 arquivos (`/tmp/crm-incidente-20261021-regressao-antes-focada.log`). A primeira execução completa também registrou duas falhas em sequência de mock após rejeição antecipada; corrigir o parser consome o mock no cenário correto e elimina essa interferência.
- Após a correção: **5 arquivos / 91 testes PASS**, incluindo tarefa documental nativa/importada, identidades inválidas, ACL por card persistido, ausência de sessão, repetição/conclusão concorrente, cancelamento, requisitos/checklist, erro de realtime pós-commit, lock transitório/persistente e CAS revalidado após retry. Logs: `/tmp/crm-incidente-20261021-regressao-depois.log`.
- Diffcheck do escopo e ESLint focado aprovados. CodeRabbit indisponível; revisão independente QA/Anubis PASS. Gates completos aprovados e staging861 READY verificado; não há teste visual autenticado nem mutação de dados reais.
- Patch separado da entrega Lider Operacional. Base root87 contém mudanças concorrentes futuras de Instagram em Cards.ts; DevOps deve aplicar somente os hunks desta correção sobre o staging atualizado, sem substituir o arquivo inteiro e sem transportar código Instagram para produção.

## QA Results

**PASS / APPROVED** — QA/Anubis do código e integração inicial sobre2f, seguida de ratificação incremental sobre b71. Patch5 exato, Cards preserva Instagram e altera somente import/wrapper da transação/catch; parser estrito, lookup/ACL/CAS/side effects preservados. Quatro gates finais PASS no snapshot b71+patch. Após staging861 READY, QA ratificou integração mínima main3e880+cinco caminhos e identidade executável com o contexto inicial5e7be1ad, com quatro gates reais PASS698 arquivos/5.375 testes; publicação de produção autorizada posteriormente pelo usuário e pendente de verificação remota.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação do diagnóstico dos erros Operacional e checklist de draft | River (@sm) |

## Evidências DevOps antes da publicação staging

- Aplicação dos quatro hunks via `git apply --3way`, preservando Instagram. Contexto inicial `2f4d788b`: lint/build padrão/typecheck PASS; **698 arquivos/5.375 testes PASS**, 4 ignorados e 1 todo.
- Staging avançou alheio para `b71f2cb9f3c830ed415237ac75555543783aa100`, seis caminhos Instagram sem sobreposição com os cinco desta correção. Rebase limpo manteve os seis blobs e o patch-id estável dos quatro arquivos de código/testes `bddba8696c117f19beb8801ad767b7e5eba89019`. QA incremental ratificou a preservação.
- Gates finais reais repetidos no contexto atualizado b71+patch, todos em sequência: lint exit0 (zero erros/1.193 avisos preexistentes), **build padrão exit0 sem retry**, typecheck após build exit0, suíte completa **698 arquivos/5.376 testes PASS**, 4 ignorados e 1 todo. Logs: `/tmp/crm-incidente-maria-final-20261021-{lint,build,typecheck,tests}.log`; comandos: `/tmp/crm-incidente-maria-final-20261021-gates-progress.json`.
- Baseline anterior à promoção Maria: main/produção `3e8800f8`, alinhadas ao runtime2f que já estava publicado, contendo Lider Operacional e preservando Instagram sem Maria/b71. Release Operacional confirmado READY antes desta publicação independente.
- Somente URLs SQLite sintéticas nos gates; nenhum card/tarefa real foi salvo, concluído ou usado como teste. Nenhuma mudança de banco, permissão, dependência ou ambiente nesta correção. Sem teste visual autenticado.
- Staging `861e43d7ebe0731d07eef0b9efbf8e7ad857789d` READY no deployment `dpl_3L7JtADnbhgqrfFyAf9SBQk8K7WN`, ambiente custom staging, alias e smoke200/307/401 esperados conferidos. Evidência `/tmp/crm-incidente-maria-staging-20261021-deployment-evidence.json`. Root integrado por FF seguro87→861 com backup e preservação dos arquivos locais/ambientes; prova `/tmp/crm-incidente-maria-20261021-root-alignment.json`. O avanço concorrente5e3 de staging permaneceu preservado e não integra esta promoção.


## Promoção Maria autorizada para produção

- Pedido explícito do usuário, após staging validado: “manda bala pode fazer”. Candidato isolado sobre main `3e8800f82ddf98ccab05ce756f3fd6b52383579b`, delta exato dos cinco caminhos do File List. Nenhum transporte dos incrementos b71/5e3 por esta promoção.
- Código/testes do patch idênticos ao staging861; todo runtime/scripts/testes/configuração/dependências idêntico ao contexto inicial `5e7be1ad`, cujos quatro gates reais passaram: lint zero erros/1.193 avisos preexistentes, build padrão sem retry, typecheck após build, 698 arquivos/5.375 testes PASS, quatro ignorados e um todo. Somente sete arquivos documentais/memória diferem desse contexto. QA/Anubis ratificou a herança por identidade integral executável.
- Evidências locais: `/tmp/crm-incidente-maria-main-20261021-candidate.json`, `/tmp/crm-incidente-maria-20261021-gates-progress.json` e `/tmp/crm-incidente-maria-main-20261021-preflight.json`. CodeRabbit indisponível; revisão independente aprovada. Dívida de audit preexistente, nenhuma mudança em dependências/lockfile.
- Preflight de produção confirmou main3e880, alias de produção3e880 READY e nenhum deployment concorrente ativo. Metadados de ambiente baseline fresco201 incluem chave Instagram adicionada por outra sessão; nenhum valor/configuração foi alterado por esta promoção.
- Publicação usa GitSource main com target production, sem copiar ambiente staging. Nenhuma operação em banco/card/tarefa/usuário/permissão/configuração, nenhum teste autenticado sobre registros reais. READY/SHA/alias/smoke de produção serão registrados em prova externa após publicação, sem segundo push documental.
