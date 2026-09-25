# Story — Financeiro: Elaboração do Contrato

## Status

In Progress — configuração da segunda etapa presente em produção. Correção local do diálogo de entrada pronta, com quality gates aprovados; deploy e smoke autenticado da movimentação pendentes.

## Story

**Como** integrante do Financeiro, **quero** conferir os dados recebidos de Solicitação de Contrato, registrar a elaboração e o envio para assinatura, **para** acompanhar a assinatura de um contrato que reflita a contratação validada.

**Escopo:** segunda etapa do pipeline Financeiro, `Elaboração do Contrato`, entre `Solicitação de Contrato` e `Formalização`. Esta story não redefine a primeira etapa nem exige a assinatura concluída para sair da segunda: o envio deve iniciar a espera pela assinatura.

## Campos da etapa

| Campo | Comportamento solicitado |
| --- | --- |
| Contrato elaborado | Sim/Não |
| Data de elaboração | Preenchida automaticamente quando `Contrato elaborado = Sim` se estiver vazia; obrigatória nessa condição |
| Contrato enviado para assinatura | Sim/Não |
| Data do envio | Data/hora registrada automaticamente no evento de envio; obrigatória quando enviado |
| Link/arquivo do contrato | Obrigatório quando enviado; aceitar referência ou arquivo pelo fluxo autenticado já existente no card |

## Critérios de aceite

1. [ ] O formulário publicado em `Elaboração do Contrato` mostra os cinco campos acima e permite registrar os indicadores Sim/Não e o contrato. Os valores existentes de cards antigos continuam legíveis; configuração e validação usam a mesma identidade de campo ativo, independentemente do rótulo exibido.
2. [ ] Para marcar `Contrato elaborado = Sim`, o sistema confirma que os dados cadastrais exigidos na etapa anterior estão completos e válidos e que Serviço contratado, Valor bruto do contrato, Forma de pagamento e Condição negociada estão definidos. Caso haja pendência, a marcação é rejeitada com os nomes dos campos; o contrato usa os valores validados na etapa anterior, inclusive o valor efetivamente negociado.
3. [ ] Quando `Contrato elaborado = Sim`, `Data de elaboração` é obrigatória. Se estiver vazia no momento em que a marcação é aceita, o sistema registra a data automaticamente. Uma data já informada é preservada; salvar novamente não altera a data registrada.
4. [ ] `Contrato enviado para assinatura = Sim` só é aceito se `Contrato elaborado = Sim` estiver válido. O envio exige `Link/arquivo do contrato` e data do envio; se faltar contrato, a alteração é bloqueada com pendência nominal. Não é possível registrar envio de contrato ainda não elaborado.
5. [ ] Na primeira marcação válida de `Contrato enviado para assinatura = Sim`, o sistema registra automaticamente a data **e hora** do envio, atualiza `Status do contrato/assinatura` para `Aguardando assinatura` e cria acompanhamento da assinatura no mecanismo de tarefas/acompanhamento já disponível. Regravar o card ou repetir a operação não duplica acompanhamento nem muda o instante original do envio.
6. [ ] Mudança posterior em dado cadastral ou em Serviço contratado, Valor bruto do contrato, Forma de pagamento ou Condição negociada gera alerta visível no card para conferir se o contrato elaborado/enviado precisa ser atualizado. O alerta identifica os dados alterados e não substitui silenciosamente o contrato já registrado.
7. [ ] O avanço real para `Formalização` aplica as mesmas regras dos itens 2 a 5 no servidor, sem salto de etapas. Com contrato elaborado, data de elaboração, envio válido, data/hora do envio e link/arquivo presentes, o avanço ocorre; com pendências, permanece na etapa e retorna a lista nominal de campos. Dados preenchidos no formulário ativo não podem ser rejeitados por exigência de chave legada, inativa ou rótulo hardcoded.
8. [ ] Quando existir integração de elaboração/assinatura de contratos aplicável ao card, o fluxo usa o contrato e o estado dessa integração sem duplicar registro ou envio. Se não houver integração configurada, o fluxo manual dos itens 1 a 7 permanece funcional. A escolha de provedor, credenciais e disparo externo dependem de contrato de integração existente e não são presumidos por esta story.
9. [ ] Entrar em `Elaboração do Contrato` não exige que `Contrato elaborado` ou `Contrato enviado para assinatura` já estejam preenchidos. O diálogo de movimento exige somente campos marcados para entrada; os dois indicadores permanecem no formulário do card após a entrada, para preenchimento e validação durante a etapa.

## Tarefas / checklist de execução

- [x] Inventariar, em somente leitura, a composição publicada da segunda etapa, campos ativos/inativos, chaves e requisitos; identificar precisamente os bloqueios no avanço (AC 1, 7).
- [x] Reconciliar campos configurados com validação, salvamento e transição; manter uma fonte de identidade por campo e compatibilidade de cards existentes (AC 1, 7).
- [x] Preparar requisitos configuráveis de conferência da contratação e dos dados cadastrais para salvamento e transição real (AC 2, 7).
- [x] Implementar padrões configurados para data de elaboração e instante do envio, preservando valores preexistentes (AC 3, 5).
- [x] Preparar bloqueio configurável do envio sem elaboração/contrato e automação configurável de status e acompanhamento (AC 4, 5).
- [x] Preparar automações configuráveis de alerta para alterações posteriores nos 14 dados relevantes (AC 6).
- [x] Conferir integração existente: ação configurável `GERAR_CONTRATO` no Gerador de Documentos; nenhuma automação ativa vinculada à segunda etapa no Turso. O fluxo manual permanece (AC 8).
- [x] Gerar plano somente leitura: 5 campos publicados, 18 requisitos e 15 automações; registrar backup completo e snapshot seletivo Vault.
- [ ] Publicar configuração após autorização específica do usuário e verificar o fluxo autenticado, inclusive cards antigos, anexos e erro nominal por campo (AC 1 a 8).
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List antes da conclusão local (lint: 0 erros, avisos preexistentes; testes na worktree seletiva: 511 arquivos/3.828 casos aprovados; build concluído).
- [x] Corrigir o diagnóstico de movimento para aplicar `obrigatorioEntrada` somente na entrada do destino, sem exigir indicadores que devem ser preenchidos durante a elaboração; teste de regressão e quality gates locais aprovados (AC 9).
- [ ] Publicar a correção do diálogo e confirmar no card autenticado que a entrada em Elaboração é liberada e os campos aparecem dentro da segunda etapa (AC 1, 9).

## Contexto e pontos de integração

- **Etapa anterior:** `docs/stories/story-financeiro-novo-contrato.md`, critérios 2 a 5 e 10, define quais dados são validados e a identidade do valor negociado. A implementação anterior publicou os campos da primeira etapa; seu smoke visual autenticado ainda está pendente no registro da story.
- **Pipeline base:** `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md` define seis etapas sequenciais, bloqueio nominal de pendências e anexos pelo fluxo autenticado do card.
- **Código atual:** o fluxo hardcoded anterior foi removido no commit `81ba6063`. Salvamento e transição passam a consultar o formulário publicado e `BpmRequisito`; automações consultam versões publicadas no motor central.
- **Pontos existentes:** `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` renderiza campos da etapa; `src/actions/bpm/Campos.ts` persiste respostas; `src/lib/bpm/transicao-command.ts` prepara o avanço; `src/actions/bpm/Cards.ts` executa movimento; `src/lib/bpm/automacoes.ts` e `src/lib/bpm/automacoes/central-runtime.ts` tratam automações. Confirmar interfaces concretas antes de codificar.
- **Compatibilidade histórica:** há um valor `Data do envio` antigo com somente a data (`AAAA-MM-DD`). Ele será mantido sem inventar hora; o formulário informa que é preciso completar o horário ao editar. O plano altera o tipo publicado para `data_hora` somente após autorização.
- **Limite de banco:** cadastro/publicação de campos ou opções em produção, migration, backfill ou mutação em massa requerem relatório Vault, backup completo verificado com até 48 horas em `database-backups/pre-change/`, plano de impacto/rollback e confirmação explícita específica do usuário conforme AGENTS.md. Esta story não autoriza essas operações.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree. `[AUTO-DECISION]` Coerência conferida pela story anterior, story base, Constitution e código observado, sem inventar conteúdo ausente.
- **Integração externa:** `[AUTO-DECISION]` Tratar “quando aplicável” como uso de integração já configurada e identificada no inventário; não escolher provedor ou criar contrato externo sem requisito adicional.
- **Diagnóstico real de 25/09:** não há card ativo na segunda etapa. Os três cards de teste da primeira etapa falhavam ao avaliar a entrada porque (1) a transação HTTP no Turso expirava em 5 segundos e (2) `transicao-command.ts` cobrava os dois booleanos obrigatórios da etapa de destino já na entrada. Após ampliar o timeout e respeitar `obrigatorioEntrada`, a avaliação somente leitura dos três cards retornou `success: true`, sem movê-los.
- **Reteste informado pelo usuário:** o diálogo `Antes de mover para Elaboração do Contrato` ainda cobrava os dois indicadores da segunda etapa na entrada, embora o comando de transição já respeitasse `obrigatorioEntrada`. O inventário de produção confirmou os dois campos ativos, visíveis, editáveis e publicados no formulário da segunda etapa, com `obrigatorio=true` e `obrigatorioEntrada=false`; todos os requisitos publicados para a etapa estão em `DURING_STAGE`. A causa é a projeção divergente do diálogo, que usava `destino.obrigatorio` como exigência de entrada. Nenhuma alteração no banco é necessária.
- **Plano de publicação:** `scripts/financeiro-elaboracao-config.mts` é somente leitura sem `--apply`. Seleciona a etapa ativa `cmsd9yw74000ddzggndlvgbun`, altera tipos de `Data do envio` para `data_hora` e `Link/arquivo` para `url_ou_arquivo`, configura duas datas automáticas, 18 requisitos e 15 automações. A etapa homônima `elaboracao_contrato_legacy` está inativa e sem cards; não será modificada.
- **Vault:** backup completo `database-backups/pre-change/painelalpha_turso_pre_change_elaboracao_config_2026-09-25T17-42-13-450Z.db` validado por restauração (`integrity_check=ok`, 331 tabelas, 171.275 linhas, FK=0), SHA-256 `ad960a4aff973d18301e88a6f8060583ada72eb08983888205696cd5346a3d5a`. Snapshot seletivo `database-backups/pre-change/elaboracao-config-before-2026-09-25T17-42-33-799Z.json`. O inventário somente leitura deste reteste confirmou os campos e requisitos publicados; a correção atual não altera o banco.
- **Limite de verificação:** nenhum card real foi movido ou editado nesta implementação. A automação de geração de contrato existe no catálogo, mas não está configurada para a segunda etapa e depende de um template selecionado pelo administrador.

## Testes de aceite

1. Dados cadastrais ou de contratação faltando/inválidos impedem marcar elaboração e listam cada campo; conjunto completo permite marcar e grava a data uma vez.
2. Marcar envio antes da elaboração falha; elaboração sem link/arquivo falha; elaboração com contrato registra instante de envio, estado `Aguardando assinatura` e um acompanhamento.
3. Repetir salvamento/envio não altera datas nem duplica acompanhamento. Arquivo válido pelo fluxo autenticado satisfaz a condição de contrato.
4. Alterar serviço, valor, forma de pagamento, condição negociada ou dado cadastral após elaboração exibe alerta de revisão e preserva o contrato registrado.
5. Card com todos os valores no formulário publicado avança para `Formalização`; remover um obrigatório bloqueia com nome do campo. O mesmo cenário com campo legado inativo não exige preenchê-lo.
6. Card histórico com valores existentes permanece legível. Na ausência de integração externa configurada, elaboração/envio manual continuam operáveis.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integração; secundários API, Frontend e dados configurados; complexidade alta por validação de transição, automação e histórico.
- **Specialized Agents:** @dev implementa; @architect revisa identidade e evento de envio; @qa valida transição e idempotência; @ux-expert revisa alerta e formulário; Vault atua antes de mutação protegida; @github-devops conduz PR e deploy.
- **Quality Gates:** Pre-Commit (@dev): lint, typecheck, testes, build e revisão de campos ativos/legados. Pre-PR (@github-devops): conferir regressão de cards históricos e automações. Pre-Deployment (@github-devops): conferir configuração, evidência Vault e rollback quando houver mutação protegida.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, corrige CRITICAL; @qa full, até 3 iterações/30 min, corrige CRITICAL/HIGH e documenta MEDIUM; @github-devops check, apenas reporta.
- **Focus Areas:** bloqueio por chaves/rótulos hardcoded, consistência dos dados herdados, data/hora do envio, anexos autenticados, duplicação de acompanhamento, alerta após alteração e acesso ao formulário.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-elaboracao-contrato.md` — critérios, diagnóstico, checklist e registro.
- `scripts/financeiro-elaboracao-config.mts` — plano de leitura e publicação protegida da configuração.
- `src/lib/bpm/validacao-salvamento-configurado.ts` — padrões temporais e requisitos publicados no salvamento.
- `src/lib/bpm/transicao-command.ts` — requisito `REGRA` e referência autenticada de arquivo na transição.
- `src/actions/bpm/Cards.ts` — requisito no salvamento, eventos de alteração e arquivo vinculado.
- `src/lib/bpm/requisitos-etapa.ts` — obrigatoriedade contextual de origem/entrada no diagnóstico da transição.
- `src/actions/bpm/Anexos.ts` — upload em campo de link ou arquivo.
- `src/lib/bpm/campos-dinamicos.ts` — validação de data/hora e URL ou arquivo.
- `src/lib/bpm/regras/avaliador.ts` — comparação segura de campo vazio em condição.
- `src/lib/bpm/automacoes/central-schemas.ts` — opção de alterar status somente se vazio.
- `src/lib/bpm/automacoes/central-runtime.ts` — execução idempotente dessa opção.
- `src/components/bpm/automacoes/AutomacaoCentralFormDialog.tsx` — opção configurável no editor.
- `src/lib/validations/bpm.ts` — tipo configurável `url_ou_arquivo`.
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx` — entrada de data/hora e link/arquivo, aviso para data histórica.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` — arquivo atual do novo tipo.
- `tests/bpm/validacao-salvamento-configurado.test.ts` — padrões e requisitos no salvamento.
- `tests/bpm/requisitos-transicao-obrigatoriedade.test.ts` — regressão da entrada em Elaboração sem indicadores futuros já preenchidos.
- `tests/bpm/edicao-campos-card.test.ts` — mocks da persistência parcial diante do novo validador.
- `tests/bpm/cpf-pendencias-react.test.ts` — persistência UTC de campo `data_hora`.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft da segunda etapa, critérios e validação preliminar | River (@sm) |
| 2026-09-25 | 0.2 | Correções locais, diagnóstico da transição real em leitura e quality gates | Codex |
| 2026-09-25 | 0.3 | Remoção das rotas hardcoded anterior, implementação configurável e plano Vault de publicação | Codex |
| 2026-09-25 | 0.4 | Correção da exigência prematura dos indicadores no diálogo de entrada; 513 arquivos e 3.834 testes, lint, typecheck e build aprovados | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PARTIAL** (fluxo de acompanhamento, integração aplicável e representação de data/hora precisam de inventário antes da implementação); referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para investigação e implementação local.** Publicação/mutação de configuração protegida depende do checkpoint Vault.
