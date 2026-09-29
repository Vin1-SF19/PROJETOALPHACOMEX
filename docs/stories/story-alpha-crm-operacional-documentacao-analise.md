# Story — Operacional: Documentação em Análise

## Status

Ready for Review — código validado; publicação do componente aguarda autorização específica e o cadastro documental ocorrerá pela UI.

## Story

**Como** analista do pipeline Operacional, **quero** acompanhar documentos pendentes, atualizar dados e registrar a evolução da análise no card, **para** conduzir a juntada documental com histórico e lembretes visíveis.

## Contexto

- Origem: pedido direto do usuário para a coluna **Documentação em Análise**.
- A etapa anterior, **Envio do Checklist Atualizado**, foi especificada para usar Excel anexado ao card nesta fase. `[USER-DECISION]` Nesta coluna, “checklist do Painel Alpha” significa o **checklist de procedimentos já existente no CRM/BPM**, não o módulo separado `/PainelAlpha/CheckList`. O Excel da etapa anterior permanece como artefato daquele fluxo.
- Não há `docs/stories/accumulated-context.md` nem `.aiox/gotchas.json` neste checkout. `[AUTO-DECISION]` A coerência entre stories foi verificada pela story da etapa anterior e pelos artefatos disponíveis.
- Todos os campos adicionados devem ser configuráveis em **Configurações → Campos e Formulários**. A configuração publicada deve reger exibição, edição e validação também no servidor.

## Campos e regras solicitados

1. **Documentos pendentes:** campo de seleção múltipla com opções cadastráveis. `[USER-DECISION]` As opções iniciais vêm dos documentos do checklist de procedimentos configurado no CRM/BPM. A analista pode acrescentar documentos necessários que não constavam do template original, sem perder as opções ou marcações já existentes. Sem checklist configurado, não inventar documentos.
2. **Dados cadastrais e operacionais:** permanecem editáveis durante a assessoria e a juntada documental, com permissões e validações já aplicáveis ao card.
3. **Histórico:** manter no processo as alterações e anotações relevantes sobre empresa e processo, com autor e data/hora quando o histórico do CRM oferecer esses metadados.
4. **Checklist existente no CRM/BPM:** usar os itens do procedimento associado ao card como seleção por checkboxes; preservar o Excel da etapa anterior como artefato daquele fluxo. O componente `STAGE_CHECKLIST` é configurável em Campos e Formulários; os documentos são cadastrados em Configurações → Checklists.
5. **Automações:** monitorar pendências, gerar alertas diários e uma cadência semanal que exija atualização do card ou anotação. Análise de extrato e montagem de planilha Excel são automações documentais **previstas**, sem contrato de entrada, saída ou gatilho definido neste pedido.

## Critérios de aceite

1. [ ] Na coluna Documentação em Análise, a analista consegue marcar mais de um documento como pendente e cadastrar uma opção adicional fora do template original; as opções e seleções persistem após reabrir o card.
2. [ ] O campo de documentos pendentes é configurável em Configurações → Campos e Formulários. Suas opções iniciais refletem os documentos do checklist de procedimentos configurado; opções extras podem ser cadastradas. O card respeita a configuração publicada e preserva registros existentes quando a lista de opções for editada.
3. [ ] Dados cadastrais e operacionais do card podem ser atualizados durante a assessoria, conforme as permissões existentes; alterações e informações relevantes ficam disponíveis no histórico do card.
4. [ ] Pendências permanecem visíveis e monitoráveis na etapa. O alerta diário identifica cards com documentos pendentes e evita duplicar o mesmo aviso no mesmo ciclo diário.
5. [ ] A cadência semanal identifica cards sem anotação de andamento por sete dias, gera tarefa rastreável para a analista responsável e evita duplicações no mesmo ciclo semanal.
6. [ ] O card usa o checklist de procedimentos CRM/BPM configurado para identificar itens concluídos e pendentes. Sem checklist configurado, não cria documentos presumidos e mostra ausência de template de forma clara. Não infere itens a partir da planilha Excel anexada na etapa anterior; upload não conclui um item sem vínculo documental definido.
7. [ ] A análise de extrato e a geração de planilha Excel não executam automaticamente até que seus gatilhos, entradas, saídas, validações e destino do arquivo sejam especificados; o pedido fica rastreado nesta story.
8. [ ] Testes cobrem seleção múltipla, opções provenientes do checklist configurado, opção fora do template, ausência de template, preservação/histórico, idempotência dos alertas e sincronização documental.

## Decisões pendentes e dependências

- **Vínculo do checklist:** inventariar como o checklist de procedimentos CRM/BPM é associado ao card e como seus documentos são marcados após upload. A fonte das opções iniciais já foi decidida; não substituir silenciosamente o Excel nem assumir equivalência entre suas linhas e itens do checklist.
- **Alertas:** `[USER-DECISION]` Tarefas no card para a analista responsável. O monitor verifica pendências em dias de calendário pelo cron existente; o pedido não especificou dias úteis nem hora fixa.
- **Cadência semanal:** `[USER-DECISION]` Somente uma anotação de andamento `ANOTACAO_REGISTRADA` reinicia o prazo de sete dias. O monitor cria tarefa para a analista; o cron existente determina o horário, sem bloqueio de movimentação ou escalonamento.
- **Automações documentais:** especificar análise de extrato e montagem da planilha Excel em story própria ou refinamento desta, com formato, regras de cálculo e revisão humana antes da execução.
- **Proteção de dados:** confirmar que documentos cadastrais, extratos e histórico continuam seguindo permissões e política de retenção existentes.

## Tasks / Subtasks

- [x] Inventariar a coluna, os campos configurados, o histórico do card, os alertas existentes e o módulo nativo de checklist (AC 1–6).
- [x] Mapear contrato entre card, opções adicionais e checklist de procedimentos CRM/BPM, sem presumir template ou documentos específicos (AC 1, 2, 6).
- [ ] Publicar o componente de checkboxes em Campos e Formulários; prévia e código prontos, pendente de autorização específica e template documental (AC 1, 2).
- [x] Confirmar que os dados operacionais herdados continuam no formulário da etapa e que anotações usam o histórico existente (AC 3).
- [x] Preparar monitoramento diário e cadência semanal com IDs por card/ciclo; ajustar após resposta às perguntas de produto (AC 4, 5).
- [x] Usar o checklist de procedimentos CRM/BPM configurado e permitir documentos exclusivos do card, inclusive o primeiro documento sem template (AC 6).
- [x] Documentar escopo das duas automações documentais previstas antes de implementar qualquer processamento (AC 7).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist e File List (AC 8).
- [ ] Se houver mudança de estrutura, seed/backfill ou mutação em massa no banco, cumprir o rito Vault do `AGENTS.md` antes de executar.

## Dev Notes / Testing

- Referências iniciais verificadas: `docs/stories/story-alpha-crm-operacional-envio-checklist-atualizado.md` e `src/actions/bpm/Checklists.ts`. O módulo separado `src/actions/checklist.ts` e `/PainelAlpha/CheckList` está fora do escopo desta story. Os pontos reais de integração e o modelo dos dados exigem inventário antes de implementar.
- Preferir testes de domínio e integração para atualização de opções, vínculo com card, histórico, alertas repetidos e upload; testar autorização sobre dados do cliente. Não criar teste que apenas replique a implementação.
- **Executor:** `@dev`; **quality gate:** `@qa`; ferramentas: lint, typecheck, testes, build e revisão da configuração publicada.

## 🤖 CodeRabbit Integration

- **Tipo:** API/integração com frontend; complexidade alta pela dependência do checklist nativo e cadência.
- **Agentes:** `@dev` implementa, `@qa` revisa; `@architect` decide o contrato de integração se ainda não existir; `@devops` executa operações remotas.
- **Gates:** pré-commit por `@dev`; pré-PR e pré-deploy por `@devops` quando aplicáveis; observar autorização, idempotência, preservação de dados e sincronização após upload.
- **Self-healing:** `@dev` light, até 2 iterações/15 min para CRITICAL; HIGH documentado. `@qa` full, até 3 iterações/30 min para CRITICAL/HIGH; `@devops` check/report only.

## Checklist da story

- [x] Pedido do usuário e distinção entre checklist BPM e módulo separado registrados.
- [x] Critérios de aceite observáveis definidos sem inventar lista documental, calendário ou fluxo de extrato.
- [x] Decisões de canal/destinatário e anotação semanal resolvidas pelo usuário; sem documentos iniciais presumidos.
- [x] Implementação local e testes concluídos, com monitor condicionado ao componente publicado.
- [x] Quality gates executados e evidências registradas.
- [x] File List atualizada com todos os arquivos efetivamente alterados.

## File List

- `docs/stories/story-alpha-crm-operacional-documentacao-analise.md` — criação desta story.
- `src/lib/bpm/documentacao-analise.ts`, `src/lib/bpm/documentacao-analise-monitor.ts` — constantes, ciclo semanal e monitor.
- `src/actions/bpm/Checklists.ts`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard.tsx` — criação de procedimento exclusivo sem template, checkboxes dos documentos e adição de item fora do template.
- `src/app/api/bpm/jobs/automacoes/route.ts`, `scripts/bpm-documentacao-monitor.mts`, `package.json` — job e comando CLI.
- `scripts/configurar-documentacao-analise-operacional.mts` — prévia e publicação controlada do componente em Campos e Formulários.
- `tests/bpm/documentacao-analise.test.ts`, `tests/bpm/documentacao-analise-monitor.test.ts`, `tests/bpm/checklists-card-actions.test.ts` — cadência semanal, paginação/idempotência e primeiro documento sem template.

## Evidência de preparação

- Operacional v10, coluna `draft-stage-86098ead-66b3-4032-a920-04832b71dc0c`, ordem 3, formulário v2 com dados operacionais herdados; nenhum template de procedimento ou cadência cadastrado no pipeline.
- `[USER-DECISION]` O usuário cadastrará os documentos na UI. A prévia adiciona `STAGE_CHECKLIST` com rótulo **Documentos pendentes** e `obrigatorioSaida: false`, passando v10→v11 ou v11→v12 se a publicação pendente da etapa anterior ocorrer primeiro; nenhum card é alterado pela configuração.
- O CLI `npm run bpm:documentacao` retornou zero ações antes da publicação do componente, como esperado.
- Typecheck aprovado; lint sem erros (1.191 avisos preexistentes); 564 arquivos e 4.133 testes aprovados, 4 ignorados e 1 pendente; build aprovado. QA aprovou; após a revisão foi incluído teste de paginação e reexecução idempotente do monitor.
- Backup Vault dedicado para publicação v10→v11: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-29T20-27-38-322Z.sql`, manifesto adjacente, 179.078.126 bytes, 332 tabelas, 189.299 linhas, SHA-256 `87750797028be51ad6545a7ac7c82bc591ae393fadf065e8e42fa8b66176107d`. `scripts/verify-turso-backup.mjs` aprovou hash, integridade e restauração isolada. A publicação não foi executada.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Draft com critérios, dependência do checklist e decisões pendentes | @sm |

## Validação do draft

| Categoria | Estado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Etapa, campos e regra de configuração identificados. |
| Guia técnico | PARTIAL | Integração com checklist BPM exige inventário; cadência depende de decisão de produto. |
| Referências | PASS | Story anterior e módulos existentes apontados. |
| Autossuficiência | PARTIAL | Horário, canal e itens do checklist não foram definidos. |
| Testes | PASS | Cenários centrais e regressões explicitados. |
| CodeRabbit | PASS | Tipo, agentes, gates e self-healing registrados. |

**Resultado:** NEEDS REVISION para a cadência dos alertas antes de implementação completa; os campos e a integração com checklist BPM têm escopo suficiente para inventário e execução depois de validar o modelo existente.
