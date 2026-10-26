# Story: distribuição automática de novos leads entre closers

## Status

In Progress

## Story

Como administradora do Alpha CRM, quero selecionar quais closers recebem leads do pipeline Revisão de Radar, para distribuir novas oportunidades igualmente entre as pessoas disponíveis sem perder leads que cheguem quando ninguém estiver online.

## Contexto

- `BpmCard.responsavelId` é obrigatório e os cards reais registram seu responsável também em `BpmCardMembro`.
- `NovoCardModal` permite seleção manual de responsável. Leads NoLoss e Instagram são exibidos como cards virtuais antes da conversão para `BpmCard`.
- `usuarios.ultimo_aviso` é atualizado pelo heartbeat a cada 20 segundos. A disponibilidade será considerada recente por até 60 segundos.
- A regra fica restrita a Revisão de Radar. O conjunto de closers é configurado por administrador, por pipeline; outros pipelines e fluxos comerciais permanecem sob as regras atuais.
- A atribuição deve permanecer estável entre atualizações do quadro e ser reaproveitada quando um lead virtual for convertido em card.

## Critérios de aceitação

1. Administradores podem ativar/desativar a distribuição e selecionar pelo menos um usuário ativo e elegível ao pipeline Revisão de Radar.
2. Ao criar um novo lead ou card no pipeline com a distribuição ativa, o backend escolhe exclusivamente entre os selecionados elegíveis; payloads do cliente não podem substituir essa escolha.
3. Com closers selecionados online, o próximo lead vai para quem recebeu uma atribuição há mais tempo no grupo online. Se nenhum estiver online, o mesmo rodízio considera todos os selecionados elegíveis.
4. Presença considera heartbeat com até 60 segundos. A ausência de heartbeat ou timestamp inválido significa offline.
5. Com conjunto estável de candidatos, as contagens de atribuição diferem por no máximo um lead. Mudanças de presença afetam apenas novas atribuições.
6. Leads NoLoss e Instagram recebem uma atribuição persistida ao chegar; repetição do mesmo webhook não cria outro turno. A promoção reaproveita o responsável e registra o membro `RESPONSAVEL` do card.
7. Leads recebidos sem candidatos elegíveis permanecem pendentes, sem perda nem card parcialmente criado. O processamento existente tenta atribuí-los após a configuração voltar a ter candidatos elegíveis.
8. A distribuição inicial não executa um segundo rodízio por automação de criação. Transferências posteriores continuam obedecendo às ações autorizadas existentes.
9. Configuração e atribuições são auditáveis. Não há mudança de responsável em cards existentes nem backfill de leads recebidos antes da ativação.
10. Migration é aditiva, aplicada e validada primeiro em staging após Vault, backup completo verificado de até 48 horas e confirmação explícita específica.

## Checklist

- [x] Adicionar configuração administrativa e validação server-side de candidatos.
- [x] Implementar serviço comum de elegibilidade, presença e rodízio persistente.
- [x] Integrar criação manual, NoLoss, Instagram e automações que criam cards em Revisão de Radar.
- [x] Reaproveitar responsável dos leads virtuais ao promovê-los e exibi-lo em lista, quadro e filtro.
- [x] Registrar pendências sem closer elegível e reprocessá-las pelo job de automações existente.
- [x] Criar migration aditiva e documentar a revisão Vault como pendente.
- [x] Cobrir rodízio, presença, idempotência, promoção e permissões com testes direcionados.
- [x] Executar lint e typecheck; atualizar File List e evidências dos gates.
- [ ] Aplicar migration e validar no staging após relatório Vault, backup verificado de até 48 horas e confirmação explícita.
- [ ] Obter aprovação completa de `npm test`; há falhas de ambiente e testes fora do escopo documentadas abaixo.

## Evidências

- `npm run lint`: concluído com 0 erros e avisos preexistentes no repositório.
- `npm run typecheck`: concluído sem erros.
- Testes direcionados da feature: 74 testes passaram; testes de regressão de encaminhamento: 25 passaram.
- `npm test -- --config vitest.noenv.config.ts`: 700 arquivos passaram e 20 falharam (2 testes falharam). As falhas restantes incluem indisponibilidade de `node:sqlite` neste Node, uma importação ausente de `next/server` e dois testes de UI com mocks incompatíveis.
- A migration foi apenas criada no workspace. Nenhuma migration foi aplicada, nenhum banco foi acessado para alteração e nenhum ambiente foi publicado.
- Os testes foram executados com configuração temporária que mantém o carregamento de ambiente fora do projeto. Nenhum arquivo `.env` foi aberto ou alterado por esta execução.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/20261026180000_bpm_closer_atribuicoes/migration.sql`
- `src/lib/bpm/closer-distribution.ts`
- `src/lib/bpm/atribuicao-closers-server.ts`
- `src/actions/bpm/AtribuicaoClosers.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/NolossLeads.ts`
- `src/actions/bpm/InstagramLeads.ts`
- `src/actions/bpm/Quadro.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AtribuicaoClosersSection.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`
- `src/app/api/bpm/noloss-leads/ingest/route.ts`
- `src/app/api/bpm/jobs/automacoes/route.ts`
- `src/lib/bpm/automacoes/distribuicao-oportunidades.ts`
- `src/lib/bpm/automacoes/encaminhamento.ts`
- `src/lib/bpm/cards-no-quadro.ts`
- `src/lib/bpm/instagram-leads-server.ts`
- `tests/bpm/closer-distribution.test.ts`
- `tests/bpm/cards-no-quadro.test.ts`
- `tests/bpm/cards-ordenacao-actions.test.ts`
- `tests/bpm/quadro-actions.test.ts`
- `tests/bpm/noloss-leads-ingest-route.test.ts`
- `tests/bpm/promover-noloss-lead.test.ts`
- `tests/bpm/instagram-leads-assumir.test.ts`
- `tests/bpm/instagram-leads-server.test.ts`
- `tests/bpm/encaminhamento-auditoria.test.ts`
- `tests/bpm/financeiro-operacional-handoff.test.ts`
- `docs/stories/story-alpha-crm-distribuicao-closers-novos-leads.md`
