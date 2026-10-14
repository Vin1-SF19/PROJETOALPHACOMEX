# Story: Rolagem do painel central do card no Alpha CRM

## Status

In Progress

## Executor Assignment

- executor: @dev
- quality_gate: @qa
- quality_gate_tools: [lint, typecheck, testes focais]

## História

Como usuário do Alpha CRM, quero rolar até o final do painel central ao abrir um card, para consultar e usar todos os campos e ações da etapa.

## Origem e contexto

Pedido direto do usuário em 2026-10-14. Reprodução informada: abrir “Luana Tráfego”, na etapa “Reunião Agendada”; o conteúdo central do card não permite alcançar o fim.

A rolagem interna das colunas do kanban já é tratada em `story-alpha-crm-rolagem-interna-pipelines.md` e não cobre a rolagem do card aberto. `story-crm-card-modal-visual.md` trata da apresentação e das abas do modal; esta story cobre o acesso ao conteúdo completo do painel central.

Não há mudança de dados, contrato de API ou estrutura de banco neste escopo.

## Critérios de aceite

1. Em desktop, ao abrir um card, o usuário consegue rolar o painel central até o último campo e a última ação disponíveis, inclusive no caso “Luana Tráfego” em “Reunião Agendada”.
2. Em desktop, rolar o painel central não impede o uso nem desloca indevidamente os painéis laterais ou o cabeçalho do card.
3. Em viewport mobile, o conteúdo central pode ser percorrido por toque até o último campo e ação, sem conteúdo inacessível ou cortado pela área visível do modal.
4. A rolagem funciona também com teclado e mantém os controles do painel acessíveis e operáveis.
5. A correção preserva os campos, ações, permissões e dados existentes do card.

## Tasks / Subtasks

- [ ] Reproduzir a falha no card “Luana Tráfego”, etapa “Reunião Agendada”, em desktop e mobile (AC: 1–3).
- [x] Ajustar a rolagem do painel central do card aberto e preservar os painéis e controles existentes (AC: 1–5).
- [ ] Verificar alcance do último campo/ação por toque e teclado e revisar regressões do modal (AC: 1–5).

## Dev Notes

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` documenta o slot central como formulário da etapa ativa (`children`) e monta o grid de três painéis. A coluna central é a área de rolagem independente em desktop.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` contém os painéis de formulário e script; seu conteúdo precisa crescer naturalmente para a rolagem da coluna central alcançar o fim.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx` monta o layout do card aberto. Preservar os fluxos e permissões existentes.
- A story `story-alpha-crm-rolagem-interna-pipelines.md` trata das colunas do quadro, não do painel aberto.
- `accumulated-context.md`, `.aiox/gotchas.json` e os documentos de arquitetura/frontend configurados não foram encontrados; os critérios acima derivam do pedido direto e do código existente.

## Testing

Verificar visualmente o cenário descrito em desktop e mobile; percorrer o painel por toque e teclado até seu conteúdo final; confirmar que os controles finais podem ser acionados e que cabeçalho, painéis laterais e permissões continuam funcionais. Executar os gates definidos pelo projeto durante a implementação e registrar resultados nesta story.

## 🤖 CodeRabbit Integration

- **Story Type:** Frontend
- **Complexity:** Baixa
- **Primary Agents:** @dev, @ux-design-expert
- **Quality Gates:** revisão pré-commit de rolagem, acessibilidade por teclado, responsividade e preservação de interações.
- **Self-Healing:** @dev, light, até 2 iterações / 15 minutos; CRITICAL corrigido, HIGH documentado.
- **Focus Areas:** rolagem até o último controle em desktop/mobile; ausência de corte ou scroll preso; operação por teclado; não deslocar os painéis vizinhos em desktop.

## Checklist de preparação

- [x] Objetivo e benefício identificados a partir do relato do usuário.
- [x] Cenário de reprodução informado e critérios verificáveis em desktop e mobile.
- [x] Stories relacionadas consultadas e escopo separado da rolagem das colunas.
- [x] Arquivos prováveis identificados a partir da estrutura atual.
- [x] Contexto acumulado e referências de arquitetura ausentes registrados.
- [x] Revisão do checklist `story-draft-checklist.md`: READY para implementação; requisitos, contexto, orientação técnica, autocontenção, validação e CodeRabbit registrados.

## Dev Agent Record

### Implementação

O layout do card aberto permite redução vertical do contêiner raiz (`min-h-0`) e define uma linha de grade que pode encolher em desktop. A coluna central agora é uma região rolável por teclado e mouse em desktop. `PainelRegistrar` deixa de criar um segundo scroll interno e deixa o conteúdo das abas crescer, para que a rolagem da coluna central alcance todos os campos e ações. A estrutura também permanece rolável pela área geral em mobile. Nenhum dado, campo ou permissão foi alterado.

### Validação

- `git diff --check`: passou.
- `npm run lint`: passou sem erros, com 1.193 avisos no repositório (execução anterior à revisão adicional).
- `npx eslint src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`: passou após a revisão adicional.
- `npm run typecheck`: passou.
- `git diff --check`: passou após a revisão adicional.
- Reprodução visual manual da rolagem até o último campo/ação em desktop e mobile: pendente.

### File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — ajuste dos contêineres do layout para permitir rolagem e redução do painel central.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx` — remoção do scroll interno para que a coluna central controle a rolagem completa.
- `docs/stories/story-alpha-crm-rolagem-painel-central-card.md` — atualização do status, checklist, implementação e validação.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-10-14 | 1.0 | Story preparada para corrigir rolagem incompleta do painel central do card. | River (SM) |
| 2026-10-14 | 1.1 | Status atualizado; ajuste de layout e validações limitadas registrados; verificação visual mantida pendente. | River (SM) |
