# Story — Alpha CRM: conclusão automática do Financeiro e entrega completa ao Operacional

## Status

Ready for Review — configuração da etapa `Concluídos` publicada no Financeiro ativo e código implantado em produção; homologação com card real e revisão de um card legado incompleto pendentes. A implementação e a verificação de 26/09/2026 permanecem registradas abaixo como evidência histórica, não como prova da configuração atual.

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Story

**Como** equipe comercial, financeira e operacional, **quero** que a contratação seja concluída somente depois de contrato assinado e pagamento confirmado, com encaminhamento completo e rastreável ao Operacional, **para** iniciar o serviço com os dados necessários sem perder documentos, histórico e acompanhamento da nota fiscal.

## Fonte e dependências

- Requisitos fornecidos pelo usuário nesta conversa em 26/09/2026; esta story detalha a correção solicitada, sem criar um novo epic.
- Retomada do pedido em 29/09/2026: aplicar os mesmos requisitos à etapa `Concluídos` do Financeiro ativo, com todos os dados configuráveis em **Configurações → Campos e Formulários**, e auditar a automação de handoff existente antes de alterá-la.
- `docs/stories/story-financeiro-ativo-confirmacao-pagamento.md`, `docs/stories/story-financeiro-ativo-formalizacao.md` e `docs/stories/story-financeiro-ativo-emissao-nota-fiscal.md`: identidades e validações recentes de pagamento, assinatura e NF. Conferir o banco ativo antes de reutilizar campo, versão ou regra.
- `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md`: etapas, requisitos de avanço e anexos autenticados existentes.
- `docs/stories/story-alpha-crm-saidas-radar-financeiro-operacional.md`: saída Financeiro → Operacional já criada, com vínculo e deduplicação; preservar a visibilidade do card de origem.
- `docs/reports/diagnostico-fluxo-financeiro-2026-09-25.md`: comando canônico de transição e configuração publicada; não reintroduzir regra por nome de etapa nem executar o preset financeiro antigo.
- Não foi encontrado `accumulated-context.md` no repositório nesta preparação; as stories acima são o contexto acumulado disponível.

## Acceptance Criteria

1. Contrato assinado **Sim** e pagamento confirmado **Sim** são ambos necessários para marcar **CONTRATAÇÃO CONCLUÍDA**, independentemente da ordem dos eventos. A entrada efetiva em **Concluídos** também exige NF emitida e completa e todos os demais dados obrigatórios aplicáveis preenchidos e válidos, conforme esclarecimentos do usuário em 29/09/2026. Um requisito isolado, NF pendente ou dado obrigatório faltante mantém o card fora da etapa. A validação é feita no servidor, inclusive para movimentações manuais e automações.
2. Quando assinatura, pagamento, NF e todos os dados exigidos para a entrada estão completos, a contratação recebe automaticamente `CONCLUIDO`, data/hora de conclusão e entrada na etapa **Concluídos** na mesma operação lógica. A data/hora de conclusão é gerada atomicamente nessa primeira entrada válida; não se exige que esteja previamente preenchida. Repetição do evento ou reprocessamento não altera a primeira data/hora nem duplica movimentação ou evento de conclusão.
3. O card em **Concluídos** apresenta ou permite consultar os dados solicitados: CNPJ, Razão Social, Contato, E-mail, Serviço contratado, Contrato assinado, Data da assinatura, Valor contratado, Valor líquido, Forma de pagamento, Pagamento realizado, Data do pagamento, NF emitida, Número/link da NF, Vendedor responsável, Parceiro/origem, Observações comerciais relevantes e Data de conclusão da contratação. Reutilizar os registros existentes como fonte canônica e evitar valores divergentes entre etapas.
4. Antes da entrada em **Concluídos** e da liberação ao Operacional, o servidor valida a presença dos dados obrigatórios da etapa e dos necessários à execução do serviço conforme requisitos publicados para o destino. Se faltar informação, impede a conclusão, a criação/encaminhamento, mostra pendências nominais e mantém o card na etapa anterior para correção.
5. Não é possível concluir manualmente ignorando assinatura ou pagamento. Qualquer exceção aos requisitos de liberação operacional exige permissão específica, motivo e registro auditável; usuário sem essa permissão não consegue aplicá-la por UI, action ou automação.
6. Na liberação, é criado exatamente um card/processo na primeira etapa ativa do pipeline Operacional, vinculado ao cliente, negociação e card Financeiro originais. Repetição/reprocessamento preserva o vínculo e não cria duplicata.
7. O card Operacional recebe os dados cadastrais, comerciais e financeiros necessários ao serviço, inclusive vendedor responsável e parceiro/origem. Contrato e demais documentos, bem como o histórico relevante, continuam acessíveis por vínculo a quem tem permissão; a transferência não perde referência nem expõe dados fora das permissões existentes.
8. A nota fiscal tem acompanhamento próprio e independente do estado de assinatura, mas sua emissão válida é condição adicional de entrada em **Concluídos** na regra atual. `NF emitida = Sim` exige número, data de emissão válida, valor maior que zero e arquivo/link acessível do card, conforme a story da etapa de NF. Após a conclusão, a NF continua vinculada e consultável; correções auditadas não desfazem o estado concluído, reabrem o card de origem nem criam outro card Operacional.
9. O fluxo existente Comercial/Radar → Financeiro → Operacional permanece funcional; card Financeiro concluído segue visível e vinculado conforme a story de saídas. Falhas de automação ficam registradas e permitem reprocessamento idempotente.
10. Os 18 dados do AC 3 são consultáveis na etapa `Concluídos` do Financeiro ativo e têm definições, apresentação no formulário, opções e obrigatoriedades aplicáveis configuráveis em **Configurações → Campos e Formulários**. Reutilizar as chaves canônicas publicadas nas etapas anteriores, inclusive `Pagamento confirmado` para o dado exibido como `Pagamento realizado`, sem manter cópias divergentes. Dados derivados, como valor líquido e data/hora de conclusão, podem ser somente leitura no card; sua definição e apresentação permanecem administráveis na UI. A validação no servidor respeita a configuração publicada e preserva valores históricos.
11. Antes de modificar a automação Financeiro → Operacional já existente, inventariar gatilho, condição, ações, versão ativa, criação de card, vínculo, deduplicação, mapeamento de dados e documentos, autorização e tratamento de falha. Corrigir apenas lacunas verificadas. Confirmar que a entrada em `Concluídos` ocorre uma vez quando assinatura, pagamento, NF e demais dados estão válidos, em qualquer ordem de chegada, e que a alteração posterior da NF não recria o processo operacional.
12. A tentativa manual de marcar `CONTRATAÇÃO CONCLUÍDA` ou mover o card para `Concluídos` por UI, action, comando ou automação obedece aos mesmos requisitos de assinatura, pagamento e NF válidos e aos demais dados obrigatórios da etapa. A exceção específica do AC 5 limita-se aos dados de liberação operacional; não dispensa assinatura, pagamento ou NF.
13. O servidor avalia os requisitos de entrada em **Concluídos** também em movimento manual, evento automático e reprocessamento. A única exceção ao preenchimento dos dados de entrada é a própria `Data de conclusão da contratação`, que nasce atomicamente na transição válida. Nenhum card incompleto aparece em **Concluídos** por falha do handoff ou por edição direta do status.

## Retomada do Financeiro ativo — 29/09/2026

Esta retomada amplia os critérios existentes; não apaga os resultados de 26/09. O estado atual do pipeline e a publicação da configuração anterior precisam de leitura independente. Não tomar o plano histórico Financeiro v49/Operacional v197 como versão corrente.

### Checklist da retomada

- [x] Inventariar somente leitura a etapa `Concluídos`, seus campos/formulário/requisitos, o resumo do card, os campos canônicos das etapas anteriores, o pipeline Operacional e as versões ativas das automações (AC 1–4, 8, 10–11).
- [x] Construir matriz dos 18 dados: origem canônica, identificador, representação na etapa, obrigatoriedade configurada, destino operacional e referência segura a documento/histórico; identificar lacunas sem criar campos redundantes (AC 3–4, 7–8, 10).
- [x] Verificar nos pontos de entrada manuais e automáticos assinatura, pagamento e NF efetivamente validados, os demais dados obrigatórios completos, ambas as ordens de assinatura/pagamento, data/hora gerada atomicamente e imutável, transição idempotente e bloqueio de bypass; conservar a exceção operacional autorizada apenas para dados de execução (AC 1–2, 4–5, 8, 12–13). Verificação local; publicação remota pendente.
- [x] Auditar e, se necessário, corrigir a automação já publicada de handoff para um único processo operacional, com vínculo à negociação/cliente/card de origem, mapeamento completo, permissões de documentos e histórico, vendedor e parceiro/origem; registrar falha e permitir reprocessamento seguro (AC 4, 6–7, 9, 11). Correção local do reconhecimento do pipeline sem chave; publicação remota pendente.
- [x] Publicar os dados, condições e formulário de `Concluídos` em **Configurações → Campos e Formulários**, exigindo NF válida na entrada e mantendo seu acompanhamento próprio/consulta após a conclusão (AC 3, 8, 10, 12). Registros publicados e lidos de volta; código do servidor implantado e SHA de produção conferido.
- [x] Exercitar testes existentes de assinatura→pagamento e pagamento→assinatura, NF pendente/inválida e válida, bypass, ausência de dados operacionais, exceção permitida/negada, reprocessamento, documentos privados e correção posterior da NF; executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (AC 1–13). Smoke integrado do novo formulário remoto pendente da publicação.
- [x] **Checkpoint Vault antes de qualquer mutação no banco:** relatar ambiente/banco, comandos, impacto, riscos, alternativa não destrutiva e rollback; criar ou comprovar backup completo em `database-backups/pre-change/`, com até 48 horas e restauração/verificação; obter autorização explícita específica para a publicação desta retomada. O usuário respondeu “publique” à pergunta específica; Financeiro v18/Operacional v8 e registros foram confirmados por leitura posterior (AC 3–4, 6–11).
- [x] Atualizar checklist, File List e evidências reais da retomada; não marcar AC como concluído com base apenas nos resultados de 26/09.

### Cenários adicionais de aceite

1. Com somente assinatura ou somente pagamento válido, a conclusão manual e a automática não são liberadas. Com ambos válidos mas NF pendente/inválida ou outro dado obrigatório ausente, o card continua na etapa anterior com pendência nominal. Após validar NF e preencher os demais dados, passa uma vez a `Concluídos`, gera a data/hora no mesmo ato e mantém esse primeiro instante após reprocessamento.
2. Remover um dado exigido pelo serviço bloqueia a conclusão e a liberação operacional e mostra a pendência; um usuário sem permissão não consegue usar exceção. Admin, CEO ou TI podem registrar motivo e auditoria apenas para dados operacionais, conforme a decisão existente, se a política publicada permitir a exceção sem violar o critério de entrada.
3. Na UI administrativa, editar e publicar a apresentação ou regra aplicável de um dos 18 dados altera o formulário/validação efetiva sem trocar a fonte canônica nem apagar registros anteriores.
4. Ao liberar, o destino recebe ou consegue consultar cadastro, serviço, dados comerciais e financeiros, vendedor, parceiro/origem, documentos e histórico conforme permissão. Repetir evento ou emitir NF depois mantém um único card operacional vinculado.

### Decisões de escopo

- `[AUTO-DECISION]` O pedido atual não especifica novos requisitos por serviço. Usar os requisitos publicados do destino e expor pendências nominais, sem inventar uma lista universal de campos operacionais.
- `[AUTO-DECISION]` A automação de handoff já existe; inventário e teste de regressão precedem qualquer mudança em seu grafo ou mapeamento. Não criar uma segunda automação paralela sem lacuna demonstrada.
- `[USER-DECISION — 29/09/2026]` Para entrar em **Concluídos**, exigir `NF emitida = Sim` e NF completa, com número, data de emissão válida, valor positivo e arquivo/link acessível, conforme as validações já definidas para a etapa de NF. Esta decisão posterior substitui a regra anterior de NF não condicionante para a conclusão. A independência do acompanhamento da NF em relação à assinatura continua válida.
- `accumulated-context.md` e `.aiox/gotchas.json` continuam ausentes neste checkout. As stories relacionadas e a configuração corrente fornecem o contexto verificável.

### Inventário e plano verificável da retomada

- Financeiro ativo v17, Concluído sem formulário e três transições de entrada sem lifecycle concluído; Operacional ativo v7, Boas vindas sem formulário. A automação `financeiro_concluido_criar_card_operacional` v1 já aponta para o Operacional real. O código a reconhecia apenas pela chave `operacional`, que está vazia no registro ativo; o helper por ID corrige essa lacuna sem substituir o grafo da automação.
- Os dados solicitados correspondem a 23 componentes no formulário de Concluído: cadastro (CNPJ, Razão Social, Contato, E-mail), serviço, assinatura (estado, data, anexo), valores (contratado, líquido), pagamento (forma, confirmação, data), NF (estado, número, data, valor, arquivo/link), responsabilidade (vendedor, parceiro, origem), observações e data/hora de conclusão. Os 20 campos reutilizados mantêm suas chaves canônicas; apenas Contato, Observações e a data/hora derivada exigem novas definições. Parceiro é opcional; data/hora nasce na transição; os outros 21 componentes são obrigatórios na entrada, além da validação semântica de assinatura, pagamento e NF.
- O formulário de Boas vindas usa 20 desses campos; IDs de anexos do Financeiro ficam apenas no card de origem e são consultáveis pelo vínculo, sem copiar um ID de arquivo privado para outro card. O handoff conserva referência à negociação original, vendedor e parceiro, verifica faltas na etapa operacional e é idempotente por vínculo.
- Existe um card legado na etapa Concluído com status ativo e requisitos ausentes, já vinculado ao Operacional. A publicação proposta não altera esse registro; ele está sinalizado para revisão humana separada. A regra nova impede novas entradas incompletas, sem reescrever silenciosamente o histórico.
- A configuração foi publicada de Financeiro v17→v18 e Operacional v7→v8, com três definições, formulários, três arestas e uma automação nova. O checkpoint e a verificação posterior constam de `docs/reports/vault-financeiro-ativo-concluidos-2026-09-29.md`. O código da regra de NF e do handoff foi implantado; o endpoint público confirmou o SHA do deployment.

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
- **Focus Areas:** idempotência do evento e card, autorização da exceção e acesso a documentos, validação no servidor, campos copiados, regressão do fluxo publicado, NF obrigatória na entrada e correção posterior.

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-09-26 | 0.1 | Story inicial para a correção solicitada | River |
| 2026-09-26 | 0.2 | Implementação local, verificação e checkpoint Vault; configuração remota ainda não publicada | Codex |
| 2026-09-29 | 0.3 | Reabertura para `Concluídos` do Financeiro ativo, UI configurável e auditoria do handoff existente | River |
| 2026-09-29 | 0.4 | Entrada em `Concluídos` exige dados completos; data/hora atômica; regra de NF pendente de decisão | River |
| 2026-09-29 | 0.5 | Decisão do usuário: NF emitida e válida passa a ser requisito de entrada em `Concluídos` | River |
| 2026-09-29 | 0.6 | Configuração remota v18/v8 publicada após Vault e autorização; leitura posterior aprovada, deploy do código pendente | Codex |
| 2026-09-29 | 0.7 | Envio e deploy de produção autorizados, Vercel aprovada e SHA público conferido | Codex |

## Dev Agent Record

### File List

- **Retomada 29/09/2026:** `docs/stories/story-alpha-crm-conclusao-financeiro-handoff-operacional.md`; `docs/reports/vault-financeiro-ativo-concluidos-2026-09-29.md`; `scripts/diagnosticar-concluidos-financeiro.mts`; `scripts/configurar-concluidos-financeiro-ativo.mts`; `scripts/verificar-concluidos-financeiro-ativo.mts`; `src/lib/bpm/{campos-configuraveis,campos-configuraveis-server,financeiro-config.client,resumo-contratacao-server,transicao-command}.ts`; `src/lib/bpm/automacoes/central-runtime.ts`; `src/actions/bpm/{Cards,ExcecaoOperacional}.ts`; `tests/bpm/{campos-configuraveis,financeiro-operacional-handoff}.test.ts`.
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

### Verificação local da retomada — 29/09/2026

- Prévia de `scripts/configurar-concluidos-financeiro-ativo.mts` aprovada contra Financeiro v17 e Operacional v7. Nenhum `--apply` executado; configuração remota e smoke de UI ainda pendentes.
- `npm run lint`: zero erros, 1191 avisos existentes. `npm run typecheck`: aprovado. `npm test`: 558 arquivos, 4099 testes aprovados, 4 ignorados e 1 pendente. `npm run build`: aprovado.
- Backup Turso dedicado em `database-backups/pre-change/`, criado em 29/09/2026 15:11:58 UTC, SHA-256 `46488faa460fd815ba2857473ac7c6c0ff209768999056ddd24edb33b22943ce`; restauração isolada verificada, integridade e chaves estrangeiras aprovadas. Expira em 01/10/2026 15:11:58 UTC.
- Publicação remota autorizada em 29/09/2026: Financeiro v18, Operacional v8; formulário Concluído com 23 componentes, NF v4 e Boas vindas com 20. Leitura independente passou após corrigir o verificador para ignorar uma configuração anterior fora dos 20 componentes publicados. Card legado preservado. Código `8973f8e6` enviado em `origin/main`; Vercel concluiu e o domínio de produção retornou `a292f5da9f5e903ded6ba1f772fd359bafe6646f` pelo endpoint `/api/health/version`. Smoke autenticado com card real permanece pendente.

## Story Draft Checklist

- [x] Objetivo, valor, fluxo e dependências descritos.
- [x] Critérios de aceite mensuráveis e rastreados às tarefas.
- [x] Pontos de integração e referências específicas indicados.
- [x] Suposições e cenários de erro registrados.
- [x] Abordagem e casos de teste definidos.
- [x] CodeRabbit Integration e gates incluídos.

**Validação:** READY para implementação de código; aplicação de mudança no banco depende do checkpoint Vault. Clareza: 9/10. Os requisitos por serviço devem ser lidos da configuração publicada, sem lista presumida nesta story.

### Checklist do draft da retomada — 29/09/2026

- [x] Objetivo e valor mantidos; escopo delimitado ao Financeiro ativo e ao handoff existente.
- [x] AC 1–9 preservados como base e refinados pelo esclarecimento posterior; AC 10–13 cobrem configuração na UI, auditoria da automação, bloqueio de bypass e critério de entrada.
- [x] Dependências e referências cruzadas de assinatura, pagamento e NF indicadas.
- [x] Suposições, versão a inventariar, cenários de erro e política de exceção documentados.
- [x] Testes de aceite, gates e checkpoint Vault definidos antes de publicação.
- [x] CodeRabbit Integration existente permanece aplicável; foco ampliado para formulário configurável e regressão do handoff.

**Resultado:** READY para inventário e implementação local, inclusive da regra de NF obrigatória; publicação bloqueada até relatório Vault, backup verificado e autorização específica. A configuração atual e a matriz dos 18 dados ainda exigem inventário somente leitura.
