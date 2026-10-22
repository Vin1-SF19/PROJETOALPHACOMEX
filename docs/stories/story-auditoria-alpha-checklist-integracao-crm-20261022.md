# Story — Auditar Alpha CheckList antes da futura integração CRM

## Status

Done — auditoria documental concluída e aprovada pelo QA; nenhuma correção de código ou publicação executada.

## Executor Assignment

executor: "Bibble / analistas designados"
quality_gate: "@qa"
quality_gate_tools: ["rastreabilidade por arquivo/linha", "testes focados existentes pertinentes", "revisão do relatório e dos limites de evidência"]

## Story

Como responsável pelo Painel Alpha, quero entender o funcionamento, defeitos, repetições e oportunidades de melhoria do **módulo autônomo Alpha CheckList (`/PainelAlpha/CheckList`)**, para decidir o que e como melhorar antes de uma futura integração com o CRM.

Bibble coordena a análise solicitada. **Escopo somente análise/documentação**, sem implementação, commit/push/deploy, alteração de banco/dados, arquivos de ambiente ou testes em registros reais. DevOps prepara snapshot recente de `origin/staging`; registrar SHA real antes de auditar. A futura integração CRM é objeto de diagnóstico/proposta, não autorização para implementá-la.

## Acceptance Criteria

1. O relatório `docs/reports/auditoria-alpha-checklist-2026-10-22.md` registra snapshot/SHA, escopo, método e limites. Cada conclusão relevante aponta para arquivo e linha/função do snapshot e, quando aplicável, teste/comando/resultado. Não usa o checkout compartilhado sujo como prova da versão remota.
2. O mapa funcional explica o que funciona e o que falha ou não foi verificado: entrada no módulo, cadastro/seleção de empresa/cliente/pasta, criação/obtenção do checklist, escolha de embasamento/modelos, instanciação de itens, estados/progresso, documentos/upload/exclusão/download/ZIP, histórico e notificações. Rastreia UI → action/rota → modelo/regra e eventuais efeitos colaterais de operações apresentadas como leitura.
3. A análise cobre dados/relacionamentos, fonte cadastral Cliente Master, múltiplos checklists/tipos por empresa e regras de modelos globais/específicos, integridade, transações/concorrência/idempotência pertinentes e tratamento de erros. Não presume comportamento pela existência de botão, nome de função ou comentário.
4. A auditoria diferencia autenticação, acesso ao módulo, autorização por recurso e permissões de operações sensíveis no backend e na UI. Examina acesso por cliente/empresa/documento/ZIP e comportamento de negação, sem expor dados reais, tokens ou URLs privadas. Uma lacuna de evidência não é declarada como vulnerabilidade comprovada.
5. O relatório distingue claramente **CheckList legado/autônomo** (`Checklist`, `ItemChecklist`, documentos e modelos próprios) de **procedimentos/checklists BPM do CRM** (`BpmChecklist*`/`BpmCardChecklist*`). Mapeia integração CRM existente de fato versus vínculos, contratos e comportamentos ausentes para uma integração futura; não recomenda duplicar ou substituir domínio sem justificar.
6. Defeitos comprovados, riscos/hipóteses e propostas ficam identificados separadamente, com evidência e condição de ocorrência. Funções repetidas são avaliadas por responsabilidade e diferenças de contrato, sem presumir que nomes semelhantes representam duplicação indevida. O relatório não inventa causa para sintomas não reproduzidos.
7. Melhorias propostas respondem **o que mudar, como mudar, impacto e como testar**, com prioridade justificada, arquivos/contratos afetados, dependências e sequência em etapas. Distingue correções necessárias de decisões de produto/arquitetura e de mudanças de banco que exigiriam futuramente Vault/aprovação; nenhuma proposta é aplicada nesta auditoria.
8. São executados testes focados existentes e pertinentes em ambiente isolado, quando disponíveis, com comandos/resultados reais e dependências externas simuladas. Lacunas de cobertura, testes que apenas inspecionam texto/mocks e impossibilidade de validação autenticada são explícitos. Os quatro gates de implementação não são exigidos automaticamente para esta auditoria sem código; qualquer teste amplo adicional precisa de motivo concreto.
9. A auditoria não altera fonte, schema, banco, dados reais, ambientes ou configurações; não chama actions com efeitos de escrita para “inspecionar” registros. O relatório e esta story documentam somente evidências sanitizadas. Checklist e File List refletem os artefatos realmente produzidos e a revisão de consistência/QA do relatório.

## Contexto técnico e referências

- `src/app/PainelAlpha/CheckList/`: páginas raiz/empresa, `ListaChecklist.tsx`, `ChecklistView.tsx`, cadastro, Embasamentos e Histórico compõem o módulo autônomo. Mapear os fluxos presentes no snapshot escolhido, sem inferir equivalência com o CRM.
- `src/actions/checklist.ts` e `src/actions/checklist-modelos.ts`: contratos de listagem/criação/atualização, documentos e modelos. Conferir sessão, validações e efeitos reais antes de invocar qualquer export durante testes.
- `src/lib/checklist/items.ts` e `modelos.ts`: regras de progresso, seções/tipos e definições do domínio legado.
- `prisma/schema.prisma`, `PastaChecklist`, `Checklist`, `ModeloItemChecklist`, `ItemChecklist`, `DocumentoChecklist`: checklist liga-se a `OperacionalClientes`, com unicidade empresa/tipo; modelo pode ser global (`tipo` nulo). Examinar relações reais também com Cliente/ClienteOperacional e documentos, sem executar migrations.
- `src/app/api/checklist/[empresaId]/documentos/zip/route.ts`, `src/hooks/useChecklistNotifications.ts`, `src/store/useChecklistNotificacoes.ts` e `src/components/Checklist/`: contratos relevantes de ZIP/notificações a rastrear, inclusive autorização e erro.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelEnvioChecklistOperacional.tsx`, `src/lib/bpm/checklist-envio-operacional.ts` e `docs/stories/story-alpha-crm-operacional-envio-checklist-atualizado.md`: pontos candidatos da integração já existente a confirmar no snapshot; presença de código não comprova fluxo acessível ou executado.
- `src/actions/bpm/Checklists.ts` e `src/lib/bpm/checklists/`: domínio BPM separado; consultar somente para esclarecer fronteira/integração, sem deslocar o alvo da auditoria para procedimentos CRM.
- `tests/operacional/checklist-cliente-master.test.ts` já cobre contratos do legado com mocks. `tests/bpm/checklist-envio-operacional.test.ts` é candidato para integração. Verificar o que cada teste realmente demonstra; cobertura BPM genérica não valida o módulo autônomo inteiro.
- `AGENTS.md`, Constitution e stories anteriores de organização/modelos do checklist orientam escopo e contexto; artefatos contraditórios são registrados, não tratados automaticamente como comportamento atual.

**[AUTO-DECISION] Preparação:** usar pedido direto como origem, sem criar epic/tracking externo ou ampliar escopo para implementação. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto cruzado será revalidado nas stories/contratos do snapshot auditado. Identificações acima são pontos de partida, não achados concluídos.

## Tarefas / subtarefas

- [x] Registrar objetivo, fronteiras legado/BPM, critérios e aplicar checklist de draft.
- [x] DevOps preparar snapshot recente de origin/staging e registrar SHA/isolamento (AC 1): `60ae49ffeb3711592337b63225934ccb88119543`; dependências independentes e ambiente sintético.
- [x] Mapear fluxos de UI/action/modelos, criação, itens/progresso e efeitos colaterais (AC 2–3): Scout, Echo e Nova concluíram.
- [x] Examinar ACL, documentos, histórico, notificações e ZIP; registrar evidência e negações (AC 2–4): cadeia estática e limites explicitados.
- [x] Mapear fronteira/integração CRM existente versus faltante e repetições relevantes (AC 5–6): Scout concluiu inventário e blueprint; Architect entregou opções e proposta de vínculo explícito com projeção.
- [x] Executar testes focados existentes pertinentes e registrar resultados/lacunas (AC 8): 18 testes existentes PASS; 3 reproduções isoladas confirmam defeitos A02/A04/A09.
- [x] Produzir relatório com classificação de achados, prioridades e plano em etapas com testes (AC 1, 6–7): 17 achados agrupados; arquitetura e resultados isolados incorporados.
- [x] Revisar rastreabilidade, sanitização e limites; atualizar checklist/File List/status (AC 9): QA APPROVED exclusivamente para a auditoria documental, AC 1–9.

## Testing e validação

Usar testes existentes com fixtures/banco/IO simulados; nenhum documento, cliente ou checklist real será criado ou alterado para teste. Inspecionar chamadas com inicialização preguiçosa/upsert antes de executá-las. Registrar diferenças entre evidência estática, teste isolado e fluxo autenticado. A conclusão pode apontar lacunas verificáveis sem alegar que todo o módulo foi validado funcionalmente.

## CodeRabbit Integration

**Tipo:** análise somente leitura. **Agentes:** Bibble coordena, analistas auditam, @qa revisa evidência, DevOps prepara snapshot. **Gates:** revisão documental e testes focados pertinentes; Pre-Commit/PR/Deployment e self-healing de código não se aplicam, pois nenhum código ou publicação é autorizado. CodeRabbit não substitui evidência de funcionamento e não é executado como gate de patch inexistente.

## Validação da preparação — @sm

`story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit N/A para patch, tratamento documental explícito. **READY, clareza 9/10.** Snapshot e achados ainda pendentes; nenhuma conclusão técnica da auditoria é afirmada nesta preparação.

## Dev Agent Record e File List

- `docs/stories/story-auditoria-alpha-checklist-integracao-crm-20261022.md` — objetivo, checklist, evidências e fechamento da auditoria.
- `docs/reports/auditoria-alpha-checklist-2026-10-22.md` — relatório com fluxos, achados, repetições, proposta Architect e plano de validação.
- `.bibble/memory/journal.md` — entrada append-only de Kowalski com aprendizados, limites e pendências; histórico anterior preservado.

## QA Results

Quinn/Sage revisou os 17 achados, prioridades, evidências e proposta; nenhuma mudança de gravidade/conteúdo exigida. Pendência documental inicial: incorporar resultados e fechar checklist. Resultados incorporados: 3 arquivos/18 testes existentes PASS (183ms) e 1 harness temporário/3 reproduções PASS de defeitos atuais (352ms). Auth/Prisma/fetch simulados; handler ZIP e JSZip reais. Harness removido; evidência sanitizada em `/tmp/auditoria-checklist-20261022-{qa.md,repro-harness.ts}`. Sem DB/navegador/portal real, cobertura percentual ou gates globais. Parecer final: **APPROVED — auditoria documental**, AC 1–9. Story autorizada a Done pelo QA. Não é aprovação funcional do módulo atual nem autorização de publicação.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 0.1 | Preparação da auditoria somente análise do Alpha CheckList | River (@sm) |
| 2026-10-22 | 0.2 | Snapshot, auditoria de fluxos/backend/UI e proposta Architect; 18 testes e 3 reproduções isoladas; QA APPROVED documental | Bibble / especialistas |
