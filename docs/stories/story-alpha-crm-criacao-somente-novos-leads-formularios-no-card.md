# Story: Alpha CRM — criação somente em Novos Leads e formulários dentro do card

## Status

Ready for Dev

## Story

**Como** usuário autorizado do Alpha CRM,  
**quero** criar cards exclusivamente em **Novos Leads** e preencher os dados específicos de cada etapa dentro do card,  
**para que** todo lead percorra o funil pela entrada canônica e cada requisito seja exigido no momento correto.

## Contexto e supersessão

Esta story é a fonte de verdade mais recente para o ponto de entrada do pipeline. Ela supersede qualquer trecho, teste ou expectativa anterior que permita criação direta em **Fechado**, **Lost**, **Sem Viabilidade** ou qualquer outra etapa. Os respectivos guards continuam válidos para movimento/entrada por transição. Campos personalizados e controles nativos da etapa atual pertencem ao painel central, na aba **Formulário da Etapa** (`CardFullViewModal`/`PainelRegistrar`/`PainelCamposEtapaAtual`); requisitos de avanço ficam no painel esquerdo. Nunca antecipar esses controles no `NovoCardModal`.

[AUTO-DECISION] Como conciliar stories anteriores com esta regra? → Preservar as regras de domínio e remover somente a premissa de criação direta no destino (reason: decisão permanente registrada nas memórias do projeto).

## Acceptance Criteria

1. `PipelineBoardClient` exibe e habilita o botão `+` somente na primeira etapa canônica **Novos Leads**; nenhuma outra coluna oferece criação direta por mouse, teclado, estado residual ou callback reutilizado. Se Novos Leads não for a primeira etapa ativa, a criação falha fechada até a configuração ser corrigida.
2. A identificação de **Novos Leads** usa a etapa persistida/canônica do pipeline e sua primeira posição ativa, sem confiar no ID enviado pelo cliente.
3. `NovoCardModal` recebe somente o contexto necessário da entrada canônica e solicita apenas dados-base: empresa/CNPJ, responsável e serviço.
4. `NovoCardModal` não carrega, renderiza, valida nem envia `BpmCampo`, campos obrigatórios da etapa de destino, Motivo de Lost, status de Fechado, Próximo Contato, checklist ou qualquer guard futuro.
5. `CriarCardBpm` rejeita, antes de persistir, toda criação cujo destino não seja a etapa canônica **Novos Leads**, inclusive chamadas diretas, payload adulterado, ID válido de outra etapa e etapa de outro pipeline.
6. Dentro da transação, `CriarCardBpm` relê pipeline e etapa e repete a restrição; se a configuração mudar concorrentemente, falha sem card, empresa, membro, valor de campo, histórico ou outro efeito parcial.
7. A criação não exige nem persiste campos personalizados (`BpmCampo`/valores por etapa); os obrigatórios de **Novos Leads** passam a bloquear a **saída** da etapa e são preenchidos no detalhe do card.
8. A criação de empresa nova vinculada ao card permanece disponível somente no fluxo autorizado de **Novos Leads** e participa da mesma atomicidade da criação; tentativas em outros destinos não criam empresa órfã.
9. Campos personalizados da etapa atual, requisitos de transição e controles nativos aplicáveis aparecem no painel esquerdo, seção **Hoje**, preservando `PainelHistorico` como composição canônica e sem deslocá-los ao painel direito.
10. Os guards existentes de **Fechado**, **Lost**, **Em Tratativa**, **Sem Viabilidade** e demais destinos continuam autoritativos em `MoverCardBpm`/`SalvarRequisitosEMoverCardBpm`, inclusive drag, modal e chamada direta.
11. Falhas de autenticação ou autorização retornam antes de efeitos; apenas os perfis já autorizados a criar no pipeline podem criar em **Novos Leads**. A story não amplia papéis nem permissões.
12. Mensagens diferenciam sessão inválida, falta de acesso, destino inválido e conflito concorrente, sem expor IDs internos, configuração sensível ou dados de outros pipelines.
13. Rejeições não emitem realtime nem sinal de sucesso. Após commit bem-sucedido em **Novos Leads**, o evento canônico de criação invalida o pipeline sem incluir dados do lead no payload.
14. Ao receber realtime durante edição do card, o comportamento existente de preservação de rascunho/conflito permanece intacto.
15. Stories e testes de **Fechado**, **Lost** e **Sem Viabilidade** que afirmem criação direta são ajustados/supersedidos: casos de criação nesses destinos passam a esperar bloqueio; suas regras funcionais continuam cobertas via movimento e edição no card.
16. Não há alteração de schema, migration, seed, backfill, tabela, coluna, índice, constraint ou relação. Se surgir necessidade estrutural, interromper e acionar o fluxo Vault.
17. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam; a File List da story é atualizada antes da conclusão.

## Tasks / Subtasks

- [ ] 1. Restringir o entrypoint visual (AC: 1–4)
  - [ ] Remover o `+` das demais colunas e simplificar props/estado `camposNovoCard`/etapa do modal.
  - [ ] Reduzir o modal aos dados-base, com foco, teclado e mensagens acessíveis preservados.
- [ ] 2. Tornar a criação fail-closed no servidor (AC: 2, 5–8, 11–13)
  - [ ] Resolver a etapa canônica no servidor antes e dentro da transação.
  - [ ] Remover validação/persistência de campos personalizados da criação e garantir rollback integral.
  - [ ] Preservar auth/ownership, criação atômica de empresa, histórico mínimo e realtime pós-commit.
- [ ] 3. Consolidar formulários no card (AC: 7, 9–10, 14)
  - [ ] Garantir campos da etapa atual na seção Hoje e obrigatórios de Novos Leads na saída.
  - [ ] Preservar requisitos por destino, controles nativos, CAS e rascunho diante de realtime.
- [ ] 4. Superseder contratos antigos e ampliar testes (AC: 15–17)
  - [ ] Atualizar stories/testes de Fechado, Lost e Sem Viabilidade sem remover seus guards de movimento/edição.
  - [ ] Rodar os quality gates e atualizar checkboxes, notas e File List.

## Dev Notes

- Estado atual: `PipelineBoardClient` mostra `+` em todas as colunas, calcula `camposNovoCard` e envia etapa/campos; `NovoCardModal` renderiza campos e guards; `CriarCardBpm` aceita qualquer etapa e valida/persiste campos do destino.
- Destino: `PainelHistorico` já contém campos da etapa atual, requisitos, status de Fechado, Próximo Contato e checklist no lado esquerdo; reutilizar essa composição.
- A validação dupla (pré-transação + releitura transacional) é obrigatória contra TOCTOU. Nenhum erro pode deixar empresa/card/membro/campos/histórico parcial.
- Realtime é invalidação: publicar somente após commit e nunca transportar dados do lead.
- Fontes: `.bibble/rules/component-rules.md`; `.bibble/memory/decisions.md`; `.bibble/memory/integration-points.md` (seção “Alpha CRM — ponto único de criação e formulários dentro do card”).
- `docs/stories/accumulated-context.md` não existe neste workspace; a coerência acumulada foi obtida das memórias acima e das stories relacionadas, sem conteúdo inventado.

## Testing

- UI: `+` apenas em Novos Leads; ausência nas demais colunas; modal somente com dados-base; teclado/acessibilidade; nenhum campo/guard de destino.
- Action: sucesso autorizado em Novos Leads; sem sessão; sem acesso; outro destino; outro pipeline; payload adulterado; etapa renomeada/ausente/duplicada; mudança concorrente entre pré-check e transação.
- Atomicidade: nenhuma empresa, card, membro, campo, histórico ou realtime em falha; realtime único e pós-commit em sucesso.
- Fluxo: obrigatórios de Novos Leads bloqueiam saída, não criação; Fechado/Lost/Sem Viabilidade continuam validados por movimento e editáveis no card conforme suas regras.
- Regressão: rascunho/realtime do modal, drag, requisitos, checklist e status de Fechado permanecem funcionais.

## CodeRabbit Integration

**Primary Type:** Full-stack (Frontend + API/Security) · **Complexity:** High  
**Agents:** `@dev` (execução), `@qa` (gate), `@ux-design-expert` (apoio UI).  
- [ ] Pre-Commit: revisar auth, validação pré+transação, atomicidade, a11y, mensagens e payload realtime.
- [ ] Pre-PR: revisar regressões e compatibilidade das stories supersedidas.
**Self-healing:** `@dev` light, máximo 2 iterações/15 min; CRITICAL auto-fix, HIGH document-only.

## File List

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/actions/bpm/Cards.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/*` (contratos de criação, actions, UI, modal, realtime e etapas supersedidas)
- `docs/stories/story-alpha-crm-fechado-status-pos-fechamento.md`
- `docs/stories/story-alpha-crm-lost-motivo.md`
- `docs/stories/story-alpha-crm-sem-viabilidade-proximo-contato.md`
- `docs/stories/story-alpha-crm-criacao-somente-novos-leads-formularios-no-card.md`

## Story Draft Checklist Validation

READY — objetivo, escopo, contratos de UI/backend, auth, concorrência, mensagens, atomicidade, realtime, testes, supersessão, ausência de migration e File List estão explícitos e testáveis. Nenhum bloqueante identificado.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-08-13 | 1.0 | Story de supersessão criada e validada como Ready for Dev. | River (`@sm`) |
