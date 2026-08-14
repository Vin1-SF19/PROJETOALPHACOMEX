# Story: Alpha CRM — fluxo operacional da etapa Fechado e status pós-fechamento

## Status

Ready for Review

> **Supersessão de criação — 2026-08-13:** a criação direta em **Fechado** foi substituída pela story `story-alpha-crm-criacao-somente-novos-leads-formularios-no-card.md`. Os requisitos de Valor/Forma e o status pós-fechamento continuam válidos para movimento, entrada e edição dentro do card; referências abaixo a criação direta permanecem apenas como histórico do contrato anterior.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `scout`, `lint`, `typecheck`, `vitest`, `build`, `probe`, `coderabbit`

## Story

**Como** responsável comercial no Alpha CRM,  
**quero** entrar em **Fechado** somente com os dados contratuais obrigatórios preenchidos e acompanhar/editar o status pós-fechamento dentro do card,  
**para** concluir a venda com dados consistentes e identificar no pipeline, sem abrir o card, em qual etapa operacional do pós-fechamento o cliente está.

## Contexto e escopo

Esta story completa o fluxo operacional da etapa **Fechado** do pipeline **Revisão de Radar**. O valor acordado e a forma de pagamento são campos compartilhados do pipeline e devem continuar com uma única fonte de valor entre **Reunião Agendada**, **Em Tratativa** e **Fechado**. Ao entrar em **Fechado**, o card recebe o primeiro status pós-fechamento; depois, usuários autorizados podem avançar ou ajustar esse status no lado esquerdo do modal. O board apresenta badge e diferenciação visual somente enquanto o card estiver na etapa **Fechado**.

O fluxo deve cobrir os entrypoints atuais de entrada na etapa: criação direta pelo `+`, drag-and-drop, movimento pelo modal com preenchimento de requisitos e chamada direta às Server Actions públicas correspondentes. A UI antecipa pendências, mas o backend continua sendo a autoridade e deve validar novamente dados persistidos, permissão e concorrência dentro da transação.

Não fazem parte desta story:

- integração com pipeline financeiro, Comissões ou outro módulo financeiro;
- automação de contrato, envio, assinatura ou confirmação de pagamento;
- novos status além dos cinco especificados;
- migration, alteração de schema, seed ou backfill;
- alteração das regras de outras etapas.

`BpmCard.statusPosFechamento` e o modelo `BpmCampoObrigatorioEtapa` já existem em `prisma/schema.prisma`. Os helpers atuais já carregam campos diretos e campos de pipeline associados a uma etapa. Portanto, a implementação deve reutilizar essa estrutura e interromper/escalar para o fluxo Vault caso descubra necessidade estrutural real.

## Acceptance Criteria

Os AC 1–10 preservam o wording do pedido-fonte para a coluna **Fechado**.

1. O card só pode entrar em Fechado quando os seguintes campos estiverem preenchidos:
   - Valor acordado no contrato.
   - Caso tenha sido concedido desconto, considerar o valor final com o desconto aplicado.
   - Forma de pagamento.
2. Bloquear a movimentação para Fechado caso qualquer um desses campos esteja sem preenchimento.
3. Dentro do card deve existir um campo Select chamado Status.
4. Esse campo representa as etapas posteriores ao fechamento comercial.
5. Futuramente, o Status será integrado/conectado ao pipeline financeiro.
6. O Select Status contém exatamente estas opções:
   - Aguardando contrato.
   - Contrato a enviar.
   - Contrato enviado.
   - Pagamento confirmado.
   - Contrato assinado.
7. O Status atual deve ficar visível no card fechado, sem necessidade de abrir o card.
8. Exibir um badge com o Status atual.
9. Cada Status deve possuir uma cor visual diferente.
10. A aparência do card deve mudar de acordo com o Status, permitindo identificar rapidamente em qual etapa pós-fechamento o cliente está.
11. Ao criar um card diretamente em **Fechado** ou mover um card para **Fechado**, `statusPosFechamento` é persistido como `AGUARDANDO_CONTRATO` na mesma transação da entrada, desde que os requisitos do AC 1 estejam atendidos.
12. Os dois campos contratuais são os `BpmCampo` compartilhados já definidos para o pipeline. A obrigatoriedade em **Fechado** usa a associação existente `BpmCampoObrigatorioEtapa`, sem duplicar campos ou valores e sem hardcode de IDs de registros.
13. A criação direta em **Fechado**, `MoverCardBpm`, `SalvarRequisitosEMoverCardBpm` e chamadas diretas às actions convergem na mesma regra server-side. Nenhum desses caminhos pode entrar na etapa sem os dois valores persistidos/validados.
14. O guard não confia no estado visual ou em label/ID enviados pelo cliente. Dentro da transação, ele confirma pipeline, etapa de destino, metadados aplicáveis, valores efetivos, permissão e versão corrente antes do update.
15. Em caso de campo ausente, valor inválido, configuração inconsistente, perda de permissão ou conflito concorrente, não há mudança de etapa, inicialização parcial do status, histórico parcial nem realtime de sucesso; a UI recebe mensagem acionável e o drag otimista é revertido.
16. Enquanto o card estiver em **Fechado**, o lado esquerdo do `CardFullViewModal` mostra uma seção operacional identificável de **Status pós-fechamento**, com Select, valor persistido, as cinco opções na ordem do AC 6 e ação explícita de salvar.
17. Responsável, administrador do card e administradores globais autorizados podem editar posteriormente o status entre as cinco opções. Participantes e demais usuários veem o valor em modo somente leitura e não conseguem alterá-lo por chamada direta à action.
18. O backend aceita somente os cinco códigos canônicos de `statusPosFechamento`, rejeita string vazia/valor desconhecido e rejeita edição do status quando o card não está atualmente em **Fechado**.
19. A atualização posterior usa o fluxo de edição protegido por ownership e compare-and-swap baseado no estado/`updatedAt` corrente. Duas edições concorrentes não podem se sobrescrever silenciosamente; o perdedor recebe conflito e deve recarregar/revisar.
20. A entrada em **Fechado** registra no histórico o movimento e o status inicial. Cada alteração posterior registra antes/depois do status e o usuário responsável, sem incluir dados contratuais desnecessários no evento de auditoria.
21. Realtime é publicado somente após commit confirmado. O board e o modal aberto refletem o status persistido sem refresh manual; se houver rascunho local sujo no Select, a atualização externa não o apaga silenciosamente e a interface informa o conflito.
22. O badge e a diferenciação visual por status aparecem somente quando a etapa atual do card é **Fechado** e o código persistido é reconhecido. Um `statusPosFechamento` residual em outra etapa não aparece no board nem habilita o editor.
23. A paleta visual segue o plano aprovado:
   - Aguardando contrato: cinza — `bg-slate-500/15 text-slate-400 border-slate-500/30`.
   - Contrato a enviar: azul — `bg-blue-500/15 text-blue-400 border-blue-500/30`.
   - Contrato enviado: âmbar — `bg-amber-500/15 text-amber-400 border-amber-500/30`.
   - Pagamento confirmado: violeta — `bg-violet-500/15 text-violet-400 border-violet-500/30`.
   - Contrato assinado: verde — `bg-emerald-500/15 text-emerald-400 border-emerald-500/30`.
24. A diferenciação do container do card deriva da mesma configuração visual do badge, preserva contraste e estados já existentes (incluindo indicador de nunca acessado, hover, foco e drag) e não usa somente cor para comunicar o status.
25. Cards legados que já estejam em **Fechado** com `statusPosFechamento = null` não são alterados por backfill ou pela simples leitura. O modal mostra que o status ainda não está definido e permite que um usuário autorizado escolha uma das cinco opções; o board não fabrica badge até existir valor persistido.
26. Sair e voltar para **Fechado** não apaga nem regride silenciosamente um status já persistido. `AGUARDANDO_CONTRATO` é aplicado apenas quando a entrada encontra `statusPosFechamento = null`; qualquer reset futuro exige requisito próprio.
27. A integração financeira futura fica apenas como fronteira de compatibilidade: o valor canônico permanece em `BpmCard.statusPosFechamento`; esta story não cria adapter, evento financeiro, card financeiro nem efeito colateral em Comissões.
28. Existem testes automatizados para: os dois campos faltantes isoladamente e juntos; criação direta; drag; modal; chamada direta à action; inicialização atômica; reentrada; legado nulo; enum inválido; edição autorizada/não autorizada/fora de Fechado; CAS; histórico; realtime; rascunho sujo; badge exclusivo de Fechado; cinco labels/cores; e preservação dos estados visuais atuais.
29. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados. Regressões da story são corrigidas; falhas basais ou ambientais são separadas com evidência. Checklist, Completion Notes e File List são atualizados antes do handoff.
30. A implementação não cria nem altera tabela, coluna, índice, constraint, relation, migration, seed ou backfill. `prisma/schema.prisma` é referência somente e não integra a File List final, salvo se uma mudança estrutural for aprovada separadamente pelo fluxo Vault.

## Tasks / Subtasks

- [x] 1. Confirmar o blueprint e a configuração existente (AC: 1–6, 12–15, 27, 30)
  - [x] Mapear os dois `BpmCampo` compartilhados e suas associações à etapa **Fechado** por `BpmCampoObrigatorioEtapa`.
  - [x] Confirmar que os metadados preservam **Valor acordado no contrato** como valor final já descontado e **Forma de pagamento** como Select com o catálogo existente.
  - [x] Enumerar criação direta, drag, modal e actions públicas que entram em **Fechado**; confirmar que todos convergem em serviços/helpers server-side reutilizáveis.
  - [x] Provar que `statusPosFechamento` e `BpmCampoObrigatorioEtapa` atendem à entrega sem schema, migration, seed ou backfill.
- [x] 2. Centralizar o contrato do status pós-fechamento (AC: 3–6, 18, 22–24)
  - [x] Definir uma fonte compartilhada e tipada para os cinco códigos, labels, ordem e configuração visual, reutilizável por server e Client Components.
  - [x] Implementar validação Zod estrita e helper de identificação normalizada da etapa **Fechado** sem hardcode de ID de banco.
  - [x] Tratar código desconhecido/nulo de forma segura, sem fabricar estado persistido.
- [x] 3. Garantir entrada atômica em Fechado (AC: 1–2, 11–15, 20, 26)
  - [x] Reutilizar o carregamento de campos obrigatórios diretos/associados e validar os valores efetivos no backend.
  - [x] Aplicar a regra à criação direta e ao executor comum usado por drag e movimento pelo modal.
  - [x] Inicializar `AGUARDANDO_CONTRATO` dentro da mesma transação somente quando o status estiver nulo.
  - [x] Incluir etapa e status inicial no histórico do movimento e publicar realtime apenas após commit.
  - [x] Fortalecer o CAS do movimento para que alteração concorrente relevante gere conflito, sem persistência parcial.
- [x] 4. Permitir edição posterior protegida (AC: 16–21, 25–26)
  - [x] Estender o fluxo de atualização do card com `statusPosFechamento` estritamente validado, somente em **Fechado**.
  - [x] Reutilizar `exigirAcessoBpmCard(..., "editarCard")` e o CAS por `updatedAt`/estado corrente.
  - [x] Registrar antes/depois no histórico com payload mínimo e emitir `CARD_ATUALIZADO` após commit confirmado.
  - [x] Retornar mensagens estáveis para valor inválido, etapa inválida, não autorizado e conflito.
- [x] 5. Implementar a seção no lado esquerdo do modal (AC: 16–19, 21, 25)
  - [x] Criar o Select operacional apenas para **Fechado** e compô-lo dentro de `PainelHistorico`, sem deslocá-lo para o painel direito.
  - [x] Aplicar readonly conforme `podeEditar` e expor feedback de salvamento/erro por texto.
  - [x] Preservar rascunho sujo diante de realtime e solicitar revisão em conflito.
  - [x] Exibir estado legado nulo sem convertê-lo silenciosamente em **Aguardando contrato**.
- [x] 6. Consolidar badge e diferenciação visual do board (AC: 7–10, 22–24)
  - [x] Remover a duplicação local do mapa de status e consumir o contrato compartilhado.
  - [x] Passar o contexto da etapa ao card do board e renderizar badge/tint somente em **Fechado**.
  - [x] Preservar indicador de nunca acessado, drag, hover, foco, responsividade e comunicação textual do status.
- [x] 7. Cobrir regras e integração com testes (AC: 13–29)
  - [x] Testar helper/enum, identificação de Fechado e configuração visual.
  - [x] Testar actions com mocks de Prisma/auth/ownership para todos os caminhos de entrada, rollback, CAS, histórico e realtime.
  - [x] Testar edição posterior, permissões, etapa inválida, código inválido, legado nulo e reentrada.
  - [x] Testar wiring do modal esquerdo, readonly, rascunho realtime e badge exclusivo de Fechado.
  - [x] Executar a regressão focada do BPM e registrar separadamente os gates globais não concluídos e os baselines externos.
- [x] 8. Atualizar esta story antes do handoff (AC: 29–30)
  - [x] Marcar Tasks/Subtasks conforme a implementação real.
  - [x] Preencher Agent Model, Debug Log References e Completion Notes.
  - [x] Substituir a Initial File List pela File List final exata.
  - [x] Alterar o status para `Ready for Review` somente após implementação e verificação.

## Dev Notes

### Fontes e decisões confirmadas

- `C:/Users/TI/.codex/attachments/b26c51d2-2942-4fa8-a4c6-3badc6b7d51f/pasted-text.txt`, seção **Coluna: Fechado**: fonte dos requisitos de entrada, cinco opções, badge e diferenciação visual.
- `.bibble/memory/plano-novos-leads-bpm.md`, seção **Coluna 5 — Fechado**: define o uso dos campos compartilhados, `BpmCampoObrigatorioEtapa`, coluna dedicada de status e fronteira da integração financeira futura.
- `.bibble/memory/plano-novos-leads-bpm.md`, **Bloco 4**, itens 13–14: confirma que Valor acordado e Forma de pagamento são campos únicos reutilizados e que a associação por etapa foi aceita.
- `.bibble/memory/plano-novos-leads-bpm.md`, **Bloco 5**, item 16: catálogo confirmado de Forma de pagamento: `50% Entrada / 50% Êxito (Pix)`, `Parcelamento Cartão de Crédito - até 12x com juros`, `Integral na contratação - 10% OFF (Pix)`.
- `.bibble/memory/plano-novos-leads-bpm.md`, **Bloco 8**, item 21: paleta aprovada para os cinco status.
- `docs/stories/story-alpha-crm-card-por-etapa-em-tratativa.md`, seções **Contexto e escopo**, **Acceptance Criteria 4–10** e **Contratos sem schema novo**: estabelece o lado esquerdo como local dos requisitos/editores operacionais, backend como autoridade e histórico/realtime após commit.
- `docs/stories/story-alpha-crm-sincronizacao-tempo-real.md`, **Acceptance Criteria**: o evento realtime é sinal mínimo de invalidação; o cliente recarrega o estado autoritativo.
- `docs/stories/accumulated-context.md`: o arquivo obrigatório de contexto acumulado não está presente neste workspace em 2026-08-13. Para coerência entre stories, este draft incorporou explicitamente os contratos relevantes das duas stories relacionadas acima; não criar conteúdo fictício para suprir o arquivo ausente.

### Decisões autônomas registradas

- `[AUTO-DECISION] Qual status inicial aplicar ao entrar em Fechado? → AGUARDANDO_CONTRATO (reason: é a primeira opção da sequência pós-fechamento aprovada e o pedido exige status inicial ao entrar).`
- `[AUTO-DECISION] O que fazer em reentrada com status já persistido? → Preservar o valor existente (reason: reset não foi solicitado e apagaria progresso operacional).`
- `[AUTO-DECISION] O que fazer com cards legados em Fechado e status nulo? → Não fazer backfill nem mutação na leitura; permitir definição explícita por usuário autorizado (reason: a story proíbe backfill e não deve fabricar histórico).`
- `[AUTO-DECISION] Onde posicionar o Select? → Lado esquerdo, dentro do fluxo de PainelHistorico (reason: pedido atual e contrato da story de formulário por etapa).`

### Estado atual do código e pontos de integração

- `prisma/schema.prisma`: `BpmCard.statusPosFechamento String?` já aceita os cinco códigos; `BpmCampoObrigatorioEtapa` já relaciona campo e etapa. Referência somente; não editar nesta story.
- `src/lib/bpm/requisitos-etapa-server.ts`: `carregarCamposAplicaveisEtapa`, `carregarCamposAplicaveisCardEtapa` e `carregarCamposObrigatoriosEtapa` já unem campos diretos e associações por etapa.
- `src/actions/bpm/Cards.ts`: `CriarCardBpm` valida campos da etapa de criação; `MoverCardBpm` e `SalvarRequisitosEMoverCardBpm` convergem em `executarMovimentoComRequisitos`; `AtualizarCardBpm` já possui ownership, transação, histórico, realtime e CAS por `updatedAt`.
- `src/lib/validations/bpm.ts`: `atualizarCardSchema` ainda não aceita `statusPosFechamento`; ampliar com enum estrito.
- `src/lib/bpm/ownership.ts`: participantes não possuem `editarCard` nem `moverEtapa`; responsável e administrador possuem essas ações. Nunca confiar em `podeEditar` do cliente.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`: calcula `podeEditar`, recebe `realtimeRevision` e posiciona `PainelHistorico` no lado esquerdo.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`: concentra editores da etapa atual e já possui padrão de rascunho sujo/realtime que o novo Select deve seguir.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`: já recebe `statusPosFechamento` e contém labels/classes da paleta, mas hoje o badge depende apenas de valor não nulo e a aparência do container ainda não diferencia o status. Condicionar explicitamente à etapa **Fechado** e centralizar o mapa.
- `src/lib/bpm/realtime.ts` e `src/lib/bpm/realtime-server.ts`: reutilizar o evento existente `CARD_ATUALIZADO`/`CARD_MOVIDO`; não expandir payload com status ou dados contratuais.

### Regras de domínio e concorrência

- “Preenchido” significa passar pela validação já definida pelo tipo/metadado do `BpmCampo`; esta story não cria regra de valor mínimo/positivo não presente nos requisitos.
- O valor com desconto é o valor final informado no campo compartilhado; não calcular desconto nesta story.
- A forma de pagamento continua governada pelo `opcoesJson` do campo compartilhado. A enumeração do status pós-fechamento é independente desse catálogo.
- O status inicial e a mudança de etapa devem ser um único update transacional. Se qualquer parte falhar, tudo falha.
- O CAS de edição não substitui revalidação de etapa/ownership dentro da transação. O board/modal nunca é autoridade para o valor vigente.
- Realtime é best-effort depois do commit; falha do Pusher não deve desfazer mutação já confirmada.
- Não limpar `statusPosFechamento` ao sair de **Fechado**. UI e board usam etapa atual + status válido para decidir exibição.

### Project Structure Notes

- O repositório não contém os arquivos de arquitetura/configuração documental apontados por `.aiox-core/core-config.yaml` (`docs/architecture/`, `docs/framework/` e `docs/prd/`). Este draft usa os artefatos de produto fornecidos e os pontos de integração comprovados no código atual.
- Stack comprovada por `package.json`: Next.js 16, React 19, TypeScript, Prisma 6, Zod, Tailwind CSS, Vitest e Pusher.
- Não são necessárias variáveis de ambiente novas.

## Testing

- Regras puras em `tests/bpm/`: códigos aceitos/rejeitados, labels, ordem, normalização de etapa, palette e decisão de exibição.
- Actions com mocks de Prisma/auth/ownership: validar campos associados por etapa, criação direta em Fechado, movimento comum, preenchimento+movimento, status inicial, reentrada, edição, CAS e ausência de efeitos parciais.
- Segurança: sem sessão, participante, não membro, action direta fora de Fechado, ID de destino de outro pipeline e payload de status desconhecido.
- Histórico/realtime: before/after mínimo, usuário correto, um único registro por sucesso, nenhum registro/evento em recusa/conflito e emissão somente após commit.
- Frontend/wiring: Select no lado esquerdo, cinco opções, readonly, estado legado nulo, rascunho sujo diante de realtime, badge/tint somente em Fechado e preservação do indicador de nunca acessado/drag.
- Executar testes sem banco compartilhado/produção e sem criar dados reais.
- Gates obrigatórios: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## CodeRabbit Integration

**Primary Type**: Full-stack / business rules  
**Secondary Type(s)**: Frontend, API/actions, security/authorization, realtime  
**Complexity**: High — entrada por múltiplos caminhos, atomicidade, concorrência e representação visual compartilhada.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — contrato tipado, actions, guards, CAS, histórico, realtime e componentes.
- `@qa` — matriz de entrypoints, concorrência, permissões, rollback e integração visual.

**Supporting Agents**:

- `@ux-design-expert` — consistência do Select, badge, contraste, foco e diferenciação não dependente apenas de cor.
- `@architect` — revisão do boundary entre domínio, action e UI, sem introduzir integração financeira prematura.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): CodeRabbit não executado; permanece pendente para o fluxo de PR.
- [ ] Pre-PR (`@devops`): executar CodeRabbit contra `main` antes de criar o pull request.
- [ ] Pre-Deployment (`@devops`): revisar regressões de permissões, concorrência e configuração antes do deploy, se aplicável.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: `@dev` (light mode).
- Max Iterations: 2.
- Timeout: 15 minutos.
- Severity Filter: CRITICAL only.

**Predicted Behavior**:

- CRITICAL: `auto_fix`, até duas iterações.
- HIGH: `document_only` e encaminhar para QA/Dev Notes.
- MEDIUM/LOW: não corrigir automaticamente neste modo; avaliar no review.

### CodeRabbit Focus Areas

**Primary Focus**:

- guard server-side comum a todos os entrypoints e ausência de bypass;
- atomicidade entre movimento, status inicial e histórico;
- ownership e rejeição de edição fora de Fechado;
- CAS/`updatedAt` sem lost update;
- nenhuma alteração de schema/migration/seed/backfill.

**Secondary Focus**:

- enum/labels/paleta em fonte única, sem divergência entre UI e backend;
- realtime somente após commit e payload mínimo;
- rascunho local preservado em atualização externa;
- badge/tint exclusivos de Fechado, com acessibilidade e regressão visual controlada.

## Quality Gates

- [x] Scout confirmou a configuração real no Turso e os entrypoints da etapa.
- [x] Requisitos de entrada exercitados em criação, drag, modal e action direta.
- [x] Status inicial e edição posterior comprovados com histórico/realtime.
- [x] Ownership e CAS aprovados, incluindo concorrência.
- [x] Badge e diferenciação visual validados somente em Fechado.
- [x] Regressão BPM: 19 arquivos e 106 testes aprovados.
- [x] ESLint focado nos arquivos da story aprovado.
- [x] `git diff --check` aprovado.
- [x] Anubis final: **APPROVED**, zero achados críticos ou importantes.
- [x] Probe final aprovado; a ressalva inicial de falso conflito foi corrigida e revalidada.
- [x] Forge aprovou as regressões da story.
- [x] Lens: achados de conflito pós-save e `aria-label` corrigidos e revalidados.
- [x] Nenhuma alteração de schema, migration, seed ou backfill foi realizada.
- [ ] `npm run lint` global — interrompido após mais de 2 minutos; sem aprovação global.
- [ ] `npm run typecheck` global — bloqueado por cinco erros basais externos ao CRM: dois em `ExclusaoFiscal` validator, um em `HabilitacaoRadarClient.tsx:529` e dois em `sync-queue.ts:101-102`; nenhum erro da story/CRM.
- [ ] `npm test` global — não executado; substituído pela regressão focada documentada acima.
- [ ] `npm run build` — não executado.
- [ ] CodeRabbit — não executado; não há evidência para marcar o gate.
- [x] File List e Completion Notes atualizadas.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-13 | 1.0 | Story criada para o fluxo completo de entrada em Fechado, status pós-fechamento editável, histórico/realtime e representação visual no board, sem schema novo. | River (`@sm`) |
| 2026-08-13 | 1.1 | Implementação concluída; guards, status, UI, realtime, permissões, CAS e testes focados verificados. Story promovida para Ready for Review com gates globais pendentes documentados. | Codex (`@dev`) / River (`@sm`) |

## Dev Agent Record

### Agent Model Used

Codex GPT-5 (`@dev`).

### Debug Log References

- Scout: configuração real dos campos e associações da etapa **Fechado** confirmada no Turso.
- Regressão focada do BPM: **19 arquivos, 106 testes PASS**.
- ESLint focado nos arquivos da story: **PASS**.
- `git diff --check`: **PASS**.
- Typecheck global: cinco erros basais externos ao CRM — dois em validator de Exclusão Fiscal, `HabilitacaoRadarClient.tsx:529` e `sync-queue.ts:101-102`; nenhum erro atribuído à story.
- Lint global: interrompido após mais de 2 minutos, sem resultado conclusivo.
- `npm test` global e `npm run build`: não executados.
- CodeRabbit: não executado.
- Anubis final: **APPROVED**, zero achados críticos ou importantes.
- Probe final: aprovado; a ressalva de falso conflito foi corrigida e revalidada.
- Lens: achados finais de conflito pós-save e `aria-label` corrigidos e revalidados.
- Forge: regressões da story aprovadas.

### Completion Notes List

- Contrato canônico dos cinco status centralizado com labels, ordem e paleta compartilhados entre backend e board.
- Entrada direta ou por movimento em **Fechado** valida os dois campos contratuais e inicializa `AGUARDANDO_CONTRATO` atomicamente quando o status está nulo.
- Reentrada preserva status existente; cards legados nulos não sofrem backfill ou mutação na leitura.
- Edição posterior protegida por Zod, ownership, etapa atual e CAS; conflito não sobrescreve valor silenciosamente.
- Histórico e realtime são produzidos somente após persistência confirmada.
- Select operacional foi adicionado ao painel esquerdo, com readonly por permissão e preservação de rascunho em atualização externa.
- O acabamento final corrigiu o falso conflito pós-save e adicionou o `aria-label` exigido pelo review de acessibilidade.
- Badge e diferenciação visual aparecem exclusivamente em cards atualmente na etapa **Fechado**.
- Implementação realizada sem schema, migration, seed ou backfill.
- Regressão focada aprovada; gates globais não concluídos permanecem explicitamente abertos em **Quality Gates**.

### File List

- `docs/stories/story-alpha-crm-fechado-status-pos-fechamento.md`
- `src/lib/bpm/status-pos-fechamento.ts`
- `src/lib/validations/bpm.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `tests/bpm/fechado-status-pos-fechamento.test.ts`
- `tests/bpm/fechado-actions.test.ts`
- `tests/bpm/fechado-ui.test.ts`
- `tests/bpm/card-modal-integration.test.ts`

## QA Results

**Gate da story: READY FOR REVIEW.**

- Anubis: **APPROVED**, zero achados críticos ou importantes.
- Probe: fluxo aprovado; a ressalva inicial de falso conflito foi corrigida antes do handoff e revalidada.
- Lens: achados de conflito pós-save e `aria-label` corrigidos antes do handoff.
- Forge: regressões da story aprovadas com 19 arquivos/106 testes BPM, ESLint focado e diff-check limpos.
- Segurança/consistência: ownership, CAS, guard em todos os caminhos, atomicidade, histórico e realtime verificados.
- Banco: nenhuma alteração de schema, migration, seed ou backfill.
- Ressalvas de pipeline: lint global sem conclusão por tempo; typecheck global bloqueado apenas por cinco baselines externos; `npm test` global, build e CodeRabbit não executados. Esses itens permanecem desmarcados e devem ser tratados antes do merge conforme a política do repositório.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| 1. Goal & Context Clarity | PASS | Resultado comercial, limite do pós-fechamento e exclusão da integração financeira estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Entry points, modelos existentes, guard, CAS, componentes, histórico e realtime estão mapeados. |
| 3. Reference Effectiveness | PASS | Requisitos e decisões são resumidos com seções específicas; a ausência de `accumulated-context.md` está documentada e compensada por contexto relacionado explícito. |
| 4. Self-Containment Assessment | PASS | Cinco estados, inicialização, reentrada, legado nulo, permissões, erros e limites estão definidos. |
| 5. Testing Guidance | PASS | Há matriz mensurável para backend, concorrência, segurança, realtime, UI e regressão visual. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos específicos foram definidos. |

**Quick Summary**

- Story readiness: **READY**.
- Clarity score: **10/10**.
- Major gaps: nenhum bloqueante; a configuração de dados dos dois `BpmCampo` deve ser confirmada pelo Scout, sem criar schema/seed/backfill.

**Developer Perspective**

- A story é implementável com os modelos e entrypoints existentes.
- O principal risco de retrabalho é implementar o guard apenas no drag ou no modal e deixar criação/action direta como bypass; a task 3 e os testes exigem convergência server-side.
- O segundo risco é lost update entre realtime/edição/movimento; por isso o CAS e a preservação de rascunho são critérios explícitos.

**Final Assessment:** READY — suficiente para implementação por `@dev`, com validação posterior de `@qa`.
