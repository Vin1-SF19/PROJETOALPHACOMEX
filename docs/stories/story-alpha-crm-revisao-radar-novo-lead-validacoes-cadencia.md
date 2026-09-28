# Story: Revisão de Radar — Novo Lead, validações e cadência

## Status

Ready for Review — configuração dos três campos publicada e verificada; homologação funcional e revisão final pendentes.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `test`, `build`, `CodeRabbit` e homologação do board/NoLoss.

## Story

**Como** responsável comercial do Alpha CRM,
**quero** cadastrar e tratar leads na primeira coluna **Novo Lead** da **Revisão de Radar** com dados mínimos, sinais visuais e uma cadência de contato,
**para que** cada lead receba tratamento e siga apenas para **Agendar Reunião** ou **Stand By**.

## Contexto e precedência

Pedido explícito do usuário nesta conversa, para o pipeline **Revisão de Radar** reconstruído após o reset de 26/09/2026. O inventário de 26/09 registra `cmuih48la000009gmzw3wwuzf` como ID do pipeline reconstruído, mas IDs e configuração ativa devem ser relidos antes de implementar. O fluxo documentado mostra **Novo Lead → Agendar Reunião → Reunião Agendada → Em tratativas → Fechado**, com **Stand By** como saída. A primeira coluna é chamada **Novo Lead** nesse inventário; a grafia “Novos Leads” do pedido representa a mesma coluna.

Esta story substitui, somente para a Revisão de Radar reconstruída, os requisitos conflitantes da story antiga `story-alpha-crm-novos-leads-regras-automacoes.md`: **Confirmar serviço** deixa de integrar os obrigatórios deste pedido; a meta de **5 ligações por dia** deixa de ser requisito atual; a regra atual é **8 ligações em 8 dias**. Não transportar regras por nome ou IDs do pipeline antigo. A story `story-alpha-crm-criacao-somente-novos-leads-formularios-no-card.md` previa modal apenas com dados-base e obrigatórios somente na saída; o pedido de hoje prevalece para **Nome do responsável, CNPJ e Radar pretendido no cadastro manual**. Preservar campos específicos de outras etapas dentro do card.

O NoLoss já aparece como lead virtual no board e pode ser promovido pela action `PromoverNolossLead`. O fluxo deve distinguir cadastro manual de entrada NoLoss antes de aplicar a exceção de CNPJ. A story `story-alpha-crm-movimentacao-sem-obrigatoriedades-hardcoded.md` removeu exigências de campo impostas apenas por nome de etapa: implementar as regras novas na configuração persistida e/ou em contrato explícito de domínio da Revisão de Radar, com validação equivalente no servidor; não restabelecer bloqueios genéricos em outros pipelines.

Leitura remota somente leitura comunicada nesta sessão confirmou **9 etapas**, **0 `BpmCampo`**, transições de **Novo Lead** somente para **Agendar Reunião** e **Stand By**, nenhuma automação publicada da antiga meta de 5 ligações (apenas **Fechado → Financeiro**). Isso é um retrato temporal, não configuração aplicada por esta story. A implementação deve reler o estado antes de operar e preservar alterações concorrentes.

## Acceptance Criteria

1. No modal de cadastro **manual** de Novo Lead, **Nome do responsável**, **CNPJ** e **Radar pretendido** são visíveis e obrigatórios. Valores vazios ou somente espaços são recusados antes de criar o card, inclusive em chamada direta ao servidor.
2. O CNPJ do cadastro manual tem formato validado no cliente e no servidor, com mensagem acionável. A normalização de pontuação não altera o valor semântico nem permite um CNPJ inválido. A validação ocorre antes de qualquer persistência parcial.
3. **Radar pretendido** é um campo de seleção com exatamente estas opções, na ordem definida pelo usuário: **Habilitação de Radar 50k**, **Revisão de Radar Limitado a USD150k**, **Revisão de Radar Ilimitado**. Valor ausente ou diferente destas opções é recusado também no servidor; não aceitar texto livre.
4. **Canal de origem** fica disponível e visível no cadastro/detalhe; a ausência de canal não bloqueia a criação ou o avanço, pois o usuário não o marcou como obrigatório.
5. **Qualificação** oferece somente os status **Qualificado** e **Sem qualificação**. O estado selecionado aparece com destaque legível no card e no detalhe. A ausência de escolha não é tratada como um terceiro status nem como obrigatoriedade inventada.
6. A entrada proveniente do site **NoLoss** pode aparecer em Novo Lead **sem CNPJ**. Nesse caso, o card pulsa de forma identificável até ser aberto; ao abrir, o detalhe permite informar o CNPJ, mas esse preenchimento continua opcional para a origem NoLoss, inclusive ao avançar para **Agendar Reunião** ou **Stand By**. O servidor mantém a exceção restrita à proveniência NoLoss comprovada, sem permitir que um cadastro manual simule essa origem para contornar o obrigatório.
7. A identificação de “nunca acessado” é visualmente distinta de cards já abertos, inclusive quando não há CNPJ NoLoss. A primeira abertura efetiva do detalhe por usuário autorizado encerra o estado “nunca acessado”; refresh e atualização em tempo real mantêm o estado correto. A pulsação de NoLoss sem CNPJ e a marcação de nunca acessado continuam distinguíveis quando coexistem, respeitando preferência por movimento reduzido.
8. Um badge automático mostra o **canal de origem** no card. Para leads NoLoss, o canal é derivado das UTMs efetivamente recebidas/persistidas pelo fluxo de entrada; sem UTM útil, o badge usa apenas uma identificação de proveniência NoLoss, sem inventar campanha ou canal. O valor mostrado no card corresponde ao detalhe e não é aceito cegamente de payload manual adulterado.
9. A partir de Novo Lead da Revisão de Radar, os únicos destinos permitidos são **Agendar Reunião** e **Stand By**. Board, modal e actions aplicam a mesma matriz persistida; tentativa por drag, modal ou chamada direta para outro destino é recusada sem alterar card/histórico.
10. Para leads **sem resposta**, a cadência vigente exige **uma ligação registrada em cada um de oito dias úteis**. O primeiro dia é a **data útil de criação** do card, se ela for dia útil; caso contrário, o próximo dia útil. Contar oito dias úteis incluindo o primeiro, pelo dia civil de `America/Sao_Paulo`, excluindo sábados, domingos e **feriados nacionais**; feriados estaduais/municipais ficam fora por falta de fonte aprovada. Contar somente registros efetivos de ligação; outras atividades e ligações adicionais no mesmo dia não substituem a ligação de outro dia útil nem criam contador paralelo. O detalhe/board mostra dias cumpridos, ligações registradas por dia, pendências e data do oitavo dia útil.
11. Ao terminar o **oitavo dia útil** de um lead que ainda satisfaça o proxy operacional de sem resposta — permanece em **Novo Lead** e `proximoContatoEm` é `null` —, a automação o move para **Stand By** exatamente uma vez, com histórico que identifique automação, origem, destino e momento. Execução repetida ou concorrente não duplica movimento/histórico; card já movido ou com `proximoContatoEm` preenchido não é enviado automaticamente. Tentativas diárias ausentes devem permanecer visíveis no progresso; não inventar registros de ligação para completar a cadência.
12. A automação restringe consultas e mudanças ao pipeline/etapa vigentes da Revisão de Radar; falta de destino Stand By inequívoco ou dado essencial gera registro observável e não desloca o card para etapa errada. A rota/job é protegida pelo mecanismo de autenticação já usado no projeto e não registra segredo ou dados pessoais em logs.
13. A criação/edição preserva autorização, integridade e atomicidade. Falhas de validação não deixam card, empresa, campo, histórico ou evento em tempo real parcial. Estados visuais são atualizados após sucesso persistido.
14. Testes cobrem cadastro manual válido/inválido, exceção NoLoss sem CNPJ, impossibilidade de forjar origem, select de Radar, qualificação, UTMs/badge, abertura inicial, visual combinado/reduced motion, transições permitidas/proibidas, contagem de ligações, estado “sem resposta”, oitavo dia, idempotência e segurança do job.
15. Antes de concluir, executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, registrar resultados e atualizar checklist e File List desta story.

## Regra futura fora do escopo

Para leads que **não responderam à IA**, o usuário quer futuramente **5 tentativas de ligação por dia**. Esta rotina **não integra os critérios atuais**, não deve ser exibida como meta atual e não deve bloquear ou antecipar a automação de oito ligações em oito dias. Uma story posterior definirá o evento canônico “respondeu à IA” e as regras dessa rotina.

## Decisões a confirmar no reconhecimento técnico

- O usuário definiu o ciclo como **uma ligação por dia durante oito dias úteis**, iniciando na primeira data útil que inclui a criação, com **feriados nacionais** excluídos. Feriados locais ficam fora desta fase por falta de fonte. O job deve operar após o encerramento do oitavo dia útil civil de `America/Sao_Paulo`; o horário efetivo do scheduler precisa seguir a infraestrutura vigente. `[AUTO-DECISION]` Não presumir feriados estaduais/municipais.
- O usuário definiu o proxy operacional de “sem resposta” como **permanência em Novo Lead + `proximoContatoEm = null`**. Esse proxy não prova ausência real de resposta, e qualquer alteração de `proximoContatoEm` deve impedir o envio automático. Uma ligação registrada não é presumida como resposta.
- Verificar quais UTMs chegam do NoLoss e onde ficam persistidas; não inferir `utm_source`, `utm_medium` ou campanha se estiverem ausentes. Verificar também a fonte persistida de “primeira abertura” antes de desenhar novo armazenamento.

## Tasks / Subtasks

- [x] Confirmar por leitura remota as 9 etapas, ausência de `BpmCampo`, duas saídas publicadas de Novo Lead e ausência da automação antiga de 5 ligações (AC 3, 9–12). Reler antes de alterar.
- [x] Reconhecer entrypoints de criação manual/NoLoss, fonte das UTMs, qualificação, primeira abertura e campo `proximoContatoEm` (AC 1–12).
- [x] Implementar no código as validações do cadastro manual, CNPJ, select de Radar e exceção NoLoss; os três campos persistidos foram publicados sob o gate Vault (AC 1–4, 6, 13).
- [x] Implementar no código qualificação, badge por canal/UTM, pulsação de NoLoss sem CNPJ e marca distinta de nunca acessado (AC 5–8). Homologação visual autenticada pendente.
- [x] Verificar as duas saídas já publicadas e integrar a validação do servidor e feedback do board sem escrever na matriz de transições (AC 9, 13).
- [x] Implementar a cadência de uma ligação por dia útil durante oito dias, com feriados nacionais e proxy operacional `Novo Lead + proximoContatoEm null`, e automação idempotente para Stand By (AC 10–12). Ativação/homologação no ambiente vivo pendente.
- [x] Criar `scripts/configurar-novo-lead-radar.mts` e conferir `--preview` com pré-condições de identidade, versão e inventário (AC 3–5).
- [x] Obter relatório Vault e backup dedicado verificado para o plano de publicação dos três campos; a evidência não substitui aprovação específica do usuário.
- [x] Após confirmação explícita e revalidação do backup/inventário, publicar os três campos com `--apply` e conferir auditoria, opções, formulário e integridade; transições e automações preservadas.
- [ ] Homologar no ambiente autenticado o cadastro manual, entrada NoLoss, badge, qualificação, primeira abertura, movimentação e cadência/cron após a publicação.
- [x] Reexecutar `npm run typecheck` após a última edição do script; passou em 2026-09-28. Revisão CodeRabbit/QA e homologação continuam pendentes (AC 14–15).

## Dev Notes

- Pontos de integração existentes: `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`, `PipelineBoardClient.tsx`, `src/actions/bpm/Cards.ts`, `src/actions/bpm/NolossLeads.ts`, `src/lib/bpm/noloss-leads.ts`, `src/lib/bpm/automacao-novos-leads.ts`, `src/app/api/bpm/jobs/automacao-novos-leads/route.ts`, `src/actions/bpm/Interacoes.ts` e o detalhe em `src/app/PainelAlpha/AlphaCRM/CardModal/`. Confirmar código ativo antes de editar.
- A story anterior registra `BpmInteracaoCard` com `tipo = "LIGACAO"` e histórico em `BpmCardHistorico`; reutilizar esses mecanismos se continuam sendo os contratos vigentes. Não criar contador, tabela ou campo apenas por conveniência.
- O arquivo `docs/stories/accumulated-context.md` não existe neste workspace no momento do rascunho; a coerência veio das stories e do diagnóstico citados acima.
- A leitura remota inicial confirmou `BpmCampo = 0`. Após autorização específica e backup revalidado, `scripts/configurar-novo-lead-radar.mts --apply` publicou Radar pretendido, Canal de origem e Qualificação no Turso. Leitura posterior confirmou `configVersion=12`, três campos, formulário versão 2, auditoria de `adminId=8` e zero violações de chave estrangeira. A matriz Novo Lead → Agendar Reunião/Stand By já estava publicada e foi preservada.
- O proxy de “sem resposta” é **estritamente operacional**: permanência em Novo Lead e `proximoContatoEm = null`. Não equivale a confirmação de que o lead não respondeu por telefone ou à IA. A automação usa esse proxy; não alterar a redação para “resposta comprovada”.
- **Vault:** `docs/reports/vault-revisao-radar-novo-lead-2026-09-28.md` documenta ambiente Turso de produção, prévia do `--apply`, impacto, rollback e backup dedicado verificado em `database-backups/pre-change/` com manifesto. O relatório está **BLOQUEADO para escrita** até confirmação específica; revalidar backup (limite de 48 horas), hash, restauração, versão e inventário antes de qualquer aplicação. O backup fica fora do Git. Nenhuma migration, seed/backfill, mutação em massa ou publicação foi executada nesta etapa.

## Testing

- Unitário/domínio: CNPJ manual, origem NoLoss não forjável, as três opções exatas de Radar, derivação de canal sem UTM, contagem de ligações, criação em dia útil/não útil, feriados nacionais e limiar de expiração.
- Integração/action: criação atômica, edição opcional de CNPJ NoLoss, transições, abertura inicial, autenticação do job e idempotência/concorrência.
- UI: modal manual, badge e qualificação no card, estado nunca acessado, pulsação NoLoss, movimento reduzido e rollback de drag.
- Regressão: outros pipelines, cards antigos, criação apenas na entrada canônica e formulários de etapas posteriores.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** API/Business Logic. **Secondary Types:** Frontend, Integration e Security. **Complexity:** alta.

### Specialized Agents

`@dev` executa; `@qa` valida; `@ux-design-expert` revisa distinção visual/acessibilidade; `Vault` participa apenas se surgir operação de banco coberta pela política; `@github-devops` cuida de PR/deploy.

### Quality Gates

- [ ] Pre-Commit (`@dev`): lint, typecheck após última edição, testes, build e CodeRabbit no diff; nenhuma issue CRITICAL pendente.
- [ ] Pre-PR (`@github-devops`): revisão de integração NoLoss, concorrência e regressões.
- [ ] Pre-Deployment (`@github-devops`): verificar scheduler, segredo e configuração ativa da Revisão de Radar.

### Resultados parciais dos gates

- `npm run lint`: passou.
- `npm run typecheck`: passou após a última edição do script em 2026-09-28.
- `npm test`: passou, **532/532 arquivos e 3944 testes**.
- `npm run build`: passou, **78 páginas**.
- CodeRabbit, QA, deploy do código e homologação autenticada: pendentes. A configuração dos campos foi publicada e verificada; estes resultados não significam entrega funcional concluída.

### Self-Healing

`@dev`: light, até 2 iterações/15 min, corrigir CRITICAL e documentar HIGH. `@qa`: full, até 3 iterações/30 min, corrigir CRITICAL/HIGH. `@github-devops`: check/report only.

### Focus Areas

Validação e autorização no servidor, origem NoLoss não forjável, UTM sem inferência, primeira abertura persistente, acessibilidade de animação, matriz de transições configurada, timezone/calendário confirmado, idempotência e ausência de dados pessoais em logs.

## Story Draft Checklist Validation

| Categoria | Status | Observação |
| --- | --- | --- |
| Goal & Context Clarity | PASS | Pipeline reconstruído, precedência e resultado estão explícitos. |
| Technical Implementation Guidance | PASS | Entry points e contratos existentes identificados; reconhecimento exigido. |
| Reference Effectiveness | PASS | Histórias anteriores e diagnóstico têm relevância resumida aqui. |
| Self-Containment Assessment | PASS | Marco, feriados nacionais e proxy operacional de “sem resposta” foram definidos; limite do proxy registrado. |
| Testing Guidance | PASS | Casos de domínio, ação, UI, automação e regressão definidos. |
| CodeRabbit Integration | PASS | Tipos, agentes, gates, self-healing e focos definidos. |

**Final Assessment:** READY como especificação. Código implementado e configuração persistida publicada; deploy, homologação e revisão final continuam pendentes. Clareza: 9/10.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Rascunho para o pipeline reconstruído e o pedido atual; divergências da story antiga e decisões pendentes explicitadas. | River (SM) |
| 2026-09-28 | 0.2 | Opções exatas de Radar, leitura remota, oito dias úteis com feriados nacionais e proxy operacional definidos. | River (SM) |
| 2026-09-28 | 0.3 | Progresso de código e gates parciais registrado; configuração protegida e homologação permanecem pendentes. | River (SM) |
| 2026-09-28 | 0.4 | Publicação autorizada dos três campos no Turso e verificação posterior registradas; deploy/homologação pendentes. | Codex |

## Dev Agent Record

### Completion Notes

Código e testes preparados nos arquivos abaixo. Os três campos foram publicados no Turso por transação autorizada após `--preview`, com resultado no relatório Vault. Revisão final, deploy e homologação pendentes.

### File List

- `docs/stories/story-alpha-crm-revisao-radar-novo-lead-validacoes-cadencia.md` — story criada.
- `docs/reports/vault-revisao-radar-novo-lead-2026-09-28.md` — relatório de impacto, backup e gate de publicação.
- `scripts/configurar-novo-lead-radar.mts` — configuração protegida dos três campos; prévia e aplicação autorizada executadas.
- `src/actions/bpm/Cards.ts` — validação/criação e dados do board.
- `src/actions/bpm/NolossLeads.ts` — promoção NoLoss.
- `src/lib/bpm/novos-leads.ts` — regras de Novo Lead e cadência.
- `src/lib/bpm/automacao-novos-leads.ts` — automação de Stand By.
- `src/lib/bpm/noloss-leads.ts` — origem/UTMs NoLoss.
- `src/lib/validations/bpm.ts` — contratos de entrada.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx` — cadastro manual.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — sinais visuais e movimento.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal.tsx` — detalhe do lead NoLoss.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal.tsx` — promoção NoLoss.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` — detalhe do card e primeira abertura.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PreencherCnpjNoloss.tsx` — CNPJ opcional de NoLoss.
- `tests/bpm/automacao-monitoramento.test.ts` — regressão da automação.
- `tests/bpm/automacao-novos-leads-tentativas.test.ts` — cadência e movimento.
- `tests/bpm/board-polling-react.test.ts` — atualização do board.
- `tests/bpm/cnpj-mascara.test.ts` — CNPJ e máscara.
- `tests/bpm/novo-card-modal-react.test.ts` — cadastro manual.
- `tests/bpm/novos-leads.test.ts` — regras de Novo Lead.
- `tests/bpm/promover-noloss-lead.test.ts` — promoção NoLoss.
- `tests/bpm/noloss-lead-modal-react.test.ts` — detalhe NoLoss.

## QA Results

Pendente: revisão CodeRabbit/QA, deploy do código e homologação autenticada.
