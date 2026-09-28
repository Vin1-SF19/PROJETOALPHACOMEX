# Story — Alpha CRM: destinos disponíveis no card aberto

## Status

Ready for Review

## Executor Assignment

- **Executor:** @dev
- **Quality gate:** @qa
- **Ferramentas:** testes BPM e React, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Story

**Como** usuário do Alpha CRM, **quero** que o painel direito do card aberto mostre apenas os destinos para os quais posso mover o card e explique as pendências de cada destino bloqueado, **para** saber o que falta antes de avançar.

## Critérios de aceite

1. O painel direito mostra somente as etapas de destino alcançáveis por transições manuais configuradas e permitidas a partir da etapa atual do card. A etapa atual, etapas sem transição, transições desativadas e transições reservadas a outro solicitante não aparecem como opções de avanço.
2. Cada destino exibido sem pendências pode ser selecionado pelo fluxo de movimentação já existente.
3. Cada destino exibido com pendências permanece visível, mais opaco e sem ação de avanço. Passar o mouse sobre ele exibe um tooltip com uma lista legível dos requisitos ainda pendentes para aquele destino.
4. O mesmo conteúdo do tooltip fica disponível por foco de teclado e é associado ao destino para tecnologias assistivas. A opção bloqueada não dispara movimentação por mouse ou teclado.
5. Ao preencher ou salvar dados do card que afetam os requisitos, o estado dos destinos e suas listas de pendências são reavaliados sem exigir fechar e reabrir o card. Ao mover o card, as opções passam a refletir a nova etapa atual.
6. A execução da transição mantém a validação existente no servidor; mudanças concorrentes ou dados obsoletos não permitem avançar para um destino que se tornou inválido.
7. Testes cobrem destinos permitidos e não configurados, bloqueio com múltiplas pendências, acesso ao tooltip por mouse e teclado, atualização após edição do card e falha de validação no momento de mover.

## Escopo e contexto

- Fonte: pedido do usuário nesta conversa para restaurar a indicação de avanço no canto direito do card aberto.
- O painel está em `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`, alimentado por `CardAbertoLayout.tsx`. O layout já filtra parte dos destinos por `transicoesEtapaOrigem`; conferir também permissão e origem da transição antes de exibir a opção.
- `src/lib/bpm/transicao-command.ts` já decide a validade da transição e devolve `pendencias` em erros de validação. A prévia de pendências deve refletir as mesmas regras efetivas usadas na movimentação, sem criar uma segunda definição de requisitos divergente.
- Esta story trata da apresentação e prévia de elegibilidade no card. Não muda regras de negócio, configuração de pipeline, estrutura do banco, migration, seed ou backfill.
- `[AUTO-DECISION]` Não há epic específico nem `accumulated-context.md` ou `.aiox/gotchas.json` neste checkout; a coerência foi conferida contra a story `story-alpha-crm-resumo-etapas-no-card.md` e os componentes/serviços existentes. (reason: o pedido direto do usuário define o escopo e não autoriza inventar um epic.)

## Tarefas / Subtarefas

- [x] Identificar os destinos manuais permitidos da etapa atual sem expor etapas sem avanço configurado. (AC 1)
- [x] Obter e atualizar, para cada destino exibido, as pendências calculadas pelas regras existentes. (AC 3, 5, 6)
- [x] Exibir estado habilitado/bloqueado e tooltip em lista acessível por mouse e teclado. (AC 2, 3, 4)
- [x] Cobrir o comportamento e a validação final em testes; executar os gates do projeto. (AC 5, 6, 7)

## 🤖 CodeRabbit Integration

- **Tipo:** Frontend com integração de regras BPM; complexidade média.
- **Agentes:** @dev implementa; @ux-design-expert revisa acessibilidade; @qa valida comportamento.
- **Pre-Commit (@dev):** revisar estados e acessibilidade; rodar lint, typecheck, testes e build.
- **Pre-PR (@devops), se houver PR:** revisar integração e regressões.
- **Self-healing:** @dev em modo light, até 2 iterações/15 min, corrige CRITICAL e documenta HIGH; @qa em modo full, até 3 iterações/30 min, corrige CRITICAL e HIGH; @devops reporta apenas.
- **Foco:** consistência com a validação do servidor, atualização do estado, navegação por teclado e semântica do tooltip.

## Checklist de draft

- [x] Objetivo e benefício derivam do pedido do usuário.
- [x] Critérios observáveis cobrem destinos, pendências, acessibilidade e atualização.
- [x] Integrações existentes e limites de escopo estão identificados.
- [x] Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PARTIAL (sem epic ou contexto acumulado neste checkout); autossuficiência PASS; testes PASS; CodeRabbit PASS. **Prontidão: READY para implementação.**
- [x] Implementação concluída e critérios de aceite verificados por testes de integração e inspeção.
- [x] `npm run lint` aprovado (0 erros; avisos preexistentes), `npm run typecheck` aprovado, `npm test` aprovado (543 arquivos; 3997 testes aprovados, 4 ignorados, 1 pendente).
- [x] `npm run build` aprovado.
- [x] File List final atualizada.

## Dev Agent Record

### File List

- `docs/stories/story-alpha-crm-destinos-disponiveis-card-aberto.md` — story criada.
- `src/actions/bpm/DisponibilidadeEtapasCard.ts` — prévia somente leitura baseada na consulta de requisitos e na avaliação canônica da transição.
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx` — propaga revisão realtime ao painel de destinos.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx` — lista destinos elegíveis, bloqueios e tooltip acessível, com reconsulta após atualização.
- `tests/bpm/disponibilidade-etapas-card.test.ts` — valida filtro de destinos, motivos e autorização.
- `tests/bpm/transicao-requisitos-card-react.test.ts` — valida bloqueio, tooltip e atualização após salvamento.
- `tests/bpm/autosave-recovery-react.test.ts` — adapta mock da prévia para preservar o teste de autosave.
- `tests/bpm/card-save-flow.test.ts` e `tests/bpm/formulario-etapa.test.ts` — atualizam verificações estáticas para o novo botão.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-28 | 0.1 | Draft da prévia de destinos e pendências do card aberto | River (@sm) |
| 2026-09-28 | 0.2 | Prévia canônica, destinos bloqueados com tooltip e testes | Codex |

## QA Results

Testes de serviço e React aprovados. A validação em navegador autenticado permanece pendente para revisão visual do hover e responsividade.
