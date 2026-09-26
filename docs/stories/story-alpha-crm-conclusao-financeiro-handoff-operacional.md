# Story — Alpha CRM: conclusão automática do Financeiro e entrega completa ao Operacional

## Status

Ready for Review — configuração remota aguardando autorização específica

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Story

**Como** equipe comercial, financeira e operacional, **quero** que a contratação seja concluída somente depois de contrato assinado e pagamento confirmado, com encaminhamento completo e rastreável ao Operacional, **para** iniciar o serviço com os dados necessários sem perder documentos, histórico e acompanhamento da nota fiscal.

## Fonte e dependências

- Requisitos fornecidos pelo usuário nesta conversa em 26/09/2026; esta story detalha a correção solicitada, sem criar um novo epic.
- `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md`: etapas, requisitos de avanço e anexos autenticados existentes.
- `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md`: saída Financeiro → Operacional já criada, com vínculo e deduplicação; preservar a visibilidade do card de origem.
- `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md`: comando canônico de transição e configuração publicada; não reintroduzir regra por nome de etapa nem executar o preset financeiro antigo.
- Não foi encontrado `accumulated-context.md` no repositório nesta preparação; as stories acima são o contexto acumulado disponível.

## Acceptance Criteria

1. Contrato assinado **Sim** e pagamento confirmado **Sim** são ambos necessários e suficientes para marcar **CONTRATAÇÃO CONCLUÍDA**, independentemente da ordem dos eventos. Um requisito isolado mantém a contratação aberta. A validação é feita no servidor, inclusive para movimentações manuais e automações.
2. Quando o segundo requisito é confirmado, a contratação recebe automaticamente `CONCLUIDO`, data/hora de conclusão e entrada na etapa **Concluídos**. Repetição do evento ou reprocessamento não altera a primeira data/hora nem duplica movimentação ou evento de conclusão.
3. O card em **Concluídos** apresenta ou permite consultar os dados solicitados: CNPJ, Razão Social, Contato, E-mail, Serviço contratado, Contrato assinado, Data da assinatura, Valor contratado, Valor líquido, Forma de pagamento, Pagamento realizado, Data do pagamento, NF emitida, Número/link da NF, Vendedor responsável, Parceiro/origem, Observações comerciais relevantes e Data de conclusão da contratação. Reutilizar os registros existentes como fonte canônica e evitar valores divergentes entre etapas.
4. Antes da liberação ao Operacional, o servidor valida a presença dos dados necessários à execução do serviço conforme requisitos publicados para o destino. Se faltar informação, impede a criação/encaminhamento, mostra pendências nominais e mantém a contratação concluída e rastreável no Financeiro para correção.
5. Não é possível concluir manualmente ignorando assinatura ou pagamento. Qualquer exceção aos requisitos de liberação operacional exige permissão específica, motivo e registro auditável; usuário sem essa permissão não consegue aplicá-la por UI, action ou automação.
6. Na liberação, é criado exatamente um card/processo na primeira etapa ativa do pipeline Operacional, vinculado ao cliente, negociação e card Financeiro originais. Repetição/reprocessamento preserva o vínculo e não cria duplicata.
7. O card Operacional recebe os dados cadastrais, comerciais e financeiros necessários ao serviço, inclusive vendedor responsável e parceiro/origem. Contrato e demais documentos, bem como o histórico relevante, continuam acessíveis por vínculo a quem tem permissão; a transferência não perde referência nem expõe dados fora das permissões existentes.
8. A nota fiscal tem acompanhamento próprio. Emissão, data e número/link/arquivo da NF podem ser registrados e consultados após a conclusão sem desfazer o estado concluído, reabrir o card de origem ou criar outro card Operacional. A NF não é condição adicional para concluir a contratação.
9. O fluxo existente Comercial/Radar → Financeiro → Operacional permanece funcional; card Financeiro concluído segue visível e vinculado conforme a story de saídas. Falhas de automação ficam registradas e permitem reprocessamento idempotente.

## Tasks / Subtasks

- [x] Mapear campos publicados, requisitos da etapa e dados de origem; definir o mapeamento canônico dos 18 dados do AC 3 e dos requisitos de execução do Operacional (AC 3, 4, 7).
- [x] Reavaliar assinatura e pagamento no comando/serviço do servidor após cada confirmação, acionando a transição publicada quando ambos estiverem válidos, com data/hora imutável e idempotência (AC 1, 2, 9).
- [x] Expor os dados faltantes em Concluídos e preservar acompanhamento editável/vinculado da NF depois do handoff (AC 3, 8).
- [x] Validar os requisitos publicados do destino antes do handoff; mostrar pendências; implementar exceção autorizada, motivada e auditada somente para a liberação operacional (AC 4, 5).
- [x] Completar a cópia/referência de dados, documentos e histórico Financeiro → Operacional, preservando autorização, origem e vendedor; garantir vínculo e deduplicação (AC 6, 7, 9).
- [x] Testar regra de assinatura/pagamento, dados ausentes, bloqueio, exceção e NF nos testes BPM existentes e novos; os testes completos terminaram com duas falhas preexistentes em `tests/debug/error-bus.test.ts` (AC 1–9).
- [x] Executar lint, typecheck, testes e build; atualizar checklist e File List. Publicação e validação em ambiente remoto dependem da autorização específica do checkpoint Vault.

## Dev Notes

- Pontos de integração existentes: `src/lib/bpm/transicao-command.ts` (movimento e guarda); `src/lib/bpm/automacoes/central-runtime.ts` (criação vinculada); `src/actions/bpm/Cards.ts`; `src/lib/bpm/pipeline-financeiro.ts`; formulários do card em `src/app/PainelAlpha/AlphaCRM/CardModal/`. Confirmar os contratos atuais antes de editar.
- A transição canônica e a configuração publicada têm autoridade sobre o avanço. O handoff Operacional existente é disparado pela entrada em Concluídos. Dados de NF lançados depois do handoff precisam de uma superfície autorizada e vinculada, pois a origem concluída fica bloqueada para edição geral.
- Para qualquer mudança de estrutura, configuração em massa, seed ou backfill de banco, aplicar a política Vault do `AGENTS.md`: relatório, backup completo verificado com até 48 horas e confirmação específica do usuário antes da execução. A implementação de código pode avançar separadamente.
- [AUTO-DECISION] Quais dados são indispensáveis para executar cada serviço? → Usar requisitos publicados/configuráveis do pipeline Operacional e apresentar pendências nominais; o pedido não define uma lista fixa por serviço, portanto esta story não inventa uma.
- [AUTO-DECISION] Como mostrar documentos/histórico no destino? → Referência segura pelo vínculo é aceitável se preservar acesso e histórico; o pedido exige disponibilidade, não duplicação física.
- [USER-DECISION] Exceção de dados necessários à execução: somente Admin, CEO e TI, com motivo obrigatório e auditoria. Assinatura e pagamento nunca são dispensados.

## Testing

- Testes de unidade/integração em `tests/bpm/` para transição, automação e permissões; teste integrado Comercial/Radar → Financeiro → Operacional com eventos em ambas as ordens.
- Verificar conclusão e handoff únicos após reprocessamento, bloqueio com pendências nominais, exceção auditável e NF registrada depois da conclusão.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal Integration/API; secundários Frontend e Security; complexidade alta pelo fluxo entre pipelines e autorização.
- **Specialized Agents:** `@dev` implementa; `@qa` verifica regras e regressões; `@architect` revisa eventual decisão de persistência/autorização; `@devops` atua se houver PR/publicação.
- **Quality Gates:** Pre-Commit com revisão e testes por `@dev`; Pre-PR por `@devops` se houver PR; Pre-Deployment por `@devops` se houver publicação.
- **Self-Healing Configuration:** `@dev` light (até 2 iterações/15 min, correção de CRITICAL); `@qa` full (até 3 iterações/30 min, CRITICAL e HIGH); `@devops` check (relatório). MEDIUM vira dívida documentada na revisão full; LOW é ignorado.
- **Focus Areas:** idempotência do evento e card, autorização da exceção e acesso a documentos, validação no servidor, campos copiados, regressão do fluxo publicado e NF posterior.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-09-26 | 0.1 | Story inicial para a correção solicitada | River |
| 2026-09-26 | 0.2 | Implementação local, verificação e checkpoint Vault; configuração remota ainda não publicada | Codex |

## Dev Agent Record

### File List

- `docs/stories/story-alpha-crm-conclusao-financeiro-handoff-operacional.md` (story criada)
- `docs/reports/vault-financeiro-conclusao-operacional-2026-09-26.md`
- `scripts/financeiro-conclusao-operacional-config.mts`
- `src/actions/bpm/{Anexos,Cards,ExcecaoOperacional,NotaFiscal}.ts`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/{financeiro-nota-fiscal,resumo-contratacao-server}.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/{CardFullViewModal,PainelRegistrar,PainelExcecaoOperacional,PainelNotaFiscalConcluida,PainelResumoContratacao}.tsx`
- `src/app/api/bpm/anexos/[anexoId]/route.ts`
- `tests/bpm/{anexo-handoff-access,financeiro-nota-fiscal,financeiro-operacional-handoff,cpf-fechamento-react,exclusao-modal-board-react}.test.ts`

### Verificação de 26/09/2026

- `npm run lint`: 0 erros, 1192 avisos do repositório.
- `npm run typecheck`: aprovado.
- `npm test`: 3911 aprovados, 2 falhas preexistentes no módulo de debug não relacionado, 4 ignorados e 1 pendente.
- `npm run build`: aprovado com avisos existentes do pdfjs.
- Plano somente leitura da publicação: Financeiro v49, Operacional v197. Nenhum `--apply` executado.

## Story Draft Checklist

- [x] Objetivo, valor, fluxo e dependências descritos.
- [x] Critérios de aceite mensuráveis e rastreados às tarefas.
- [x] Pontos de integração e referências específicas indicados.
- [x] Suposições e cenários de erro registrados.
- [x] Abordagem e casos de teste definidos.
- [x] CodeRabbit Integration e gates incluídos.

**Validação:** READY para implementação de código; aplicação de mudança no banco depende do checkpoint Vault. Clareza: 9/10. Os requisitos por serviço devem ser lidos da configuração publicada, sem lista presumida nesta story.
