# Story: CRM — identidade no card de Agendar reunião e origem do lead no topo

## Status e responsáveis

Ready for Review — implementação e QA de escopo sem achados; testes focados, lint, typecheck e build Next com heap de 8 GB aprovados. Prévia local no navegador validada; reexecução da suíte completa ainda pendente após ajustar uma expectativa estática obsoleta. Não publicar antes de concluir esse gate. A mudança ainda não foi enviada/publicada em staging; produção não autorizada. Usuário confirmou **card pequeno do quadro Kanban**, sem alterações no modal. `@sm` prepara story; `@dev` implementa; `@qa` valida; `@devops` publica primeiro em staging quando autorizado.

## Story

**Como** usuário da Revisão de Radar, **quero** que o card em **Agendar reunião** tenha a identidade visual/informações que já aparecem em **Reunião Agendada**, mantendo as ações de agendamento, **para que** eu identifique o lead assumido e sua origem sem perder o fluxo da etapa.

No topo do card, a origem **Instagram** deve aparecer em roxo e a origem **Site** em azul, como a identificação atual do site. A origem continua visível depois que o lead virtual é assumido e vira card nativo.

## Escopo e evidência

- Pedido após o usuário assumir um lead de teste Instagram na Revisão de Radar. Base de desenvolvimento: `origin/staging` `aa8b6a6a`, worktree isolado `crm-card-origem-reuniao-20261021`.
- Escopo confirmado pelo usuário: **card pequeno do quadro**. Nenhuma mudança no modal. Visual de Agendar reunião = corpo padrão de Reunião Agendada + widget/ações de Agendar preservados. Origem no topo dos nativos assumidos: Instagram roxo, Site azul.
- Implementação efetiva: badge inline no `KanbanCard`, sem modificar `CardKanbanRenderer`. Compartilhar identidade, corpo e rodapé existentes com o widget de Agendar; consumir a origem já disponível na projeção, sem banco.
- `PipelineBoardClient.tsx`, `KanbanCard`: o ramo `agendarReuniao && !ehLeadVirtual` renderiza widget de data/Google Meet e composição configurada no lugar do corpo comum, ocultando a identidade em comparação com outras etapas. O código já restringe a ação de agendamento à etapa **Agendar reunião**.
- O card nativo possui `origem="real"`; `origem="instagram"` identifica o virtual, portanto não basta conferir essa flag para identificar Instagram depois de assumir. A projeção atual oferece `Canal de origem` nos campos e `veioNoloss` para a procedência do site; conferir a proveniência persistida existente e sua projeção antes de definir o badge.
- Instagram assumido usa `Canal de origem` persistido (`Instagram`/`ig`). O vínculo legado `veioNoloss` identifica o formulário do site e tem prioridade sobre textos de canal/UTM: lead do site com UTM Instagram continua Site. A passagem técnica da integração Instagram pela API NoLoss não cria esse vínculo legado nem transforma Instagram em Site. Não inferir origem de nome, etapa, cor ou ausência de outro vínculo.
- Inventário informado pelo agente principal, somente leitura em staging/produção: Agendar tem composição `EMPRESA_NOME` + `CNPJ`; Reunião Agendada não tem configuração explícita. A implementação respeita seleção configurada e composição vazia; não publicou nova configuração.
- Sem banco, migration, backfill, importação histórica, mudança de campos persistidos, Meet/calendário, env ou configuração de pipeline. UTMs/marketing continuam privados no NoLoss e ausentes da projeção comercial do CRM.

## Acceptance Criteria

1. Card nativo em **Agendar reunião** apresenta identidade e informações disponíveis no padrão visual de **Reunião Agendada** (nome/empresa, dados e composição existentes), sem substituir os valores reais nem criar novo dado obrigatório. Reusar o padrão visual/composição vigente, sem duplicar a mesma informação.
2. **Agendar reunião** conserva data/hora e as ações atuais: agendar Google Meet quando elegível e sem link; abrir Meet existente quando houver link. **Reunião Agendada** não ganha ação de agendar por compartilhar apresentação. Nenhuma lógica de calendário, criação de reunião ou transição muda.
3. Campo/badge de origem fica no topo do card pequeno nativo após assunção: **Instagram em roxo**, **Site em azul**, com texto legível e contraste/acessibilidade. Cor não é a única indicação de origem. Dados ausentes não recebem origem inventada. Nenhuma mudança no modal.
4. A origem usa os dados persistidos já fornecidos pela projeção e continua correta depois de assumir, atualizar o quadro, reabrir e mover o card. Instagram usa canal persistido; site comprovado pelo vínculo legado `veioNoloss` mantém Site mesmo com UTM/canal Instagram. Não reclassificar por payload local, nome ou simples passagem pela API NoLoss.
5. Apresentação e ações preservam ACL existente: usuário sem permissão não recebe ação de agendar/editar/mover que não possuía. Click nos controles não dispara abertura/drag indevido; abertura do card continua funcionando. Links externos mantêm os atributos e comportamento seguros existentes.
6. Composição configurável, SLA, responsável/membros, estado nunca acessado e indicadores existentes permanecem coerentes. Não afetar outras etapas/pipelines nem expor dados restritos pelo quadro/modal.
7. Card virtual Instagram conserva o fluxo personalizado/pulsante de assunção; card virtual do site mantém sua identificação. Não inserir UTMs, campanha, anúncio, adset ou formulário no card, modal, anotação ou payload comercial para produzir o badge.
8. Testes de apresentação cobrem Agendar reunião com/sem Meet e com composição configurada, Reunião Agendada sem ação de agendar, origem Instagram/site após assunção, origem ausente e ACL. Verificar que o badge se apoia no contrato de dados persistidos, não apenas em fixture de origem virtual.
9. Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` previstos no projeto; registrar resultados, atualizar checklist/File List e preparar resultado concreto de staging. Não declarar homologação de produção ou executar deploy de produção por este pedido de UI.

## Tasks / Subtasks

- [x] Registrar confirmação explícita do usuário: card pequeno do quadro; nenhum ajuste no modal.
- [x] Inspecionar ramo visual de Agendar reunião e campos de origem existentes, sem alterar código.
- [x] Conferir contratos de origem persistida/projeção e padrão de Reunião Agendada; inventariar composição somente leitura, sem alterar configuração.
- [x] Implementar apresentação comum e origem inline no topo, preservando ações/ACL, composição e os virtuais.
- [x] Cobrir o delta com testes focados: 5 suítes/58 testes PASS, incluindo 9 testes DOM novos; lint sem erros.
- [x] Concluir build Next equivalente com heap de 8 GB, typecheck e lint finais; resultados abaixo.
- [x] Concluir prévia local no navegador em quatro casos com CSS real, sem overflow/erros JavaScript e com clique de agendamento isolado.
- [ ] Concluir reexecução da suíte completa após retirar expectativa estática obsoleta; registrar veredito final antes de publicar.
- [ ] Validar resultado em staging quando autorizado e registrar evidências.
- [ ] Produção somente após autorização específica posterior; não integra a execução atual.

## File List

- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx` — badge inline e identidade/corpo/rodapé compartilhados, com widget de Agendar preservado.
- `src/lib/bpm/card-kanban.ts` — somente descrição do widget corrigida para informar que convive com os dados do card.
- `tests/bpm/card-campos-agendar-reuniao.test.ts` — remover expectativa estática que impunha ocultação do corpo; manter verificações operacionais e complementar com DOM.
- `tests/bpm/kanban-card-origem-agendar-react.test.ts` — novo teste DOM de identidade/composição/origem, ações por etapa e ACL.
- `tests/bpm/card-campos-novos-leads.test.ts` — retirar somente expectativa estática de origem restrita a `!novosLeads` e registrar substituição pela cobertura DOM de origem no topo em todas as etapas.
- `docs/stories/story-crm-card-origem-agendar-reuniao-20261021.md` — escopo, progresso e evidências parciais.

## Implementação e validação parcial

- `KanbanCard` mostra o badge no topo: Instagram roxo, Site azul, demais canais com tratamento neutro e origem ausente sem badge. A origem vem do canal persistido ou vínculo legado do site; não há nova consulta/escrita de banco, configuração ou transporte de marketing.
- Agendar reutiliza identidade visual padrão quando não há composição ou quando a composição inclui `EMPRESA_NOME`. Os quatro nativos de identidade (`EMPRESA_NOME`, `CNPJ`, `NOME_FANTASIA`, `SERVICO`) já exibidos no cabeçalho são filtrados da composição renderizada para evitar duplicação; a seleção efetiva, campos extras e composição explícita `[]` são respeitados. Widget e ACL continuam por etapa; corpo/rodapé comuns voltam a aparecer. `CardKanbanRenderer` permanece intacto.
- Testes focados: 5 suítes/58 testes PASS, incluindo 9 DOM novos. Lint final exit0 com 0 erros e 1.193 avisos legados. QA de escopo sem achados; veredito global permanece condicionado à suíte completa final.
- Preparação local: `npm ci --ignore-scripts` passou com `package-lock` intacto, seguido da geração normal de Prisma e player. A primeira checagem usou cache incompleto de `bfff` com `extenso`/player gerado ausentes; ambiente local recomposto sem mudanças de fonte, env ou dependências. Typecheck final exit0: `/tmp/crm-card-origem-typecheck-final.log`.
- A tentativa do build padrão esgotou heap de 3 GB. Reexecução equivalente pela CLI Next com heap de 8 GB passou, exit0, após gerar Prisma/player: `/tmp/crm-card-origem-build-final.log`. Isso comprova o build com memória ampliada; não afirmar que o comando padrão de 3 GB passou.
- Primeira suíte completa: 710 arquivos, 709 aprovados e 1 falha por expectativa estática antiga `!novosLeads && canalOrigem`, incompatível com a origem agora no topo em todas as etapas. Foi removida somente essa assertion em `card-campos-novos-leads.test.ts`, com comentário remetendo à cobertura DOM; nenhuma regra de produto foi afrouxada. Reexecução integral `/tmp/crm-card-origem-tests-green.log` em andamento; não declarar a suíte verde nem status Done antes do resultado.
- Prévia QA no navegador: quatro casos renderizados do fonte real com CSS, cartões de 260 px sem overflow e sem erros JavaScript; Instagram roxo, Site azul, Reunião Agendada sem ação de agendar e somente leitura sem ação indevida. Clique de Agendar registrou apenas `schedule`, sem abrir o card. Evidência `/tmp/kanban-card-origem-preview/verification.json`; imagem de entrega `/home/ialpha/projetos/entregas/preview-card-origem-agendar.png`. É prévia local com fixtures, não homologação autenticada publicada.
- DevOps conferiu staging existente somente leitura em `aa8b6a6a`, READY, com 201 entradas preservadas. Isso registra o ambiente antes da entrega; não significa que esta mudança de UI já foi publicada/homologada. Sem alteração ou publicação em produção.

## CodeRabbit Integration

Tipo: Frontend/UI com contrato de origem. `@qa` revisa identidade visual versus ação da etapa, ACL, proveniência após promoção, composição configurável e não exposição de marketing. QA de escopo e prévia local aprovados sem achados; aprovação final dos gates depende da reexecução integral pendente. Não foi declarada revisão automatizada inexistente.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Identidade visual de Agendar reunião e origem no topo; usuário confirmou escopo exclusivo do card pequeno no quadro | `@sm` |
| 2026-10-21 | 0.2 | Registrar implementação inline real, testes focados e revisão parcial; gates finais e staging ainda pendentes | `@sm` |
| 2026-10-21 | 0.3 | Build 8 GB/typecheck/lint e prévia local aprovados; adicionar sexto arquivo e manter suíte completa/publicação pendentes | `@sm` |
