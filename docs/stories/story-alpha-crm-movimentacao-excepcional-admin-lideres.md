# Backlog — Alpha CRM: movimentação excepcional por administradores e líderes de setor

## Status

Draft / Backlog — registrado em 20/10/2026 para aprofundamento posterior solicitado pelo usuário. **Não implementar nem habilitar nesta entrega.**

## Executor Assignment

- executor futuro: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: revisão de autorização server-side, regressões de movimentação, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Story

**Como** administrador ou líder de setor autorizado, **quero** movimentar excepcionalmente um card com pendências dispensáveis, **para** resolver situações operacionais com justificativa e rastreabilidade, dentro do escopo da minha responsabilidade.

## Origem e relação com a entrega atual

Pedido literal do usuário: “admin, e lideres de setor, podem mover card sem as obrigatoriedades, mas registre isso para fazer de um jeito mais completo, apos essas melhorias eu volto para essa modificação em especifico”.

A [story de cards e fluxo de contrato](./story-alpha-crm-alinhamento-cards-fluxo-contrato.md) executa as melhorias atuais. Este arquivo somente preserva a intenção e as decisões necessárias. O registro não concede permissão de bypass nem autoriza mudança de dados.

`docs/stories/accumulated-context.md` não foi localizado. Contexto relacionado:

- [Movimentação manual de importados RD](./story-alpha-crm-movimentacao-manual-importados-rd.md): já existe uma exceção contextual para origem RD, com confirmação e auditoria; não confundir proveniência do registro com papel administrativo.
- [Conclusão Financeiro/Operacional](./story-alpha-crm-conclusao-financeiro-handoff-operacional.md#acceptance-criteria): contém invariantes de assinatura, pagamento e NF e distingue dados operacionais; a proposta futura deve explicitar a compatibilidade.
- `src/lib/bpm/ownership.ts` e `src/lib/bpm/transicao-command.ts`: pontos a investigar para autorização e movimento no servidor.

## Decisões obrigatórias antes de tornar Ready

1. **Quem é administrador:** identificar o papel/permissão efetivamente persistido; distinguir administrador global, administrador de pipeline e administrador/participante do card.
2. **Quem é líder:** identificar a fonte canônica de liderança e vínculo com setor; definir múltiplos líderes, substituição e alteração/revogação durante a operação.
3. **Escopo do setor:** decidir se a liderança autoriza agir pelo setor do pipeline, etapa, responsável ou card; definir origem/destino de setores diferentes. Não inferir escopo pelo nome do cargo.
4. **Quais pendências podem ser dispensadas:** classificar campos, checklist, tarefas e condições de entrada/saída. Cada categoria precisa de decisão explícita; não usar um booleano que ignore toda validação.
5. **Invariantes preservados:** autenticação, autorização de acesso, identidade e existência do card/destino, integridade de vínculo/pipeline, concorrência, auditoria e atomicidade não podem ser dispensadas. Definir com o negócio o tratamento das condições financeiras de assinatura/pagamento/NF, preservando o contrato atual até decisão específica.
6. **Justificativa e auditoria:** definir motivo obrigatório, formato, visibilidade e retenção; registrar ator, autoridade usada, setor, origem/destino e pendências efetivamente dispensadas, sem fabricar valores.
7. **Experiência de confirmação:** definir prévia das pendências e confirmação explícita no Kanban e no modal; cancelamento deve ser sem efeitos. Confirmar se é necessária permissão específica além do papel.
8. **Entradas alternativas:** estabelecer regras para action/API, automação, integração e importados RD. Privilégio de uma pessoa não pode ser implicitamente herdado por job ou webhook.
9. **Interação com RD:** decidir precedência entre mecanismo RD existente e privilégio de liderança, sem dupla confirmação, auditoria ambígua ou expansão da exceção legada.
10. **Efeitos após o movimento:** decidir se pendências continuam visíveis, como tarefas/cadências reagem e como evitar que a dispensa avance automaticamente contrato/pagamento ou libere serviço sem pré-requisitos.

## Critérios para o desenho e aceite futuro

Os critérios abaixo orientam a futura implementação; a matriz de permissões e pendências ainda depende de decisão do usuário.

1. Há matriz aprovada de ator × setor × pipeline/etapa × operação × categoria dispensável, baseada em permissões reais do sistema.
2. O servidor deriva autoridade da sessão e dos vínculos persistidos; rejeita flag de bypass forjada, papel revogado, atuação fora do setor e destino não permitido.
3. A prévia mostra as pendências e a autoridade usada; confirmação inclui justificativa e está vinculada ao estado atual. Mudança de card, destino, versão ou requisitos invalida confirmação antiga.
4. Movimento e auditoria são atômicos e idempotentes; retry não duplica transição, evento, encaminhamento ou efeitos derivados. Nenhum valor ausente é preenchido artificialmente.
5. Kanban, modal e chamadas diretas obedecem à mesma política; cancelamento e negação de permissão não gravam alterações.
6. Integrações, automações e importados RD têm tratamento explícito, com regressões contra escalonamento indevido de privilégios.
7. Invariantes de integridade e contratos financeiros permanecem protegidos conforme decisões aprovadas; o bypass não vira acesso geral de edição nem de anexos.
8. Relatórios e histórico permitem identificar quem dispensou o quê, quando, por qual motivo e em qual setor, com acesso autorizado.
9. Há plano de rollout/rollback e documentação; alteração estrutural ou operação em lote segue Vault com backup verificado e confirmação específica.

## Tasks / Subtasks

- [x] Registrar intenção do usuário e manter fora da implementação atual.
- [x] Identificar interseção com exceção RD e regras financeiras anteriores.
- [ ] Retomar com usuário após entrega das melhorias de cards/fluxo.
- [ ] Mapear papéis e liderança reais, escopo de setor e permissões atuais.
- [ ] Aprovar matriz de pendências dispensáveis e invariantes preservados.
- [ ] Desenhar confirmação, justificativa, auditoria e concorrência.
- [ ] Detalhar contrato server-side e comportamento de cada entrada.
- [ ] Revisar impactos em automações, financeiro, tarefas e dados RD.
- [ ] Expandir story e executar novamente o checklist antes de marcar Ready.
- [ ] Implementar somente após retomada e escopo definido.

## Testing futuro

Casos mínimos: administrador permitido/negado; líder no próprio setor e fora dele; usuário comum; líder revogado entre prévia/confirmação; destino de outro setor; confirmação antiga; motivo vazio; bypass forjado; cancelamento; retry; duas operações concorrentes; falha de auditoria com rollback; card RD/nativo; job/webhook sem autoridade pessoal; invariantes financeiros; acesso a anexos; ambos os caminhos da UI.

## CodeRabbit Integration

- **Story Type Analysis:** Security; secundárias API, Frontend e Integration; complexidade alta.
- **Specialized Agents:** `@dev`, `@architect`, `@qa` e `@ux-design-expert`; Vault/Data Engineer somente se o desenho aprovado exigir banco.
- **Quality Gates:** pre-commit com revisão de autorização; pre-PR/pre-deployment condicionados à futura autorização de publicação.
- **Self-Healing:** `@dev` light, 2 iterações/15 minutos, CRITICAL; HIGH documentado; revisão `@qa` full, 3 iterações/30 minutos, CRITICAL/HIGH. Registrar fallback se CLI indisponível.
- **Focus Areas:** privilégio mínimo, escopo de setor, confirmação contextual, idempotência, auditoria atômica, invariantes e nenhuma confiança em flag do cliente.

## Validação da story — River

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado | Observação |
|---|---|---|
| Objetivo e contexto | PASS | Intenção e adiamento explícitos. |
| Orientação técnica | PARTIAL | Papéis e matriz de exceções ainda precisam de desenho. |
| Referências | PASS | Contratos RD/Financeiro e pontos existentes identificados. |
| Autossuficiência | PASS | Decisões pendentes enumeradas sem inventar política. |
| Testes | PASS | Cenários propostos para a expansão futura. |
| CodeRabbit | PASS | Revisão prevista, não executada. |

**NEEDS REVISION para implementação; adequado ao backlog solicitado.** Clareza 9/10 sobre objetivo e limites. Não marcar Ready enquanto ator, setor, categorias dispensáveis e efeitos derivados estiverem indefinidos.

## File List

- `docs/stories/story-alpha-crm-movimentacao-excepcional-admin-lideres.md` — criado somente como registro futuro.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Backlog do bypass admin/líder, sem implementação, com decisões e critérios de desenho. | River |
