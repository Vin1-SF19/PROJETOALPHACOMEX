# Blueprint — RM-2026-15F807: Coluna Fechado abre card interligado no pipeline Financeiro

> Fase 1 (Scout/Nova). Blueprint técnico para o Dev seguir. Nenhum código de implementação incluído aqui.

## 0. Achado que redefine o blueprint original

O ponto 2 da Fase 0 propunha criar do zero a lógica de "card filho" (`CriarCardBpm` + novo campo `cardPaiId`). **Isso já existe e está em produção**, só está com nomes desatualizados:

- Mecanismo: `executarAutomacaoFechamentoComercial` (`src/lib/bpm/automacoes.ts:21`), disparada por `executarMovimentoComRequisitos` (`src/actions/bpm/Cards.ts:1523`) logo após a transação de movimentação commitar, antes do `revalidatePath`.
- Vínculo pai-filho: model `BpmCardVinculo` (`cardOrigemId`/`cardDestinoId`, `@@unique`) — **já existe no schema, zero migration**.
- Idempotência: já implementada, por `empresaId` + `pipelineId` + `status: "ATIVO"` (não por `cardPaiId`, que não existe como coluna — o vínculo é via tabela de junção).
- Histórico: já registra `CARD_CRIADO_POR_AUTOMACAO` no card filho e `AUTOMACAO_DISPAROU_CARD` no card pai via `BpmCardHistorico`.

**O que está quebrado, confirmado por query direta no Turso (banco real, 4 pipelines):**

```
Pipeline "Revisão de Radar" (id cmsd9yvb90000dzggt1gjl980) — etapas reais:
  Novos leads → Agendar reunião → Reunião Agendada → Em tratativa → Fechado → Lost → Sem viabilidade → Standby - Follow Up → Monitoramento

Pipeline "Financeiro" (id cmsd9yw74000adzggrw91um3j) — etapas reais:
  Solicitação de Contrato → Elaboração do Contrato → Formalização → Pagamento → Nota Fiscal → Concluídos
```

`executarAutomacaoFechamentoComercial` compara `card.pipeline.nome !== "Comercial"` e `card.etapa.nome !== "Fechado Ganho"` — **nenhum dos dois nomes existe no banco real**. O pipeline principal chama-se `"Revisão de Radar"` e a etapa de fechamento chama-se `"Fechado"` (validada em runtime por `etapaEhFechado()`, `src/lib/bpm/status-pos-fechamento.ts:131`, que normaliza e compara com `"fechado"`). Resultado: a automação D-009 nunca dispara hoje.

Além disso, a automação hoje também cria card no pipeline `"Radar"` (segundo pipeline destino, além do Financeiro) — **fora do escopo deste objetivo**, que pede apenas o pipeline Financeiro. Manter esse comportamento (não remover), só corrigir a condição de gatilho.

**Achado secundário (não bloqueante, registrar como débito técnico):** o pipeline Financeiro tem uma etapa `"Elaboração do Contrato"` duplicada (`ordem: 1` aparece 2x na query). Não afeta esta fase (`primeiraEtapa` é resolvida por `orderBy: { ordem: "asc" }` + `findFirst`, pega a primeira etapa `ordem: 0` = `"Solicitação de Contrato"`), mas relatar para o dono do produto/Vault avaliar limpeza de dado duplicado.

## 1. Ponto de injeção do gatilho (correção, não criação)

- Arquivo: `src/lib/bpm/automacoes.ts`
- Função: `executarAutomacaoFechamentoComercial` (manter nome da função por ora — é chamada em 2 pontos de `Cards.ts`; renomear é opcional/cosmético, não obrigatório para este objetivo)
- Mudança mínima:
  - `const NOME_ETAPA_FECHADO_GANHO = "Fechado Ganho"` → trocar a comparação exata `card.etapa.nome !== NOME_ETAPA_FECHADO_GANHO` por `!etapaEhFechado(card.etapa.nome)` (importar `etapaEhFechado` de `@/lib/bpm/status-pos-fechamento`, já usada em `Cards.ts`).
  - `const NOME_PIPELINE_COMERCIAL = "Comercial"` → **remover a checagem por nome de pipeline fixo**. O gatilho não deve depender de qual pipeline tem a etapa "Fechado" — qualquer pipeline com uma etapa cujo nome normalize para "fechado" deve disparar a automação, desde que não seja o próprio pipeline Financeiro/Radar (evitar loop: um card fechado dentro do Financeiro não deve gerar outro card no Financeiro). Guard equivalente: `if (card.pipeline.nome === NOME_PIPELINE_FINANCEIRO || card.pipeline.nome === NOME_PIPELINE_RADAR) return;`
- Já está corretamente posicionado (após `db.$transaction` do movimento, antes do `revalidatePath`/`return` de `executarMovimentoComRequisitos`, `Cards.ts:1523`) — **nenhuma mudança de ponto de chamada necessária**.

## 2. Criação do card filho (já implementada, sem mudança)

`executarAutomacaoFechamentoComercial` (`automacoes.ts:44-89`) já faz, dentro de `db.$transaction`:
- `tx.bpmCard.create()` com `empresaId`, `pipelineId` (Financeiro), `etapaId` (primeira etapa ativa por `ordem: asc`), `responsavelId` (herdado do card pai).
- `tx.bpmCardMembro.create()` — vincula o responsável como membro do card filho.
- `tx.bpmCardVinculo.create({ cardOrigemId: card.id, cardDestinoId: novoCard.id })` — vínculo pai→filho.
- `tx.bpmCardHistorico.create()` (2x) — auditoria em ambos os cards.

**Nenhuma cópia de `BpmCardCampoValor`** é feita hoje (a Fase 0/blueprint original sugeria copiar campos obrigatórios da etapa inicial do Financeiro). **Decisão: fora de escopo** — o objetivo pede apenas que a coluna Fechado abra/crie o card interligado, não que pré-preencha campos do Financeiro. Não implementar cópia de campos nesta fase; se necessário, é um objetivo separado.

**Título do card filho:** hoje `tx.bpmCard.create()` não define `titulo` explicitamente (verificar se o model `BpmCard` tem campo `titulo` obrigatório/opcional e se o create atual já herda de outro lugar, ex. via campo calculado ou primeiro campo dinâmico). Se `titulo` for obrigatório e não preenchido, o Dev deve confirmar em `prisma/schema.prisma` antes de alterar — não presumir. Não é necessário adicionar `'Financeiro — ' + card.titulo` a menos que o Dev confirme que o card fica sem identificação visível no Kanban do Financeiro.

## 3. Vínculo pai-filho (já existe, sem migration)

- `BpmCardVinculo` já existe no schema (`cardOrigemId`, `cardDestinoId`, `@@unique`), relações `vinculosOrigem`/`vinculosDestino` em `BpmCard`.
- Query de idempotência **já implementada, mas por critério diferente do sugerido na Fase 0**: hoje é `db.bpmCard.findFirst({ where: { empresaId, pipelineId: pipelineDestino.id, status: "ATIVO" } })` (1 card ativo por empresa/pipeline, D-005) — não por `cardPaiId` (que não é uma coluna, é relação via `BpmCardVinculo`). Manter esse critério: é mais robusto que `cardPaiId` porque cobre o caso de reabertura via outro fluxo. **Nenhuma migration necessária.**

## 4. Feedback ao usuário (lacuna real — implementar)

Hoje `executarMovimentoComRequisitos` retorna apenas `{ success: true }` no caminho feliz (`Cards.ts:1560`, logo após `await executarAutomacaoFechamentoComercial(cardId, userId)`), e `PainelProximaEtapa.tsx:44` só mostra `toast.success("Card movido")` — sem indicar que um card foi criado no Financeiro nem oferecer link.

**Mudança no backend (`Cards.ts`):**
- Capturar o retorno de `executarAutomacaoFechamentoComercial` (hoje `Promise<void>`) — mudar sua assinatura para retornar `{ cardsFilhosCriados: Array<{ pipelineId: string; pipelineNome: string; cardId: string }> }` (a função já tem, dentro do loop, `novoCard.id` e `pipelineDestino.{id,nome}` — só precisa acumular e retornar, sem lógica nova).
- `executarMovimentoComRequisitos` retorna: `{ success: true, cardsFilhosCriados? }` quando o array não é vazio (evitar poluir o retorno em todos os outros movimentos que não passam pela etapa Fechado).

**Mudança no frontend (`PainelProximaEtapa.tsx`, `handleMover`):**
- Se `res.success && res.cardsFilhosCriados?.length`, para cada item (hoje até 2: Financeiro + Radar) exibir toast com ação: `` `✓ Card criado no pipeline ${item.pipelineNome}` `` com botão/ação "Ver card" → `router.push(`/PainelAlpha/AlphaCRM/pipeline/${item.pipelineId}`)`. Verificar se `sonner` (já em uso, `toast` importado em `PainelProximaEtapa.tsx`) suporta `action` no toast (`toast.success(msg, { action: { label, onClick } })` — padrão da lib, usado em outros pontos do projeto — confirmar 1 exemplo existente antes de implementar).
- Se idempotência (nenhum card criado por já existir): **não** exibir toast extra — evitar ruído a cada reabertura/re-movimento (diferente do sugerido na Fase 0; como a automação já roda de forma silenciosa quando idempotente, manter silêncio é consistente com o comportamento atual do sistema para outras automações, ex. D-035).

**Componente alternativo de acesso persistente (recomendado, não obrigatório para o MVP desta fase):** o card fechado já pode expor o vínculo de forma permanente (não só no toast do momento da movimentação) reaproveitando `ObterHistoricoCruzadoBpm` (`src/actions/bpm/Vinculos.ts:72`, já retorna `vinculosOrigem`/`vinculosDestino` com dados agregados) em algum painel do `CardFullViewModal` — hoje **nenhum componente consome essa action** (lacuna confirmada pela Fase 0). Se o Dev tiver orçamento de rodada, adicionar um bloco simples "Cards vinculados" no card fechado que lista os `cardId`s de `vinculosOrigem` com link — mas o requisito mínimo do objetivo (abrir o card interligado a partir da coluna Fechado) é satisfeito pelo toast com ação, item obrigatório desta fase.

## 5. Edge cases

- **Card movido para Fechado e depois para trás:** automação só roda ao entrar em "Fechado" (chamada em `executarMovimentoComRequisitos`, que roda a cada `MoverCardBpm`/`SalvarRequisitosEMoverCardBpm` bem-sucedido). Ao mover para outra etapa, `executarAutomacaoFechamentoComercial` é chamada de novo mas a nova condição `!etapaEhFechado(card.etapa.nome)` faz retornar cedo — não deleta nada. Filho permanece. **Sem mudança necessária**, comportamento já correto pela lógica existente.
- **Card movido para Fechado 2x:** idempotência já cobre via `status: "ATIVO"` + `empresaId` + `pipelineId` — não duplica. **Sem mudança necessária.**
- **Pipeline Financeiro inexistente:** já tratado — `pipelinesDestino` filtra `null`, `if (!primeiraEtapa) continue`; a automação simplesmente não cria nada, sem lançar exceção, e como está fora da transação principal do movimento (chamada depois de `db.$transaction` do movimento pai já ter commitado, `Cards.ts:1523`), **uma falha na automação não deve derrubar o retorno `{ success: true }` da movimentação do card pai**. Confirmar que `executarAutomacaoFechamentoComercial` já está fora de qualquer `try/catch` que propague erro para `executarMovimentoComRequisitos` — se lançar exceção hoje, ela quebraria a resposta da Server Action. **Ação do Dev:** envolver a chamada em `Cards.ts:1523-1524` (`executarAutomacaoFechamentoComercial` e `executarAutomacaoTarefaNotaFiscal`) em `try/catch` com `console.error`, se ainda não estiver protegida — verificar antes de alterar (pode já haver um try/catch mais externo cobrindo todo `executarMovimentoComRequisitos`; não duplicar).
- **Permissão:** sem mudança — ownership por `responsavelId`/membros já herdado do card pai no `create`, mesmo padrão de todos os cards BPM.

## 6. Arquivos a modificar (lista exata)

- `src/lib/bpm/automacoes.ts` — corrigir condição de gatilho (`etapaEhFechado` em vez de nome de etapa fixo; remover checagem de nome de pipeline fixo, usar guard negativo Financeiro/Radar); acumular e retornar `cardsFilhosCriados`.
- `src/actions/bpm/Cards.ts` — propagar `cardsFilhosCriados` no retorno de `executarMovimentoComRequisitos`; garantir que falha na automação não derruba o movimento do card pai (try/catch se ainda não existir).
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — `handleMover`: toast com ação "Ver card" quando `cardsFilhosCriados` vier preenchido.
- `tests/bpm/automacao-fechamento-financeiro.test.ts` (novo) — cobrir: (a) etapa "Fechado" real dispara automação e cria card no Financeiro + `BpmCardVinculo`; (b) idempotência (2ª movimentação não duplica); (c) pipeline sem etapa "Fechado" configurada não dispara; (d) card já no Financeiro/Radar não dispara a si mesmo (guard anti-loop).
- `docs/stories/story-rm-2026-15f807-blueprint.md` — este arquivo.

**Nenhuma migration.** `prisma/schema.prisma` não precisa de alteração — `BpmCardVinculo` já cobre o vínculo.

## 7. Componentes/padrões reutilizáveis identificados

- `etapaEhFechado()` (`src/lib/bpm/status-pos-fechamento.ts:131`) — já é a forma correta e única no projeto de identificar a etapa de fechamento, usada em `Cards.ts` para outras validações; deve ser reaproveitada aqui em vez de comparação de string fixa.
- `db.bpmCardVinculo` — já existe, já usado por `CriarVinculoCardBpm`/`ObterHistoricoCruzadoBpm` (`Vinculos.ts`).
- `sonner`/`toast` com `action` — padrão a confirmar (verificar 1 uso existente de `toast.success(msg, { action })` no projeto antes de implementar; se não houver precedente, checar a versão de `sonner` instalada suporta a API antes de usar).
- `router.push` (`next/navigation`) — já usado em outros componentes do CRM para navegação entre pipelines.

## 8. Vault — não aplicável nesta fase

Nenhuma migration, alteração de coluna, índice ou constraint é necessária. `BpmCardVinculo` e todos os campos usados (`empresaId`, `responsavelId`, `pipelineId`, `etapaId`, `status`) já existem no schema em produção (confirmado por query direta ao Turso nesta sessão). **Vault não precisa ser acionado.**

## 9. Critério de aceite (retomando o AUTO_ADJUSTMENT_ACCEPTANCE da Fase 0)

1. Mover um card da etapa "Em tratativa" (ou qualquer etapa anterior) para "Fechado" no pipeline "Revisão de Radar" deve criar um novo `BpmCard` no pipeline "Financeiro" (etapa "Solicitação de Contrato") com `BpmCardVinculo` apontando para o card de origem, e registrar `BpmCardHistorico` com ação `CARD_CRIADO_POR_AUTOMACAO`.
2. O usuário que moveu o card deve ver um toast com ação "Ver card" que navega para `/PainelAlpha/AlphaCRM/pipeline/<idPipelineFinanceiro>`.
3. Mover o mesmo card para "Fechado" uma segunda vez (ou mover para trás e de novo para "Fechado") não deve criar um segundo card no Financeiro nem exibir toast de criação novamente.
